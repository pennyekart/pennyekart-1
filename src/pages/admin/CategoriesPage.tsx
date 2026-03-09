import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { Plus, Pencil, Trash2, Percent } from "lucide-react";
import ImageUpload from "@/components/admin/ImageUpload";

interface Category {
  id: string; name: string; icon: string | null; item_count: string | null;
  sort_order: number; is_active: boolean; category_type: string; image_url: string | null;
  variation_type: string | null; margin_percentage: number;
}

const VARIATION_TYPES = [
  { value: "none", label: "No Variations" },
  { value: "size", label: "Size (S, M, L, XL...)" },
  { value: "weight", label: "Weight (g / kg)" },
  { value: "color", label: "Color" },
  { value: "measurement", label: "Measurement (cm / inches)" },
];

const emptyCategory = { name: "", icon: "", item_count: "", sort_order: 0, is_active: true, category_type: "general", image_url: "", variation_type: "none", margin_percentage: 0 };

const CategoriesPage = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState(emptyCategory);
  const [editId, setEditId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("general");
  const { hasPermission } = usePermissions();
  const { toast } = useToast();

  const fetchCategories = async () => {
    const { data } = await supabase.from("categories").select("*").order("sort_order");
    setCategories((data as Category[]) ?? []);
  };

  useEffect(() => { fetchCategories(); }, []);

  const filtered = categories.filter((c) => c.category_type === tab);

  const handleSave = async () => {
    const { variation_type, ...rest } = form;
    const payload = { ...rest, category_type: tab, variation_type: variation_type === "none" ? null : variation_type };
    if (editId) {
      const { error } = await supabase.from("categories").update(payload).eq("id", editId);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    } else {
      const { error } = await supabase.from("categories").insert(payload);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    }
    setOpen(false); setForm(emptyCategory); setEditId(null); fetchCategories();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("categories").delete().eq("id", id);
    fetchCategories();
  };

  const openEdit = (c: Category) => {
    setForm({ 
      name: c.name, icon: c.icon ?? "", item_count: c.item_count ?? "", 
      sort_order: c.sort_order, is_active: c.is_active, category_type: c.category_type, 
      image_url: c.image_url ?? "", variation_type: c.variation_type ?? "none",
      margin_percentage: c.margin_percentage ?? 0
    });
    setEditId(c.id); setOpen(true);
  };

  return (
    <AdminLayout>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Categories</h1>
        {hasPermission("create_categories") && (
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setForm(emptyCategory); setEditId(null); } }}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> Add Category</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editId ? "Edit Category" : "New Category"}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div><Label>Icon Name (Lucide)</Label><Input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} placeholder="e.g. Apple, Shirt, Smartphone" /></div>
                <ImageUpload bucket="categories" value={form.image_url} onChange={(url) => setForm({ ...form, image_url: url })} label="Category Image" />
                {tab === "general" && (
                  <div><Label>Item Count</Label><Input value={form.item_count} onChange={(e) => setForm({ ...form, item_count: e.target.value })} placeholder="e.g. 2,400+" /></div>
                )}
                
                {/* Platform Margin */}
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                  <Label className="flex items-center gap-2 text-primary">
                    <Percent className="h-4 w-4" />
                    Platform Margin (%)
                  </Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Default commission percentage for products in this category
                  </p>
                  <Input 
                    type="number" 
                    min="0"
                    max="100"
                    step="0.1"
                    value={form.margin_percentage} 
                    onChange={(e) => setForm({ ...form, margin_percentage: +e.target.value })} 
                    placeholder="e.g. 10"
                  />
                </div>

                <div><Label>Sort Order</Label><Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: +e.target.value })} /></div>
                <div>
                  <Label>Variation Type</Label>
                  <Select value={form.variation_type} onValueChange={(v) => setForm({ ...form, variation_type: v })}>
                    <SelectTrigger><SelectValue placeholder="Select variation type" /></SelectTrigger>
                    <SelectContent>
                      {VARIATION_TYPES.map((vt) => (
                        <SelectItem key={vt.value} value={vt.value}>{vt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2"><Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} /><Label>Active</Label></div>
                <Button className="w-full" onClick={handleSave}>Save</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="general">General Categories</TabsTrigger>
          <TabsTrigger value="grocery">Grocery Categories</TabsTrigger>
        </TabsList>
        <TabsContent value={tab}>
          <div className="admin-table-wrap">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Icon</TableHead>
                  {tab === "general" && <TableHead>Items</TableHead>}
                  <TableHead>Margin %</TableHead>
                  <TableHead>Variation</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.icon}</TableCell>
                    {tab === "general" && <TableCell>{c.item_count}</TableCell>}
                    <TableCell>
                      <span className="font-medium text-primary">{c.margin_percentage ?? 0}%</span>
                    </TableCell>
                    <TableCell className="text-xs">{VARIATION_TYPES.find(v => v.value === (c.variation_type || "none"))?.label || "—"}</TableCell>
                    <TableCell>{c.sort_order}</TableCell>
                    <TableCell>{c.is_active ? "✓" : "✗"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {hasPermission("update_categories") && <Button variant="ghost" size="sm" onClick={() => openEdit(c)}><Pencil className="h-3.5 w-3.5" /></Button>}
                        {hasPermission("delete_categories") && <Button variant="ghost" size="sm" onClick={() => handleDelete(c.id)}><Trash2 className="h-3.5 w-3.5" /></Button>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">No categories yet</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
};

export default CategoriesPage;
