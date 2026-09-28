"use client";

import { useEffect, useState, useTransition } from "react";
import Image from "next/image";
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
  getMyRegistrationStatus,
  getInternshipExams,
  type RegistrationStatus,
  type InternshipExam,
} from "../actions";
import { cn } from "@/lib/utils";

// =====================================================
// TYPES
// =====================================================
type InternshipForApply = {
  id: string;
  name: string;
  demandName: string | null;
  demandIconUrl: string | null;
  description: string | null;
  startDate: Date | null;
  endDate: Date | null;
  lastSubmissionDate: Date | null;
  sellingPrice: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  internship: InternshipForApply | null;
  isLoggedIn: boolean;
};

type DrawerState = "loading" | "form" | "paying" | "exams";

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

// Razorpay type declaration
declare global {
  interface Window {
    Razorpay: any;
  }
}

// =====================================================
// MAIN
// =====================================================
export default function ApplyDrawer({
  open,
  onClose,
  internship,
  isLoggedIn,
}: Props) {
  const [state, setState] = useState<DrawerState>("loading");
  const [regStatus, setRegStatus] = useState<RegistrationStatus>({
    state: "none",
  });
  const [exams, setExams] = useState<InternshipExam[]>([]);

  // form
  const [coverLetter, setCoverLetter] = useState("");
  const [resumeUrl, setResumeUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // reset when drawer closes
  const handleOpenChange = (isOpen: boolean) => {
    if (isPending) return;
    if (!isOpen) {
      onClose();
      setTimeout(() => {
        setCoverLetter("");
        setResumeUrl("");
        setError(null);
        setState("loading");
        setRegStatus({ state: "none" });
        setExams([]);
      }, 300);
    }
  };

  // load registration status when drawer opens
  useEffect(() => {
    if (!open || !internship || !isLoggedIn) {
      setState("form");
      return;
    }

    let mounted = true;
    setState("loading");

    getMyRegistrationStatus(internship.id).then(async (status) => {
      if (!mounted) return;
      setRegStatus(status);

      if (status.state === "paid") {
        const list = await getInternshipExams(internship.id);
        if (!mounted) return;
        setExams(list);
        setState("exams");
      } else if (status.state === "pending") {
        setState("paying");
      } else {
        setState("form");
      }
    });

    return () => {
      mounted = false;
    };
  }, [open, internship?.id, isLoggedIn]);

  const plainTextLength = coverLetter
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim().length;

  // =====================================================
  // OPEN RAZORPAY CHECKOUT
  // =====================================================
  function openRazorpay(params: {
    orderId: string;
    amount: number;
    currency: string;
    registrationId: string;
    keyId: string;
  }) {
    if (typeof window.Razorpay === "undefined") {
      toast.error("Razorpay SDK not loaded. Refresh page.");
      return;
    }

    const options = {
      key: params.keyId,
      amount: params.amount,
      currency: params.currency,
      name: "InternBird",
      description: internship?.name ?? "Internship Application",
      order_id: params.orderId,
      handler: async (response: any) => {
        // verify
        const res = await verifyPayment({
          razorpayOrderId: response.razorpay_order_id,
          razorpayPaymentId: response.razorpay_payment_id,
          razorpaySignature: response.razorpay_signature,
        });

        if (res.success) {
          toast.success("Payment successful!");
          // reload exams
          if (internship) {
            const list = await getInternshipExams(internship.id);
            setExams(list);
          }
          setRegStatus({ state: "paid" });
          setState("exams");
        } else {
          toast.error(res.error);
          // registration deleted — form pe wapas
          setRegStatus({ state: "none" });
          setState("form");
        }
      },
      modal: {
        ondismiss: async () => {
          // user closed popup without paying → delete
          await cancelPayment(params.orderId);
          toast.info("Payment cancelled");
          setRegStatus({ state: "none" });
          setState("form");
        },
      },
      theme: {
        color: "#10b981",
      },
    };

    const rzp = new window.Razorpay(options);
    rzp.on("payment.failed", async (response: any) => {
      console.error("Payment failed:", response.error);
      await cancelPayment(params.orderId);
      toast.error(response.error?.description ?? "Payment failed");
      setRegStatus({ state: "none" });
      setState("form");
    });
    rzp.open();
  }

  // =====================================================
  // SUBMIT FORM
  // =====================================================
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!internship) return;

    if (plainTextLength < 20) {
      setError("Cover letter must be at least 20 characters");
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
        return;
      }

      openRazorpay({
        orderId: res.orderId,
        amount: res.amount,
        currency: res.currency,
        registrationId: res.registrationId,
        keyId: res.keyId,
      });
    });
  };

  // =====================================================
  // RETRY PAYMENT
  // =====================================================
  const handleRetryPayment = () => {
    if (
      regStatus.state !== "pending" ||
      !regStatus.razorpayOrderId ||
      !internship
    ) {
      // no order → fresh form
      setRegStatus({ state: "none" });
      setState("form");
      return;
    }

    const amount = regStatus.amount;
    const orderId = regStatus.razorpayOrderId;

    openRazorpay({
      orderId,
      amount,
      currency: "INR",
      registrationId: "",
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
    });
  };

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
                    {state === "exams"
                      ? "Your Exams"
                      : state === "paying"
                      ? "Complete Payment"
                      : "Apply for Internship"}
                  </SheetTitle>
                  <SheetDescription className="text-sm text-muted-foreground mt-0.5">
                    {internship?.name}
                    {internship?.demandName && ` · ${internship.demandName}`}
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>

            {/* ============ LOADING ============ */}
            {state === "loading" ? (
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-6">
                <div className="space-y-3">
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
                <Skeleton className="h-64 w-full" />
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
                  You need to be signed in to submit your application.
                </p>
                <a
                  href="/login"
                  className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:scale-[1.02] active:scale-[0.98] transition-transform"
                >
                  Please Login
                </a>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-6 lg:gap-8">
                {/* ============ LEFT — Details (always shown) ============ */}
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
                      icon={<Calendar className="w-3.5 h-3.5" />}
                      label="Last Submission"
                      value={fmtDate(internship?.lastSubmissionDate ?? null)}
                      highlight
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
                  </div>
                </div>

                {/* ============ RIGHT — State-dependent ============ */}
                <div className="lg:border-l lg:pl-8 lg:border-border">
                  {/* ---------- FORM ---------- */}
                  {state === "form" && (
                    <form
                      onSubmit={handleSubmit}
                      className="flex flex-col gap-5"
                    >
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
                          "Continue to Payment"
                        )}
                      </button>
                    </form>
                  )}

                  {/* ---------- PAYING (pending) ---------- */}
                  {state === "paying" && (
                    <div className="flex flex-col items-center text-center py-8">
                      <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-5">
                        <AlertCircle className="w-7 h-7 text-amber-500" />
                      </div>
                      <h3 className="text-base font-semibold mb-2">
                        Payment Pending
                      </h3>
                      <p className="text-sm text-muted-foreground max-w-xs mb-6">
                        Complete your payment to unlock exams for this
                        internship.
                      </p>
                      <Button onClick={handleRetryPayment} className="w-full">
                        Complete Payment
                      </Button>
                    </div>
                  )}

                  {/* ---------- EXAMS (paid) ---------- */}
                  {state === "exams" && (
                    <div className="space-y-3">
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
                                      {exam.passingMarks && (
                                        <span>
                                          Pass: {exam.passingMarks}
                                        </span>
                                      )}
                                    </div>

                                    <Button
                                      size="sm"
                                      variant={
                                        exam.attempted
                                          ? "outline"
                                          : "default"
                                      }
                                      className="w-full"
                                      
                                    >
                                      <a
                                        href={`/exams/${exam.id}/start`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                      >
                                        <PlayCircle className="w-3.5 h-3.5" />
                                        {exam.attempted
                                          ? "Retake Exam"
                                          : "Start Exam"}
                                      </a>
                                    </Button>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
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