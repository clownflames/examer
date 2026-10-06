import { Metadata } from "next";
import TierListPageClient from "./TierListPageClient";

export const metadata: Metadata = {
  title: "Tier List | InternBird",
  description:
    "Every student ranked by their total score across all teams and exams",
};

export default function TierListPage() {
  return <TierListPageClient />;
}