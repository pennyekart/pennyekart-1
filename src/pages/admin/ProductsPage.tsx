import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/hooks/useAuth";
import { Plus, Pencil, Trash2 } from "lucide-react";

interface Product {
  id: string; name: string; description: string | null; price: number;
  category: string | null; stock: number; is_active: boolean; image_url: string | null;
  image_url_2: string | null; image_url_3: string | null;
  section: string | null; purchase_rate: number; mrp: number; discount_rate: number;
}

interface Category {
  id: string; name: string; category_type: string;
}

const sectionOptions = [
  { value: "", label: "None" },
  { value: "most_ordered", label: "Most Ordered Items" },
  { value: "new_arrivals", label: "New Arrivals" },
  { value: "low_budget", label: "Low Budget Picks" },
];

const emptyProduct = { name: "", description: "", price: 0, category: "", stock: 0, is_active: true, image_url: "", image_url_2: "", image_url_3: "", section: "", purchase_rate: 0, mrp: 0, discount_rate: 0 };

const ProductsPage = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState(emptyProduct);
  const [editId, setEditId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const { hasPermission } = usePermissions();
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchProducts = async () => {
    const { data } = await supabase.from("products").select("*").order("created_at", { ascending: false });
    setProducts((data as Product[]) ?? []);
  };

  const fetchCategories = async () => {
    const { data } = await supabase.from("categories").select("id, name, category_type").eq("is_active", true).order("sort_order");
    setCategories((data as Category[]) ?? []);
  };

  useEffect(() => { fetchProducts(); fetchCategories(); }, []);

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

  const openEdit = (p: Product) => {
    setForm({ name: p.name, description: p.description ?? "", price: p.price, category: p.category ?? "", stock: p.stock, is_active: p.is_active, image_url: p.image_url ?? "", image_url_2: p.image_url_2 ?? "", image_url_3: p.image_url_3 ?? "", section: p.section ?? "", purchase_rate: p.purchase_rate, mrp: p.mrp, discount_rate: p.discount_rate });
    setEditId(p.id); setOpen(true);
  };

  return (
    <AdminLayout>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Products</h1>
        {hasPermission("create_products") && (
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setForm(emptyProduct); setEditId(null); } }}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> Add Product</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editId ? "Edit Product" : "New Product"}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                <div className="grid grid-cols-3 gap-3">
                  <div><Label>Purchase Rate</Label><Input type="number" value={form.purchase_rate} onChange={(e) => setForm({ ...form, purchase_rate: +e.target.value })} /></div>
                  <div><Label>MRP</Label><Input type="number" value={form.mrp} onChange={(e) => setForm({ ...form, mrp: +e.target.value })} /></div>
                  <div><Label>Discount Rate</Label><Input type="number" value={form.discount_rate} onChange={(e) => setForm({ ...form, discount_rate: +e.target.value })} /></div>
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
                <div><Label>Image URL 1</Label><Input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="Main image URL" /></div>
                <div><Label>Image URL 2</Label><Input value={form.image_url_2} onChange={(e) => setForm({ ...form, image_url_2: e.target.value })} placeholder="Second image URL" /></div>
                <div><Label>Image URL 3</Label><Input value={form.image_url_3} onChange={(e) => setForm({ ...form, image_url_3: e.target.value })} placeholder="Third image URL" /></div>
                <div className="flex items-center gap-2"><Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} /><Label>Active</Label></div>
                <Button className="w-full" onClick={handleSave}>Save</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
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
              <TableHead>Active</TableHead>
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
                <TableCell>{p.is_active ? "✓" : "✗"}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {hasPermission("update_products") && <Button variant="ghost" size="sm" onClick={() => openEdit(p)}><Pencil className="h-3.5 w-3.5" /></Button>}
                    {hasPermission("delete_products") && <Button variant="ghost" size="sm" onClick={() => handleDelete(p.id)}><Trash2 className="h-3.5 w-3.5" /></Button>}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </AdminLayout>
  );
};

export default ProductsPage;
