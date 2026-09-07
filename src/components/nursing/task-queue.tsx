"use client";

import { Pill, Activity, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TaskItem {
  id: string;
  type: "medication" | "vitals" | "other";
  label: string;
  patientRoom?: string;
  dueTime?: string;
  status: "pending" | "completed";
}

interface TaskQueueProps {
  tasks: TaskItem[];
  loading?: boolean;
}

const TASK_ICONS: Record<string, typeof Pill> = {
  medication: Pill,
  vitals: Activity,
  other: ClipboardList,
};

const TASK_COLORS: Record<string, string> = {
  medication: "text-blue-600 bg-blue-100",
  vitals: "text-emerald-600 bg-emerald-100",
  other: "text-amber-600 bg-amber-100",
};

export function TaskQueue({ tasks, loading }: TaskQueueProps) {
  if (loading) {
    return (
      <div className="bg-card rounded-lg border border-border/50 p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-foreground mb-4">Task Queue</h3>
        <div className="text-center text-muted-foreground text-sm py-8">Loading tasks...</div>
      </div>
    );
  }

  const pendingTasks = tasks.filter((t) => t.status === "pending");
  const completedTasks = tasks.filter((t) => t.status === "completed");

  return (
    <div className="bg-card rounded-lg border border-border/50 shadow-sm">
      <div className="px-4 py-3 border-b border-border/50 bg-muted/30">
        <h3 className="text-sm font-semibold text-foreground">Task Queue</h3>
      </div>
      <div className="p-4">
        {tasks.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-8">
            <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No pending tasks</p>
          </div>
        ) : (
          <div className="space-y-2">
            {pendingTasks.map((task) => {
              const Icon = TASK_ICONS[task.type] || ClipboardList;
              const colorClass = TASK_COLORS[task.type] || "text-slate-600 bg-slate-100";
              return (
                <div
                  key={task.id}
                  className="flex items-center gap-3 p-2.5 rounded-lg border border-border/30 hover:bg-muted/20 transition-colors"
                >
                  <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0", colorClass)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{task.label}</p>
                    {task.patientRoom && (
                      <p className="text-xs text-muted-foreground">{task.patientRoom}</p>
                    )}
                  </div>
                  {task.dueTime && (
                    <span className="text-xs text-muted-foreground flex-shrink-0">{task.dueTime}</span>
                  )}
                </div>
              );
            })}
            {completedTasks.length > 0 && (
              <>
                <div className="pt-2 border-t border-border/30">
                  <p className="text-xs text-muted-foreground mb-2">Completed</p>
                </div>
                {completedTasks.map((task) => {
                  const Icon = TASK_ICONS[task.type] || ClipboardList;
                  return (
                    <div
                      key={task.id}
                      className="flex items-center gap-3 p-2.5 rounded-lg opacity-50"
                    >
                      <div className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-slate-100">
                        <Icon className="h-4 w-4 text-slate-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-muted-foreground line-through truncate">{task.label}</p>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
