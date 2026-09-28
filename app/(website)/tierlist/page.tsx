import { Metadata } from "next";
import TierListPageClient from "./TierListPageClient";

export const metadata: Metadata = {
  title: "Tier List | InternBird",
  description: "See how teams rank across skill demands",
};

export default function TierListPage() {
  return <TierListPageClient />;
}