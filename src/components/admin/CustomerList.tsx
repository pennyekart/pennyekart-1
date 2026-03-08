import { useMemo, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, MapPin, ShoppingCart, Wallet, TrendingUp, CalendarDays, UserCheck, UserX, Activity, Download, Clock, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, subDays, formatDistanceToNow, differenceInDays, differenceInHours } from "date-fns";

interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  mobile_number: string | null;
  local_body_id: string | null;
  ward_number: number | null;
  local_body_name?: string | null;
  local_body_type?: string | null;
  district_name?: string | null;
  created_at?: string;
}

interface OrderSummary {
  user_id: string;
  order_count: number;
  total_spent: number;
  last_order_date: string | null;
}

interface WalletSummary {
  user_id: string;
  balance: number;
}

interface CustomerListProps {
  customers: Profile[];
  orderSummaries?: Map<string, OrderSummary>;
  walletSummaries?: Map<string, WalletSummary>;
}

type ActivityFilter = "all" | "active" | "inactive" | "new" | "never_ordered";
type InactivePeriod = "7" | "30" | "60" | "90";

const CustomerList = ({ customers, orderSummaries, walletSummaries }: CustomerListProps) => {
  const [filterPanchayath, setFilterPanchayath] = useState("all");
  const [filterWard, setFilterWard] = useState("all");
  const [sortBy, setSortBy] = useState<string>("newest");
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all");
  const [inactivePeriod, setInactivePeriod] = useState<InactivePeriod>("30");

  // Classify customers by activity
  const classifyCustomer = (c: Profile): "active" | "inactive" | "new" | "never_ordered" => {
    const o = orderSummaries?.get(c.user_id);
    if (!o || o.order_count === 0) {
      // New = signed up within last 7 days and never ordered
      const joinedDate = c.created_at ? new Date(c.created_at) : null;
      if (joinedDate && joinedDate >= subDays(new Date(), 7)) return "new";
      return "never_ordered";
    }
    if (o.last_order_date) {
      const lastOrder = new Date(o.last_order_date);
      const cutoff = subDays(new Date(), Number(inactivePeriod));
      return lastOrder >= cutoff ? "active" : "inactive";
    }
    return "inactive";
  };

  // Get unique panchayaths with counts
  const panchayathStats = useMemo(() => {
    const map = new Map<string, { name: string; type: string; count: number }>();
    customers.forEach((c) => {
      const key = c.local_body_id ?? "__none";
      const existing = map.get(key);
      if (existing) existing.count++;
      else map.set(key, { name: c.local_body_name ?? "Unknown", type: c.local_body_type ?? "", count: 1 });
    });
    return map;
  }, [customers]);

  const panchayathOptions = useMemo(() => {
    const opts: { id: string; name: string; type: string }[] = [];
    const seen = new Set<string>();
    customers.forEach((c) => {
      if (c.local_body_id && !seen.has(c.local_body_id)) {
        seen.add(c.local_body_id);
        opts.push({ id: c.local_body_id, name: c.local_body_name ?? "Unknown", type: c.local_body_type ?? "" });
      }
    });
    return opts.sort((a, b) => a.name.localeCompare(b.name));
  }, [customers]);

  const wardOptions = useMemo(() => {
    const wards = new Set<number>();
    customers.forEach((c) => {
      if (c.ward_number != null) {
        if (filterPanchayath === "all" || c.local_body_id === filterPanchayath) wards.add(c.ward_number);
      }
    });
    return Array.from(wards).sort((a, b) => a - b);
  }, [customers, filterPanchayath]);

  // Filter and sort
  const filtered = useMemo(() => {
    let result = customers.filter((c) => {
      if (filterPanchayath !== "all" && c.local_body_id !== filterPanchayath) return false;
      if (filterWard !== "all" && String(c.ward_number) !== filterWard) return false;
      if (activityFilter !== "all") {
        const status = classifyCustomer(c);
        if (activityFilter !== status) return false;
      }
      return true;
    });

    result.sort((a, b) => {
      const oA = orderSummaries?.get(a.user_id);
      const oB = orderSummaries?.get(b.user_id);
      const wA = walletSummaries?.get(a.user_id);
      const wB = walletSummaries?.get(b.user_id);
      switch (sortBy) {
        case "newest": return (b.created_at ?? "").localeCompare(a.created_at ?? "");
        case "oldest": return (a.created_at ?? "").localeCompare(b.created_at ?? "");
        case "most_orders": return (oB?.order_count ?? 0) - (oA?.order_count ?? 0);
        case "highest_spent": return (oB?.total_spent ?? 0) - (oA?.total_spent ?? 0);
        case "highest_wallet": return (wB?.balance ?? 0) - (wA?.balance ?? 0);
        case "last_active": return (oB?.last_order_date ?? "").localeCompare(oA?.last_order_date ?? "");
        default: return 0;
      }
    });
    return result;
  }, [customers, filterPanchayath, filterWard, sortBy, activityFilter, inactivePeriod, orderSummaries, walletSummaries]);

  // Activity counts (respecting location filters)
  const activityCounts = useMemo(() => {
    const locationFiltered = customers.filter((c) => {
      if (filterPanchayath !== "all" && c.local_body_id !== filterPanchayath) return false;
      if (filterWard !== "all" && String(c.ward_number) !== filterWard) return false;
      return true;
    });
    const counts = { all: locationFiltered.length, active: 0, inactive: 0, new: 0, never_ordered: 0 };
    locationFiltered.forEach((c) => {
      const status = classifyCustomer(c);
      counts[status]++;
    });
    return counts;
  }, [customers, filterPanchayath, filterWard, inactivePeriod, orderSummaries]);

  // Aggregate stats for filtered view
  const stats = useMemo(() => {
    let totalOrders = 0, totalRevenue = 0, activeCustomers = 0, totalWalletBalance = 0;
    filtered.forEach((c) => {
      const o = orderSummaries?.get(c.user_id);
      const w = walletSummaries?.get(c.user_id);
      if (o) {
        totalOrders += o.order_count;
        totalRevenue += o.total_spent;
        if (o.order_count > 0) activeCustomers++;
      }
      if (w) totalWalletBalance += w.balance;
    });
    return { totalOrders, totalRevenue, activeCustomers, totalWalletBalance };
  }, [filtered, orderSummaries, walletSummaries]);

  // Recent activity stats
  const recentActivity = useMemo(() => {
    const now = new Date();
    let today = 0, last7 = 0, last30 = 0;
    const recentCustomers: { name: string; ago: string; amount: number }[] = [];

    customers.forEach((c) => {
      const o = orderSummaries?.get(c.user_id);
      if (!o?.last_order_date) return;
      const lastDate = new Date(o.last_order_date);
      const days = differenceInDays(now, lastDate);
      if (days === 0) today++;
      if (days <= 7) last7++;
      if (days <= 30) last30++;
    });

    // Get 5 most recent customers
    const sortedByRecent = [...customers]
      .filter((c) => orderSummaries?.get(c.user_id)?.last_order_date)
      .sort((a, b) => {
        const dA = orderSummaries?.get(a.user_id)?.last_order_date ?? "";
        const dB = orderSummaries?.get(b.user_id)?.last_order_date ?? "";
        return dB.localeCompare(dA);
      })
      .slice(0, 5);

    sortedByRecent.forEach((c) => {
      const o = orderSummaries?.get(c.user_id)!;
      recentCustomers.push({
        name: c.full_name ?? "Unknown",
        ago: formatDistanceToNow(new Date(o.last_order_date!), { addSuffix: true }),
        amount: o.total_spent,
      });
    });

    return { today, last7, last30, recentCustomers };
  }, [customers, orderSummaries]);

  const topPanchayaths = useMemo(() => {
    return Array.from(panchayathStats.entries())
      .filter(([key]) => key !== "__none")
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 6);
  }, [panchayathStats]);

  const fmt = (n: number) => n >= 1000 ? `₹${(n / 1000).toFixed(1)}K` : `₹${n.toFixed(0)}`;

  const getRelativeTime = (dateStr: string | null | undefined) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    const hours = differenceInHours(new Date(), date);
    if (hours < 1) return "Just now";
    if (hours < 24) return `${hours}h ago`;
    const days = differenceInDays(new Date(), date);
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return format(date, "dd MMM");
  };

  const getStatusBadge = (c: Profile) => {
    const status = classifyCustomer(c);
    switch (status) {
      case "active": return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0 text-[10px]">Active</Badge>;
      case "inactive": return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0 text-[10px]">Inactive</Badge>;
      case "new": return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-0 text-[10px]">New</Badge>;
      case "never_ordered": return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0 text-[10px]">Never Ordered</Badge>;
    }
  };

  const exportCSV = () => {
    const headers = ["#", "Name", "Mobile", "Status", "Joined", "Orders", "Total Spent", "Last Order", "Wallet", "Panchayath", "Ward"];
    const rows = filtered.map((c, i) => {
      const o = orderSummaries?.get(c.user_id);
      const w = walletSummaries?.get(c.user_id);
      return [
        i + 1,
        c.full_name ?? "",
        c.mobile_number ?? "",
        classifyCustomer(c),
        c.created_at ? format(new Date(c.created_at), "dd MMM yyyy") : "",
        o?.order_count ?? 0,
        o?.total_spent?.toFixed(0) ?? "0",
        o?.last_order_date ? format(new Date(o.last_order_date), "dd MMM yyyy") : "",
        w?.balance?.toFixed(0) ?? "0",
        c.local_body_name ?? "",
        c.ward_number ?? "",
      ].join(",");
    });
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `customers_${activityFilter}_${format(new Date(), "yyyyMMdd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Analytics Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" /> Total Customers
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{filtered.length}</p>
            {filtered.length !== customers.length && <p className="text-[10px] text-muted-foreground">of {customers.length}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <ShoppingCart className="h-3.5 w-3.5" /> Total Orders
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{stats.totalOrders}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" /> Total Revenue
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{fmt(stats.totalRevenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <UserCheck className="h-3.5 w-3.5" /> Active Buyers
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{stats.activeCustomers}</p>
            <p className="text-[10px] text-muted-foreground">
              {filtered.length > 0 ? ((stats.activeCustomers / filtered.length) * 100).toFixed(0) : 0}% of filtered
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Wallet className="h-3.5 w-3.5" /> Wallet Balance
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{fmt(stats.totalWalletBalance)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity Tracker */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5" /> Recent Order Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-emerald-600">{recentActivity.today}</p>
                <p className="text-[10px] text-muted-foreground">Today</p>
              </div>
              <div className="h-8 w-px bg-border" />
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">{recentActivity.last7}</p>
                <p className="text-[10px] text-muted-foreground">Last 7 days</p>
              </div>
              <div className="h-8 w-px bg-border" />
              <div className="text-center">
                <p className="text-2xl font-bold text-amber-600">{recentActivity.last30}</p>
                <p className="text-[10px] text-muted-foreground">Last 30 days</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Latest Customer Orders
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {recentActivity.recentCustomers.length > 0 ? (
              <div className="space-y-1.5">
                {recentActivity.recentCustomers.map((rc, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="font-medium truncate max-w-[140px]">{rc.name}</span>
                    <span className="text-muted-foreground">{rc.ago}</span>
                    <Badge variant="outline" className="font-mono text-[10px]">₹{rc.amount.toFixed(0)}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No recent orders</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Activity Status Tabs */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
              <Activity className="h-4 w-4" /> Activity Report
            </div>
            <Tabs value={activityFilter} onValueChange={(v) => setActivityFilter(v as ActivityFilter)}>
              <TabsList className="h-8">
                <TabsTrigger value="all" className="text-xs h-7 px-3">
                  All <Badge variant="outline" className="ml-1 text-[10px] px-1.5">{activityCounts.all}</Badge>
                </TabsTrigger>
                <TabsTrigger value="active" className="text-xs h-7 px-3">
                  <UserCheck className="h-3 w-3 mr-1" /> Active <Badge className="ml-1 text-[10px] px-1.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0">{activityCounts.active}</Badge>
                </TabsTrigger>
                <TabsTrigger value="inactive" className="text-xs h-7 px-3">
                  <UserX className="h-3 w-3 mr-1" /> Inactive <Badge className="ml-1 text-[10px] px-1.5 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0">{activityCounts.inactive}</Badge>
                </TabsTrigger>
                <TabsTrigger value="new" className="text-xs h-7 px-3">
                  New <Badge className="ml-1 text-[10px] px-1.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-0">{activityCounts.new}</Badge>
                </TabsTrigger>
                <TabsTrigger value="never_ordered" className="text-xs h-7 px-3">
                  Never Ordered <Badge className="ml-1 text-[10px] px-1.5 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0">{activityCounts.never_ordered}</Badge>
                </TabsTrigger>
              </TabsList>
            </Tabs>
            {(activityFilter === "inactive" || activityFilter === "all") && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Inactive if no order in:</span>
                <Select value={inactivePeriod} onValueChange={(v) => setInactivePeriod(v as InactivePeriod)}>
                  <SelectTrigger className="w-24 h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">7 days</SelectItem>
                    <SelectItem value="30">30 days</SelectItem>
                    <SelectItem value="60">60 days</SelectItem>
                    <SelectItem value="90">90 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button variant="outline" size="sm" className="ml-auto h-7 text-xs gap-1" onClick={exportCSV}>
              <Download className="h-3 w-3" /> Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Top Panchayaths */}
      {topPanchayaths.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
          {topPanchayaths.map(([key, val]) => (
            <Card
              key={key}
              className={`cursor-pointer transition-colors ${filterPanchayath === key ? "border-primary bg-primary/5" : "hover:border-primary/50"}`}
              onClick={() => { setFilterPanchayath(filterPanchayath === key ? "all" : key); setFilterWard("all"); }}
            >
              <CardHeader className="pb-1 pt-3 px-3">
                <CardTitle className="text-[10px] font-medium text-muted-foreground flex items-center gap-1 truncate">
                  <MapPin className="h-3 w-3 shrink-0" /> {val.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <p className="text-lg font-bold">{val.count}</p>
                <p className="text-[10px] text-muted-foreground">{val.type}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Panchayath:</span>
          <Select value={filterPanchayath} onValueChange={(v) => { setFilterPanchayath(v); setFilterWard("all"); }}>
            <SelectTrigger className="w-48"><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Panchayaths</SelectItem>
              {panchayathOptions.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name} ({p.type})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Ward:</span>
          <Select value={filterWard} onValueChange={setFilterWard}>
            <SelectTrigger className="w-32"><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Wards</SelectItem>
              {wardOptions.map((w) => (
                <SelectItem key={w} value={String(w)}>Ward {w}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Sort:</span>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="oldest">Oldest First</SelectItem>
              <SelectItem value="most_orders">Most Orders</SelectItem>
              <SelectItem value="highest_spent">Highest Spent</SelectItem>
              <SelectItem value="highest_wallet">Highest Wallet</SelectItem>
              <SelectItem value="last_active">Last Active</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {(filterPanchayath !== "all" || filterWard !== "all" || activityFilter !== "all") && (
          <Badge variant="secondary" className="cursor-pointer" onClick={() => { setFilterPanchayath("all"); setFilterWard("all"); setActivityFilter("all"); }}>
            Clear all filters ✕
          </Badge>
        )}
        <Badge variant="outline" className="ml-auto">{filtered.length} customers</Badge>
      </div>

      {/* Table */}
      <div className="admin-table-wrap">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Mobile</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-center">Orders</TableHead>
              <TableHead className="text-right">Total Spent</TableHead>
              <TableHead>Last Order</TableHead>
              <TableHead className="text-right">Wallet</TableHead>
              <TableHead>Panchayath</TableHead>
              <TableHead>Ward</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((c, i) => {
              const o = orderSummaries?.get(c.user_id);
              const w = walletSummaries?.get(c.user_id);
              return (
                <TableRow key={c.id}>
                  <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="font-medium">{c.full_name ?? "—"}</TableCell>
                  <TableCell>{c.mobile_number ?? "—"}</TableCell>
                  <TableCell>{getStatusBadge(c)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {c.created_at ? (
                      <span className="flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />
                        {format(new Date(c.created_at), "dd MMM yyyy")}
                      </span>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-center">
                    {o && o.order_count > 0 ? (
                      <Badge variant="secondary">{o.order_count}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {o && o.total_spent > 0 ? `₹${o.total_spent.toFixed(0)}` : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {o?.last_order_date ? format(new Date(o.last_order_date), "dd MMM yyyy") : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {w && w.balance > 0 ? (
                      <Badge variant="outline" className="font-mono">₹{w.balance.toFixed(0)}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">₹0</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {c.local_body_name ? (
                      <span className="text-xs">{c.local_body_name} <span className="text-muted-foreground">({c.local_body_type})</span></span>
                    ) : "—"}
                  </TableCell>
                  <TableCell>{c.ward_number ?? "—"}</TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={11} className="text-center text-muted-foreground py-8">No customers found</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default CustomerList;
