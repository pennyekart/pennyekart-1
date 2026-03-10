import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/hooks/useAuth";
import { Plus, Pencil, Trash2, ExternalLink, Clock, Store, CheckCircle, XCircle, Percent, Calculator } from "lucide-react";
import ImageUpload from "@/components/admin/ImageUpload";
import ProductVariants from "@/components/admin/ProductVariants";
import { useNavigate } from "react-router-dom";

interface Product {
  id: string; name: string; description: string | null; price: number;
  category: string | null; stock: number; is_active: boolean; image_url: string | null;
  image_url_2: string | null; image_url_3: string | null;
  section: string | null; purchase_rate: number; mrp: number; discount_rate: number;
  coming_soon?: boolean; margin_percentage?: number | null;
}

interface SellerProduct {
  id: string;
  name: string;
  description: string | null;
  price: number;
  mrp: number;
  purchase_rate: number;
  discount_rate: number;
  stock: number;
  is_active: boolean;
  is_approved: boolean;
  is_featured: boolean;
  coming_soon: boolean;
  category: string | null;
  image_url: string | null;
  image_url_2: string | null;
  image_url_3: string | null;
  video_url: string | null;
  seller_id: string;
  created_at: string;
  margin_percentage?: number | null;
}

interface Category {
  id: string; name: string; category_type: string; variation_type: string | null; margin_percentage: number;
}

const sectionOptions = [
  { value: "", label: "None" },
  { value: "featured", label: "Featured Products" },
  { value: "most_ordered", label: "Most Ordered Items" },
  { value: "new_arrivals", label: "New Arrivals" },
  { value: "low_budget", label: "Low Budget Picks" },
  { value: "sponsors", label: "Sponsors" },
];

const emptyProduct = { name: "", description: "", price: 0, category: "", stock: 0, is_active: true, image_url: "", image_url_2: "", image_url_3: "", section: "", purchase_rate: 0, mrp: 0, discount_rate: 0, video_url: "", coming_soon: false, wallet_points: 0, margin_percentage: null as number | null, featured_discount_type: "amount", featured_discount_value: 0 };

const ProductsPage = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [sellerProducts, setSellerProducts] = useState<SellerProduct[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState(emptyProduct);
  const [editId, setEditId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [sellerEditOpen, setSellerEditOpen] = useState(false);
  const [sellerEditId, setSellerEditId] = useState<string | null>(null);
  const [sellerForm, setSellerForm] = useState({ name: "", description: "", price: 0, mrp: 0, purchase_rate: 0, discount_rate: 0, stock: 0, category: "", is_active: true, is_approved: false, is_featured: false, coming_soon: false, image_url: "", image_url_2: "", image_url_3: "", video_url: "", wallet_points: 0, margin_percentage: null as number | null, featured_discount_type: "amount", featured_discount_value: 0 });
  const [ownCategoryFilter, setOwnCategoryFilter] = useState("");
  const [sellerCategoryFilter, setSellerCategoryFilter] = useState("");
  const { hasPermission } = usePermissions();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const fetchProducts = async () => {
    const { data } = await supabase.from("products").select("*").order("created_at", { ascending: false });
    setProducts((data as Product[]) ?? []);
  };

  const fetchSellerProducts = async () => {
    const { data } = await supabase
      .from("seller_products")
      .select("*")
      .order("created_at", { ascending: false });
    setSellerProducts((data as SellerProduct[]) ?? []);
  };

  const fetchCategories = async () => {
    const { data } = await supabase.from("categories").select("id, name, category_type, variation_type, margin_percentage").eq("is_active", true).order("sort_order");
    setCategories((data as Category[]) ?? []);
  };

  useEffect(() => {
    fetchProducts();
    fetchSellerProducts();
    fetchCategories();
  }, []);

  // Get category margin percentage
  const getCategoryMargin = useCallback((categoryName: string) => {
    const cat = categories.find(c => c.name === categoryName);
    return cat?.margin_percentage ?? 0;
  }, [categories]);

  // Calculate selling price from purchase rate + margin
  const calculateSellingPrice = useCallback((purchaseRate: number, marginPercentage: number) => {
    return Math.round(purchaseRate * (1 + marginPercentage / 100) * 100) / 100;
  }, []);

  // Calculate discount amount from MRP - selling price
  const calculateDiscount = useCallback((mrp: number, sellingPrice: number) => {
    return Math.max(0, mrp - sellingPrice);
  }, []);

  // Handle purchase rate change - auto-calculate selling price
  const handlePurchaseRateChange = (purchaseRate: number, currentForm: typeof form, setFormFn: typeof setForm) => {
    const margin = currentForm.margin_percentage ?? getCategoryMargin(currentForm.category);
    const newPrice = calculateSellingPrice(purchaseRate, margin);
    const newDiscount = calculateDiscount(currentForm.mrp, newPrice);
    setFormFn({ ...currentForm, purchase_rate: purchaseRate, price: newPrice, discount_rate: newDiscount });
  };

  // Handle margin change - auto-calculate selling price
  const handleMarginChange = (marginPercentage: number, currentForm: typeof form, setFormFn: typeof setForm) => {
    const newPrice = calculateSellingPrice(currentForm.purchase_rate, marginPercentage);
    const newDiscount = calculateDiscount(currentForm.mrp, newPrice);
    setFormFn({ ...currentForm, margin_percentage: marginPercentage, price: newPrice, discount_rate: newDiscount });
  };

  // Handle MRP change - auto-calculate discount
  const handleMrpChange = (mrp: number, currentForm: typeof form, setFormFn: typeof setForm) => {
    const newDiscount = calculateDiscount(mrp, currentForm.price);
    setFormFn({ ...currentForm, mrp, discount_rate: newDiscount });
  };

  // Handle selling price change - reverse calculate discount
  const handlePriceChange = (price: number, currentForm: typeof form, setFormFn: typeof setForm) => {
    const newDiscount = calculateDiscount(currentForm.mrp, price);
    setFormFn({ ...currentForm, price, discount_rate: newDiscount });
  };

  // Handle discount change - reverse calculate selling price
  const handleDiscountChange = (discount: number, currentForm: typeof form, setFormFn: typeof setForm) => {
    const newPrice = currentForm.mrp - discount;
    setFormFn({ ...currentForm, discount_rate: discount, price: Math.max(0, newPrice) });
  };

  // Handle category change - apply category margin if no product-specific margin
  const handleCategoryChange = (categoryName: string, currentForm: typeof form, setFormFn: typeof setForm) => {
    const categoryMargin = getCategoryMargin(categoryName);
    const effectiveMargin = currentForm.margin_percentage ?? categoryMargin;
    const newPrice = currentForm.purchase_rate > 0 ? calculateSellingPrice(currentForm.purchase_rate, effectiveMargin) : currentForm.price;
    const newDiscount = calculateDiscount(currentForm.mrp, newPrice);
    setFormFn({ ...currentForm, category: categoryName, price: newPrice, discount_rate: newDiscount });
  };

  const handleSave = async () => {
    if (editId) {
      const { error } = await supabase.from("products").update({ ...form, updated_by: user?.id }).eq("id", editId);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    } else {
      const { error } = await supabase.from("products").insert({ ...form, created_by: user?.id });
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    }
    setOpen(false); setForm(emptyProduct); setEditId(null); fetchProducts();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("products").delete().eq("id", id);
    fetchProducts();
  };

  const toggleComingSoon = async (p: Product) => {
    const newVal = !p.coming_soon;
    const { error } = await supabase.from("products").update({ coming_soon: newVal } as any).eq("id", p.id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: newVal ? "Marked as Coming Soon" : "Coming Soon removed" });
    fetchProducts();
  };

  const toggleSellerApproval = async (p: SellerProduct) => {
    const { error } = await supabase.from("seller_products").update({ is_approved: !p.is_approved }).eq("id", p.id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: `Product ${!p.is_approved ? "approved" : "unapproved"}` });
    fetchSellerProducts();
  };

  const toggleSellerComingSoon = async (p: SellerProduct) => {
    const newVal = !p.coming_soon;
    const { error } = await supabase.from("seller_products").update({ coming_soon: newVal } as any).eq("id", p.id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: newVal ? "Marked as Coming Soon" : "Coming Soon removed" });
    fetchSellerProducts();
  };

  const handleSellerDelete = async (id: string) => {
    const { error } = await supabase.from("seller_products").delete().eq("id", id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Seller product deleted" });
    fetchSellerProducts();
  };

  const openSellerEdit = (p: SellerProduct) => {
    setSellerForm({
      name: p.name, description: p.description ?? "", price: p.price, mrp: p.mrp,
      purchase_rate: p.purchase_rate, discount_rate: p.discount_rate, stock: p.stock,
      category: p.category ?? "", is_active: p.is_active, is_approved: p.is_approved,
      is_featured: p.is_featured, coming_soon: p.coming_soon,
      image_url: p.image_url ?? "", image_url_2: p.image_url_2 ?? "",
      image_url_3: p.image_url_3 ?? "", video_url: p.video_url ?? "",
      wallet_points: (p as any).wallet_points ?? 0,
      margin_percentage: p.margin_percentage ?? null,
    });
    setSellerEditId(p.id);
    setSellerEditOpen(true);
  };

  const handleSellerSave = async () => {
    if (!sellerEditId) return;
    const { error } = await supabase.from("seller_products").update({
      name: sellerForm.name, description: sellerForm.description || null,
      price: sellerForm.price, mrp: sellerForm.mrp, purchase_rate: sellerForm.purchase_rate,
      discount_rate: sellerForm.discount_rate, stock: sellerForm.stock,
      category: sellerForm.category || null, is_active: sellerForm.is_active,
      is_approved: sellerForm.is_approved, is_featured: sellerForm.is_featured,
      coming_soon: sellerForm.coming_soon, image_url: sellerForm.image_url || null,
      image_url_2: sellerForm.image_url_2 || null, image_url_3: sellerForm.image_url_3 || null,
      video_url: sellerForm.video_url || null, wallet_points: sellerForm.wallet_points,
      // margin_percentage is NOT updated here — managed only via Platform Margin page
    }).eq("id", sellerEditId);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Seller product updated" });
    setSellerEditOpen(false); setSellerEditId(null); fetchSellerProducts();
  };

  const openEdit = (p: Product) => {
    setForm({ 
      name: p.name, description: p.description ?? "", price: p.price, category: p.category ?? "", 
      stock: p.stock, is_active: p.is_active, image_url: p.image_url ?? "", 
      image_url_2: p.image_url_2 ?? "", image_url_3: p.image_url_3 ?? "", section: p.section ?? "", 
      purchase_rate: p.purchase_rate, mrp: p.mrp, discount_rate: p.discount_rate, 
      video_url: (p as any).video_url ?? "", coming_soon: (p as any).coming_soon ?? false, 
      wallet_points: (p as any).wallet_points ?? 0,
      margin_percentage: p.margin_percentage ?? null
    });
    setEditId(p.id); setOpen(true);
  };

  // Calculate effective margin (product-specific or category default)
  const getEffectiveMargin = (product: Product | SellerProduct) => {
    if (product.margin_percentage != null) return product.margin_percentage;
    if (product.category) return getCategoryMargin(product.category);
    return 0;
  };

  const productDialog = (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setForm(emptyProduct); setEditId(null); } }}>
      <DialogTrigger asChild>
        <Button><Plus className="mr-2 h-4 w-4" /> Add Product</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] flex flex-col max-w-[95vw] sm:max-w-lg">
        <DialogHeader><DialogTitle>{editId ? "Edit Product" : "New Product"}</DialogTitle></DialogHeader>
        <div className="space-y-3 overflow-y-auto pr-2 flex-1">
          <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          
          {/* Category Selection */}
          <div>
            <Label>Category</Label>
            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.category} onChange={(e) => handleCategoryChange(e.target.value, form, setForm)}>
              <option value="">Select category</option>
              {categories.filter(c => c.category_type === "grocery").length > 0 && (
                <optgroup label="Grocery & Essentials">
                  {categories.filter(c => c.category_type === "grocery").map(c => (
                    <option key={c.id} value={c.name}>{c.name} ({c.margin_percentage}% margin)</option>
                  ))}
                </optgroup>
              )}
              {categories.filter(c => c.category_type !== "grocery").length > 0 && (
                <optgroup label="General Categories">
                  {categories.filter(c => c.category_type !== "grocery").map(c => (
                    <option key={c.id} value={c.name}>{c.name} ({c.margin_percentage}% margin)</option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          {/* Platform Margin Override */}
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
            <Label className="flex items-center gap-2 text-primary text-sm">
              <Percent className="h-4 w-4" />
              Platform Margin (%)
            </Label>
            <p className="text-xs text-muted-foreground mb-2">
              Override category margin ({getCategoryMargin(form.category)}%) for this product
            </p>
            <Input 
              type="number" 
              min="0"
              max="100"
              step="0.1"
              value={form.margin_percentage ?? ""} 
              onChange={(e) => {
                const val = e.target.value === "" ? null : +e.target.value;
                if (val !== null) {
                  handleMarginChange(val, form, setForm);
                } else {
                  // Reset to category margin
                  const catMargin = getCategoryMargin(form.category);
                  const newPrice = calculateSellingPrice(form.purchase_rate, catMargin);
                  setForm({ ...form, margin_percentage: null, price: newPrice, discount_rate: calculateDiscount(form.mrp, newPrice) });
                }
              }}
              placeholder={`Category default: ${getCategoryMargin(form.category)}%`}
            />
          </div>

          {/* Pricing with Auto-Calculation */}
          <div className="rounded-lg border p-3 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Calculator className="h-4 w-4" />
              Pricing (Auto-calculated)
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Purchase Rate</Label>
                <Input type="number" value={form.purchase_rate} onChange={(e) => handlePurchaseRateChange(+e.target.value, form, setForm)} />
              </div>
              <div>
                <Label className="text-xs">Selling Price (auto)</Label>
                <Input type="number" value={form.price} onChange={(e) => handlePriceChange(+e.target.value, form, setForm)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">MRP</Label>
                <Input type="number" value={form.mrp} onChange={(e) => handleMrpChange(+e.target.value, form, setForm)} />
              </div>
              <div>
                <Label className="text-xs">Discount Amount (auto)</Label>
                <Input type="number" value={form.discount_rate} onChange={(e) => handleDiscountChange(+e.target.value, form, setForm)} />
              </div>
            </div>
            {form.purchase_rate > 0 && form.price > 0 && (
              <p className="text-xs text-muted-foreground">
                Margin: ₹{(form.price - form.purchase_rate).toFixed(2)} ({((form.price - form.purchase_rate) / form.purchase_rate * 100).toFixed(1)}%)
              </p>
            )}
          </div>

          <div><Label>Stock</Label><Input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: +e.target.value })} /></div>
          
          <ImageUpload bucket="products" value={form.image_url} onChange={(url) => setForm({ ...form, image_url: url })} label="Image 1 (Main)" />
          <ImageUpload bucket="products" value={form.image_url_2} onChange={(url) => setForm({ ...form, image_url_2: url })} label="Image 2" />
          <ImageUpload bucket="products" value={form.image_url_3} onChange={(url) => setForm({ ...form, image_url_3: url })} label="Image 3" />
          <div><Label>Video URL (YouTube)</Label><Input value={form.video_url} onChange={(e) => setForm({ ...form, video_url: e.target.value })} placeholder="https://youtube.com/watch?v=..." /></div>
          <div>
            <Label>Section</Label>
            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })}>
              {sectionOptions.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2"><Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} /><Label>Active</Label></div>
            <div className="flex items-center gap-2"><Switch checked={form.coming_soon} onCheckedChange={(v) => setForm({ ...form, coming_soon: v })} /><Label>Coming Soon</Label></div>
          </div>
          <div><Label>Wallet Points (earned by customer)</Label><Input type="number" value={form.wallet_points} onChange={(e) => setForm({ ...form, wallet_points: +e.target.value })} placeholder="0" /></div>
          {(() => {
            const selectedCat = categories.find(c => c.name === form.category);
            if (selectedCat?.variation_type) {
              return (
                <ProductVariants
                  productId={editId}
                  variationType={selectedCat.variation_type}
                  basePrice={form.price}
                  baseMrp={form.mrp}
                />
              );
            }
            return null;
          })()}
          <Button className="w-full" onClick={handleSave}>Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <AdminLayout>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Products</h1>
      </div>

      <Tabs defaultValue="own">
        <TabsList className="mb-4">
          <TabsTrigger value="own">
            Own Products
            <Badge variant="secondary" className="ml-2">{products.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="sellers">
            Seller Products
            <Badge variant="secondary" className="ml-2">{sellerProducts.length}</Badge>
          </TabsTrigger>
        </TabsList>

        {/* OWN PRODUCTS TAB */}
        <TabsContent value="own">
          <div className="mb-4 flex items-center justify-between gap-3">
            <select className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm" value={ownCategoryFilter} onChange={(e) => setOwnCategoryFilter(e.target.value)}>
              <option value="">All Categories</option>
              {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
            <div>{hasPermission("create_products") && productDialog}</div>
          </div>
          <div className="admin-table-wrap">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Purchase</TableHead>
                  <TableHead>Margin %</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>MRP</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.filter(p => !ownCategoryFilter || p.category === ownCategoryFilter).map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>₹{p.purchase_rate}</TableCell>
                    <TableCell>
                      <span className="text-primary font-medium">{getEffectiveMargin(p).toFixed(1)}%</span>
                    </TableCell>
                    <TableCell>₹{p.price}</TableCell>
                    <TableCell>₹{p.mrp}</TableCell>
                    <TableCell>₹{p.discount_rate}</TableCell>
                    <TableCell>{p.stock}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {p.is_active
                          ? <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-0">Active</Badge>
                          : <Badge variant="secondary">Inactive</Badge>}
                        {(p as any).coming_soon && (
                          <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 border-0 gap-1 text-[10px]">
                            <Clock className="h-3 w-3" />
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {hasPermission("update_products") && <Button variant="ghost" size="sm" onClick={() => openEdit(p)}><Pencil className="h-3.5 w-3.5" /></Button>}
                        {hasPermission("delete_products") && <Button variant="ghost" size="sm" onClick={() => handleDelete(p.id)}><Trash2 className="h-3.5 w-3.5" /></Button>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {products.length === 0 && (
                  <TableRow><TableCell colSpan={9} className="py-8 text-center text-muted-foreground">No products found.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* SELLER PRODUCTS TAB */}
        <TabsContent value="sellers">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <select className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm" value={sellerCategoryFilter} onChange={(e) => setSellerCategoryFilter(e.target.value)}>
                <option value="">All Categories</option>
                {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
              <p className="text-sm text-muted-foreground hidden sm:block">Approve to make visible to customers.</p>
            </div>
            <Button variant="outline" onClick={() => navigate("/selling-partner/dashboard")}>
              <Store className="mr-2 h-4 w-4" /> Seller Dashboard
              <ExternalLink className="ml-1 h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="admin-table-wrap">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Purchase</TableHead>
                  <TableHead>Margin %</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>MRP</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Approval</TableHead>
                  <TableHead className="w-28">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sellerProducts.filter(p => !sellerCategoryFilter || p.category === sellerCategoryFilter).map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{p.category ?? "—"}</TableCell>
                    <TableCell>₹{p.purchase_rate}</TableCell>
                    <TableCell>
                      <span className="text-primary font-medium">{getEffectiveMargin(p).toFixed(1)}%</span>
                    </TableCell>
                    <TableCell>₹{p.price}</TableCell>
                    <TableCell>₹{p.mrp}</TableCell>
                    <TableCell>₹{p.discount_rate}</TableCell>
                    <TableCell>
                      {p.is_approved
                        ? <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-0 gap-1"><CheckCircle className="h-3 w-3" /> Approved</Badge>
                        : <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 border-0 gap-1"><XCircle className="h-3 w-3" /> Pending</Badge>}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openSellerEdit(p)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleSellerDelete(p.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant={p.is_approved ? "outline" : "default"}
                          size="sm"
                          onClick={() => toggleSellerApproval(p)}
                        >
                          {p.is_approved ? "Revoke" : "Approve"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {sellerProducts.length === 0 && (
                  <TableRow><TableCell colSpan={9} className="py-8 text-center text-muted-foreground">No seller products found.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Seller Product Edit Dialog */}
      <Dialog open={sellerEditOpen} onOpenChange={(v) => { setSellerEditOpen(v); if (!v) setSellerEditId(null); }}>
        <DialogContent className="max-h-[85vh] flex flex-col">
          <DialogHeader><DialogTitle>Edit Seller Product</DialogTitle></DialogHeader>
          <div className="space-y-3 overflow-y-auto pr-2 flex-1">
            <div><Label>Name</Label><Input value={sellerForm.name} onChange={(e) => setSellerForm({ ...sellerForm, name: e.target.value })} /></div>
            <div><Label>Description</Label><Input value={sellerForm.description} onChange={(e) => setSellerForm({ ...sellerForm, description: e.target.value })} /></div>
            
            {/* Category Selection */}
            <div>
              <Label>Category</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={sellerForm.category} onChange={(e) => handleCategoryChange(e.target.value, sellerForm as any, setSellerForm as any)}>
                <option value="">Select category</option>
                {categories.filter(c => c.category_type === "grocery").length > 0 && (
                  <optgroup label="Grocery & Essentials">
                    {categories.filter(c => c.category_type === "grocery").map(c => (
                      <option key={c.id} value={c.name}>{c.name} ({c.margin_percentage}% margin)</option>
                    ))}
                  </optgroup>
                )}
                {categories.filter(c => c.category_type !== "grocery").length > 0 && (
                  <optgroup label="General Categories">
                    {categories.filter(c => c.category_type !== "grocery").map(c => (
                      <option key={c.id} value={c.name}>{c.name} ({c.margin_percentage}% margin)</option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>

            {/* Platform Margin (Read-only — managed from Platform Margin page) */}
            <div className="rounded-lg border border-muted bg-muted/30 p-3">
              <Label className="flex items-center gap-2 text-muted-foreground text-sm">
                <Percent className="h-4 w-4" />
                Platform Margin (%)
              </Label>
              <p className="text-xs text-muted-foreground mb-2">
                Margin is managed by admin via Platform Margin page. Sellers cannot override this.
              </p>
              <div className="flex items-center gap-2">
                <Input 
                  type="number" 
                  value={sellerForm.margin_percentage ?? getCategoryMargin(sellerForm.category)} 
                  disabled
                  className="w-32 bg-muted"
                />
                <span className="text-sm text-muted-foreground">
                  {sellerForm.margin_percentage != null ? "(Product override)" : "(Category default)"}
                </span>
              </div>
            </div>

            {/* Pricing with Auto-Calculation */}
            <div className="rounded-lg border p-3 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Calculator className="h-4 w-4" />
                Pricing (Auto-calculated)
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Purchase Rate</Label>
                  <Input type="number" value={sellerForm.purchase_rate} onChange={(e) => handlePurchaseRateChange(+e.target.value, sellerForm as any, setSellerForm as any)} />
                </div>
                <div>
                  <Label className="text-xs">Selling Price (auto)</Label>
                  <Input type="number" value={sellerForm.price} onChange={(e) => handlePriceChange(+e.target.value, sellerForm as any, setSellerForm as any)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">MRP</Label>
                  <Input type="number" value={sellerForm.mrp} onChange={(e) => handleMrpChange(+e.target.value, sellerForm as any, setSellerForm as any)} />
                </div>
                <div>
                  <Label className="text-xs">Discount Amount (auto)</Label>
                  <Input type="number" value={sellerForm.discount_rate} onChange={(e) => handleDiscountChange(+e.target.value, sellerForm as any, setSellerForm as any)} />
                </div>
              </div>
              {sellerForm.purchase_rate > 0 && sellerForm.price > 0 && (
                <p className="text-xs text-muted-foreground">
                  Margin: ₹{(sellerForm.price - sellerForm.purchase_rate).toFixed(2)} ({((sellerForm.price - sellerForm.purchase_rate) / sellerForm.purchase_rate * 100).toFixed(1)}%)
                </p>
              )}
            </div>

            <div><Label>Stock</Label><Input type="number" value={sellerForm.stock} onChange={(e) => setSellerForm({ ...sellerForm, stock: +e.target.value })} /></div>
            
            <ImageUpload bucket="products" value={sellerForm.image_url} onChange={(url) => setSellerForm({ ...sellerForm, image_url: url })} label="Image 1 (Main)" />
            <ImageUpload bucket="products" value={sellerForm.image_url_2} onChange={(url) => setSellerForm({ ...sellerForm, image_url_2: url })} label="Image 2" />
            <ImageUpload bucket="products" value={sellerForm.image_url_3} onChange={(url) => setSellerForm({ ...sellerForm, image_url_3: url })} label="Image 3" />
            <div><Label>Video URL (YouTube)</Label><Input value={sellerForm.video_url} onChange={(e) => setSellerForm({ ...sellerForm, video_url: e.target.value })} placeholder="https://youtube.com/watch?v=..." /></div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2"><Switch checked={sellerForm.is_active} onCheckedChange={(v) => setSellerForm({ ...sellerForm, is_active: v })} /><Label>Active</Label></div>
              <div className="flex items-center gap-2"><Switch checked={sellerForm.is_approved} onCheckedChange={(v) => setSellerForm({ ...sellerForm, is_approved: v })} /><Label>Approved</Label></div>
              <div className="flex items-center gap-2"><Switch checked={sellerForm.is_featured} onCheckedChange={(v) => setSellerForm({ ...sellerForm, is_featured: v })} /><Label>Featured</Label></div>
              <div className="flex items-center gap-2"><Switch checked={sellerForm.coming_soon} onCheckedChange={(v) => setSellerForm({ ...sellerForm, coming_soon: v })} /><Label>Coming Soon</Label></div>
            </div>
            <div><Label>Wallet Points (earned by customer)</Label><Input type="number" value={sellerForm.wallet_points} onChange={(e) => setSellerForm({ ...sellerForm, wallet_points: +e.target.value })} placeholder="0" /></div>
            <Button className="w-full" onClick={handleSellerSave}>Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default ProductsPage;
