import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { Metadata } from "next";
import ProfilePageClient from "./ProfilePageClient";
import { getMyProfile } from "./actions";

export const metadata: Metadata = {
  title: "Profile | InternBird",
  description: "Your professional profile",
};

export default async function ProfilePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");

  const profileData = await getMyProfile();

  if (!profileData) redirect("/login");

  return <ProfilePageClient initialData={profileData} />;
}