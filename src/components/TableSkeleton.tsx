import { Skeleton } from "@/components/ui/skeleton";
import { TableBody, TableCell, TableRow } from "@/components/ui/table";

interface TableSkeletonProps {
  rows?: number;
  cols?: number;
}

export function TableSkeleton({ rows = 6, cols = 5 }: TableSkeletonProps) {
  return (
    <TableBody>
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <TableRow key={rowIdx}>
          {Array.from({ length: cols }).map((_, colIdx) => (
            <TableCell key={colIdx}>
              <Skeleton className={`h-4 ${colIdx === 0 ? "w-36" : colIdx === cols - 1 ? "w-16" : "w-24"}`} />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </TableBody>
  );
}
