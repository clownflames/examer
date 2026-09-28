import type { Metadata } from "next";
import Script from "next/script";
import Navigation from "./Navigation";

export const metadata: Metadata = {
  title: "InternBird",
  description: "Find your next internship",
};

export default function WebsiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* Main content with bottom padding so the nav doesn't overlap */}
      <main className="min-h-screen pb-24 md:pb-20">{children}</main>

      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="lazyOnload"
      />

      <Navigation />
    </>
  );
}
