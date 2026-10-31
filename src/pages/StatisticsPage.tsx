import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { DatePicker } from "../components/molecules/DatePicker";
import { FormField } from "../components/molecules/FormField";
import { PageHeader } from "../components/molecules/PageHeader";
import { formatChf } from "../lib/money/change";
import { useRevenueByArticle, useRevenueByDay, useRevenueByProductGroup } from "../hooks/useStatistics";
import { useTheme } from "../hooks/useTheme";

// Each mode validated against its own card surface via the dataviz skill's
// palette validator (light: #ffffff, dark: #1b1b1b) - not an automatic flip.
const CHART_PALETTE = {
  light: { series: "#e5097f", grid: "#e4dfe4", axis: "#70656f" },
  dark: { series: "#cd59cb", grid: "#383438", axis: "#a29ca2" },
} as const;

const tooltipStyles = {
  contentStyle: {
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "var(--popover)",
    color: "var(--popover-foreground)",
  },
  itemStyle: { color: "var(--popover-foreground)" },
};

function isoDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function StatisticsPage() {
  const [from, setFrom] = useState(isoDaysAgo(30));
  const [to, setTo] = useState(todayIso());
  const { resolvedTheme } = useTheme();
  const palette = CHART_PALETTE[resolvedTheme];
  const tickStyle = { fill: palette.axis, fontSize: 12 };

  const byDay = useRevenueByDay(from, to);
  const byProductGroup = useRevenueByProductGroup(from, to);
  const byArticle = useRevenueByArticle(from, to);

  const dayData = (byDay.data ?? []).map((d) => ({ day: d.day, chf: d.totalCents / 100 }));
  const groupData = (byProductGroup.data ?? []).map((g) => ({
    name: g.productGroupName,
    chf: g.totalCents / 100,
  }));
  const articleData = (byArticle.data ?? []).map((a) => ({
    name: a.articleName,
    chf: a.totalCents / 100,
  }));

  return (
    <section>
      <PageHeader title="Statistik" />

      <div className="stats-filters">
        <FormField label="Von" htmlFor="stats-from">
          <DatePicker id="stats-from" value={from} onValueChange={setFrom} />
        </FormField>
        <FormField label="Bis" htmlFor="stats-to">
          <DatePicker id="stats-to" value={to} onValueChange={setTo} />
        </FormField>
      </div>

      <div className="stats-charts">
        <div className="stats-chart-card">
          <h2>Umsatz über Zeit</h2>
          {dayData.length === 0 ? (
            <p className="muted">Keine Verkäufe im gewählten Zeitraum.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={dayData}>
                <defs>
                  <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={palette.series} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={palette.series} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} vertical={false} />
                <XAxis dataKey="day" tick={tickStyle} axisLine={{ stroke: palette.grid }} tickLine={false} />
                <YAxis
                  tickFormatter={(v: number) => formatChf(v * 100)}
                  width={70}
                  tick={tickStyle}
                  axisLine={{ stroke: palette.grid }}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(v: number) => `${formatChf(v * 100)} CHF`}
                  {...tooltipStyles}
                />
                <Area
                  type="monotone"
                  dataKey="chf"
                  name="Umsatz (CHF)"
                  stroke={palette.series}
                  strokeWidth={2.5}
                  fill="url(#revenueFill)"
                  dot={{ r: 3, fill: palette.series, strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="stats-chart-card">
          <h2>Umsatz nach Warengruppe</h2>
          {groupData.length === 0 ? (
            <p className="muted">Keine Verkäufe im gewählten Zeitraum.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={groupData}>
                <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} vertical={false} />
                <XAxis dataKey="name" tick={tickStyle} axisLine={{ stroke: palette.grid }} tickLine={false} />
                <YAxis
                  tickFormatter={(v: number) => formatChf(v * 100)}
                  width={70}
                  tick={tickStyle}
                  axisLine={{ stroke: palette.grid }}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(v: number) => `${formatChf(v * 100)} CHF`}
                  {...tooltipStyles}
                  cursor={{ fill: "var(--muted)" }}
                />
                <Bar dataKey="chf" name="Umsatz (CHF)" fill={palette.series} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="stats-chart-card">
          <h2>Umsatz nach Artikel (Top 15)</h2>
          {articleData.length === 0 ? (
            <p className="muted">Keine Verkäufe im gewählten Zeitraum.</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(280, articleData.length * 28)}>
              <BarChart data={articleData} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} horizontal={false} />
                <XAxis
                  type="number"
                  tickFormatter={(v: number) => formatChf(v * 100)}
                  tick={tickStyle}
                  axisLine={{ stroke: palette.grid }}
                  tickLine={false}
                />
                <YAxis type="category" dataKey="name" width={160} tick={tickStyle} axisLine={{ stroke: palette.grid }} tickLine={false} />
                <Tooltip
                  formatter={(v: number) => `${formatChf(v * 100)} CHF`}
                  {...tooltipStyles}
                  cursor={{ fill: "var(--muted)" }}
                />
                <Bar dataKey="chf" name="Umsatz (CHF)" fill={palette.series} radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </section>
  );
}
