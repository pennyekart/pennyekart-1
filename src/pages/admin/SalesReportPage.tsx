import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Download, FileSpreadsheet, FileText, IndianRupee, Package, ShoppingCart, TrendingUp, TrendingDown } from "lucide-react";
import { format } from "date-fns";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Order {
  id: string;
  user_id: string | null;
  status: string;
  total: number;
  shipping_address: string | null;
  created_at: string;
  items: any;
  godown_id: string | null;
  seller_id: string | null;
  is_self_delivery: boolean;
}

interface Godown { id: string; name: string; godown_type: string; }
interface LocalBody { id: string; name: string; district_id: string; ward_count: number; }
interface District { id: string; name: string; }
interface Profile { user_id: string; full_name: string | null; local_body_id: string | null; ward_number: number | null; }
interface GodownWard { godown_id: string; local_body_id: string; ward_number: number; }
interface GodownLocalBody { godown_id: string; local_body_id: string; }
interface ProductInfo { id: string; purchase_rate: number; }
interface SellerGodownAssignment { seller_id: string; godown_id: string; }

const fmt = (n: number) => "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const SalesReportPage = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [godowns, setGodowns] = useState<Godown[]>([]);
  const [localBodies, setLocalBodies] = useState<LocalBody[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [godownWards, setGodownWards] = useState<GodownWard[]>([]);
  const [godownLocalBodies, setGodownLocalBodies] = useState<GodownLocalBody[]>([]);
  const [products, setProducts] = useState<ProductInfo[]>([]);
  const [sellerProducts, setSellerProducts] = useState<ProductInfo[]>([]);
  const [sellerGodownAssignments, setSellerGodownAssignments] = useState<SellerGodownAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [filterGodown, setFilterGodown] = useState("all");
  const [filterDistrict, setFilterDistrict] = useState("all");
  const [filterLocalBody, setFilterLocalBody] = useState("all");
  const [filterWard, setFilterWard] = useState("all");
  const [filterStatus, setFilterStatus] = useState("delivered");

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      const [ordersRes, godownsRes, lbRes, distRes, profilesRes, gwRes, glbRes, prodRes, spRes, sgaRes] = await Promise.all([
        supabase.from("orders").select("*").order("created_at", { ascending: false }),
        supabase.from("godowns").select("id, name, godown_type"),
        supabase.from("locations_local_bodies").select("id, name, district_id, ward_count"),
        supabase.from("locations_districts").select("id, name"),
        supabase.from("profiles").select("user_id, full_name, local_body_id, ward_number"),
        supabase.from("godown_wards").select("godown_id, local_body_id, ward_number"),
        supabase.from("godown_local_bodies").select("godown_id, local_body_id"),
        supabase.from("products").select("id, purchase_rate"),
        supabase.from("seller_products").select("id, purchase_rate"),
        supabase.from("seller_godown_assignments").select("seller_id, godown_id"),
      ]);
      setOrders((ordersRes.data as Order[]) ?? []);
      setGodowns((godownsRes.data as Godown[]) ?? []);
      setLocalBodies((lbRes.data as LocalBody[]) ?? []);
      setDistricts((distRes.data as District[]) ?? []);
      setProfiles((profilesRes.data as Profile[]) ?? []);
      setGodownWards((gwRes.data as GodownWard[]) ?? []);
      setGodownLocalBodies((glbRes.data as GodownLocalBody[]) ?? []);
      setProducts((prodRes.data as ProductInfo[]) ?? []);
      setSellerProducts((spRes.data as ProductInfo[]) ?? []);
      setSellerGodownAssignments((sgaRes.data as SellerGodownAssignment[]) ?? []);
      setLoading(false);
    };
    fetchAll();
  }, []);

  // Maps
  const profileMap = useMemo(() => {
    const m: Record<string, Profile> = {};
    profiles.forEach(p => { m[p.user_id] = p; });
    return m;
  }, [profiles]);

  const localBodyMap = useMemo(() => {
    const m: Record<string, LocalBody> = {};
    localBodies.forEach(lb => { m[lb.id] = lb; });
    return m;
  }, [localBodies]);

  const districtMap = useMemo(() => {
    const m: Record<string, District> = {};
    districts.forEach(d => { m[d.id] = d; });
    return m;
  }, [districts]);

  const godownMap = useMemo(() => {
    const m: Record<string, Godown> = {};
    godowns.forEach(g => { m[g.id] = g; });
    return m;
  }, [godowns]);

  // Purchase rate lookup map (both products and seller_products)
  const purchaseRateMap = useMemo(() => {
    const m: Record<string, number> = {};
    products.forEach(p => { m[p.id] = p.purchase_rate; });
    sellerProducts.forEach(p => { m[p.id] = p.purchase_rate; });
    return m;
  }, [products, sellerProducts]);

  // Seller to godown mapping
  const sellerGodownMap = useMemo(() => {
    const m: Record<string, string[]> = {};
    sellerGodownAssignments.forEach(sga => {
      if (!m[sga.seller_id]) m[sga.seller_id] = [];
      m[sga.seller_id].push(sga.godown_id);
    });
    return m;
  }, [sellerGodownAssignments]);

  // Godown to seller mapping (reverse)
  const godownSellerMap = useMemo(() => {
    const m: Record<string, string[]> = {};
    sellerGodownAssignments.forEach(sga => {
      if (!m[sga.godown_id]) m[sga.godown_id] = [];
      m[sga.godown_id].push(sga.seller_id);
    });
    return m;
  }, [sellerGodownAssignments]);

  // Filter local bodies by district
  const filteredLocalBodies = useMemo(() => {
    if (filterDistrict === "all") return localBodies;
    return localBodies.filter(lb => lb.district_id === filterDistrict);
  }, [localBodies, filterDistrict]);

  // Ward options for selected local body
  const wardOptions = useMemo(() => {
    if (filterLocalBody === "all") return [];
    const lb = localBodyMap[filterLocalBody];
    if (!lb) return [];
    return Array.from({ length: lb.ward_count }, (_, i) => i + 1);
  }, [filterLocalBody, localBodyMap]);

  // Get godown IDs for location filters
  const godownIdsForLocation = useMemo(() => {
    if (filterLocalBody !== "all" && filterWard !== "all") {
      return godownWards
        .filter(gw => gw.local_body_id === filterLocalBody && gw.ward_number === Number(filterWard))
        .map(gw => gw.godown_id);
    }
    if (filterLocalBody !== "all") {
      const fromWards = godownWards.filter(gw => gw.local_body_id === filterLocalBody).map(gw => gw.godown_id);
      const fromLB = godownLocalBodies.filter(glb => glb.local_body_id === filterLocalBody).map(glb => glb.godown_id);
      return [...new Set([...fromWards, ...fromLB])];
    }
    if (filterDistrict !== "all") {
      const lbIds = localBodies.filter(lb => lb.district_id === filterDistrict).map(lb => lb.id);
      const fromWards = godownWards.filter(gw => lbIds.includes(gw.local_body_id)).map(gw => gw.godown_id);
      const fromLB = godownLocalBodies.filter(glb => lbIds.includes(glb.local_body_id)).map(glb => glb.godown_id);
      return [...new Set([...fromWards, ...fromLB])];
    }
    return null;
  }, [filterDistrict, filterLocalBody, filterWard, godownWards, godownLocalBodies, localBodies]);

  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      // Status filter
      if (filterStatus !== "all" && o.status !== filterStatus) return false;

      // Date filter
      if (dateFrom && new Date(o.created_at) < dateFrom) return false;
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        if (new Date(o.created_at) > end) return false;
      }

      // Godown filter - also match seller orders via seller_godown_assignments
      if (filterGodown !== "all") {
        const matchesDirect = o.godown_id === filterGodown;
        const matchesSellerGodown = o.seller_id && sellerGodownMap[o.seller_id]?.includes(filterGodown);
        if (!matchesDirect && !matchesSellerGodown) return false;
      }

      // Location-based filter (district/panchayath/ward)
      if (godownIdsForLocation !== null) {
        const profile = o.user_id ? profileMap[o.user_id] : null;

        // Check if order's godown matches location
        const matchesGodown = o.godown_id && godownIdsForLocation.includes(o.godown_id);

        // Check if seller's assigned godown matches location
        const matchesSellerGodown = o.seller_id && sellerGodownMap[o.seller_id]?.some(gId => godownIdsForLocation.includes(gId));

        // Check if customer's profile location matches
        let matchesCustomerLocation = false;
        if (profile) {
          if (filterLocalBody !== "all") {
            if (profile.local_body_id === filterLocalBody) {
              if (filterWard !== "all") {
                matchesCustomerLocation = profile.ward_number === Number(filterWard);
              } else {
                matchesCustomerLocation = true;
              }
            }
          } else if (filterDistrict !== "all") {
            const lb = profile.local_body_id ? localBodyMap[profile.local_body_id] : null;
            matchesCustomerLocation = lb?.district_id === filterDistrict;
          }
        }

        if (!matchesGodown && !matchesSellerGodown && !matchesCustomerLocation) return false;
      }

      return true;
    });
  }, [orders, filterStatus, dateFrom, dateTo, filterGodown, godownIdsForLocation, filterLocalBody, filterWard, filterDistrict, profileMap, localBodyMap, sellerGodownMap]);

  // Calculate purchase cost for an order
  const getOrderPurchaseCost = (o: Order): number => {
    const items = Array.isArray(o.items) ? o.items : [];
    return items.reduce((sum: number, item: any) => {
      const qty = item.quantity || 1;
      const purchaseRate = purchaseRateMap[item.id] ?? 0;
      return sum + purchaseRate * qty;
    }, 0);
  };

  // Calculate sales amount (sum of item.price * qty) - this is what customer pays before deductions
  const getOrderSalesAmount = (o: Order): number => {
    const items = Array.isArray(o.items) ? o.items : [];
    return items.reduce((sum: number, item: any) => {
      const qty = item.quantity || 1;
      const price = item.price || 0;
      return sum + price * qty;
    }, 0);
  };

  // Summary stats
  const totalSalesAmount = filteredOrders.reduce((s, o) => s + getOrderSalesAmount(o), 0);
  const totalOrderValue = filteredOrders.reduce((s, o) => s + o.total, 0); // Net collected (after coupon/wallet deductions)
  const totalPurchaseCost = filteredOrders.reduce((s, o) => s + getOrderPurchaseCost(o), 0);
  const totalOrders = filteredOrders.length;
  const grossProfit = totalSalesAmount - totalPurchaseCost;
  const netProfit = totalOrderValue - totalPurchaseCost; // After all deductions

  // Build export data
  const exportRows = useMemo(() => {
    return filteredOrders.map(o => {
      const profile = o.user_id ? profileMap[o.user_id] : null;
      const godown = o.godown_id ? godownMap[o.godown_id] : null;
      const lb = profile?.local_body_id ? localBodyMap[profile.local_body_id] : null;
      const dist = lb?.district_id ? districtMap[lb.district_id] : null;
      const items = Array.isArray(o.items) ? o.items : [];
      const itemNames = items.map((i: any) => `${i.name || i.id} x${i.quantity || 1}`).join(", ");
      const salesAmount = getOrderSalesAmount(o);
      const purchaseCost = getOrderPurchaseCost(o);

      // Determine godown for seller orders
      let godownName = godown?.name || "N/A";
      let godownType = godown?.godown_type || "N/A";
      if (!godown && o.seller_id && sellerGodownMap[o.seller_id]?.length) {
        const sellerGdId = sellerGodownMap[o.seller_id][0];
        const sellerGd = godownMap[sellerGdId];
        if (sellerGd) {
          godownName = sellerGd.name;
          godownType = sellerGd.godown_type;
        }
      }

      return {
        "Order ID": o.id.slice(0, 8),
        "Date": format(new Date(o.created_at), "dd/MM/yyyy HH:mm"),
        "Customer": profile?.full_name || "N/A",
        "Items": itemNames,
        "Sales Amount (₹)": salesAmount,
        "Collected (₹)": o.total,
        "Purchase Cost (₹)": purchaseCost,
        "Gross Profit (₹)": salesAmount - purchaseCost,
        "Net Profit (₹)": o.total - purchaseCost,
        "Status": o.status,
        "Godown": godownName,
        "Godown Type": godownType,
        "Panchayath": lb?.name || "N/A",
        "District": dist?.name || "N/A",
        "Ward": profile?.ward_number || "N/A",
        "Self Delivery": o.is_self_delivery ? "Yes" : "No",
      };
    });
  }, [filteredOrders, profileMap, godownMap, localBodyMap, districtMap, purchaseRateMap, sellerGodownMap]);

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sales Report");

    const summaryData = [
      { "": "" },
      { "": "Summary" },
      { "": "Total Orders", "Order ID": totalOrders },
      { "": "Total Sales", "Order ID": fmt(totalSalesAmount) },
      { "": "Total Collected", "Order ID": fmt(totalOrderValue) },
      { "": "Purchase Cost", "Order ID": fmt(totalPurchaseCost) },
      { "": "Gross Profit", "Order ID": fmt(grossProfit) },
      { "": "Net Profit", "Order ID": fmt(netProfit) },
    ];
    const ws2 = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, ws2, "Summary");

    XLSX.writeFile(wb, `sales-report-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  };

  const exportToPDF = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(16);
    doc.text("Sales Report", 14, 15);
    doc.setFontSize(10);

    const filterText = [
      dateFrom ? `From: ${format(dateFrom, "dd/MM/yyyy")}` : "",
      dateTo ? `To: ${format(dateTo, "dd/MM/yyyy")}` : "",
      filterStatus !== "all" ? `Status: ${filterStatus}` : "",
      filterGodown !== "all" ? `Godown: ${godownMap[filterGodown]?.name}` : "",
      filterDistrict !== "all" ? `District: ${districtMap[filterDistrict]?.name}` : "",
      filterLocalBody !== "all" ? `Panchayath: ${localBodyMap[filterLocalBody]?.name}` : "",
      filterWard !== "all" ? `Ward: ${filterWard}` : "",
    ].filter(Boolean).join(" | ");

    if (filterText) doc.text(filterText, 14, 22);
    const summaryY = filterText ? 28 : 22;
    doc.text(`Orders: ${totalOrders} | Sales: ${fmt(totalSalesAmount)} | Collected: ${fmt(totalOrderValue)} | Gross Profit: ${fmt(grossProfit)} | Net Profit: ${fmt(netProfit)}`, 14, summaryY);

    const headers = ["Order ID", "Date", "Customer", "Sales ₹", "Collected ₹", "Profit ₹", "Status", "Godown", "Panchayath", "Ward"];
    const body = exportRows.map(r => [
      r["Order ID"], r["Date"], r["Customer"],
      r["Sales Amount (₹)"], r["Collected (₹)"], r["Net Profit (₹)"],
      r["Status"], r["Godown"], r["Panchayath"], String(r["Ward"]),
    ]);

    autoTable(doc, {
      head: [headers],
      body,
      startY: summaryY + 5,
      styles: { fontSize: 7 },
      headStyles: { fillColor: [59, 130, 246] },
    });

    doc.save(`sales-report-${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };

  const resetFilters = () => {
    setDateFrom(undefined);
    setDateTo(undefined);
    setFilterGodown("all");
    setFilterDistrict("all");
    setFilterLocalBody("all");
    setFilterWard("all");
    setFilterStatus("delivered");
  };

  if (loading) {
    return <AdminLayout><div className="flex items-center justify-center py-20 text-muted-foreground">Loading sales data…</div></AdminLayout>;
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold">Sales Report</h1>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportToExcel}>
              <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
            </Button>
            <Button variant="outline" size="sm" onClick={exportToPDF}>
              <FileText className="h-4 w-4 mr-1" /> PDF
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="justify-start text-xs">
                    <CalendarIcon className="h-3 w-3 mr-1" />
                    {dateFrom ? format(dateFrom, "dd/MM/yy") : "From"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} /></PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="justify-start text-xs">
                    <CalendarIcon className="h-3 w-3 mr-1" />
                    {dateTo ? format(dateTo, "dd/MM/yy") : "To"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={dateTo} onSelect={setDateTo} /></PopoverContent>
              </Popover>

              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="shipped">Shipped</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterGodown} onValueChange={setFilterGodown}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Godowns</SelectItem>
                  {godowns.map(g => <SelectItem key={g.id} value={g.id}>{g.name} ({g.godown_type})</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={filterDistrict} onValueChange={(v) => { setFilterDistrict(v); setFilterLocalBody("all"); setFilterWard("all"); }}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Districts</SelectItem>
                  {districts.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={filterLocalBody} onValueChange={(v) => { setFilterLocalBody(v); setFilterWard("all"); }}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Panchayaths</SelectItem>
                  {filteredLocalBodies.map(lb => <SelectItem key={lb.id} value={lb.id}>{lb.name}</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={filterWard} onValueChange={setFilterWard} disabled={filterLocalBody === "all"}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Wards</SelectItem>
                  {wardOptions.map(w => <SelectItem key={w} value={String(w)}>Ward {w}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button variant="ghost" size="sm" className="mt-2 text-xs" onClick={resetFilters}>Reset Filters</Button>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-primary" />
                <span className="text-xs text-muted-foreground">Total Orders</span>
              </div>
              <p className="text-xl font-bold mt-1">{totalOrders}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <IndianRupee className="h-4 w-4 text-primary" />
                <span className="text-xs text-muted-foreground">Sales Amount</span>
              </div>
              <p className="text-xl font-bold mt-1">{fmt(totalSalesAmount)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <IndianRupee className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Collected</span>
              </div>
              <p className="text-xl font-bold mt-1">{fmt(totalOrderValue)}</p>
              <p className="text-[10px] text-muted-foreground">After coupon/wallet</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Purchase Cost</span>
              </div>
              <p className="text-xl font-bold mt-1">{fmt(totalPurchaseCost)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <span className="text-xs text-muted-foreground">Gross Profit</span>
              </div>
              <p className={`text-xl font-bold mt-1 ${grossProfit >= 0 ? "text-green-600" : "text-red-600"}`}>{fmt(grossProfit)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-blue-600" />
                <span className="text-xs text-muted-foreground">Net Profit</span>
              </div>
              <p className={`text-xl font-bold mt-1 ${netProfit >= 0 ? "text-green-600" : "text-red-600"}`}>{fmt(netProfit)}</p>
              <p className="text-[10px] text-muted-foreground">After all deductions</p>
            </CardContent>
          </Card>
        </div>

        {/* Sales Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Orders ({filteredOrders.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Order ID</TableHead>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs">Customer</TableHead>
                    <TableHead className="text-xs">Items</TableHead>
                    <TableHead className="text-xs">Sales ₹</TableHead>
                    <TableHead className="text-xs">Collected ₹</TableHead>
                    <TableHead className="text-xs">Cost ₹</TableHead>
                    <TableHead className="text-xs">Profit ₹</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Godown</TableHead>
                    <TableHead className="text-xs">Panchayath</TableHead>
                    <TableHead className="text-xs">Ward</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.slice(0, 100).map(o => {
                    const profile = o.user_id ? profileMap[o.user_id] : null;
                    const godown = o.godown_id ? godownMap[o.godown_id] : null;
                    const lb = profile?.local_body_id ? localBodyMap[profile.local_body_id] : null;
                    const items = Array.isArray(o.items) ? o.items : [];
                    const itemCount = items.reduce((t: number, i: any) => t + (i.quantity || 1), 0);
                    const salesAmt = getOrderSalesAmount(o);
                    const purchaseCost = getOrderPurchaseCost(o);
                    const profit = o.total - purchaseCost;

                    // Resolve godown name for seller orders
                    let godownName = godown?.name || "";
                    if (!godownName && o.seller_id && sellerGodownMap[o.seller_id]?.length) {
                      const sgId = sellerGodownMap[o.seller_id][0];
                      godownName = godownMap[sgId]?.name || "";
                    }

                    return (
                      <TableRow key={o.id}>
                        <TableCell className="font-mono text-xs">{o.id.slice(0, 8)}…</TableCell>
                        <TableCell className="text-xs">{format(new Date(o.created_at), "dd/MM/yy HH:mm")}</TableCell>
                        <TableCell className="text-xs">{profile?.full_name || "N/A"}</TableCell>
                        <TableCell className="text-xs">{itemCount} item(s)</TableCell>
                        <TableCell className="text-xs font-medium">{fmt(salesAmt)}</TableCell>
                        <TableCell className="text-xs">{fmt(o.total)}</TableCell>
                        <TableCell className="text-xs">{fmt(purchaseCost)}</TableCell>
                        <TableCell className={`text-xs font-medium ${profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {fmt(profit)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={o.status === "delivered" ? "default" : o.status === "cancelled" ? "destructive" : "secondary"} className="text-xs">
                            {o.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">{godownName || "—"}</TableCell>
                        <TableCell className="text-xs">{lb?.name || "—"}</TableCell>
                        <TableCell className="text-xs">{profile?.ward_number || "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredOrders.length === 0 && (
                    <TableRow><TableCell colSpan={12} className="text-center text-muted-foreground py-8">No orders match the filters</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
              {filteredOrders.length > 100 && (
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  Showing 100 of {filteredOrders.length} orders. Export to see all.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default SalesReportPage;
