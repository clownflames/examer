import { headers } from "next/headers";

import { auth } from "@/lib/auth";

/**
 * Shared authorization helpers.
 *
 * `requireOwnerOrAdmin` is the single gate for anything private (currently
 * resumes). Keeping it in one place means a new private feature cannot
 * accidentally ship its own, looser check.
 */

export type SessionUser = {
  id: string;
  role: string;
  name: string;
  email: string;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) return null;
    return {
      id: session.user.id,
      role: (session.user as { role?: string }).role ?? "user",
      name: session.user.name ?? "",
      email: session.user.email ?? "",
    };
  } catch {
    return null;
  }
}

export async function getSessionUserId(): Promise<string | null> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    return session?.user?.id ?? null;
  } catch {
    return null;
  }
}

export function isAdmin(user: { role?: string } | null): boolean {
  return user?.role === "admin";
}

/**
 * The single access rule for every private file in the app.
 *
 * Pure on purpose: it takes the viewer's identity as arguments rather than
 * reading the session itself, so the rule can be exercised directly in tests
 * and reused by any future private-file route without each one inventing its
 * own check.
 *
 * Admins can read because they review applications; a viewer who is neither the
 * owner nor an admin is told nothing exists (404) rather than that it is
 * forbidden (403), because a 403 would confirm the file is there.
 */
export function canAccessPrivateFile(
  viewer: { id: string; role?: string } | null,
  ownerId: string
): { allowed: true } | { allowed: false; reason: "signed-out" | "not-owner" } {
  if (!viewer) return { allowed: false, reason: "signed-out" };
  if (viewer.id === ownerId) return { allowed: true };
  if (isAdmin(viewer)) return { allowed: true };
  return { allowed: false, reason: "not-owner" };
}

/**
 * True when `key` is a resume object belonging to `userId`.
 *
 * Every write and every read re-checks this. A key is built server-side, but
 * `saveResume` receives one from the client, so without this check a crafted
 * key could attach (or read) somebody else's object.
 */
export function isOwnResumeKey(key: string | null | undefined, userId: string): boolean {
  if (!key) return false;
  return key.startsWith(`resumes/${userId}/`) && key.length > `resumes/${userId}/`.length;
}

/**
 * Throws unless the caller owns `ownerId` or is an admin.
 *
 * Kept for callers that prefer an exception over a return value.
 */
export async function requireOwnerOrAdmin(
  ownerId: string
): Promise<SessionUser> {
  const user = await getSessionUser();
  const verdict = canAccessPrivateFile(user, ownerId);

  if (!verdict.allowed) {
    throw new Response(verdict.reason === "signed-out" ? "Unauthorized" : "Not found", {
      status: verdict.reason === "signed-out" ? 401 : 404,
    });
  }

  return user as SessionUser;
}