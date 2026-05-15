import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Users, Loader2, Download, Gift } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import ImageUpload from "@/components/admin/ImageUpload";
import { useAuth } from "@/hooks/useAuth";

interface ScratchCardRow {
  id: string;
  title: string;
  subtitle: string | null;
  cover_image_url: string | null;
  reveal_text: string | null;
  reveal_image_url: string | null;
  reward_amount: number;
  target_audience: string;
  target_local_body_ids: string[];
  start_at: string;
  end_at: string;
  is_active: boolean;
  max_claims_per_user: number;
  requires_agent_streak_days: number | null;
  created_at: string;
  product_link_url: string | null;
  product_discount_text: string | null;
  coupon_type?: "amount" | "product";
}

interface LocalBody {
  id: string;
  name: string;
  body_type: string;
}

const PROJECT_ID = "xxlocaexuoowxdzupjcs";

const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const ScratchRewardsPage = () => {
  const { session } = useAuth();
  const [cards, setCards] = useState<ScratchCardRow[]>([]);
  const [localBodies, setLocalBodies] = useState<LocalBody[]>([]);
  const [editing, setEditing] = useState<Partial<ScratchCardRow> | null>(null);
  const [claimsFor, setClaimsFor] = useState<ScratchCardRow | null>(null);
  const [claims, setClaims] = useState<any[]>([]);
  const [claimsLoading, setClaimsLoading] = useState(false);
  const [claimCounts, setClaimCounts] = useState<Record<string, number>>({});

  const fetchData = async () => {
    const [{ data: cs }, { data: lbs }, { data: allClaims }] = await Promise.all([
      supabase.from("scratch_cards").select("*").order("created_at", { ascending: false }),
      supabase.from("locations_local_bodies").select("id, name, body_type").eq("is_active", true).order("name"),
      supabase.from("scratch_card_claims").select("card_id"),
    ]);
    setCards((cs ?? []) as ScratchCardRow[]);
    setLocalBodies(lbs ?? []);
    const counts: Record<string, number> = {};
    (allClaims ?? []).forEach((c: any) => {
      counts[c.card_id] = (counts[c.card_id] || 0) + 1;
    });
    setClaimCounts(counts);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const startNew = () => {
    const now = new Date();
    const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    setEditing({
      target_audience: "all",
      target_local_body_ids: [],
      is_active: true,
      reward_amount: 0,
      max_claims_per_user: 1,
      start_at: now.toISOString(),
      end_at: end.toISOString(),
      coupon_type: "amount",
    });
  };

  const handleSave = async () => {
    const cType = editing?.coupon_type || (editing?.product_link_url ? "product" : "amount");
    if (!editing?.title) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }
    if (cType === "amount" && !editing?.reward_amount) {
      toast({ title: "Reward amount is required for amount coupon", variant: "destructive" });
      return;
    }
    if (cType === "product" && !editing?.product_link_url) {
      toast({ title: "Product URL is required for product coupon", variant: "destructive" });
      return;
    }
    const payload = {
      title: editing.title,
      subtitle: editing.subtitle || null,
      cover_image_url: editing.cover_image_url || null,
      reveal_text: editing.reveal_text || null,
      reveal_image_url: editing.reveal_image_url || null,
      reward_amount: Number(editing.reward_amount) || 0,
      target_audience: editing.target_audience || "all",
      target_local_body_ids: editing.target_local_body_ids || [],
      start_at: editing.start_at ? new Date(editing.start_at).toISOString() : new Date().toISOString(),
      end_at: editing.end_at ? new Date(editing.end_at).toISOString() : new Date(Date.now() + 7 * 86400000).toISOString(),
      is_active: editing.is_active ?? true,
      max_claims_per_user: Math.max(1, Number(editing.max_claims_per_user) || 1),
      requires_agent_streak_days:
        editing.target_audience === "agents" && editing.requires_agent_streak_days
          ? Math.max(1, Number(editing.requires_agent_streak_days))
          : null,
      product_link_url: editing.product_link_url || null,
      product_discount_text: editing.product_discount_text || null,
    };
    const { error } = editing.id
      ? await supabase.from("scratch_cards").update(payload).eq("id", editing.id)
      : await supabase.from("scratch_cards").insert(payload);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Scratch card saved" });
    setEditing(null);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this scratch card? Existing claims will also be removed.")) return;
    const { error } = await supabase.from("scratch_cards").delete().eq("id", id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Deleted" });
    fetchData();
  };

  const openClaims = async (c: ScratchCardRow) => {
    setClaimsFor(c);
    setClaims([]);
    setClaimsLoading(true);
    try {
      const res = await fetch(
        `https://${PROJECT_ID}.supabase.co/functions/v1/scratch-claim?action=claims&card_id=${c.id}`,
        { headers: { Authorization: `Bearer ${session?.access_token}` } },
      );
      const data = await res.json();
      setClaims(data?.claims ?? []);
    } catch {
      toast({ title: "Failed to load claims", variant: "destructive" });
    } finally {
      setClaimsLoading(false);
    }
  };

  const targetSummary = (c: ScratchCardRow) => {
    if (c.target_audience === "all") return "All Users";
    if (c.target_audience === "agents")
      return c.requires_agent_streak_days
        ? `Agents (${c.requires_agent_streak_days}-day streak)`
        : "e-Life Agents";
    if (c.target_audience === "panchayath") {
      const names = c.target_local_body_ids
        .map((id) => localBodies.find((lb) => lb.id === id)?.name)
        .filter(Boolean)
        .slice(0, 2);
      return `Panchayath: ${names.join(", ")}${c.target_local_body_ids.length > 2 ? "..." : ""}`;
    }
    return c.target_audience;
  };

  const toggleLocalBody = (id: string) => {
    const cur = editing?.target_local_body_ids || [];
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    setEditing({ ...editing, target_local_body_ids: next });
  };

  const exportClaimsCSV = () => {
    const safeTitle = (claimsFor?.title || "card").replace(/[^a-z0-9]+/gi, "_");
    const rows: any[][] = [["Name", "Mobile", "Panchayath", "Ward", "Reward", "Claimed At"]];
    claims.forEach((c: any) => {
      rows.push([
        c.full_name || "",
        c.mobile_number || "",
        c.local_body_name || "",
        c.ward_number ?? "",
        c.reward_amount,
        c.claimed_at,
      ]);
    });
    const escape = (v: any) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = rows.map((r) => r.map(escape).join(",")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeTitle}_claims.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Gift className="h-6 w-6 text-primary" /> Scratch & Win Rewards
            </h1>
            <p className="text-sm text-muted-foreground">
              Create scratchable reward cards. Same audience controls as Notifications, plus optional agent work-log streak.
            </p>
          </div>
          <Button onClick={startNew}>
            <Plus className="h-4 w-4 mr-2" /> New Scratch Card
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Audience</TableHead>
                    <TableHead className="text-right">Reward</TableHead>
                    <TableHead>Window</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Claims</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cards.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No scratch cards yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    cards.map((c) => {
                      const now = Date.now();
                      const live =
                        c.is_active &&
                        new Date(c.start_at).getTime() <= now &&
                        new Date(c.end_at).getTime() >= now;
                      return (
                        <TableRow key={c.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {c.cover_image_url && (
                                <img src={c.cover_image_url} alt="" className="w-8 h-8 rounded object-cover" />
                              )}
                              <div>
                                <p className="font-medium">{c.title}</p>
                                {c.subtitle && (
                                  <p className="text-xs text-muted-foreground line-clamp-1 max-w-xs">{c.subtitle}</p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{targetSummary(c)}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-semibold">₹{c.reward_amount}</TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(c.start_at).toLocaleDateString()} →{" "}
                            {new Date(c.end_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Badge variant={live ? "default" : "secondary"}>
                              {live ? "Live" : c.is_active ? "Scheduled" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">{claimCounts[c.id] || 0}</TableCell>
                          <TableCell className="text-right">
                            <Button size="icon" variant="ghost" onClick={() => openClaims(c)} title="View claims">
                              <Users className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => setEditing(c)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => handleDelete(c.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Create / edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit Scratch Card" : "New Scratch Card"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="font-semibold mb-2 block">Coupon Type *</Label>
              <RadioGroup
                value={editing?.coupon_type || (editing?.product_link_url ? "product" : "amount")}
                onValueChange={(v) => setEditing({ ...editing, coupon_type: v as "amount" | "product" })}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="amount" id="ct-amount" />
                  <Label htmlFor="ct-amount" className="cursor-pointer">💰 Amount Coupon (wallet reward)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="product" id="ct-product" />
                  <Label htmlFor="ct-product" className="cursor-pointer">🛒 Product Coupon (link + discount)</Label>
                </div>
              </RadioGroup>
            </div>

            <div>
              <Label>Title *</Label>
              <Input
                value={editing?.title || ""}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                placeholder="Diwali ₹50 reward"
              />
            </div>

            <div>
              <Label>Subtitle</Label>
              <Input
                value={editing?.subtitle || ""}
                onChange={(e) => setEditing({ ...editing, subtitle: e.target.value })}
                placeholder="Tap to scratch and win"
              />
            </div>

            <ImageUpload
              bucket="banners"
              value={editing?.cover_image_url || ""}
              onChange={(url) => setEditing({ ...editing, cover_image_url: url })}
              label="Cover image (optional)"
            />

            <div>
              <Label>Reveal text (shown after scratching)</Label>
              <Textarea
                rows={2}
                value={editing?.reveal_text || ""}
                onChange={(e) => setEditing({ ...editing, reveal_text: e.target.value })}
                placeholder="Congratulations! Use it on your next order."
              />
            </div>

            <ImageUpload
              bucket="banners"
              value={editing?.reveal_image_url || ""}
              onChange={(url) => setEditing({ ...editing, reveal_image_url: url })}
              label="Reveal image (optional)"
            />

            {(editing?.coupon_type || (editing?.product_link_url ? "product" : "amount")) === "amount" && (
              <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
                <Label className="font-semibold">💰 Wallet Reward</Label>
                <div>
                  <Label>Reward amount (₹) *</Label>
                  <Input
                    type="number"
                    min={1}
                    value={editing?.reward_amount ?? 0}
                    onChange={(e) => setEditing({ ...editing, reward_amount: Number(e.target.value) })}
                  />
                </div>
              </div>
            )}

            {(editing?.coupon_type || (editing?.product_link_url ? "product" : "amount")) === "product" && (
              <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
                <Label className="font-semibold">🛒 Product Link with Special Discount</Label>
                <div>
                  <Label>Product URL *</Label>
                  <Input
                    value={editing?.product_link_url || ""}
                    onChange={(e) => setEditing({ ...editing, product_link_url: e.target.value })}
                    placeholder="https://example.com/product/123 or /customer/product/abc"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Customer sees a "Get Benefit" button after scratching.
                  </p>
                </div>
                <div>
                  <Label>Discount description</Label>
                  <Input
                    value={editing?.product_discount_text || ""}
                    onChange={(e) => setEditing({ ...editing, product_discount_text: e.target.value })}
                    placeholder="Get 20% off on this product!"
                  />
                </div>
                <div>
                  <Label>Bonus wallet amount (₹) — optional</Label>
                  <Input
                    type="number"
                    min={0}
                    value={editing?.reward_amount ?? 0}
                    onChange={(e) => setEditing({ ...editing, reward_amount: Number(e.target.value) })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Leave 0 if no wallet reward; only the product discount applies.
                  </p>
                </div>
              </div>
            )}

            <div>
              <Label>Target Audience</Label>
              <Select
                value={editing?.target_audience || "all"}
                onValueChange={(v) => setEditing({ ...editing, target_audience: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  <SelectItem value="agents">e-Life Agents Only</SelectItem>
                  <SelectItem value="panchayath">Selected Panchayaths</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {editing?.target_audience === "panchayath" && (
              <div>
                <Label>Select Panchayaths ({editing.target_local_body_ids?.length || 0} selected)</Label>
                <div className="border rounded-md max-h-48 overflow-y-auto p-2 space-y-1 mt-1">
                  {localBodies.map((lb) => (
                    <label key={lb.id} className="flex items-center gap-2 px-2 py-1 hover:bg-muted rounded cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={editing.target_local_body_ids?.includes(lb.id) || false}
                        onChange={() => toggleLocalBody(lb.id)}
                      />
                      <span>{lb.name}</span>
                      <Badge variant="outline" className="ml-auto text-[10px]">{lb.body_type}</Badge>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {editing?.target_audience === "agents" && (
              <div>
                <Label>Required consecutive "Today's Work" days (optional)</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="0 = no streak requirement"
                  value={editing?.requires_agent_streak_days ?? ""}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      requires_agent_streak_days: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Agent must have updated "Today's Work" for N consecutive days ending today to claim.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Start at</Label>
                <Input
                  type="datetime-local"
                  value={editing?.start_at ? toLocalInput(editing.start_at) : ""}
                  onChange={(e) =>
                    setEditing({ ...editing, start_at: new Date(e.target.value).toISOString() })
                  }
                />
              </div>
              <div>
                <Label>End at</Label>
                <Input
                  type="datetime-local"
                  value={editing?.end_at ? toLocalInput(editing.end_at) : ""}
                  onChange={(e) =>
                    setEditing({ ...editing, end_at: new Date(e.target.value).toISOString() })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Max claims per user</Label>
                <Input
                  type="number"
                  min={1}
                  value={editing?.max_claims_per_user ?? 1}
                  onChange={(e) =>
                    setEditing({ ...editing, max_claims_per_user: Number(e.target.value) })
                  }
                />
              </div>
              <div className="flex items-end justify-between">
                <Label>Active</Label>
                <Switch
                  checked={editing?.is_active ?? true}
                  onCheckedChange={(c) => setEditing({ ...editing, is_active: c })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Claims dialog */}
      <Dialog open={!!claimsFor} onOpenChange={(o) => !o && setClaimsFor(null)}>
        <DialogContent className="max-w-3xl w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Claims: {claimsFor?.title}</DialogTitle>
          </DialogHeader>
          {claimsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{claims.length} claim(s)</p>
                <Button size="sm" variant="outline" onClick={exportClaimsCSV} disabled={!claims.length}>
                  <Download className="h-4 w-4 mr-1" /> Export CSV
                </Button>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Mobile</TableHead>
                      <TableHead>Panchayath</TableHead>
                      <TableHead>Ward</TableHead>
                      <TableHead className="text-right">Reward</TableHead>
                      <TableHead>Claimed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {claims.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                          No claims yet
                        </TableCell>
                      </TableRow>
                    ) : (
                      claims.map((c: any) => (
                        <TableRow key={c.id}>
                          <TableCell>{c.full_name || "-"}</TableCell>
                          <TableCell className="text-xs">{c.mobile_number || "-"}</TableCell>
                          <TableCell>{c.local_body_name || "-"}</TableCell>
                          <TableCell>Ward {c.ward_number ?? "-"}</TableCell>
                          <TableCell className="text-right">₹{c.reward_amount}</TableCell>
                          <TableCell className="text-xs">
                            {new Date(c.claimed_at).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default ScratchRewardsPage;
