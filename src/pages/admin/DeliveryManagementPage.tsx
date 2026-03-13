import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { Search, Truck, Phone, Mail, MapPin, Settings2, Wallet, ChevronDown, User } from "lucide-react";
import DeliveryChargeRules from "@/components/admin/DeliveryChargeRules";

interface DeliveryStaff {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  mobile_number: string | null;
  is_approved: boolean;
  created_at: string;
  local_body_id: string | null;
  ward_number: number | null;
  local_body_name?: string | null;
  district_name?: string | null;
  delivery_type?: "fixed" | "part_time";
  assigned_wards?: { local_body_id: string; local_body_name: string; ward_number: number }[];
}

interface LocalBody {
  id: string;
  name: string;
  ward_count: number;
  district_id: string;
}

const DeliveryManagementPage = () => {
  const [staff, setStaff] = useState<DeliveryStaff[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [localBodies, setLocalBodies] = useState<LocalBody[]>([]);
  const [wardDialogOpen, setWardDialogOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<DeliveryStaff | null>(null);
  const [selectedLB, setSelectedLB] = useState("");
  const [selectedWards, setSelectedWards] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Settle dialog
  const [settleDialogOpen, setSettleDialogOpen] = useState(false);
  const [settleStaff, setSettleStaff] = useState<DeliveryStaff | null>(null);
  const [settleAmount, setSettleAmount] = useState("");
  const [settleNote, setSettleNote] = useState("");
  const [settleBalance, setSettleBalance] = useState(0);
  const [settleEarningBalance, setSettleEarningBalance] = useState(0);
  const [settleType, setSettleType] = useState<"collection" | "earning">("collection");
  const [settling, setSettling] = useState(false);
  const { toast } = useToast();

  const fetchStaff = async () => {
    setLoading(true);
    const [profilesRes, localBodiesRes, districtsRes, assignmentsRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_type", "delivery_staff"),
      supabase.from("locations_local_bodies").select("id, name, district_id, ward_count"),
      supabase.from("locations_districts").select("id, name"),
      supabase.from("delivery_staff_ward_assignments").select("*"),
    ]);

    const lbs = localBodiesRes.data ?? [];
    const districts = districtsRes.data ?? [];
    const assignments = assignmentsRes.data ?? [];
    setLocalBodies(lbs as LocalBody[]);

    const enriched = ((profilesRes.data ?? []) as unknown as DeliveryStaff[]).map((s) => {
      const staffAssignments = assignments
        .filter((a: any) => a.staff_user_id === s.user_id)
        .map((a: any) => {
          const lb = lbs.find((l) => l.id === a.local_body_id);
          return { local_body_id: a.local_body_id, local_body_name: lb?.name ?? "", ward_number: a.ward_number };
        });

      let local_body_name: string | null = null;
      let district_name: string | null = null;
      if (s.local_body_id) {
        const lb = lbs.find((l) => l.id === s.local_body_id);
        if (lb) {
          local_body_name = lb.name;
          const dist = districts.find((d) => d.id === lb.district_id);
          district_name = dist?.name ?? null;
        }
      }
      const delivery_type = ((s as any).delivery_type ?? "fixed") as "fixed" | "part_time";
      return { ...s, local_body_name, district_name, delivery_type, assigned_wards: staffAssignments };
    });

    setStaff(enriched);
    setLoading(false);
  };

  useEffect(() => { fetchStaff(); }, []);

  const toggleApproval = async (userId: string, current: boolean) => {
    const { error } = await supabase.from("profiles").update({ is_approved: !current }).eq("user_id", userId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: !current ? "Staff approved" : "Staff unapproved" });
      fetchStaff();
    }
  };

  const toggleDeliveryType = async (userId: string, currentType: "fixed" | "part_time") => {
    const newType = currentType === "fixed" ? "part_time" : "fixed";
    const { error } = await supabase.from("profiles").update({ delivery_type: newType } as any).eq("user_id", userId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `Changed to ${newType === "part_time" ? "Part-time" : "Fixed"} partner` });
      fetchStaff();
    }
  };

  const openWardDialog = (s: DeliveryStaff) => {
    setSelectedStaff(s);
    setSelectedLB(s.local_body_id ?? "");
    setSelectedWards(
      (s.assigned_wards ?? [])
        .filter((w) => w.local_body_id === (s.local_body_id ?? ""))
        .map((w) => w.ward_number)
    );
    setWardDialogOpen(true);
  };

  const handleLBChange = (lbId: string) => {
    setSelectedLB(lbId);
    const existing = (selectedStaff?.assigned_wards ?? [])
      .filter((w) => w.local_body_id === lbId)
      .map((w) => w.ward_number);
    setSelectedWards(existing);
  };

  const toggleWard = (ward: number) => {
    setSelectedWards((prev) =>
      prev.includes(ward) ? prev.filter((w) => w !== ward) : [...prev, ward]
    );
  };

  const saveWardAssignments = async () => {
    if (!selectedStaff || !selectedLB) return;
    setSaving(true);
    await supabase
      .from("delivery_staff_ward_assignments")
      .delete()
      .eq("staff_user_id", selectedStaff.user_id)
      .eq("local_body_id", selectedLB);

    if (selectedWards.length > 0) {
      const rows = selectedWards.map((w) => ({
        staff_user_id: selectedStaff.user_id,
        local_body_id: selectedLB,
        ward_number: w,
      }));
      const { error } = await supabase.from("delivery_staff_ward_assignments").insert(rows);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        setSaving(false);
        return;
      }
    }

    toast({ title: "Ward assignments saved" });
    setSaving(false);
    setWardDialogOpen(false);
    fetchStaff();
  };

  const openSettleDialog = async (s: DeliveryStaff) => {
    setSettleStaff(s);
    setSettleAmount("");
    setSettleNote("");
    setSettleType("collection");
    const { data } = await supabase.from("delivery_staff_wallets").select("balance, earning_balance").eq("staff_user_id", s.user_id).maybeSingle();
    setSettleBalance((data as any)?.balance ?? 0);
    setSettleEarningBalance((data as any)?.earning_balance ?? 0);
    setSettleDialogOpen(true);
  };

  const handleSettle = async () => {
    if (!settleStaff || !settleAmount || Number(settleAmount) <= 0) return;
    const amt = Number(settleAmount);
    const isEarningSettle = settleType === "earning";
    const maxBalance = isEarningSettle ? settleEarningBalance : settleBalance;

    if (amt > maxBalance) {
      toast({ title: "Error", description: `Amount exceeds ${isEarningSettle ? "earning" : "wallet"} balance`, variant: "destructive" });
      return;
    }
    setSettling(true);

    let { data: wallet } = await supabase.from("delivery_staff_wallets").select("id, balance, earning_balance").eq("staff_user_id", settleStaff.user_id).maybeSingle();
    if (!wallet) {
      const { data: newW } = await supabase.from("delivery_staff_wallets").insert({ staff_user_id: settleStaff.user_id }).select("id, balance, earning_balance").single();
      wallet = newW;
    }
    if (!wallet) { setSettling(false); return; }

    const txType = isEarningSettle ? "earning_settlement" : "settlement";
    const txDesc = isEarningSettle
      ? settleNote || "Earning payment by office"
      : settleNote || "Collection settlement by admin";

    const { error: txErr } = await supabase.from("delivery_staff_wallet_transactions").insert({
      staff_user_id: settleStaff.user_id,
      wallet_id: (wallet as any).id,
      amount: amt,
      type: txType,
      description: txDesc,
    });
    if (txErr) {
      toast({ title: "Error", description: txErr.message, variant: "destructive" });
      setSettling(false);
      return;
    }

    const updatePayload = isEarningSettle
      ? { earning_balance: (wallet as any).earning_balance - amt }
      : { balance: (wallet as any).balance - amt };

    const { error: walErr } = await supabase.from("delivery_staff_wallets").update(updatePayload as any).eq("staff_user_id", settleStaff.user_id);
    if (walErr) {
      toast({ title: "Error", description: walErr.message, variant: "destructive" });
      setSettling(false);
      return;
    }

    toast({ title: "Settlement recorded", description: `₹${amt} ${isEarningSettle ? "earning paid" : "settled"} for ${settleStaff.full_name}` });
    setSettling(false);
    setSettleDialogOpen(false);
  };

  const filtered = staff.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.full_name?.toLowerCase().includes(q) ||
      s.email?.toLowerCase().includes(q) ||
      s.mobile_number?.includes(q)
    );
  });

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const approvedCount = staff.filter((s) => s.is_approved).length;
  const pendingCount = staff.filter((s) => !s.is_approved).length;
  const selectedLBData = localBodies.find((l) => l.id === selectedLB);

  const getWardSummary = (s: DeliveryStaff) => {
    const wards = s.assigned_wards ?? [];
    if (wards.length === 0) return null;
    const grouped: Record<string, number[]> = {};
    wards.forEach((w) => {
      if (!grouped[w.local_body_name]) grouped[w.local_body_name] = [];
      grouped[w.local_body_name].push(w.ward_number);
    });
    return grouped;
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Truck className="h-6 w-6 text-primary" />
              Delivery Staff Management
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Manage, approve and assign wards to delivery staff</p>
          </div>
          <div className="flex gap-3">
            <Badge variant="default" className="text-sm px-3 py-1">{approvedCount} Approved</Badge>
            <Badge variant="secondary" className="text-sm px-3 py-1">{pendingCount} Pending</Badge>
            <Badge variant="outline" className="text-sm px-3 py-1">{staff.length} Total</Badge>
          </div>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by name, email, or phone..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">No delivery staff found</div>
        ) : (
          <div className="space-y-3">
            {filtered.map((s) => {
              const isOpen = expandedIds.has(s.id);
              const wardGroups = getWardSummary(s);

              return (
                <Collapsible key={s.id} open={isOpen} onOpenChange={() => toggleExpanded(s.id)}>
                  <div className="rounded-lg border bg-card">
                    {/* Collapsed header */}
                    <CollapsibleTrigger asChild>
                      <button className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/50 transition-colors rounded-lg">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold truncate">{s.full_name ?? "—"}</span>
                            <Badge variant={s.is_approved ? "default" : "secondary"} className="text-xs">
                              {s.is_approved ? "Active" : "Pending"}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {s.delivery_type === "part_time" ? "Part-time" : "Fixed"}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 text-sm text-muted-foreground">
                            {s.mobile_number && <span>{s.mobile_number}</span>}
                            {s.local_body_name && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {s.local_body_name}
                              </span>
                            )}
                            {wardGroups && (
                              <span className="text-xs">
                                {Object.values(wardGroups).flat().length} ward(s)
                              </span>
                            )}
                          </div>
                        </div>
                        <ChevronDown className={`h-5 w-5 text-muted-foreground shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                      </button>
                    </CollapsibleTrigger>

                    {/* Expanded content */}
                    <CollapsibleContent>
                      <div className="px-4 pb-4 pt-0 space-y-4 border-t">
                        {/* Contact & Location */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                          <div className="space-y-2">
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contact</h4>
                            {s.email && (
                              <div className="flex items-center gap-2 text-sm">
                                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                                {s.email}
                              </div>
                            )}
                            {s.mobile_number && (
                              <div className="flex items-center gap-2 text-sm">
                                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                                {s.mobile_number}
                              </div>
                            )}
                          </div>
                          <div className="space-y-2">
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Location</h4>
                            {s.local_body_name || s.district_name ? (
                              <div className="flex items-center gap-2 text-sm">
                                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                                <span>
                                  {s.local_body_name}{s.district_name && <span className="text-muted-foreground">, {s.district_name}</span>}
                                </span>
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">Not set</span>
                            )}
                          </div>
                        </div>

                        {/* Assigned Wards */}
                        <div className="space-y-2">
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Assigned Wards</h4>
                          {wardGroups ? (
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(wardGroups).map(([name, wards]) => (
                                <div key={name} className="rounded-md border bg-muted/50 px-3 py-1.5 text-sm">
                                  <span className="font-medium">{name}</span>
                                  <span className="text-muted-foreground ml-1.5">
                                    W{wards.sort((a, b) => a - b).join(", W")}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">No wards assigned</span>
                          )}
                        </div>

                        {/* Controls */}
                        <div className="flex flex-wrap items-center gap-4 pt-2 border-t">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Approved</span>
                            <Switch checked={s.is_approved} onCheckedChange={() => toggleApproval(s.user_id, s.is_approved)} />
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleDeliveryType(s.user_id, s.delivery_type ?? "fixed"); }}
                            className="focus:outline-none"
                          >
                            <Badge variant={s.delivery_type === "part_time" ? "default" : "secondary"} className="cursor-pointer hover:opacity-80 transition-opacity">
                              {s.delivery_type === "part_time" ? "Part-time" : "Fixed"} — Click to toggle
                            </Badge>
                          </button>
                          <div className="flex gap-2 ml-auto">
                            <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); openWardDialog(s); }}>
                              <Settings2 className="h-4 w-4 mr-1" /> Wards
                            </Button>
                            <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); openSettleDialog(s); }}>
                              <Wallet className="h-4 w-4 mr-1" /> Settle
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })}
          </div>
        )}
      </div>

      {/* Ward Assignment Dialog */}
      <Dialog open={wardDialogOpen} onOpenChange={setWardDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Wards — {selectedStaff?.full_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Panchayath / Local Body</label>
              <Select value={selectedLB} onValueChange={handleLBChange}>
                <SelectTrigger><SelectValue placeholder="Select panchayath" /></SelectTrigger>
                <SelectContent>
                  {localBodies.map((lb) => (
                    <SelectItem key={lb.id} value={lb.id}>{lb.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedLBData && (
              <div>
                <label className="text-sm font-medium mb-2 block">Select Wards (1–{selectedLBData.ward_count})</label>
                <div className="grid grid-cols-5 gap-2 max-h-48 overflow-y-auto">
                  {Array.from({ length: selectedLBData.ward_count }, (_, i) => i + 1).map((w) => (
                    <label key={w} className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <Checkbox checked={selectedWards.includes(w)} onCheckedChange={() => toggleWard(w)} />
                      W{w}
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setWardDialogOpen(false)}>Cancel</Button>
              <Button onClick={saveWardAssignments} disabled={saving}>
                {saving ? "Saving..." : "Save Assignments"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Settlement Dialog */}
      <Dialog open={settleDialogOpen} onOpenChange={setSettleDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Settlement — {settleStaff?.full_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {settleStaff?.delivery_type === "part_time" && (
              <div className="flex rounded-lg border overflow-hidden">
                <button
                  onClick={() => setSettleType("collection")}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${settleType === "collection" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
                >
                  Collection Settlement
                </button>
                <button
                  onClick={() => setSettleType("earning")}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${settleType === "earning" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
                >
                  Earning Payment
                </button>
              </div>
            )}

            <div className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Collection Balance</span>
                <span className="font-bold">₹{settleBalance}</span>
              </div>
              {settleStaff?.delivery_type === "part_time" && (
                <div className="flex items-center justify-between border-t pt-2">
                  <span className="text-sm text-muted-foreground">Earning Balance</span>
                  <span className="font-bold text-primary">₹{settleEarningBalance}</span>
                </div>
              )}
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">
                {settleType === "earning" ? "Earning Payment Amount (₹)" : "Settlement Amount (₹)"}
              </label>
              <Input
                type="number"
                placeholder="Enter amount"
                value={settleAmount}
                onChange={(e) => setSettleAmount(e.target.value)}
                min={1}
                max={settleType === "earning" ? settleEarningBalance : settleBalance}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Max: ₹{settleType === "earning" ? settleEarningBalance : settleBalance}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Note (optional)</label>
              <Input
                placeholder={settleType === "earning" ? "e.g. Weekly earning payment" : "e.g. Cash collected on 17 Feb"}
                value={settleNote}
                onChange={(e) => setSettleNote(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSettleDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSettle} disabled={settling || !settleAmount || Number(settleAmount) <= 0}>
                {settling ? "Processing..." : settleType === "earning" ? `Pay Earning ₹${settleAmount || 0}` : `Settle ₹${settleAmount || 0}`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* Delivery Charge Rules Section */}
      <div className="mt-8 border-t border-border pt-6">
        <DeliveryChargeRules />
      </div>
    </AdminLayout>
  );
};

export default DeliveryManagementPage;
