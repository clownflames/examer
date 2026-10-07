import type { Metadata } from "next";
import Script from "next/script";
import Navigation from "./Navigation";
import SmoothScroll from "@/components/smooth-scroll";
import { AnnouncementBar, getActiveAnnouncements } from "./components/announcements";
import ProfileCompletionReminder from "./components/profile-completion-reminder";
import PaymentReminder from "./components/payment-reminder";

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
    <SmoothScroll>
      {/*
        Desktop pe nav bar fixed TOP pe hai (3.5rem / h-14) — isliye content ko
        niche push karna padta hai. Mobile pe nav bottom pe fixed hai, sirf
        bottom padding chahiye.
      */}
      <div className="md:pt-14">
        <AnnouncementBar announcements={announcements} />
        <main className="min-h-screen pb-24 md:pb-16">{children}</main>
      </div>

      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="lazyOnload"
      />

      {/* Nudges signed-in students whose profile is still incomplete.
          Self-checks on mount so the layout stays statically renderable. */}
      <ProfileCompletionReminder />

      {/* Same deal for money: a registered-but-unpaid application is going
          nowhere until the payment lands, so it keeps re-asking every 30s. */}
      <PaymentReminder />

      <Navigation />
    </SmoothScroll>
  );
}
