import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
}

export function StatCard({ title, value, icon: Icon, trend, trendUp }: StatCardProps) {
  return (
    <div className="rounded-2xl p-5 animate-fade-in transition-all duration-200 hover:-translate-y-1 bg-card border border-border shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1 min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide truncate text-muted-foreground">
            {title}
          </p>
          <p className="text-lg sm:text-2xl font-extrabold font-mono tracking-tight truncate text-foreground" style={{ letterSpacing: "-0.025em" }}>
            {value}
          </p>
          {trend && (
            <p className={`text-xs font-medium ${trendUp ? "text-success" : "text-destructive"}`}>
              {trendUp ? "↑" : "↓"} {trend}
            </p>
          )}
        </div>
        <div className="rounded-xl p-3 bg-secondary shrink-0">
          <Icon className="h-5 w-5 text-primary" />
        </div>
      </div>
    </div>
  );
}
