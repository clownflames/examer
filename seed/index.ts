/**
 * Runs every seed script in dependency order.
 *
 *   npx tsx seed/index.ts
 *   npx tsx seed/index.ts --count=80 --seed=7 --reset
 *
 * Insert order (foreign keys):
 *   demands -> internships -> exams
 *                    \-----> teams
 *
 * Reset order is the reverse. `internships.demand_id` is ON DELETE RESTRICT, so
 * demands cannot be cleared until internships are gone. Deleting internships
 * also cascades to exams and teams, so clearing internships first is enough.
 */

import { execSync } from 'node:child_process'
import path from 'node:path'

import { heading, parseArgs, step } from './lib'

const DEFAULTS = {
  seed: 42,
  counts: { count: 40 },
}

type Script = {
  file: string
  /** Flags from argv that this script understands. */
  accepts: string[]
  /** Extra literal flags always passed in the reset phase. */
  extra?: string[]
}

const INSERT_ORDER: Script[] = [
  { file: 'demand_seed.ts', accepts: ['seed', 'icon-host'] },
  { file: 'internship_seed.ts', accepts: ['count', 'seed', 'public', 'skip-demands', 'icon-host'] },
  { file: 'exam_seed.ts', accepts: ['count', 'seed'] },
  { file: 'team_seed.ts', accepts: ['count', 'seed'] },
]

/**
 * Clears seeded rows. Internships go first because exams and teams cascade from
 * them, and demands are blocked until internships are removed.
 */
const RESET_ORDER: Script[] = [
  { file: 'internship_seed.ts', accepts: [], extra: ['--reset-only'] },
  { file: 'demand_seed.ts', accepts: [], extra: ['--reset-only'] },
]

function run(script: Script, flags: string[]) {
  step(`-> ${script.file} ${flags.join(' ')}`.trimEnd())
  execSync(`npx tsx ${path.join('seed', script.file)} ${flags.join(' ')}`, {
    stdio: 'inherit',
  })
}

if (require.main === module) {
  const args = parseArgs(process.argv.slice(2), DEFAULTS)

  if (args.help) {
    console.log(
      [
        'Usage: npx tsx seed/index.ts [options]',
        '',
        'Options are forwarded to each script:',
        '  --count=N    Internship count (other scripts derive their own)',
        '  --seed=N     PRNG seed',
        '  --reset      Clear previously seeded rows first',
        '  --public     Make all internships public',
        '  --help       Show this message',
      ].join('\n')
    )
    process.exit(0)
  }

  const argv = process.argv.slice(2)

  heading('Running all seeds')

  if (argv.includes('--reset')) {
    step('reset phase — dependents first so foreign keys stay satisfied')
    for (const script of RESET_ORDER) {
      run(script, ['--reset', ...(script.extra ?? [])])
    }
  }

  for (const script of INSERT_ORDER) {
    // Only forward flags the script declares, so e.g. `--public` never leaks
    // into a script that would reject it.
    const flags = argv.filter((flag) => {
      const key = flag.slice(2).split('=')[0]
      return script.accepts.includes(key)
    })

    // internship_seed seeds demands itself, so skip the duplicate pass.
    if (script.file === 'internship_seed.ts') {
      flags.push('--skip-demands')
    }

    run(script, flags)
  }

  console.log('\nAll seeds complete.\n')
}