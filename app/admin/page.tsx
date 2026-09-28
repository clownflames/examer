import Link from 'next/link'
import {
  ArrowRight,
  Briefcase,
  ClipboardList,
  FileText,
  Layers,
  UserCog,
  Users,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  getDashboardStats,
  getRegistrationsOverTime,
  getInternshipsByDemand,
  getExamCompletionStats,
  getTopInternships,
  getRecentRegistrations,
} from './dashboard-actions'
import {
  RegistrationsChart,
  InternshipsByDemandChart,
  ExamCompletionChart,
  TopInternshipsList,
} from './dashboard-charts'

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0) return 'U'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default async function AdminDashboardPage() {
  const [
    stats,
    registrationsOverTime,
    internshipsByDemand,
    examCompletion,
    topInternships,
    recentRegistrations,
  ] = await Promise.all([
    getDashboardStats(),
    getRegistrationsOverTime(30),
    getInternshipsByDemand(),
    getExamCompletionStats(),
    getTopInternships(5),
    getRecentRegistrations(6),
  ])

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            Dashboard
          </h2>
          <p className="text-muted-foreground text-sm">
            Overview of your workspace at a glance.
          </p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="Students"
          value={stats.totalStudents}
          icon={UserCog}
          href="/admin/users"
        />
        <StatCard
          label="Internships"
          value={stats.totalInternships}
          icon={Briefcase}
          href="/admin/internships"
        />
        <StatCard
          label="Registrations"
          value={stats.totalRegistrations}
          icon={ClipboardList}
          href="/admin/registrations"
        />
        <StatCard
          label="Exams"
          value={stats.totalExams}
          icon={FileText}
          href="/admin/exams"
        />
        <StatCard
          label="Teams"
          value={stats.totalTeams}
          icon={Users}
          href="/admin/teams"
        />
        <StatCard
          label="Demands"
          value={stats.totalDemands}
          icon={Layers}
          href="/admin/demands"
        />
      </div>

      {/* Charts row 1 */}
      <div className="grid gap-4 lg:grid-cols-3">
        <RegistrationsChart data={registrationsOverTime} />
        <ExamCompletionChart data={examCompletion} />
      </div>

      {/* Charts row 2 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <InternshipsByDemandChart data={internshipsByDemand} />
        <TopInternshipsList data={topInternships} />
      </div>

      {/* Recent registrations */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Recent Registrations</CardTitle>
            <CardDescription>
              The most recent students who signed up for internships.
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            render={<Link href="/admin/registrations" />}
          >
            View all
            <ArrowRight className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {recentRegistrations.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              No registrations yet.
            </p>
          ) : (
            recentRegistrations.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-3 rounded-lg border p-3"
              >
                <Avatar className="h-9 w-9">
                  {r.studentImage ? (
                    <AvatarImage src={r.studentImage} alt={r.studentName} />
                  ) : null}
                  <AvatarFallback className="text-xs">
                    {getInitials(r.studentName)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">
                    {r.studentName}
                  </span>
                  <span className="text-muted-foreground truncate text-xs">
                    {r.studentEmail}
                  </span>
                </div>
                <div className="hidden flex-col items-end text-right sm:flex">
                  <span className="text-muted-foreground text-xs">
                    Internship
                  </span>
                  <span className="truncate text-sm font-medium">
                    {r.internshipName}
                  </span>
                </div>
                <Badge variant="secondary" className="tabular-nums">
                  Score {r.gainScore}
                </Badge>
                <span className="text-muted-foreground hidden text-xs md:inline">
                  {formatDistanceToNow(new Date(r.createdAt), {
                    addSuffix: true,
                  })}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Stat card                                                                  */
/* -------------------------------------------------------------------------- */

function StatCard({
  label,
  value,
  icon: Icon,
  href,
}: {
  label: string
  value: number
  icon: React.ComponentType<{ className?: string }>
  href: string
}) {
  return (
    <Link href={href} className="group">
      <Card className="transition-colors group-hover:border-primary/50">
        <CardHeader className="flex-row items-center justify-between pb-2">
          <CardDescription className="text-xs">{label}</CardDescription>
          <Icon className="text-muted-foreground h-4 w-4" />
        </CardHeader>
        <CardContent>
          <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
        </CardContent>
      </Card>
    </Link>
  )
}