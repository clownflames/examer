import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Navigation from "./Navigation";
import Script from "next/script";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "InternBird",
  description: "Find your next internship",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased bg-background text-foreground`}>
        {/* Main content with bottom padding so nav doesn't overlap */}
        <main className="min-h-screen pb-24 md:pb-20">
          {children}
        </main>

        <Script
          src="https://checkout.razorpay.com/v1/checkout.js"
          strategy="lazyOnload"
        />

        <Navigation />
      </body>
    </html>
  );
}