"use client";

import { useRef, useState } from "react";
import { FileText, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { clearResume, getResumeUploadUrl, saveResume } from "./actions";

/**
 * Resume upload — PDF only, and private.
 *
 * The file goes straight to R2 through a presigned PUT, then only its KEY is
 * stored. The public bucket URL is deliberately never used here: this bucket is
 * reachable on its r2.dev subdomain, so a public URL would make every student's
 * resume readable by anyone who obtained it. Downloads instead go through
 * /api/resume/[userId], which checks that the caller is the owner or an admin.
 */

const MAX_BYTES = 5 * 1024 * 1024;

/** Anything that is not a real PDF is rejected before it is uploaded. */
function looksLikePdf(file: File): boolean {
  return (
    file.type === "application/pdf" ||
    file.name.toLowerCase().endsWith(".pdf")
  );
}

function formatSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export type ResumeInfo = {
  resumeKey: string | null;
  resumeFileName: string | null;
  resumeSize: number | null;
};

export default function ResumeUploadField({
  userId,
  value,
  onChanged,
  variant = "profile",
  hasResume,
}: {
  /** Needed to build the authorized view link for the current resume. */
  userId: string;
  value: ResumeInfo;
  onChanged: (next: ResumeInfo) => void;
  /**
   * `profile` is the full card used on the profile page. `compact` is for the
   * apply form, which is already dense and should not grow a second panel —
   * it drops the "Replace"/remove controls and keeps just the essentials.
   */
  variant?: "profile" | "compact";
  /**
   * Whether a resume is on file, when the caller knows it independently.
   *
   * The apply form has no business holding the R2 key — it is private by
   * design — so it passes this flag instead of a value it would have to fake.
   */
  hasResume?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File) {
    if (!looksLikePdf(file)) {
      toast.error("Only PDF resumes are allowed.");
      return;
    }

    if (file.size > MAX_BYTES) {
      toast.error("File too large (max 5MB).");
      return;
    }

    setBusy(true);
    try {
      // 1. Ask the server for a presigned PUT. It decides the object key
      //    under the signed-in user's own prefix — never the client's.
      const prepared = await getResumeUploadUrl({
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
      });

      if (!prepared.success) {
        toast.error(prepared.error);
        return;
      }

      // 2. Upload straight to R2. The Content-Type must match the one the
      //    URL was signed with, otherwise R2 rejects the signature.
      const upload = await fetch(prepared.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/pdf" },
        body: file,
      });

      if (!upload.ok) throw new Error("Upload failed");

      // 3. Record it against the profile.
      const saved = await saveResume({
        key: prepared.key,
        fileName: file.name,
        size: file.size,
      });

      if (!saved.success) {
        toast.error(saved.error);
        return;
      }

      onChanged({
        resumeKey: prepared.key,
        resumeFileName: file.name,
        resumeSize: file.size,
      });

      toast.success("Resume uploaded!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to upload resume");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleRemove() {
    setBusy(true);
    try {
      const res = await clearResume();
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      onChanged({ resumeKey: null, resumeFileName: null, resumeSize: null });
      toast.success("Resume removed");
    } catch (err) {
      console.error(err);
      toast.error("Failed to remove resume");
    } finally {
      setBusy(false);
    }
  }

  const resumeOnFile = hasResume ?? Boolean(value.resumeKey);
  const compact = variant === "compact";

  return (
    <div className="space-y-2">
      <Label>Resume</Label>

      {resumeOnFile ? (
        <div
          className={cn(
            "flex items-center justify-between gap-3 rounded-lg border",
            compact ? "p-2.5" : "p-3"
          )}
        >
          <div className="flex min-w-0 items-center gap-2">
            <FileText className="size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              {/* The view link goes through the authorized route, not R2. */}
              <a
                href={`/api/resume/${userId}`}
                target="_blank"
                rel="noreferrer"
                className="block truncate text-sm font-medium hover:underline"
              >
                {value.resumeFileName || "resume.pdf"}
              </a>
              {value.resumeSize ? (
                <p className="text-xs text-muted-foreground">
                  {formatSize(value.resumeSize)} · only you and admins can open
                  this
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              {compact ? "Change" : "Replace"}
            </Button>
            {compact ? null : (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={busy}
                onClick={handleRemove}
                aria-label="Remove resume"
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "w-full justify-start gap-2",
            compact ? "py-3" : "py-6"
          )}
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Upload className="size-4" />
          )}
          {busy ? "Uploading…" : "Upload resume (PDF, max 5MB)"}
        </Button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />

      <p className="text-xs text-muted-foreground">
        {compact
          ? "PDF, max 5MB. Saved to your profile so you never have to upload it again."
          : "Your resume is private — only you and admins can open it."}
      </p>
    </div>
  );
}