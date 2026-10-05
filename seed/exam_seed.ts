/**
 * Seeds `exams`, `exam_questions` and `question_mcqs` for existing internships.
 *
 * Exams FK to internships (onDelete cascade), questions FK to exams, and MCQ
 * options FK to questions — so this runs after internship_seed.
 *
 * Note on marks: the exam runner prefers a `computedTotal` derived from the
 * question marks, but `passingMarks` is stored as-is. Seeding a fixed
 * `totalMarks` would therefore let someone score 100% of the real total and
 * still "fail" a `passingMarks: 60`. So both totals are derived from the
 * questions we actually generate.
 *
 * Run directly:
 *   npx tsx seed/exam_seed.ts
 *   npx tsx seed/exam_seed.ts --count=20 --seed=7 --reset
 *
 * Flags:
 *   --count=N     How many internships to attach exams to (default 25)
 *   --seed=N      PRNG seed
 *   --reset       Delete previously seeded exams first
 */

import { like, sql } from 'drizzle-orm'

import { db } from '@/db'
import { examQuestions, exams, internships, questionMcqs } from '@/db/schema'

import { EXAM_DESCRIPTIONS, EXAM_NAMES, QUESTION_BANK } from './data'
import {
  DEFAULT_CHUNK_SIZE,
  chance,
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
  type Rng,
} from './lib'

const DEFAULTS = {
  seed: 42,
  counts: { count: 25 },
}

const PREFIX = 'seed-exam-'
const MCQ_PREFIX = 'seed-mcq-'

/** Fraction of the total needed to pass. */
const PASS_RATIO = 0.4

type QuestionPlan = {
  id: string
  examId: string
  name: string
  marks: number
  details: string
  type: 'mcq' | 'text' | 'code'
  defaultText: string | null
}

type OptionPlan = {
  id: string
  questionId: string
  labelText: string
  isCorrect: boolean
}

/* -------------------------------------------------------------------------- */
/*  Planning (pure — no DB writes, so totals can be derived first)              */
/* -------------------------------------------------------------------------- */

/** Builds the question + option plan for one exam. */
function planQuestions(examId: string, examIndex: number, rng: Rng) {
  const questions: QuestionPlan[] = []
  const options: OptionPlan[] = []

  const mcqCount = int(rng, 2, 4)
  const textCount = int(rng, 1, 2)
  const codeCount = int(rng, 0, 1)

  // Ids are unique across exams because examIndex offsets the counter.
  let seq = 0

  const push = (type: QuestionPlan['type'], bank: (typeof QUESTION_BANK)[QuestionPlan['type']]) => {
    const entry = bank[seq % bank.length]
    const questionId = seedId('q', examIndex * 100 + seq)

    const marks =
      type === 'code' ? pick(rng, [10, 15, 20]) : type === 'text' ? 5 : 2

    questions.push({
      id: questionId,
      examId,
      name: entry.name,
      marks,
      details: entry.details,
      type,
      defaultText: type === 'text' ? '' : null,
    })

    if (type === 'mcq') {
      // Exactly one correct option: compute the index once, not per option,
      // otherwise several (or none) end up marked correct.
      const correctIndex = int(rng, 0, entry.options.length - 1)

      entry.options.forEach((label, i) => {
        options.push({
          // examIndex offset is required: `questions` is per-exam, so without
          // it every exam would mint the same option ids and collide on the PK.
          id: seedId('mcq', examIndex * 1000 + questions.length * 10 + i + 1),
          questionId,
          labelText: label,
          isCorrect: i === correctIndex,
        })
      })
    }

    seq++
  }

  for (let i = 0; i < mcqCount; i++) push('mcq', QUESTION_BANK.mcq)
  for (let i = 0; i < textCount; i++) push('text', QUESTION_BANK.text)
  for (let i = 0; i < codeCount; i++) push('code', QUESTION_BANK.code)

  return { questions, options }
}

/* -------------------------------------------------------------------------- */
/*  Seed                                                                       */
/* -------------------------------------------------------------------------- */

export async function seedExams(
  options: { count: number; seed: number; reset?: boolean } = {
    count: DEFAULTS.counts.count,
    seed: DEFAULTS.seed,
  }
) {
  const rng = createRng(options.seed)

  heading(`Seeding exams (count=${options.count}, seed=${options.seed})`)

  if (options.reset) {
    // Questions and MCQ options cascade from exams, so deleting exams is enough.
    const deleted = await db
      .delete(exams)
      .where(like(exams.id, `${PREFIX}%`))
      .returning({ id: exams.id })
    step(`--reset: removed ${deleted.length} seeded exam(s)`)
  }

  // Prefer internships from internship_seed; fall back to any internship.
  let targets = await db
    .select({ id: internships.id })
    .from(internships)
    .where(like(internships.id, 'seed-int-%'))

  if (targets.length === 0) {
    warn('No seeded internships found — using all internships instead.')
    targets = await db.select({ id: internships.id }).from(internships)
  }

  if (targets.length === 0) {
    throw new Error(
      'No internships found. Run `npx tsx seed/internship_seed.ts` first.'
    )
  }

  const chosen = targets.slice(0, Math.min(options.count, targets.length))
  step(`attaching exams to ${chosen.length} internship(s)`)

  // Plan everything first so totals reflect the real question marks.
  const plans = chosen.map((target, i) =>
    planQuestions(seedId('exam', i + 1), i, rng)
  )

  const examRows: (typeof exams.$inferInsert)[] = chosen.map((target, i) => {
    const { questions } = plans[i]
    const totalMarks = questions.reduce((sum, q) => sum + q.marks, 0)

    return {
      id: seedId('exam', i + 1),
      internshipId: target.id,
      orderNo: 1,
      name: EXAM_NAMES[i % EXAM_NAMES.length],
      description: pick(rng, EXAM_DESCRIPTIONS),
      duration: pick(rng, [30, 45, 60, 90, 120]),
      totalMarks,
      passingMarks: Math.max(1, Math.round(totalMarks * PASS_RATIO)),
      isPublic: chance(rng, 0.6),
    }
  })

  const questionRows = plans.flatMap((p) => p.questions)
  const optionRows = plans.flatMap((p) => p.options)

  // --- exams ---
  for (const batch of chunk(examRows, DEFAULT_CHUNK_SIZE)) {
    await db
      .insert(exams)
      .values(batch)
      .onConflictDoUpdate({
        target: exams.id,
        set: {
          name: sql`excluded.name`,
          description: sql`excluded.description`,
          duration: sql`excluded.duration`,
          totalMarks: sql`excluded.total_marks`,
          passingMarks: sql`excluded.passing_marks`,
          isPublic: sql`excluded.is_public`,
        },
      })
  }
  done(`${examRows.length} exam(s) upserted`)

  // --- questions ---
  for (const batch of chunk(questionRows, DEFAULT_CHUNK_SIZE)) {
    await db
      .insert(examQuestions)
      .values(batch)
      .onConflictDoUpdate({
        target: examQuestions.id,
        set: {
          name: sql`excluded.name`,
          marks: sql`excluded.marks`,
          details: sql`excluded.details`,
          type: sql`excluded.type`,
          defaultText: sql`excluded.default_text`,
        },
      })
  }

  // --- mcq options ---
  // Options carry no unique key, so clear the seeded set before reinserting
  // to avoid duplicates on re-run.
  await db.delete(questionMcqs).where(like(questionMcqs.id, `${MCQ_PREFIX}%`))

  for (const batch of chunk(optionRows, DEFAULT_CHUNK_SIZE)) {
    await db.insert(questionMcqs).values(batch)
  }

  done(
    `${questionRows.length} question(s) and ${optionRows.length} MCQ option(s) upserted`
  )
  step(`passing marks set to ${PASS_RATIO * 100}% of each exam's own total`)

  return examRows.map((r) => ({ id: r.id, internshipId: r.internshipId }))
}

if (require.main === module) {
  const args = parseArgs(process.argv.slice(2), DEFAULTS)

  if (args.help) {
    console.log(
      [
        'Usage: npx tsx seed/exam_seed.ts [options]',
        '',
        'Options:',
        '  --count=N    How many internships to attach exams to (default 25)',
        '  --seed=N     PRNG seed — same value reproduces the same data',
        '  --reset      Delete previously seeded exams first',
        '  --help       Show this message',
      ].join('\n')
    )
    process.exit(0)
  }

  const count = args.counts.count ?? DEFAULTS.counts.count

  if (count <= 0) {
    warn('--count must be greater than 0')
    process.exit(1)
  }

  seedExams({ count, seed: args.seed, reset: args.reset })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('exam_seed failed:', err)
      process.exit(1)
    })
}