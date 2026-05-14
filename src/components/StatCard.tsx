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
    <div className="rounded-2xl p-4 sm:p-5 animate-fade-in transition-all duration-200 hover:-translate-y-1 bg-card border border-border shadow-sm">
      {/* Title + icon on one row — icon is kept small so title never truncates */}
      <div className="flex items-center justify-between gap-1 mb-1.5">
        <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground leading-tight">
          {title}
        </p>
        <div className="rounded-lg p-1.5 sm:p-2.5 bg-secondary shrink-0">
          <Icon className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
        </div>
      </div>
      {/* Value gets the full card width — no truncation on any screen size */}
      <p className="text-base sm:text-2xl font-extrabold leading-tight text-foreground" style={{ letterSpacing: "-0.025em" }}>
        {value}
      </p>
      {trend && (
        <p className={`text-[10px] sm:text-xs font-medium mt-1 ${trendUp ? "text-success" : "text-destructive"}`}>
          {trendUp ? "↑" : "↓"} {trend}
        </p>
      )}
    </div>
  );
}
