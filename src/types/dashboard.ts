export interface DashboardDepartment {
  name: string;
  bedsOccupied: number;
  bedsTotal: number;
  activeStaff: number;
  occupancyPercentage: number;
  status: "available" | "warning" | "critical";
}

export interface DashboardActivityEvent {
  id: string;
  description: string;
  timestamp: string;
  type: "audit" | "alert";
}

export interface DashboardChartDataPoint {
  day: string;
  admissions: number;
  discharges: number;
}

export interface DashboardUtilizationPoint {
  department: string;
  utilization: number;
}

export interface DashboardFinancial {
  totalInvoiced: number;
  totalPaid: number;
  outstanding: number;
}

export interface DashboardStats {
  patients: {
    total: number;
    newThisMonth: number;
    active: number;
    critical: number;
  };
  appointments: {
    today: number;
    pendingToday: number;
    upcomingPending: number;
  };
  beds: {
    total: number;
    occupied: number;
    available: number;
    occupancyPercentage: number;
  };
  operations: {
    admissionsToday: number;
    dischargesToday: number;
    pendingCases: number;
    erVisitsToday: number;
  };
  departments: DashboardDepartment[];
  financial: DashboardFinancial;
  admissionsChart: DashboardChartDataPoint[];
  activity: DashboardActivityEvent[];
}

export interface DashboardStatsResponse {
  data: DashboardStats;
  meta: {
    generatedAt: string;
  };
}

export interface OperationMetric {
  label: string;
  value: string;
  description: string;
  color: string;
}
