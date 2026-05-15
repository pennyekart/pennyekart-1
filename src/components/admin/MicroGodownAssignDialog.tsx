import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Search, Loader2 } from "lucide-react";

interface MicroGodown {
  id: string;
  name: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  productId: string | null;
  productName: string;
  onSaved?: () => void;
}

const MicroGodownAssignDialog = ({ open, onOpenChange, productId, productName, onSaved }: Props) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [godowns, setGodowns] = useState<MicroGodown[]>([]);
  const [assignAll, setAssignAll] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open || !productId) return;
    let cancel = false;
    (async () => {
      setLoading(true);
      const [{ data: gd }, { data: prod }, { data: links }] = await Promise.all([
        supabase.from("godowns").select("id, name").eq("godown_type", "micro").eq("is_active", true).order("name"),
        supabase.from("seller_products").select("assign_to_all_micro_godowns").eq("id", productId).maybeSingle(),
        supabase.from("seller_product_micro_godowns").select("godown_id").eq("seller_product_id", productId),
      ]);
      if (cancel) return;
      setGodowns((gd as MicroGodown[]) ?? []);
      setAssignAll(!!(prod as any)?.assign_to_all_micro_godowns);
      setSelected(new Set((links ?? []).map((l: any) => l.godown_id)));
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [open, productId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return godowns;
    return godowns.filter((g) => g.name.toLowerCase().includes(q));
  }, [godowns, search]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      filtered.forEach((g) => next.add(g.id));
      return next;
    });
  };

  const clearAllVisible = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      filtered.forEach((g) => next.delete(g.id));
      return next;
    });
  };

  const handleSave = async () => {
    if (!productId) return;
    setSaving(true);

    // 1. Update flag
    const { error: upErr } = await supabase
      .from("seller_products")
      .update({ assign_to_all_micro_godowns: assignAll } as any)
      .eq("id", productId);

    if (upErr) {
      toast({ title: "Error", description: upErr.message, variant: "destructive" });
      setSaving(false);
      return;
    }

    // 2. Replace link rows
    const { error: delErr } = await supabase
      .from("seller_product_micro_godowns")
      .delete()
      .eq("seller_product_id", productId);

    if (delErr) {
      toast({ title: "Error", description: delErr.message, variant: "destructive" });
      setSaving(false);
      return;
    }

    if (!assignAll && selected.size > 0) {
      const rows = Array.from(selected).map((godown_id) => ({ seller_product_id: productId, godown_id }));
      const { error: insErr } = await supabase.from("seller_product_micro_godowns").insert(rows);
      if (insErr) {
        toast({ title: "Error", description: insErr.message, variant: "destructive" });
        setSaving(false);
        return;
      }
    }

    toast({ title: "Micro godown assignment saved" });
    setSaving(false);
    onOpenChange(false);
    onSaved?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] flex flex-col max-w-[95vw] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Assign Micro Godowns</DialogTitle>
          <DialogDescription className="truncate">{productName}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-4 pr-2">
            <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
              <div>
                <Label className="text-sm font-medium">Assign to all micro godowns</Label>
                <p className="text-xs text-muted-foreground">When on, every customer in any micro godown can see this product.</p>
              </div>
              <Switch checked={assignAll} onCheckedChange={setAssignAll} />
            </div>

            <div className={assignAll ? "opacity-50 pointer-events-none" : ""}>
              <div className="flex items-center gap-2 mb-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search godowns..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>
                <Button type="button" variant="outline" size="sm" onClick={selectAllVisible}>All</Button>
                <Button type="button" variant="outline" size="sm" onClick={clearAllVisible}>None</Button>
              </div>

              <div className="text-xs text-muted-foreground mb-2">
                {selected.size} of {godowns.length} selected
              </div>

              <div className="border rounded-md divide-y max-h-72 overflow-y-auto">
                {filtered.length === 0 && (
                  <p className="p-4 text-sm text-center text-muted-foreground">No micro godowns found.</p>
                )}
                {filtered.map((g) => (
                  <label
                    key={g.id}
                    className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={selected.has(g.id)}
                      onCheckedChange={() => toggle(g.id)}
                    />
                    <span className="text-sm flex-1">{g.name}</span>
                    {selected.has(g.id) && <Badge variant="secondary" className="text-[10px]">Assigned</Badge>}
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MicroGodownAssignDialog;
