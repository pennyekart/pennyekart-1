import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend
} from "recharts";
import {
  TrendingUp, TrendingDown, ShoppingCart, Package, Users, Wallet,
  Store, Truck, BarChart3, AlertTriangle, CheckCircle
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
interface Profile { user_id: string; full_name: string | null; user_type: string; local_body_id: string | null; }
interface SellerWallet { seller_id: string; balance: number; }
interface SellerWalletTxn { seller_id: string; type: string; amount: number; description: string | null; }
interface LocalBody { id: string; name: string; }

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [
        { data: ord }, { data: prod }, { data: sprod }, { data: gstock },
        { data: prof }, { data: sw }, { data: stxn }, { data: lb }
      ] = await Promise.all([
        supabase.from("orders").select("id,status,total,items,created_at,user_id,seller_id,assigned_delivery_staff_id,godown_id").order("created_at", { ascending: false }),
        supabase.from("products").select("id,name,price,purchase_rate,mrp,stock,is_active,category"),
        supabase.from("seller_products").select("id,name,price,purchase_rate,stock,seller_id,is_approved"),
        supabase.from("godown_stock").select("id,quantity,product_id,purchase_price,godown_id"),
        supabase.from("profiles").select("user_id,full_name,user_type,local_body_id"),
        supabase.from("seller_wallets").select("seller_id,balance"),
        supabase.from("seller_wallet_transactions").select("seller_id,type,amount,description"),
        supabase.from("locations_local_bodies").select("id,name"),
      ]);
      setOrders((ord ?? []) as Order[]);
      setProducts((prod ?? []) as Product[]);
      setSellerProducts((sprod ?? []) as SellerProduct[]);
      setGodownStock((gstock ?? []) as GodownStock[]);
      setProfiles((prof ?? []) as Profile[]);
      setSellerWallets((sw ?? []) as SellerWallet[]);
      setSellerTxns((stxn ?? []) as SellerWalletTxn[]);
      setLocalBodies((lb ?? []) as LocalBody[]);
      setLoading(false);
    };
    load();
  }, []);

  // ─── Derived Data ─────────────────────────────────────────────────────────
  const delivered = orders.filter(o => o.status === "delivered");
  const cancelled = orders.filter(o => o.status === "cancelled");
  const pending = orders.filter(o => !["delivered", "cancelled"].includes(o.status));

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
      <h1 className="mb-6 text-2xl font-bold">Reports & Analytics</h1>

      <Tabs defaultValue="overview">
        <TabsList className="mb-6 flex flex-wrap gap-1 h-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="pl">P&L</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="sellers">Sellers</TabsTrigger>
          <TabsTrigger value="delivery">Delivery</TabsTrigger>
          <TabsTrigger value="stock">Stock</TabsTrigger>
          <TabsTrigger value="geography">Geography</TabsTrigger>
        </TabsList>

        {/* ── OVERVIEW ── */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total Orders" value={String(orders.length)} icon={ShoppingCart} sub={`${delivered.length} delivered`} />
            <StatCard label="Gross Revenue" value={fmt(grossRevenue)} icon={TrendingUp} sub={`from ${delivered.length} deliveries`} color="text-green-600" />
            <StatCard label="Gross Profit" value={fmt(grossProfit)} icon={BarChart3} sub={`${grossMargin.toFixed(1)}% margin`} color={grossProfit >= 0 ? "text-green-600" : "text-destructive"} />
            <StatCard label="Cancellations" value={String(cancelled.length)} icon={TrendingDown} sub={pct(cancelled.length, orders.length) + " of orders"} color="text-destructive" />
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

          <Card>
            <CardHeader><CardTitle>P&L Summary</CardTitle></CardHeader>
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
          </Card>

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
      </Tabs>
    </AdminLayout>
  );
};

export default ReportsPage;
