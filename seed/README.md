# Seed scripts

Bulk data generators for local development and demos. Everything they write is
tagged with a `seed-*` id prefix, so seeded rows are easy to identify and easy to
remove.

## Quick start

```bash
npm run db:seed                      # everything, in dependency order
npm run db:seed -- --count=80        # more internships
npm run db:seed -- --reset           # wipe seeded rows first, then re-seed
```

Individual scripts:

```bash
npm run db:seed:demands
npm run db:seed:internships -- --count=60 --public
npm run db:seed:exams
npm run db:seed:teams
```

## Scripts

| Script | Seeds | Notes |
| --- | --- | --- |
| `demand_seed.ts` | `employee_demand` | 12 demands. Required by everything else. |
| `internship_seed.ts` | `internships` | Bulk generator — the main one. Seeds demands first. |
| `exam_seed.ts` | `exams`, `exam_questions`, `question_mcqs` | Derives totals from the questions it creates. |
| `team_seed.ts` | `team` | One team per internship, up to `--count`. |
| `index.ts` | all of the above | Runs them in the right order. |

## Flags

Every script accepts these where relevant:

| Flag | Meaning |
| --- | --- |
| `--count=N` | How many rows to generate |
| `--seed=N` | PRNG seed — **same value reproduces the same data** |
| `--reset` | Delete previously seeded rows before generating |
| `--reset-only` | Delete and exit without generating |
| `--help` | Usage for that script |

`internship_seed.ts` also takes:

| Flag | Meaning |
| --- | --- |
| `--public` | Make every generated internship public (default is mostly private) |
| `--skip-demands` | Don't create demands; fail fast if the table is empty |
| `--icon-host=URL` | Set `icon_url` / `examiner_photo_url` (see below) |

## Image URLs

`icon_url` and `examiner_photo_url` are **`null` by default**.

Both are rendered through `next/image`, which *throws* for any host missing
from `images.remotePatterns` in `next.config.ts` — and that throw kills the
client render, blanking the very page the seed was meant to demo. Rather than
inventing an external placeholder host, the default is no image; the UI already
falls back to a letter avatar.

If you want real images, pass a host you have already allow-listed:

```bash
npm run db:seed:internships -- --icon-host=https://your-cdn.com
```

Then add that host to `images.remotePatterns`.

## Design notes

**Deterministic.** Randomness comes from a seeded mulberry32 PRNG
(`seed/lib.ts`), not `Math.random()`, so `--seed=42` produces byte-identical rows
on every run. Demand selection is also `ORDER BY name` — without a stable order,
round-robin assignment would drift between runs.

**Idempotent.** Every write is an upsert keyed on a deterministic id
(`seed-int-0001`, `seed-exam-0003`, …). Re-running updates rows in place instead
of duplicating them. Bulk updates use `excluded.*` so each row in a batch keeps
its own values.

**Disposable.** Ids start with `seed-`, so cleanup is:

```sql
delete from exams          where id like 'seed-exam-%';
delete from internships    where id like 'seed-int-%';
delete from team           where id like 'seed-team-%';
delete from employee_demand where id like 'seed-demand-%';
```

Or just `npm run db:seed -- --reset`, which clears them in dependency order.

## Ordering / foreign keys

The FK graph forces a specific order:

```
demands ──< internships ──< exams ──< exam_questions ──< question_mcqs
                │
                └──< team
```

`internships.demand_id` is `ON DELETE RESTRICT`, so demands cannot be removed
while internships still point at them. `index.ts` therefore resets dependents
first — deleting internships also cascades to exams and teams. Running
`demand_seed.ts --reset` on its own will warn and skip if internships still
reference the seeded demands.

## Exam marks

`exam_seed.ts` generates questions first, then sums their marks to set
`totalMarks`, and sets `passingMarks` to 40% of that.

This matters: the exam runner prefers a `computedTotal` derived from question
marks, but `passingMarks` is stored as-is. Seeding a fixed `totalMarks: 100`
against questions worth ~13 marks would let someone score 100% of the real total
and still fail.

## Files

| File | Purpose |
| --- | --- |
| `lib.ts` | PRNG, arg parser, id/date helpers, batching, logging |
| `data.ts` | The vocabulary — demand, role, question and team templates |
| `index.ts` | Ordered runner |

Edit `data.ts` to change the wording/content of generated data; the scripts only
contain generation logic.