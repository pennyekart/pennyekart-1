import { useEffect, useMemo, useState } from "react";
import { format, subDays, subMonths, startOfDay, endOfDay, isWithinInterval } from "date-fns";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, CalendarIcon, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend
} from "recharts";
import {
  TrendingUp, TrendingDown, ShoppingCart, Package, Users, Wallet,
  Store, Truck, BarChart3, AlertTriangle, CheckCircle, Search
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────
interface Order {
  id: string; status: string; total: number; items: any;
  created_at: string; user_id: string | null;
  seller_id: string | null; assigned_delivery_staff_id: string | null;
  godown_id: string | null;
}
interface Product { id: string; name: string; price: number; purchase_rate: number; mrp: number; stock: number; is_active: boolean; category: string | null; }
interface SellerProduct { id: string; name: string; price: number; purchase_rate: number; stock: number; seller_id: string; is_approved: boolean; }
interface GodownStock { id: string; quantity: number; product_id: string; purchase_price: number; godown_id: string; }
interface Profile { user_id: string; full_name: string | null; user_type: string; local_body_id: string | null; ward_number: number | null; }
interface SellerWallet { seller_id: string; balance: number; }
interface SellerWalletTxn { seller_id: string; type: string; amount: number; description: string | null; }
interface LocalBody { id: string; name: string; district_id: string; ward_count: number; }
interface District { id: string; name: string; }

const COLORS = ["hsl(var(--primary))", "hsl(var(--chart-2,220 70% 50%))", "hsl(var(--chart-3,160 60% 45%))", "hsl(var(--chart-4,30 80% 55%))", "hsl(var(--chart-5,280 65% 60%))"];

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const pct = (n: number, d: number) => d ? `${((n / d) * 100).toFixed(1)}%` : "—";

// ─── Stat Card ───────────────────────────────────────────────────────────────
const StatCard = ({ label, value, icon: Icon, sub, color = "text-primary" }: { label: string; value: string; icon: any; sub?: string; color?: string }) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between pb-2">
      <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      <Icon className={`h-5 w-5 ${color}`} />
    </CardHeader>
    <CardContent>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </CardContent>
  </Card>
);

const ReportsPage = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [sellerProducts, setSellerProducts] = useState<SellerProduct[]>([]);
  const [godownStock, setGodownStock] = useState<GodownStock[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [sellerWallets, setSellerWallets] = useState<SellerWallet[]>([]);
  const [sellerTxns, setSellerTxns] = useState<SellerWalletTxn[]>([]);
  const [localBodies, setLocalBodies] = useState<LocalBody[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchHistory, setSearchHistory] = useState<{ search_query: string; result_count: number | null; created_at: string; customer_user_id: string }[]>([]);

  // ─── Filters ───────────────────────────────────────────────────────────────
  const [dateRange, setDateRange] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterDistrict, setFilterDistrict] = useState<string>("all");
  const [filterLocalBody, setFilterLocalBody] = useState<string>("all");
  const [filterWard, setFilterWard] = useState<string>("all");

  // Compute available categories
  const categories = useMemo(() => {
    const cats = new Set<string>();
    products.forEach(p => { if (p.category) cats.add(p.category); });
    return Array.from(cats).sort();
  }, [products]);

  // Apply date preset
  const handleDatePreset = (preset: string) => {
    setDateRange(preset);
    const now = new Date();
    switch (preset) {
      case "7d": setDateFrom(subDays(now, 7)); setDateTo(now); break;
      case "30d": setDateFrom(subDays(now, 30)); setDateTo(now); break;
      case "90d": setDateFrom(subDays(now, 90)); setDateTo(now); break;
      case "6m": setDateFrom(subMonths(now, 6)); setDateTo(now); break;
      case "1y": setDateFrom(subMonths(now, 12)); setDateTo(now); break;
      case "custom": break;
      default: setDateFrom(undefined); setDateTo(undefined); break;
    }
  };

  // Build product maps early for category filter
  const productMapEarly: Record<string, Product> = {};
  products.forEach(p => { productMapEarly[p.id] = p; });
  const sellerProdMapEarly: Record<string, SellerProduct & { category?: string | null }> = {};
  sellerProducts.forEach(sp => { sellerProdMapEarly[sp.id] = sp as any; });

  // Profile lookup for location filtering
  const profileMap = useMemo(() => {
    const m: Record<string, Profile> = {};
    profiles.forEach(p => { m[p.user_id] = p; });
    return m;
  }, [profiles]);


  const localBodyIdsForDistrict = useMemo(() => {
    if (filterDistrict === "all") return null;
    return new Set(localBodies.filter(lb => lb.district_id === filterDistrict).map(lb => lb.id));
  }, [localBodies, filterDistrict]);

  // Filter orders by date range, status, category, and location
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      if (dateFrom && dateTo) {
        const d = new Date(o.created_at);
        if (!isWithinInterval(d, { start: startOfDay(dateFrom), end: endOfDay(dateTo) })) return false;
      }
      if (filterStatus !== "all" && o.status !== filterStatus) return false;
      if (filterCategory !== "all") {
        const items = Array.isArray(o.items) ? o.items : [];
        const hasCategory = items.some((item: any) => {
          const cat = productMapEarly[item.id]?.category || (sellerProdMapEarly[item.id] as any)?.category;
          return cat === filterCategory;
        });
        if (!hasCategory) return false;
      }
      // Location filters
      if (filterDistrict !== "all" || filterLocalBody !== "all" || filterWard !== "all") {
        if (!o.user_id) return false;
        const prof = profileMap[o.user_id];
        if (!prof) return false;
        if (filterLocalBody !== "all") {
          if (prof.local_body_id !== filterLocalBody) return false;
          if (filterWard !== "all" && prof.ward_number !== Number(filterWard)) return false;
        } else if (filterDistrict !== "all") {
          if (!prof.local_body_id || !localBodyIdsForDistrict?.has(prof.local_body_id)) return false;
        }
      }
      return true;
    });
  }, [orders, dateFrom, dateTo, filterStatus, filterCategory, productMapEarly, sellerProdMapEarly, filterDistrict, filterLocalBody, filterWard, profileMap, localBodyIdsForDistrict]);

  // Location filter derived data
  const filteredLocalBodies = useMemo(() => {
    if (filterDistrict === "all") return localBodies;
    return localBodies.filter(lb => lb.district_id === filterDistrict);
  }, [localBodies, filterDistrict]);

  const wardOptions = useMemo(() => {
    if (filterLocalBody === "all") return [];
    const lb = localBodies.find(l => l.id === filterLocalBody);
    if (!lb) return [];
    return Array.from({ length: lb.ward_count }, (_, i) => i + 1);
  }, [localBodies, filterLocalBody]);


  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [
        { data: ord }, { data: prod }, { data: sprod }, { data: gstock },
        { data: prof }, { data: sw }, { data: stxn }, { data: lb }, { data: dist },
        { data: sh }
      ] = await Promise.all([
        supabase.from("orders").select("id,status,total,items,created_at,user_id,seller_id,assigned_delivery_staff_id,godown_id").order("created_at", { ascending: false }),
        supabase.from("products").select("id,name,price,purchase_rate,mrp,stock,is_active,category"),
        supabase.from("seller_products").select("id,name,price,purchase_rate,stock,seller_id,is_approved"),
        supabase.from("godown_stock").select("id,quantity,product_id,purchase_price,godown_id"),
        supabase.from("profiles").select("user_id,full_name,user_type,local_body_id,ward_number"),
        supabase.from("seller_wallets").select("seller_id,balance"),
        supabase.from("seller_wallet_transactions").select("seller_id,type,amount,description"),
        supabase.from("locations_local_bodies").select("id,name,district_id,ward_count"),
        supabase.from("locations_districts").select("id,name"),
        supabase.from("customer_search_history").select("search_query,result_count,created_at,customer_user_id").order("created_at", { ascending: false }),
      ]);
      setOrders((ord ?? []) as Order[]);
      setProducts((prod ?? []) as Product[]);
      setSellerProducts((sprod ?? []) as SellerProduct[]);
      setGodownStock((gstock ?? []) as GodownStock[]);
      setProfiles((prof ?? []) as Profile[]);
      setSellerWallets((sw ?? []) as SellerWallet[]);
      setSellerTxns((stxn ?? []) as SellerWalletTxn[]);
      setLocalBodies((lb ?? []) as LocalBody[]);
      setDistricts((dist ?? []) as District[]);
      setSearchHistory(sh ?? []);
      setLoading(false);
    };
    load();
  }, []);

  // ─── Derived Data (uses filteredOrders) ────────────────────────────────────
  const delivered = filteredOrders.filter(o => o.status === "delivered");
  const cancelled = filteredOrders.filter(o => o.status === "cancelled");
  const pending = filteredOrders.filter(o => !["delivered", "cancelled"].includes(o.status));

  // P&L: revenue = sum of order totals (delivered); COGS = sum of (purchase_rate × qty) for all items
  let grossRevenue = 0, cogs = 0;
  const productMap: Record<string, Product> = {};
  products.forEach(p => { productMap[p.id] = p; });
  const sellerProdMap: Record<string, SellerProduct> = {};
  sellerProducts.forEach(sp => { sellerProdMap[sp.id] = sp; });

  delivered.forEach(o => {
    grossRevenue += o.total || 0;
    const items = Array.isArray(o.items) ? o.items : [];
    items.forEach((item: any) => {
      const qty = item.quantity || 1;
      const pr = productMap[item.id]?.purchase_rate ?? sellerProdMap[item.id]?.purchase_rate ?? 0;
      cogs += pr * qty;
    });
  });
  const grossProfit = grossRevenue - cogs;
  const grossMargin = grossRevenue > 0 ? (grossProfit / grossRevenue) * 100 : 0;

  // Monthly revenue for chart (last 6 months)
  const monthlyMap: Record<string, { revenue: number; orders: number; cogs: number }> = {};
  delivered.forEach(o => {
    const m = new Date(o.created_at).toLocaleString("en-IN", { month: "short", year: "2-digit" });
    if (!monthlyMap[m]) monthlyMap[m] = { revenue: 0, orders: 0, cogs: 0 };
    monthlyMap[m].revenue += o.total || 0;
    monthlyMap[m].orders++;
    const items = Array.isArray(o.items) ? o.items : [];
    items.forEach((item: any) => {
      const pr = productMap[item.id]?.purchase_rate ?? sellerProdMap[item.id]?.purchase_rate ?? 0;
      monthlyMap[m].cogs += pr * (item.quantity || 1);
    });
  });
  const monthlyData = Object.entries(monthlyMap).slice(-6).map(([month, v]) => ({
    month, revenue: Math.round(v.revenue), cogs: Math.round(v.cogs),
    profit: Math.round(v.revenue - v.cogs), orders: v.orders
  }));

  // Order status distribution
  const statusDist = [
    { name: "Delivered", value: delivered.length },
    { name: "Pending", value: pending.length },
    { name: "Cancelled", value: cancelled.length },
  ].filter(d => d.value > 0);

  // Product performance (regular products)
  const prodSales: Record<string, { name: string; sold: number; revenue: number; profit: number }> = {};
  delivered.forEach(o => {
    const items = Array.isArray(o.items) ? o.items : [];
    items.forEach((item: any) => {
      const p = productMap[item.id];
      if (!p) return;
      if (!prodSales[item.id]) prodSales[item.id] = { name: p.name, sold: 0, revenue: 0, profit: 0 };
      const qty = item.quantity || 1;
      prodSales[item.id].sold += qty;
      prodSales[item.id].revenue += (item.price || p.price) * qty;
      prodSales[item.id].profit += ((item.price || p.price) - p.purchase_rate) * qty;
    });
  });
  const topProducts = Object.values(prodSales).sort((a, b) => b.revenue - a.revenue).slice(0, 10);

  // Seller performance
  const sellerProfiles = profiles.filter(p => p.user_type === "selling_partner");
  const sellerPerfMap: Record<string, { name: string; revenue: number; orders: number; balance: number; settled: number }> = {};
  sellerProfiles.forEach(p => {
    const wallet = sellerWallets.find(w => w.seller_id === p.user_id);
    const txns = sellerTxns.filter(t => t.seller_id === p.user_id);
    const credits = txns.filter(t => t.type !== "settlement").reduce((s, t) => s + Math.abs(t.amount), 0);
    const settled = txns.filter(t => t.type === "settlement" || t.description?.toLowerCase().includes("settl")).reduce((s, t) => s + Math.abs(t.amount), 0);
    sellerPerfMap[p.user_id] = { name: p.full_name || p.user_id, revenue: credits, orders: 0, balance: wallet?.balance || 0, settled };
  });
  delivered.forEach(o => {
    if (o.seller_id && sellerPerfMap[o.seller_id]) sellerPerfMap[o.seller_id].orders++;
  });
  const sellerPerf = Object.values(sellerPerfMap).sort((a, b) => b.revenue - a.revenue);

  // Local body performance
  const lbMap: Record<string, string> = {};
  localBodies.forEach(lb => { lbMap[lb.id] = lb.name; });
  const profileLbMap: Record<string, string> = {};
  profiles.forEach(p => { if (p.local_body_id) profileLbMap[p.user_id] = lbMap[p.local_body_id] || "Unknown"; });
  const lbPerf: Record<string, { name: string; orders: number; revenue: number }> = {};
  delivered.forEach(o => {
    const lb = o.user_id ? (profileLbMap[o.user_id] || "Unknown") : "Unknown";
    if (!lbPerf[lb]) lbPerf[lb] = { name: lb, orders: 0, revenue: 0 };
    lbPerf[lb].orders++;
    lbPerf[lb].revenue += o.total || 0;
  });
  const lbPerfArr = Object.values(lbPerf).sort((a, b) => b.revenue - a.revenue).slice(0, 10);

  // Stock health
  const lowStockProds = products.filter(p => p.stock >= 0 && p.stock <= 5 && p.is_active);
  const totalGodownStock = godownStock.reduce((s, g) => s + g.quantity, 0);
  const totalStockValue = godownStock.reduce((s, g) => s + g.quantity * g.purchase_price, 0);

  // Delivery staff performance
  const deliveryStaff = profiles.filter(p => p.user_type === "delivery_staff");
  const staffPerf: Record<string, { name: string; delivered: number; pending: number }> = {};
  deliveryStaff.forEach(p => { staffPerf[p.user_id] = { name: p.full_name || p.user_id, delivered: 0, pending: 0 }; });
  delivered.forEach(o => { if (o.assigned_delivery_staff_id && staffPerf[o.assigned_delivery_staff_id]) staffPerf[o.assigned_delivery_staff_id].delivered++; });
  pending.forEach(o => { if (o.assigned_delivery_staff_id && staffPerf[o.assigned_delivery_staff_id]) staffPerf[o.assigned_delivery_staff_id].pending++; });
  const staffPerfArr = Object.values(staffPerf).sort((a, b) => b.delivered - a.delivered);

  // Category breakdown (from delivered orders)
  const catMap: Record<string, { name: string; revenue: number; sold: number }> = {};
  delivered.forEach(o => {
    const items = Array.isArray(o.items) ? o.items : [];
    items.forEach((item: any) => {
      const p = productMap[item.id] || sellerProdMap[item.id];
      const cat = (p as any)?.category || "Uncategorized";
      if (!catMap[cat]) catMap[cat] = { name: cat, revenue: 0, sold: 0 };
      catMap[cat].sold += item.quantity || 1;
      catMap[cat].revenue += (item.price || 0) * (item.quantity || 1);
    });
  });
  const catData = Object.values(catMap).sort((a, b) => b.revenue - a.revenue).slice(0, 6);

  // ─── Search Analytics ────────────────────────────────────────────────────
  const filteredSearchHistory = useMemo(() => {
    if (!dateFrom || !dateTo) return searchHistory;
    return searchHistory.filter(s => {
      const d = new Date(s.created_at);
      return isWithinInterval(d, { start: startOfDay(dateFrom), end: endOfDay(dateTo) });
    });
  }, [searchHistory, dateFrom, dateTo]);

  const searchAnalytics = useMemo(() => {
    const queryCount: Record<string, { count: number; totalResults: number; zeroCount: number }> = {};
    filteredSearchHistory.forEach(s => {
      const q = s.search_query.toLowerCase().trim();
      if (!queryCount[q]) queryCount[q] = { count: 0, totalResults: 0, zeroCount: 0 };
      queryCount[q].count++;
      queryCount[q].totalResults += s.result_count ?? 0;
      if ((s.result_count ?? 0) === 0) queryCount[q].zeroCount++;
    });

    const topSearches = Object.entries(queryCount)
      .map(([query, v]) => ({ query, count: v.count, avgResults: v.count > 0 ? Math.round(v.totalResults / v.count) : 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    const zeroResultSearches = Object.entries(queryCount)
      .filter(([, v]) => v.zeroCount > 0)
      .map(([query, v]) => ({ query, count: v.zeroCount }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);

    // Daily search volume (last 30 entries)
    const dailyMap: Record<string, number> = {};
    filteredSearchHistory.forEach(s => {
      const day = format(new Date(s.created_at), "dd MMM");
      dailyMap[day] = (dailyMap[day] || 0) + 1;
    });
    const dailyVolume = Object.entries(dailyMap).slice(-30).map(([day, searches]) => ({ day, searches }));

    const uniqueSearchers = new Set(filteredSearchHistory.map(s => s.customer_user_id)).size;
    const totalSearches = filteredSearchHistory.length;
    const zeroResultTotal = filteredSearchHistory.filter(s => (s.result_count ?? 0) === 0).length;

    return { topSearches, zeroResultSearches, dailyVolume, uniqueSearchers, totalSearches, zeroResultTotal };
  }, [filteredSearchHistory]);

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground animate-pulse">Loading reports…</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold">Reports & Analytics</h1>
        <div className="flex flex-wrap items-center gap-2">
          {/* Date Range Preset */}
          <Select value={dateRange} onValueChange={handleDatePreset}>
            <SelectTrigger className="w-[130px] h-9 text-xs">
              <SelectValue placeholder="Date Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
              <SelectItem value="90d">Last 90 Days</SelectItem>
              <SelectItem value="6m">Last 6 Months</SelectItem>
              <SelectItem value="1y">Last 1 Year</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>

          {/* Custom Date Pickers */}
          {dateRange === "custom" && (
            <>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("text-xs gap-1", !dateFrom && "text-muted-foreground")}>
                    <CalendarIcon className="h-3.5 w-3.5" />
                    {dateFrom ? format(dateFrom, "dd MMM yy") : "From"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("text-xs gap-1", !dateTo && "text-muted-foreground")}>
                    <CalendarIcon className="h-3.5 w-3.5" />
                    {dateTo ? format(dateTo, "dd MMM yy") : "To"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </>
          )}

          {/* Status Filter */}
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[120px] h-9 text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>

          {/* Category Filter */}
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-[130px] h-9 text-xs">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* District Filter */}
          <Select value={filterDistrict} onValueChange={(v) => { setFilterDistrict(v); setFilterLocalBody("all"); setFilterWard("all"); }}>
            <SelectTrigger className="w-[130px] h-9 text-xs">
              <SelectValue placeholder="District" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Districts</SelectItem>
              {districts.map(d => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Panchayath Filter */}
          {filterDistrict !== "all" && (
            <Select value={filterLocalBody} onValueChange={(v) => { setFilterLocalBody(v); setFilterWard("all"); }}>
              <SelectTrigger className="w-[140px] h-9 text-xs">
                <SelectValue placeholder="Panchayath" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Panchayaths</SelectItem>
                {filteredLocalBodies.map(lb => (
                  <SelectItem key={lb.id} value={lb.id}>{lb.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Ward Filter */}
          {filterLocalBody !== "all" && wardOptions.length > 0 && (
            <Select value={filterWard} onValueChange={setFilterWard}>
              <SelectTrigger className="w-[110px] h-9 text-xs">
                <SelectValue placeholder="Ward" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Wards</SelectItem>
                {wardOptions.map(w => (
                  <SelectItem key={w} value={String(w)}>Ward {w}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Reset */}
          {(dateRange !== "all" || filterStatus !== "all" || filterCategory !== "all" || filterDistrict !== "all") && (
            <Button variant="ghost" size="sm" className="text-xs h-9" onClick={() => { setDateRange("all"); setDateFrom(undefined); setDateTo(undefined); setFilterStatus("all"); setFilterCategory("all"); setFilterDistrict("all"); setFilterLocalBody("all"); setFilterWard("all"); }}>
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* Active filters summary */}
      {(dateRange !== "all" || filterStatus !== "all" || filterCategory !== "all" || filterDistrict !== "all") && (
        <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Filter className="h-3.5 w-3.5" />
          <span>
            Showing {filteredOrders.length} of {orders.length} orders
            {dateFrom && dateTo && ` • ${format(dateFrom, "dd MMM yy")} – ${format(dateTo, "dd MMM yy")}`}
            {filterStatus !== "all" && ` • Status: ${filterStatus}`}
            {filterCategory !== "all" && ` • Category: ${filterCategory}`}
            {filterDistrict !== "all" && ` • District: ${districts.find(d => d.id === filterDistrict)?.name}`}
            {filterLocalBody !== "all" && ` • ${localBodies.find(lb => lb.id === filterLocalBody)?.name}`}
            {filterWard !== "all" && ` • Ward ${filterWard}`}
          </span>
        </div>
      )}

      <Tabs defaultValue="overview">
        <TabsList className="mb-6 flex flex-wrap gap-1 h-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="pl">P&L</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="sellers">Sellers</TabsTrigger>
          <TabsTrigger value="delivery">Delivery</TabsTrigger>
          <TabsTrigger value="stock">Stock</TabsTrigger>
          <TabsTrigger value="geography">Geography</TabsTrigger>
          <TabsTrigger value="search">Search</TabsTrigger>
        </TabsList>

        {/* ── OVERVIEW ── */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total Orders" value={String(filteredOrders.length)} icon={ShoppingCart} sub={`${delivered.length} delivered`} />
            <StatCard label="Gross Revenue" value={fmt(grossRevenue)} icon={TrendingUp} sub={`from ${delivered.length} deliveries`} color="text-green-600" />
            <StatCard label="Gross Profit" value={fmt(grossProfit)} icon={BarChart3} sub={`${grossMargin.toFixed(1)}% margin`} color={grossProfit >= 0 ? "text-green-600" : "text-destructive"} />
            <StatCard label="Cancellations" value={String(cancelled.length)} icon={TrendingDown} sub={pct(cancelled.length, filteredOrders.length) + " of orders"} color="text-destructive" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Active Products" value={String(products.filter(p => p.is_active).length)} icon={Package} sub={`${products.length} total`} />
            <StatCard label="Selling Partners" value={String(sellerProfiles.length)} icon={Store} sub={`${sellerProducts.filter(sp => sp.is_approved).length} approved products`} />
            <StatCard label="Delivery Staff" value={String(deliveryStaff.length)} icon={Truck} />
            <StatCard label="Pending Orders" value={String(pending.length)} icon={AlertTriangle} color="text-amber-500" />
          </div>

          {/* Monthly Revenue & Profit Chart */}
          <Card>
            <CardHeader><CardTitle>Monthly Revenue & Profit</CardTitle></CardHeader>
            <CardContent>
              {monthlyData.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No delivered orders yet</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis className="text-xs" tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Legend />
                    <Bar dataKey="revenue" name="Revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="cogs" name="COGS" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="profit" name="Profit" fill="hsl(var(--chart-3,160 60% 45%))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Order Status Donut */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Order Status Distribution</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={statusDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {statusDist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Revenue by Category</CardTitle></CardHeader>
              <CardContent>
                {catData.length === 0 ? <p className="text-muted-foreground text-center py-8">No data yet</p> : (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={catData} dataKey="revenue" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name }) => name}>
                        {catData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => fmt(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── P&L ── */}
        <TabsContent value="pl" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard label="Gross Revenue" value={fmt(grossRevenue)} icon={TrendingUp} sub="Sum of delivered order totals" color="text-green-600" />
            <StatCard label="Cost of Goods Sold" value={fmt(cogs)} icon={Package} sub="Sum of purchase_rate × qty" color="text-amber-500" />
            <StatCard label="Gross Profit" value={fmt(grossProfit)} icon={BarChart3} sub={`${grossMargin.toFixed(1)}% gross margin`} color={grossProfit >= 0 ? "text-green-600" : "text-destructive"} />
          </div>

          <Collapsible>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <CardTitle className="flex items-center justify-between">
                    P&L Summary
                    <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform duration-200 [&[data-state=open]]:rotate-180" />
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent>
                  <Table>
                    <TableBody>
                      {[
                        { label: "Gross Revenue (Delivered Orders)", value: fmt(grossRevenue), bold: false },
                        { label: "(-) Cost of Goods Sold (COGS)", value: fmt(cogs), bold: false },
                        { label: "Gross Profit", value: fmt(grossProfit), bold: true },
                        { label: "Gross Margin %", value: `${grossMargin.toFixed(2)}%`, bold: true },
                        { label: "Total Orders", value: String(orders.length), bold: false },
                        { label: "Delivered Orders", value: String(delivered.length), bold: false },
                        { label: "Cancelled Orders", value: String(cancelled.length), bold: false },
                        { label: "Pending Orders", value: String(pending.length), bold: false },
                        { label: "Average Order Value (Delivered)", value: delivered.length ? fmt(grossRevenue / delivered.length) : "—", bold: false },
                      ].map(row => (
                        <TableRow key={row.label}>
                          <TableCell className={row.bold ? "font-semibold" : ""}>{row.label}</TableCell>
                          <TableCell className={`text-right ${row.bold ? "font-bold text-lg" : ""}`}>{row.value}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Monthly P&L table */}
          <Card>
            <CardHeader><CardTitle>Monthly P&L Breakdown</CardTitle></CardHeader>
            <CardContent>
              {monthlyData.length === 0 ? <p className="text-muted-foreground text-center py-6">No delivered orders</p> : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Month</TableHead>
                      <TableHead className="text-right">Orders</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">COGS</TableHead>
                      <TableHead className="text-right">Profit</TableHead>
                      <TableHead className="text-right">Margin</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthlyData.map(m => (
                      <TableRow key={m.month}>
                        <TableCell className="font-medium">{m.month}</TableCell>
                        <TableCell className="text-right">{m.orders}</TableCell>
                        <TableCell className="text-right">{fmt(m.revenue)}</TableCell>
                        <TableCell className="text-right">{fmt(m.cogs)}</TableCell>
                        <TableCell className={`text-right font-semibold ${m.profit >= 0 ? "text-green-600" : "text-destructive"}`}>{fmt(m.profit)}</TableCell>
                        <TableCell className="text-right">{m.revenue > 0 ? `${((m.profit / m.revenue) * 100).toFixed(1)}%` : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── PRODUCTS ── */}
        <TabsContent value="products" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Total Products" value={String(products.length)} icon={Package} sub={`${products.filter(p => p.is_active).length} active`} />
            <StatCard label="Top Product Revenue" value={topProducts[0] ? fmt(topProducts[0].revenue) : "—"} icon={TrendingUp} sub={topProducts[0]?.name} color="text-green-600" />
            <StatCard label="Low Stock Alert" value={String(lowStockProds.length)} icon={AlertTriangle} sub="≤5 units" color="text-amber-500" />
          </div>

          {/* Top Products */}
          <Card>
            <CardHeader><CardTitle>Top Products by Revenue (Delivered)</CardTitle></CardHeader>
            <CardContent>
              {topProducts.length === 0 ? <p className="text-muted-foreground text-center py-6">No sales data</p> : (
                <>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={topProducts.slice(0, 6)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis type="number" tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} className="text-xs" />
                      <YAxis type="category" dataKey="name" width={120} className="text-xs" />
                      <Tooltip formatter={(v: number) => fmt(v)} />
                      <Bar dataKey="revenue" name="Revenue" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  <Table className="mt-4">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Units Sold</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                        <TableHead className="text-right">Profit</TableHead>
                        <TableHead className="text-right">Margin</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topProducts.map(p => (
                        <TableRow key={p.name}>
                          <TableCell className="font-medium">{p.name}</TableCell>
                          <TableCell className="text-right">{p.sold}</TableCell>
                          <TableCell className="text-right">{fmt(p.revenue)}</TableCell>
                          <TableCell className={`text-right ${p.profit >= 0 ? "text-green-600" : "text-destructive"}`}>{fmt(p.profit)}</TableCell>
                          <TableCell className="text-right">{pct(p.profit, p.revenue)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              )}
            </CardContent>
          </Card>

          {/* Low Stock */}
          {lowStockProds.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-destructive" /> Low Stock Products</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Stock</TableHead>
                      <TableHead className="text-right">MRP</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lowStockProds.map(p => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell>{p.category || "—"}</TableCell>
                        <TableCell className="text-right"><Badge variant="destructive">{p.stock}</Badge></TableCell>
                        <TableCell className="text-right">₹{p.mrp}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── SELLERS ── */}
        <TabsContent value="sellers" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Total Sellers" value={String(sellerProfiles.length)} icon={Store} />
            <StatCard label="Seller Products" value={String(sellerProducts.length)} icon={Package} sub={`${sellerProducts.filter(sp => sp.is_approved).length} approved`} />
            <StatCard label="Total Seller Revenue" value={fmt(sellerPerf.reduce((s, p) => s + p.revenue, 0))} icon={Wallet} color="text-primary" />
          </div>

          <Card>
            <CardHeader><CardTitle>Seller Performance</CardTitle></CardHeader>
            <CardContent>
              {sellerPerf.length === 0 ? <p className="text-muted-foreground text-center py-6">No sellers yet</p> : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Seller</TableHead>
                      <TableHead className="text-right">Delivered Orders</TableHead>
                      <TableHead className="text-right">Total Revenue</TableHead>
                      <TableHead className="text-right">Settled</TableHead>
                      <TableHead className="text-right">Wallet Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sellerPerf.map(s => (
                      <TableRow key={s.name}>
                        <TableCell className="font-medium">{s.name}</TableCell>
                        <TableCell className="text-right">{s.orders}</TableCell>
                        <TableCell className="text-right font-medium text-primary">{fmt(s.revenue)}</TableCell>
                        <TableCell className="text-right">{fmt(s.settled)}</TableCell>
                        <TableCell className="text-right font-semibold">{fmt(s.balance)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Unapproved seller products */}
          {sellerProducts.filter(sp => !sp.is_approved).length > 0 && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-destructive" /> Pending Approval</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Stock</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sellerProducts.filter(sp => !sp.is_approved).map(sp => (
                      <TableRow key={sp.id}>
                        <TableCell>{sp.name}</TableCell>
                        <TableCell className="text-right">{sp.stock}</TableCell>
                        <TableCell className="text-right">₹{sp.price}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── DELIVERY ── */}
        <TabsContent value="delivery" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Delivery Staff" value={String(deliveryStaff.length)} icon={Truck} />
            <StatCard label="Orders Delivered" value={String(delivered.length)} icon={CheckCircle} color="text-green-600" />
            <StatCard label="Orders Pending" value={String(pending.length)} icon={AlertTriangle} color="text-amber-500" />
          </div>

          <Card>
            <CardHeader><CardTitle>Delivery Staff Performance</CardTitle></CardHeader>
            <CardContent>
              {staffPerfArr.length === 0 ? <p className="text-muted-foreground text-center py-6">No delivery staff yet</p> : (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={staffPerfArr.slice(0, 8)}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="name" className="text-xs" tick={{ fontSize: 10 }} />
                      <YAxis className="text-xs" />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="delivered" name="Delivered" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="pending" name="Pending" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  <Table className="mt-4">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Staff</TableHead>
                        <TableHead className="text-right">Delivered</TableHead>
                        <TableHead className="text-right">Pending</TableHead>
                        <TableHead className="text-right">Success Rate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {staffPerfArr.map(s => {
                        const total = s.delivered + s.pending;
                        return (
                          <TableRow key={s.name}>
                            <TableCell className="font-medium">{s.name}</TableCell>
                            <TableCell className="text-right text-primary">{s.delivered}</TableCell>
                            <TableCell className="text-right text-muted-foreground">{s.pending}</TableCell>
                            <TableCell className="text-right">{total > 0 ? `${((s.delivered / total) * 100).toFixed(0)}%` : "—"}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── STOCK ── */}
        <TabsContent value="stock" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Total Stock Units" value={totalGodownStock.toLocaleString()} icon={Package} sub="Across all godowns" />
            <StatCard label="Stock Value (Cost)" value={fmt(totalStockValue)} icon={Wallet} color="text-green-600" />
            <StatCard label="Low Stock Items" value={String(lowStockProds.length)} icon={AlertTriangle} sub="≤5 units" color="text-amber-500" />
          </div>

          <Card>
            <CardHeader><CardTitle>Stock by Product (Godowns)</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Godown Stock</TableHead>
                    <TableHead className="text-right">Purchase Price</TableHead>
                    <TableHead className="text-right">Stock Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {godownStock.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No godown stock</TableCell></TableRow>
                  ) : (
                    // Aggregate by product_id
                    Object.values(
                      godownStock.reduce((acc, g) => {
                        const p = productMap[g.product_id];
                        const key = g.product_id;
                        if (!acc[key]) acc[key] = { name: p?.name || g.product_id, qty: 0, purchasePrice: g.purchase_price };
                        acc[key].qty += g.quantity;
                        return acc;
                      }, {} as Record<string, { name: string; qty: number; purchasePrice: number }>)
                    ).sort((a, b) => b.qty - a.qty).map(row => (
                      <TableRow key={row.name}>
                        <TableCell className="font-medium">{row.name}</TableCell>
                        <TableCell className="text-right">{row.qty}</TableCell>
                        <TableCell className="text-right">₹{row.purchasePrice}</TableCell>
                        <TableCell className="text-right font-semibold">{fmt(row.qty * row.purchasePrice)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── GEOGRAPHY ── */}
        <TabsContent value="geography" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Active Areas" value={String(lbPerfArr.length)} icon={Users} />
            <StatCard label="Top Area" value={lbPerfArr[0]?.name || "—"} icon={TrendingUp} sub={lbPerfArr[0] ? fmt(lbPerfArr[0].revenue) : ""} color="text-green-600" />
            <StatCard label="Top Area Orders" value={String(lbPerfArr[0]?.orders || 0)} icon={ShoppingCart} />
          </div>

          <Card>
            <CardHeader><CardTitle>Revenue by Local Body / Area</CardTitle></CardHeader>
            <CardContent>
              {lbPerfArr.length === 0 ? <p className="text-muted-foreground text-center py-6">No location data</p> : (
                <>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={lbPerfArr} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis type="number" tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} className="text-xs" />
                      <YAxis type="category" dataKey="name" width={130} className="text-xs" />
                      <Tooltip formatter={(v: number) => fmt(v)} />
                      <Bar dataKey="revenue" name="Revenue" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  <Table className="mt-4">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Area</TableHead>
                        <TableHead className="text-right">Orders</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                        <TableHead className="text-right">Avg Order Value</TableHead>
                        <TableHead className="text-right">% of Revenue</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lbPerfArr.map(lb => (
                        <TableRow key={lb.name}>
                          <TableCell className="font-medium">{lb.name}</TableCell>
                          <TableCell className="text-right">{lb.orders}</TableCell>
                          <TableCell className="text-right">{fmt(lb.revenue)}</TableCell>
                          <TableCell className="text-right">{lb.orders > 0 ? fmt(lb.revenue / lb.orders) : "—"}</TableCell>
                          <TableCell className="text-right">{pct(lb.revenue, grossRevenue)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── SEARCH ANALYTICS ── */}
        <TabsContent value="search" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total Searches" value={String(searchAnalytics.totalSearches)} icon={Search} sub="all time filtered" />
            <StatCard label="Unique Searchers" value={String(searchAnalytics.uniqueSearchers)} icon={Users} sub="distinct customers" />
            <StatCard label="Zero-Result Searches" value={String(searchAnalytics.zeroResultTotal)} icon={AlertTriangle} sub={pct(searchAnalytics.zeroResultTotal, searchAnalytics.totalSearches) + " of searches"} color="text-destructive" />
            <StatCard label="Avg Searches/User" value={searchAnalytics.uniqueSearchers > 0 ? (searchAnalytics.totalSearches / searchAnalytics.uniqueSearchers).toFixed(1) : "0"} icon={BarChart3} />
          </div>

          {/* Search Volume Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Daily Search Volume</CardTitle>
            </CardHeader>
            <CardContent>
              {searchAnalytics.dailyVolume.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No search data available</p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={searchAnalytics.dailyVolume}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="day" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip />
                    <Bar dataKey="searches" name="Searches" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Top Searches */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top Searches</CardTitle>
              </CardHeader>
              <CardContent>
                {searchAnalytics.topSearches.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No search data</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Search Query</TableHead>
                        <TableHead className="text-right">Count</TableHead>
                        <TableHead className="text-right">Avg Results</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {searchAnalytics.topSearches.map((s, i) => (
                        <TableRow key={s.query}>
                          <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                          <TableCell className="font-medium">{s.query}</TableCell>
                          <TableCell className="text-right">{s.count}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant={s.avgResults === 0 ? "destructive" : "secondary"}>{s.avgResults}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Zero-Result Searches */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  Zero-Result Searches
                </CardTitle>
              </CardHeader>
              <CardContent>
                {searchAnalytics.zeroResultSearches.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No zero-result searches found 🎉</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Search Query</TableHead>
                        <TableHead className="text-right">Times</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {searchAnalytics.zeroResultSearches.map((s, i) => (
                        <TableRow key={s.query}>
                          <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                          <TableCell className="font-medium">{s.query}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant="destructive">{s.count}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
};

export default ReportsPage;
