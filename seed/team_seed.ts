/**
 * Seeds `team` rows for existing internships.
 *
 * Teams FK to both `employee_demand` (restrict) and `internships` (cascade),
 * so this runs after internship_seed.
 *
 * Run directly:
 *   npx tsx seed/team_seed.ts
 *   npx tsx seed/team_seed.ts --count=30 --reset
 *
 * Flags:
 *   --count=N   How many teams to create (default 30)
 *   --seed=N    PRNG seed
 *   --reset     Delete previously seeded teams first
 */

import { like, sql } from 'drizzle-orm'

import { db } from '@/db'
import { internships, team } from '@/db/schema'

import { TEAM_PREFIXES, TEAM_SUFFIXES } from './data'
import {
  DEFAULT_CHUNK_SIZE,
  chunk,
  createRng,
  done,
  heading,
  int,
  parseArgs,
  pick,
  seedId,
  step,
  warn,
} from './lib'

const DEFAULTS = {
  seed: 42,
  counts: { count: 30 },
}

const PREFIX = 'seed-team-'

export async function seedTeams(
  options: { count: number; seed: number; reset?: boolean } = {
    count: DEFAULTS.counts.count,
    seed: DEFAULTS.seed,
  }
) {
  const rng = createRng(options.seed)

  heading(`Seeding teams (count=${options.count}, seed=${options.seed})`)

  if (options.reset) {
    const deleted = await db
      .delete(team)
      .where(like(team.id, `${PREFIX}%`))
      .returning({ id: team.id })
    step(`--reset: removed ${deleted.length} seeded team(s)`)
  }

  // A team needs its internship's demandId too — pull both in one query.
  const targets = await db
    .select({
      id: internships.id,
      demandId: internships.demandId,
      name: internships.name,
    })
    .from(internships)
    .where(like(internships.id, 'seed-int-%'))

  if (targets.length === 0) {
    warn('No seeded internships found — using all internships instead.')
  }

  const all =
    targets.length > 0
      ? targets
      : await db
          .select({ id: internships.id, demandId: internships.demandId, name: internships.name })
          .from(internships)

  if (all.length === 0) {
    throw new Error(
      'No internships found. Run `npx tsx seed/internship_seed.ts` first.'
    )
  }

  const count = Math.min(options.count, all.length)

  const rows: (typeof team.$inferInsert)[] = []

  for (let i = 0; i < count; i++) {
    const target = all[i % all.length]
    const prefix = TEAM_PREFIXES[i % TEAM_PREFIXES.length]
    const suffix = pick(rng, TEAM_SUFFIXES)

    rows.push({
      id: seedId('team', i + 1),
      // Include the internship name so teams stay distinguishable in the UI.
      name: `${prefix} ${suffix} — ${target.name}`,
      demandId: target.demandId,
      internshipId: target.id,
      score: int(rng, 0, 500),
    })
  }

  for (const batch of chunk(rows, DEFAULT_CHUNK_SIZE)) {
    await db
      .insert(team)
      .values(batch)
      .onConflictDoUpdate({
        target: team.id,
        set: {
          name: sql`excluded.name`,
          demandId: sql`excluded.demand_id`,
          internshipId: sql`excluded.internship_id`,
          score: sql`excluded.score`,
        },
      })
  }

  done(`${rows.length} team(s) upserted`)

  return rows.map((r) => ({ id: r.id, name: r.name }))
}

if (require.main === module) {
  const args = parseArgs(process.argv.slice(2), DEFAULTS)

  if (args.help) {
    console.log(
      [
        'Usage: npx tsx seed/team_seed.ts [options]',
        '',
        'Options:',
        '  --count=N   How many teams to create (default 30)',
        '  --seed=N    PRNG seed — same value reproduces the same data',
        '  --reset     Delete previously seeded teams first',
        '  --help      Show this message',
      ].join('\n')
    )
    process.exit(0)
  }

  const count = args.counts.count ?? DEFAULTS.counts.count

  if (count <= 0) {
    warn('--count must be greater than 0')
    process.exit(1)
  }

  seedTeams({ count, seed: args.seed, reset: args.reset })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('team_seed failed:', err)
      process.exit(1)
    })
}