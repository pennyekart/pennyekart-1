import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { Star, TrendingUp, Sparkles, Wallet, Megaphone, X, Plus, Package, Wand2, MapPin, RotateCcw } from "lucide-react";
import FlashSaleManager from "@/components/admin/FlashSaleManager";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Product {
  id: string;
  name: string;
  price: number;
  mrp: number;
  image_url: string | null;
  section: string | null;
  is_active: boolean;
  category: string | null;
  source?: "admin" | "seller";
}

interface District {
  id: string;
  name: string;
}

interface LocalBody {
  id: string;
  name: string;
  district_id: string;
  ward_count: number;
}

interface GodownWard {
  godown_id: string;
  local_body_id: string;
  ward_number: number;
}

interface GodownStock {
  godown_id: string;
  product_id: string;
  quantity: number;
}

interface SellerGodownAssignment {
  seller_id: string;
  godown_id: string;
}

interface SellerProduct {
  id: string;
  seller_id: string;
}

const sectionConfig = [
  { key: "featured", label: "Featured Products", icon: Star, color: "text-yellow-500", autoAssign: true },
  { key: "most_ordered", label: "Most Ordered Items", icon: TrendingUp, color: "text-blue-500", autoAssign: true },
  { key: "new_arrivals", label: "New Arrivals", icon: Sparkles, color: "text-green-500", autoAssign: true },
  { key: "low_budget", label: "Low Budget Picks", icon: Wallet, color: "text-orange-500", autoAssign: true },
  { key: "sponsors", label: "Sponsors", icon: Megaphone, color: "text-purple-500", autoAssign: false },
];

const AUTO_ASSIGN_LIMIT = 10;

const OffersPage = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [featuredSellerProducts, setFeaturedSellerProducts] = useState<Product[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [addDialogSection, setAddDialogSection] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [autoAssigning, setAutoAssigning] = useState<string | null>(null);
  const { hasPermission } = usePermissions();
  const { toast } = useToast();

  // Area filter state
  const [districts, setDistricts] = useState<District[]>([]);
  const [localBodies, setLocalBodies] = useState<LocalBody[]>([]);
  const [godownWards, setGodownWards] = useState<GodownWard[]>([]);
  const [godownStock, setGodownStock] = useState<GodownStock[]>([]);
  const [sellerGodownAssignments, setSellerGodownAssignments] = useState<SellerGodownAssignment[]>([]);
  const [sellerProductsList, setSellerProductsList] = useState<SellerProduct[]>([]);
  const [filterDistrict, setFilterDistrict] = useState("all");
  const [filterLocalBody, setFilterLocalBody] = useState("all");
  const [filterWard, setFilterWard] = useState("all");

  const fetchProducts = async () => {
    const { data } = await supabase
      .from("products")
      .select("id, name, price, mrp, image_url, section, is_active, category")
      .eq("is_active", true)
      .order("name");
    setProducts((data ?? []).map((p) => ({ ...p, source: "admin" as const })));
  };

  const fetchFeaturedSellerProducts = async () => {
    const { data } = await supabase
      .from("seller_products")
      .select("id, name, price, mrp, image_url, is_active, category, is_featured")
      .eq("is_active", true)
      .eq("is_approved", true)
      .eq("is_featured", true);
    setFeaturedSellerProducts(
      (data ?? []).map((p) => ({ ...p, section: "featured", source: "seller" as const }))
    );
  };

  const fetchAllProducts = async () => {
    const { data } = await supabase
      .from("products")
      .select("id, name, price, mrp, image_url, section, is_active, category")
      .eq("is_active", true)
      .order("name");
    setAllProducts((data as Product[]) ?? []);
  };

  const fetchAreaData = async () => {
    const [distRes, lbRes, gwRes, gsRes, sgaRes, spRes] = await Promise.all([
      supabase.from("locations_districts").select("id, name").eq("is_active", true).order("name"),
      supabase.from("locations_local_bodies").select("id, name, district_id, ward_count").eq("is_active", true).order("name"),
      supabase.from("godown_wards").select("godown_id, local_body_id, ward_number"),
      supabase.from("godown_stock").select("godown_id, product_id, quantity").gt("quantity", 0),
      supabase.from("seller_godown_assignments").select("seller_id, godown_id"),
      supabase.from("seller_products").select("id, seller_id").eq("is_active", true).eq("is_approved", true),
    ]);
    setDistricts(distRes.data ?? []);
    setLocalBodies(lbRes.data ?? []);
    setGodownWards(gwRes.data ?? []);
    setGodownStock(gsRes.data ?? []);
    setSellerGodownAssignments(sgaRes.data ?? []);
    setSellerProductsList(spRes.data ?? []);
  };

  useEffect(() => {
    fetchProducts();
    fetchFeaturedSellerProducts();
    fetchAreaData();
  }, []);

  // Cascading filter helpers
  const filteredLocalBodies = useMemo(() =>
    filterDistrict === "all" ? localBodies : localBodies.filter((lb) => lb.district_id === filterDistrict),
    [filterDistrict, localBodies]
  );

  const selectedLocalBody = useMemo(() =>
    localBodies.find((lb) => lb.id === filterLocalBody),
    [filterLocalBody, localBodies]
  );

  const wardOptions = useMemo(() => {
    if (!selectedLocalBody) return [];
    return Array.from({ length: selectedLocalBody.ward_count }, (_, i) => i + 1);
  }, [selectedLocalBody]);

  // Determine which product IDs are available in the selected area
  const areaProductIds = useMemo(() => {
    const isFiltering = filterDistrict !== "all" || filterLocalBody !== "all" || filterWard !== "all";
    if (!isFiltering) return null; // null = no filter, show all

    // Find matching godown_ward entries
    let matchingGodownIds = new Set<string>();

    if (filterWard !== "all" && filterLocalBody !== "all") {
      godownWards
        .filter((gw) => gw.local_body_id === filterLocalBody && gw.ward_number === parseInt(filterWard))
        .forEach((gw) => matchingGodownIds.add(gw.godown_id));
    } else if (filterLocalBody !== "all") {
      godownWards
        .filter((gw) => gw.local_body_id === filterLocalBody)
        .forEach((gw) => matchingGodownIds.add(gw.godown_id));
    } else if (filterDistrict !== "all") {
      const lbIds = new Set(localBodies.filter((lb) => lb.district_id === filterDistrict).map((lb) => lb.id));
      godownWards
        .filter((gw) => lbIds.has(gw.local_body_id))
        .forEach((gw) => matchingGodownIds.add(gw.godown_id));
    }

    // Admin products with stock in matching godowns
    const adminIds = new Set<string>();
    godownStock
      .filter((gs) => matchingGodownIds.has(gs.godown_id))
      .forEach((gs) => adminIds.add(gs.product_id));

    // Seller products: seller assigned to area godowns that serve matching local bodies
    const sellerIds = new Set<string>();
    const sellersInArea = new Set<string>();
    sellerGodownAssignments.forEach((sga) => {
      if (matchingGodownIds.has(sga.godown_id)) {
        sellersInArea.add(sga.seller_id);
      }
    });
    sellerProductsList.forEach((sp) => {
      if (sellersInArea.has(sp.seller_id)) {
        sellerIds.add(sp.id);
      }
    });

    return { adminIds, sellerIds };
  }, [filterDistrict, filterLocalBody, filterWard, godownWards, godownStock, localBodies, sellerGodownAssignments, sellerProductsList]);

  const filterProduct = (product: Product) => {
    if (!areaProductIds) return true;
    if (product.source === "seller") return areaProductIds.sellerIds.has(product.id);
    return areaProductIds.adminIds.has(product.id);
  };

  const grouped = sectionConfig.map((sec) => {
    const allItems = sec.key === "featured"
      ? [...products.filter((p) => p.section === sec.key), ...featuredSellerProducts]
      : products.filter((p) => p.section === sec.key);
    return {
      ...sec,
      items: allItems.filter(filterProduct),
      totalItems: allItems.length,
    };
  });

  const resetFilters = () => {
    setFilterDistrict("all");
    setFilterLocalBody("all");
    setFilterWard("all");
  };

  const isFiltering = filterDistrict !== "all" || filterLocalBody !== "all" || filterWard !== "all";

  const handleRemoveFromSection = async (product: Product) => {
    if (product.source === "seller") {
      const { error } = await supabase.from("seller_products").update({ is_featured: false }).eq("id", product.id);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        return;
      }
      fetchFeaturedSellerProducts();
    } else {
      const { error } = await supabase.from("products").update({ section: null }).eq("id", product.id);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        return;
      }
      fetchProducts();
    }
    toast({ title: "Removed from section" });
  };

  const handleAddToSection = async (productId: string, section: string) => {
    const { error } = await supabase.from("products").update({ section }).eq("id", productId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    fetchProducts();
    fetchAllProducts();
    toast({ title: "Added to section" });
  };

  const handleAutoAssign = async (sectionKey: string) => {
    setAutoAssigning(sectionKey);
    try {
      const { error: clearError } = await supabase
        .from("products")
        .update({ section: null })
        .eq("section", sectionKey);
      if (clearError) throw clearError;

      let productIds: string[] = [];
      let totalAssigned = 0;

      if (sectionKey === "featured") {
        const { data } = await supabase
          .from("products")
          .select("id")
          .eq("is_active", true)
          .is("section", null)
          .order("discount_rate", { ascending: false })
          .limit(AUTO_ASSIGN_LIMIT);
        productIds = (data ?? []).map((p) => p.id);
        const { data: sellerFeatured } = await supabase
          .from("seller_products")
          .select("id")
          .eq("is_active", true)
          .eq("is_approved", true)
          .eq("is_featured", true);
        totalAssigned = productIds.length + (sellerFeatured ?? []).length;
      } else if (sectionKey === "low_budget") {
        const { data } = await supabase
          .from("products")
          .select("id")
          .eq("is_active", true)
          .is("section", null)
          .order("price", { ascending: true })
          .limit(AUTO_ASSIGN_LIMIT);
        productIds = (data ?? []).map((p) => p.id);
        totalAssigned = productIds.length;
      } else if (sectionKey === "new_arrivals") {
        const { data } = await supabase
          .from("products")
          .select("id")
          .eq("is_active", true)
          .is("section", null)
          .order("created_at", { ascending: false })
          .limit(AUTO_ASSIGN_LIMIT);
        productIds = (data ?? []).map((p) => p.id);
        totalAssigned = productIds.length;
      } else if (sectionKey === "most_ordered") {
        const { data: orders } = await supabase.from("orders").select("items");
        const countMap: Record<string, number> = {};
        (orders ?? []).forEach((order) => {
          const items = order.items as any[];
          if (Array.isArray(items)) {
            items.forEach((item) => {
              const pid = item.product_id || item.id;
              if (pid) countMap[pid] = (countMap[pid] || 0) + (item.quantity || 1);
            });
          }
        });
        const sorted = Object.entries(countMap)
          .sort(([, a], [, b]) => b - a)
          .slice(0, AUTO_ASSIGN_LIMIT)
          .map(([id]) => id);
        productIds = sorted;
        totalAssigned = productIds.length;
      }

      if (productIds.length > 0) {
        for (const id of productIds) {
          await supabase.from("products").update({ section: sectionKey }).eq("id", id).eq("is_active", true);
        }
      }

      await fetchProducts();
      await fetchFeaturedSellerProducts();
      toast({
        title: "Auto-assigned",
        description: `${totalAssigned} products in ${sectionConfig.find((s) => s.key === sectionKey)?.label}`,
      });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setAutoAssigning(null);
    }
  };

  const openAddDialog = (sectionKey: string) => {
    setAddDialogSection(sectionKey);
    setSearch("");
    fetchAllProducts();
  };

  const availableProducts = allProducts.filter(
    (p) => (!p.section || p.section === "") && p.name.toLowerCase().includes(search.toLowerCase())
  );

  const canEdit = hasPermission("update_products");

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Offers & Feature Management</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage which products appear in each section on the storefront</p>
      </div>

      {/* Area Filter Bar */}
      <Card className="mb-6">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Filter by Area Availability</span>
            {isFiltering && (
              <Button variant="ghost" size="sm" className="ml-auto h-7 text-xs" onClick={resetFilters}>
                <RotateCcw className="h-3 w-3 mr-1" /> Reset
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Select value={filterDistrict} onValueChange={(v) => { setFilterDistrict(v); setFilterLocalBody("all"); setFilterWard("all"); }}>
              <SelectTrigger><SelectValue placeholder="All Districts" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Districts</SelectItem>
                {districts.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterLocalBody} onValueChange={(v) => { setFilterLocalBody(v); setFilterWard("all"); }}>
              <SelectTrigger><SelectValue placeholder="All Panchayaths" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Panchayaths</SelectItem>
                {filteredLocalBodies.map((lb) => (
                  <SelectItem key={lb.id} value={lb.id}>{lb.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterWard} onValueChange={setFilterWard} disabled={filterLocalBody === "all"}>
              <SelectTrigger><SelectValue placeholder="All Wards" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Wards</SelectItem>
                {wardOptions.map((w) => (
                  <SelectItem key={w} value={String(w)}>Ward {w}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {isFiltering && (
            <p className="text-xs text-muted-foreground mt-2">
              Showing products with stock available in the selected area
            </p>
          )}
        </CardContent>
      </Card>

      <FlashSaleManager />

      <div className="space-y-6 mt-6">
        {grouped.map((section) => {
          const Icon = section.icon;
          return (
            <Card key={section.key}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-5 w-5 ${section.color}`} />
                    <CardTitle className="text-lg">{section.label}</CardTitle>
                    <Badge variant="secondary" className="ml-2">
                      {section.items.length}
                      {isFiltering && section.items.length !== section.totalItems && (
                        <span className="text-muted-foreground ml-1">/ {section.totalItems}</span>
                      )}
                    </Badge>
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-2">
                      {section.autoAssign && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleAutoAssign(section.key)}
                          disabled={autoAssigning === section.key}
                        >
                          <Wand2 className="h-4 w-4 mr-1" />
                          {autoAssigning === section.key ? "Assigning..." : "Auto Assign"}
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => openAddDialog(section.key)}>
                        <Plus className="h-4 w-4 mr-1" /> Add Product
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {section.items.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    {isFiltering ? "No products available in this area" : "No products in this section"}
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {section.items.map((product) => (
                      <div key={product.id} className="flex items-center gap-3 rounded-lg border p-3 bg-background">
                        {product.image_url ? (
                          <img src={product.image_url} alt={product.name} className="h-12 w-12 rounded-md object-cover" />
                        ) : (
                          <div className="h-12 w-12 rounded-md bg-muted flex items-center justify-center">
                            <Package className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{product.name}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>₹{product.price}</span>
                            {product.mrp > product.price && (
                              <span className="line-through">₹{product.mrp}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 mt-1">
                            {product.category && (
                              <Badge variant="outline" className="text-[10px]">{product.category}</Badge>
                            )}
                            {product.source === "seller" && (
                              <Badge variant="secondary" className="text-[10px]">Seller</Badge>
                            )}
                          </div>
                        </div>
                        {canEdit && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => handleRemoveFromSection(product)}>
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!addDialogSection} onOpenChange={(v) => { if (!v) setAddDialogSection(null); }}>
        <DialogContent className="max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              Add Product to {sectionConfig.find((s) => s.key === addDialogSection)?.label}
            </DialogTitle>
          </DialogHeader>
          <Input placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)} className="mb-3" />
          <div className="overflow-y-auto flex-1">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead className="w-20">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {availableProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">No available products</TableCell>
                  </TableRow>
                ) : (
                  availableProducts.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {p.image_url ? (
                            <img src={p.image_url} alt={p.name} className="h-8 w-8 rounded object-cover" />
                          ) : (
                            <div className="h-8 w-8 rounded bg-muted flex items-center justify-center">
                              <Package className="h-3 w-3" />
                            </div>
                          )}
                          <span className="text-sm">{p.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>₹{p.price}</TableCell>
                      <TableCell>
                        <Button size="sm" onClick={() => handleAddToSection(p.id, addDialogSection!)}>
                          Add
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default OffersPage;
