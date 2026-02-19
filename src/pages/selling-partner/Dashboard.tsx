import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Package, Plus, LogOut, Store, ShoppingCart, Wallet, Star, PackagePlus, Pencil, BarChart3, TrendingUp, MapPin, ArrowDownLeft, Clock, Settings, Tag } from "lucide-react";
import PennyPrimeCoupons from "@/components/selling-partner/PennyPrimeCoupons";
import { useToast } from "@/hooks/use-toast";
import ImageUpload from "@/components/admin/ImageUpload";
import logo from "@/assets/logo.png";

interface SellerProduct {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string | null;
  is_approved: boolean;
  is_active: boolean;
  is_featured: boolean;
  coming_soon: boolean;
  stock: number;
  area_godown_id: string | null;
  image_url: string | null;
  image_url_2: string | null;
  image_url_3: string | null;
  purchase_rate: number;
  mrp: number;
  discount_rate: number;
  created_at: string;
}

interface Godown { id: string; name: string; }
interface Category { id: string; name: string; category_type: string; }

interface Order {
  id: string;
  status: string;
  total: number;
  items: any;
  created_at: string;
  shipping_address: string | null;
  user_id: string | null;
}

interface WalletTxn {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  created_at: string;
  settled_by: string | null;
  order_id: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  seller_confirmation_pending: "Awaiting Your Confirmation",
  seller_accepted: "Confirmed - Awaiting Delivery",
  pending: "Order Placed", packed: "Packed", pickup: "Picked Up",
  accepted: "Accepted", shipped: "Shipped", delivery_pending: "Delivery Pending", delivered: "Delivered",
};

const emptyForm = {
  name: "", description: "", price: "", category: "", stock: "",
  area_godown_id: "", image_url: "", image_url_2: "", image_url_3: "",
  purchase_rate: "", mrp: "", discount_rate: "", is_featured: false,
};

const SellingPartnerDashboard = () => {
  const { profile, signOut, user } = useAuth();
  const { toast } = useToast();
  const [products, setProducts] = useState<SellerProduct[]>([]);
  const [assignedGodowns, setAssignedGodowns] = useState<Godown[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<SellerProduct | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState(emptyForm);
  const [form, setForm] = useState(emptyForm);
  const [orders, setOrders] = useState<Order[]>([]);
  const [walletBalance, setWalletBalance] = useState(0);
  const [transactions, setTransactions] = useState<WalletTxn[]>([]);
  const [addStockDialogOpen, setAddStockDialogOpen] = useState(false);
  const [addStockProduct, setAddStockProduct] = useState<SellerProduct | null>(null);
  const [addStockQty, setAddStockQty] = useState("");

  // Profile settings state
  const [profileForm, setProfileForm] = useState({
    company_name: "", gst_number: "",
    business_address: "", business_city: "", business_state: "", business_pincode: "",
    business_phone: "", business_email: "",
    bank_account_name: "", bank_account_number: "", bank_ifsc: "",
  });
  const [profileLoading, setProfileLoading] = useState(false);

  // Analytics state
  const [analytics, setAnalytics] = useState<{
    itemStats: { id: string; name: string; sold: number; revenue: number; purchaseRate: number; discount: number; totalOrders: number }[];
    panchayathStats: { name: string; orders: number; revenue: number }[];
  }>({ itemStats: [], panchayathStats: [] });
  const [totalOrderCount, setTotalOrderCount] = useState(0);

  const handleAddStock = async () => {
    if (!addStockProduct || !user) return;
    const qty = parseInt(addStockQty);
    if (isNaN(qty) || qty <= 0) { toast({ title: "Enter a valid quantity", variant: "destructive" }); return; }
    const { error: spError } = await supabase.from("seller_products").update({ stock: addStockProduct.stock + qty }).eq("id", addStockProduct.id);
    if (spError) { toast({ title: "Error", description: spError.message, variant: "destructive" }); return; }
    if (addStockProduct.area_godown_id) {
      const { data: existing } = await supabase.from("godown_stock").select("id, quantity").eq("godown_id", addStockProduct.area_godown_id).eq("product_id", addStockProduct.id).order("created_at", { ascending: true }).limit(1);
      if (existing && existing.length > 0) {
        await supabase.from("godown_stock").update({ quantity: existing[0].quantity + qty }).eq("id", existing[0].id);
      } else {
        await supabase.from("godown_stock").insert({ godown_id: addStockProduct.area_godown_id, product_id: addStockProduct.id, quantity: qty, purchase_price: addStockProduct.purchase_rate || 0 });
      }
    }
    toast({ title: `Added ${qty} units to ${addStockProduct.name}` });
    setAddStockDialogOpen(false); setAddStockProduct(null); setAddStockQty(""); fetchProducts();
  };

  const fetchProducts = async () => {
    if (!user) return;
    const { data } = await supabase.from("seller_products").select("*").eq("seller_id", user.id).order("created_at", { ascending: false });
    if (data) setProducts(data as SellerProduct[]);
  };

  const fetchAssignedGodowns = async () => {
    if (!user) return;
    const { data: assignments } = await supabase.from("seller_godown_assignments").select("godown_id").eq("seller_id", user.id);
    if (!assignments || assignments.length === 0) { setAssignedGodowns([]); return; }
    const { data: godownData } = await supabase.from("godowns").select("id, name").in("id", assignments.map(a => a.godown_id));
    if (godownData) setAssignedGodowns(godownData);
  };

  const fetchCategories = async () => {
    const { data } = await supabase.from("categories").select("id, name, category_type").eq("is_active", true).order("sort_order");
    if (data) setCategories(data as Category[]);
  };

  const fetchOrders = async (_myProducts: SellerProduct[]) => {
    if (!user) return;
    // Use server-side RPC for reliable JSONB scanning across seller's products
    const { data, error } = await supabase.rpc("get_orders_for_seller", { seller_user_id: user.id });
    if (error) console.error("fetchOrders error:", error.message);
    const unique = (data as Order[]) ?? [];
    setOrders(unique);
    return unique;
  };

  const fetchWallet = async () => {
    if (!user) return;
    let { data: wallet } = await supabase.from("seller_wallets").select("*").eq("seller_id", user.id).maybeSingle();
    // Auto-create wallet if it doesn't exist
    if (!wallet) {
      const { data: newWallet } = await supabase
        .from("seller_wallets")
        .insert({ seller_id: user.id, balance: 0 })
        .select()
        .single();
      wallet = newWallet;
    }
    if (wallet) {
      setWalletBalance(wallet.balance);
      const { data: txns } = await supabase.from("seller_wallet_transactions").select("*").eq("wallet_id", wallet.id).order("created_at", { ascending: false }).limit(100);
      setTransactions((txns ?? []) as WalletTxn[]);
    }
  };

  const fetchAnalytics = async (myProducts: SellerProduct[], allOrders: Order[]) => {
    if (!myProducts.length) return;

    const deliveredOrds = allOrders.filter(o => o.status === "delivered");
    setTotalOrderCount(deliveredOrds.length);

    // Build item-wise sold stats from delivered orders
    const itemMap: Record<string, { id: string; name: string; sold: number; revenue: number; purchaseRate: number; discount: number; orderCount: number }> = {};
    myProducts.forEach(p => {
      itemMap[p.id] = { id: p.id, name: p.name, sold: 0, revenue: 0, purchaseRate: p.purchase_rate, discount: p.discount_rate, orderCount: 0 };
    });

    deliveredOrds.forEach(order => {
      if (!Array.isArray(order.items)) return;
      const myItemsInOrder = order.items.filter((item: any) => itemMap[item.id]);
      myItemsInOrder.forEach((item: any) => {
        itemMap[item.id].sold += item.quantity || 1;
        // revenue = purchase_rate * qty (cost-based revenue as requested)
        itemMap[item.id].revenue += (itemMap[item.id].purchaseRate) * (item.quantity || 1);
        itemMap[item.id].orderCount++;
      });
    });

    const itemStats = Object.values(itemMap).map(i => ({
      id: i.id,
      name: i.name,
      sold: i.sold,
      revenue: i.revenue,
      purchaseRate: i.purchaseRate,
      discount: i.discount,
      totalOrders: i.orderCount,
    })).sort((a, b) => b.sold - a.sold);

    // Panchayath analytics: fetch profiles of order users
    const userIds = [...new Set(allOrders.map(o => o.user_id).filter(Boolean))] as string[];
    let panchayathStats: { name: string; orders: number; revenue: number }[] = [];
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, local_body_id")
        .in("user_id", userIds);

      const lbIds = [...new Set((profiles ?? []).map(p => p.local_body_id).filter(Boolean))] as string[];
      if (lbIds.length > 0) {
        const { data: lbs } = await supabase.from("locations_local_bodies").select("id, name").in("id", lbIds);
        const lbMap: Record<string, string> = {};
        (lbs ?? []).forEach(lb => { lbMap[lb.id] = lb.name; });
        const profileMap: Record<string, string> = {};
        (profiles ?? []).forEach(p => { if (p.local_body_id) profileMap[p.user_id] = lbMap[p.local_body_id] || "Unknown"; });

        const pMap: Record<string, { orders: number; revenue: number }> = {};
        allOrders.forEach(o => {
          const lb = o.user_id ? (profileMap[o.user_id] || "Unknown") : "Unknown";
          if (!pMap[lb]) pMap[lb] = { orders: 0, revenue: 0 };
          pMap[lb].orders++;
          pMap[lb].revenue += o.total || 0;
        });
        panchayathStats = Object.entries(pMap).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.orders - a.orders);
      }
    }

    setAnalytics({ itemStats, panchayathStats });
  };

  const fetchProfileSettings = async () => {
    if (!user) return;
    const { data } = await supabase.from("profiles").select("company_name, gst_number, business_address, business_city, business_state, business_pincode, business_phone, business_email, bank_account_name, bank_account_number, bank_ifsc").eq("user_id", user.id).single();
    if (data) {
      setProfileForm({
        company_name: data.company_name ?? "", gst_number: data.gst_number ?? "",
        business_address: data.business_address ?? "", business_city: data.business_city ?? "",
        business_state: data.business_state ?? "", business_pincode: data.business_pincode ?? "",
        business_phone: data.business_phone ?? "", business_email: data.business_email ?? "",
        bank_account_name: data.bank_account_name ?? "", bank_account_number: data.bank_account_number ?? "",
        bank_ifsc: data.bank_ifsc ?? "",
      });
    }
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setProfileLoading(true);
    const { error } = await supabase.from("profiles").update({
      company_name: profileForm.company_name.trim() || null,
      gst_number: profileForm.gst_number.trim() || null,
      business_address: profileForm.business_address.trim() || null,
      business_city: profileForm.business_city.trim() || null,
      business_state: profileForm.business_state.trim() || null,
      business_pincode: profileForm.business_pincode.trim() || null,
      business_phone: profileForm.business_phone.trim() || null,
      business_email: profileForm.business_email.trim() || null,
      bank_account_name: profileForm.bank_account_name.trim() || null,
      bank_account_number: profileForm.bank_account_number.trim() || null,
      bank_ifsc: profileForm.bank_ifsc.trim() || null,
    }).eq("user_id", user.id);
    setProfileLoading(false);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); }
    else { toast({ title: "Profile updated successfully!" }); }
  };

  useEffect(() => {
    if (!user) return;
    const init = async () => {
      await Promise.all([fetchAssignedGodowns(), fetchCategories(), fetchWallet(), fetchProfileSettings()]);
      const { data: myProds } = await supabase.from("seller_products").select("*").eq("seller_id", user.id).order("created_at", { ascending: false });
      const prods = (myProds ?? []) as SellerProduct[];
      setProducts(prods);
      const orders = await fetchOrders(prods);
      if (orders) fetchAnalytics(prods, orders);
    };
    init();
  }, [user]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const mrp = parseFloat(form.mrp) || 0;
    const discountRate = parseFloat(form.discount_rate) || 0;
    const godownId = form.area_godown_id || (assignedGodowns.length === 1 ? assignedGodowns[0].id : null);
    const { error } = await supabase.from("seller_products").insert({
      seller_id: user.id,
      name: form.name.trim(),
      description: form.description.trim() || null,
      price: mrp - discountRate,
      purchase_rate: parseFloat(form.purchase_rate) || 0,
      mrp, discount_rate: discountRate,
      category: form.category.trim() || null,
      stock: parseInt(form.stock) || 0,
      area_godown_id: godownId,
      image_url: form.image_url || null,
      image_url_2: form.image_url_2 || null,
      image_url_3: form.image_url_3 || null,
      is_featured: form.is_featured,
    });
    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Product submitted for approval!" });
      setForm(emptyForm); setDialogOpen(false); fetchProducts();
    }
  };

  const openEdit = (p: SellerProduct) => {
    setEditProduct(p);
    setEditForm({
      name: p.name, description: p.description ?? "", price: String(p.price),
      category: p.category ?? "", stock: String(p.stock),
      area_godown_id: p.area_godown_id ?? "", image_url: p.image_url ?? "",
      image_url_2: p.image_url_2 ?? "", image_url_3: p.image_url_3 ?? "",
      purchase_rate: String(p.purchase_rate), mrp: String(p.mrp),
      discount_rate: String(p.discount_rate), is_featured: p.is_featured,
    });
    setEditDialogOpen(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editProduct) return;
    const mrp = parseFloat(editForm.mrp) || 0;
    const discountRate = parseFloat(editForm.discount_rate) || 0;
    const { error } = await supabase.from("seller_products").update({
      name: editForm.name.trim(),
      description: editForm.description.trim() || null,
      price: mrp - discountRate,
      purchase_rate: parseFloat(editForm.purchase_rate) || 0,
      mrp, discount_rate: discountRate,
      category: editForm.category.trim() || null,
      stock: parseInt(editForm.stock) || 0,
      area_godown_id: editForm.area_godown_id || editProduct.area_godown_id,
      image_url: editForm.image_url || null,
      image_url_2: editForm.image_url_2 || null,
      image_url_3: editForm.image_url_3 || null,
      is_featured: editForm.is_featured,
    }).eq("id", editProduct.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Product updated!" });
      setEditDialogOpen(false); setEditProduct(null); fetchProducts();
    }
  };

  const toggleActive = async (p: SellerProduct) => {
    const { error } = await supabase.from("seller_products").update({ is_active: !p.is_active }).eq("id", p.id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: `Product ${!p.is_active ? "activated" : "deactivated"}` });
    fetchProducts();
  };

  const deliveredOrders = orders.filter(o => o.status === "delivered");
  // Revenue = sum of (purchase_rate × qty) for all items sold, from analytics
  const totalRevenue = analytics.itemStats.reduce((s, i) => s + i.revenue, 0);
  // Wallet: total credits minus total settlements
  const totalCredits = transactions.filter(t => t.type !== "settlement" && !t.description?.toLowerCase().includes("settl")).reduce((s, t) => s + Math.abs(t.amount), 0);
  const totalSettled = transactions.filter(t => t.type === "settlement" || t.description?.toLowerCase().includes("settl")).reduce((s, t) => s + Math.abs(t.amount), 0);
  const walletRevenue = totalCredits - totalSettled;

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b bg-card px-4 py-3">
        <div className="flex items-center gap-3">
          <img src={logo} alt="Pennyekart" className="h-8" />
          <span className="font-semibold text-foreground">Selling Partner</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{profile?.full_name}</span>
          <Button variant="outline" size="sm" onClick={signOut}><LogOut className="h-4 w-4" /></Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl p-4 space-y-6">
        {/* Stats */}
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Products</CardTitle>
              <Package className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent><p className="text-2xl font-bold">{products.length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Approved</CardTitle>
              <Store className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent><p className="text-2xl font-bold">{products.filter(p => p.is_approved).length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Orders</CardTitle>
              <ShoppingCart className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent><p className="text-2xl font-bold">{orders.length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Wallet</CardTitle>
              <Wallet className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent><p className="text-2xl font-bold">₹{walletBalance.toFixed(2)}</p></CardContent>
          </Card>
        </div>

        <Tabs defaultValue="products">
          <TabsList className="w-full grid grid-cols-6">
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="wallet">Wallet</TabsTrigger>
            <TabsTrigger value="prime" className="gap-1"><Tag className="h-3.5 w-3.5" />Prime</TabsTrigger>
            <TabsTrigger value="profile">Profile</TabsTrigger>
          </TabsList>

          {/* PRODUCTS TAB */}
          <TabsContent value="products" className="space-y-4">
            <div className="flex justify-end">
              <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) setForm(emptyForm); }}>
                <DialogTrigger asChild>
                  <Button><Plus className="mr-2 h-4 w-4" /> Add Product</Button>
                </DialogTrigger>
                <DialogContent className="max-h-[85vh] flex flex-col">
                  <DialogHeader><DialogTitle>Add Product</DialogTitle></DialogHeader>
                  <form onSubmit={handleCreate} className="space-y-3 overflow-y-auto pr-2 flex-1">
                    <div><Label>Product Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></div>
                    <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
                    <div className="grid grid-cols-3 gap-3">
                      <div><Label>Purchase Rate</Label><Input type="number" min="0" step="0.01" value={form.purchase_rate} onChange={e => setForm({ ...form, purchase_rate: e.target.value })} /></div>
                      <div><Label>MRP</Label><Input type="number" min="0" step="0.01" value={form.mrp} onChange={e => { const m = e.target.value; const dr = parseFloat(form.discount_rate) || 0; setForm({ ...form, mrp: m, price: String((parseFloat(m) || 0) - dr) }); }} required /></div>
                      <div><Label>Discount Rate</Label><Input type="number" min="0" step="0.01" value={form.discount_rate} onChange={e => { const dr = e.target.value; const m = parseFloat(form.mrp) || 0; setForm({ ...form, discount_rate: dr, price: String(m - (parseFloat(dr) || 0)) }); }} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Selling Price</Label><Input type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} /></div>
                      <div><Label>Stock</Label><Input type="number" min="0" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} required /></div>
                    </div>
                    <div>
                      <Label>Category</Label>
                      <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                        <option value="">Select category</option>
                        {categories.filter(c => c.category_type === "grocery").length > 0 && (
                          <optgroup label="Grocery & Essentials">{categories.filter(c => c.category_type === "grocery").map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</optgroup>
                        )}
                        {categories.filter(c => c.category_type !== "grocery").length > 0 && (
                          <optgroup label="General Categories">{categories.filter(c => c.category_type !== "grocery").map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</optgroup>
                        )}
                      </select>
                    </div>
                    <ImageUpload bucket="products" value={form.image_url} onChange={url => setForm({ ...form, image_url: url })} label="Image 1 (Upload or paste URL)" />
                    <div><Label>Image 2 (URL)</Label><Input value={form.image_url_2} onChange={e => setForm({ ...form, image_url_2: e.target.value })} placeholder="Paste image URL" /></div>
                    {form.image_url_2 && <img src={form.image_url_2} alt="Preview 2" className="h-20 w-20 rounded-md border object-cover" />}
                    <div><Label>Image 3 (URL)</Label><Input value={form.image_url_3} onChange={e => setForm({ ...form, image_url_3: e.target.value })} placeholder="Paste image URL" /></div>
                    {form.image_url_3 && <img src={form.image_url_3} alt="Preview 3" className="h-20 w-20 rounded-md border object-cover" />}
                    <div>
                      <Label>Area Godown (assigned by admin)</Label>
                      <Select value={form.area_godown_id} onValueChange={v => setForm({ ...form, area_godown_id: v })}>
                        <SelectTrigger><SelectValue placeholder={assignedGodowns.length ? "Select godown" : "No godowns assigned"} /></SelectTrigger>
                        <SelectContent>{assignedGodowns.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg border p-3">
                      <Star className="h-4 w-4 text-yellow-500" />
                      <div className="flex-1">
                        <Label className="text-sm font-medium">Featured Product</Label>
                        <p className="text-xs text-muted-foreground">Requires admin approval to display</p>
                      </div>
                      <Switch checked={form.is_featured} onCheckedChange={v => setForm({ ...form, is_featured: v })} />
                    </div>
                    <Button type="submit" className="w-full" disabled={assignedGodowns.length === 0}>Submit for Approval</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {products.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No products yet. Add your first product!</p>
            ) : (
              <div className="space-y-3">
                {products.map(p => (
                  <div key={p.id} className={`flex items-center justify-between rounded-lg border p-3 ${!p.is_active ? "opacity-60" : ""}`}>
                    <div className="flex items-center gap-3">
                      {p.image_url && <img src={p.image_url} alt={p.name} className="h-12 w-12 rounded-md border object-cover" />}
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-foreground">{p.name}</p>
                          {p.is_featured && <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />}
                          {!p.is_active && <Badge variant="outline" className="text-xs">Inactive</Badge>}
                          {p.coming_soon && (
                            <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 border-0 gap-1 text-[10px]">
                              <Clock className="h-3 w-3" /> Coming Soon
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">₹{p.price} · MRP: ₹{p.mrp} · Stock: {p.stock}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                      <Button
                        variant="outline" size="sm"
                        onClick={() => { setAddStockProduct(p); setAddStockQty(""); setAddStockDialogOpen(true); }}
                      >
                        <PackagePlus className="h-4 w-4 mr-1" /> Add Stock
                      </Button>
                      <div className="flex items-center gap-1">
                        <Switch checked={p.is_active} onCheckedChange={() => toggleActive(p)} />
                        <span className="text-xs text-muted-foreground">{p.is_active ? "Active" : "Off"}</span>
                      </div>
                      <Badge variant={p.is_approved ? "default" : "secondary"}>
                        {p.is_approved ? "Approved" : "Pending"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add Stock Dialog */}
            <Dialog open={addStockDialogOpen} onOpenChange={setAddStockDialogOpen}>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Stock - {addStockProduct?.name}</DialogTitle></DialogHeader>
                <div className="space-y-4 py-2">
                  <p className="text-sm text-muted-foreground">Current stock: <span className="font-semibold text-foreground">{addStockProduct?.stock}</span></p>
                  <div><Label>Quantity to add</Label><Input type="number" min="1" value={addStockQty} onChange={e => setAddStockQty(e.target.value)} placeholder="Enter quantity" /></div>
                  <Button onClick={handleAddStock} className="w-full">Add Stock</Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Edit Product Dialog */}
            <Dialog open={editDialogOpen} onOpenChange={(v) => { setEditDialogOpen(v); if (!v) setEditProduct(null); }}>
              <DialogContent className="max-h-[85vh] flex flex-col">
                <DialogHeader><DialogTitle>Edit Product</DialogTitle></DialogHeader>
                <form onSubmit={handleEdit} className="space-y-3 overflow-y-auto pr-2 flex-1">
                  <div><Label>Product Name</Label><Input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} required /></div>
                  <div><Label>Description</Label><Textarea value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} /></div>
                  <div className="grid grid-cols-3 gap-3">
                    <div><Label>Purchase Rate</Label><Input type="number" min="0" step="0.01" value={editForm.purchase_rate} onChange={e => setEditForm({ ...editForm, purchase_rate: e.target.value })} /></div>
                    <div><Label>MRP</Label><Input type="number" min="0" step="0.01" value={editForm.mrp} onChange={e => { const m = e.target.value; const dr = parseFloat(editForm.discount_rate) || 0; setEditForm({ ...editForm, mrp: m, price: String((parseFloat(m) || 0) - dr) }); }} required /></div>
                    <div><Label>Discount Rate</Label><Input type="number" min="0" step="0.01" value={editForm.discount_rate} onChange={e => { const dr = e.target.value; const m = parseFloat(editForm.mrp) || 0; setEditForm({ ...editForm, discount_rate: dr, price: String(m - (parseFloat(dr) || 0)) }); }} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Selling Price</Label><Input type="number" value={editForm.price} onChange={e => setEditForm({ ...editForm, price: e.target.value })} /></div>
                    <div><Label>Stock</Label><Input type="number" min="0" value={editForm.stock} onChange={e => setEditForm({ ...editForm, stock: e.target.value })} /></div>
                  </div>
                  <div>
                    <Label>Category</Label>
                    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={editForm.category} onChange={e => setEditForm({ ...editForm, category: e.target.value })}>
                      <option value="">Select category</option>
                      {categories.filter(c => c.category_type === "grocery").length > 0 && (
                        <optgroup label="Grocery & Essentials">{categories.filter(c => c.category_type === "grocery").map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</optgroup>
                      )}
                      {categories.filter(c => c.category_type !== "grocery").length > 0 && (
                        <optgroup label="General Categories">{categories.filter(c => c.category_type !== "grocery").map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</optgroup>
                      )}
                    </select>
                  </div>
                  <ImageUpload bucket="products" value={editForm.image_url} onChange={url => setEditForm({ ...editForm, image_url: url })} label="Image 1" />
                  <div><Label>Image 2 (URL)</Label><Input value={editForm.image_url_2} onChange={e => setEditForm({ ...editForm, image_url_2: e.target.value })} /></div>
                  <div><Label>Image 3 (URL)</Label><Input value={editForm.image_url_3} onChange={e => setEditForm({ ...editForm, image_url_3: e.target.value })} /></div>
                  <div className="flex items-center gap-2 rounded-lg border p-3">
                    <Star className="h-4 w-4 text-yellow-500" />
                    <div className="flex-1"><Label className="text-sm font-medium">Featured Product</Label></div>
                    <Switch checked={editForm.is_featured} onCheckedChange={v => setEditForm({ ...editForm, is_featured: v })} />
                  </div>
                  <Button type="submit" className="w-full">Save Changes</Button>
                </form>
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* ORDERS TAB */}
          <TabsContent value="orders">
            {(() => {
              const pendingOrders = orders.filter(o => o.status === "seller_confirmation_pending");
              const otherOrders = orders.filter(o => o.status !== "seller_confirmation_pending");
              return orders.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No orders yet</p>
              ) : (
                <div className="space-y-4">
                  {pendingOrders.length > 0 && (
                    <Card className="border-destructive">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold text-destructive flex items-center gap-2">
                          🔔 {pendingOrders.length} Order{pendingOrders.length > 1 ? "s" : ""} Awaiting Your Confirmation
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="rounded-lg border overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Order ID</TableHead>
                                <TableHead>Items</TableHead>
                                <TableHead>Total</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Action</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {pendingOrders.map(o => {
                                const myItems = Array.isArray(o.items) ? o.items.filter((item: any) => products.some(p => p.id === item.id)) : [];
                                return (
                                  <TableRow key={o.id} className="bg-destructive/5">
                                    <TableCell className="font-mono text-xs">{o.id.slice(0, 8)}</TableCell>
                                    <TableCell className="text-xs max-w-[150px]">
                                      {myItems.length > 0 ? myItems.map((i: any) => `${i.name} ×${i.quantity || 1}`).join(", ") : (Array.isArray(o.items) ? o.items.map((i: any) => `${i.name} ×${i.quantity || 1}`).join(", ") : "-")}
                                    </TableCell>
                                    <TableCell>₹{o.total}</TableCell>
                                    <TableCell className="text-sm text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}</TableCell>
                                    <TableCell>
                                      <Button size="sm" variant="destructive" onClick={async () => {
                                        const { error } = await supabase.from("orders").update({ status: "seller_accepted" }).eq("id", o.id);
                                        if (error) {
                                          toast({ title: "Error", description: error.message, variant: "destructive" });
                                        } else {
                                          toast({ title: "Order accepted!" });
                                          fetchOrders(products);
                                        }
                                      }}>
                                        Accept Order
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {otherOrders.length > 0 && (
                    <div className="rounded-lg border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Order ID</TableHead>
                            <TableHead>Items</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Total</TableHead>
                            <TableHead>Date</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {otherOrders.map(o => {
                            const myItems = Array.isArray(o.items) ? o.items.filter((item: any) => products.some(p => p.id === item.id)) : [];
                            return (
                              <TableRow key={o.id}>
                                <TableCell className="font-mono text-xs">{o.id.slice(0, 8)}</TableCell>
                                <TableCell className="text-xs max-w-[150px]">
                                  {myItems.length > 0 ? myItems.map((i: any) => `${i.name} ×${i.quantity || 1}`).join(", ") : (Array.isArray(o.items) ? o.items.map((i: any) => `${i.name} ×${i.quantity || 1}`).join(", ") : "-")}
                                </TableCell>
                                <TableCell>
                                  <Badge variant={o.status === "delivered" ? "default" : "secondary"}>
                                    {STATUS_LABELS[o.status] || o.status.replace(/_/g, " ")}
                                  </Badge>
                                </TableCell>
                                <TableCell>₹{o.total}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              );
            })()}
          </TabsContent>

          {/* ANALYTICS TAB */}
          <TabsContent value="analytics" className="space-y-6">
            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm text-muted-foreground">Total Revenue</CardTitle>
                  <TrendingUp className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent><p className="text-2xl font-bold">₹{totalRevenue.toFixed(2)}</p><p className="text-xs text-muted-foreground">From {deliveredOrders.length} delivered orders (purchase rate basis)</p></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm text-muted-foreground">Items Sold</CardTitle>
                  <BarChart3 className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{analytics.itemStats.reduce((s, i) => s + i.sold, 0)}</p>
                  <p className="text-xs text-muted-foreground">Total units across all products</p>
                </CardContent>
              </Card>
            </div>

            {/* Item-wise stock & sales report */}
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Package className="h-4 w-4" /> Item-wise Stock & Sales Report</h3>
              <div className="rounded-lg border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead>Units Sold</TableHead>
                      <TableHead>Purchase Rate</TableHead>
                      <TableHead>Discount</TableHead>
                      <TableHead>Order %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map(p => {
                      const stat = analytics.itemStats.find(s => s.id === p.id) || { sold: 0, revenue: 0, purchaseRate: p.purchase_rate, discount: p.discount_rate, totalOrders: 0 };
                      const orderPct = totalOrderCount > 0 ? ((stat.totalOrders / totalOrderCount) * 100).toFixed(1) : "0.0";
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">{p.name}</TableCell>
                          <TableCell><Badge variant={p.stock > 0 ? "default" : "destructive"}>{p.stock}</Badge></TableCell>
                          <TableCell>{stat.sold}</TableCell>
                          <TableCell>₹{stat.purchaseRate.toFixed(2)}</TableCell>
                          <TableCell>₹{stat.discount.toFixed(2)}</TableCell>
                          <TableCell className="font-semibold">{orderPct}%</TableCell>
                        </TableRow>
                      );
                    })}
                    {products.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">No products</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Most ordered panchayaths */}
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><MapPin className="h-4 w-4" /> Most Ordered Panchayaths</h3>
              {analytics.panchayathStats.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-4">No location data yet</p>
              ) : (
                <div className="space-y-2">
                  {analytics.panchayathStats.map((p, i) => (
                    <div key={p.name} className="flex items-center justify-between rounded-lg border p-3">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-muted-foreground w-5">#{i + 1}</span>
                        <div>
                          <p className="font-medium text-sm">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{p.orders} orders</p>
                        </div>
                      </div>
                      <span className="font-semibold text-sm">₹{p.revenue.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* WALLET TAB */}
          <TabsContent value="wallet" className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <Card>
                <CardContent className="pt-5 text-center">
                  <p className="text-xs text-muted-foreground">Total Revenue</p>
                  <p className="text-xl font-bold mt-1">₹{totalCredits.toFixed(2)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5 text-center">
                  <p className="text-xs text-muted-foreground">Settled</p>
                  <p className="text-xl font-bold mt-1 text-destructive">-₹{totalSettled.toFixed(2)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5 text-center">
                  <p className="text-xs text-muted-foreground">Net Balance</p>
                  <p className="text-xl font-bold mt-1">₹{walletRevenue.toFixed(2)}</p>
                </CardContent>
              </Card>
            </div>

            {transactions.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No transactions yet</p>
            ) : (
              <div className="space-y-2">
                {transactions.map(t => {
                  const isSettlement = t.type === "settlement" || (t.description?.toLowerCase().includes("settl") ?? false);
                  return (
                    <div key={t.id} className={`flex justify-between items-start p-3 border rounded-lg ${isSettlement ? "bg-accent/30 border-primary/30" : ""}`}>
                      <div className="flex items-start gap-3">
                        {isSettlement && <ArrowDownLeft className="h-4 w-4 text-primary mt-0.5 shrink-0" />}
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">{t.description || t.type}</p>
                            {isSettlement && <Badge variant="outline" className="text-xs">Settlement</Badge>}
                          </div>
                          {t.order_id && <p className="text-xs text-muted-foreground">Order: {t.order_id.slice(0, 8)}</p>}
                          <p className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString()}</p>
                        </div>
                      </div>
                      <span className={`font-semibold shrink-0 ${t.amount >= 0 ? "text-green-600" : "text-destructive"}`}>
                        {t.amount >= 0 ? "+" : ""}₹{Math.abs(t.amount).toFixed(2)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* PENNY PRIME TAB */}
          <TabsContent value="prime" className="space-y-4">
            <PennyPrimeCoupons />
          </TabsContent>

          {/* PROFILE TAB */}
          <TabsContent value="profile" className="space-y-4">
            <form onSubmit={handleProfileSave} className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5" /> Company Details</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="company_name">Company / Business Name</Label>
                    <Input id="company_name" value={profileForm.company_name} onChange={e => setProfileForm(f => ({ ...f, company_name: e.target.value }))} maxLength={200} />
                  </div>
                  <div>
                    <Label htmlFor="gst_number">GST Number</Label>
                    <Input id="gst_number" value={profileForm.gst_number} onChange={e => setProfileForm(f => ({ ...f, gst_number: e.target.value.toUpperCase() }))} placeholder="e.g. 22AAAAA0000A1Z5" maxLength={15} />
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor="business_address">Business Address</Label>
                    <Textarea id="business_address" value={profileForm.business_address} onChange={e => setProfileForm(f => ({ ...f, business_address: e.target.value }))} maxLength={500} rows={2} />
                  </div>
                  <div>
                    <Label htmlFor="business_city">City</Label>
                    <Input id="business_city" value={profileForm.business_city} onChange={e => setProfileForm(f => ({ ...f, business_city: e.target.value }))} maxLength={100} />
                  </div>
                  <div>
                    <Label htmlFor="business_state">State</Label>
                    <Input id="business_state" value={profileForm.business_state} onChange={e => setProfileForm(f => ({ ...f, business_state: e.target.value }))} maxLength={100} />
                  </div>
                  <div>
                    <Label htmlFor="business_pincode">Pincode</Label>
                    <Input id="business_pincode" value={profileForm.business_pincode} onChange={e => setProfileForm(f => ({ ...f, business_pincode: e.target.value.replace(/\D/g, "").slice(0, 6) }))} maxLength={6} />
                  </div>
                  <div>
                    <Label htmlFor="business_phone">Business Phone</Label>
                    <Input id="business_phone" type="tel" value={profileForm.business_phone} onChange={e => setProfileForm(f => ({ ...f, business_phone: e.target.value.replace(/\D/g, "").slice(0, 10) }))} maxLength={10} />
                  </div>
                  <div>
                    <Label htmlFor="business_email">Business Email</Label>
                    <Input id="business_email" type="email" value={profileForm.business_email} onChange={e => setProfileForm(f => ({ ...f, business_email: e.target.value }))} maxLength={255} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Wallet className="h-5 w-5" /> Bank Details</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="bank_account_name">Account Holder Name</Label>
                    <Input id="bank_account_name" value={profileForm.bank_account_name} onChange={e => setProfileForm(f => ({ ...f, bank_account_name: e.target.value }))} maxLength={200} />
                  </div>
                  <div>
                    <Label htmlFor="bank_account_number">Account Number</Label>
                    <Input id="bank_account_number" value={profileForm.bank_account_number} onChange={e => setProfileForm(f => ({ ...f, bank_account_number: e.target.value.replace(/\D/g, "") }))} maxLength={20} />
                  </div>
                  <div>
                    <Label htmlFor="bank_ifsc">IFSC Code</Label>
                    <Input id="bank_ifsc" value={profileForm.bank_ifsc} onChange={e => setProfileForm(f => ({ ...f, bank_ifsc: e.target.value.toUpperCase() }))} placeholder="e.g. SBIN0001234" maxLength={11} />
                  </div>
                </CardContent>
              </Card>

              <Button type="submit" disabled={profileLoading} className="w-full sm:w-auto">
                {profileLoading ? "Saving..." : "Save Profile"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default SellingPartnerDashboard;
