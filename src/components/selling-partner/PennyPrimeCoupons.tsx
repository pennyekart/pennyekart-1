import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Tag, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SellerProduct {
  id: string;
  name: string;
  price: number;
}

interface PrimeCoupon {
  id: string;
  seller_code: string;
  product_id: string;
  customer_discount_type: string;
  customer_discount_value: number;
  agent_margin_type: string;
  agent_margin_value: number;
  is_active: boolean;
  created_at: string;
  products: { name: string; price: number } | null;
}

const PennyPrimeCoupons = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [coupons, setCoupons] = useState<PrimeCoupon[]>([]);
  const [products, setProducts] = useState<SellerProduct[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const emptyForm = {
    product_id: "",
    seller_code: "",
    customer_discount_type: "amount" as "amount" | "percent",
    customer_discount_value: "",
    agent_margin_type: "amount" as "amount" | "percent",
    agent_margin_value: "",
  };
  const [form, setForm] = useState(emptyForm);

  const fetchCoupons = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("penny_prime_coupons")
      .select("*, products (name, price)")
      .eq("seller_id", user.id)
      .order("created_at", { ascending: false });
    setCoupons((data as any) ?? []);
  };

  const fetchProducts = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("seller_products")
      .select("id, name, price")
      .eq("seller_id", user.id)
      .eq("is_approved", true)
      .eq("is_active", true);
    setProducts((data as SellerProduct[]) ?? []);
  };

  useEffect(() => {
    fetchCoupons();
    fetchProducts();
  }, [user]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!form.product_id || !form.seller_code.trim()) {
      toast({ title: "Product and code are required", variant: "destructive" });
      return;
    }
    const cdv = parseFloat(form.customer_discount_value);
    const amv = parseFloat(form.agent_margin_value);
    if (isNaN(cdv) || cdv <= 0 || isNaN(amv) || amv <= 0) {
      toast({ title: "Enter valid discount and margin values", variant: "destructive" });
      return;
    }
    if (form.customer_discount_type === "percent" && cdv > 100) {
      toast({ title: "Percent discount cannot exceed 100%", variant: "destructive" });
      return;
    }

    setLoading(true);
    const { error } = await supabase.from("penny_prime_coupons").insert({
      seller_id: user.id,
      product_id: form.product_id,
      seller_code: form.seller_code.trim().toUpperCase(),
      customer_discount_type: form.customer_discount_type,
      customer_discount_value: cdv,
      agent_margin_type: form.agent_margin_type,
      agent_margin_value: amv,
    });
    setLoading(false);

    if (error) {
      toast({ title: "Error", description: error.message === "duplicate key value violates unique constraint \"penny_prime_coupons_seller_code_key\"" ? "This code already exists. Try another." : error.message, variant: "destructive" });
    } else {
      toast({ title: "Penny Prime coupon created!" });
      setForm(emptyForm);
      setDialogOpen(false);
      fetchCoupons();
    }
  };

  const toggleActive = async (c: PrimeCoupon) => {
    await supabase.from("penny_prime_coupons").update({ is_active: !c.is_active }).eq("id", c.id);
    fetchCoupons();
  };

  const deleteCoupon = async (id: string) => {
    if (!confirm("Delete this coupon?")) return;
    await supabase.from("penny_prime_coupons").delete().eq("id", id);
    fetchCoupons();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <Tag className="h-4 w-4 text-primary" /> Penny Prime Coupons
        </h2>
        <Button size="sm" onClick={() => setDialogOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" /> New Coupon
        </Button>
      </div>

      {coupons.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-10 text-center text-muted-foreground">
          <Tag className="mx-auto h-8 w-8 mb-2 opacity-40" />
          <p className="text-sm">No Penny Prime coupons yet.</p>
          <p className="text-xs mt-1">Create one to let agents collab and share your products!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {coupons.map(c => (
            <Card key={c.id} className="shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-mono font-bold text-primary text-sm">{c.seller_code}</span>
                      <Badge variant={c.is_active ? "default" : "outline"} className="text-xs">
                        {c.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{c.products?.name ?? "Product"}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className="text-xs bg-muted rounded px-2 py-0.5">
                        Customer: {c.customer_discount_type === "percent" ? `${c.customer_discount_value}%` : `₹${c.customer_discount_value}`} off
                      </span>
                      <span className="text-xs bg-primary/10 text-primary rounded px-2 py-0.5">
                        Agent margin: {c.agent_margin_type === "percent" ? `${c.agent_margin_value}%` : `₹${c.agent_margin_value}`}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch checked={c.is_active} onCheckedChange={() => toggleActive(c)} />
                    <button onClick={() => deleteCoupon(c.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-primary" /> Create Penny Prime Coupon
            </DialogTitle>
            <DialogDescription>
              Agents will collab using your code and share it to earn margin on sales.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            {/* Product */}
            <div className="space-y-1.5">
              <Label>Product</Label>
              <Select value={form.product_id} onValueChange={v => setForm(f => ({ ...f, product_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select your product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name} — ₹{p.price}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {products.length === 0 && (
                <p className="text-xs text-amber-600">No approved active products found.</p>
              )}
            </div>

            {/* Code */}
            <div className="space-y-1.5">
              <Label>Your Coupon Code</Label>
              <Input
                placeholder="e.g. JOYSTORE20"
                value={form.seller_code}
                onChange={e => setForm(f => ({ ...f, seller_code: e.target.value.toUpperCase() }))}
                maxLength={20}
              />
              <p className="text-xs text-muted-foreground">Agents' codes will be: <span className="font-mono">{form.seller_code || "YOURCODE"}-XXXX</span></p>
            </div>

            {/* Customer Discount */}
            <div className="space-y-1.5">
              <Label>Customer Discount</Label>
              <div className="flex gap-2">
                <Select value={form.customer_discount_type} onValueChange={v => setForm(f => ({ ...f, customer_discount_type: v as any }))}>
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="amount">Amount (₹)</SelectItem>
                    <SelectItem value="percent">Percent (%)</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min="0"
                  max={form.customer_discount_type === "percent" ? "100" : undefined}
                  placeholder={form.customer_discount_type === "percent" ? "e.g. 10" : "e.g. 50"}
                  value={form.customer_discount_value}
                  onChange={e => setForm(f => ({ ...f, customer_discount_value: e.target.value }))}
                  className="flex-1"
                />
              </div>
            </div>

            {/* Agent Margin */}
            <div className="space-y-1.5">
              <Label>Agent Margin (paid after 7 days of delivery)</Label>
              <div className="flex gap-2">
                <Select value={form.agent_margin_type} onValueChange={v => setForm(f => ({ ...f, agent_margin_type: v as any }))}>
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="amount">Amount (₹)</SelectItem>
                    <SelectItem value="percent">Percent (%)</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min="0"
                  max={form.agent_margin_type === "percent" ? "100" : undefined}
                  placeholder={form.agent_margin_type === "percent" ? "e.g. 5" : "e.g. 30"}
                  value={form.agent_margin_value}
                  onChange={e => setForm(f => ({ ...f, agent_margin_value: e.target.value }))}
                  className="flex-1"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading ? "Creating..." : "Create Coupon"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PennyPrimeCoupons;
