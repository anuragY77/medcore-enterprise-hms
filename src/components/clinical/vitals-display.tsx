"use client";

import { useState, useEffect } from "react";
import { Activity, Thermometer, Heart, Wind, Droplets, Scale, Ruler } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Vital {
  id: string;
  bloodPressureSystolic: number | null;
  bloodPressureDiastolic: number | null;
  heartRate: number | null;
  temperature: number | null;
  respiratoryRate: number | null;
  oxygenSaturation: number | null;
  weight: number | null;
  height: number | null;
  recordedBy: string;
  recordedAt: string;
}

interface VitalsDisplayProps {
  patientId: string;
}

export function VitalsDisplay({ patientId }: VitalsDisplayProps) {
  const [vital, setVital] = useState<Vital | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchVitals() {
      try {
        const res = await fetch(`/api/patients/${patientId}/vitals?latest=true`);
        if (res.ok) {
          const data = await res.json();
          setVital(data.data);
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
          Loading vitals...
        </CardContent>
      </Card>
    );
  }

  if (!vital) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-slate-500">
          No vitals recorded yet.
        </CardContent>
      </Card>
    );
  }

  const items = [
    {
      icon: Activity,
      label: "Blood Pressure",
      value:
        vital.bloodPressureSystolic && vital.bloodPressureDiastolic
          ? `${vital.bloodPressureSystolic}/${vital.bloodPressureDiastolic} mmHg`
          : "—",
      color: "text-red-600",
    },
    {
      icon: Heart,
      label: "Heart Rate",
      value: vital.heartRate ? `${vital.heartRate} bpm` : "—",
      color: "text-pink-600",
    },
    {
      icon: Thermometer,
      label: "Temperature",
      value: vital.temperature ? `${vital.temperature}°C` : "—",
      color: "text-amber-600",
    },
    {
      icon: Wind,
      label: "Respiratory Rate",
      value: vital.respiratoryRate ? `${vital.respiratoryRate}/min` : "—",
      color: "text-blue-600",
    },
    {
      icon: Droplets,
      label: "SpO2",
      value: vital.oxygenSaturation ? `${vital.oxygenSaturation}%` : "—",
      color: "text-cyan-600",
    },
    {
      icon: Scale,
      label: "Weight",
      value: vital.weight ? `${vital.weight} kg` : "—",
      color: "text-emerald-600",
    },
    {
      icon: Ruler,
      label: "Height",
      value: vital.height ? `${vital.height} cm` : "—",
      color: "text-violet-600",
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Latest Vitals</CardTitle>
          <span className="text-xs text-slate-500">
            {new Date(vital.recordedAt).toLocaleString()}
          </span>
        </div>
        <p className="text-xs text-slate-500">Recorded by: {vital.recordedBy}</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {items.map((item) => (
            <div key={item.label} className="text-center">
              <item.icon className={`mx-auto h-5 w-5 ${item.color}`} />
              <p className="mt-1 text-xs text-slate-500">{item.label}</p>
              <p className="text-sm font-medium text-slate-800">{item.value}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
