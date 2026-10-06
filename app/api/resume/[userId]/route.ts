import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { profile } from "@/db/schema";
import { canAccessPrivateFile, getSessionUser, isOwnResumeKey } from "@/lib/auth-helpers";
import { getR2ObjectStream } from "@/lib/r2";

/**
 * Serves a student's uploaded resume.
 *
 * This route is the ONLY way to read a resume. The R2 object key is never put
 * in a URL or exposed to the client, so the only reachable URL is this one,
 * and this one checks ownership on every single request:
 *
 *   - owner        -> allowed
 *   - admin        -> allowed (they review applications)
 *   - anyone else  -> 404
 *   - signed out   -> 401
 *
 * A 404 rather than a 403 for other users, because a 403 would confirm that
 * the file exists.
 */

export const dynamic = "force-dynamic";

function notFound() {
  return new NextResponse("Not found", { status: 404 });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;

  const user = await getSessionUser();

  // One shared rule for all private files, so no route can ship a looser check.
  const verdict = canAccessPrivateFile(user, userId);

  if (!verdict.allowed) {
    return verdict.reason === "signed-out"
      ? new NextResponse("Unauthorized", { status: 401 })
      : notFound();
  }

  const [row] = await db
    .select({
      resumeKey: profile.resumeKey,
      resumeFileName: profile.resumeFileName,
    })
    .from(profile)
    .where(eq(profile.userId, userId))
    .limit(1);

  if (!row?.resumeKey) {
    return notFound();
  }

  // Defence in depth: the key must belong to the profile we just loaded, even
  // though saveResume already enforces this on write.
  if (!isOwnResumeKey(row.resumeKey, userId)) {
    return notFound();
  }

  try {
    const object = await getR2ObjectStream(row.resumeKey);

    const body = object.Body as ReadableStream | null;
    if (!body) return notFound();

    const fileName = row.resumeFileName || "resume.pdf";

    return new NextResponse(body as unknown as BodyInit, {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `inline; filename="${fileName}"`,
        "content-length": String(object.ContentLength ?? 0),
        // Never let a proxy or the browser cache somebody's resume.
        "cache-control": "private, no-store, max-age=0",
        "x-content-type-options": "nosniff",
        "content-security-policy": "default-src 'none'; sandbox",
      },
    });
  } catch (error) {
    console.error("[resume] read failed:", error);
    return notFound();
  }
}