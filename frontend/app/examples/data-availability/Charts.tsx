"use client";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import { Activity, Radio, TrendingUp } from "lucide-react";
import type { MissionSlice, ModeSlice, Palette, StatusSlice } from "./mock";
import { statusColor } from "./mock";
import s from "./styles.module.css";

// The three donuts, split out of page.tsx so the page can pull them in with
// next/dynamic({ ssr: false }). ResponsiveContainer measures its parent box, which the server has
// no width for — rendering it client-side only keeps the markup React sends and the markup React
// hydrates identical, which is the hydration-mismatch warning the brief asked us to avoid.

type Slice = { name: string; value: number; color: string; detail: string };

function DonutCard({
  title,
  icon,
  slices,
  palette,
}: {
  title: string;
  icon: React.ReactNode;
  slices: Slice[];
  palette: Palette;
}) {
  const empty = slices.length === 0 || slices.every((x) => x.value === 0);
  return (
    <div className={s.card}>
      <div className={s.cardHead}>
        {icon}
        <span>{title}</span>
      </div>
      {empty ? (
        <div className={s.chartEmpty}>No datatakes in the current filter window.</div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="name"
              innerRadius={48}
              outerRadius={72}
              paddingAngle={3}
              strokeWidth={0}
              isAnimationActive={false}
            >
              {slices.map((slice) => (
                <Cell key={slice.name} fill={slice.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: palette.panel,
                border: `1px solid ${palette.line}`,
                borderRadius: 8,
                fontSize: 12,
                color: palette.text,
              }}
              itemStyle={{ color: palette.text }}
              formatter={(value, _name, item) => {
                const slice = (item as { payload?: Slice }).payload;
                return [`${value} datatakes · ${slice?.detail ?? ""}`, slice?.name ?? ""];
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={8} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export default function DataAvailabilityCharts({
  missions,
  statuses,
  modes,
  palette,
}: {
  missions: MissionSlice[];
  statuses: StatusSlice[];
  modes: ModeSlice[];
  palette: Palette;
}) {
  const missionSlices: Slice[] = missions.map((m, i) => ({
    name: m.mission,
    value: m.count,
    color: palette.mission[i % palette.mission.length],
    detail: `${m.avg}% avg completeness`,
  }));

  const statusSlices: Slice[] = statuses.map((x) => ({
    name: x.status,
    value: x.count,
    color: statusColor(x.status, palette),
    detail: `${x.pct}%`,
  }));

  const modeSlices: Slice[] = modes.map((x) => ({
    name: x.mode,
    value: x.count,
    color: palette.mode[x.mode] ?? palette.accent,
    detail: `${x.pct}%`,
  }));

  return (
    <div className={s.grid3}>
      <DonutCard
        title="Datatake share by mission"
        icon={<TrendingUp size={13} />}
        slices={missionSlices}
        palette={palette}
      />
      <DonutCard
        title="Acquisition status breakdown"
        icon={<Activity size={13} />}
        slices={statusSlices}
        palette={palette}
      />
      <DonutCard
        title="Active sensor mode distribution"
        icon={<Radio size={13} />}
        slices={modeSlices}
        palette={palette}
      />
    </div>
  );
}
