import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { Percent, Save, Search, ChevronDown, ChevronRight } from "lucide-react";

interface Category {
  id: string;
  name: string;
  category_type: string;
  margin_percentage: number | null;
  is_active: boolean;
}

interface Product {
  id: string;
  name: string;
  category: string | null;
  purchase_rate: number;
  price: number;
  mrp: number;
  discount_rate: number;
  margin_percentage: number | null;
  is_active: boolean;
}

interface SellerProduct {
  id: string;
  name: string;
  category: string | null;
  purchase_rate: number;
  price: number;
  mrp: number;
  discount_rate: number;
  margin_percentage: number | null;
  is_active: boolean;
  seller_id: string;
}

const PlatformMarginPage = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [sellerProducts, setSellerProducts] = useState<SellerProduct[]>([]);
  const [catEdits, setCatEdits] = useState<Record<string, number>>({});
  const [prodEdits, setProdEdits] = useState<Record<string, number | null>>({});
  const [sellerProdEdits, setSellerProdEdits] = useState<Record<string, number | null>>({});
  const [searchOwn, setSearchOwn] = useState("");
  const [searchSeller, setSearchSeller] = useState("");
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const [savingCats, setSavingCats] = useState(false);
  const [savingProds, setSavingProds] = useState(false);
  const { hasPermission } = usePermissions();
  const { toast } = useToast();

  const fetchAll = async () => {
    const [catRes, prodRes, sellerRes] = await Promise.all([
      supabase.from("categories").select("id, name, category_type, margin_percentage, is_active").eq("is_active", true).order("sort_order"),
      supabase.from("products").select("id, name, category, purchase_rate, price, mrp, discount_rate, margin_percentage, is_active").order("name"),
      supabase.from("seller_products").select("id, name, category, purchase_rate, price, mrp, discount_rate, margin_percentage, is_active, seller_id").order("name"),
    ]);
    setCategories((catRes.data as Category[]) ?? []);
    setProducts((prodRes.data as Product[]) ?? []);
    setSellerProducts((sellerRes.data as SellerProduct[]) ?? []);
  };

  useEffect(() => { fetchAll(); }, []);

  const getCategoryMargin = useCallback((catName: string) => {
    const cat = categories.find(c => c.name === catName);
    return cat?.margin_percentage ?? 0;
  }, [categories]);

  const getEffectiveMargin = (product: Product | SellerProduct) => {
    if (product.margin_percentage != null) return product.margin_percentage;
    if (product.category) return getCategoryMargin(product.category);
    return 0;
  };

  // Save all category margin changes
  const saveCategoryMargins = async () => {
    const entries = Object.entries(catEdits);
    if (entries.length === 0) return;
    setSavingCats(true);
    let errorCount = 0;
    for (const [id, margin] of entries) {
      const { error } = await supabase.from("categories").update({ margin_percentage: margin }).eq("id", id);
      if (error) errorCount++;
    }
    setSavingCats(false);
    if (errorCount > 0) {
      toast({ title: "Some updates failed", variant: "destructive" });
    } else {
      toast({ title: `${entries.length} category margin(s) updated` });
      setCatEdits({});
      fetchAll();
    }
  };

  // Save individual product margin + recalculate price
  const saveProductMargin = async (p: Product, margin: number | null) => {
    const effectiveMargin = margin ?? getCategoryMargin(p.category ?? "");
    const newPrice = p.purchase_rate > 0 ? Math.round(p.purchase_rate * (1 + effectiveMargin / 100) * 100) / 100 : p.price;
    const newDiscount = Math.max(0, p.mrp - newPrice);
    const { error } = await supabase.from("products").update({
      margin_percentage: margin,
      price: newPrice,
      discount_rate: newDiscount,
    }).eq("id", p.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `Margin updated for ${p.name}` });
      setProdEdits(prev => { const n = { ...prev }; delete n[p.id]; return n; });
      fetchAll();
    }
  };

  const saveSellerProductMargin = async (p: SellerProduct, margin: number | null) => {
    const effectiveMargin = margin ?? getCategoryMargin(p.category ?? "");
    const newPrice = p.purchase_rate > 0 ? Math.round(p.purchase_rate * (1 + effectiveMargin / 100) * 100) / 100 : p.price;
    const newDiscount = Math.max(0, p.mrp - newPrice);
    const { error } = await supabase.from("seller_products").update({
      margin_percentage: margin,
      price: newPrice,
      discount_rate: newDiscount,
    }).eq("id", p.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `Margin updated for ${p.name}` });
      setSellerProdEdits(prev => { const n = { ...prev }; delete n[p.id]; return n; });
      fetchAll();
    }
  };

  // Bulk apply category margin to all products in category
  const applyMarginToAllProducts = async (catName: string, margin: number) => {
    setSavingProds(true);
    const catProducts = products.filter(p => p.category === catName);
    const catSellerProducts = sellerProducts.filter(p => p.category === catName);
    let count = 0;

    for (const p of catProducts) {
      const newPrice = p.purchase_rate > 0 ? Math.round(p.purchase_rate * (1 + margin / 100) * 100) / 100 : p.price;
      const newDiscount = Math.max(0, p.mrp - newPrice);
      await supabase.from("products").update({ margin_percentage: null, price: newPrice, discount_rate: newDiscount }).eq("id", p.id);
      count++;
    }
    for (const p of catSellerProducts) {
      const newPrice = p.purchase_rate > 0 ? Math.round(p.purchase_rate * (1 + margin / 100) * 100) / 100 : p.price;
      const newDiscount = Math.max(0, p.mrp - newPrice);
      await supabase.from("seller_products").update({ margin_percentage: null, price: newPrice, discount_rate: newDiscount }).eq("id", p.id);
      count++;
    }
    setSavingProds(false);
    toast({ title: `Applied ${margin}% margin to ${count} products in ${catName}` });
    fetchAll();
  };

  const filteredOwn = products.filter(p =>
    (!searchOwn || p.name.toLowerCase().includes(searchOwn.toLowerCase()) || (p.category ?? "").toLowerCase().includes(searchOwn.toLowerCase()))
  );

  const filteredSeller = sellerProducts.filter(p =>
    (!searchSeller || p.name.toLowerCase().includes(searchSeller.toLowerCase()) || (p.category ?? "").toLowerCase().includes(searchSeller.toLowerCase()))
  );

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Percent className="h-6 w-6 text-primary" />
          Platform Margin / Commission
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Set default margins by category or override per product. Price auto-calculates from purchase rate + margin.
        </p>
      </div>

      <Tabs defaultValue="categories">
        <TabsList className="mb-4">
          <TabsTrigger value="categories">By Categories</TabsTrigger>
          <TabsTrigger value="own_products">Own Products</TabsTrigger>
          <TabsTrigger value="seller_products">Seller Products</TabsTrigger>
        </TabsList>

        {/* CATEGORIES TAB */}
        <TabsContent value="categories">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Category-wise Margin</CardTitle>
                  <CardDescription>Set default commission % for each category. All products in the category inherit this margin unless overridden.</CardDescription>
                </div>
                {Object.keys(catEdits).length > 0 && (
                  <Button onClick={saveCategoryMargins} disabled={savingCats}>
                    <Save className="mr-2 h-4 w-4" />
                    Save {Object.keys(catEdits).length} Change(s)
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Products</TableHead>
                    <TableHead className="w-40">Margin %</TableHead>
                    <TableHead className="w-48">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map(cat => {
                    const prodCount = products.filter(p => p.category === cat.name).length + sellerProducts.filter(p => p.category === cat.name).length;
                    const currentMargin = catEdits[cat.id] ?? cat.margin_percentage ?? 0;
                    const isEdited = cat.id in catEdits;
                    const isExpanded = expandedCat === cat.id;

                    return (
                      <>
                        <TableRow key={cat.id} className={isEdited ? "bg-primary/5" : ""}>
                          <TableCell className="font-medium">
                            <button className="flex items-center gap-1 hover:text-primary" onClick={() => setExpandedCat(isExpanded ? null : cat.id)}>
                              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              {cat.name}
                            </button>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">{cat.category_type}</Badge>
                          </TableCell>
                          <TableCell>{prodCount}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                step="0.1"
                                className="w-24 h-8"
                                value={currentMargin}
                                onChange={(e) => setCatEdits({ ...catEdits, [cat.id]: +e.target.value })}
                              />
                              <span className="text-muted-foreground text-sm">%</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={savingProds}
                              onClick={() => applyMarginToAllProducts(cat.name, currentMargin)}
                            >
                              Apply to all {prodCount} products
                            </Button>
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <>
                            {products.filter(p => p.category === cat.name).map(p => (
                              <TableRow key={`own-${p.id}`} className="bg-muted/30">
                                <TableCell className="pl-10 text-sm">{p.name}</TableCell>
                                <TableCell><Badge variant="secondary" className="text-[10px]">Own</Badge></TableCell>
                                <TableCell className="text-xs text-muted-foreground">PR: ₹{p.purchase_rate} → ₹{p.price}</TableCell>
                                <TableCell>
                                  <span className="text-sm font-medium text-primary">{getEffectiveMargin(p).toFixed(1)}%</span>
                                  {p.margin_percentage != null && <Badge variant="outline" className="ml-1 text-[9px]">Override</Badge>}
                                </TableCell>
                                <TableCell />
                              </TableRow>
                            ))}
                            {sellerProducts.filter(p => p.category === cat.name).map(p => (
                              <TableRow key={`sp-${p.id}`} className="bg-muted/30">
                                <TableCell className="pl-10 text-sm">{p.name}</TableCell>
                                <TableCell><Badge className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-0">Seller</Badge></TableCell>
                                <TableCell className="text-xs text-muted-foreground">PR: ₹{p.purchase_rate} → ₹{p.price}</TableCell>
                                <TableCell>
                                  <span className="text-sm font-medium text-primary">{getEffectiveMargin(p).toFixed(1)}%</span>
                                  {p.margin_percentage != null && <Badge variant="outline" className="ml-1 text-[9px]">Override</Badge>}
                                </TableCell>
                                <TableCell />
                              </TableRow>
                            ))}
                            {products.filter(p => p.category === cat.name).length === 0 && sellerProducts.filter(p => p.category === cat.name).length === 0 && (
                              <TableRow><TableCell colSpan={5} className="pl-10 text-sm text-muted-foreground">No products in this category</TableCell></TableRow>
                            )}
                          </>
                        )}
                      </>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* OWN PRODUCTS TAB */}
        <TabsContent value="own_products">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Product-wise Margin (Own)</CardTitle>
                  <CardDescription>Override margin for individual products. Leave blank to use category default.</CardDescription>
                </div>
                <div className="relative w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search products..." className="pl-9" value={searchOwn} onChange={(e) => setSearchOwn(e.target.value)} />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Purchase Rate</TableHead>
                    <TableHead>Current Price</TableHead>
                    <TableHead>MRP</TableHead>
                    <TableHead>Cat Margin</TableHead>
                    <TableHead className="w-36">Product Margin %</TableHead>
                    <TableHead>Effective</TableHead>
                    <TableHead className="w-20">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOwn.map(p => {
                    const editVal = prodEdits[p.id];
                    const hasEdit = p.id in prodEdits;
                    const catMargin = getCategoryMargin(p.category ?? "");

                    return (
                      <TableRow key={p.id} className={hasEdit ? "bg-primary/5" : ""}>
                        <TableCell className="font-medium text-sm">{p.name}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{p.category || "—"}</Badge></TableCell>
                        <TableCell>₹{p.purchase_rate}</TableCell>
                        <TableCell>₹{p.price}</TableCell>
                        <TableCell>₹{p.mrp}</TableCell>
                        <TableCell className="text-muted-foreground">{catMargin}%</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            className="w-24 h-8"
                            value={hasEdit ? (editVal ?? "") : (p.margin_percentage ?? "")}
                            placeholder={`${catMargin}%`}
                            onChange={(e) => {
                              const val = e.target.value === "" ? null : +e.target.value;
                              setProdEdits({ ...prodEdits, [p.id]: val });
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <span className="font-medium text-primary">
                            {(hasEdit ? (editVal ?? catMargin) : getEffectiveMargin(p)).toFixed(1)}%
                          </span>
                        </TableCell>
                        <TableCell>
                          {hasEdit && (
                            <Button size="sm" variant="default" className="h-7 text-xs" onClick={() => saveProductMargin(p, editVal ?? null)}>
                              <Save className="h-3 w-3 mr-1" />Save
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredOwn.length === 0 && (
                    <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No products found</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SELLER PRODUCTS TAB */}
        <TabsContent value="seller_products">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Product-wise Margin (Seller)</CardTitle>
                  <CardDescription>Override margin for seller products. Leave blank to use category default.</CardDescription>
                </div>
                <div className="relative w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search seller products..." className="pl-9" value={searchSeller} onChange={(e) => setSearchSeller(e.target.value)} />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Purchase Rate</TableHead>
                    <TableHead>Current Price</TableHead>
                    <TableHead>MRP</TableHead>
                    <TableHead>Cat Margin</TableHead>
                    <TableHead className="w-36">Product Margin %</TableHead>
                    <TableHead>Effective</TableHead>
                    <TableHead className="w-20">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSeller.map(p => {
                    const editVal = sellerProdEdits[p.id];
                    const hasEdit = p.id in sellerProdEdits;
                    const catMargin = getCategoryMargin(p.category ?? "");

                    return (
                      <TableRow key={p.id} className={hasEdit ? "bg-primary/5" : ""}>
                        <TableCell className="font-medium text-sm">{p.name}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{p.category || "—"}</Badge></TableCell>
                        <TableCell>₹{p.purchase_rate}</TableCell>
                        <TableCell>₹{p.price}</TableCell>
                        <TableCell>₹{p.mrp}</TableCell>
                        <TableCell className="text-muted-foreground">{catMargin}%</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            className="w-24 h-8"
                            value={hasEdit ? (editVal ?? "") : (p.margin_percentage ?? "")}
                            placeholder={`${catMargin}%`}
                            onChange={(e) => {
                              const val = e.target.value === "" ? null : +e.target.value;
                              setSellerProdEdits({ ...sellerProdEdits, [p.id]: val });
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <span className="font-medium text-primary">
                            {(hasEdit ? (editVal ?? catMargin) : getEffectiveMargin(p)).toFixed(1)}%
                          </span>
                        </TableCell>
                        <TableCell>
                          {hasEdit && (
                            <Button size="sm" variant="default" className="h-7 text-xs" onClick={() => saveSellerProductMargin(p, editVal ?? null)}>
                              <Save className="h-3 w-3 mr-1" />Save
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredSeller.length === 0 && (
                    <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No seller products found</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
};

export default PlatformMarginPage;
