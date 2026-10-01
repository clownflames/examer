import type { Metadata } from "next";
import Script from "next/script";
import Navigation from "./Navigation";
import { AnnouncementBar, getActiveAnnouncements } from "./components/announcements";

export const metadata: Metadata = {
  title: "InternBird",
  description: "Find your next internship",
};

export default async function WebsiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {

  const announcements = await getActiveAnnouncements()
  return (
    <>
      {/* Main content with bottom padding so the nav doesn't overlap */}
      <AnnouncementBar announcements={announcements} />
      <main className="min-h-screen pb-24 md:pb-20">{children}</main>

      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="lazyOnload"
      />

      <Navigation />
    </>
  );
}
