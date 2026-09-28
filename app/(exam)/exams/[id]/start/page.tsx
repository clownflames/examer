import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getExamForAttempt } from "../../actions";
import ExamRunner from "./ExamRunner";

export const metadata: Metadata = {
  title: "Exam | InternBird",
  description: "Complete your exam",
};

export default async function ExamStartPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");

  // getExamForAttempt enforces the paid-registration gate and strips the
  // answer key, so a direct URL hit cannot be used to cheat.
  const exam = await getExamForAttempt(id);
  if (!exam) redirect("/internships");

  return <ExamRunner exam={exam} />;
}
