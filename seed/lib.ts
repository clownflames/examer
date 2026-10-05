/**
 * Shared helpers for seed scripts.
 *
 * Design goals:
 *  - Deterministic: same `--seed` always produces the same rows, so a run can
 *    be reproduced and diffed.
 *  - Idempotent: ids are derived from a stable slug, and every write is an
 *    upsert — re-running updates instead of duplicating.
 *  - Disposable: every seeded row gets a `seed-*` id, so cleanup is a single
 *    `delete ... where id like 'seed-%'`.
 */

/* -------------------------------------------------------------------------- */
/*  Seeded random                                                              */
/* -------------------------------------------------------------------------- */

export type Rng = () => number

/**
 * mulberry32 — small, fast, good enough distribution for fake data.
 * Not cryptographic, only needs to be reproducible.
 */
export function createRng(seed: number): Rng {
  let a = seed >>> 0

  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function int(rng: Rng, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)]
}

export function chance(rng: Rng, probability = 0.5): boolean {
  return rng() < probability
}

export function sample<T>(rng: Rng, items: readonly T[], count: number): T[] {
  const pool = [...items]
  const out: T[] = []

  for (let i = 0; i < count && pool.length > 0; i++) {
    out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0])
  }

  return out
}

export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const out = [...items]

  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }

  return out
}

/* -------------------------------------------------------------------------- */
/*  Dates                                                                      */
/* -------------------------------------------------------------------------- */

export function daysFromNow(days: number): Date {
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() + days)
  return d
}

export function monthsFromNow(months: number): Date {
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  d.setMonth(d.getMonth() + months)
  return d
}

/* -------------------------------------------------------------------------- */
/*  Ids                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Stable, readable, and prefixed so seeded rows are easy to spot and delete.
 * Example: seedId('int', 7) -> 'seed-int-0007'
 */
export function seedId(table: string, n: number): string {
  return `seed-${table}-${String(n).padStart(4, '0')}`
}

/** Slug used to build readable, unique-ish names. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/* -------------------------------------------------------------------------- */
/*  CLI args                                                                   */
/* -------------------------------------------------------------------------- */

export type SeedArgs = {
  seed: number
  counts: Record<string, number>
  reset: boolean
  help: boolean
}

/**
 * Minimal `--flag=value` / `--flag` parser.
 * Unknown flags are ignored so scripts stay forgiving.
 */
export function parseArgs(
  argv: string[],
  defaults: { seed: number; counts: Record<string, number> }
): SeedArgs {
  const args: SeedArgs = {
    seed: defaults.seed,
    counts: { ...defaults.counts },
    reset: false,
    help: false,
  }

  for (const raw of argv) {
    if (!raw.startsWith('--')) continue

    const [rawKey, rawValue] = raw.slice(2).split('=')
    const key = rawKey.trim()
    const value = rawValue?.trim()

    if (key === 'help' || key === 'h') {
      args.help = true
      continue
    }

    if (key === 'reset') {
      args.reset = value !== 'false'
      continue
    }

    if (key === 'seed') {
      const parsed = Number(value)
      if (!Number.isFinite(parsed)) {
        throw new Error(`--seed expects a number, received "${value}"`)
      }
      args.seed = parsed
      continue
    }

    if (value !== undefined && value !== '') {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) {
        args.counts[key] = parsed
      }
    }
  }

  return args
}

/* -------------------------------------------------------------------------- */
/*  Logging                                                                    */
/* -------------------------------------------------------------------------- */

const ICON = '•'

export function heading(text: string) {
  console.log(`\n${text}`)
  console.log('─'.repeat(text.length))
}

export function step(text: string) {
  console.log(`  ${ICON} ${text}`)
}

export function warn(text: string) {
  console.log(`  ! ${text}`)
}

export function done(summary: string) {
  console.log(`  ${ICON} ${summary}`)
}

/* -------------------------------------------------------------------------- */
/*  Batching                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Inserts can blow past Postgres' 65535 bind-parameter limit with many
 * columns, so we chunk writes.
 */
export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []

  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size))
  }

  return out
}

export const DEFAULT_CHUNK_SIZE = 200
