"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import {
  Briefcase,
  Calendar,
  Clock,
  ExternalLink,
  FileText,
  IndianRupee,
  Loader2,
  Trophy,
  CheckCircle2,
  LogIn,
} from "lucide-react";

import type { InternshipCard } from "./actions";
import { applyToInternship } from "./actions";
import { useSession } from "@/lib/auth-client";

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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { RichTextEditor } from "@/components/rich-text-editor";

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
    Math.round(
      (+new Date(end) - +new Date(start)) / (1000 * 60 * 60 * 24 * 30)
    )
  );
  return `${months} months`;
}

function fmtPrice(p: string | null) {
  if (!p) return "Unpaid";
  const n = Number(p);
  if (isNaN(n) || n === 0) return "Unpaid";
  return `₹${n.toLocaleString("en-IN")}`;
}

// =====================================================
// MAIN
// =====================================================
export default function InternshipDetailDrawer({
  internship,
  onClose,
}: {
  internship: InternshipCard | null;
  onClose: () => void;
}) {
  const { data: session } = useSession();
  const isLoggedIn = !!session?.user;

  if (!internship) return null;

  return (
    <Sheet open={!!internship} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="bottom"
        className="max-h-[90vh] p-0 flex flex-col rounded-t-3xl"
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        <SheetHeader className="px-6 pb-4 border-b shrink-0">
          <div className="flex items-start gap-3">
            {internship.demandIconUrl ? (
              <div className="w-14 h-14 rounded-xl border bg-muted flex items-center justify-center overflow-hidden shrink-0">
                <Image
                  src={internship.demandIconUrl}
                  alt={internship.demandName ?? ""}
                  width={38}
                  height={38}
                  className="object-contain"
                />
              </div>
            ) : (
              <div className="w-14 h-14 rounded-xl border bg-muted flex items-center justify-center shrink-0">
                <Briefcase className="w-6 h-6 text-muted-foreground" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <Badge variant="secondary" className="text-[10px] mb-2">
                {internship.demandName ?? "General"}
              </Badge>
              <SheetTitle className="text-lg leading-snug line-clamp-2">
                {internship.name}
              </SheetTitle>
              <SheetDescription className="sr-only">
                Internship details
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">
            {/* Description — HTML rendered with tiptap styles */}
            {internship.description && (
              <div>
                <h3 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase mb-2">
                  About
                </h3>
                <div
                  className="tiptap text-sm text-foreground/80 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: internship.description }}
                />
              </div>
            )}

            {/* Info grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <InfoTile
                icon={<IndianRupee className="w-4 h-4" />}
                label="Stipend"
                value={fmtPrice(internship.sellingPrice)}
                highlight
              />
              <InfoTile
                icon={<Clock className="w-4 h-4" />}
                label="Duration"
                value={fmtDuration(internship.startDate, internship.endDate)}
              />
              <InfoTile
                icon={<Calendar className="w-4 h-4" />}
                label="Starts"
                value={fmtDate(internship.startDate)}
              />
              <InfoTile
                icon={<Calendar className="w-4 h-4" />}
                label="Ends"
                value={fmtDate(internship.endDate)}
              />
              <InfoTile
                icon={<Clock className="w-4 h-4" />}
                label="Apply by"
                value={fmtDate(internship.lastSubmissionDate)}
              />
              <InfoTile
                icon={<Trophy className="w-4 h-4" />}
                label="Total Score"
                value={String(internship.totalScore)}
              />
            </div>

            <Separator />

            {/* Examiner */}
            {internship.examinerName && (
              <div>
                <h3 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase mb-3">
                  Examiner
                </h3>
                <Card>
                  <CardContent className="p-3 flex items-center gap-3">
                    <Avatar className="h-11 w-11">
                      <AvatarImage
                        src={internship.examinerPhotoUrl ?? undefined}
                      />
                      <AvatarFallback>
                        {internship.examinerName.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-semibold">
                        {internship.examinerName}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Will evaluate your submissions
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* JD link — fixed alignment */}
            {internship.jdUrl && (
              <Button variant="outline" className="w-full" asChild>
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
              </Button>
            )}
          </div>
        </div>

        {/* Footer action */}
        <div className="border-t p-4 shrink-0 bg-background">
          <div className="max-w-3xl mx-auto">
            {internship.isRegistered ? (
              <Button disabled className="w-full" variant="secondary">
                <CheckCircle2 className="w-4 h-4" />
                Already Applied
              </Button>
            ) : !isLoggedIn ? (
              <Button asChild className="w-full">
                <a href="/login">
                  <LogIn className="w-4 h-4" />
                  Login to Apply
                </a>
              </Button>
            ) : (
              <ApplyForm
                internshipId={internship.id}
                internshipName={internship.name}
                demandName={internship.demandName}
              />
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// =====================================================
// Info tile
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
        className={`text-sm font-semibold ${
          highlight ? "text-primary" : "text-foreground"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

// =====================================================
// Inline Apply form
// =====================================================
function ApplyForm({
  internshipId,
  internshipName,
  demandName,
}: {
  internshipId: string;
  internshipName: string;
  demandName: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [coverLetter, setCoverLetter] = useState("");
  const [resumeUrl, setResumeUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  const plainLen = coverLetter
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim().length;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (plainLen < 20) {
      setError("Cover letter must be at least 20 characters");
      return;
    }
    startTransition(async () => {
      const res = await applyToInternship(internshipId, coverLetter, resumeUrl);
      if (res.success) {
        setSuccess(true);
        setTimeout(() => {
          setSuccess(false);
          setOpen(false);
          setCoverLetter("");
          setResumeUrl("");
        }, 1800);
      } else {
        setError(res.error);
      }
    });
  };

  if (success) {
    return (
      <div className="flex items-center justify-center gap-2 py-3 text-sm font-semibold text-emerald-400">
        <CheckCircle2 className="w-4 h-4" />
        Application sent!
      </div>
    );
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} className="w-full">
        Apply Now
      </Button>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Applying to <span className="font-semibold">{internshipName}</span>
        {demandName && ` · ${demandName}`}
      </p>

      <Input
        type="url"
        required
        placeholder="Resume URL (https://...)"
        value={resumeUrl}
        onChange={(e) => setResumeUrl(e.target.value)}
      />

      <div className="rounded-lg border overflow-hidden">
        <RichTextEditor
          value={coverLetter}
          onChange={setCoverLetter}
          placeholder="Why are you a great fit?"
          minHeight="120px"
        />
      </div>

      <p className="text-[10px] text-muted-foreground">
        Min 20 chars · {plainLen}
      </p>

      {error && (
        <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOpen(false)}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isPending} className="flex-1">
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Submitting...
            </>
          ) : (
            "Submit Application"
          )}
        </Button>
      </div>
    </form>
  );
}