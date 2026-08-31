"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { navigation, type NavGroup, type NavItem } from "@/lib/constants";
import { Activity } from "lucide-react";

function SidebarNavItem({ item, isActive }: { item: NavItem; isActive: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded text-sm font-medium transition-colors",
        isActive
          ? "bg-white/10 text-white border-l-4 border-primary pl-[8px]"
          : "text-white/70 hover:bg-white/10 hover:text-white border-l-4 border-transparent pl-[8px]",
      )}
      aria-current={isActive ? "page" : undefined}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{item.label}</span>
    </Link>
  );
}

function SidebarGroup({ group }: { group: NavGroup }) {
  const pathname = usePathname();
  return (
    <div className="mb-4">
      <p className="px-3 mb-2 text-[11px] font-medium uppercase tracking-wider text-white/40">
        {group.label}
      </p>
      <div className="space-y-0.5">
        {group.items.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return <SidebarNavItem key={item.href} item={item} isActive={isActive} />;
        })}
      </div>
    </div>
  );
}

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen w-64 bg-secondary flex flex-col",
        className,
      )}
    >
      <div className="flex items-center gap-2 px-4 py-4 border-b border-white/10">
        <div className="flex items-center justify-center w-8 h-8 rounded bg-primary text-primary-foreground">
          <Activity className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-sm font-semibold text-white font-headline">MedCore</h1>
          <p className="text-[10px] text-white/50">Premium HMS</p>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 py-4" aria-label="Main navigation">
        {navigation.map((group) => (
          <SidebarGroup key={group.label} group={group} />
        ))}
      </nav>
      <div className="px-4 py-3 border-t border-white/10">
        <p className="text-[10px] text-white/30">MedCore Premium v1.0</p>
      </div>
    </aside>
  );
}
