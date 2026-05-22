import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Package, ShoppingCart, Sparkles } from "lucide-react";
import { useCart } from "@/hooks/useCart";
import { toast } from "sonner";

type Combo = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  combo_price: number;
  total_mrp: number;
};

type ComboItem = {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
};

type Product = {
  id: string;
  name: string;
  image_url: string | null;
  mrp: number;
  price: number;
};

export const ComboOffersSection = () => {
  const [combos, setCombos] = useState<Combo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCombo, setSelectedCombo] = useState<Combo | null>(null);
  const [comboItems, setComboItems] = useState<ComboItem[]>([]);
  const [productsMap, setProductsMap] = useState<Record<string, Product>>({});
  const [detailLoading, setDetailLoading] = useState(false);
  const { addItem } = useCart();

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("product_combos")
        .select("id, name, description, image_url, combo_price, total_mrp")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });
      setCombos((data || []) as Combo[]);
      setLoading(false);
    })();
  }, []);

  const openCombo = async (combo: Combo) => {
    setSelectedCombo(combo);
    setDetailLoading(true);
    const { data: items } = await (supabase as any)
      .from("product_combo_items")
      .select("id, product_id, quantity, unit_price")
      .eq("combo_id", combo.id);
    const it = (items || []) as ComboItem[];
    setComboItems(it);
    if (it.length > 0) {
      const ids = it.map((i) => i.product_id);
      const [prodsRes, sellerRes] = await Promise.all([
        supabase.from("products").select("id, name, image_url, mrp, price").in("id", ids),
        supabase.from("seller_products").select("id, name, image_url, mrp, price").in("id", ids),
      ]);
      const map: Record<string, Product> = {};
      (prodsRes.data || []).forEach((p: any) => { map[p.id] = p; });
      (sellerRes.data || []).forEach((p: any) => { if (!map[p.id]) map[p.id] = p; });
      setProductsMap(map);
    }
    setDetailLoading(false);
  };

  const addComboToCart = () => {
    if (!selectedCombo || comboItems.length === 0) return;
    comboItems.forEach((it) => {
      const p = productsMap[it.product_id];
      if (!p) return;
      addItem(
        {
          id: p.id,
          name: p.name,
          price: it.unit_price,
          mrp: p.mrp || it.unit_price,
          image: p.image_url || "",
          source: "product",
        },
        it.quantity,
        { overridePrice: true }
      );
    });
    toast.success(`${selectedCombo.name} added to cart at combo price`);
    setSelectedCombo(null);
  };

  if (loading || combos.length === 0) return null;

  return (
    <section className="px-3 py-3">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-base font-bold flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-primary" />
          Combo Offers
        </h2>
        <Badge variant="secondary" className="text-[10px]">{combos.length}</Badge>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {combos.map((combo) => {
          const savings = Math.max(0, combo.total_mrp - combo.combo_price);
          const pct = combo.total_mrp > 0 ? Math.round((savings / combo.total_mrp) * 100) : 0;
          return (
            <Card key={combo.id} className="overflow-hidden cursor-pointer hover:shadow-md transition" onClick={() => openCombo(combo)}>
              <div className="relative aspect-square bg-muted">
                {combo.image_url ? (
                  <img src={combo.image_url} alt={combo.name} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"><Package className="h-10 w-10 text-muted-foreground" /></div>
                )}
                {pct > 0 && (
                  <Badge className="absolute top-1.5 left-1.5 bg-destructive text-destructive-foreground text-[10px]">{pct}% OFF</Badge>
                )}
              </div>
              <div className="p-2 space-y-1">
                <p className="text-xs font-medium line-clamp-2 min-h-[2rem]">{combo.name}</p>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-sm font-bold text-primary">₹{combo.combo_price}</span>
                  {savings > 0 && <span className="text-[10px] line-through text-muted-foreground">₹{combo.total_mrp}</span>}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!selectedCombo} onOpenChange={(v) => !v && setSelectedCombo(null)}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              {selectedCombo?.name}
            </DialogTitle>
          </DialogHeader>
          {selectedCombo && (
            <div className="space-y-3">
              {selectedCombo.image_url && (
                <img src={selectedCombo.image_url} alt={selectedCombo.name} className="w-full h-40 object-cover rounded-lg" />
              )}
              {selectedCombo.description && (
                <p className="text-sm text-muted-foreground">{selectedCombo.description}</p>
              )}
              <div className="rounded-lg border bg-muted/30 p-3 flex items-baseline justify-between">
                <span className="text-xs text-muted-foreground">Combo Price</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-bold text-primary">₹{selectedCombo.combo_price}</span>
                  {selectedCombo.total_mrp > selectedCombo.combo_price && (
                    <span className="text-xs line-through text-muted-foreground">₹{selectedCombo.total_mrp}</span>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Included Products</p>
                {detailLoading ? (
                  <p className="text-xs text-muted-foreground text-center py-3">Loading...</p>
                ) : (
                  comboItems.map((it) => {
                    const p = productsMap[it.product_id];
                    if (!p) return null;
                    return (
                      <div key={it.id} className="flex items-center gap-2 border rounded-lg p-2">
                        {p.image_url && <img src={p.image_url} alt={p.name} className="w-12 h-12 rounded object-cover" />}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{p.name}</p>
                          <p className="text-[11px] text-muted-foreground">Qty: {it.quantity} • ₹{it.unit_price}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <Button onClick={addComboToCart} className="w-full" disabled={detailLoading || comboItems.length === 0}>
                <ShoppingCart className="h-4 w-4 mr-2" /> Add Combo to Cart
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default ComboOffersSection;
