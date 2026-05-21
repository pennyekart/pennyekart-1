import { useEffect, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Trash2, Pencil, Search, Package, X, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

type Product = { id: string; name: string; image_url: string | null; mrp: number; price: number };
type Combo = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  combo_price: number;
  total_mrp: number;
  is_active: boolean;
  sort_order: number;
};
type ComboItem = { id?: string; product_id: string; quantity: number; unit_price: number };

const CombosPage = () => {
  const navigate = useNavigate();
  const [combos, setCombos] = useState<Combo[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [comboPrice, setComboPrice] = useState<number>(0);
  const [isActive, setIsActive] = useState(true);
  const [items, setItems] = useState<ComboItem[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const totalMrp = items.reduce((sum, it) => {
    const p = products.find((x) => x.id === it.product_id);
    return sum + (p?.mrp || 0) * it.quantity;
  }, 0);
  const itemsTotal = items.reduce((sum, it) => sum + it.unit_price * it.quantity, 0);

  const load = async () => {
    setLoading(true);
    const [c, p] = await Promise.all([
      (supabase as any).from("product_combos").select("*").order("sort_order").order("created_at", { ascending: false }),
      supabase.from("products").select("id, name, image_url, mrp, price").eq("is_active", true).order("name"),
    ]);
    setCombos((c.data || []) as Combo[]);
    setProducts((p.data || []) as Product[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const reset = () => {
    setEditId(null); setName(""); setDescription(""); setImageUrl("");
    setComboPrice(0); setIsActive(true); setItems([]); setProductSearch("");
  };

  const openEdit = async (combo: Combo) => {
    reset();
    setEditId(combo.id);
    setName(combo.name);
    setDescription(combo.description || "");
    setImageUrl(combo.image_url || "");
    setComboPrice(combo.combo_price);
    setIsActive(combo.is_active);
    const { data } = await (supabase as any)
      .from("product_combo_items").select("*").eq("combo_id", combo.id);
    setItems((data || []) as ComboItem[]);
    setOpen(true);
  };

  const addProductToCombo = (p: Product) => {
    if (items.some((i) => i.product_id === p.id)) {
      toast.info("Already added");
      return;
    }
    setItems([...items, { product_id: p.id, quantity: 1, unit_price: p.price }]);
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Name required"); return; }
    if (items.length < 2) { toast.error("Add at least 2 products"); return; }
    if (comboPrice <= 0) { toast.error("Combo price must be > 0"); return; }

    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      image_url: imageUrl.trim() || null,
      combo_price: comboPrice,
      total_mrp: totalMrp,
      is_active: isActive,
    };

    let comboId = editId;
    if (editId) {
      const { error } = await (supabase as any).from("product_combos").update(payload).eq("id", editId);
      if (error) { toast.error(error.message); return; }
      // Replace items: delete then insert
      await (supabase as any).from("product_combo_items").delete().eq("combo_id", editId);
    } else {
      const { data, error } = await (supabase as any).from("product_combos").insert(payload).select("id").single();
      if (error) { toast.error(error.message); return; }
      comboId = data.id;
    }

    const itemsPayload = items.map((it) => ({
      combo_id: comboId, product_id: it.product_id, quantity: it.quantity, unit_price: it.unit_price,
    }));
    const { error: iErr } = await (supabase as any).from("product_combo_items").insert(itemsPayload);
    if (iErr) { toast.error(iErr.message); return; }

    toast.success(editId ? "Combo updated" : "Combo created");
    setOpen(false);
    reset();
    load();
  };

  const handleDelete = async (id: string) => {
    const { error } = await (supabase as any).from("product_combos").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted");
    setDeleteId(null);
    load();
  };

  const filteredProducts = products.filter((p) =>
    !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase())
  );

  return (
    <AdminLayout>
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/products")}><ArrowLeft className="h-4 w-4" /></Button>
          <h1 className="text-2xl font-bold">Combo Products</h1>
          <Badge variant="secondary">{combos.length}</Badge>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> New Combo</Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editId ? "Edit Combo" : "New Combo"}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div>
                  <Label>Combo Name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Breakfast Combo" />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
                </div>
                <div>
                  <Label>Image URL</Label>
                  <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Combo Price (₹)</Label>
                    <Input type="number" value={comboPrice} onChange={(e) => setComboPrice(Number(e.target.value) || 0)} />
                  </div>
                  <div>
                    <Label>Items Total (₹)</Label>
                    <Input value={itemsTotal} disabled />
                  </div>
                </div>
                <div>
                  <Label>Total MRP (₹)</Label>
                  <Input value={totalMrp} disabled />
                  {totalMrp > 0 && comboPrice > 0 && (
                    <p className="text-xs text-emerald-600 mt-1">
                      Savings: ₹{Math.max(0, totalMrp - comboPrice)} ({Math.round(Math.max(0, totalMrp - comboPrice) / totalMrp * 100)}% off MRP)
                    </p>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <Label>Active</Label>
                  <Switch checked={isActive} onCheckedChange={setIsActive} />
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <Label>Selected Products ({items.length})</Label>
                  <div className="space-y-1.5 mt-1 max-h-48 overflow-y-auto border rounded p-2">
                    {items.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">No products yet</p>}
                    {items.map((it) => {
                      const p = products.find((x) => x.id === it.product_id);
                      if (!p) return null;
                      return (
                        <div key={it.product_id} className="flex items-center gap-2 border rounded p-1.5">
                          {p.image_url && <img src={p.image_url} alt="" className="w-8 h-8 rounded object-cover" />}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{p.name}</p>
                            <p className="text-[10px] text-muted-foreground">MRP ₹{p.mrp}</p>
                          </div>
                          <Input type="number" min={1} value={it.quantity}
                            onChange={(e) => setItems(items.map((x) => x.product_id === it.product_id ? { ...x, quantity: Math.max(1, Number(e.target.value) || 1) } : x))}
                            className="w-14 h-7 text-xs" />
                          <Input type="number" min={0} value={it.unit_price}
                            onChange={(e) => setItems(items.map((x) => x.product_id === it.product_id ? { ...x, unit_price: Number(e.target.value) || 0 } : x))}
                            className="w-20 h-7 text-xs" />
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setItems(items.filter((x) => x.product_id !== it.product_id))}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <Label>Add Products</Label>
                  <div className="relative mt-1">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input className="pl-8" placeholder="Search..." value={productSearch} onChange={(e) => setProductSearch(e.target.value)} />
                  </div>
                  <div className="mt-2 max-h-56 overflow-y-auto border rounded p-1">
                    {filteredProducts.slice(0, 50).map((p) => (
                      <button key={p.id} type="button" onClick={() => addProductToCombo(p)}
                        className="w-full flex items-center gap-2 p-1.5 hover:bg-muted rounded text-left">
                        {p.image_url ? <img src={p.image_url} alt="" className="w-8 h-8 rounded object-cover" /> : <Package className="h-4 w-4" />}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{p.name}</p>
                          <p className="text-[10px] text-muted-foreground">₹{p.price} / MRP ₹{p.mrp}</p>
                        </div>
                        <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3">
              <Button variant="outline" onClick={() => { setOpen(false); reset(); }}>Cancel</Button>
              <Button onClick={handleSave}>{editId ? "Update" : "Create"} Combo</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : combos.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          <Package className="h-10 w-10 mx-auto mb-2 opacity-50" />
          No combos yet. Click "New Combo" to bundle products together.
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {combos.map((c) => {
            const savings = Math.max(0, c.total_mrp - c.combo_price);
            return (
              <Card key={c.id} className="p-3 flex gap-3">
                {c.image_url ? (
                  <img src={c.image_url} alt={c.name} className="w-20 h-20 rounded object-cover" />
                ) : (
                  <div className="w-20 h-20 rounded bg-muted flex items-center justify-center"><Package className="h-6 w-6 text-muted-foreground" /></div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{c.name}</p>
                      <p className="text-xs text-muted-foreground">
                        ₹{c.combo_price} <span className="line-through ml-1">₹{c.total_mrp}</span>
                      </p>
                      {savings > 0 && <Badge variant="secondary" className="text-[10px] mt-1">Save ₹{savings}</Badge>}
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(c.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                  {!c.is_active && <Badge variant="outline" className="text-[10px] mt-1">Inactive</Badge>}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete combo?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => deleteId && handleDelete(deleteId)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
};

export default CombosPage;
