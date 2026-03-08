import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Warehouse, Trash2, ArrowRightLeft, Package, ChevronDown, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Godown {
  id: string;
  name: string;
  godown_type: string;
  is_active: boolean;
  created_at: string;
}

interface District {
  id: string;
  name: string;
}

interface LocalBody {
  id: string;
  name: string;
  body_type: string;
  ward_count: number;
  district_id: string;
}

interface GodownLocalBody {
  id: string;
  godown_id: string;
  local_body_id: string;
  locations_local_bodies?: LocalBody;
}

interface GodownWard {
  id: string;
  godown_id: string;
  local_body_id: string;
  ward_number: number;
}

interface Product {
  id: string;
  name: string;
  price: number;
  mrp: number;
  category: string | null;
}

interface StockItem {
  id: string;
  godown_id: string;
  product_id: string;
  quantity: number;
  purchase_price: number;
  batch_number: string | null;
  expiry_date: string | null;
  created_at: string;
  purchase_number: string | null;
  products?: Product;
}

interface SellerProductItem {
  id: string;
  name: string;
  price: number;
  mrp: number;
  stock: number;
  category: string | null;
  is_approved: boolean;
  is_active: boolean;
  area_godown_id: string | null;
  seller_id: string;
}

interface StockTransfer {
  id: string;
  from_godown_id: string;
  to_godown_id: string;
  product_id: string;
  quantity: number;
  batch_number: string | null;
  status: string;
  transfer_type: string;
  created_at: string;
  products?: Product;
  from_godown?: Godown;
  to_godown?: Godown;
}

const GODOWN_TYPES = [
  { value: "micro", label: "Micro Godown", desc: "Under one panchayath, multi wards. Customer visible." },
  { value: "local", label: "Local Godown", desc: "Multi panchayath backup. Not customer visible." },
  { value: "area", label: "Area Godown", desc: "Multi panchayath + selling partners. Customer visible." },
];

const GodownsPage = () => {
  const [expandedGodowns, setExpandedGodowns] = useState<Record<string, boolean>>({});
  const { toast } = useToast();
  const [godowns, setGodowns] = useState<Godown[]>([]);
  const [localBodies, setLocalBodies] = useState<LocalBody[]>([]);
  const [godownLocalBodies, setGodownLocalBodies] = useState<GodownLocalBody[]>([]);
  const [godownWards, setGodownWards] = useState<GodownWard[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedGodown, setSelectedGodown] = useState<Godown | null>(null);
  const [form, setForm] = useState({ name: "", godown_type: "micro" });
  const [assignLocalBodyId, setAssignLocalBodyId] = useState("");
  const [selectedLocalBodyIds, setSelectedLocalBodyIds] = useState<string[]>([]);
  const [selectedWards, setSelectedWards] = useState<number[]>([]);
  const [allWards, setAllWards] = useState(false);
  const [activeTab, setActiveTab] = useState("micro");
  const [localBodySearch, setLocalBodySearch] = useState("");
  const [districts, setDistricts] = useState<District[]>([]);
  const [filterDistrictId, setFilterDistrictId] = useState("");
  const [filterLocalBodyId, setFilterLocalBodyId] = useState("");
  // Purchase history state
  const [purchaseHistoryFrom, setPurchaseHistoryFrom] = useState("");
  const [purchaseHistoryTo, setPurchaseHistoryTo] = useState("");

  // Stock state
  const [products, setProducts] = useState<Product[]>([]);
  const [godownStock, setGodownStock] = useState<StockItem[]>([]);
  const [stockTransfers, setStockTransfers] = useState<StockTransfer[]>([]);
  const [stockDialogOpen, setStockDialogOpen] = useState(false);
  const [stockGodown, setStockGodown] = useState<Godown | null>(null);
  const [stockForm, setStockForm] = useState({ product_id: "", quantity: 0, purchase_price: 0, batch_number: "", expiry_date: "" });
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [transferGodown, setTransferGodown] = useState<Godown | null>(null);
  const [transferForm, setTransferForm] = useState({ product_id: "", quantity: 0, to_godown_id: "", batch_number: "", transfer_type: "transfer" });
  const [godownInnerTab, setGodownInnerTab] = useState<Record<string, string>>({});
  const [sellerProducts, setSellerProducts] = useState<SellerProductItem[]>([]);

  const fetchGodowns = async () => {
    const { data } = await supabase.from("godowns").select("*").order("created_at", { ascending: false });
    if (data) setGodowns(data as Godown[]);
  };

  const fetchDistricts = async () => {
    const { data } = await supabase.from("locations_districts").select("id, name").eq("is_active", true).order("name");
    if (data) setDistricts(data as District[]);
  };

  const fetchLocalBodies = async () => {
    const { data } = await supabase.from("locations_local_bodies").select("id, name, body_type, ward_count, district_id").eq("is_active", true);
    if (data) setLocalBodies(data as LocalBody[]);
  };

  const fetchGodownLocalBodies = async () => {
    const { data } = await supabase.from("godown_local_bodies").select("id, godown_id, local_body_id, locations_local_bodies(id, name, body_type, ward_count)");
    if (data) setGodownLocalBodies(data as unknown as GodownLocalBody[]);
  };

  const fetchGodownWards = async () => {
    const { data } = await supabase.from("godown_wards").select("*");
    if (data) setGodownWards(data as GodownWard[]);
  };

  const fetchProducts = async () => {
    const { data } = await supabase.from("products").select("id, name, price, mrp, category").eq("is_active", true);
    if (data) setProducts(data as Product[]);
  };

  const fetchGodownStock = async () => {
    const { data } = await supabase.from("godown_stock").select("*, products(id, name, price, mrp, category)");
    if (data) setGodownStock(data as unknown as StockItem[]);
  };

  const fetchStockTransfers = async () => {
    const { data } = await supabase.from("stock_transfers")
      .select("*, products(id, name, price, category), from_godown:godowns!stock_transfers_from_godown_id_fkey(id, name, godown_type), to_godown:godowns!stock_transfers_to_godown_id_fkey(id, name, godown_type)")
      .order("created_at", { ascending: false });
    if (data) setStockTransfers(data as unknown as StockTransfer[]);
  };

  const fetchSellerProducts = async () => {
    const { data } = await supabase.from("seller_products").select("id, name, price, mrp, stock, category, is_approved, is_active, area_godown_id, seller_id");
    if (data) setSellerProducts(data as SellerProductItem[]);
  };

  useEffect(() => {
    fetchGodowns();
    fetchLocalBodies();
    fetchGodownLocalBodies();
    fetchGodownWards();
    fetchProducts();
    fetchGodownStock();
    fetchStockTransfers();
    fetchSellerProducts();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("godowns").insert({ name: form.name.trim(), godown_type: form.godown_type });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Godown created" }); setDialogOpen(false); setForm({ name: "", godown_type: "micro" }); fetchGodowns(); }
  };

  const selectedLocalBody = localBodies.find(lb => lb.id === assignLocalBodyId);
  const isMicroGodown = selectedGodown?.godown_type === "micro";

  const handleAssign = async () => {
    if (!selectedGodown) return;

    if (isMicroGodown) {
      if (!assignLocalBodyId) return;
      const wardNumbers = allWards
        ? Array.from({ length: selectedLocalBody?.ward_count ?? 0 }, (_, i) => i + 1)
        : selectedWards;

      if (wardNumbers.length === 0) {
        toast({ title: "Select at least one ward", variant: "destructive" });
        return;
      }

      const existing = godownLocalBodies.find(
        glb => glb.godown_id === selectedGodown.id && glb.local_body_id === assignLocalBodyId
      );
      if (!existing) {
        await supabase.from("godown_local_bodies").insert({ godown_id: selectedGodown.id, local_body_id: assignLocalBodyId });
      }

      const existingWards = godownWards.filter(
        w => w.godown_id === selectedGodown.id && w.local_body_id === assignLocalBodyId
      );
      if (existingWards.length > 0) {
        await supabase.from("godown_wards").delete().in("id", existingWards.map(w => w.id));
      }

      const rows = wardNumbers.map(wn => ({
        godown_id: selectedGodown.id,
        local_body_id: assignLocalBodyId,
        ward_number: wn,
      }));
      const { error } = await supabase.from("godown_wards").insert(rows);
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      else toast({ title: `${wardNumbers.length} ward(s) assigned` });
    } else {
      if (selectedLocalBodyIds.length === 0) {
        toast({ title: "Select at least one panchayath", variant: "destructive" });
        return;
      }
      const existingIds = godownLocalBodies
        .filter(glb => glb.godown_id === selectedGodown.id)
        .map(glb => glb.local_body_id);
      const newIds = selectedLocalBodyIds.filter(id => !existingIds.includes(id));
      if (newIds.length === 0) {
        toast({ title: "All selected panchayaths are already assigned", variant: "destructive" });
        return;
      }
      const rows = newIds.map(id => ({ godown_id: selectedGodown.id, local_body_id: id }));
      const { error } = await supabase.from("godown_local_bodies").insert(rows);
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      else toast({ title: `${newIds.length} panchayath(s) assigned` });
    }

    resetAssignForm();
    fetchGodownLocalBodies();
    fetchGodownWards();
  };

  const resetAssignForm = () => {
    setAssignLocalBodyId("");
    setSelectedLocalBodyIds([]);
    setSelectedWards([]);
    setAllWards(false);
    setLocalBodySearch("");
  };

  const handleRemoveAssignment = async (glbId: string, godownId: string, localBodyId: string) => {
    const wardsToRemove = godownWards.filter(w => w.godown_id === godownId && w.local_body_id === localBodyId);
    if (wardsToRemove.length > 0) {
      await supabase.from("godown_wards").delete().in("id", wardsToRemove.map(w => w.id));
    }
    await supabase.from("godown_local_bodies").delete().eq("id", glbId);
    fetchGodownLocalBodies();
    fetchGodownWards();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("godowns").delete().eq("id", id);
    fetchGodowns(); fetchGodownLocalBodies(); fetchGodownWards();
  };

  const toggleWard = (ward: number) => {
    setAllWards(false);
    setSelectedWards(prev => prev.includes(ward) ? prev.filter(w => w !== ward) : [...prev, ward]);
  };

  const handleAllWardsChange = (checked: boolean) => {
    setAllWards(checked);
    if (checked && selectedLocalBody) {
      setSelectedWards(Array.from({ length: selectedLocalBody.ward_count }, (_, i) => i + 1));
    } else {
      setSelectedWards([]);
    }
  };

  const filteredGodowns = godowns.filter(g => g.godown_type === activeTab);

  const filteredLocalBodies = localBodies.filter(lb =>
    lb.name.toLowerCase().includes(localBodySearch.toLowerCase()) ||
    lb.body_type.toLowerCase().includes(localBodySearch.toLowerCase())
  );

  const toggleLocalBody = (id: string) => {
    setSelectedLocalBodyIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const selectAllFilteredLocalBodies = (checked: boolean) => {
    if (checked) {
      const allIds = filteredLocalBodies.map(lb => lb.id);
      setSelectedLocalBodyIds(prev => [...new Set([...prev, ...allIds])]);
    } else {
      const filteredIds = new Set(filteredLocalBodies.map(lb => lb.id));
      setSelectedLocalBodyIds(prev => prev.filter(id => !filteredIds.has(id)));
    }
  };

  const getWardsForAssignment = (godownId: string, localBodyId: string) => {
    return godownWards
      .filter(w => w.godown_id === godownId && w.local_body_id === localBodyId)
      .map(w => w.ward_number)
      .sort((a, b) => a - b);
  };

  // Stock handlers
  const handleAddStock = async () => {
    if (!stockGodown || !stockForm.product_id || stockForm.quantity <= 0) {
      toast({ title: "Fill all required fields", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("godown_stock").insert({
      godown_id: stockGodown.id,
      product_id: stockForm.product_id,
      quantity: stockForm.quantity,
      purchase_price: stockForm.purchase_price,
      batch_number: stockForm.batch_number || null,
      expiry_date: stockForm.expiry_date || null,
    });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Stock added" });
      setStockDialogOpen(false);
      setStockForm({ product_id: "", quantity: 0, purchase_price: 0, batch_number: "", expiry_date: "" });
      fetchGodownStock();
    }
  };

  const handleDeleteStock = async (stockId: string) => {
    await supabase.from("godown_stock").delete().eq("id", stockId);
    fetchGodownStock();
  };

  // Transfer handlers
  const handleCreateTransfer = async () => {
    if (!transferGodown || !transferForm.product_id || !transferForm.to_godown_id || transferForm.quantity <= 0) {
      toast({ title: "Fill all required fields", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("stock_transfers").insert({
      from_godown_id: transferGodown.id,
      to_godown_id: transferForm.to_godown_id,
      product_id: transferForm.product_id,
      quantity: transferForm.quantity,
      batch_number: transferForm.batch_number || null,
      transfer_type: transferForm.transfer_type,
    });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Transfer created" });
      setTransferDialogOpen(false);
      setTransferForm({ product_id: "", quantity: 0, to_godown_id: "", batch_number: "", transfer_type: "transfer" });
      fetchStockTransfers();
    }
  };

  const handleUpdateTransferStatus = async (transferId: string, status: string) => {
    const transfer = stockTransfers.find(t => t.id === transferId);
    
    await supabase.from("stock_transfers").update({ status }).eq("id", transferId);

    // When completing a transfer, update godown_stock for destination and deduct from source
    if (status === "completed" && transfer) {
      const productId = typeof transfer.products === "object" && transfer.products ? (transfer.products as any).id : transfer.product_id;
      let remainingQty = transfer.quantity;

      // Add stock to destination godown - find first existing entry or create new
      const { data: destEntries } = await supabase
        .from("godown_stock")
        .select("id, quantity")
        .eq("godown_id", transfer.to_godown_id)
        .eq("product_id", productId)
        .order("created_at", { ascending: true })
        .limit(1);

      if (destEntries && destEntries.length > 0) {
        await supabase.from("godown_stock").update({ quantity: destEntries[0].quantity + transfer.quantity }).eq("id", destEntries[0].id);
      } else {
        await supabase.from("godown_stock").insert({
          godown_id: transfer.to_godown_id,
          product_id: productId,
          quantity: transfer.quantity,
          purchase_price: 0,
        });
      }

      // Deduct stock from source godown - handle multiple batch entries (FIFO)
      const { data: srcEntries } = await supabase
        .from("godown_stock")
        .select("id, quantity")
        .eq("godown_id", transfer.from_godown_id)
        .eq("product_id", productId)
        .gt("quantity", 0)
        .order("created_at", { ascending: true });

      if (srcEntries) {
        for (const entry of srcEntries) {
          if (remainingQty <= 0) break;
          if (entry.quantity >= remainingQty) {
            await supabase.from("godown_stock").update({ quantity: entry.quantity - remainingQty }).eq("id", entry.id);
            remainingQty = 0;
          } else {
            remainingQty -= entry.quantity;
            await supabase.from("godown_stock").update({ quantity: 0 }).eq("id", entry.id);
          }
        }
      }

      fetchGodownStock();
    }

    fetchStockTransfers();
    toast({ title: `Transfer ${status}` });
  };

  const getGodownInnerTab = (godownId: string) => godownInnerTab[godownId] || "assignments";
  const setInnerTab = (godownId: string, tab: string) => setGodownInnerTab(prev => ({ ...prev, [godownId]: tab }));

  // Get stock for a specific godown
  const getStockForGodown = (godownId: string) => godownStock.filter(s => s.godown_id === godownId);

  // Get transfers related to a godown
  const getTransfersForGodown = (godownId: string) =>
    stockTransfers.filter(t => t.from_godown_id === godownId || t.to_godown_id === godownId);

  // Get eligible target godowns for transfer
  const getTransferTargets = (fromGodown: Godown) => {
    if (fromGodown.godown_type === "local") {
      return godowns.filter(g => g.godown_type === "micro" && g.id !== fromGodown.id);
    }
    if (fromGodown.godown_type === "micro") {
      return godowns.filter(g => g.godown_type === "local" && g.id !== fromGodown.id);
    }
    if (fromGodown.godown_type === "area") {
      return godowns.filter(g => g.id !== fromGodown.id);
    }
    return [];
  };

  // Get available stock products for a godown (for transfer) - grouped by product
  const getGroupedStockProducts = (godownId: string) => {
    const stock = godownStock.filter(s => s.godown_id === godownId);
    const grouped: Record<string, { product_id: string; product_name: string; total_qty: number }> = {};
    stock.forEach(s => {
      const pid = s.product_id;
      if (!grouped[pid]) {
        grouped[pid] = { product_id: pid, product_name: s.products?.name ?? "Unknown", total_qty: 0 };
      }
      grouped[pid].total_qty += s.quantity;
    });
    return Object.values(grouped).sort((a, b) => a.product_name.localeCompare(b.product_name));
  };

  const renderAssignments = (g: Godown) => {
    const assignments = godownLocalBodies.filter(glb => glb.godown_id === g.id);
    return (
      <div>
        <p className="mb-2 text-sm text-muted-foreground">
          {g.godown_type === "micro" ? "Assigned Panchayaths & Wards:" : "Assigned Panchayaths:"}
        </p>
        {assignments.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">None assigned</p>
        ) : (
          <div className="space-y-2">
            {assignments.map(a => {
              const wards = getWardsForAssignment(g.id, a.local_body_id);
              const lb = a.locations_local_bodies;
              const isAllWards = lb && wards.length === lb.ward_count;
              return (
                <div key={a.id} className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="gap-1">
                    {lb?.name ?? "Unknown"}
                    <button onClick={() => handleRemoveAssignment(a.id, g.id, a.local_body_id)} className="ml-1 text-destructive hover:text-destructive/80">×</button>
                  </Badge>
                  {g.godown_type === "micro" && wards.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {isAllWards ? "All wards" : `Ward ${wards.join(", ")}`}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderStockDetails = (g: Godown) => {
    const stock = getStockForGodown(g.id);
    // Group by product_id, sum quantities
    const grouped = stock.reduce<Record<string, { product_name: string; mrp: number; total_qty: number }>>((acc, s) => {
      const pid = s.product_id;
      if (!acc[pid]) {
        acc[pid] = { product_name: s.products?.name ?? "Unknown", mrp: s.products?.mrp ?? 0, total_qty: 0 };
      }
      acc[pid].total_qty += s.quantity;
      return acc;
    }, {});
    const groupedList = Object.entries(grouped).sort((a, b) => a[1].product_name.localeCompare(b[1].product_name));

    // Get seller products for this godown (area godowns only)
    const godownSellerProducts = g.godown_type === "area"
      ? sellerProducts.filter(sp => sp.area_godown_id === g.id && sp.is_approved && sp.is_active)
      : [];

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">Stock Items ({groupedList.length} products)</p>
          {g.godown_type === "area" && (
            <Button size="sm" onClick={() => { setStockGodown(g); setStockForm({ product_id: "", quantity: 0, purchase_price: 0, batch_number: "", expiry_date: "" }); setStockDialogOpen(true); }}>
              <Plus className="mr-1 h-3 w-3" /> Add Stock
            </Button>
          )}
        </div>
        {groupedList.length === 0 ? (
          <p className="text-sm text-muted-foreground italic py-4 text-center">No stock items</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Total Qty</TableHead>
                  <TableHead>MRP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupedList.map(([pid, info]) => {
                  const itemKey = `${g.id}-${pid}`;
                  const isExpanded = expandedStockItems[itemKey] ?? false;
                  const itemPurchases = stock.filter(s => s.product_id === pid);
                  const itemTransfers = stockTransfers.filter(
                    t => t.product_id === pid && (t.from_godown_id === g.id || t.to_godown_id === g.id)
                  );
                  return (
                    <>
                      <TableRow
                        key={pid}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => toggleStockItem(itemKey)}
                      >
                        <TableCell className="px-2">
                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </TableCell>
                        <TableCell className="font-medium">{info.product_name}</TableCell>
                        <TableCell>
                          <Badge variant={info.total_qty > 0 ? "default" : "destructive"}>{info.total_qty}</Badge>
                        </TableCell>
                        <TableCell>₹{info.mrp}</TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow key={`${pid}-details`}>
                          <TableCell colSpan={4} className="bg-muted/30 p-0">
                            <div className="p-3 space-y-3">
                              {/* Purchase Entries */}
                              <div>
                                <p className="text-xs font-semibold text-muted-foreground mb-1">Purchase Entries ({itemPurchases.length})</p>
                                {itemPurchases.length === 0 ? (
                                  <p className="text-xs text-muted-foreground italic">No purchases</p>
                                ) : (
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead className="text-xs">Date</TableHead>
                                        <TableHead className="text-xs">Bill No.</TableHead>
                                        <TableHead className="text-xs">Qty</TableHead>
                                        <TableHead className="text-xs">Purchase ₹</TableHead>
                                        <TableHead className="text-xs">Batch</TableHead>
                                        <TableHead className="text-xs">Expiry</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {itemPurchases.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map(s => (
                                        <TableRow key={s.id}>
                                          <TableCell className="text-xs">{new Date(s.created_at).toLocaleDateString()}</TableCell>
                                          <TableCell className="text-xs font-mono">{s.purchase_number || "-"}</TableCell>
                                          <TableCell className="text-xs">{s.quantity}</TableCell>
                                          <TableCell className="text-xs">₹{s.purchase_price}</TableCell>
                                          <TableCell className="text-xs">{s.batch_number || "-"}</TableCell>
                                          <TableCell className="text-xs">{s.expiry_date || "-"}</TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                )}
                              </div>
                              {/* Transfer History */}
                              <div>
                                <p className="text-xs font-semibold text-muted-foreground mb-1">Transfer History ({itemTransfers.length})</p>
                                {itemTransfers.length === 0 ? (
                                  <p className="text-xs text-muted-foreground italic">No transfers</p>
                                ) : (
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead className="text-xs">Date</TableHead>
                                        <TableHead className="text-xs">From</TableHead>
                                        <TableHead className="text-xs">To</TableHead>
                                        <TableHead className="text-xs">Qty</TableHead>
                                        <TableHead className="text-xs">Type</TableHead>
                                        <TableHead className="text-xs">Status</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {itemTransfers.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map(t => (
                                        <TableRow key={t.id}>
                                          <TableCell className="text-xs">{new Date(t.created_at).toLocaleDateString()}</TableCell>
                                          <TableCell className="text-xs">{t.from_godown?.name ?? "Unknown"}</TableCell>
                                          <TableCell className="text-xs">{t.to_godown?.name ?? "Unknown"}</TableCell>
                                          <TableCell className="text-xs">{t.quantity}</TableCell>
                                          <TableCell className="text-xs">
                                            <Badge variant={t.transfer_type === "return" ? "secondary" : "default"} className="text-[10px]">
                                              {t.transfer_type === "return" ? "Return" : "Transfer"}
                                            </Badge>
                                          </TableCell>
                                          <TableCell className="text-xs">
                                            <Badge variant={t.status === "completed" ? "default" : t.status === "pending" ? "secondary" : "destructive"} className="text-[10px]">
                                              {t.status}
                                            </Badge>
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                )}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Seller Products Section for Area Godowns */}
        {g.godown_type === "area" && (
          <div className="mt-4 space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Seller Products ({godownSellerProducts.length})</p>
            {godownSellerProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground italic py-2 text-center">No approved seller products</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>MRP</TableHead>
                      <TableHead>Category</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {godownSellerProducts.map(sp => (
                      <TableRow key={sp.id}>
                        <TableCell className="font-medium">{sp.name}</TableCell>
                        <TableCell>{sp.stock}</TableCell>
                        <TableCell>₹{sp.price}</TableCell>
                        <TableCell>₹{sp.mrp}</TableCell>
                        <TableCell>{sp.category || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const [expandedBills, setExpandedBills] = useState<Record<string, boolean>>({});
  const [expandedStockItems, setExpandedStockItems] = useState<Record<string, boolean>>({});

  const toggleStockItem = (key: string) => {
    setExpandedStockItems(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleBill = (billKey: string) => {
    setExpandedBills(prev => ({ ...prev, [billKey]: !prev[billKey] }));
  };

  const renderPurchaseHistory = (g: Godown) => {
    let history = getStockForGodown(g.id);
    if (purchaseHistoryFrom) {
      history = history.filter(s => s.created_at >= purchaseHistoryFrom);
    }
    if (purchaseHistoryTo) {
      const toDate = purchaseHistoryTo + "T23:59:59";
      history = history.filter(s => s.created_at <= toDate);
    }
    history.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const bills: Record<string, { date: string; items: typeof history }> = {};
    history.forEach(s => {
      const key = s.purchase_number || `no-bill-${s.id}`;
      if (!bills[key]) {
        bills[key] = { date: new Date(s.created_at).toLocaleDateString(), items: [] };
      }
      bills[key].items.push(s);
    });
    const billEntries = Object.entries(bills);

    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <p className="text-sm font-medium text-muted-foreground">Purchase History (Bill-wise)</p>
          <div className="flex gap-2 items-center">
            <Input type="date" className="w-36 h-8 text-xs" value={purchaseHistoryFrom} onChange={e => setPurchaseHistoryFrom(e.target.value)} placeholder="From" />
            <span className="text-xs text-muted-foreground">to</span>
            <Input type="date" className="w-36 h-8 text-xs" value={purchaseHistoryTo} onChange={e => setPurchaseHistoryTo(e.target.value)} placeholder="To" />
            {(purchaseHistoryFrom || purchaseHistoryTo) && (
              <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setPurchaseHistoryFrom(""); setPurchaseHistoryTo(""); }}>Clear</Button>
            )}
          </div>
        </div>
        {billEntries.length === 0 ? (
          <p className="text-sm text-muted-foreground italic py-4 text-center">No purchase history</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Bill No.</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Total Qty</TableHead>
                  <TableHead>Total Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {billEntries.map(([billNo, bill]) => {
                  const isExpanded = expandedBills[billNo] ?? false;
                  const totalQty = bill.items.reduce((sum, s) => sum + s.quantity, 0);
                  const totalAmount = bill.items.reduce((sum, s) => sum + (s.purchase_price * s.quantity), 0);
                  const displayBillNo = billNo.startsWith("no-bill-") ? "-" : billNo;

                  return (
                    <>
                      <TableRow
                        key={billNo}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => toggleBill(billNo)}
                      >
                        <TableCell className="px-2">
                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </TableCell>
                        <TableCell className="font-mono font-medium">{displayBillNo}</TableCell>
                        <TableCell>{bill.date}</TableCell>
                        <TableCell>{bill.items.length} product(s)</TableCell>
                        <TableCell>{totalQty}</TableCell>
                        <TableCell>₹{totalAmount.toFixed(2)}</TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow key={`${billNo}-details`}>
                          <TableCell colSpan={6} className="bg-muted/30 p-0">
                            <div className="p-3">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Product</TableHead>
                                    <TableHead>Qty</TableHead>
                                    <TableHead>Purchase Price</TableHead>
                                    <TableHead>MRP</TableHead>
                                    <TableHead>Batch</TableHead>
                                    <TableHead>Expiry</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {bill.items.map(s => (
                                    <TableRow key={s.id}>
                                      <TableCell className="font-medium">{s.products?.name ?? "Unknown"}</TableCell>
                                      <TableCell>{s.quantity}</TableCell>
                                      <TableCell>₹{s.purchase_price}</TableCell>
                                      <TableCell>₹{s.products?.mrp ?? 0}</TableCell>
                                      <TableCell>{s.batch_number || "-"}</TableCell>
                                      <TableCell>{s.expiry_date || "-"}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    );
  };

  const renderStockTransfers = (g: Godown) => {
    const transfers = getTransfersForGodown(g.id);
    const isLocal = g.godown_type === "local";
    const isMicro = g.godown_type === "micro";

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-sm font-medium text-muted-foreground">Stock Transfers</p>
          <div className="flex gap-2">
            {isLocal && (
              <Button size="sm" onClick={() => {
                setTransferGodown(g);
                setTransferForm({ product_id: "", quantity: 0, to_godown_id: "", batch_number: "", transfer_type: "transfer" });
                setTransferDialogOpen(true);
              }}>
                <ArrowRightLeft className="mr-1 h-3 w-3" /> Transfer to Micro
              </Button>
            )}
            {isMicro && (
              <Button size="sm" variant="outline" onClick={() => {
                setTransferGodown(g);
                setTransferForm({ product_id: "", quantity: 0, to_godown_id: "", batch_number: "", transfer_type: "return" });
                setTransferDialogOpen(true);
              }}>
                <ArrowRightLeft className="mr-1 h-3 w-3" /> Return to Local
              </Button>
            )}
          </div>
        </div>
        {transfers.length === 0 ? (
          <p className="text-sm text-muted-foreground italic py-4 text-center">No transfers</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfers.map(t => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.products?.name ?? "Unknown"}</TableCell>
                    <TableCell>{t.from_godown?.name ?? "Unknown"}</TableCell>
                    <TableCell>{t.to_godown?.name ?? "Unknown"}</TableCell>
                    <TableCell>{t.quantity}</TableCell>
                    <TableCell>
                      <Badge variant={t.transfer_type === "return" ? "secondary" : "default"}>
                        {t.transfer_type === "return" ? "Return" : "Transfer"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={t.status === "completed" ? "default" : t.status === "pending" ? "secondary" : "destructive"}>
                        {t.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {t.status === "pending" && (
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" onClick={() => handleUpdateTransferStatus(t.id, "completed")}>
                            Approve
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleUpdateTransferStatus(t.id, "rejected")}>
                            Reject
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    );
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Godowns</h1>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> Add Godown</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Godown</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required maxLength={200} /></div>
                <div>
                  <Label>Type</Label>
                  <Select value={form.godown_type} onValueChange={v => setForm({ ...form, godown_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {GODOWN_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-xs text-muted-foreground">{GODOWN_TYPES.find(t => t.value === form.godown_type)?.desc}</p>
                </div>
                <Button type="submit" className="w-full">Create</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            {GODOWN_TYPES.map(t => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label} ({godowns.filter(g => g.godown_type === t.value).length})
              </TabsTrigger>
            ))}
          </TabsList>

          {GODOWN_TYPES.map(t => (
            <TabsContent key={t.value} value={t.value}>
              <div className="space-y-4">
                {filteredGodowns.length === 0 ? (
                  <Card><CardContent className="py-8 text-center text-muted-foreground">No {t.label}s yet.</CardContent></Card>
                ) : filteredGodowns.map(g => {
                  const isExpanded = expandedGodowns[g.id] ?? false;
                  const assignments = godownLocalBodies.filter(glb => glb.godown_id === g.id);
                  const stockCount = getStockForGodown(g.id).length;
                  return (
                    <Card key={g.id}>
                      <CardHeader
                        className="flex flex-row items-center justify-between cursor-pointer"
                        onClick={() => setExpandedGodowns(prev => ({ ...prev, [g.id]: !prev[g.id] }))}
                      >
                        <div className="flex items-center gap-3">
                          {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                          <Warehouse className="h-5 w-5 text-primary" />
                          <CardTitle className="text-lg">{g.name}</CardTitle>
                          <Badge variant={g.is_active ? "default" : "secondary"}>{g.is_active ? "Active" : "Inactive"}</Badge>
                          <span className="text-xs text-muted-foreground">{assignments.length} area(s) · {stockCount} stock entries</span>
                        </div>
                        <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                          <Button size="sm" variant="outline" onClick={() => { setSelectedGodown(g); resetAssignForm(); setAssignDialogOpen(true); }}>
                            {g.godown_type === "micro" ? "Assign Wards" : "Assign Panchayath"}
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleDelete(g.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      {isExpanded && (
                        <CardContent>
                          <Tabs value={getGodownInnerTab(g.id)} onValueChange={(tab) => setInnerTab(g.id, tab)}>
                            <TabsList className="mb-3 flex-wrap h-auto">
                              <TabsTrigger value="assignments">Assignments</TabsTrigger>
                              <TabsTrigger value="stock">
                                <Package className="mr-1 h-3 w-3" /> Stock ({stockCount})
                              </TabsTrigger>
                              <TabsTrigger value="purchase-history">Purchase History</TabsTrigger>
                              <TabsTrigger value="transfers">
                                <ArrowRightLeft className="mr-1 h-3 w-3" /> Transfers ({getTransfersForGodown(g.id).length})
                              </TabsTrigger>
                            </TabsList>
                            <TabsContent value="assignments">{renderAssignments(g)}</TabsContent>
                            <TabsContent value="stock">{renderStockDetails(g)}</TabsContent>
                            <TabsContent value="purchase-history">{renderPurchaseHistory(g)}</TabsContent>
                            <TabsContent value="transfers">{renderStockTransfers(g)}</TabsContent>
                          </Tabs>
                        </CardContent>
                      )}
                    </Card>
                  );
                })}
              </div>
            </TabsContent>
          ))}
        </Tabs>

        {/* Assign Dialog */}
        <Dialog open={assignDialogOpen} onOpenChange={(open) => { setAssignDialogOpen(open); if (!open) resetAssignForm(); }}>
          <DialogContent className="max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {isMicroGodown ? `Assign Wards to ${selectedGodown?.name}` : `Assign Panchayath to ${selectedGodown?.name}`}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {isMicroGodown ? (
                <>
                  <div>
                    <Label>Search Panchayath</Label>
                    <Input placeholder="Search panchayath..." value={localBodySearch} onChange={e => setLocalBodySearch(e.target.value)} className="mb-2" />
                    <Select value={assignLocalBodyId} onValueChange={(v) => { setAssignLocalBodyId(v); setSelectedWards([]); setAllWards(false); }}>
                      <SelectTrigger><SelectValue placeholder="Select panchayath" /></SelectTrigger>
                      <SelectContent>
                        {filteredLocalBodies.map(lb => <SelectItem key={lb.id} value={lb.id}>{lb.name} ({lb.body_type})</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  {assignLocalBodyId && selectedLocalBody && (() => {
                    const allocatedByOthers = godownWards
                      .filter(w => w.local_body_id === assignLocalBodyId && w.godown_id !== selectedGodown?.id)
                      .map(w => w.ward_number);
                    const availableWards = Array.from({ length: selectedLocalBody.ward_count }, (_, i) => i + 1)
                      .filter(w => !allocatedByOthers.includes(w));

                    return (
                      <div>
                        <Label className="mb-2 block">
                          Select Wards ({availableWards.length} available of {selectedLocalBody.ward_count})
                        </Label>
                        {allocatedByOthers.length > 0 && (
                          <p className="text-xs text-muted-foreground mb-2">
                            Ward {allocatedByOthers.sort((a, b) => a - b).join(", ")} already assigned to other micro godowns
                          </p>
                        )}
                        {availableWards.length === 0 ? (
                          <p className="text-sm text-muted-foreground py-4 text-center">All wards are already assigned to other micro godowns</p>
                        ) : (
                          <>
                            <div className="flex items-center gap-2 mb-3">
                              <Checkbox id="all-wards" checked={allWards} onCheckedChange={(c) => {
                                setAllWards(!!c);
                                setSelectedWards(c ? availableWards : []);
                              }} />
                              <label htmlFor="all-wards" className="text-sm font-medium cursor-pointer">All Available Wards</label>
                            </div>
                            <div className="grid grid-cols-5 gap-2 max-h-48 overflow-y-auto">
                              {availableWards.map(ward => (
                                <label key={ward} className="flex items-center gap-1.5 text-sm cursor-pointer">
                                  <Checkbox checked={selectedWards.includes(ward)} onCheckedChange={() => toggleWard(ward)} />
                                  {ward}
                                </label>
                              ))}
                            </div>
                          </>
                        )}
                        {selectedWards.length > 0 && (
                          <p className="mt-2 text-xs text-muted-foreground">{selectedWards.length} ward(s) selected</p>
                        )}
                      </div>
                    );
                  })()}

                  <Button onClick={handleAssign} disabled={!assignLocalBodyId || selectedWards.length === 0} className="w-full">
                    Assign
                  </Button>
                </>
              ) : (
                <>
                  <div>
                    <Label>Search Panchayath</Label>
                    <Input placeholder="Search panchayath..." value={localBodySearch} onChange={e => setLocalBodySearch(e.target.value)} />
                  </div>
                  <div className="flex items-center gap-2 border-b pb-2">
                    <Checkbox
                      id="select-all-lb"
                      checked={filteredLocalBodies.length > 0 && filteredLocalBodies.every(lb => selectedLocalBodyIds.includes(lb.id))}
                      onCheckedChange={(c) => selectAllFilteredLocalBodies(!!c)}
                    />
                    <label htmlFor="select-all-lb" className="text-sm font-medium cursor-pointer">Select All ({filteredLocalBodies.length})</label>
                  </div>
                  <div className="max-h-64 overflow-y-auto space-y-1">
                    {filteredLocalBodies.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-2">No panchayaths found</p>
                    ) : filteredLocalBodies.map(lb => {
                      const alreadyAssigned = godownLocalBodies.some(
                        glb => glb.godown_id === selectedGodown?.id && glb.local_body_id === lb.id
                      );
                      return (
                        <label key={lb.id} className={`flex items-center gap-2 text-sm cursor-pointer p-1.5 rounded hover:bg-muted ${alreadyAssigned ? "opacity-50" : ""}`}>
                          <Checkbox
                            checked={selectedLocalBodyIds.includes(lb.id)}
                            onCheckedChange={() => toggleLocalBody(lb.id)}
                            disabled={alreadyAssigned}
                          />
                          <span>{lb.name}</span>
                          <Badge variant="outline" className="text-xs ml-auto">{lb.body_type}</Badge>
                          {alreadyAssigned && <span className="text-xs text-muted-foreground">Assigned</span>}
                        </label>
                      );
                    })}
                  </div>
                  {selectedLocalBodyIds.length > 0 && (
                    <p className="text-xs text-muted-foreground">{selectedLocalBodyIds.length} panchayath(s) selected</p>
                  )}
                  <Button onClick={handleAssign} disabled={selectedLocalBodyIds.length === 0} className="w-full">
                    Assign {selectedLocalBodyIds.length > 0 ? `(${selectedLocalBodyIds.length})` : ""}
                  </Button>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Add Stock Dialog */}
        <Dialog open={stockDialogOpen} onOpenChange={setStockDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Stock to {stockGodown?.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Product</Label>
                <Select value={stockForm.product_id} onValueChange={v => setStockForm({ ...stockForm, product_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                  <SelectContent>
                    {products.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name} (₹{p.price})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Quantity</Label>
                  <Input type="number" min={1} value={stockForm.quantity || ""} onChange={e => setStockForm({ ...stockForm, quantity: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Purchase Price (₹)</Label>
                  <Input type="number" min={0} step="0.01" value={stockForm.purchase_price || ""} onChange={e => setStockForm({ ...stockForm, purchase_price: Number(e.target.value) })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Batch Number</Label>
                  <Input value={stockForm.batch_number} onChange={e => setStockForm({ ...stockForm, batch_number: e.target.value })} placeholder="Optional" />
                </div>
                <div>
                  <Label>Expiry Date</Label>
                  <Input type="date" value={stockForm.expiry_date} onChange={e => setStockForm({ ...stockForm, expiry_date: e.target.value })} />
                </div>
              </div>
              <Button className="w-full" onClick={handleAddStock}>Add Stock</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Stock Transfer Dialog */}
        <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {transferForm.transfer_type === "return"
                  ? `Return Stock from ${transferGodown?.name}`
                  : `Transfer Stock from ${transferGodown?.name}`
                }
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Product (from stock)</Label>
                <Select value={transferForm.product_id} onValueChange={v => setTransferForm({ ...transferForm, product_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                  <SelectContent>
                    {transferGodown && getGroupedStockProducts(transferGodown.id).map(s => (
                      <SelectItem key={s.product_id} value={s.product_id}>
                        <span className={s.total_qty < 0 ? "text-destructive font-semibold" : ""}>
                          {s.product_name} (Available: {s.total_qty})
                          {s.total_qty < 0 && " ⚠️"}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{transferForm.transfer_type === "return" ? "Return to Godown" : "Transfer to Godown"}</Label>
                <Select value={transferForm.to_godown_id} onValueChange={v => setTransferForm({ ...transferForm, to_godown_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select godown" /></SelectTrigger>
                  <SelectContent>
                    {transferGodown && getTransferTargets(transferGodown).map(g => (
                      <SelectItem key={g.id} value={g.id}>{g.name} ({g.godown_type})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Quantity</Label>
                  <Input type="number" min={1} value={transferForm.quantity || ""} onChange={e => setTransferForm({ ...transferForm, quantity: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Batch Number</Label>
                  <Input value={transferForm.batch_number} onChange={e => setTransferForm({ ...transferForm, batch_number: e.target.value })} placeholder="Optional" />
                </div>
              </div>
              <Button className="w-full" onClick={handleCreateTransfer}>
                {transferForm.transfer_type === "return" ? "Create Return" : "Create Transfer"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default GodownsPage;
