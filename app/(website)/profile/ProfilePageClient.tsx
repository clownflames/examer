"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import {
  MapPin,
  Mail,
  Phone,
  GraduationCap,
  Globe,
  Pencil,
  Check,
  X,
  Briefcase,
  FolderGit2,
  Award,
  Languages as LanguagesIcon,
  Sparkles,
  Users,
  TrendingUp,
  ReceiptIndianRupee,
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react";
import { FaGithub as Github, FaLinkedin as  Linkedin, FaTwitter as Twitter } from "react-icons/fa";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { ProfileData } from "./actions";
import type { MyPayment } from "../actions";
import EditProfileDrawer from "./EditProfileDrawer";

// =====================================================
// Helpers
// =====================================================
function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function SectionHeading({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <h3 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase flex items-center gap-2 mb-4">
      {icon}
      {children}
    </h3>
  );
}

// =====================================================
// MAIN
// =====================================================
export default function ProfilePageClient({
  initialData,
  payments,
}: {
  initialData: ProfileData;
  payments: MyPayment[];
}) {
  const [data, setData] = useState(initialData);
  const [editOpen, setEditOpen] = useState(false);

  const paidTotal = payments
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + p.amount, 0);

  const hasAnyInfo =
    data.headline ||
    data.bio ||
    data.collegeName ||
    data.skills.length > 0;

  return (
    <div className="min-h-screen pb-24">
      {/* ============ COVER BANNER ============ */}
      <div className="relative h-40 md:h-56 bg-gradient-to-br from-primary/30 via-primary/10 to-purple-500/20 border-b">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.08),transparent_60%)]" />
      </div>

      <div className="max-w-5xl mx-auto px-4 md:px-8">
        {/* ============ AVATAR + NAME ============ */}
        <div className="relative -mt-16 md:-mt-20 mb-6">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div className="flex flex-col md:flex-row items-start md:items-end gap-4">
              <Avatar className="h-28 w-28 md:h-32 md:w-32 border-4 border-background shadow-lg">
                {data.userImage ? (
                  <AvatarImage src={data.userImage} alt={data.userName} />
                ) : null}
                <AvatarFallback className="text-2xl font-bold">
                  {getInitials(data.userName)}
                </AvatarFallback>
              </Avatar>

              <div className="pb-1">
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                  {data.userName}
                </h1>
                {data.headline ? (
                  <p className="text-sm text-muted-foreground mt-1">
                    {data.headline}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground mt-1 italic">
                    No headline yet
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-xs text-muted-foreground">
                  {data.collegeName && (
                    <span className="flex items-center gap-1.5">
                      <GraduationCap className="w-3.5 h-3.5" />
                      {data.collegeName}
                    </span>
                  )}
                  {(data.city || data.state) && (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" />
                      {[data.city, data.state].filter(Boolean).join(", ")}
                    </span>
                  )}
                  {data.userEmail && (
                    <span className="flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5" />
                      {data.userEmail}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button onClick={() => setEditOpen(true)}>
                <Pencil className="w-4 h-4" />
                Edit Profile
              </Button>
            </div>
          </div>
        </div>

        {/* ============ PROFILE COMPLETION ============ */}
        {data.profileCompletion < 100 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <Card className="border-primary/20 bg-primary/[0.03]">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <span className="text-sm font-semibold">
                      Complete your profile
                    </span>
                  </div>
                  <span className="text-sm font-bold text-primary">
                    {data.profileCompletion}%
                  </span>
                </div>
                <Progress value={data.profileCompletion} className="h-1.5" />
                <p className="text-xs text-muted-foreground mt-2">
                  A complete profile increases your match rate significantly.
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ============ STATS ============ */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatCard
            icon={<Users className="w-4 h-4" />}
            label="Teams"
            value={data.teamCount}
          />
          <StatCard
            icon={<TrendingUp className="w-4 h-4" />}
            label="Skills"
            value={data.skills.length}
          />
          <StatCard
            icon={<FolderGit2 className="w-4 h-4" />}
            label="Projects"
            value={data.projects.length}
          />
          <StatCard
            icon={<Award className="w-4 h-4" />}
            label="Achievements"
            value={data.achievements.length}
          />
        </div>

        {/* ============ CONTENT TABS ============ */}
        <Tabs defaultValue="about" className="w-full">
          <TabsList>
            <TabsTrigger value="about">About</TabsTrigger>
            <TabsTrigger value="education">Education</TabsTrigger>
            <TabsTrigger value="experience">Experience</TabsTrigger>
            <TabsTrigger value="projects">Projects</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
          </TabsList>

          {/* ABOUT */}
          <TabsContent value="about" className="mt-6 space-y-6">
            {/* Bio */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">About</CardTitle>
              </CardHeader>
              <CardContent>
                {data.bio ? (
                  <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line">
                    {data.bio}
                  </p>
                ) : (
                  <EmptyText text="No bio yet" />
                )}
              </CardContent>
            </Card>

            {/* Skills */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Skills</CardTitle>
              </CardHeader>
              <CardContent>
                {data.skills.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {data.skills.map((s) => (
                      <Badge key={s} variant="secondary">
                        {s}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <EmptyText text="No skills added" />
                )}
              </CardContent>
            </Card>

            {/* Languages */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <LanguagesIcon className="w-4 h-4" />
                  Languages
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.languages.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {data.languages.map((l) => (
                      <Badge key={l} variant="outline">
                        {l}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <EmptyText text="No languages added" />
                )}
              </CardContent>
            </Card>

            {/* Links */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Links</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {data.githubUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    render={
                      <a
                        href={data.githubUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Github className="w-4 h-4" />
                        GitHub
                      </a>
                    }
                  />
                )}
                {data.linkedinUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    render={
                      <a
                        href={data.linkedinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Linkedin className="w-4 h-4" />
                        LinkedIn
                      </a>
                    }
                  />
                )}
                {data.portfolioUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    render={
                      <a
                        href={data.portfolioUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Globe className="w-4 h-4" />
                        Portfolio
                      </a>
                    }
                  />
                )}
                {data.twitterUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    render={
                      <a
                        href={data.twitterUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Twitter className="w-4 h-4" />
                        Twitter
                      </a>
                    }
                  />
                )}
                {!data.githubUrl && !data.linkedinUrl && !data.portfolioUrl && !data.twitterUrl && (
                  <EmptyText text="No links added" />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* EDUCATION */}
          <TabsContent value="education" className="mt-6">
            <Card>
              <CardContent className="p-6">
                <SectionHeading icon={<GraduationCap className="w-4 h-4" />}>
                  Education
                </SectionHeading>
                {data.collegeName || data.degree ? (
                  <div className="space-y-4">
                    <InfoRow label="College" value={data.collegeName} />
                    <InfoRow label="University" value={data.universityName} />
                    <InfoRow label="Degree" value={data.degree} />
                    <InfoRow label="Branch" value={data.branch} />
                    <InfoRow label="Roll Number" value={data.rollNumber} />
                    <InfoRow
                      label="Graduation Year"
                      value={data.graduationYear?.toString()}
                    />
                    <InfoRow label="CGPA" value={data.cgpa} />
                  </div>
                ) : (
                  <EmptyText text="No education info added" />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* EXPERIENCE */}
          <TabsContent value="experience" className="mt-6">
            <Card>
              <CardContent className="p-6">
                <SectionHeading icon={<Briefcase className="w-4 h-4" />}>
                  Experience
                </SectionHeading>
                {data.experience.length > 0 ? (
                  <div className="space-y-4">
                    {data.experience.map((exp, i) => (
                      <div key={i}>
                        {i > 0 && <Separator className="mb-4" />}
                        <h4 className="text-sm font-semibold">{exp.role}</h4>
                        <p className="text-xs text-muted-foreground">
                          {exp.company} · {exp.duration}
                        </p>
                        {exp.description && (
                          <p className="text-sm mt-2 text-foreground/80">
                            {exp.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyText text="No experience added" />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* PROJECTS */}
          <TabsContent value="projects" className="mt-6">
            <Card>
              <CardContent className="p-6">
                <SectionHeading icon={<FolderGit2 className="w-4 h-4" />}>
                  Projects
                </SectionHeading>
                {data.projects.length > 0 ? (
                  <div className="space-y-4">
                    {data.projects.map((p, i) => (
                      <div key={i}>
                        {i > 0 && <Separator className="mb-4" />}
                        <h4 className="text-sm font-semibold">{p.name}</h4>
                        {p.description && (
                          <p className="text-sm mt-1 text-foreground/80">
                            {p.description}
                          </p>
                        )}
                        {p.link && (
                          <a
                            href={p.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline mt-1 inline-block"
                          >
                            View project →
                          </a>
                        )}
                        {p.techStack && p.techStack.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {p.techStack.map((t) => (
                              <Badge
                                key={t}
                                variant="secondary"
                                className="text-[10px]"
                              >
                                {t}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyText text="No projects added" />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* PAYMENTS */}
          <TabsContent value="payments" className="mt-6 space-y-4">
            <Card>
              <CardContent className="p-6 space-y-5">
                <SectionHeading icon={<ReceiptIndianRupee className="w-4 h-4" />}>
                  Payments
                </SectionHeading>

                {payments.length === 0 ? (
                  <EmptyText text="No payments yet — apply to an internship to get started." />
                ) : (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      <StatCard
                        icon={<ReceiptIndianRupee className="w-4 h-4" />}
                        label="Total paid"
                        value={paidTotal}
                        isCurrency
                      />
                      <StatCard
                        icon={<CheckCircle2 className="w-4 h-4" />}
                        label="Successful"
                        value={payments.filter((p) => p.status === "paid").length}
                      />
                      <StatCard
                        icon={<Briefcase className="w-4 h-4" />}
                        label="Internships"
                        value={
                          new Set(
                            payments
                              .filter((p) => p.status === "paid")
                              .map((p) => p.internshipId)
                          ).size
                        }
                      />
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      {payments.map((p) => (
                        <PaymentRow key={p.id} payment={p} />
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* ============ EDIT DRAWER ============ */}
      <EditProfileDrawer
        open={editOpen}
        onClose={() => setEditOpen(false)}
        initialData={data}
        onUpdated={(newData) => setData((prev) => ({ ...prev, ...newData }))}
      />
    </div>
  );
}

// =====================================================
// Small components
// =====================================================
function StatCard({
  icon,
  label,
  value,
  isCurrency,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  isCurrency?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-muted-foreground mb-2">{icon}</div>
        <div className="text-2xl font-bold">
          {isCurrency
            ? `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
            : value}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </CardContent>
    </Card>
  );
}

// =====================================================
// Payment row
// =====================================================
const PAYMENT_STATUS: Record<
  MyPayment["status"],
  { label: string; icon: React.ReactNode; className: string }
> = {
  paid: {
    label: "Paid",
    icon: <CheckCircle2 className="w-3 h-3" />,
    className:
      "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
  },
  pending: {
    label: "Pending",
    icon: <Clock className="w-3 h-3" />,
    className: "bg-amber-500/10 text-amber-500 border-amber-500/30",
  },
  failed: {
    label: "Failed",
    icon: <XCircle className="w-3 h-3" />,
    className: "bg-destructive/10 text-destructive border-destructive/30",
  },
};

function PaymentRow({ payment }: { payment: MyPayment }) {
  const status = PAYMENT_STATUS[payment.status] ?? PAYMENT_STATUS.failed;

  return (
    <div className="flex items-start gap-3 rounded-xl border p-3.5">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">
          {payment.internshipName}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {payment.demandName ?? "General"} ·{" "}
          {new Date(payment.createdAt).toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })}
        </p>
        {payment.status === "failed" && payment.failureReason && (
          <p className="text-[11px] text-muted-foreground/80 mt-1">
            {payment.failureReason}
          </p>
        )}
        {payment.razorpayPaymentId && (
          <p className="text-[10px] text-muted-foreground/70 mt-1 font-mono truncate">
            Ref: {payment.razorpayPaymentId}
          </p>
        )}
      </div>

      <div className="text-right shrink-0 space-y-1">
        <p className="text-sm font-bold tabular-nums">
          ₹{payment.amount.toLocaleString("en-IN")}
        </p>
        <Badge variant="outline" className={cn("text-[10px]", status.className)}>
          {status.icon}
          {status.label}
        </Badge>
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  if (!value) return null;
  return (
    <div className="grid grid-cols-3 gap-4 py-2 border-b last:border-b-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm col-span-2">{value}</span>
    </div>
  );
}

function EmptyText({ text }: { text: string }) {
  return (
    <p className="text-xs text-muted-foreground italic">{text}</p>
  );
}