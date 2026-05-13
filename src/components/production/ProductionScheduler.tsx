import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import {
  startOfMonth, endOfMonth, eachDayOfInterval, format, isSameMonth,
  isToday, addMonths, subMonths, isSameDay, parseISO,
} from "date-fns";

interface ProductionOrder {
  id: string;
  order_number: string;
  quantity: number;
  status: string;
  planned_date: string | null;
}

interface Props {
  orders: ProductionOrder[];
  onOrderClick?: (order: ProductionOrder) => void;
}

const STATUS_DOT: Record<string, string> = {
  planned: "bg-blue-500",
  in_progress: "bg-yellow-500",
  completed: "bg-green-500",
  cancelled: "bg-muted-foreground",
};

const STATUS_PILL: Record<string, string> = {
  planned: "bg-blue-500/10 text-blue-600 border-blue-200",
  in_progress: "bg-yellow-500/10 text-yellow-700 border-yellow-200",
  completed: "bg-green-500/10 text-green-700 border-green-200",
  cancelled: "bg-muted text-muted-foreground border-border",
};

export function ProductionScheduler({ orders, onOrderClick }: Props) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const days = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  // Pad to full weeks (start on Mon)
  const firstDow = (days[0].getDay() + 6) % 7; // Mon=0
  const paddedStart = Array(firstDow).fill(null);

  const ordersByDate = useMemo(() => {
    const map: Record<string, ProductionOrder[]> = {};
    for (const o of orders) {
      if (!o.planned_date) continue;
      const key = o.planned_date.slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(o);
    }
    return map;
  }, [orders]);

  const unscheduled = orders.filter(o => !o.planned_date);
  const monthOrders = orders.filter(o => {
    if (!o.planned_date) return false;
    const d = parseISO(o.planned_date);
    return isSameMonth(d, currentMonth);
  });

  return (
    <div className="space-y-4">
      {/* Month nav + stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => setCurrentMonth(m => subMonths(m, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h3 className="font-semibold text-lg w-36 text-center">{format(currentMonth, "MMMM yyyy")}</h3>
          <Button variant="outline" size="icon" onClick={() => setCurrentMonth(m => addMonths(m, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(new Date())}>Today</Button>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {Object.entries(STATUS_DOT).map(([status, dot]) => (
            <span key={status} className="flex items-center gap-1.5 text-muted-foreground capitalize">
              <span className={`h-2 w-2 rounded-full ${dot}`} />{status.replace("_", " ")}
            </span>
          ))}
        </div>
      </div>

      {/* Calendar grid */}
      <Card>
        <CardContent className="p-3">
          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => (
              <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-1.5">{d}</div>
            ))}
          </div>
          {/* Calendar cells */}
          <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
            {paddedStart.map((_, i) => (
              <div key={`pad-${i}`} className="bg-muted/30 min-h-[90px]" />
            ))}
            {days.map(day => {
              const key = format(day, "yyyy-MM-dd");
              const dayOrders = ordersByDate[key] || [];
              const today = isToday(day);
              return (
                <div
                  key={key}
                  className={`bg-card min-h-[90px] p-1.5 flex flex-col gap-1 ${today ? "ring-1 ring-primary ring-inset" : ""}`}
                >
                  <span className={`text-xs font-medium w-5 h-5 flex items-center justify-center rounded-full ${today ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                    {format(day, "d")}
                  </span>
                  <div className="space-y-0.5">
                    {dayOrders.slice(0, 3).map(o => (
                      <button
                        key={o.id}
                        className={`w-full text-left px-1.5 py-0.5 rounded text-[10px] font-medium border truncate ${STATUS_PILL[o.status] || "bg-muted text-muted-foreground border-border"}`}
                        onClick={() => onOrderClick?.(o)}
                        title={`${o.order_number} — qty ${o.quantity} — ${o.status}`}
                      >
                        {o.order_number}
                      </button>
                    ))}
                    {dayOrders.length > 3 && (
                      <span className="text-[10px] text-muted-foreground px-1">+{dayOrders.length - 3} more</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Month summary + unscheduled */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">This Month — {format(currentMonth, "MMMM")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {monthOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground">No orders scheduled this month.</p>
            ) : (
              monthOrders.map(o => (
                <div key={o.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full shrink-0 ${STATUS_DOT[o.status] || "bg-muted"}`} />
                    <span className="font-mono text-xs">{o.order_number}</span>
                    <span className="text-muted-foreground">× {o.quantity}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{o.planned_date ? format(parseISO(o.planned_date), "MMM d") : ""}</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] border capitalize ${STATUS_PILL[o.status] || ""}`}>{o.status.replace("_", " ")}</span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              Unscheduled Orders
              {unscheduled.length > 0 && <Badge variant="destructive" className="text-[10px]">{unscheduled.length}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {unscheduled.length === 0 ? (
              <p className="text-sm text-muted-foreground">All orders have a planned date.</p>
            ) : (
              <div className="space-y-2">
                {unscheduled.map(o => (
                  <div key={o.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-mono text-xs">{o.order_number}</span>
                      <span className="text-muted-foreground">× {o.quantity}</span>
                    </div>
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] border capitalize ${STATUS_PILL[o.status] || ""}`}>{o.status.replace("_", " ")}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
