// Phase 25: single source of truth for the bcrypt work factor.
//
// Every hash writer (user creation in src/app/api/users/route.ts and both
// seeders) and the credential-timing equalizer in src/lib/auth.ts must share
// this cost: bcrypt.compare() takes as long as the STORED hash's cost
// dictates, so a decoy hashed at a different cost than the real accounts
// would split login latency into two observable bands and reopen the
// account-enumeration timing oracle the equalizer closes (Phase 25
// reproduced an 11.08x median end-to-end gap before the fix: 140.8ms known
// account vs 12.7ms unknown, N=15, identical 302 responses).
//
// Cost 10 rationale (measured on the dev machine): a cost-10 verify is
// ~116ms (Phase 25 probe), squarely in the OWASP-recommended bcrypt range
// for interactive logins; raising it would double login latency and every
// test/seed hash for marginal gain at this threat level, and lowering it
// would move below the documented floor. Existing hashes stay verifiable
// regardless because bcrypt embeds the cost in each stored hash.
export const BCRYPT_COST = 10;
