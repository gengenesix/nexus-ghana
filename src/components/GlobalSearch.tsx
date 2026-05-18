import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/hooks/useBusiness";
import { useDebounce } from "@/hooks/useDebounce";
import {
  Users, Package, FileText, Truck, Target, Handshake, FolderKanban,
  Wallet, Search, Wrench, Pill, BedDouble, ClipboardList,
} from "lucide-react";

interface SearchResult {
  id: string;
  label: string;
  sublabel?: string;
  category: string;
  icon: any;
  url: string;
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 250);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { business } = useBusiness();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const search = useCallback(async (q: string) => {
    if (!q || q.length < 2 || !business?.id) { setResults([]); return; }
    setLoading(true);
    const biz = business.id;
    const like = `%${q}%`;

    const [
      customers, products, invoices, suppliers,
      leads, opportunities, projects,
      jobCards, prescriptions, hotelBookings, fleetVehicles,
    ] = await Promise.all([
      supabase.from("customers").select("id, name, phone").eq("business_id", biz).ilike("name", like).limit(5),
      supabase.from("products").select("id, name, sku, selling_price").eq("business_id", biz).ilike("name", like).limit(5),
      supabase.from("invoices").select("id, invoice_number, customer_name, total").eq("business_id", biz).ilike("invoice_number", like).limit(5),
      supabase.from("suppliers").select("id, name, phone").eq("business_id", biz).ilike("name", like).limit(5),
      (supabase as any).from("leads").select("id, name, company").eq("business_id", biz).ilike("name", like).limit(5),
      (supabase as any).from("opportunities").select("id, name, value, stage").eq("business_id", biz).ilike("name", like).limit(5),
      (supabase as any).from("projects").select("id, name, status").eq("business_id", biz).ilike("name", like).limit(5),
      (supabase as any).from("job_cards").select("id, job_number, customer_name, vehicle_reg, status").eq("business_id", biz).or(`job_number.ilike.${like},customer_name.ilike.${like},vehicle_reg.ilike.${like}`).limit(5),
      (supabase as any).from("prescriptions").select("id, rx_number, patient_name, status").eq("business_id", biz).or(`rx_number.ilike.${like},patient_name.ilike.${like}`).limit(5),
      (supabase as any).from("hotel_bookings").select("id, guest_name, guest_phone, status").eq("business_id", biz).ilike("guest_name", like).limit(5),
      (supabase as any).from("fleet_vehicles").select("id, registration, make, model, status").eq("business_id", biz).or(`registration.ilike.${like},make.ilike.${like},model.ilike.${like}`).limit(5),
    ]);

    const r: SearchResult[] = [];

    (customers.data || []).forEach((c: any) =>
      r.push({ id: c.id, label: c.name, sublabel: c.phone || "", category: "Customers", icon: Users, url: "/customers" }));
    (products.data || []).forEach((p: any) =>
      r.push({ id: p.id, label: p.name, sublabel: `${p.sku || ""} · GHS ${Number(p.selling_price).toFixed(2)}`, category: "Products", icon: Package, url: "/inventory" }));
    (invoices.data || []).forEach((i: any) =>
      r.push({ id: i.id, label: i.invoice_number, sublabel: `${i.customer_name} · GHS ${Number(i.total).toFixed(2)}`, category: "Invoices", icon: FileText, url: "/invoices" }));
    (suppliers.data || []).forEach((s: any) =>
      r.push({ id: s.id, label: s.name, sublabel: s.phone || "", category: "Suppliers", icon: Truck, url: "/suppliers" }));
    (leads.data || []).forEach((l: any) =>
      r.push({ id: l.id, label: l.name, sublabel: l.company || "", category: "Leads", icon: Handshake, url: "/crm" }));
    (opportunities.data || []).forEach((o: any) =>
      r.push({ id: o.id, label: o.name, sublabel: `${o.stage} · GHS ${Number(o.value || 0).toLocaleString()}`, category: "Opportunities", icon: Target, url: "/crm" }));
    (projects.data || []).forEach((p: any) =>
      r.push({ id: p.id, label: p.name, sublabel: p.status, category: "Projects", icon: FolderKanban, url: "/projects" }));
    (jobCards.data || []).forEach((j: any) =>
      r.push({ id: j.id, label: j.job_number, sublabel: `${j.customer_name} · ${j.vehicle_reg} · ${j.status}`, category: "Job Cards", icon: Wrench, url: "/garage" }));
    (prescriptions.data || []).forEach((p: any) =>
      r.push({ id: p.id, label: p.rx_number, sublabel: `${p.patient_name} · ${p.status}`, category: "Prescriptions", icon: Pill, url: "/pharmacy-rx" }));
    (hotelBookings.data || []).forEach((b: any) =>
      r.push({ id: b.id, label: b.guest_name, sublabel: `${b.guest_phone || ""} · ${b.status}`, category: "Hotel Bookings", icon: BedDouble, url: "/hotel-mgmt" }));
    (fleetVehicles.data || []).forEach((v: any) =>
      r.push({ id: v.id, label: v.registration, sublabel: `${v.make} ${v.model} · ${v.status}`, category: "Fleet", icon: ClipboardList, url: "/fleet" }));

    setResults(r);
    setLoading(false);
  }, [business?.id]);

  useEffect(() => { search(debouncedQuery); }, [debouncedQuery, search]);

  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    (acc[r.category] ??= []).push(r);
    return acc;
  }, {});

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg border border-border bg-secondary/50 px-3 py-1.5 text-sm text-muted-foreground hover:bg-secondary transition-colors"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Search…</span>
        <kbd className="hidden md:inline-flex h-5 items-center gap-0.5 rounded border border-border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
          ⌘K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search customers, products, job cards, Rx…" value={query} onValueChange={setQuery} />
        <CommandList>
          {loading && <div className="py-6 text-center text-sm text-muted-foreground">Searching…</div>}
          {!loading && debouncedQuery.length >= 2 && results.length === 0 && (
            <CommandEmpty>No results found for "{debouncedQuery}"</CommandEmpty>
          )}
          {Object.entries(grouped).map(([category, items]) => (
            <CommandGroup key={category} heading={category}>
              {items.map((item) => (
                <CommandItem
                  key={item.id}
                  onSelect={() => { navigate(item.url); setOpen(false); setQuery(""); }}
                  className="flex items-center gap-3"
                >
                  <item.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.label}</p>
                    {item.sublabel && <p className="text-xs text-muted-foreground truncate">{item.sublabel}</p>}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
}
