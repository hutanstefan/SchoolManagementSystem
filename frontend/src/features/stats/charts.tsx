import type { ReactNode } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from '@/components/ui/chart'
import { formatAverage } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { GradeCount, WeekActivity } from './api'
import { countTicks, PASSING_GRADE } from './chart-utils'

const PASS = 'var(--chart-pass)'
const FAIL = 'var(--chart-fail)'

const config = {
  value: { label: 'Value', color: PASS },
} satisfies ChartConfig

/** "Oct 19" */
function shortDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  })
}

/** The small box shown when hovering a bar or a point. */
function Tip({
  active,
  title,
  children,
}: {
  active?: boolean
  title: ReactNode
  children: ReactNode
}) {
  if (!active) return null
  return (
    <div className="bg-popover text-popover-foreground shadow-lifted rounded-lg border px-3 py-2 text-xs">
      <p className="font-medium">{title}</p>
      <p className="text-muted-foreground mt-0.5 tabular-nums">{children}</p>
    </div>
  )
}

interface TooltipArgs<T> {
  active?: boolean
  payload?: readonly { payload?: T }[]
}

function tooltip<T>(render: (row: T) => { title: ReactNode; body: ReactNode }) {
  return function ChartTip({ active, payload }: TooltipArgs<T>) {
    const row = payload?.[0]?.payload
    if (!active || !row) return null
    const { title, body } = render(row)
    return (
      <Tip active title={title}>
        {body}
      </Tip>
    )
  }
}

/** Two small swatches explaining the bar colours. */
export function PassFailLegend({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'text-muted-foreground flex items-center gap-4 text-xs',
        className,
      )}
    >
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-[3px]" style={{ background: PASS }} />
        Passing
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-[3px]" style={{ background: FAIL }} />
        Under {PASSING_GRADE}
      </span>
    </div>
  )
}

/** A visually hidden table with the same figures, for screen readers. */
function DataTableForScreenReaders({
  caption,
  headers,
  rows,
}: {
  caption: string
  headers: [string, string]
  rows: [string, string][]
}) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th>{headers[0]}</th>
          <th>{headers[1]}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([a, b]) => (
          <tr key={a}>
            <td>{a}</td>
            <td>{b}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

const plural = (n: number, word: string) =>
  `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`

/** How many grades of each value (1 to 10) were given. */
export function GradeDistributionChart({
  data,
  className,
}: {
  data: GradeCount[]
  className?: string
}) {
  const total = data.reduce((sum, d) => sum + d.count, 0)
  const yTicks = countTicks(Math.max(...data.map((d) => d.count)))
  return (
    <>
      <ChartContainer
        config={config}
        className={cn('aspect-auto h-56 w-full', className)}
        aria-hidden
      >
        <BarChart data={data} margin={{ top: 8, right: 4, left: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="value"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            ticks={yTicks}
            domain={[0, yTicks.at(-1)!]}
            width={36}
          />
          <ChartTooltip
            cursor={{ fill: 'var(--muted)', opacity: 0.6 }}
            content={tooltip<GradeCount>((d) => ({
              title: `Grade ${d.value}`,
              body: `${plural(d.count, 'grade')} · ${
                total ? Math.round((d.count / total) * 100) : 0
              }%`,
            }))}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={36}>
            {data.map((d) => (
              <Cell
                key={d.value}
                fill={d.value < PASSING_GRADE ? FAIL : PASS}
              />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
      <DataTableForScreenReaders
        caption="Grades by value"
        headers={['Grade', 'Count']}
        rows={data.map((d) => [String(d.value), String(d.count)])}
      />
    </>
  )
}

/** Grades given per week (from the first week with grades). */
export function ActivityChart({
  data: weeks,
  className,
}: {
  data: WeekActivity[]
  className?: string
}) {
  const first = weeks.findIndex((w) => w.count > 0)
  const data = first > 0 ? weeks.slice(first) : weeks
  const yTicks = countTicks(Math.max(...data.map((d) => d.count)))
  return (
    <>
      <ChartContainer
        config={config}
        className={cn('aspect-auto h-56 w-full', className)}
        aria-hidden
      >
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0 }}>
          <defs>
            <linearGradient id="activity-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={PASS} stopOpacity={0.35} />
              <stop offset="100%" stopColor={PASS} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="weekStart"
            tickFormatter={shortDate}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={16}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            ticks={yTicks}
            domain={[0, yTicks.at(-1)!]}
            width={36}
          />
          <ChartTooltip
            cursor={{ stroke: 'var(--border)' }}
            content={tooltip<WeekActivity>((d) => ({
              title: `Week of ${shortDate(d.weekStart)}`,
              body: plural(d.count, 'grade'),
            }))}
          />
          <Area
            dataKey="count"
            type="monotone"
            stroke={PASS}
            strokeWidth={2}
            fill="url(#activity-fill)"
            activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--card)' }}
          />
        </AreaChart>
      </ChartContainer>
      <DataTableForScreenReaders
        caption="Grades given per week"
        headers={['Week of', 'Grades']}
        rows={data.map((d) => [shortDate(d.weekStart), String(d.count)])}
      />
    </>
  )
}

/** A y-axis label on one line (recharts wraps long labels otherwise). */
function SingleLineTick({
  x,
  y,
  payload,
}: {
  x?: number | string
  y?: number | string
  payload?: { value?: unknown }
}) {
  return (
    <text
      x={Number(x) - 6}
      y={y}
      dy={4}
      textAnchor="end"
      className="fill-muted-foreground text-xs"
    >
      {String(payload?.value ?? '')}
    </text>
  )
}

export interface AverageRow {
  /** Unique key, e.g. the class id. */
  key: string
  label: string
  /** Tooltip title, when longer than the label. */
  title?: string
  average: number | null
  /** Extra line in the tooltip. */
  detail?: string
  /** Overrides "average under 5" (e.g. a 4.50 average rounds up and passes). */
  failing?: boolean
}

/**
 * Averages as horizontal bars on a 0-10 scale, with the passing line at 5.
 * Bars under 5 are red. Rows without an average yet are left out.
 */
export function AveragesChart({
  rows,
  caption,
  minRows = 0,
  className,
}: {
  rows: AverageRow[]
  caption: string
  /** Makes the chart as tall as one with this many rows (to line up cards). */
  minRows?: number
  className?: string
}) {
  const data = rows.filter((r) => r.average !== null)
  const labelWidth = Math.min(
    190,
    Math.max(36, ...data.map((r) => r.label.length * 7.2 + 14)),
  )
  return (
    <>
      <ChartContainer
        config={config}
        className={cn('aspect-auto w-full', className)}
        style={{ height: Math.max(data.length, minRows, 2) * 34 + 40 }}
        aria-hidden
      >
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 40, left: 0, bottom: 4 }}
        >
          <CartesianGrid horizontal={false} strokeDasharray="3 3" />
          <XAxis
            type="number"
            domain={[0, 10]}
            ticks={[0, 2, 4, 6, 8, 10]}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            type="category"
            dataKey="label"
            tickLine={false}
            axisLine={false}
            width={labelWidth}
            tick={SingleLineTick}
          />
          <ChartTooltip
            cursor={{ fill: 'var(--muted)', opacity: 0.6 }}
            content={tooltip<AverageRow>((r) => ({
              title: r.title ?? r.label,
              body: (
                <>
                  Average {formatAverage(r.average)}
                  {r.detail && <span className="block">{r.detail}</span>}
                </>
              ),
            }))}
          />
          <ReferenceLine
            x={PASSING_GRADE}
            stroke={FAIL}
            strokeDasharray="4 4"
            strokeOpacity={0.7}
          />
          <Bar
            dataKey="average"
            radius={[0, 4, 4, 0]}
            barSize={18}
            label={{
              position: 'right',
              className: 'fill-foreground text-xs font-medium tabular-nums',
              formatter: (value: unknown) =>
                typeof value === 'number' ? formatAverage(value) : '',
            }}
          >
            {data.map((r) => (
              <Cell
                key={r.key}
                fill={(r.failing ?? r.average! < PASSING_GRADE) ? FAIL : PASS}
              />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
      <DataTableForScreenReaders
        caption={caption}
        headers={['Name', 'Average']}
        rows={data.map((r) => [r.label, formatAverage(r.average)])}
      />
    </>
  )
}

export interface TrendPoint {
  date: string
  average: number
}

/** A running average over time (one point per date with grades). */
export function AverageTrendChart({
  data,
  className,
}: {
  data: TrendPoint[]
  className?: string
}) {
  const values = data.map((d) => d.average)
  const low = Math.max(1, Math.floor(Math.min(...values) - 0.5))
  const high = Math.min(10, Math.ceil(Math.max(...values) + 0.5))
  return (
    <>
      <ChartContainer
        config={config}
        className={cn('aspect-auto h-56 w-full', className)}
        aria-hidden
      >
        <LineChart data={data} margin={{ top: 8, right: 12, left: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tickFormatter={shortDate}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={24}
          />
          <YAxis
            domain={[low, high]}
            tickLine={false}
            axisLine={false}
            width={36}
            allowDecimals={false}
          />
          <ChartTooltip
            cursor={{ stroke: 'var(--border)' }}
            content={tooltip<TrendPoint>((d) => ({
              title: shortDate(d.date),
              body: `Average so far ${formatAverage(d.average)}`,
            }))}
          />
          {low < PASSING_GRADE && (
            <ReferenceLine
              y={PASSING_GRADE}
              stroke={FAIL}
              strokeDasharray="4 4"
              strokeOpacity={0.7}
            />
          )}
          <Line
            dataKey="average"
            type="monotone"
            stroke={PASS}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--card)' }}
          />
        </LineChart>
      </ChartContainer>
      <DataTableForScreenReaders
        caption="Average of all grades over time"
        headers={['Date', 'Average']}
        rows={data.map((d) => [shortDate(d.date), formatAverage(d.average)])}
      />
    </>
  )
}
