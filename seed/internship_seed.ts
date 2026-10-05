/**
 * Seeds bulk `internships`.
 *
 * Every internship needs a `demand_id` (FK -> employee_demand, onDelete
 * restrict), so this script runs `seedDemands` first unless `--skip-demands`
 * is passed.
 *
 * Run directly:
 *   npx tsx seed/internship_seed.ts
 *   npx tsx seed/internship_seed.ts --count=60 --seed=7
 *   npx tsx seed/internship_seed.ts --reset --public
 *
 * Flags:
 *   --count=N          How many internships to generate (default 40)
 *   --seed=N           PRNG seed — same value reproduces the same data
 *   --public           Make all generated internships public
 *   --reset            Delete previously seeded internships first
 *   --reset-only       Delete seeded internships and exit without generating
 *   --skip-demands     Assume demands already exist (fails fast if missing)
 */

import { asc, count, like, notLike, sql } from 'drizzle-orm'

import { db } from '@/db'
import { employeeDemand, internships } from '@/db/schema'

import {
  COMPANIES,
  EXAMINERS,
  INTERNSHIP_ROLES,
  INTERNSHIP_VARIANTS,
} from './data'
import { seedDemands } from './demand_seed'
import {
  DEFAULT_CHUNK_SIZE,
  chance,
  chunk,
  createRng,
  daysFromNow,
  done,
  heading,
  int,
  monthsFromNow,
  parseArgs,
  pick,
  seedId,
  slugify,
  step,
  warn,
  type Rng,
} from './lib'

const DEFAULTS = {
  seed: 42,
  counts: { count: 40 },
}

const PREFIX = 'seed-int-'
const RESET_PREFIX = `${PREFIX}%`

type SeedArgs = ReturnType<typeof parseArgs>

/* -------------------------------------------------------------------------- */
/*  Generation                                                                 */
/* -------------------------------------------------------------------------- */

/** Internships for one demand: every role against every variant, then noise. */
function buildNames(demandName: string, rng: Rng): string[] {
  const names = new Set<string>()

  for (const role of INTERNSHIP_ROLES) {
    names.add(`${demandName} ${role}`)
  }

  for (const variant of INTERNSHIP_VARIANTS) {
    names.add(`${demandName} Internship — ${variant}`)
  }

  // A few extra cohorts so the count isn't artificially capped at 10.
  while (names.size < INTERNSHIP_ROLES.length + INTERNSHIP_VARIANTS.length + 4) {
    names.add(
      `${demandName} Internship — Cohort ${String(int(rng, 1, 40)).padStart(2, '0')}`
    )
  }

  return [...names]
}

function buildDescription(company: string, demandName: string, role: string) {
  return [
    `${company} is hiring a ${role} to join its ${demandName} team.`,
    '',
    'You will work on production code alongside senior engineers, ship features end to end, and take part in code review and design discussions.',
    '',
    'Requirements:',
    '- Solid fundamentals and comfort reading unfamiliar code',
    '- Clear written communication',
    '- Willingness to give and receive honest feedback',
  ].join('\n')
}

/**
 * Price ladder. Selling price is usually below list price so the table's
 * discount badge has something to show.
 */
function buildPricing(rng: Rng, isPaid: boolean) {
  if (!isPaid) {
    return { price: null, sellingPrice: null }
  }

  const price = pick(rng, [499, 999, 1499, 1999, 2499, 2999, 3999])
  const discount = pick(rng, [0, 0.1, 0.15, 0.2, 0.25])
  const selling = Math.round(price * (1 - discount))

  return {
    price: String(price),
    sellingPrice: String(selling),
  }
}

/**
 * Image URLs are `null` by default.
 *
 * Both columns are rendered through `next/image`, which THROWS for any host
 * missing from `images.remotePatterns` in next.config.ts. Inventing an
 * external placeholder host would break the very page the seed is meant to
 * demo, so the safe default is no image — the UI already falls back to a
 * letter avatar.
 *
 * Pass `--icon-host=https://cdn.example.com` to opt in to a host you have
 * already allow-listed.
 */
function buildImageUrl(host: string | null, label: string): string | null {
  if (!host) return null

  const base = host.replace(/\/$/, '')
  return `${base}/api/?name=${encodeURIComponent(
    label
  )}&background=random&size=128`
}

export function generateInternships(
  count: number,
  demands: { id: string; name: string }[],
  rng: Rng,
  options: { forcePublic?: boolean; imageHost?: string | null } = {}
) {
  if (demands.length === 0) {
    throw new Error('No demands available — run demand_seed first.')
  }

  const namesPerDemand = buildNames(demands[0].name, rng).length
  const rows: (typeof internships.$inferInsert)[] = []

  for (let i = 0; i < count; i++) {
    const n = i + 1

    // Round-robin across demands so every demand gets representation.
    const demand = demands[i % demands.length]

    const variant = buildNames(demand.name, rng)[i % namesPerDemand]
    const company = pick(rng, COMPANIES)
    const role = variant.replace(`${demand.name} `, '').replace(/^Internship — /, '')

    // Mix of paid and free so the pricing columns are exercised both ways.
    const isPaid = chance(rng, 0.75)
    const pricing = buildPricing(rng, isPaid)

    // Public by default would flood the homepage, so keep most private.
    const isPublic = options.forcePublic ?? chance(rng, 0.35)

    const start = monthsFromNow(int(rng, -4, 3))
    const end = monthsFromNow(int(rng, 4, 10))

    rows.push({
      id: seedId('int', n),
      name: variant,
      demandId: demand.id,
      description: buildDescription(company, demand.name, role),
      lastSubmissionDate: daysFromNow(int(rng, -20, 45)),
      startDate: start,
      endDate: end,
      jdUrl: `https://example.com/jd/${slugify(variant)}`,
      price: pricing.price,
      sellingPrice: pricing.sellingPrice,
      examinerName: pick(rng, EXAMINERS),
      examinerPhotoUrl: buildImageUrl(options.imageHost ?? null, company),
      totalScore: pick(rng, [100, 100, 100, 150, 200]),
      isPublic,
    })
  }

  return rows
}

/* -------------------------------------------------------------------------- */
/*  Persist                                                                    */
/* -------------------------------------------------------------------------- */

const REFRESH = {
  name: sql`excluded.name`,
  demandId: sql`excluded.demand_id`,
  description: sql`excluded.description`,
  lastSubmissionDate: sql`excluded.last_submission_date`,
  startDate: sql`excluded.start_date`,
  endDate: sql`excluded.end_date`,
  jdUrl: sql`excluded.jd_url`,
  price: sql`excluded.price`,
  sellingPrice: sql`excluded.selling_price`,
  examinerName: sql`excluded.examiner_name`,
  examinerPhotoUrl: sql`excluded.examiner_photo_url`,
  totalScore: sql`excluded.total_score`,
  isPublic: sql`excluded.is_public`,
}

export async function seedInternships(options: {
  count: number
  seed: number
  reset?: boolean
  /** Clear seeded rows and stop — used by the runner's reset phase. */
  resetOnly?: boolean
  forcePublic?: boolean
  skipDemands?: boolean
  /** Allow-listed image host for icon/examiner photos; null keeps them empty. */
  imageHost?: string | null
}) {
  const rng = createRng(options.seed)

  heading(`Seeding internships (count=${options.count}, seed=${options.seed})`)

  if (options.reset || options.resetOnly) {
    // Deleting internships cascades to exams and teams, and unblocks the
    // demand delete (internships.demand_id is ON DELETE RESTRICT).
    const deleted = await db
      .delete(internships)
      .where(like(internships.id, RESET_PREFIX))
      .returning({ id: internships.id })
    step(`removed ${deleted.length} seeded internship(s)`)

    if (options.resetOnly) {
      done('reset-only: nothing generated')
      return []
    }
  }

  // Demands are a hard FK dependency, so create them unless told otherwise.
  if (options.skipDemands) {
    const [{ value }] = await db
      .select({ value: count() })
      .from(employeeDemand)
    if (Number(value) === 0) {
      throw new Error('--skip-demands passed but the demands table is empty.')
    }
  } else {
    await seedDemands()
  }

  // Prefer the demands this project seeded, so a run stays reproducible even
  // when unrelated real demands exist. Fall back to everything else.
  const seeded = await db
    .select({ id: employeeDemand.id, name: employeeDemand.name })
    .from(employeeDemand)
    .where(like(employeeDemand.id, 'seed-demand-%'))
    .orderBy(asc(employeeDemand.name))

  const rest = await db
    .select({ id: employeeDemand.id, name: employeeDemand.name })
    .from(employeeDemand)
    .where(notLike(employeeDemand.id, 'seed-demand-%'))
    .orderBy(asc(employeeDemand.name))

  // Stable ordering matters: internships are assigned round-robin across
  // demands, so without ORDER BY the same seed would produce different rows.
  const demands = [...seeded, ...rest]

  if (demands.length === 0) {
    throw new Error(
      'No demands found. Run `npx tsx seed/demand_seed.ts` first.'
    )
  }

  const rows = generateInternships(options.count, demands, rng, {
    forcePublic: options.forcePublic,
    imageHost: options.imageHost ?? null,
  })

  for (const batch of chunk(rows, DEFAULT_CHUNK_SIZE)) {
    await db
      .insert(internships)
      .values(batch)
      .onConflictDoUpdate({ target: internships.id, set: REFRESH })
  }

  const publicCount = rows.filter((r) => r.isPublic).length
  const paidCount = rows.filter((r) => r.price !== null).length

  done(`${rows.length} internship(s) upserted`)
  step(`${publicCount} public · ${rows.length - publicCount} private`)
  step(`${paidCount} paid · ${rows.length - paidCount} unpaid`)
  step(`across ${demands.length} demand(s)`)

  return rows.map((r) => ({ id: r.id, name: r.name }))
}

/* -------------------------------------------------------------------------- */
/*  CLI                                                                        */
/* -------------------------------------------------------------------------- */

if (require.main === module) {
  const args: SeedArgs = parseArgs(process.argv.slice(2), DEFAULTS)

  if (args.help) {
    console.log(
      [
        'Usage: npx tsx seed/internship_seed.ts [options]',
        '',
        'Options:',
        '  --count=N          How many internships to generate (default 40)',
        '  --seed=N           PRNG seed — same value reproduces the same data',
        '  --public           Make all generated internships public',
        '  --icon-host=URL    Set examiner photo base URL (must already be',
        '                     allow-listed in next.config.ts images.remotePatterns)',
        '  --reset            Delete previously seeded internships first',
        '  --reset-only       Delete seeded internships and exit (no generation)',
        '  --skip-demands     Assume demands already exist',
        '  --help             Show this message',
      ].join('\n')
    )
    process.exit(0)
  }

  const resetOnly = process.argv.includes('--reset-only')
  const iconHost = process.argv.find((a) => a.startsWith('--icon-host='))
    ?.split('=')[1]
  const count = args.counts.count ?? DEFAULTS.counts.count

  if (!resetOnly && count <= 0) {
    warn('--count must be greater than 0')
    process.exit(1)
  }

  if (iconHost && !/^https?:\/\//.test(iconHost)) {
    warn('--icon-host must be a full URL, e.g. https://cdn.example.com')
    process.exit(1)
  }

  seedInternships({
    count,
    seed: args.seed,
    reset: args.reset || resetOnly,
    resetOnly,
    forcePublic: process.argv.includes('--public'),
    skipDemands: process.argv.includes('--skip-demands'),
    imageHost: iconHost ?? null,
  })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('internship_seed failed:', err)
      process.exit(1)
    })
}