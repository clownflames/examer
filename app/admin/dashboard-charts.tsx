'use client'

import * as React from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from 'recharts'
import { TrendingUp, Users, FileText, Briefcase } from 'lucide-react'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Badge } from '@/components/ui/badge'
import type {
  RegistrationsOverTimePoint,
  InternshipsByDemandPoint,
  ExamCompletionPoint,
} from './dashboard-actions'

/* -------------------------------------------------------------------------- */
/*  Registrations over time — area chart                                       */
/* -------------------------------------------------------------------------- */

const registrationsConfig = {
  registrations: {
    label: 'Registrations',
    color: 'var(--chart-1)',
  },
} satisfies ChartConfig

export function RegistrationsChart({
  data,
}: {
  data: RegistrationsOverTimePoint[]
}) {
  return (
    <Card className="col-span-1 lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Registrations (Last 30 Days)
        </CardTitle>
        <CardDescription>
          Daily sign-ups for internships across the platform.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={registrationsConfig}
          className="h-[260px] w-full"
        >
          <AreaChart data={data} margin={{ left: 0, right: 12 }}>
            <defs>
              <linearGradient id="fillRegistrations" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-registrations)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-registrations)"
                  stopOpacity={0.05}
                />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              interval="preserveStartEnd"
              minTickGap={24}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={32}
              allowDecimals={false}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator="line" />}
            />
            <Area
              type="monotone"
              dataKey="registrations"
              stroke="var(--color-registrations)"
              strokeWidth={2}
              fill="url(#fillRegistrations)"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

/* -------------------------------------------------------------------------- */
/*  Internships by demand — bar chart                                          */
/* -------------------------------------------------------------------------- */

const demandConfig = {
  internships: {
    label: 'Internships',
    color: 'var(--chart-2)',
  },
} satisfies ChartConfig

export function InternshipsByDemandChart({
  data,
}: {
  data: InternshipsByDemandPoint[]
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Briefcase className="h-4 w-4" />
          Internships by Demand
        </CardTitle>
        <CardDescription>
          Distribution of internships across demand categories.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <EmptyState label="No data yet" />
        ) : (
          <ChartContainer config={demandConfig} className="h-[260px] w-full">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ left: 0, right: 12 }}
            >
              <CartesianGrid horizontal={false} strokeDasharray="3 3" />
              <XAxis type="number" hide allowDecimals={false} />
              <YAxis
                dataKey="demand"
                type="category"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                width={90}
              />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent indicator="line" />}
              />
              <Bar
                dataKey="internships"
                fill="var(--color-internships)"
                radius={[0, 4, 4, 0]}
                maxBarSize={28}
              />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}

/* -------------------------------------------------------------------------- */
/*  Exam completion — donut chart                                              */
/* -------------------------------------------------------------------------- */

const examConfig = {
  count: { label: 'Students' },
  Completed: { label: 'Completed', color: 'var(--chart-2)' },
  'Not Started': { label: 'Not Started', color: 'var(--chart-5)' },
} satisfies ChartConfig

export function ExamCompletionChart({
  data,
}: {
  data: ExamCompletionPoint[]
}) {
  const total = data.reduce((sum, d) => sum + d.count, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Exam Activity
        </CardTitle>
        <CardDescription>
          Students who have attempted at least one exam.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <EmptyState label="No exam activity yet" />
        ) : (
          <ChartContainer config={examConfig} className="mx-auto h-[220px] w-full">
            <PieChart>
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent hideLabel />}
              />
              <Pie
                data={data}
                dataKey="count"
                nameKey="status"
                innerRadius={50}
                outerRadius={80}
                strokeWidth={2}
              >
                {data.map((entry) => (
                  <Cell key={entry.status} fill={entry.fill} />
                ))}
              </Pie>
              <ChartLegend
                content={<ChartLegendContent nameKey="status" />}
                className="-translate-y-2 flex-wrap gap-2"
              />
            </PieChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}

/* -------------------------------------------------------------------------- */
/*  Top internships — mini bar list                                            */
/* -------------------------------------------------------------------------- */

export function TopInternshipsList({
  data,
}: {
  data: { id: string; name: string; registrations: number; teams: number }[]
}) {
  const max = Math.max(1, ...data.map((d) => d.registrations))
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          Top Internships
        </CardTitle>
        <CardDescription>By number of registrations.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {data.length === 0 ? (
          <EmptyState label="No internships yet" />
        ) : (
          data.map((i) => (
            <div key={i.id} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="truncate font-medium">{i.name}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="tabular-nums">
                    {i.registrations}
                  </Badge>
                  <Badge variant="outline" className="tabular-nums">
                    {i.teams} teams
                  </Badge>
                </div>
              </div>
              <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                <div
                  className="bg-primary h-full rounded-full transition-all"
                  style={{
                    width: `${(i.registrations / max) * 100}%`,
                  }}
                />
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}

/* -------------------------------------------------------------------------- */
/*  Empty state                                                                */
/* -------------------------------------------------------------------------- */

function EmptyState({ label }: { label: string }) {
  return (
    <div className="text-muted-foreground flex h-[220px] items-center justify-center text-sm">
      {label}
    </div>
  )
}