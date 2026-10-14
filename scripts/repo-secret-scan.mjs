#!/usr/bin/env node
// MedCore repository secret scanner — scope, rules, and exit codes.
//
// Scope:
//   Default: every file tracked by git (working-tree content), plus path rules
//   applied to the tracked path list itself. Optional: --paths <file...> scans
//   explicit files (used by tests and for ad-hoc checks). Optional:
//   --rev <ref> scans every blob reachable from a ref (full-history mode;
//   R5 path rules apply to historical pathnames too).
//
// Rules:
//   R1 PRIVATE_KEY   private key material blocks
//   R2 TOKEN_SHAPE   provider token shapes (AWS, GitHub, Slack, GitLab, npm, JWT)
//   R3 URL_CREDENTIAL credential-bearing DB/infra URLs whose password is not a
//                    published placeholder (SHA-1 fingerprint allowlist)
//   R4 SECRET_ASSIGN literal values assigned to secret key names; YAML bare
//                    values and quoted JS/TS/YAML values, same allowlist
//   R5 TRACKING      tracked paths that local-only rules must never allow
//                    (.env variants, dumps, private docs, keys, local DBs, logs)
//
// Output: file:line:RULE:category per finding — never a matched value.
// Exit codes: 0 no findings, 1 findings, 2 usage or internal error.
//
// Allowlisted values are published placeholders already present in the public
// repository; only their SHA-1 fingerprints are stored here.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

export const URL_PASSWORD_FP = new Set([
  "112bb791304791ddcf692e29fd5cf149b35fea37",
  "afc848c316af1a89d49826c5ae9d00ed769415f3",
  "9d4e1e23bd5b727046a9e3b4b7db57bd8d6ee684",
  "ea88fbaa99b73225752e2ef67593f775848160ad",
  "ff55435345834a3fe224936776c2aa15f6ed5358",
  "1a91d62f7ca67399625a4368a6ab5d4a3baa6073",
  "e5e9fa1ba31ecd1ae84f75caaa474f3a663f05f4",
  "6ce94b867c847d9fe58339032c578406ac626e90",
]);

export const SECRET_LITERAL_FP = new Set([
  "8bcf61c92e30cec9b93d04a669d12804b3bede1f",
  "9b6cb95155429b7c42594646953327aa608a58a8",
  "8b2277b0b666bfe5d9589a288ab92d7fb14e99ce",
  "89c3a24291dba42c162d636d251dc8b220eff726",
  "143ea89d2e447d40a1336af188d92ad056417243",
]);

export function sha1hex(value) {
  return createHash("sha1").update(value, "utf8").digest("hex");
}

export function isForbiddenTrackedPath(path) {
  const posix = path.replaceAll("\\", "/");
  if (/(^|\/)\.env(?!\.example$)/.test(posix)) return ["R5", "env-file"];
  if (/\.(dump|sql\.gz|backup)$/.test(posix)) return ["R5", "backup-artifact"];
  const base = posix.split("/").pop();
  if (["Architecture.md", "Design.md", "PRD.md", "Phases.md", "Rules.md"].includes(base))
    return ["R5", "private-doc"];
  if (base === "Memory.md") return ["R5", "private-doc"];
  if (/\.(key|pem|p12|pfx)$/.test(posix)) return ["R5", "key-material"];
  if (/\.(db|sqlite|sqlite3)$/.test(posix) || /\.(db|sqlite)-(journal|wal|shm)$/.test(posix))
    return ["R5", "local-database"];
  if (/\.log$/.test(posix)) return ["R5", "log-file"];
  return null;
}

const PRIVATE_KEY_RE = /-----BEGIN (?:[A-Z0-9]+ )?PRIVATE KEY-----/;

const TOKEN_SHAPES = [
  ["aws-access-key", /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/],
  ["github-token", /\bgh[pousr]_[A-Za-z0-9]{36,}\b/],
  ["github-pat", /\bgithub_pat_[A-Za-z0-9_]{22,}\b/],
  ["slack-token", /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/],
  ["gitlab-token", /\bglpat-[A-Za-z0-9_-]{20,}\b/],
  ["npm-token", /\bnpm_[A-Za-z0-9]{36}\b/],
  ["jwt", /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\b/],
];

const URL_CREDENTIAL_RE =
  /\b(?:postgres(?:ql)?|mysql|mariadb|mongodb(?:\+srv)?|redis|rediss|amqp):\/\/[^/\s:'"]+:([^@\s/'"]+)@/g;

const SECRET_KEY_NAMES =
  "AUTH_SECRET|AUTH_SECRET_KEY|JWT_SECRET|SESSION_SECRET|SIGNING_SECRET|SECRET_KEY|API_KEY|ACCESS_TOKEN|REFRESH_TOKEN|CLIENT_SECRET|PRIVATE_KEY";

const SECRET_QUOTED_RE = new RegExp(
  `\\b(?:${SECRET_KEY_NAMES})\\s*(?:\\?\\?=|[:=])\\s*(['"])([^'"]+)\\1`,
  "g",
);
const SECRET_BARE_RE = new RegExp(
  `\\b(?:${SECRET_KEY_NAMES})\\s*:\\s*([A-Za-z0-9][A-Za-z0-9._/+=-]{7,})\\s*$`,
  "m",
);

function lineOf(content, index) {
  let line = 1;
  for (let i = 0; i < index; i++) if (content.charCodeAt(i) === 10) line++;
  return line;
}

function isInterpolated(value) {
  return value.includes("${") || value.includes("process.env");
}

export function scanContent(content, path) {
  const findings = [];
  const isYaml = /\.(ya?ml)$/i.test(path);

  if (PRIVATE_KEY_RE.test(content)) {
    const m = PRIVATE_KEY_RE.exec(content);
    findings.push({ path, line: lineOf(content, m.index), rule: "R1", category: "private-key" });
  }

  for (const [category, re] of TOKEN_SHAPES) {
    const m = re.exec(content);
    if (m) findings.push({ path, line: lineOf(content, m.index), rule: "R2", category });
  }

  URL_CREDENTIAL_RE.lastIndex = 0;
  let m;
  while ((m = URL_CREDENTIAL_RE.exec(content)) !== null) {
    const password = m[1];
    if (isInterpolated(password)) continue;
    if (!URL_PASSWORD_FP.has(sha1hex(password))) {
      findings.push({
        path,
        line: lineOf(content, m.index),
        rule: "R3",
        category: "db-infra-credential",
      });
    }
  }

  SECRET_QUOTED_RE.lastIndex = 0;
  while ((m = SECRET_QUOTED_RE.exec(content)) !== null) {
    const value = m[2];
    if (isInterpolated(value)) continue;
    if (value.trim() === "") continue;
    if (!SECRET_LITERAL_FP.has(sha1hex(value))) {
      findings.push({
        path,
        line: lineOf(content, m.index),
        rule: "R4",
        category: "secret-assignment",
      });
    }
  }

  if (isYaml) {
    const bare = SECRET_BARE_RE.exec(content);
    if (bare && !isInterpolated(bare[1]) && !SECRET_LITERAL_FP.has(sha1hex(bare[1]))) {
      findings.push({
        path,
        line: lineOf(content, bare.index + bare[0].indexOf(bare[1])),
        rule: "R4",
        category: "secret-assignment",
      });
    }
  }

  return findings;
}

function looksBinary(buffer) {
  const probe = buffer.subarray(0, 8192);
  return probe.includes(0);
}

function gitLines(args) {
  const out = execFileSync("git", args, { encoding: "buffer", maxBuffer: 32 * 1024 * 1024 });
  return out.toString("utf8").split("\0").filter((s) => s !== "");
}

export function scanRevision(rev) {
  const listing = execFileSync("git", ["rev-list", "--objects", rev], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const oidToPath = new Map();
  const oids = [];
  for (const line of listing.split("\n")) {
    const m = line.match(/^([0-9a-f]{40})(?: (.*))?$/);
    if (!m) continue;
    if (!oidToPath.has(m[1])) {
      oidToPath.set(m[1], m[2] || "(unknown)");
      oids.push(m[1]);
    }
  }
  const batch = execFileSync("git", ["cat-file", "--batch"], {
    input: oids.join("\n") + "\n",
    maxBuffer: 512 * 1024 * 1024,
  });
  const buf = Buffer.isBuffer(batch) ? batch : Buffer.from(batch);
  const findings = [];
  let off = 0;
  while (off < buf.length) {
    const nl = buf.indexOf(10, off);
    if (nl === -1) break;
    const header = buf.toString("utf8", off, nl);
    off = nl + 1;
    const parts = header.split(" ");
    if (parts[1] === "missing") continue;
    const size = parseInt(parts[2], 10);
    const blob = buf.subarray(off, off + size);
    off += size + 1;
    const path = oidToPath.get(parts[0]) || "(unknown)";
    const track = isForbiddenTrackedPath(path);
    if (track) findings.push({ path, line: 1, rule: track[0], category: track[1] });
    if (looksBinary(blob)) continue;
    findings.push(...scanContent(blob.toString("utf8"), path));
  }
  return { scanned: oids.length, findings };
}

function main(argv) {
  const pathsArg = argv.indexOf("--paths");
  const revArg = argv.indexOf("--rev");
  if (pathsArg !== -1 && revArg !== -1) {
    process.stderr.write("usage: repo-secret-scan.mjs [--paths <file>... | --rev <ref>]\n");
    return 2;
  }
  if (revArg !== -1) {
    const rev = argv[revArg + 1];
    if (!rev) {
      process.stderr.write("usage: repo-secret-scan.mjs [--paths <file>... | --rev <ref>]\n");
      return 2;
    }
    const { scanned, findings } = scanRevision(rev);
    findings.sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line);
    for (const f of findings) {
      process.stdout.write(`${f.path}:${f.line}:${f.rule}:${f.category}\n`);
    }
    process.stdout.write(`SCANNED=${scanned} FINDINGS=${findings.length}\n`);
    return findings.length > 0 ? 1 : 0;
  }
  let targets;
  if (pathsArg !== -1) {
    targets = argv.slice(pathsArg + 1);
    if (targets.length === 0) {
      process.stderr.write("usage: repo-secret-scan.mjs [--paths <file>... | --rev <ref>]\n");
      return 2;
    }
  } else {
    targets = gitLines(["ls-files", "-z"]);
  }

  const findings = [];
  for (const path of targets) {
    const track = isForbiddenTrackedPath(path);
    if (track && pathsArg === -1) {
      findings.push({ path, line: 1, rule: track[0], category: track[1] });
      continue;
    }
    let buffer;
    try {
      buffer = readFileSync(path);
    } catch {
      process.stderr.write(`error: cannot read ${path}\n`);
      return 2;
    }
    if (looksBinary(buffer)) continue;
    const content = buffer.toString("utf8");
    findings.push(...scanContent(content, path));
    if (pathsArg !== -1) {
      const local = isForbiddenTrackedPath(path);
      if (local) findings.push({ path, line: 1, rule: local[0], category: local[1] });
    }
  }

  findings.sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line);
  for (const f of findings) {
    process.stdout.write(`${f.path}:${f.line}:${f.rule}:${f.category}\n`);
  }
  process.stdout.write(`SCANNED=${targets.length} FINDINGS=${findings.length}\n`);
  return findings.length > 0 ? 1 : 0;
}

const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  try {
    process.exit(main(process.argv.slice(2)));
  } catch {
    process.stderr.write("error: scanner failed\n");
    process.exit(2);
  }
}
