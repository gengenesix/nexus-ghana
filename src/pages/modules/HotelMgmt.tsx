import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { format, parseISO, differenceInDays } from "date-fns";
import {
  BedDouble, Plus, ChevronLeft, User, Calendar, CheckCircle2,
  LogIn, LogOut, X, Save, DollarSign, Bed
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/hooks/useBusiness";
import { formatGHS, PAYMENT_METHODS } from "@/lib/ghana";
import { toast } from "sonner";

// ── Types ────────────────────────────────────────────────────────────────────

type RoomStatus    = "available" | "occupied" | "reserved" | "maintenance" | "cleaning";
type BookingStatus = "confirmed" | "checked-in" | "checked-out" | "cancelled" | "no-show";
type RoomType      = "Standard" | "Deluxe" | "Suite" | "Executive" | "Family" | "Dormitory";

interface HotelRoom {
  id: string;
  room_number: string;
  room_type: RoomType;
  floor: string | null;
  capacity: number;
  rate_per_night: number;
  status: RoomStatus;
  amenities: string | null;
}

interface HotelBooking {
  id: string;
  room_id: string | null;
  guest_name: string;
  guest_phone: string | null;
  check_in_date: string;
  check_out_date: string;
  adults: number;
  children: number;
  status: BookingStatus;
  total_amount: number;
  paid_amount: number;
  payment_method: string | null;
  notes: string | null;
}

// ── Config ────────────────────────────────────────────────────────────────────

const ROOM_STATUS_CFG: Record<RoomStatus, { label: string; bg: string; border: string; text: string }> = {
  available:   { label: "Available",   bg: "bg-green-50",  border: "border-green-300",  text: "text-green-700"  },
  occupied:    { label: "Occupied",    bg: "bg-red-50",    border: "border-red-400",    text: "text-red-700"    },
  reserved:    { label: "Reserved",    bg: "bg-amber-50",  border: "border-amber-400",  text: "text-amber-700"  },
  maintenance: { label: "Maintenance",bg: "bg-orange-50", border: "border-orange-400", text: "text-orange-700" },
  cleaning:    { label: "Cleaning",   bg: "bg-slate-50",  border: "border-slate-300",  text: "text-slate-600"  },
};

const BOOKING_STATUS_CFG: Record<BookingStatus, { label: string; color: string }> = {
  confirmed:    { label: "Confirmed",    color: "bg-blue-100 text-blue-700"    },
  "checked-in": { label: "Checked In",  color: "bg-green-100 text-green-700"  },
  "checked-out":{ label: "Checked Out", color: "bg-slate-100 text-slate-600"  },
  cancelled:    { label: "Cancelled",   color: "bg-red-100 text-red-600"      },
  "no-show":    { label: "No-Show",     color: "bg-orange-100 text-orange-700"},
};

// ── Main Component ────────────────────────────────────────────────────────────

export default function HotelMgmt() {
  const { business } = useBusiness();
  const qc = useQueryClient();
  const businessId = business?.id;

  const [view, setView]                 = useState<"rooms" | "bookings">("rooms");
  const [selectedRoom, setSelectedRoom] = useState<HotelRoom | null>(null);
  const [showAddRoom,  setShowAddRoom]  = useState(false);
  const [showBooking,  setShowBooking]  = useState(false);

  // Add room form
  const [rNum,   setRNum]   = useState("");
  const [rType,  setRType]  = useState<RoomType>("Standard");
  const [rFloor, setRFloor] = useState("");
  const [rCap,   setRCap]   = useState("2");
  const [rRate,  setRRate]  = useState("");

  // New booking form (for selected room)
  const [bGuest,   setBGuest]   = useState("");
  const [bPhone,   setBPhone]   = useState("");
  const [bCheckIn, setBCheckIn] = useState(format(new Date(), "yyyy-MM-dd"));
  const [bCheckOut,setBCheckOut]= useState("");
  const [bAdults,  setBAdults]  = useState("1");
  const [bKids,    setBKids]    = useState("0");
  const [bPayMethod, setBPayMethod] = useState("cash");
  const [bNotes,   setBNotes]   = useState("");

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: rooms = [], isLoading } = useQuery<HotelRoom[]>({
    queryKey: ["hotel-rooms", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("hotel_rooms")
        .select("*")
        .eq("business_id", businessId)
        .order("room_number");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: bookings = [] } = useQuery<(HotelBooking & { room_number?: string })[]>({
    queryKey: ["hotel-bookings", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("hotel_bookings")
        .select("*, hotel_rooms(room_number)")
        .eq("business_id", businessId)
        .order("check_in_date", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []).map((b: any) => ({ ...b, room_number: b.hotel_rooms?.room_number ?? "—" }));
    },
  });

  // ── Mutations ──────────────────────────────────────────────────────────────

  const addRoom = useMutation({
    mutationFn: async () => {
      if (!businessId || !rNum || !rRate) throw new Error("Room number and rate required");
      const { error } = await (supabase as any)
        .from("hotel_rooms")
        .insert({
          business_id:    businessId,
          room_number:    rNum,
          room_type:      rType,
          floor:          rFloor || null,
          capacity:       parseInt(rCap) || 2,
          rate_per_night: parseFloat(rRate),
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Room added");
      qc.invalidateQueries({ queryKey: ["hotel-rooms"] });
      setShowAddRoom(false);
      setRNum(""); setRRate(""); setRFloor("");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const createBooking = useMutation({
    mutationFn: async () => {
      if (!businessId || !selectedRoom || !bGuest || !bCheckIn || !bCheckOut)
        throw new Error("Fill all required fields");
      const nights = differenceInDays(parseISO(bCheckOut), parseISO(bCheckIn));
      if (nights <= 0) throw new Error("Check-out must be after check-in");
      const total = selectedRoom.rate_per_night * nights;

      const { error: bErr } = await (supabase as any)
        .from("hotel_bookings")
        .insert({
          business_id:    businessId,
          room_id:        selectedRoom.id,
          guest_name:     bGuest,
          guest_phone:    bPhone || null,
          check_in_date:  bCheckIn,
          check_out_date: bCheckOut,
          adults:         parseInt(bAdults) || 1,
          children:       parseInt(bKids)   || 0,
          total_amount:   total,
          paid_amount:    0,
          payment_method: bPayMethod,
          notes:          bNotes || null,
        });
      if (bErr) throw bErr;
      // Mark room reserved
      await (supabase as any).from("hotel_rooms").update({ status: "reserved" }).eq("id", selectedRoom.id);
    },
    onSuccess: () => {
      toast.success("Booking created");
      qc.invalidateQueries({ queryKey: ["hotel-rooms"] });
      qc.invalidateQueries({ queryKey: ["hotel-bookings"] });
      setShowBooking(false);
      setSelectedRoom(null);
      setBGuest(""); setBPhone(""); setBNotes(""); setBCheckOut("");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const updateBookingStatus = useMutation({
    mutationFn: async ({ bookingId, status, roomId }: { bookingId: string; status: BookingStatus; roomId: string | null }) => {
      await (supabase as any).from("hotel_bookings").update({ status, updated_at: new Date().toISOString() }).eq("id", bookingId);
      if (roomId) {
        const roomStatus: RoomStatus =
          status === "checked-in"  ? "occupied"  :
          status === "checked-out" ? "cleaning"  :
          status === "cancelled"   ? "available" : "reserved";
        await (supabase as any).from("hotel_rooms").update({ status: roomStatus }).eq("id", roomId);
      }
    },
    onSuccess: () => {
      toast.success("Status updated");
      qc.invalidateQueries({ queryKey: ["hotel-rooms"] });
      qc.invalidateQueries({ queryKey: ["hotel-bookings"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  // ── Summary ────────────────────────────────────────────────────────────────

  const roomsByStatus = {
    available:   rooms.filter(r => r.status === "available").length,
    occupied:    rooms.filter(r => r.status === "occupied").length,
    reserved:    rooms.filter(r => r.status === "reserved").length,
  };
  const occupancyPct = rooms.length ? Math.round((roomsByStatus.occupied / rooms.length) * 100) : 0;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Hotel Management</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Room board, bookings and guest management</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setView(v => v === "rooms" ? "bookings" : "rooms")}>
            {view === "rooms" ? <Calendar className="h-4 w-4 mr-1.5" /> : <Bed className="h-4 w-4 mr-1.5" />}
            {view === "rooms" ? "Bookings" : "Rooms"}
          </Button>
          {view === "rooms" && (
            <Button style={{ background: "var(--forest)" }} size="sm" onClick={() => setShowAddRoom(true)}>
              <Plus className="h-4 w-4 mr-1.5" /> Add Room
            </Button>
          )}
        </div>
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Available",   value: roomsByStatus.available,  color: "text-green-600" },
          { label: "Occupied",    value: roomsByStatus.occupied,   color: "text-red-500"   },
          { label: "Reserved",    value: roomsByStatus.reserved,   color: "text-amber-600" },
          { label: "Occupancy",   value: `${occupancyPct}%`,       color: "text-[var(--forest)]" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-card border rounded-xl p-3">
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className={`text-xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {view === "rooms" ? (
        isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-32 rounded-xl bg-muted animate-pulse" />)}
          </div>
        ) : rooms.length === 0 ? (
          <div className="bg-card border rounded-xl p-12 text-center">
            <BedDouble className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground">No rooms yet. Add your first room.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {rooms.map(room => {
              const cfg = ROOM_STATUS_CFG[room.status];
              return (
                <motion.div key={room.id} whileHover={{ scale: 1.02 }}
                  className={`rounded-xl border-2 p-3 cursor-pointer ${cfg.bg} ${cfg.border}`}
                  onClick={() => { setSelectedRoom(room); if (room.status === "available") setShowBooking(true); }}
                >
                  <div className="flex items-start justify-between mb-1">
                    <span className="text-xl font-bold">{room.room_number}</span>
                    <span className={`text-xs font-medium ${cfg.text}`}>{cfg.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{room.room_type}</p>
                  <p className="text-sm font-semibold mt-1">{formatGHS(room.rate_per_night)}<span className="text-xs font-normal text-muted-foreground">/night</span></p>
                  {room.floor && <p className="text-xs text-muted-foreground">Floor {room.floor}</p>}
                </motion.div>
              );
            })}
          </div>
        )
      ) : (
        /* Bookings list */
        <div className="bg-card border rounded-xl overflow-hidden">
          {bookings.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No bookings yet</div>
          ) : (
            <div className="divide-y">
              {bookings.map(b => {
                const cfg  = BOOKING_STATUS_CFG[b.status];
                const nights = differenceInDays(parseISO(b.check_out_date), parseISO(b.check_in_date));
                return (
                  <div key={b.id} className="px-4 py-3 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{b.guest_name}</p>
                        <Badge className={cfg.color + " border-0 text-xs"}>{cfg.label}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Room {(b as any).room_number} · {format(parseISO(b.check_in_date), "d MMM")} – {format(parseISO(b.check_out_date), "d MMM yyyy")} ({nights}n)
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-semibold text-sm">{formatGHS(b.total_amount)}</p>
                      <div className="flex gap-1 mt-1 justify-end">
                        {b.status === "confirmed" && (
                          <Button size="sm" className="h-6 text-xs px-2" style={{ background: "var(--forest)" }}
                            onClick={() => updateBookingStatus.mutate({ bookingId: b.id, status: "checked-in", roomId: b.room_id })}>
                            <LogIn className="h-3 w-3 mr-0.5" /> Check In
                          </Button>
                        )}
                        {b.status === "checked-in" && (
                          <Button size="sm" variant="outline" className="h-6 text-xs px-2"
                            onClick={() => updateBookingStatus.mutate({ bookingId: b.id, status: "checked-out", roomId: b.room_id })}>
                            <LogOut className="h-3 w-3 mr-0.5" /> Check Out
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Add Room modal */}
      <AnimatePresence>
        {showAddRoom && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-40" onClick={() => setShowAddRoom(false)} />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="bg-background border rounded-xl shadow-2xl w-full max-w-sm p-6 space-y-4">
                <h2 className="font-bold text-lg">Add Room</h2>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Room Number *</label>
                    <Input placeholder="101, A1…" value={rNum} onChange={e => setRNum(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Floor</label>
                    <Input placeholder="1, Ground…" value={rFloor} onChange={e => setRFloor(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Type</label>
                    <Select value={rType} onValueChange={v => setRType(v as RoomType)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["Standard","Deluxe","Suite","Executive","Family","Dormitory"].map(t => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Capacity</label>
                    <Input type="number" min="1" value={rCap} onChange={e => setRCap(e.target.value)} />
                  </div>
                  <div className="col-span-2">
                    <label className="text-sm font-medium mb-1 block">Rate per Night (GHS) *</label>
                    <Input type="number" placeholder="0.00" value={rRate} onChange={e => setRRate(e.target.value)} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setShowAddRoom(false)}>Cancel</Button>
                  <Button className="flex-1" style={{ background: "var(--forest)" }}
                    onClick={() => addRoom.mutate()} disabled={addRoom.isPending || !rNum || !rRate}>
                    {addRoom.isPending ? "Adding…" : "Add Room"}
                  </Button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* New Booking slide-in */}
      <AnimatePresence>
        {showBooking && selectedRoom && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-40" onClick={() => { setShowBooking(false); setSelectedRoom(null); }} />
            <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 260 }}
              className="fixed right-0 top-0 h-full w-full max-w-md bg-background border-l shadow-2xl z-50 flex flex-col">
              <div className="p-4 border-b flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-lg">New Booking</h2>
                  <p className="text-sm text-muted-foreground">Room {selectedRoom.room_number} · {formatGHS(selectedRoom.rate_per_night)}/night</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => { setShowBooking(false); setSelectedRoom(null); }}>✕</Button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Guest Name *</label>
                  <Input placeholder="Full name" value={bGuest} onChange={e => setBGuest(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Guest Phone</label>
                  <Input placeholder="0XX XXX XXXX" value={bPhone} onChange={e => setBPhone(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Check-In *</label>
                    <Input type="date" value={bCheckIn} onChange={e => setBCheckIn(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Check-Out *</label>
                    <Input type="date" value={bCheckOut} onChange={e => setBCheckOut(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Adults</label>
                    <Input type="number" min="1" value={bAdults} onChange={e => setBAdults(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Children</label>
                    <Input type="number" min="0" value={bKids} onChange={e => setBKids(e.target.value)} />
                  </div>
                </div>
                {bCheckIn && bCheckOut && parseISO(bCheckOut) > parseISO(bCheckIn) && (
                  <div className="bg-muted rounded-lg px-3 py-2 text-sm">
                    <DollarSign className="h-3.5 w-3.5 inline mr-1" />
                    {differenceInDays(parseISO(bCheckOut), parseISO(bCheckIn))} nights ·{" "}
                    <strong>{formatGHS(selectedRoom.rate_per_night * differenceInDays(parseISO(bCheckOut), parseISO(bCheckIn)))}</strong>
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium mb-1 block">Payment Method</label>
                  <Select value={bPayMethod} onValueChange={setBPayMethod}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Notes</label>
                  <Input placeholder="Special requests…" value={bNotes} onChange={e => setBNotes(e.target.value)} />
                </div>
              </div>
              <div className="p-4 border-t">
                <Button className="w-full" style={{ background: "var(--forest)" }}
                  onClick={() => createBooking.mutate()}
                  disabled={createBooking.isPending || !bGuest || !bCheckIn || !bCheckOut}>
                  <Save className="h-4 w-4 mr-2" />
                  {createBooking.isPending ? "Booking…" : "Create Booking"}
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
