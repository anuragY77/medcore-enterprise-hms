"use client";

import { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Vital {
  id: string;
  bloodPressureSystolic: number | null;
  bloodPressureDiastolic: number | null;
  heartRate: number | null;
  temperature: number | null;
  recordedAt: string;
}

interface VitalsChartProps {
  patientId: string;
}

export function VitalsChart({ patientId }: VitalsChartProps) {
  const [vitals, setVitals] = useState<Vital[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchVitals() {
      try {
        const res = await fetch(`/api/patients/${patientId}/vitals`);
        if (res.ok) {
          const data = await res.json();
          setVitals(
            data.data.map((v: Vital) => ({
              ...v,
              time: new Date(v.recordedAt).toLocaleDateString(),
            }))
          );
        }
      } catch (error) {
        console.error("Failed to fetch vitals:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchVitals();
  }, [patientId]);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-slate-500">
          Loading vitals chart...
        </CardContent>
      </Card>
    );
  }

  if (vitals.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-slate-500">
          No vitals data to display.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Vitals Trend</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={vitals}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="time" tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "white",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Line
                type="monotone"
                dataKey="heartRate"
                stroke="#ec4899"
                strokeWidth={2}
                dot={{ r: 4 }}
                name="Heart Rate"
              />
              <Line
                type="monotone"
                dataKey="bloodPressureSystolic"
                stroke="#ef4444"
                strokeWidth={2}
                dot={{ r: 4 }}
                name="Systolic BP"
              />
              <Line
                type="monotone"
                dataKey="bloodPressureDiastolic"
                stroke="#f97316"
                strokeWidth={2}
                dot={{ r: 4 }}
                name="Diastolic BP"
              />
              <Line
                type="monotone"
                dataKey="temperature"
                stroke="#eab308"
                strokeWidth={2}
                dot={{ r: 4 }}
                name="Temperature"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
