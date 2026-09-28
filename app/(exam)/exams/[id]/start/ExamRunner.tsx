"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Code2,
  Eraser,
  Info,
  Loader2,
  Mic,
  Send,
  ShieldCheck,
  Trophy,
  Type,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { submitExam, type ExamForAttempt, type ExamResult } from "../../actions";

const CodeEditor = dynamic(
  () => import("@/components/code-editor").then((m) => m.CodeEditor),
  {
    ssr: false,
    loading: () => (
      <div className="h-[240px] w-full animate-pulse rounded-md border bg-muted/40" />
    ),
  }
);

// =====================================================
// HELPERS
// =====================================================

function fmtClock(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const TYPE_META: Record<string, { label: string; icon: React.ReactNode }> = {
  mcq: { label: "Multiple choice", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  text: { label: "Written answer", icon: <Type className="w-3.5 h-3.5" /> },
  code: { label: "Code", icon: <Code2 className="w-3.5 h-3.5" /> },
  voice: { label: "Verbal", icon: <Mic className="w-3.5 h-3.5" /> },
};

function typeMeta(type: string) {
  return (
    TYPE_META[type] ?? { label: "Answer", icon: <Info className="w-3.5 h-3.5" /> }
  );
}

// =====================================================
// Draft store
// localStorage is the single source of truth for in-progress answers, so the
// draft is restored during render (no setState-in-effect flash) and survives
// refreshes. Writes notify every mounted runner.
// =====================================================
const EMPTY_ANSWERS: Record<string, string> = {};
const draftListeners = new Set<() => void>();

function readDraftRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function parseDraft(raw: string | null): Record<string, string> | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, string>;
  } catch {
    return null;
  }
}

function writeDraft(key: string, answers: Record<string, string> | null): void {
  try {
    if (answers && Object.keys(answers).length > 0) {
      window.localStorage.setItem(key, JSON.stringify(answers));
    } else {
      window.localStorage.removeItem(key);
    }
  } catch {
    // storage blocked or full — drafts are a convenience, never required
  }
  for (const listener of draftListeners) listener();
}

const subscribeDraft = (onStoreChange: () => void) => {
  draftListeners.add(onStoreChange);
  return () => {
    draftListeners.delete(onStoreChange);
  };
};

const getServerDraft = () => EMPTY_ANSWERS;

// =====================================================
// MAIN
// =====================================================

export default function ExamRunner({ exam }: { exam: ExamForAttempt }) {
  const total = exam.questions.length;
  const storageKey = `internbird:exam-draft:${exam.id}`;

  const [index, setIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(exam.duration * 60);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ExamResult | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const submittingRef = useRef(false);

  // getSnapshot must be referentially stable between store notifications,
  // so the parsed draft is memoised against the raw localStorage string.
  const draftCache = useRef<{
    key: string;
    raw: string | null;
    value: Record<string, string>;
  }>({ key: storageKey, raw: null, value: EMPTY_ANSWERS });

  const getDraftSnapshot = useCallback(() => {
    const raw = readDraftRaw(storageKey);
    const cache = draftCache.current;
    if (cache.key !== storageKey || cache.raw !== raw) {
      draftCache.current = {
        key: storageKey,
        raw,
        value: parseDraft(raw) ?? EMPTY_ANSWERS,
      };
    }
    return draftCache.current.value;
  }, [storageKey]);

  const answers = useSyncExternalStore(
    subscribeDraft,
    getDraftSnapshot,
    getServerDraft
  );

  // ---- derived ----
  const answeredIds = useMemo(
    () =>
      new Set(
        Object.entries(answers)
          .filter(([, v]) => typeof v === "string" && v.trim().length > 0)
          .map(([k]) => k)
      ),
    [answers]
  );

  const answeredCount = exam.questions.filter((q) =>
    answeredIds.has(q.id)
  ).length;

  const setAnswer = useCallback(
    (questionId: string, value: string) => {
      const current = draftCache.current.value;
      writeDraft(storageKey, { ...current, [questionId]: value });
    },
    [storageKey]
  );

  // ---- submit (also used by the timer) ----
  const doSubmit = useCallback(
    async (auto: boolean) => {
      if (submittingRef.current) return;
      submittingRef.current = true;
      setSubmitting(true);
      setConfirmOpen(false);
      setSubmitError(null);

      try {
        const res = await submitExam(exam.id, answers);
        if (res.success) {
          setResult(res.result);
          writeDraft(storageKey, null);
          toast.success(
            auto
              ? "Time is up — your exam was submitted automatically"
              : "Exam submitted successfully"
          );
        } else {
          submittingRef.current = false;
          setSubmitting(false);
          setSubmitError(res.error);
          toast.error(res.error);
        }
      } catch (error) {
        console.error("submitExam failed:", error);
        submittingRef.current = false;
        setSubmitting(false);
        setSubmitError("Could not submit right now. Please try again.");
        toast.error("Could not submit right now. Please try again.");
      }
    },
    [answers, exam.id, storageKey]
  );

  const submitRef = useRef(doSubmit);
  useEffect(() => {
    submitRef.current = doSubmit;
  }, [doSubmit]);

  // ---- countdown + auto submit ----
  useEffect(() => {
    if (result) return;

    if (secondsLeft <= 0) {
      void submitRef.current(true);
      return;
    }

    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft, result]);

  // ---- warn before losing the exam ----
  useEffect(() => {
    if (result || answeredCount === 0) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [result, answeredCount]);

  // ---- derived (render-time values) ----
  const current = exam.questions[index];
  const timeLow = secondsLeft <= 60;
  const progressPct = total > 0 ? (answeredCount / total) * 100 : 0;

  // =====================================================
  // RESULT SCREEN
  // =====================================================
  if (result) {
    return <ResultView result={result} exam={exam} />;
  }

  // =====================================================
  // EMPTY EXAM
  // =====================================================
  if (total === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
            <Info className="w-6 h-6 text-muted-foreground" />
          </div>
          <h1 className="text-lg font-semibold mb-2">No questions yet</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Your examiner hasn&apos;t added any questions to this exam. Please
            check back soon.
          </p>
          <Button
            render={
              <Link href="/internships">Back to internships</Link>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* ================= HEADER ================= */}
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Exit exam"
            render={
              <Link href="/internships">
                <ArrowLeft className="w-4 h-4" />
              </Link>
            }
          />

          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate">{exam.name}</p>
            <p className="text-[11px] text-muted-foreground truncate">
              {exam.internshipName}
              {exam.demandName ? ` · ${exam.demandName}` : ""}
            </p>
          </div>

          <div
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-mono text-sm font-semibold tabular-nums",
              timeLow
                ? "border-destructive/40 bg-destructive/10 text-destructive"
                : "bg-muted/50"
            )}
          >
            <Clock className="w-3.5 h-3.5" />
            {fmtClock(secondsLeft)}
          </div>

          <Button size="sm" onClick={() => setConfirmOpen(true)}>
            <Send className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Submit</span>
          </Button>
        </div>
      </header>

      {/* ================= BODY ================= */}
      <div className="flex-1 max-w-6xl mx-auto w-full px-4 py-6 grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-6">
        {/* ---------- QUESTION ---------- */}
        <div className="min-w-0 space-y-4">
          {previousAttemptBanner(exam)}

          <div className="rounded-2xl border bg-card">
            <div className="flex flex-wrap items-center gap-2 px-5 py-3.5 border-b">
              <span className="text-xs font-semibold tracking-wider uppercase text-muted-foreground">
                Question {index + 1} of {total}
              </span>
              <Badge variant="secondary" className="text-[10px] gap-1">
                {typeMeta(current.type).icon}
                {typeMeta(current.type).label}
              </Badge>
              <Badge variant="outline" className="text-[10px] ml-auto">
                {current.marks} {current.marks === 1 ? "mark" : "marks"}
              </Badge>
            </div>

            <div className="p-5 space-y-5">
              <div
                className="rich-text text-sm text-foreground/90 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: current.name }}
              />

              {current.details && (
                <div
                  className="rich-text text-sm text-muted-foreground leading-relaxed border-l-2 border-border pl-3"
                  dangerouslySetInnerHTML={{ __html: current.details }}
                />
              )}

              <Separator />

              <AnswerArea
                question={current}
                value={answers[current.id] ?? ""}
                onChange={(v) => setAnswer(current.id, v)}
              />
            </div>

            <div className="flex items-center gap-2 px-5 py-3.5 border-t">
              <Button
                variant="outline"
                size="sm"
                disabled={index === 0}
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Previous
              </Button>

              <Button
                variant="ghost"
                size="sm"
                disabled={!answers[current.id]?.trim()}
                onClick={() => setAnswer(current.id, "")}
              >
                <Eraser className="w-3.5 h-3.5" />
                Clear
              </Button>

              {index < total - 1 ? (
                <Button
                  size="sm"
                  className="ml-auto"
                  onClick={() => setIndex((i) => Math.min(total - 1, i + 1))}
                >
                  Next
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              ) : (
                <Button
                  size="sm"
                  className="ml-auto"
                  onClick={() => setConfirmOpen(true)}
                >
                  <Send className="w-3.5 h-3.5" />
                  Review &amp; Submit
                </Button>
              )}
            </div>
          </div>

          {/* mobile palette */}
          <div className="lg:hidden">
            <QuestionPalette
              exam={exam}
              index={index}
              answeredIds={answeredIds}
              onJump={setIndex}
            />
          </div>
        </div>

        {/* ---------- SIDEBAR ---------- */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-4">
            <div className="rounded-2xl border bg-card p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold tracking-wider uppercase text-muted-foreground">
                  Progress
                </span>
                <span className="text-xs font-semibold">
                  {answeredCount}/{total}
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                {total - answeredCount > 0
                  ? `${total - answeredCount} question${
                      total - answeredCount === 1 ? "" : "s"
                    } left`
                  : "All questions answered"}
              </p>
            </div>

            <QuestionPalette
              exam={exam}
              index={index}
              answeredIds={answeredIds}
              onJump={setIndex}
            />

            <div className="rounded-2xl border bg-muted/30 p-4">
              <p className="text-[11px] text-muted-foreground leading-relaxed flex gap-2">
                <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-px" />
                Your answers are saved in this browser. Submitting is final and
                cannot be undone.
              </p>
            </div>
          </div>
        </aside>
      </div>

      {/* ================= CONFIRM ================= */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="sm:max-w-md rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Submit your exam?</AlertDialogTitle>
            <AlertDialogDescription>
              You have answered{" "}
              <strong>
                {answeredCount} of {total}
              </strong>{" "}
              questions
              {answeredCount < total && (
                <>
                  {" "}
                  and left{" "}
                  <strong>{total - answeredCount}</strong> blank
                </>
              )}
              . This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {submitError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {submitError}
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Keep writing</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void doSubmit(false)}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit exam"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// =====================================================
// Question palette
// =====================================================
function QuestionPalette({
  exam,
  index,
  answeredIds,
  onJump,
}: {
  exam: ExamForAttempt;
  index: number;
  answeredIds: Set<string>;
  onJump: (i: number) => void;
}) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <p className="text-xs font-semibold tracking-wider uppercase text-muted-foreground mb-3">
        Questions
      </p>
      <div className="grid grid-cols-8 gap-1.5 lg:grid-cols-6">
        {exam.questions.map((q, i) => {
          const active = i === index;
          const answered = answeredIds.has(q.id);
          return (
            <button
              key={q.id}
              type="button"
              onClick={() => onJump(i)}
              aria-label={`Go to question ${i + 1}${answered ? " (answered)" : ""}`}
              aria-current={active}
              className={cn(
                "h-8 w-full rounded-md text-[11px] font-semibold border transition-colors",
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : answered
                  ? "bg-primary/10 text-primary border-primary/30"
                  : "bg-muted text-muted-foreground border-transparent hover:border-border"
              )}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// =====================================================
// Answer area
// =====================================================
function AnswerArea({
  question,
  value,
  onChange,
}: {
  question: ExamForAttempt["questions"][number];
  value: string;
  onChange: (value: string) => void;
}) {
  if (question.type === "mcq") {
    if (question.options.length === 0) {
      return (
        <p className="text-xs text-muted-foreground">
          No options were configured for this question. Skipping.
        </p>
      );
    }

    return (
      <div className="space-y-2" role="radiogroup" aria-label="Answer options">
        {question.options.map((opt, i) => {
          const selected = value === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(opt.id)}
              className={cn(
                "w-full flex items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors",
                selected
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40 hover:bg-muted/40"
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold",
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground"
                )}
              >
                {selected ? <CheckCircle2 className="w-3 h-3" /> : i + 1}
              </span>
              <span
                className="rich-text flex-1 min-w-0 break-words"
                dangerouslySetInnerHTML={{ __html: opt.labelText }}
              />
            </button>
          );
        })}
      </div>
    );
  }

  if (question.type === "code") {
    return (
      <div className="space-y-2">
        <CodeEditor
          value={value || question.defaultText || ""}
          onChange={onChange}
          height="280px"
        />
        <p className="text-[11px] text-muted-foreground">
          Write your solution below. An examiner will review it manually.
        </p>
      </div>
    );
  }

  if (question.type === "voice") {
    return (
      <div className="space-y-2">
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Type your answer here (it will be reviewed by your examiner)..."
          className="min-h-[140px] resize-y"
        />
        <p className="text-[11px] text-muted-foreground">
          Verbal questions are reviewed manually — type or paste your full
          answer.
        </p>
      </div>
    );
  }

  return (
    <Textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Write your answer here..."
      className="min-h-[160px] resize-y"
    />
  );
}

// =====================================================
// Previous attempt banner
// =====================================================
function previousAttemptBanner(exam: ExamForAttempt) {
  const prev = exam.previousAttempt;
  if (!prev) return null;

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 px-4 py-3">
      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
      <div className="text-xs text-muted-foreground">
        <p className="font-semibold text-foreground mb-0.5">
          Retaking — attempt #{prev.attemptCount + 1}
        </p>
        <p>
          Your last attempt scored{" "}
          <strong className="text-foreground">
            {prev.score ?? "—"} / {exam.computedTotal || exam.totalMarks}
          </strong>
          {prev.submittedAt ? ` on ${fmtDateTime(prev.submittedAt)}` : ""}.
          Only this attempt will be graded.
        </p>
      </div>
    </div>
  );
}

// =====================================================
// Result screen
// =====================================================
function ResultView({
  result,
  exam,
}: {
  result: ExamResult;
  exam: ExamForAttempt;
}) {
  const pct =
    result.totalMarks > 0
      ? Math.round((result.score / result.totalMarks) * 100)
      : 0;

  return (
    <div className="min-h-screen py-10 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* score */}
        <div className="rounded-2xl border bg-card p-6 text-center">
          <div
            className={cn(
              "w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center",
              result.passed === true
                ? "bg-emerald-500/10 border border-emerald-500/30"
                : result.passed === false
                ? "bg-destructive/10 border border-destructive/30"
                : "bg-amber-500/10 border border-amber-500/30"
            )}
          >
            {result.passed === true ? (
              <Trophy className="w-7 h-7 text-emerald-500" />
            ) : result.passed === false ? (
              <XCircle className="w-7 h-7 text-destructive" />
            ) : (
              <AlertTriangle className="w-7 h-7 text-amber-500" />
            )}
          </div>

          <h1 className="text-xl font-bold mb-1">Exam submitted</h1>
          <p className="text-sm text-muted-foreground mb-5">
            {result.examName} · {result.internshipName}
          </p>

          <div className="flex items-end justify-center gap-2 mb-4">
            <span className="text-5xl font-bold tabular-nums">
              {result.score}
            </span>
            <span className="text-xl text-muted-foreground mb-1.5">
              / {result.totalMarks}
            </span>
          </div>

          <div className="h-2 w-full max-w-xs mx-auto rounded-full bg-muted overflow-hidden mb-4">
            <div
              className={cn(
                "h-full rounded-full",
                result.passed === true
                  ? "bg-emerald-500"
                  : result.passed === false
                  ? "bg-destructive"
                  : "bg-amber-500"
              )}
              style={{ width: `${pct}%` }}
            />
          </div>

          <Badge
            variant="outline"
            className={cn(
              "text-[11px]",
              result.passed === true
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                : result.passed === false
                ? "border-destructive/30 bg-destructive/10 text-destructive"
                : "border-amber-500/30 bg-amber-500/10 text-amber-500"
            )}
          >
            {result.passed === true
              ? "Passed"
              : result.passed === false
              ? "Not passed"
              : "Pending review"}
          </Badge>
        </div>

        {/* stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatTile label="Correct" value={result.correctCount} tone="good" />
          <StatTile label="Wrong" value={result.wrongCount} tone="bad" />
          <StatTile label="In review" value={result.pendingReview} tone="warn" />
          <StatTile label="Skipped" value={result.unanswered} />
        </div>

        {result.pendingReview > 0 && (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 px-4 py-3">
            <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              {result.pendingReview} written / code{" "}
              {result.pendingReview === 1 ? "answer is" : "answers are"} still
              with your examiner. Your final score will update once they are
              graded.
            </p>
          </div>
        )}

        {/* review */}
        <div className="rounded-2xl border bg-card">
          <div className="px-5 py-3.5 border-b">
            <h2 className="text-xs font-semibold tracking-wider uppercase text-muted-foreground">
              Answer review
            </h2>
          </div>

          <div className="divide-y">
            {result.perQuestion.map((q, i) => (
              <div key={q.questionId} className="px-5 py-4 space-y-2">
                <div className="flex items-start gap-2">
                  <span className="text-xs font-bold text-muted-foreground shrink-0 mt-0.5">
                    {i + 1}.
                  </span>
                  <div
                    className="rich-text text-sm flex-1 min-w-0"
                    dangerouslySetInnerHTML={{ __html: q.questionName }}
                  />
                  {q.isCorrect === true ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  ) : q.isCorrect === false ? (
                    <XCircle className="w-4 h-4 text-destructive shrink-0" />
                  ) : (
                    <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                  )}
                </div>

                <div className="pl-6 text-xs space-y-1">
                  <p className="text-muted-foreground">
                    <span className="font-medium text-foreground/70">Your answer: </span>
                    {q.yourAnswer ? (
                      <span
                        className="rich-text"
                        dangerouslySetInnerHTML={{ __html: q.yourAnswer }}
                      />
                    ) : (
                      <span className="italic">Not answered</span>
                    )}
                  </p>
                  {q.correctAnswer && (
                    <p className="text-muted-foreground">
                      <span className="font-medium text-foreground/70">
                        Correct answer:{" "}
                      </span>
                      <span
                        className="rich-text text-emerald-500"
                        dangerouslySetInnerHTML={{ __html: q.correctAnswer }}
                      />
                    </p>
                  )}
                  {q.correctAnswer === null && q.yourAnswer && (
                    <p className="italic text-muted-foreground">
                      Awaiting examiner review
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            className="flex-1"
            render={
              <Link href="/internships">Back to internships</Link>
            }
          />
          <Button
            variant="outline"
            className="flex-1"
            render={<Link href="/">Go to home</Link>}
          />
        </div>

        <p className="text-[11px] text-muted-foreground text-center">
          Submitted on {fmtDateTime(result.submittedAt)} · Exam duration{" "}
          {exam.duration} min
        </p>
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "good" | "bad" | "warn";
}) {
  return (
    <div className="rounded-xl border bg-card p-3 text-center">
      <p
        className={cn(
          "text-lg font-bold tabular-nums",
          tone === "good" && "text-emerald-500",
          tone === "bad" && "text-destructive",
          tone === "warn" && "text-amber-500"
        )}
      >
        {value}
      </p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
    </div>
  );
}
