/**
 * Seeds `employee_demand`.
 *
 * Run directly:
 *   npx tsx seed/demand_seed.ts
 *   npx tsx seed/demand_seed.ts --reset
 */

import { eq, like, sql } from 'drizzle-orm'

import { db } from '@/db'
import { employeeDemand, internships } from '@/db/schema'

import { DEMAND_TEMPLATES } from './data'
import {
  DEFAULT_CHUNK_SIZE,
  chunk,
  done,
  heading,
  parseArgs,
  seedId,
  step,
  warn,
} from './lib'

const DEFAULTS = {
  seed: 42,
  counts: {} as Record<string, number>,
}

const PREFIX = 'seed-demand-'
const RESET_PREFIX = `${PREFIX}%`

/**
 * Columns refreshed on conflict. `excluded` refers to the row that was
 * proposed for insert, so each batch entry keeps its own values instead of
 * the whole batch collapsing onto one.
 */
const REFRESH = {
  name: sql`excluded.name`,
  iconUrl: sql`excluded.icon_url`,
  description: sql`excluded.description`,
  keyFeatures: sql`excluded.key_features`,
}

export async function seedDemands(
  options: {
    reset?: boolean
    resetOnly?: boolean
    /** Allow-listed image host; null keeps icon_url empty. See internship_seed. */
    imageHost?: string | null
  } = {}
) {
  heading('Seeding demands')

  if (options.reset) {
    // internships.demand_id is ON DELETE RESTRICT, so demands can only be
    // removed once their internships are gone. Detect that up front and
    // explain it instead of surfacing a raw FK violation.
    const blocked = await db
      .select({ id: internships.id })
      .from(internships)
      .innerJoin(
        employeeDemand,
        eq(internships.demandId, employeeDemand.id)
      )
      .where(like(employeeDemand.id, RESET_PREFIX))
      .limit(5)

    if (blocked.length > 0) {
      warn(
        `cannot --reset demands yet — ${blocked.length}+ internship(s) still reference them`
      )
      step('run `npx tsx seed/index.ts --reset` (resets in dependency order) or')
      step('run `npx tsx seed/internship_seed.ts --reset` first')
    } else {
      const deleted = await db
        .delete(employeeDemand)
        .where(like(employeeDemand.id, RESET_PREFIX))
        .returning({ id: employeeDemand.id })
      step(`removed ${deleted.length} seeded demand(s)`)
    }

    if (options.resetOnly) {
      done('reset-only: nothing generated')
      return []
    }
  }

  const host = options.imageHost?.replace(/\/$/, '') ?? null

  const rows = DEMAND_TEMPLATES.map((template, i) => ({
    id: seedId('demand', i + 1),
    name: template.name,
    // icon_url is rendered through next/image, which throws for hosts missing
    // from images.remotePatterns — so it stays null unless a host is given.
    iconUrl: host
      ? `${host}/api/?name=${encodeURIComponent(
          template.name
        )}&background=random&size=128`
      : null,
    description: template.description,
    keyFeatures: template.keyFeatures,
  }))

  for (const batch of chunk(rows, DEFAULT_CHUNK_SIZE)) {
    await db
      .insert(employeeDemand)
      .values(batch)
      .onConflictDoUpdate({ target: employeeDemand.id, set: REFRESH })
  }

  done(`${rows.length} demand(s) upserted`)

  return rows.map((r) => ({ id: r.id, name: r.name }))
}

/** Seeded demand ids → names, for scripts that attach to a demand. */
export async function getSeededDemands() {
  return db
    .select({ id: employeeDemand.id, name: employeeDemand.name })
    .from(employeeDemand)
    .where(like(employeeDemand.id, RESET_PREFIX))
}

if (require.main === module) {
  const args = parseArgs(process.argv.slice(2), DEFAULTS)

  if (args.help) {
    console.log(
      [
        'Usage: npx tsx seed/demand_seed.ts [options]',
        '',
        'Options:',
        '  --reset       Delete previously seeded demand rows first',
        '  --reset-only  Delete seeded demands and exit (no generation)',
        '  --icon-host=URL  Set icon_url base URL (must already be allow-listed',
        '                   in next.config.ts images.remotePatterns)',
        '  --help        Show this message',
      ].join('\n')
    )
    process.exit(0)
  }

  const resetOnly = process.argv.includes('--reset-only')
  const iconHost = process.argv.find((a) => a.startsWith('--icon-host='))
    ?.split('=')[1]

  seedDemands({
    reset: args.reset || resetOnly,
    resetOnly,
    imageHost: iconHost ?? null,
  })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('demand_seed failed:', err)
      process.exit(1)
    })
}