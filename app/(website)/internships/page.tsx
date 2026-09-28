import { Metadata } from "next";
import InternshipsPageClient from "./InternshipsPageClient";

export const metadata: Metadata = {
  title: "Internships | InternBird",
  description: "Browse all available internships across skill demands",
};

export default function InternshipsPage() {
  return <InternshipsPageClient />;
}