import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import InboxPageClient from "./InboxPageClient";
import { getUserTeams } from "./actions";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Inbox | InternBird",
  description: "Chat with your team",
};

export default async function InboxPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect("/login");
  }

  const teams = await getUserTeams();

  return (
    <InboxPageClient
      teams={teams}
      currentUser={{
        id: session.user.id,
        name: session.user.name ?? "",
        email: session.user.email ?? "",
        image: session.user.image ?? null,
        role: (session.user as any).role ?? "user",
      }}
    />
  );
}