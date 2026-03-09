import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { differenceInDays, format, max, min, addDays, startOfDay } from "date-fns";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface GanttTask {
  id: string;
  title: string;
  start_date: string | null;
  due_date: string | null;
  status: string;
  priority?: string | null;
}

interface GanttChartProps {
  tasks: GanttTask[];
  projectStart?: string | null;
  projectEnd?: string | null;
}

const statusColors: Record<string, string> = {
  todo: "bg-muted",
  in_progress: "hsl(var(--warning))",
  done: "hsl(var(--success))",
  review: "hsl(var(--info))",
};

const statusBg: Record<string, string> = {
  todo: "bg-muted-foreground/30",
  in_progress: "bg-yellow-500",
  done: "bg-green-500",
  review: "bg-blue-500",
};

export function GanttChart({ tasks, projectStart, projectEnd }: GanttChartProps) {
  const validTasks = tasks.filter((t) => t.start_date && t.due_date);

  const { timelineStart, timelineEnd, totalDays } = useMemo(() => {
    if (validTasks.length === 0) {
      const now = new Date();
      return { timelineStart: now, timelineEnd: addDays(now, 30), totalDays: 30 };
    }
    const starts = validTasks.map((t) => new Date(t.start_date!));
    const ends = validTasks.map((t) => new Date(t.due_date!));
    if (projectStart) starts.push(new Date(projectStart));
    if (projectEnd) ends.push(new Date(projectEnd));

    const s = startOfDay(min(starts));
    const e = startOfDay(max(ends));
    const days = Math.max(differenceInDays(e, s) + 1, 7);
    return { timelineStart: s, timelineEnd: e, totalDays: days };
  }, [validTasks, projectStart, projectEnd]);

  const colWidth = 36;
  const headerHeight = 48;
  const rowHeight = 40;

  const dates = Array.from({ length: totalDays }, (_, i) => addDays(timelineStart, i));

  if (validTasks.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12 text-muted-foreground">
          <p>No tasks with dates to display on the timeline. Add start and due dates to tasks.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Project Timeline</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="w-full">
          <div className="flex" style={{ minWidth: 220 + colWidth * totalDays }}>
            {/* Task names column */}
            <div className="w-[220px] shrink-0 border-r border-border">
              <div className="h-[48px] flex items-center px-3 border-b border-border bg-muted/50">
                <span className="text-xs font-semibold text-muted-foreground">Task</span>
              </div>
              {validTasks.map((task) => (
                <div key={task.id} className="h-[40px] flex items-center px-3 border-b border-border">
                  <span className="text-sm truncate">{task.title}</span>
                </div>
              ))}
            </div>

            {/* Timeline area */}
            <div className="flex-1 relative">
              {/* Header dates */}
              <div className="flex border-b border-border bg-muted/50" style={{ height: headerHeight }}>
                {dates.map((d, i) => (
                  <div
                    key={i}
                    className={`shrink-0 flex flex-col items-center justify-center text-[10px] text-muted-foreground border-r border-border/50 ${d.getDay() === 0 || d.getDay() === 6 ? "bg-muted/80" : ""}`}
                    style={{ width: colWidth }}
                  >
                    <span>{format(d, "dd")}</span>
                    <span>{format(d, "MMM")}</span>
                  </div>
                ))}
              </div>

              {/* Task bars */}
              {validTasks.map((task) => {
                const start = startOfDay(new Date(task.start_date!));
                const end = startOfDay(new Date(task.due_date!));
                const offsetDays = differenceInDays(start, timelineStart);
                const duration = Math.max(differenceInDays(end, start) + 1, 1);
                const left = offsetDays * colWidth;
                const width = duration * colWidth - 4;

                return (
                  <div key={task.id} className="relative border-b border-border/50" style={{ height: rowHeight }}>
                    {/* Weekend shading */}
                    {dates.map((d, i) => (
                      (d.getDay() === 0 || d.getDay() === 6) && (
                        <div key={i} className="absolute top-0 bottom-0 bg-muted/40" style={{ left: i * colWidth, width: colWidth }} />
                      )
                    ))}
                    {/* Bar */}
                    <div
                      className={`absolute top-2 rounded-md ${statusBg[task.status] || "bg-primary"} opacity-80 hover:opacity-100 transition-opacity cursor-default`}
                      style={{ left: left + 2, width: Math.max(width, 20), height: rowHeight - 16 }}
                      title={`${task.title}: ${format(start, "MMM d")} → ${format(end, "MMM d")}`}
                    >
                      <span className="text-[10px] text-white font-medium px-1.5 truncate block leading-6">
                        {task.title}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
