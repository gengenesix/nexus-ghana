/**
 * PageSkeleton — Phase 5 unified loading skeleton system
 *
 * Variants:
 *  - KpiGridSkeleton   : animated stat card grid (dashboard / module headers)
 *  - TableBodySkeleton : drop-in replacement for TableBody while loading
 *  - CardGridSkeleton  : grid of card skeletons (module tile grids)
 *  - ListSkeleton      : stacked row skeletons (feed/list views)
 */
import { Skeleton } from "@/components/ui/skeleton";
import { TableBody, TableCell, TableRow } from "@/components/ui/table";

// ── KPI stat-card grid ────────────────────────────────────────────────────────

interface KpiGridSkeletonProps {
  count?: number;
  cols?: string; // tailwind grid class, default: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
}

export function KpiGridSkeleton({
  count = 4,
  cols = "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
}: KpiGridSkeletonProps) {
  return (
    <div className={`grid ${cols} gap-4`}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-border bg-card p-5"
          style={{ animationDelay: `${i * 80}ms` }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2.5 flex-1 min-w-0">
              <Skeleton className="h-2.5 w-20 rounded-full" />
              <Skeleton className="h-7 w-28 rounded-lg" />
              <Skeleton className="h-2.5 w-24 rounded-full" />
            </div>
            <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Table body skeleton ───────────────────────────────────────────────────────

interface TableBodySkeletonProps {
  rows?: number;
  cols?: number;
}

export function TableBodySkeleton({ rows = 7, cols = 5 }: TableBodySkeletonProps) {
  return (
    <TableBody>
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <TableRow key={rowIdx}>
          {Array.from({ length: cols }).map((_, colIdx) => (
            <TableCell key={colIdx}>
              <Skeleton
                className={`h-4 rounded-md ${
                  colIdx === 0 ? "w-36" : colIdx === cols - 1 ? "w-12" : "w-24"
                }`}
                style={{ animationDelay: `${(rowIdx * cols + colIdx) * 30}ms` }}
              />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </TableBody>
  );
}

// ── Card grid skeleton ────────────────────────────────────────────────────────

interface CardGridSkeletonProps {
  count?: number;
  cols?: string;
}

export function CardGridSkeleton({
  count = 6,
  cols = "grid-cols-2 sm:grid-cols-3",
}: CardGridSkeletonProps) {
  return (
    <div className={`grid ${cols} gap-4`}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-border bg-card p-4 space-y-3"
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
            <div className="space-y-1.5 flex-1 min-w-0">
              <Skeleton className="h-3.5 w-24 rounded-full" />
              <Skeleton className="h-3 w-16 rounded-full" />
            </div>
          </div>
          <Skeleton className="h-5 w-20 rounded-md" />
        </div>
      ))}
    </div>
  );
}

// ── Vertical list skeleton ────────────────────────────────────────────────────

interface ListSkeletonProps {
  count?: number;
}

export function ListSkeleton({ count = 6 }: ListSkeletonProps) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-3"
          style={{ animationDelay: `${i * 50}ms` }}
        >
          <Skeleton className="h-9 w-9 rounded-xl shrink-0" />
          <div className="flex-1 min-w-0 space-y-1.5">
            <Skeleton className="h-3.5 w-32 rounded-full" />
            <Skeleton className="h-3 w-20 rounded-full" />
          </div>
          <Skeleton className="h-4 w-16 rounded-full shrink-0" />
        </div>
      ))}
    </div>
  );
}
