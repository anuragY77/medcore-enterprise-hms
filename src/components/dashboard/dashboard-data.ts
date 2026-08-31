import { Users, BedDouble, CalendarDays, Activity } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface StatCardData {
  label: string;
  value: string;
  change: string;
  icon: LucideIcon;
  color: string;
}

export interface OperationMetric {
  label: string;
  value: string;
  description: string;
  color: string;
}

export interface DepartmentData {
  name: string;
  bedsOccupied: number;
  bedsTotal: number;
  staffOnDuty: number;
  status: "available" | "warning" | "critical";
}

export interface ActivityEvent {
  id: number;
  description: string;
  timestamp: string;
  type: "admission" | "discharge" | "consultation" | "lab" | "pharmacy" | "alert";
}

export interface ChartDataPoint {
  day: string;
  admissions: number;
  discharges: number;
}

export interface UtilizationDataPoint {
  department: string;
  utilization: number;
}

export const STATS_DATA: StatCardData[] = [
  {
    label: "Total Patients",
    value: "1,248",
    change: "+12%",
    icon: Users,
    color: "text-primary",
  },
  {
    label: "Occupied Beds",
    value: "86/120",
    change: "72%",
    icon: BedDouble,
    color: "text-secondary",
  },
  {
    label: "Today's Appointments",
    value: "64",
    change: "+8",
    icon: CalendarDays,
    color: "text-primary",
  },
  {
    label: "Active Cases",
    value: "142",
    change: "-3",
    icon: Activity,
    color: "text-primary",
  },
];

export const OPERATIONS_DATA: OperationMetric[] = [
  {
    label: "Admissions Today",
    value: "24",
    description: "New patients admitted",
    color: "text-primary",
  },
  {
    label: "Discharges Today",
    value: "18",
    description: "Patients discharged",
    color: "text-success",
  },
  {
    label: "Pending Cases",
    value: "36",
    description: "Awaiting consultation",
    color: "text-warning",
  },
  {
    label: "ER Visits",
    value: "12",
    description: "Emergency visits today",
    color: "text-destructive",
  },
];

export const DEPARTMENTS_DATA: DepartmentData[] = [
  {
    name: "Cardiology",
    bedsOccupied: 18,
    bedsTotal: 20,
    staffOnDuty: 8,
    status: "critical",
  },
  {
    name: "Emergency",
    bedsOccupied: 12,
    bedsTotal: 15,
    staffOnDuty: 6,
    status: "warning",
  },
  {
    name: "Neurology",
    bedsOccupied: 10,
    bedsTotal: 18,
    staffOnDuty: 5,
    status: "available",
  },
  {
    name: "Orthopedics",
    bedsOccupied: 14,
    bedsTotal: 16,
    staffOnDuty: 7,
    status: "warning",
  },
  {
    name: "Pediatrics",
    bedsOccupied: 8,
    bedsTotal: 20,
    staffOnDuty: 4,
    status: "available",
  },
  {
    name: "ICU",
    bedsOccupied: 10,
    bedsTotal: 10,
    staffOnDuty: 6,
    status: "critical",
  },
];

export const ACTIVITY_DATA: ActivityEvent[] = [
  {
    id: 1,
    description: "Patient Sarah Jenkins admitted to Cardiology",
    timestamp: "2 min ago",
    type: "admission",
  },
  {
    id: 2,
    description: "Dr. Patel completed 3 consultations",
    timestamp: "15 min ago",
    type: "consultation",
  },
  {
    id: 3,
    description: "Lab results ready for 12 patients",
    timestamp: "32 min ago",
    type: "lab",
  },
  {
    id: 4,
    description: "Pharmacy restock order placed for Amoxicillin",
    timestamp: "1 hour ago",
    type: "pharmacy",
  },
  {
    id: 5,
    description: "Patient Michael Chang discharged from Neurology",
    timestamp: "1.5 hours ago",
    type: "discharge",
  },
  {
    id: 6,
    description: "Critical bed occupancy alert: ICU at 100%",
    timestamp: "2 hours ago",
    type: "alert",
  },
  {
    id: 7,
    description: "Dr. Wilson scheduled 5 appointments for tomorrow",
    timestamp: "2.5 hours ago",
    type: "consultation",
  },
  {
    id: 8,
    description: "New patient registered: Emily Rodriguez",
    timestamp: "3 hours ago",
    type: "admission",
  },
  {
    id: 9,
    description: "Blood bank inventory low: O- type",
    timestamp: "3.5 hours ago",
    type: "alert",
  },
  {
    id: 10,
    description: "Morning shift handover completed for Emergency",
    timestamp: "4 hours ago",
    type: "consultation",
  },
];

export const ADMISSIONS_CHART_DATA: ChartDataPoint[] = [
  { day: "Mon", admissions: 18, discharges: 14 },
  { day: "Tue", admissions: 22, discharges: 16 },
  { day: "Wed", admissions: 20, discharges: 18 },
  { day: "Thu", admissions: 28, discharges: 20 },
  { day: "Fri", admissions: 24, discharges: 22 },
  { day: "Sat", admissions: 16, discharges: 12 },
  { day: "Sun", admissions: 14, discharges: 10 },
];

export const UTILIZATION_CHART_DATA: UtilizationDataPoint[] = [
  { department: "Cardiology", utilization: 90 },
  { department: "Emergency", utilization: 80 },
  { department: "Neurology", utilization: 56 },
  { department: "Orthopedics", utilization: 88 },
  { department: "Pediatrics", utilization: 40 },
  { department: "ICU", utilization: 100 },
];
