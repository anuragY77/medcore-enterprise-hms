"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { ADMISSIONS_CHART_DATA } from "./dashboard-data";

export function PatientAdmissionsChart() {
  return (
    <div className="bg-card rounded-lg border border-border/50 p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-foreground font-headline mb-4">
        Patient Admissions (7 Days)
      </h2>
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={ADMISSIONS_CHART_DATA}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis
              dataKey="day"
              tick={{ fontSize: 12, fill: "#64748B" }}
              axisLine={{ stroke: "#E2E8F0" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 12, fill: "#64748B" }}
              axisLine={{ stroke: "#E2E8F0" }}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#FFFFFF",
                border: "1px solid #E2E8F0",
                borderRadius: "8px",
                fontSize: "12px",
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: "12px", color: "#64748B" }}
            />
            <Line
              type="monotone"
              dataKey="admissions"
              stroke="#064E3B"
              strokeWidth={2}
              dot={{ fill: "#064E3B", strokeWidth: 0 }}
              activeDot={{ r: 6, fill: "#064E3B" }}
              name="Admissions"
            />
            <Line
              type="monotone"
              dataKey="discharges"
              stroke="#64748B"
              strokeWidth={2}
              dot={{ fill: "#64748B", strokeWidth: 0 }}
              activeDot={{ r: 6, fill: "#64748B" }}
              name="Discharges"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
