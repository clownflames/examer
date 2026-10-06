import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";

/**
 * Where a completed Google sign-in lands.
 *
 * Both the login and register pages send Google here. It exists because the
 * correct destination depends on who just signed in: an admin belongs on the
 * dashboard, everyone else on the public site. Deciding that on the client would
 * mean shipping the role to the browser before the session is read, and a
 * client-side redirect would briefly render the wrong page.
 *
 * The session cookie is already set by the time this runs, so the role can be
 * read on the server and the user sent straight to the right place.
 */

export const dynamic = "force-dynamic";

export default async function AuthRedirectPage() {
  let role: string | undefined;

  try {
    const session = await auth.api.getSession({ headers: await headers() });
    role = (session?.user as { role?: string } | undefined)?.role;
  } catch {
    // No usable session — treat it as a normal visitor rather than crashing.
    role = undefined;
  }

  redirect(role === "admin" ? "/admin" : "/");
}