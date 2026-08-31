"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";
import { UTILIZATION_CHART_DATA } from "./dashboard-data";

function getBarColor(utilization: number): string {
  if (utilization >= 90) return "#BA1A1A";
  if (utilization >= 70) return "#B45309";
  return "#064E3B";
}

export function DepartmentUtilizationChart() {
  return (
    <div className="bg-card rounded-lg border border-border/50 p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-foreground font-headline mb-4">
        Department Utilization
      </h2>
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={UTILIZATION_CHART_DATA}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis
              dataKey="department"
              tick={{ fontSize: 11, fill: "#64748B" }}
              axisLine={{ stroke: "#E2E8F0" }}
              tickLine={false}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis
              tick={{ fontSize: 12, fill: "#64748B" }}
              axisLine={{ stroke: "#E2E8F0" }}
              tickLine={false}
              domain={[0, 100]}
              tickFormatter={(value: number) => `${value}%`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#FFFFFF",
                border: "1px solid #E2E8F0",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              formatter={(value) => [`${value}%`, "Utilization"]}
            />
            <Bar dataKey="utilization" radius={[4, 4, 0, 0]}>
              {UTILIZATION_CHART_DATA.map((entry, index) => (
                <Cell key={index} fill={getBarColor(entry.utilization)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
