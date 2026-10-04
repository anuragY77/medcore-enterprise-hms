import { createHash } from "node:crypto";

/**
 * Fixed namespace UUID (URL namespace, RFC 4122 appendix C) used to derive
 * deterministic UUIDv5 values for seeded rows. Stable identifiers make the
 * seed idempotent: re-running produces the same primary keys, so conflicts
 * resolve as updates instead of duplicates.
 */
const SEED_NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

function namespaceBytes(): Buffer {
  const hex = SEED_NAMESPACE.replace(/-/g, "");
  const bytes = Buffer.alloc(16);
  for (let i = 0; i < 16; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Deterministic UUIDv5 for the given parts (joined with ":"). Same parts
 * always yield the same UUID — across runs, machines and re-seeds.
 */
export function deterministicUuid(...parts: string[]): string {
  const name = Buffer.from(parts.join(":"), "utf8");
  const hash = createHash("sha1").update(namespaceBytes()).update(name).digest();
  const bytes = Array.from(hash.subarray(0, 16));
  // RFC 4122 version 5 / variant 10b bits.
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

/**
 * Small deterministic PRNG (mulberry32). Seeded demo data must choose the
 * same values on every run so counts and relationships converge instead of
 * drifting and duplicating.
 */
export function createRng(seed = 0x5eed): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Rng = () => number;

export function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)];
}

export function sample<T>(rng: Rng, items: readonly T[], count: number): T[] {
  const pool = [...items];
  const out: T[] = [];
  while (out.length < count && pool.length > 0) {
    const idx = Math.floor(rng() * pool.length);
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}
