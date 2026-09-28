"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Loader2,
  Lock,
  FileText,
  Link2,
  CheckCircle2,
  Briefcase,
  Calendar,
  Clock,
  PlayCircle,
  Trophy,
  AlertCircle,
  ShieldCheck,
  CreditCard,
  IndianRupee,
  ExternalLink,
  RotateCcw,
  RefreshCw,
  User,
} from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { RichTextEditor } from "@/components/rich-text-editor";
import {
  createRegistrationAndOrder,
  verifyPayment,
  cancelPayment,
  syncPaymentStatus,
  getMyRegistrationStatus,
  getInternshipExams,
  type RegistrationStatus,
  type InternshipExam,
} from "../actions";
import { cn } from "@/lib/utils";

// =====================================================
// TYPES
// =====================================================
export type InternshipForApply = {
  id: string;
  name: string;
  demandName: string | null;
  demandIconUrl: string | null;
  description: string | null;
  jdUrl: string | null;
  startDate: Date | null;
  endDate: Date | null;
  lastSubmissionDate: Date | null;
  sellingPrice: string | null;
  price: string | null;
  totalScore: number | null;
  examinerName: string | null;
  examinerPhotoUrl: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  internship: InternshipForApply | null;
  isLoggedIn: boolean;
  /** Called after a successful payment so the table can refresh its badges. */
  onPaid?: () => void;
};

type DrawerState = "loading" | "form" | "payment" | "exams" | "closed";

type PendingOrder = {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
};

// =====================================================
// HELPERS
// =====================================================
function fmtDate(d: Date | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function fmtDuration(start: Date | null, end: Date | null) {
  if (!start || !end) return "—";
  const months = Math.max(
    1,
    Math.round((+new Date(end) - +new Date(start)) / (1000 * 60 * 60 * 24 * 30))
  );
  return `${months} months`;
}

function inr(rupees: number) {
  return `‚¹${rupees.toLocaleString("en-IN", {
    minimumFractionDigits: rupees % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

function deadlineVariant(d: Date | null) {
  if (!d) return "outline" as const;
  const diff = Math.ceil((+new Date(d) - Date.now()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return "outline" as const;
  if (diff <= 7) return "destructive" as const;
  if (diff <= 30) return "secondary" as const;
  return "outline" as const;
}

function deadlineLabel(d: Date | null) {
  if (!d) return "No deadline";
  const diff = Math.ceil((+new Date(d) - Date.now()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return "Closed";
  if (diff === 0) return "Today";
  if (diff === 1) return "1 day left";
  if (diff < 30) return `${diff} days left`;
  return fmtDate(d);
}

function isClosed(d: Date | null) {
  return !!d && +new Date(d) < Date.now();
}

function stripHtml(html: string) {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Razorpay type declaration — only the bits we actually use.
type RazorpayResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayErrorResponse = {
  error?: { description?: string; code?: string };
};

type RazorpayInstance = {
  open: () => void;
  on: (event: "payment.failed", handler: (r: RazorpayErrorResponse) => void) => void;
};

type RazorpayConstructor = new (options: Record<string, unknown>) => RazorpayInstance;

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

/** Makes sure the Razorpay checkout script is on the page. */
function loadRazorpayScript(timeout = 10000): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.Razorpay) return resolve(true);

    let script = document.querySelector<HTMLScriptElement>(
      'script[src*="checkout.razorpay.com"]'
    );

    if (!script) {
      script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      document.body.appendChild(script);
    }

    let settled = false;
    const done = (ok: boolean) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };

    script.addEventListener("load", () => done(!!window.Razorpay));
    script.addEventListener("error", () => done(false));
    setTimeout(() => done(!!window.Razorpay), timeout);
  });
}

// =====================================================
// MAIN
// =====================================================
export default function ApplyDrawer({
  open,
  onClose,
  internship,
  isLoggedIn,
  onPaid,
}: Props) {
  const [state, setState] = useState<DrawerState>("loading");
  /** Which internshipId the current `state` belongs to — guards stale renders. */
  const [resolvedFor, setResolvedFor] = useState<string | null>(null);
  const [regStatus, setRegStatus] = useState<RegistrationStatus | null>(null);
  const [exams, setExams] = useState<InternshipExam[]>([]);
  const [order, setOrder] = useState<PendingOrder | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [sdkLoading, setSdkLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // form
  const [coverLetter, setCoverLetter] = useState("");
  const [resumeUrl, setResumeUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const internshipId = internship?.id ?? null;
  const closed = isClosed(internship?.lastSubmissionDate ?? null);
  const onPaidRef = useRef(onPaid);
  useEffect(() => {
    onPaidRef.current = onPaid;
  }, [onPaid]);

  // ---- reset on close ----
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) return;
    if (isPending) return;
    onClose();
    setTimeout(() => {
      setCoverLetter("");
      setResumeUrl("");
      setError(null);
      setPaymentError(null);
      setState("loading");
      setResolvedFor(null);
      setRegStatus(null);
      setExams([]);
      setOrder(null);
      setSdkLoading(false);
      setSyncing(false);
    }, 300);
  };

  // ---- load the user's position in the flow ----
  const loadExams = useCallback(async (id: string) => {
    const list = await getInternshipExams(id);
    setExams(list);
    return list;
  }, []);

  useEffect(() => {
    if (!open) return;
    // Nothing to resolve synchronously — `phase` derives these from props.
    if (!internshipId || !isLoggedIn || closed) return;

    let cancelled = false;

    getMyRegistrationStatus(internshipId)
      .then(async (status) => {
        if (cancelled) return;
        setRegStatus(status);
        setResolvedFor(internshipId);

        // prefill from a previous (failed / abandoned) attempt
        if (status.coverLetter) setCoverLetter(status.coverLetter);
        if (status.resumeUrl) setResumeUrl(status.resumeUrl);

        if (status.state === "paid") {
          const list = await getInternshipExams(internshipId);
          if (cancelled) return;
          setExams(list);
          setState("exams");
        } else {
          setState("form");
        }
      })
      .catch((e) => {
        console.error("getMyRegistrationStatus failed:", e);
        if (cancelled) return;
        setResolvedFor(internshipId);
        setState("form");
      });

    return () => {
      cancelled = true;
    };
  }, [open, internshipId, isLoggedIn, closed]);

  /**
   * The visible step. "loading" and the gated states are derived rather than
   * stored, so no effect ever has to reset them.
   */
  const phase: DrawerState = closed
    ? "closed"
    : !isLoggedIn
    ? "form"
    : resolvedFor === internshipId
    ? state
    : "loading";

  const plainTextLength = stripHtml(coverLetter).length;

  // =====================================================
  // RAZORPAY
  // =====================================================
  const openRazorpay = useCallback(
    async (params: PendingOrder & { description: string }) => {
      setPaymentError(null);
      setSdkLoading(true);
      const ready = await loadRazorpayScript();
      setSdkLoading(false);

      if (!ready || !window.Razorpay) {
        const msg = "Could not load the payment window. Check your connection.";
        setPaymentError(msg);
        toast.error(msg);
        return;
      }

      const RazorpayCtor = window.Razorpay;
      const rzp = new RazorpayCtor({
        key: params.keyId,
        amount: params.amount,
        currency: params.currency,
        name: "InternBird",
        description: params.description,
        order_id: params.orderId,
        prefill: {},
        theme: { color: "#10b981" },
        modal: {
          ondismiss: async () => {
            await cancelPayment(params.orderId).catch(() => undefined);
            toast.info("Payment cancelled");
            setState("form");
          },
        },
        handler: async (response: RazorpayResponse) => {
          const res = await verifyPayment({
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
          });

          if (res.success) {
            toast.success("Payment successful!");
            setOrder(null);
            setRegStatus((prev) =>
              prev ? { ...prev, state: "paid" } : prev
            );
            setState("exams");
            onPaidRef.current?.();
            return;
          }

          // The money may still have been captured — offer a status check
          // instead of silently sending the user back to the form.
          const msg = res.error;
          toast.error(msg);
          setPaymentError(
            `${msg} If you were charged, use "Check payment status" below.`
          );
          setState("form");
        },
      });

      rzp.on("payment.failed", async (response: RazorpayErrorResponse) => {
        const description =
          response?.error?.description ?? "Payment failed. Please try again.";
        await cancelPayment(params.orderId).catch(() => undefined);
        toast.error(description);
        setPaymentError(description);
        setState("form");
      });

      rzp.open();
    },
    []
  );

  // =====================================================
  // STEP 1 — SAVE APPLICATION, CREATE ORDER
  // =====================================================
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!internship) return;

    if (plainTextLength < 20) {
      setError("Cover letter must be at least 20 characters");
      return;
    }

    if (!resumeUrl.trim()) {
      setError("Resume URL is required");
      return;
    }

    startTransition(async () => {
      const res = await createRegistrationAndOrder(
        internship.id,
        coverLetter,
        resumeUrl
      );

      if (!res.success) {
        setError(res.error);

        if (res.code === "already_paid" && internship.id) {
          // recover gracefully instead of leaving them stuck
          const status = await getMyRegistrationStatus(internship.id);
          setRegStatus(status);
          if (status.state === "paid") {
            const list = await loadExams(internship.id);
            setExams(list);
            setState("exams");
            setError(null);
            return;
          }
        }
        return;
      }

      if (res.free) {
        // Free internship — access is granted immediately.
        toast.success("Access granted — good luck with your exams!");
        if (internship.id) {
          setRegStatus((prev) =>
            prev
              ? {
                  ...prev,
                  state: "paid",
                  paidAt: new Date().toISOString(),
                  amountPaid: 0,
                }
              : prev
          );
          const list = await loadExams(internship.id);
          setExams(list);
        }
        setState("exams");
        onPaidRef.current?.();
        return;
      }

      setOrder({
        orderId: res.orderId,
        amount: res.amount,
        currency: res.currency,
        keyId: res.keyId,
      });
      setPaymentError(null);
      setState("payment");
    });
  };

  // =====================================================
  // RECOVERY — "did my money go through?"
  // =====================================================
  const handleSyncPayment = async () => {
    if (!order) return;
    setSyncing(true);
    try {
      const res = await syncPaymentStatus(order.orderId);
      if (res.success && res.paid) {
        toast.success("Payment found — your exams are unlocked");
        setOrder(null);
        setRegStatus((prev) => (prev ? { ...prev, state: "paid" } : prev));
        setState("exams");
        onPaidRef.current?.();
        return;
      }
      toast.info(res.success ? "No payment found yet" : res.error);
    } finally {
      setSyncing(false);
    }
  };

  // =====================================================
  // RENDER
  // =====================================================
  const title =
    phase === "exams"
      ? "Your Exams"
      : phase === "payment"
      ? "Complete Payment"
      : phase === "closed"
      ? "Applications Closed"
      : "Apply for Internship";

  const amountDueRupees = (regStatus?.amountDue ?? 0);

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[92vh] p-0 flex flex-col rounded-t-3xl overflow-hidden"
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-4 md:px-8 pb-8">
            {/* ============ HEADER ============ */}
            <SheetHeader className="mb-6">
              <div className="flex items-start gap-3">
                {internship?.demandIconUrl ? (
                  <div className="w-12 h-12 rounded-xl border bg-muted flex items-center justify-center overflow-hidden shrink-0">
                    <Image
                      src={internship.demandIconUrl}
                      alt={internship.demandName ?? ""}
                      width={32}
                      height={32}
                      className="object-contain"
                    />
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-xl border bg-muted flex items-center justify-center shrink-0">
                    <Briefcase className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <SheetTitle className="text-lg md:text-xl font-bold leading-snug">
                    {title}
                  </SheetTitle>
                  <SheetDescription className="text-sm text-muted-foreground mt-0.5">
                    {internship?.name}
                    {internship?.demandName && ` · ${internship.demandName}`}
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>

            {/* ============ LOADING ============ */}
            {phase === "loading" ? (
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-6">
                <div className="space-y-3">
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
                <Skeleton className="h-64 w-full" />
              </div>
            ) : phase === "closed" ? (
              <div className="flex flex-col items-center text-center py-10">
                <div className="w-16 h-16 rounded-2xl bg-muted border flex items-center justify-center mb-5">
                  <Clock className="w-7 h-7 text-muted-foreground" />
                </div>
                <h3 className="text-base font-semibold mb-2">
                  Applications are closed
                </h3>
                <p className="text-sm text-muted-foreground max-w-xs">
                  The last submission date for this internship was{" "}
                  {fmtDate(internship?.lastSubmissionDate ?? null)}.
                </p>
              </div>
            ) : !isLoggedIn ? (
              /* ============ NOT LOGGED IN ============ */
              <div className="flex flex-col items-center text-center py-8">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-5">
                  <Lock className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-base font-semibold mb-2">
                  Login required to apply
                </h3>
                <p className="text-sm text-muted-foreground max-w-xs mb-6">
                  You need to be signed in to fill your details and pay.
                </p>
                <Button
                  render={<Link href="/login">Please Login</Link>}
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-6 lg:gap-8">
                {/* ============ LEFT — Details ============ */}
                <div className="space-y-5">
                  {internship?.lastSubmissionDate && (
                    <Badge
                      variant={deadlineVariant(internship.lastSubmissionDate)}
                      className="gap-1.5"
                    >
                      <Clock className="w-3 h-3" />
                      {deadlineLabel(internship.lastSubmissionDate)}
                    </Badge>
                  )}

                  {internship?.description && (
                    <div>
                      <h3 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase mb-2">
                        About
                      </h3>
                      <div
                        className="tiptap text-sm text-foreground/80 leading-relaxed"
                        dangerouslySetInnerHTML={{
                          __html: internship.description,
                        }}
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <InfoTile
                      icon={<IndianRupee className="w-3.5 h-3.5" />}
                      label="Fee"
                      value={
                        amountDueRupees > 0 ? inr(amountDueRupees) : "Free"
                      }
                      highlight={amountDueRupees > 0}
                    />
                    <InfoTile
                      icon={<Clock className="w-3.5 h-3.5" />}
                      label="Duration"
                      value={fmtDuration(
                        internship?.startDate ?? null,
                        internship?.endDate ?? null
                      )}
                    />
                    <InfoTile
                      icon={<Calendar className="w-3.5 h-3.5" />}
                      label="Starts"
                      value={fmtDate(internship?.startDate ?? null)}
                    />
                    <InfoTile
                      icon={<Calendar className="w-3.5 h-3.5" />}
                      label="Ends"
                      value={fmtDate(internship?.endDate ?? null)}
                    />
                    <InfoTile
                      icon={<Calendar className="w-3.5 h-3.5" />}
                      label="Last Submission"
                      value={fmtDate(
                        internship?.lastSubmissionDate ?? null
                      )}
                    />
                    <InfoTile
                      icon={<Trophy className="w-3.5 h-3.5" />}
                      label="Total Score"
                      value={String(internship?.totalScore ?? "—")}
                    />
                  </div>

                  {internship?.examinerName && (
                    <div>
                      <h3 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase mb-2">
                        Examiner
                      </h3>
                      <div className="flex items-center gap-3 rounded-xl border bg-card p-3">
                        {internship.examinerPhotoUrl ? (
                          <Image
                            src={internship.examinerPhotoUrl}
                            alt={internship.examinerName}
                            width={36}
                            height={36}
                            className="h-9 w-9 rounded-full object-cover"
                          />
                        ) : (
                          <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                            <User className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">
                            {internship.examinerName}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            Will evaluate your submissions
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {internship?.jdUrl && (
                    <Button
                      variant="outline"
                      className="w-full"
                      render={
                        <a
                          href={internship.jdUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between w-full"
                        >
                          <span className="inline-flex items-center gap-2">
                            <FileText className="w-4 h-4 shrink-0" />
                            <span>View Job Description</span>
                          </span>
                          <ExternalLink className="w-4 h-4 shrink-0" />
                        </a>
                      }
                    />
                  )}
                </div>

                {/* ============ RIGHT — State-dependent ============ */}
                <div className="lg:border-l lg:pl-8 lg:border-border">
                  {/* ---------- STEP 1 : FORM ---------- */}
                  {phase === "form" && (
                    <form
                      onSubmit={handleSubmit}
                      className="flex flex-col gap-5"
                    >
                      <div>
                        <h3 className="text-sm font-semibold mb-1">
                          Fill your details
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          Step 1 of 2 — we&apos;ll take you to the payment
                          screen next.
                        </p>
                      </div>

                      <div>
                        <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
                          <Link2 className="w-3.5 h-3.5" />
                          Resume URL
                        </label>
                        <input
                          type="url"
                          required
                          value={resumeUrl}
                          onChange={(e) => setResumeUrl(e.target.value)}
                          placeholder="https://drive.google.com/your-resume"
                          className={cn(
                            "w-full px-4 py-3 rounded-xl",
                            "bg-muted/50 border border-border",
                            "text-sm placeholder:text-muted-foreground/50",
                            "focus:outline-none focus:border-primary/50 focus:bg-muted",
                            "transition-colors"
                          )}
                        />
                      </div>

                      <div>
                        <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
                          <FileText className="w-3.5 h-3.5" />
                          Cover Letter
                        </label>
                        <div className="rounded-xl overflow-hidden border border-border focus-within:border-primary/50 transition-colors">
                          <RichTextEditor
                            value={coverLetter}
                            onChange={setCoverLetter}
                            placeholder="Tell us why you're a great fit..."
                            minHeight="140px"
                          />
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1.5">
                          Min 20 characters · {plainTextLength}
                        </p>
                      </div>

                      {paymentError && (
                        <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 px-4 py-3 space-y-2">
                          <p className="text-xs text-amber-600 dark:text-amber-400">
                            {paymentError}
                          </p>
                          {order && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={handleSyncPayment}
                              disabled={syncing}
                            >
                              {syncing ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <RefreshCw className="w-3.5 h-3.5" />
                              )}
                              Check payment status
                            </Button>
                          )}
                        </div>
                      )}

                      {error && (
                        <div className="px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive">
                          {error}
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={isPending}
                        className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm
                                   hover:scale-[1.01] active:scale-[0.99] transition-transform
                                   disabled:opacity-60 disabled:cursor-not-allowed
                                   flex items-center justify-center gap-2"
                      >
                        {isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            Continue to Payment
                            <CreditCard className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </form>
                  )}

                  {/* ---------- STEP 2 : PAYMENT ---------- */}
                  {phase === "payment" && order && (
                    <div className="space-y-5">
                      <div>
                        <h3 className="text-sm font-semibold mb-1">
                          Complete your payment
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          Step 2 of 2 — your exams unlock the moment the payment
                          lands.
                        </p>
                      </div>

                      <Card>
                        <CardContent className="p-0">
                          <div className="flex items-center justify-between px-4 py-3.5 border-b">
                            <span className="text-sm font-medium truncate">
                              {internship?.name}
                            </span>
                            {amountDueRupees > 0 &&
                              Number(internship?.price ?? 0) >
                                amountDueRupees && (
                                <span className="text-xs text-muted-foreground line-through ml-2 shrink-0">
                                  {inr(Number(internship?.price ?? 0))}
                                </span>
                              )}
                          </div>

                          <div className="px-4 py-3.5 space-y-2.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">
                                Internship fee
                              </span>
                              <span className="font-medium">
                                {inr(amountDueRupees)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">
                                Platform fee
                              </span>
                              <span className="font-medium text-emerald-500">
                                {inr(0)}
                              </span>
                            </div>
                            <Separator />
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-semibold">
                                Amount payable
                              </span>
                              <span className="text-lg font-bold text-primary">
                                {inr(amountDueRupees)}
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {paymentError && (
                        <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 px-4 py-3 space-y-2">
                          <p className="text-xs text-amber-600 dark:text-amber-400">
                            {paymentError}
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleSyncPayment}
                            disabled={syncing}
                          >
                            {syncing ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <RefreshCw className="w-3.5 h-3.5" />
                            )}
                            Check payment status
                          </Button>
                        </div>
                      )}

                      <div className="space-y-2">
                        <Button
                          className="w-full py-3.5 text-sm font-semibold"
                          disabled={sdkLoading}
                          onClick={() =>
                            void openRazorpay({
                              ...order,
                              description:
                                internship?.name ?? "Internship Application",
                            })
                          }
                        >
                          {sdkLoading ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Loading secure checkout...
                            </>
                          ) : (
                            <>
                              <ShieldCheck className="w-4 h-4" />
                              Pay {inr(amountDueRupees)} securely
                            </>
                          )}
                        </Button>

                        <Button
                          variant="ghost"
                          className="w-full text-xs"
                          onClick={() => setState("form")}
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Back to details
                        </Button>
                      </div>

                      <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
                        Payments are processed by Razorpay. We never see or store
                        your card or UPI details.
                      </p>
                    </div>
                  )}

                  {/* ---------- STEP 3 : EXAMS ---------- */}
                  {phase === "exams" && (
                    <div className="space-y-3">
                      {regStatus?.paidAt && (
                        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-3.5 py-2.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                          <p className="text-xs text-muted-foreground">
                            Payment received
                            {regStatus.amountPaid != null && (
                              <>
                                {" "}
                                ·{" "}
                                <span className="font-semibold text-foreground">
                                  {regStatus.amountPaid > 0
                                    ? inr(regStatus.amountPaid)
                                    : "Free access"}
                                </span>
                              </>
                            )}
                            . Your exams are unlocked.
                          </p>
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase flex items-center gap-2">
                          <Trophy className="w-3.5 h-3.5" />
                          Exams ({exams.length})
                        </h3>
                      </div>

                      {exams.length === 0 ? (
                        <Card>
                          <CardContent className="py-10 text-center">
                            <Trophy className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                            <p className="text-xs text-muted-foreground">
                              No exams assigned yet. Check back soon.
                            </p>
                          </CardContent>
                        </Card>
                      ) : (
                        <div className="space-y-2">
                          {exams.map((exam) => (
                            <Card
                              key={exam.id}
                              className="hover:border-primary/40 transition-colors"
                            >
                              <CardContent className="p-4">
                                <div className="flex items-start gap-3">
                                  <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                                    <span className="text-sm font-bold text-primary">
                                      {exam.orderNo}
                                    </span>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                      <h4 className="text-sm font-semibold">
                                        {exam.name}
                                      </h4>
                                      {exam.attempted && (
                                        <Badge
                                          variant="outline"
                                          className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px]"
                                        >
                                          <CheckCircle2 className="w-2.5 h-2.5" />
                                          Attempted
                                          {exam.attemptCount > 1
                                            ? ` Ã—${exam.attemptCount}`
                                            : ""}
                                        </Badge>
                                      )}
                                    </div>

                                    {exam.description && (
                                      <div
                                        className="tiptap text-xs text-muted-foreground line-clamp-2 mb-2"
                                        dangerouslySetInnerHTML={{
                                          __html: exam.description,
                                        }}
                                      />
                                    )}

                                    <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground mb-3">
                                      <span className="flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {exam.duration} min
                                      </span>
                                      <span className="flex items-center gap-1">
                                        <Trophy className="w-3 h-3" />
                                        {exam.totalMarks} marks
                                      </span>
                                      {exam.passingMarks !== null && (
                                        <span>
                                          Pass: {exam.passingMarks}
                                        </span>
                                      )}
                                      {exam.attempted && exam.score !== null && (
                                        <span className="font-semibold text-primary">
                                          Score: {exam.score}
                                        </span>
                                      )}
                                    </div>

                                    {exam.attempted &&
                                      exam.pendingReview > 0 && (
                                        <p className="text-[11px] text-amber-500 mb-2">
                                          {exam.pendingReview} answer
                                          {exam.pendingReview === 1
                                            ? ""
                                            : "s"}{" "}
                                          pending examiner review
                                        </p>
                                      )}

                                    <Button
                                      size="sm"
                                      variant={
                                        exam.attempted
                                          ? "outline"
                                          : "default"
                                      }
                                      className="w-full"
                                      render={
                                        <Link
                                          href={`/exams/${exam.id}/start`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                        >
                                          <PlayCircle className="w-3.5 h-3.5" />
                                          {exam.attempted
                                            ? "Retake Exam"
                                            : "Start Exam"}
                                        </Link>
                                      }
                                    />
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ---------- fallback ---------- */}
                  {phase === "payment" && !order && (
                    <div className="flex flex-col items-center text-center py-8">
                      <AlertCircle className="w-8 h-8 text-muted-foreground mb-3" />
                      <p className="text-sm text-muted-foreground mb-4">
                        Your payment session expired. Please try again.
                      </p>
                      <Button onClick={() => setState("form")}>
                        Back to details
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// =====================================================
// Info Tile
// =====================================================
function InfoTile({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
        {icon}
        <span className="text-[10px] uppercase tracking-wider font-medium">
          {label}
        </span>
      </div>
      <p
        className={cn(
          "text-sm font-semibold",
          highlight ? "text-primary" : "text-foreground"
        )}
      >
        {value}
      </p>
    </div>
  );
}
