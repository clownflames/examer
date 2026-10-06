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
  { label: "Add your resume link", isDone: (p) => !!p.resumeUrl },
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
// R2 SETUP
// =====================================================
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

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