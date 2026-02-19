import { useEffect, useState, useMemo } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  AlertTriangle, Package, TrendingUp, TrendingDown, ChevronDown, ChevronRight,
  CalendarIcon, Search, Filter, BarChart3, AlertCircle, CheckCircle2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Godown {
  id: string;
  name: string;
  godown_type: string;
  is_active: boolean;
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
}

interface Product {
  id: string;
  name: string;
  category: string | null;
  price: number;
  mrp: number;
  image_url: string | null;
  is_active: boolean;
  stock: number;
}

interface OrderItem {
  id: string;
  quantity: number;
}

interface AggregatedStock {
  product: Product;
  totalQuantity: number;
  totalValue: number;
  godownBreakdown: { godown: Godown; quantity: number; batches: StockItem[] }[];
  reorderLevel: number;
  status: "in_stock" | "low_stock" | "out_of_stock";
  orderCount: number;
  orderQuantity: number;
  demandScore: number;
}

const StockControlPage = () => {
  const { toast } = useToast();
  const [godowns, setGodowns] = useState<Godown[]>([]);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<{ items: unknown; created_at: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [godownTypeFilter, setGodownTypeFilter] = useState("all");
  const [godownFilter, setGodownFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [stockStatusFilter, setStockStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [godownRes, stockRes, productRes, orderRes] = await Promise.all([
      supabase.from("godowns").select("*"),
      supabase.from("godown_stock").select("*"),
      supabase.from("products").select("*"),
      supabase.from("orders").select("items, created_at").order("created_at", { ascending: false }).limit(1000),
    ]);
    if (godownRes.data) setGodowns(godownRes.data);
    if (stockRes.data) setStock(stockRes.data);
    if (productRes.data) setProducts(productRes.data);
    if (orderRes.data) setOrders(orderRes.data);
    setLoading(false);
  };

  // Calculate order-based demand for each product
  const orderDemand = useMemo(() => {
    const demand: Record<string, { count: number; quantity: number }> = {};
    orders.forEach((order) => {
      const items = order.items as OrderItem[] | null;
      if (!Array.isArray(items)) return;
      items.forEach((item) => {
        if (!demand[item.id]) demand[item.id] = { count: 0, quantity: 0 };
        demand[item.id].count += 1;
        demand[item.id].quantity += item.quantity || 1;
      });
    });
    return demand;
  }, [orders]);

  // Aggregate stock per product
  const aggregatedStock: AggregatedStock[] = useMemo(() => {
    const productMap = new Map(products.map((p) => [p.id, p]));
    const godownMap = new Map(godowns.map((g) => [g.id, g]));
    const grouped: Record<string, StockItem[]> = {};

    stock.forEach((s) => {
      if (!grouped[s.product_id]) grouped[s.product_id] = [];
      grouped[s.product_id].push(s);
    });

    // Include all products (even those not in godown_stock)
    const allProductIds = new Set([...Object.keys(grouped), ...products.map((p) => p.id)]);

    return Array.from(allProductIds).map((productId) => {
      const product = productMap.get(productId);
      if (!product) return null;

      const items = grouped[productId] || [];
      const totalQuantity = items.reduce((sum, s) => sum + s.quantity, 0);
      const totalValue = items.reduce((sum, s) => sum + s.quantity * s.purchase_price, 0);

      // Group by godown
      const byGodown: Record<string, StockItem[]> = {};
      items.forEach((s) => {
        if (!byGodown[s.godown_id]) byGodown[s.godown_id] = [];
        byGodown[s.godown_id].push(s);
      });

      const godownBreakdown = Object.entries(byGodown).map(([gId, batches]) => ({
        godown: godownMap.get(gId) || { id: gId, name: "Unknown", godown_type: "micro", is_active: true },
        quantity: batches.reduce((s, b) => s + b.quantity, 0),
        batches,
      }));

      const demand = orderDemand[productId] || { count: 0, quantity: 0 };
      // Auto-calculate reorder level: avg daily demand * 7 days safety stock, min 5
      const avgDailyDemand = orders.length > 0 ? demand.quantity / Math.max(30, 1) : 0;
      const reorderLevel = Math.max(5, Math.ceil(avgDailyDemand * 7));

      const status: AggregatedStock["status"] =
        totalQuantity === 0 ? "out_of_stock" : totalQuantity <= reorderLevel ? "low_stock" : "in_stock";

      const demandScore = demand.count + demand.quantity * 0.5;

      return {
        product,
        totalQuantity,
        totalValue,
        godownBreakdown,
        reorderLevel,
        status,
        orderCount: demand.count,
        orderQuantity: demand.quantity,
        demandScore,
      };
    }).filter(Boolean) as AggregatedStock[];
  }, [products, stock, godowns, orderDemand, orders.length]);

  // Filter logic
  const filteredStock = useMemo(() => {
    let result = aggregatedStock;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((s) => s.product.name.toLowerCase().includes(q));
    }
    if (categoryFilter !== "all") {
      result = result.filter((s) => s.product.category === categoryFilter);
    }
    if (stockStatusFilter !== "all") {
      result = result.filter((s) => s.status === stockStatusFilter);
    }
    if (godownTypeFilter !== "all") {
      result = result.filter((s) =>
        s.godownBreakdown.some((g) => g.godown.godown_type === godownTypeFilter)
      );
    }
    if (godownFilter !== "all") {
      result = result.filter((s) =>
        s.godownBreakdown.some((g) => g.godown.id === godownFilter)
      );
    }
    if (dateFrom) {
      result = result.filter((s) =>
        s.godownBreakdown.some((g) =>
          g.batches.some((b) => new Date(b.created_at) >= dateFrom)
        )
      );
    }
    if (dateTo) {
      const endDate = new Date(dateTo);
      endDate.setHours(23, 59, 59);
      result = result.filter((s) =>
        s.godownBreakdown.some((g) =>
          g.batches.some((b) => new Date(b.created_at) <= endDate)
        )
      );
    }

    return result;
  }, [aggregatedStock, searchQuery, categoryFilter, stockStatusFilter, godownTypeFilter, godownFilter, dateFrom, dateTo]);

  // Stats
  const stats = useMemo(() => {
    const outOfStock = aggregatedStock.filter((s) => s.status === "out_of_stock").length;
    const lowStock = aggregatedStock.filter((s) => s.status === "low_stock").length;
    const inStock = aggregatedStock.filter((s) => s.status === "in_stock").length;
    const totalValue = aggregatedStock.reduce((sum, s) => sum + s.totalValue, 0);
    return { outOfStock, lowStock, inStock, totalValue };
  }, [aggregatedStock]);

  const categories = useMemo(() => {
    return [...new Set(products.map((p) => p.category).filter(Boolean))] as string[];
  }, [products]);

  const toggleExpand = (productId: string) => {
    setExpandedProducts((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  const getStatusBadge = (status: AggregatedStock["status"]) => {
    switch (status) {
      case "out_of_stock":
        return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" />Out of Stock</Badge>;
      case "low_stock":
        return <Badge className="gap-1 bg-amber-500 hover:bg-amber-600"><AlertTriangle className="h-3 w-3" />Low Stock</Badge>;
      case "in_stock":
        return <Badge className="gap-1 bg-emerald-500 hover:bg-emerald-600"><CheckCircle2 className="h-3 w-3" />In Stock</Badge>;
    }
  };

  // Demand analytics
  const demandedItems = useMemo(() => {
    return [...filteredStock].sort((a, b) => b.demandScore - a.demandScore).slice(0, 20);
  }, [filteredStock]);

  const nonDemandedItems = useMemo(() => {
    return [...filteredStock].sort((a, b) => a.demandScore - b.demandScore).slice(0, 20);
  }, [filteredStock]);

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Stock Control</h1>
          <p className="text-sm text-muted-foreground">Full stock overview, warnings, and demand analytics</p>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="rounded-lg bg-emerald-100 p-3 dark:bg-emerald-900">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">In Stock</p>
                <p className="text-2xl font-bold">{stats.inStock}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="rounded-lg bg-amber-100 p-3 dark:bg-amber-900">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Low Stock</p>
                <p className="text-2xl font-bold">{stats.lowStock}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="rounded-lg bg-destructive/10 p-3">
                <AlertCircle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Out of Stock</p>
                <p className="text-2xl font-bold text-destructive">{stats.outOfStock}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="rounded-lg bg-primary/10 p-3">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Value</p>
                <p className="text-2xl font-bold">₹{stats.totalValue.toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Stock Out Warnings */}
        {(stats.outOfStock > 0 || stats.lowStock > 0) && (
          <Card className="border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-5 w-5" /> Stock Warnings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {aggregatedStock
                  .filter((s) => s.status !== "in_stock")
                  .sort((a, b) => (a.status === "out_of_stock" ? -1 : 1))
                  .slice(0, 10)
                  .map((s) => (
                    <div key={s.product.id} className="flex items-center justify-between rounded-lg bg-background/80 px-3 py-2">
                      <div className="flex items-center gap-2">
                        {getStatusBadge(s.status)}
                        <span className="font-medium">{s.product.name}</span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Qty: <span className="font-bold">{s.totalQuantity}</span> / Reorder: {s.reorderLevel}
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="stock" className="space-y-4">
          <TabsList>
            <TabsTrigger value="stock" className="gap-1"><Package className="h-4 w-4" />Stock Report</TabsTrigger>
            <TabsTrigger value="analytics" className="gap-1"><BarChart3 className="h-4 w-4" />Demand Analytics</TabsTrigger>
          </TabsList>

          {/* STOCK REPORT TAB */}
          <TabsContent value="stock" className="space-y-4">
            {/* Filters */}
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="min-w-[200px] flex-1">
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">Search Product</label>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by name..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </div>
                  <div className="min-w-[140px]">
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">Godown Type</label>
                    <Select value={godownTypeFilter} onValueChange={setGodownTypeFilter}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="micro">Micro</SelectItem>
                        <SelectItem value="local">Local</SelectItem>
                        <SelectItem value="area">Area</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="min-w-[160px]">
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">Godown</label>
                    <Select value={godownFilter} onValueChange={setGodownFilter}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Godowns</SelectItem>
                        {godowns.map((g) => (
                          <SelectItem key={g.id} value={g.id}>{g.name} ({g.godown_type})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="min-w-[140px]">
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">Category</label>
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {categories.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="min-w-[140px]">
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">Stock Status</label>
                    <Select value={stockStatusFilter} onValueChange={setStockStatusFilter}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="in_stock">In Stock</SelectItem>
                        <SelectItem value="low_stock">Low Stock</SelectItem>
                        <SelectItem value="out_of_stock">Out of Stock</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">From</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-[130px] justify-start text-left text-xs", !dateFrom && "text-muted-foreground")}>
                          <CalendarIcon className="mr-1 h-3 w-3" />
                          {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "Start date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className="p-3 pointer-events-auto" />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">To</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-[130px] justify-start text-left text-xs", !dateTo && "text-muted-foreground")}>
                          <CalendarIcon className="mr-1 h-3 w-3" />
                          {dateTo ? format(dateTo, "dd/MM/yyyy") : "End date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className="p-3 pointer-events-auto" />
                      </PopoverContent>
                    </Popover>
                  </div>
                  {(searchQuery || godownTypeFilter !== "all" || godownFilter !== "all" || categoryFilter !== "all" || stockStatusFilter !== "all" || dateFrom || dateTo) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSearchQuery("");
                        setGodownTypeFilter("all");
                        setGodownFilter("all");
                        setCategoryFilter("all");
                        setStockStatusFilter("all");
                        setDateFrom(undefined);
                        setDateTo(undefined);
                      }}
                    >
                      Clear Filters
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Stock Table */}
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Total Qty</TableHead>
                      <TableHead className="text-right">Reorder Level</TableHead>
                      <TableHead className="text-right">Stock Value</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Orders</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStock.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                          No stock data found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredStock.map((item) => {
                        const isExpanded = expandedProducts.has(item.product.id);
                        const fillPct = item.reorderLevel > 0 ? Math.min(100, (item.totalQuantity / (item.reorderLevel * 3)) * 100) : 100;
                        return (
                          <Collapsible key={item.product.id} asChild open={isExpanded} onOpenChange={() => toggleExpand(item.product.id)}>
                            <>
                              <CollapsibleTrigger asChild>
                                <TableRow className="cursor-pointer hover:bg-muted/50">
                                  <TableCell>
                                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      {item.product.image_url && (
                                        <img src={item.product.image_url} alt="" className="h-8 w-8 rounded object-cover" />
                                      )}
                                      <span className="font-medium">{item.product.name}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-muted-foreground">{item.product.category || "—"}</TableCell>
                                  <TableCell className="text-right font-bold">{item.totalQuantity}</TableCell>
                                  <TableCell className="text-right">{item.reorderLevel}</TableCell>
                                  <TableCell className="text-right">₹{item.totalValue.toLocaleString()}</TableCell>
                                  <TableCell>{getStatusBadge(item.status)}</TableCell>
                                  <TableCell className="text-right">{item.orderCount}</TableCell>
                                </TableRow>
                              </CollapsibleTrigger>
                              <CollapsibleContent asChild>
                                <TableRow className="bg-muted/30">
                                  <TableCell colSpan={8} className="p-4">
                                    <div className="space-y-3">
                                      <div className="flex items-center gap-4">
                                        <span className="text-xs text-muted-foreground">Stock Level</span>
                                        <div className="w-48">
                                          <Progress
                                            value={fillPct}
                                            className={cn(
                                              "h-2",
                                              item.status === "out_of_stock" && "[&>div]:bg-destructive",
                                              item.status === "low_stock" && "[&>div]:bg-amber-500",
                                              item.status === "in_stock" && "[&>div]:bg-emerald-500"
                                            )}
                                          />
                                        </div>
                                        <span className="text-xs font-medium">
                                          {item.totalQuantity} / {item.reorderLevel * 3} (reorder at {item.reorderLevel})
                                        </span>
                                      </div>
                                      <p className="text-xs text-muted-foreground">
                                        Ordered {item.orderCount} time(s), total {item.orderQuantity} units demanded
                                      </p>
                                      {item.godownBreakdown.length > 0 ? (
                                        <Table>
                                          <TableHeader>
                                            <TableRow>
                                              <TableHead>Godown</TableHead>
                                              <TableHead>Type</TableHead>
                                              <TableHead className="text-right">Qty</TableHead>
                                              <TableHead>Batch</TableHead>
                                              <TableHead>Purchase #</TableHead>
                                              <TableHead>Purchase Price</TableHead>
                                              <TableHead>Expiry</TableHead>
                                              <TableHead>Date Added</TableHead>
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {item.godownBreakdown.flatMap((g) =>
                                              g.batches.map((b) => (
                                                <TableRow key={b.id}>
                                                  <TableCell className="text-xs">{g.godown.name}</TableCell>
                                                  <TableCell>
                                                    <Badge variant="outline" className="text-xs">{g.godown.godown_type}</Badge>
                                                  </TableCell>
                                                  <TableCell className="text-right font-medium">{b.quantity}</TableCell>
                                                  <TableCell className="text-xs">{b.batch_number || "—"}</TableCell>
                                                  <TableCell className="text-xs">{b.purchase_number || "—"}</TableCell>
                                                  <TableCell className="text-xs">₹{b.purchase_price}</TableCell>
                                                  <TableCell className="text-xs">{b.expiry_date || "—"}</TableCell>
                                                  <TableCell className="text-xs">{format(new Date(b.created_at), "dd/MM/yyyy")}</TableCell>
                                                </TableRow>
                                              ))
                                            )}
                                          </TableBody>
                                        </Table>
                                      ) : (
                                        <p className="text-sm text-muted-foreground">No stock entries in any godown</p>
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              </CollapsibleContent>
                            </>
                          </Collapsible>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* DEMAND ANALYTICS TAB */}
          <TabsContent value="analytics" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Most Demanded */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <TrendingUp className="h-5 w-5 text-emerald-500" /> Most Demanded Items
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Orders</TableHead>
                        <TableHead className="text-right">Qty Demanded</TableHead>
                        <TableHead className="text-right">In Stock</TableHead>
                        <TableHead>Score</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {demandedItems.map((item, idx) => (
                        <TableRow key={item.product.id}>
                          <TableCell className="font-bold text-muted-foreground">{idx + 1}</TableCell>
                          <TableCell className="font-medium">{item.product.name}</TableCell>
                          <TableCell className="text-right">{item.orderCount}</TableCell>
                          <TableCell className="text-right">{item.orderQuantity}</TableCell>
                          <TableCell className="text-right">{item.totalQuantity}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress value={demandedItems[0]?.demandScore ? (item.demandScore / demandedItems[0].demandScore) * 100 : 0} className="h-2 w-16 [&>div]:bg-emerald-500" />
                              <span className="text-xs">{item.demandScore.toFixed(0)}</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {demandedItems.length === 0 && (
                        <TableRow><TableCell colSpan={6} className="py-6 text-center text-muted-foreground">No order data</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Least Demanded / Non-moving */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <TrendingDown className="h-5 w-5 text-destructive" /> Non-Demanded / Slow Items
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Orders</TableHead>
                        <TableHead className="text-right">Qty Demanded</TableHead>
                        <TableHead className="text-right">In Stock</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {nonDemandedItems.map((item, idx) => (
                        <TableRow key={item.product.id}>
                          <TableCell className="font-bold text-muted-foreground">{idx + 1}</TableCell>
                          <TableCell className="font-medium">{item.product.name}</TableCell>
                          <TableCell className="text-right">{item.orderCount}</TableCell>
                          <TableCell className="text-right">{item.orderQuantity}</TableCell>
                          <TableCell className="text-right">{item.totalQuantity}</TableCell>
                          <TableCell>
                            {item.demandScore === 0 ? (
                              <Badge variant="destructive">No Demand</Badge>
                            ) : (
                              <Badge variant="outline">Low Demand</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {nonDemandedItems.length === 0 && (
                        <TableRow><TableCell colSpan={6} className="py-6 text-center text-muted-foreground">No data</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default StockControlPage;
