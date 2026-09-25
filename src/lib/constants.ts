import {
  LayoutDashboard,
  Users,
  UserPlus,
  CalendarDays,
  Building2,
  BedDouble,
  Stethoscope,
  PillBottle,
  FlaskConical,
  FileText,
  Siren,
  Receipt,
  ShieldCheck,
  Package,
  Bell,
  BarChart3,
  Settings,
  ClipboardList,
  HeartPulse,
  ScanEye,
} from "lucide-react";

type LucideIcon = React.ComponentType<{ className?: string }>;

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Optional frontend visibility permission; backend remains the security boundary. */
  permission?: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const navigation: NavGroup[] = [
  {
    label: "OVERVIEW",
    items: [
      { label: "Dashboard", href: "/", icon: LayoutDashboard },
    ],
  },
  {
    label: "CLINICAL",
    items: [
      { label: "Patients", href: "/patients", icon: Users },
      { label: "Staff", href: "/staff", icon: UserPlus },
      { label: "Appointments", href: "/appointments", icon: CalendarDays },
      { label: "Departments", href: "/departments", icon: Building2 },
      { label: "Beds & Rooms", href: "/beds", icon: BedDouble },
      { label: "Nursing", href: "/nursing", icon: HeartPulse },
    ],
  },
  {
    label: "OPERATIONS",
    items: [
      { label: "Pharmacy", href: "/pharmacy", icon: PillBottle },
      { label: "Laboratory", href: "/laboratory", icon: FlaskConical },
      { label: "Surgery", href: "/surgery", icon: Stethoscope },
      { label: "Emergency", href: "/emergency", icon: Siren },
    ],
  },
  {
    label: "FINANCE",
    items: [
      { label: "Billing", href: "/billing", icon: Receipt },
      { label: "Insurance", href: "/insurance", icon: ShieldCheck },
      { label: "Inventory", href: "/inventory", icon: Package },
    ],
  },
  {
    label: "ADMINISTRATION",
    items: [
      { label: "Records", href: "/records", icon: FileText },
      { label: "Notifications", href: "/notifications", icon: Bell, permission: "notifications:read" },
      { label: "Reports", href: "/reports", icon: BarChart3, permission: "reports:read" },
      { label: "Audit Log", href: "/security", icon: ScanEye, permission: "audit:read" },
      { label: "Users & Roles", href: "/users", icon: ClipboardList, permission: "users:read" },
      { label: "Settings", href: "/settings", icon: Settings, permission: "settings:read" },
    ],
  },
];

export const sidebarWidth = 256;
export const topbarHeight = 64;
