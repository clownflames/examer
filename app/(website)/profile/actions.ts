"use server";

import { db } from "@/db";
import { profile, user, teamMember, team } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";

// =====================================================
// TYPES
// =====================================================
export type ProfileData = {
  id: string | null;
  userId: string;
  // basic
  headline: string | null;
  bio: string | null;
  phone: string | null;
  // education
  collegeName: string | null;
  universityName: string | null;
  degree: string | null;
  branch: string | null;
  rollNumber: string | null;
  graduationYear: number | null;
  cgpa: string | null;
  // location
  city: string | null;
  state: string | null;
  country: string | null;
  pincode: string | null;
  // links
  githubUrl: string | null;
  linkedinUrl: string | null;
  portfolioUrl: string | null;
  twitterUrl: string | null;
  // arrays
  skills: string[];
  languages: string[];
  experience: {
    company: string;
    role: string;
    duration: string;
    description?: string;
  }[];
  projects: {
    name: string;
    description?: string;
    link?: string;
    techStack?: string[];
  }[];
  achievements: string[];
  // resume
  resumeUrl: string | null;
  /**
   * Uploaded resume. Only the KEY is exposed — the file itself is served by
   * /api/resume/[userId], which checks that the caller owns it (or is admin).
   */
  resumeKey: string | null;
  resumeFileName: string | null;
  resumeSize: number | null;
  // meta
  isPublic: boolean;
  profileCompletion: number;
  // user
  userName: string;
  userEmail: string;
  userImage: string | null;
  // stats
  teamCount: number;
  messageCount: number;
};

// =====================================================
// CALCULATE COMPLETION
// =====================================================

/**
 * Single source of truth for "is this profile finished?". The completion
 * percentage AND the reminder popup's checklist both read from here, so the
 * bar and the list can never drift apart.
 */
type CompletionCheck = {
  label: string;
  isDone: (p: CompletionFields) => boolean;
};

/**
 * The subset of profile fields completion depends on. Deliberately allows
 * `null` so it accepts both `ProfileData` and a raw (sparse) DB row.
 */
type CompletionFields = {
  headline?: string | null;
  bio?: string | null;
  phone?: string | null;
  collegeName?: string | null;
  degree?: string | null;
  branch?: string | null;
  graduationYear?: number | null;
  city?: string | null;
  linkedinUrl?: string | null;
  githubUrl?: string | null;
  skills?: string[] | null;
  resumeUrl?: string | null;
  /** An uploaded resume counts as having a resume, same as a pasted link. */
  resumeKey?: string | null;
};

const COMPLETION_CHECKS: CompletionCheck[] = [
  { label: "Add a headline", isDone: (p) => !!p.headline },
  { label: "Write a short bio", isDone: (p) => !!p.bio },
  { label: "Add your phone number", isDone: (p) => !!p.phone },
  { label: "Add your college", isDone: (p) => !!p.collegeName },
  { label: "Add your degree", isDone: (p) => !!p.degree },
  { label: "Add your branch", isDone: (p) => !!p.branch },
  { label: "Add your graduation year", isDone: (p) => !!p.graduationYear },
  { label: "Add your city", isDone: (p) => !!p.city },
  {
    label: "Link your LinkedIn or GitHub",
    isDone: (p) => !!(p.linkedinUrl || p.githubUrl),
  },
  { label: "Add at least one skill", isDone: (p) => (p.skills?.length ?? 0) > 0 },
  { label: "Add your resume link", isDone: (p) => !!p.resumeUrl || !!p.resumeKey },
];

function calcCompletion(p: CompletionFields): number {
  const filled = COMPLETION_CHECKS.filter((c) => c.isDone(p)).length;
  return Math.round((filled / COMPLETION_CHECKS.length) * 100);
}

function missingCompletionLabels(p: CompletionFields): string[] {
  return COMPLETION_CHECKS.filter((c) => !c.isDone(p)).map((c) => c.label);
}

// =====================================================
// COMPLETION STATUS (for the reminder popup)
// =====================================================

export type ProfileCompletionStatus = {
  completion: number;
  name: string;
  /** Human-readable labels of what is still left to do. */
  missing: string[];
};

/**
 * Only what the reminder popup needs — no team/message counts, no full
 * profile. Returns null for signed-out visitors and admins (an admin has no
 * student profile to complete).
 */
export async function getProfileCompletionStatus(): Promise<ProfileCompletionStatus | null> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const userId = session?.user?.id;
    if (!userId) return null;
    if (session?.user?.role === "admin") return null;

    const [existing] = await db
      .select({
        headline: profile.headline,
        bio: profile.bio,
        phone: profile.phone,
        collegeName: profile.collegeName,
        degree: profile.degree,
        branch: profile.branch,
        graduationYear: profile.graduationYear,
        city: profile.city,
        linkedinUrl: profile.linkedinUrl,
        githubUrl: profile.githubUrl,
        skills: profile.skills,
        resumeUrl: profile.resumeUrl,
      })
      .from(profile)
      .where(eq(profile.userId, userId))
      .limit(1);

    const fields = existing ?? {};
    return {
      completion: calcCompletion(fields),
      name: session.user.name ?? "",
      missing: missingCompletionLabels(fields),
    };
  } catch (error) {
    // `headers()` signals "render dynamically" by throwing. Swallowing it
    // would break static prerendering, so hand it back to Next.
    unstable_rethrow(error);
    console.error("getProfileCompletionStatus error:", error);
    return null;
  }
}

// =====================================================
// GET PROFILE
// =====================================================
export async function getMyProfile(): Promise<ProfileData | null> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) return null;

    const [existing] = await db
      .select()
      .from(profile)
      .where(eq(profile.userId, session.user.id))
      .limit(1);

    // team count
    const [teamCountRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(teamMember)
      .where(eq(teamMember.userId, session.user.id));

    const data: ProfileData = {
      id: existing?.id ?? null,
      userId: session.user.id,
      headline: existing?.headline ?? null,
      bio: existing?.bio ?? null,
      phone: existing?.phone ?? null,
      collegeName: existing?.collegeName ?? null,
      universityName: existing?.universityName ?? null,
      degree: existing?.degree ?? null,
      branch: existing?.branch ?? null,
      rollNumber: existing?.rollNumber ?? null,
      graduationYear: existing?.graduationYear ?? null,
      cgpa: existing?.cgpa ?? null,
      city: existing?.city ?? null,
      state: existing?.state ?? null,
      country: existing?.country ?? "India",
      pincode: existing?.pincode ?? null,
      githubUrl: existing?.githubUrl ?? null,
      linkedinUrl: existing?.linkedinUrl ?? null,
      portfolioUrl: existing?.portfolioUrl ?? null,
      twitterUrl: existing?.twitterUrl ?? null,
      skills: existing?.skills ?? [],
      languages: existing?.languages ?? [],
      experience: existing?.experience ?? [],
      projects: existing?.projects ?? [],
      achievements: existing?.achievements ?? [],
      resumeUrl: existing?.resumeUrl ?? null,
      resumeKey: existing?.resumeKey ?? null,
      resumeFileName: existing?.resumeFileName ?? null,
      resumeSize: existing?.resumeSize ?? null,
      isPublic: existing?.isPublic ?? true,
      profileCompletion: existing?.profileCompletion ?? 0,
      userName: session.user.name ?? "",
      userEmail: session.user.email ?? "",
      userImage: session.user.image ?? null,
      teamCount: teamCountRow?.count ?? 0,
      messageCount: 0,
    };

    // Auto-calc completion
    data.profileCompletion = calcCompletion(data);
    return data;
  } catch (error) {
    console.error("getMyProfile error:", error);
    return null;
  }
}

// =====================================================
// UPDATE PROFILE
// =====================================================
export type UpdateProfileInput = Partial<
  Omit<ProfileData, "id" | "userId" | "profileCompletion" | "userName" | "userEmail" | "userImage" | "teamCount" | "messageCount">
>;

export async function updateMyProfile(
  input: UpdateProfileInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return { success: false, error: "Not authenticated" };
    }

    const [existing] = await db
      .select({ id: profile.id })
      .from(profile)
      .where(eq(profile.userId, session.user.id))
      .limit(1);

    const payload = {
      headline: input.headline ?? null,
      bio: input.bio ?? null,
      phone: input.phone ?? null,
      collegeName: input.collegeName ?? null,
      universityName: input.universityName ?? null,
      degree: input.degree ?? null,
      branch: input.branch ?? null,
      rollNumber: input.rollNumber ?? null,
      graduationYear: input.graduationYear ?? null,
      cgpa: input.cgpa ?? null,
      city: input.city ?? null,
      state: input.state ?? null,
      country: input.country ?? "India",
      pincode: input.pincode ?? null,
      githubUrl: input.githubUrl ?? null,
      linkedinUrl: input.linkedinUrl ?? null,
      portfolioUrl: input.portfolioUrl ?? null,
      twitterUrl: input.twitterUrl ?? null,
      skills: input.skills ?? [],
      languages: input.languages ?? [],
      experience: input.experience ?? [],
      projects: input.projects ?? [],
      achievements: input.achievements ?? [],
      resumeUrl: input.resumeUrl ?? null,
      isPublic: input.isPublic ?? true,
      profileCompletion: calcCompletion(input as Partial<ProfileData>),
    };

    if (existing) {
      await db
        .update(profile)
        .set(payload)
        .where(eq(profile.userId, session.user.id));
    } else {
      await db.insert(profile).values({
        id: crypto.randomUUID(),
        userId: session.user.id,
        ...payload,
      });
    }

    revalidatePath("/profile");
    return { success: true };
  } catch (error) {
    console.error("updateMyProfile error:", error);
    return { success: false, error: "Failed to update profile" };
  }
}


// =====================================================
// RESUME UPLOAD (private)
// =====================================================

const RESUME_MAX_BYTES = 5 * 1024 * 1024;

/**
 * Resumes are PDFs only.
 *
 * The extension is checked as well as the MIME type, because browsers and
 * operating systems disagree often enough that trusting the MIME alone lets a
 * renamed script through.
 */
function resumeExtension(fileName: string, fileType: string): string | null {
  if (fileType === "application/pdf") return "pdf";
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return ext === "pdf" ? "pdf" : null;
}

/**
 * Step 1 of resume upload: a presigned PUT so the browser uploads straight to
 * R2 without the file passing through the server.
 *
 * Returns the object KEY, never a public URL. The key is what gets stored, and
 * what /api/resume/[userId] reads back through an authorization check.
 */
export async function getResumeUploadUrl(input: {
  fileName: string;
  fileType: string;
  fileSize: number;
}): Promise<
  | { success: true; uploadUrl: string; key: string }
  | { success: false; error: string }
> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const userId = session?.user?.id;
    if (!userId) return { success: false, error: "Not authenticated" };

    const ext = resumeExtension(input.fileName, input.fileType);
    if (!ext) {
      return { success: false, error: "Only PDF resumes are allowed." };
    }

    if (input.fileSize > RESUME_MAX_BYTES) {
      return {
        success: false,
        error: `File too large (max ${Math.floor(RESUME_MAX_BYTES / 1024 / 1024)}MB).`,
      };
    }

    const key = buildResumeKey(userId, input.fileName);
    const uploadUrl = await getUploadPresignedUrl(key, `application/${ext}`);

    return { success: true, uploadUrl, key };
  } catch (error) {
    console.error("getResumeUploadUrl error:", error);
    return { success: false, error: "Could not prepare the upload" };
  }
}

/**
 * Step 2: attach the uploaded resume to the signed-in user.
 *
 * The key prefix is rebuilt and checked here rather than trusting the client's
 * key, so a crafted key cannot attach somebody else's object to your profile.
 */
export async function saveResume(input: {
  key: string;
  fileName: string;
  size: number;
}): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const userId = session?.user?.id;
    if (!userId) return { success: false, error: "Not authenticated" };

    if (!isOwnResumeKey(input.key, userId)) {
      return { success: false, error: "Invalid resume key." };
    }

    /**
     * Confirm the bytes are really a PDF.
     *
     * The browser-reported MIME type and the extension are both supplied by the
     * client, so a renamed PNG passes both checks. The upload goes straight to
     * R2, which means this is the first moment the server can see the real
     * content — so the check happens here, before anything is written to the
     * database, and a rejected object is deleted rather than left behind.
     */
    if (!(await isActuallyPdf(input.key))) {
      void deleteR2Object(input.key).catch(() => {});
      return {
        success: false,
        error: "That file is not a valid PDF.",
      };
    }

    const [existing] = await db
      .select()
      .from(profile)
      .where(eq(profile.userId, userId))
      .limit(1);

    const safeName =
      input.fileName.replace(/[^a-zA-Z0-9._ -]/g, "_").slice(0, 120) ||
      "resume.pdf";

    const payload = {
      resumeKey: input.key,
      resumeFileName: safeName,
      resumeSize: input.size,
    };

    if (existing) {
      const previous = existing.resumeKey;
      await db
        .update(profile)
        .set({
          ...payload,
          // An uploaded resume satisfies the same check as a pasted link, so
          // the completion percentage has to move with it — otherwise the
          // reminder popup would keep nagging a fully complete profile.
          profileCompletion: calcCompletion({ ...existing, ...payload }),
        })
        .where(eq(profile.userId, userId));

      // Best-effort cleanup of the superseded file; never blocks the save.
      if (previous && previous !== input.key) {
        void deleteR2Object(previous).catch(() => {});
      }
    } else {
      await db.insert(profile).values({
        id: crypto.randomUUID(),
        userId,
        ...payload,
        profileCompletion: calcCompletion(payload),
      });
    }

    revalidatePath("/profile");
    return { success: true };
  } catch (error) {
    console.error("saveResume error:", error);
    return { success: false, error: "Could not save your resume" };
  }
}

/** Removes the stored resume and its object. */
export async function clearResume(): Promise<
  { success: true } | { success: false; error: string }
> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const userId = session?.user?.id;
    if (!userId) return { success: false, error: "Not authenticated" };

    const [existing] = await db
      .select()
      .from(profile)
      .where(eq(profile.userId, userId))
      .limit(1);

    const cleared = {
      resumeKey: null,
      resumeFileName: null,
      resumeSize: null,
    };

    if (existing) {
      await db
        .update(profile)
        .set({
          ...cleared,
          // Completion has to drop too, or the profile would still read 100%
          // with no resume attached.
          profileCompletion: calcCompletion({ ...existing, ...cleared }),
        })
        .where(eq(profile.userId, userId));
    }

    if (existing?.resumeKey) {
      void deleteR2Object(existing.resumeKey).catch(() => {});
    }

    revalidatePath("/profile");
    return { success: true };
  } catch (error) {
    console.error("clearResume error:", error);
    return { success: false, error: "Could not remove your resume" };
  }
}

// =====================================================
// R2 SETUP
// =====================================================
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  buildResumeKey,
  deleteR2Object,
  getUploadPresignedUrl,
  isActuallyPdf,
} from "@/lib/r2";
import { isOwnResumeKey } from "@/lib/auth-helpers";

const R2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

// =====================================================
// GENERATE PRESIGNED UPLOAD URL
// =====================================================
export async function getAvatarUploadUrl(
  fileType: string,
  fileSize: number
): Promise<{ uploadUrl: string; publicUrl: string } | { error: string }> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) return { error: "Not authenticated" };

    // validate
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(fileType)) {
      return { error: "Only JPG, PNG, or WebP allowed" };
    }
    if (fileSize > 5 * 1024 * 1024) {
      return { error: "File too large (max 5MB)" };
    }

    const ext = fileType.split("/")[1];
    const key = `avatars/${session.user.id}/${crypto.randomUUID()}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      ContentType: fileType,
    });

    const uploadUrl = await getSignedUrl(R2, command, { expiresIn: 300 }); // 5 min
    const publicUrl = `${process.env.R2_PUBLIC_URL}/${key}`;

    return { uploadUrl, publicUrl };
  } catch (error) {
    console.error("getAvatarUploadUrl error:", error);
    return { error: "Failed to generate upload URL" };
  }
}