import { useEffect, useState } from "react";
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
import { Plus, Pencil, Trash2, ExternalLink, Clock, Store, CheckCircle, XCircle } from "lucide-react";
import ImageUpload from "@/components/admin/ImageUpload";
import ProductVariants from "@/components/admin/ProductVariants";
import { useNavigate } from "react-router-dom";

interface Product {
  id: string; name: string; description: string | null; price: number;
  category: string | null; stock: number; is_active: boolean; image_url: string | null;
  image_url_2: string | null; image_url_3: string | null;
  section: string | null; purchase_rate: number; mrp: number; discount_rate: number;
  coming_soon?: boolean;
}

interface SellerProduct {
  id: string;
  name: string;
  price: number;
  mrp: number;
  stock: number;
  is_active: boolean;
  is_approved: boolean;
  is_featured: boolean;
  coming_soon: boolean;
  category: string | null;
  image_url: string | null;
  seller_id: string;
  created_at: string;
}

interface Category {
  id: string; name: string; category_type: string; variation_type: string | null;
}

const sectionOptions = [
  { value: "", label: "None" },
  { value: "featured", label: "Featured Products" },
  { value: "most_ordered", label: "Most Ordered Items" },
  { value: "new_arrivals", label: "New Arrivals" },
  { value: "low_budget", label: "Low Budget Picks" },
  { value: "sponsors", label: "Sponsors" },
];

const emptyProduct = { name: "", description: "", price: 0, category: "", stock: 0, is_active: true, image_url: "", image_url_2: "", image_url_3: "", section: "", purchase_rate: 0, mrp: 0, discount_rate: 0, video_url: "", coming_soon: false };

const ProductsPage = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [sellerProducts, setSellerProducts] = useState<SellerProduct[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState(emptyProduct);
  const [editId, setEditId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
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
      .select("id, name, price, mrp, stock, is_active, is_approved, is_featured, coming_soon, category, image_url, seller_id, created_at")
      .order("created_at", { ascending: false });
    setSellerProducts((data as SellerProduct[]) ?? []);
  };

  const fetchCategories = async () => {
    const { data } = await supabase.from("categories").select("id, name, category_type, variation_type").eq("is_active", true).order("sort_order");
    setCategories((data as Category[]) ?? []);
  };

  useEffect(() => {
    fetchProducts();
    fetchSellerProducts();
    fetchCategories();
  }, []);

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

  const openEdit = (p: Product) => {
    setForm({ name: p.name, description: p.description ?? "", price: p.price, category: p.category ?? "", stock: p.stock, is_active: p.is_active, image_url: p.image_url ?? "", image_url_2: p.image_url_2 ?? "", image_url_3: p.image_url_3 ?? "", section: p.section ?? "", purchase_rate: p.purchase_rate, mrp: p.mrp, discount_rate: p.discount_rate, video_url: (p as any).video_url ?? "", coming_soon: (p as any).coming_soon ?? false });
    setEditId(p.id); setOpen(true);
  };

  const productDialog = (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setForm(emptyProduct); setEditId(null); } }}>
      <DialogTrigger asChild>
        <Button><Plus className="mr-2 h-4 w-4" /> Add Product</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] flex flex-col">
        <DialogHeader><DialogTitle>{editId ? "Edit Product" : "New Product"}</DialogTitle></DialogHeader>
        <div className="space-y-3 overflow-y-auto pr-2 flex-1">
          <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Purchase Rate</Label><Input type="number" value={form.purchase_rate} onChange={(e) => setForm({ ...form, purchase_rate: +e.target.value })} /></div>
            <div><Label>MRP</Label><Input type="number" value={form.mrp} onChange={(e) => { const m = +e.target.value; setForm({ ...form, mrp: m, price: m - form.discount_rate }); }} /></div>
            <div><Label>Discount Rate</Label><Input type="number" value={form.discount_rate} onChange={(e) => { const dr = +e.target.value; setForm({ ...form, discount_rate: dr, price: form.mrp - dr }); }} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Selling Price</Label><Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: +e.target.value })} /></div>
            <div><Label>Stock</Label><Input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: +e.target.value })} /></div>
          </div>
          <div>
            <Label>Category</Label>
            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              <option value="">Select category</option>
              {categories.filter(c => c.category_type === "grocery").length > 0 && (
                <optgroup label="Grocery & Essentials">
                  {categories.filter(c => c.category_type === "grocery").map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </optgroup>
              )}
              {categories.filter(c => c.category_type !== "grocery").length > 0 && (
                <optgroup label="General Categories">
                  {categories.filter(c => c.category_type !== "grocery").map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
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
          <div className="mb-4 flex justify-end">
            {hasPermission("create_products") && productDialog}
          </div>
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Purchase Rate</TableHead>
                  <TableHead>MRP</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Coming Soon</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>₹{p.purchase_rate}</TableCell>
                    <TableCell>₹{p.mrp}</TableCell>
                    <TableCell>{p.discount_rate}%</TableCell>
                    <TableCell>₹{p.price}</TableCell>
                    <TableCell>{p.stock}</TableCell>
                    <TableCell>
                      {p.is_active
                        ? <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-0">Active</Badge>
                        : <Badge variant="secondary">Inactive</Badge>}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={!!(p as any).coming_soon}
                          onCheckedChange={() => toggleComingSoon(p)}
                          className="scale-90"
                        />
                        {(p as any).coming_soon && (
                          <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 border-0 gap-1 text-[10px]">
                            <Clock className="h-3 w-3" /> Soon
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
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Products submitted by selling partners. Approve them to make visible to customers.</p>
            <Button variant="outline" onClick={() => navigate("/selling-partner/dashboard")}>
              <Store className="mr-2 h-4 w-4" /> Seller Dashboard
              <ExternalLink className="ml-1 h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>MRP</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead>Approval</TableHead>
                  <TableHead>Featured</TableHead>
                  <TableHead>Coming Soon</TableHead>
                  <TableHead className="w-28">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sellerProducts.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{p.category ?? "—"}</TableCell>
                    <TableCell>₹{p.mrp}</TableCell>
                    <TableCell>₹{p.price}</TableCell>
                    <TableCell>{p.stock}</TableCell>
                    <TableCell>
                      {p.is_active
                        ? <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-0">Active</Badge>
                        : <Badge variant="secondary">Inactive</Badge>}
                    </TableCell>
                    <TableCell>
                      {p.is_approved
                        ? <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-0 gap-1"><CheckCircle className="h-3 w-3" /> Approved</Badge>
                        : <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 border-0 gap-1"><XCircle className="h-3 w-3" /> Pending</Badge>}
                    </TableCell>
                    <TableCell>
                      {p.is_featured ? <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-0">Featured</Badge> : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={p.coming_soon}
                          onCheckedChange={() => toggleSellerComingSoon(p)}
                          className="scale-90"
                        />
                        {p.coming_soon && (
                          <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 border-0 gap-1 text-[10px]">
                            <Clock className="h-3 w-3" /> Soon
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant={p.is_approved ? "outline" : "default"}
                        size="sm"
                        onClick={() => toggleSellerApproval(p)}
                      >
                        {p.is_approved ? "Revoke" : "Approve"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {sellerProducts.length === 0 && (
                  <TableRow><TableCell colSpan={10} className="py-8 text-center text-muted-foreground">No seller products found.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
};

export default ProductsPage;
