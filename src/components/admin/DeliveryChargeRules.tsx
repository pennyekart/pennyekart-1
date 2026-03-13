import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Truck, Package, Clock, Gift } from "lucide-react";

interface DeliveryChargeRule {
  id: string;
  rule_type: "category" | "godown" | "free_delivery" | "time_based";
  name: string;
  is_active: boolean;
  category_name: string | null;
  godown_id: string | null;
  charge_amount: number;
  min_purchase_amount: number;
  time_slot_label: string | null;
  time_slot_start: string | null;
  time_slot_end: string | null;
  priority: number;
}

interface Godown {
  id: string;
  name: string;
  godown_type: string;
}

interface Category {
  id: string;
  name: string;
}

const emptyRule: DeliveryChargeRule = {
  id: "",
  rule_type: "category",
  name: "",
  is_active: true,
  category_name: null,
  godown_id: null,
  charge_amount: 0,
  min_purchase_amount: 0,
  time_slot_label: null,
  time_slot_start: null,
  time_slot_end: null,
  priority: 0,
};

const RULE_TYPES = [
  { value: "category", label: "Category-wise", icon: Package, desc: "Charge based on product category" },
  { value: "godown", label: "Godown-wise", icon: Truck, desc: "Charge based on delivery godown" },
  { value: "free_delivery", label: "Free Delivery", icon: Gift, desc: "Free delivery above min purchase" },
  { value: "time_based", label: "Time-based", icon: Clock, desc: "Express/scheduled delivery charges" },
];

const DeliveryChargeRules = () => {
  const { toast } = useToast();
  const [rules, setRules] = useState<DeliveryChargeRule[]>([]);
  const [godowns, setGodowns] = useState<Godown[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DeliveryChargeRule>(emptyRule);
  const [isEdit, setIsEdit] = useState(false);
  const [tab, setTab] = useState("category");

  const fetchAll = async () => {
    setLoading(true);
    const [rulesRes, godownsRes, catsRes] = await Promise.all([
      supabase.from("delivery_charge_rules").select("*").order("priority"),
      supabase.from("godowns").select("id, name, godown_type").eq("is_active", true),
      supabase.from("categories").select("id, name").eq("is_active", true).order("name"),
    ]);
    setRules((rulesRes.data as any[]) ?? []);
    setGodowns(godownsRes.data ?? []);
    setCategories(catsRes.data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const openCreate = (type: string) => {
    setEditing({ ...emptyRule, rule_type: type as any });
    setIsEdit(false);
    setDialogOpen(true);
  };

  const openEdit = (rule: DeliveryChargeRule) => {
    setEditing({ ...rule });
    setIsEdit(true);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!editing.name.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }

    const payload: any = {
      rule_type: editing.rule_type,
      name: editing.name,
      is_active: editing.is_active,
      category_name: editing.rule_type === "category" ? editing.category_name : null,
      godown_id: editing.rule_type === "godown" ? editing.godown_id : null,
      charge_amount: editing.charge_amount,
      min_purchase_amount: editing.rule_type === "free_delivery" ? editing.min_purchase_amount : 0,
      time_slot_label: editing.rule_type === "time_based" ? editing.time_slot_label : null,
      time_slot_start: editing.rule_type === "time_based" ? editing.time_slot_start : null,
      time_slot_end: editing.rule_type === "time_based" ? editing.time_slot_end : null,
      priority: editing.priority,
    };

    let error;
    if (isEdit) {
      ({ error } = await supabase.from("delivery_charge_rules").update(payload).eq("id", editing.id));
    } else {
      ({ error } = await supabase.from("delivery_charge_rules").insert(payload));
    }

    if (error) {
      toast({ title: "Error saving rule", description: error.message, variant: "destructive" });
    } else {
      toast({ title: isEdit ? "Rule updated" : "Rule created" });
      setDialogOpen(false);
      fetchAll();
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("delivery_charge_rules").delete().eq("id", id);
    if (error) {
      toast({ title: "Error deleting", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Rule deleted" });
      fetchAll();
    }
  };

  const toggleActive = async (rule: DeliveryChargeRule) => {
    await supabase.from("delivery_charge_rules").update({ is_active: !rule.is_active }).eq("id", rule.id);
    fetchAll();
  };

  const filtered = rules.filter(r => r.rule_type === tab);

  const getGodownName = (id: string | null) => godowns.find(g => g.id === id)?.name ?? "—";

  const renderTable = () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          {tab === "category" && <TableHead>Category</TableHead>}
          {tab === "godown" && <TableHead>Godown</TableHead>}
          {tab === "time_based" && <TableHead>Time Slot</TableHead>}
          <TableHead>{tab === "free_delivery" ? "Min Purchase" : "Charge"}</TableHead>
          <TableHead>Priority</TableHead>
          <TableHead>Active</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filtered.length === 0 && (
          <TableRow>
            <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
              No rules configured. Click "Add Rule" to create one.
            </TableCell>
          </TableRow>
        )}
        {filtered.map(rule => (
          <TableRow key={rule.id}>
            <TableCell className="font-medium">{rule.name}</TableCell>
            {tab === "category" && <TableCell><Badge variant="outline">{rule.category_name || "—"}</Badge></TableCell>}
            {tab === "godown" && <TableCell><Badge variant="outline">{getGodownName(rule.godown_id)}</Badge></TableCell>}
            {tab === "time_based" && (
              <TableCell>
                <span className="text-xs">{rule.time_slot_label || "—"}</span>
                <br />
                <span className="text-xs text-muted-foreground">{rule.time_slot_start} – {rule.time_slot_end}</span>
              </TableCell>
            )}
            <TableCell>
              {tab === "free_delivery"
                ? `₹${rule.min_purchase_amount} (saves ₹${rule.charge_amount})`
                : `₹${rule.charge_amount}`}
            </TableCell>
            <TableCell>{rule.priority}</TableCell>
            <TableCell>
              <Switch checked={rule.is_active} onCheckedChange={() => toggleActive(rule)} />
            </TableCell>
            <TableCell>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => openEdit(rule)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" className="text-destructive" onClick={() => handleDelete(rule.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">Delivery Charge Rules</h2>
          <p className="text-sm text-muted-foreground">Configure delivery charges by category, godown, time, or free delivery thresholds.</p>
        </div>
        <Button onClick={() => openCreate(tab)} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Add Rule
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-4">
          {RULE_TYPES.map(rt => (
            <TabsTrigger key={rt.value} value={rt.value} className="text-xs gap-1">
              <rt.icon className="h-3.5 w-3.5" /> {rt.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {RULE_TYPES.map(rt => (
          <TabsContent key={rt.value} value={rt.value}>
            <p className="text-xs text-muted-foreground mb-3">{rt.desc}</p>
            {loading ? <p className="text-sm text-muted-foreground py-4">Loading...</p> : renderTable()}
          </TabsContent>
        ))}
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit" : "Add"} Delivery Charge Rule</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {!isEdit && (
              <div>
                <Label>Rule Type</Label>
                <Select value={editing.rule_type} onValueChange={v => setEditing(e => ({ ...e, rule_type: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RULE_TYPES.map(rt => (
                      <SelectItem key={rt.value} value={rt.value}>{rt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label>Rule Name</Label>
              <Input value={editing.name} onChange={e => setEditing(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Grocery delivery charge" />
            </div>

            {editing.rule_type === "category" && (
              <div>
                <Label>Category</Label>
                <Select value={editing.category_name ?? ""} onValueChange={v => setEditing(p => ({ ...p, category_name: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {categories.map(c => (
                      <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {editing.rule_type === "godown" && (
              <div>
                <Label>Godown</Label>
                <Select value={editing.godown_id ?? ""} onValueChange={v => setEditing(p => ({ ...p, godown_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select godown" /></SelectTrigger>
                  <SelectContent>
                    {godowns.map(g => (
                      <SelectItem key={g.id} value={g.id}>{g.name} ({g.godown_type})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {editing.rule_type === "time_based" && (
              <>
                <div>
                  <Label>Time Slot Label</Label>
                  <Input value={editing.time_slot_label ?? ""} onChange={e => setEditing(p => ({ ...p, time_slot_label: e.target.value }))} placeholder="e.g. Express Delivery" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Start Time</Label>
                    <Input type="time" value={editing.time_slot_start ?? ""} onChange={e => setEditing(p => ({ ...p, time_slot_start: e.target.value }))} />
                  </div>
                  <div>
                    <Label>End Time</Label>
                    <Input type="time" value={editing.time_slot_end ?? ""} onChange={e => setEditing(p => ({ ...p, time_slot_end: e.target.value }))} />
                  </div>
                </div>
              </>
            )}

            <div>
              <Label>{editing.rule_type === "free_delivery" ? "Delivery Charge (waived when threshold met)" : "Delivery Charge (₹)"}</Label>
              <Input type="number" min={0} value={editing.charge_amount} onChange={e => setEditing(p => ({ ...p, charge_amount: Number(e.target.value) }))} />
            </div>

            {editing.rule_type === "free_delivery" && (
              <div>
                <Label>Minimum Purchase Amount (₹)</Label>
                <Input type="number" min={0} value={editing.min_purchase_amount} onChange={e => setEditing(p => ({ ...p, min_purchase_amount: Number(e.target.value) }))} />
              </div>
            )}

            <div>
              <Label>Priority (lower = higher priority)</Label>
              <Input type="number" value={editing.priority} onChange={e => setEditing(p => ({ ...p, priority: Number(e.target.value) }))} />
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={editing.is_active} onCheckedChange={v => setEditing(p => ({ ...p, is_active: v }))} />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{isEdit ? "Update" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DeliveryChargeRules;
