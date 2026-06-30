import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users, Package, ShoppingCart, Image, Store, Truck,
  Clock, CheckCircle2, XCircle, RotateCcw, IndianRupee,
  TrendingUp, Wallet, Gift, Bell, Grid3X3, Warehouse, MapPin, Handshake,
  Loader2, ExternalLink,
} from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import { usePermissions } from "@/hooks/usePermissions";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

type DetailKey =
  | "revenueToday" | "revenueMonth" | "revenueTotal" | "walletBalance"
  | "orders" | "ordersToday" | "pendingOrders" | "processingOrders"
  | "deliveredOrders" | "cancelledOrders" | "returnOrders"
  | "users" | "newUsersToday" | "deliveryStaff" | "sellers"
  | "products" | "sellerProducts" | "categories" | "banners"
  | "godowns" | "localBodies" | "activeFlashSales"
  | "activeNotifications" | "pennyPrimeCoupons";

interface StatCard {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  perm: string | null;
  detailKey?: DetailKey;
  navigateTo?: string;
}

const Dashboard = () => {
  const { hasPermission, isSuperAdmin } = usePermissions();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    users: 0, products: 0, sellerProducts: 0, orders: 0, banners: 0,
    deliveryStaff: 0, sellers: 0,
    pendingOrders: 0, processingOrders: 0, deliveredOrders: 0,
    cancelledOrders: 0, returnOrders: 0,
    revenueToday: 0, revenueMonth: 0, revenueTotal: 0,
    newUsersToday: 0, ordersToday: 0,
    categories: 0, godowns: 0, localBodies: 0,
    activeFlashSales: 0, activeNotifications: 0,
    walletBalance: 0, pennyPrimeCoupons: 0,
  });

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailTitle, setDetailTitle] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailRows, setDetailRows] = useState<any[]>([]);
  const [detailColumns, setDetailColumns] = useState<{ key: string; label: string; render?: (v: any, row: any) => any }[]>([]);
  const [detailNavTo, setDetailNavTo] = useState<string | undefined>(undefined);

  const canSee = (perm: string | null) => {
    if (!perm) return true;
    return isSuperAdmin || hasPermission(perm);
  };

  useEffect(() => {
    const fetchStats = async () => {
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

      const tasks: { key: string; run: () => PromiseLike<any> }[] = [];

      if (canSee("read_users")) {
        tasks.push({ key: "users", run: () => supabase.from("profiles").select("id", { count: "exact", head: true }) });
        tasks.push({ key: "deliveryStaff", run: () => supabase.from("profiles").select("id", { count: "exact", head: true }).eq("user_type", "delivery_staff") });
        tasks.push({ key: "sellers", run: () => supabase.from("profiles").select("id", { count: "exact", head: true }).eq("user_type", "selling_partner") });
        tasks.push({ key: "newUsersToday", run: () => supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", todayStart.toISOString()) });
      }
      if (canSee("read_products")) {
        tasks.push({ key: "products", run: () => supabase.from("products").select("id", { count: "exact", head: true }) });
        tasks.push({ key: "sellerProducts", run: () => supabase.from("seller_products").select("id", { count: "exact", head: true }) });
      }
      if (canSee("read_orders")) {
        tasks.push({ key: "orders", run: () => supabase.from("orders").select("id", { count: "exact", head: true }) });
        tasks.push({ key: "pendingOrders", run: () => supabase.from("orders").select("id", { count: "exact", head: true }).in("status", ["pending", "seller_confirmation_pending"]) });
        tasks.push({ key: "processingOrders", run: () => supabase.from("orders").select("id", { count: "exact", head: true }).in("status", ["confirmed", "processing", "accepted", "packed", "seller_packed", "pickup", "shipped", "seller_accepted", "seller_shipped", "self_delivery_pickup", "self_delivery_shipped"]) });
        tasks.push({ key: "deliveredOrders", run: () => supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "delivered") });
        tasks.push({ key: "cancelledOrders", run: () => supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "cancelled") });
        tasks.push({ key: "returnOrders", run: () => supabase.from("orders").select("id", { count: "exact", head: true }).in("status", ["return_requested", "return_confirmed"]) });
        tasks.push({ key: "ordersToday", run: () => supabase.from("orders").select("id", { count: "exact", head: true }).gte("created_at", todayStart.toISOString()) });
        tasks.push({ key: "revenueTotal", run: () => supabase.from("orders").select("total").eq("status", "delivered") });
        tasks.push({ key: "revenueToday", run: () => supabase.from("orders").select("total").eq("status", "delivered").gte("created_at", todayStart.toISOString()) });
        tasks.push({ key: "revenueMonth", run: () => supabase.from("orders").select("total").eq("status", "delivered").gte("created_at", monthStart.toISOString()) });
      }
      if (canSee("read_banners")) {
        tasks.push({ key: "banners", run: () => supabase.from("banners").select("id", { count: "exact", head: true }) });
      }
      if (canSee("read_categories")) {
        tasks.push({ key: "categories", run: () => supabase.from("categories").select("id", { count: "exact", head: true }) });
      }
      if (canSee("read_godowns")) {
        tasks.push({ key: "godowns", run: () => supabase.from("godowns").select("id", { count: "exact", head: true }) });
      }
      if (canSee("read_locations")) {
        tasks.push({ key: "localBodies", run: () => supabase.from("locations_local_bodies").select("id", { count: "exact", head: true }) });
      }
      if (canSee("read_products")) {
        tasks.push({ key: "activeFlashSales", run: () => supabase.from("flash_sales").select("id", { count: "exact", head: true }).eq("is_active", true) });
      }
      if (canSee("read_settings")) {
        tasks.push({ key: "activeNotifications", run: () => supabase.from("notifications").select("id", { count: "exact", head: true }).eq("is_active", true) });
      }
      if (canSee("read_wallets")) {
        tasks.push({ key: "walletBalance", run: () => supabase.from("customer_wallets").select("balance") });
      }
      if (canSee("read_penny_prime")) {
        tasks.push({ key: "pennyPrimeCoupons", run: () => supabase.from("penny_prime_coupons").select("id", { count: "exact", head: true }).eq("is_active", true) });
      }

      const results = await Promise.all(tasks.map((t) => t.run()));
      const next: any = { ...stats };
      results.forEach((r, i) => {
        const key = tasks[i].key;
        if (key === "revenueTotal" || key === "revenueToday" || key === "revenueMonth") {
          const sum = (r.data ?? []).reduce((s: number, row: any) => s + Number(row.total ?? 0), 0);
          next[key] = Math.round(sum);
        } else if (key === "walletBalance") {
          const sum = (r.data ?? []).reduce((s: number, row: any) => s + Number(row.balance ?? 0), 0);
          next[key] = Math.round(sum);
        } else {
          next[key] = r.count ?? 0;
        }
      });
      setStats(next);
    };
    fetchStats();
  }, [isSuperAdmin]);

  const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
  const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleString() : "—");

  const openDetail = async (card: StatCard) => {
    if (!card.detailKey) return;
    setDetailTitle(card.label);
    setDetailNavTo(card.navigateTo);
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailRows([]);
    setDetailColumns([]);

    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

    try {
      const orderCols = [
        { key: "id", label: "Order ID", render: (v: string) => `#${String(v).slice(0, 8)}` },
        { key: "status", label: "Status", render: (v: string) => (v ?? "").replace(/_/g, " ") },
        { key: "total", label: "Total", render: (v: number) => inr(Number(v ?? 0)) },
        { key: "created_at", label: "Date", render: (v: string) => fmtDate(v) },
      ];
      const userCols = [
        { key: "full_name", label: "Name" },
        { key: "mobile_number", label: "Mobile" },
        { key: "user_type", label: "Type" },
        { key: "created_at", label: "Joined", render: (v: string) => fmtDate(v) },
      ];

      let q: any = null;
      let cols = orderCols;

      switch (card.detailKey) {
        case "orders":
          q = supabase.from("orders").select("id,status,total,created_at").order("created_at", { ascending: false }).limit(100);
          break;
        case "ordersToday":
          q = supabase.from("orders").select("id,status,total,created_at").gte("created_at", todayStart.toISOString()).order("created_at", { ascending: false }).limit(100);
          break;
        case "pendingOrders":
          q = supabase.from("orders").select("id,status,total,created_at").in("status", ["pending", "seller_confirmation_pending"]).order("created_at", { ascending: false }).limit(100);
          break;
        case "processingOrders":
          q = supabase.from("orders").select("id,status,total,created_at").in("status", ["confirmed", "processing", "accepted", "packed", "seller_packed", "pickup", "shipped", "seller_accepted", "seller_shipped", "self_delivery_pickup", "self_delivery_shipped"]).order("created_at", { ascending: false }).limit(100);
          break;
        case "deliveredOrders":
          q = supabase.from("orders").select("id,status,total,created_at").eq("status", "delivered").order("created_at", { ascending: false }).limit(100);
          break;
        case "cancelledOrders":
          q = supabase.from("orders").select("id,status,total,created_at").eq("status", "cancelled").order("created_at", { ascending: false }).limit(100);
          break;
        case "returnOrders":
          q = supabase.from("orders").select("id,status,total,created_at").in("status", ["return_requested", "return_confirmed"]).order("created_at", { ascending: false }).limit(100);
          break;
        case "revenueToday":
          q = supabase.from("orders").select("id,status,total,created_at").eq("status", "delivered").gte("created_at", todayStart.toISOString()).order("created_at", { ascending: false }).limit(100);
          break;
        case "revenueMonth":
          q = supabase.from("orders").select("id,status,total,created_at").eq("status", "delivered").gte("created_at", monthStart.toISOString()).order("created_at", { ascending: false }).limit(100);
          break;
        case "revenueTotal":
          q = supabase.from("orders").select("id,status,total,created_at").eq("status", "delivered").order("created_at", { ascending: false }).limit(100);
          break;

        case "users":
          q = supabase.from("profiles").select("full_name,mobile_number,user_type,created_at").order("created_at", { ascending: false }).limit(100);
          cols = userCols;
          break;
        case "newUsersToday":
          q = supabase.from("profiles").select("full_name,mobile_number,user_type,created_at").gte("created_at", todayStart.toISOString()).order("created_at", { ascending: false }).limit(100);
          cols = userCols;
          break;
        case "deliveryStaff":
          q = supabase.from("profiles").select("full_name,mobile_number,user_type,created_at").eq("user_type", "delivery_staff").order("created_at", { ascending: false }).limit(100);
          cols = userCols;
          break;
        case "sellers":
          q = supabase.from("profiles").select("full_name,mobile_number,user_type,created_at").eq("user_type", "selling_partner").order("created_at", { ascending: false }).limit(100);
          cols = userCols;
          break;

        case "products":
          q = supabase.from("products").select("name,category,price,stock,created_at").order("created_at", { ascending: false }).limit(100);
          cols = [
            { key: "name", label: "Name" },
            { key: "category", label: "Category" },
            { key: "price", label: "Price", render: (v: number) => inr(Number(v ?? 0)) },
            { key: "stock", label: "Stock" },
          ];
          break;
        case "sellerProducts":
          q = supabase.from("seller_products").select("name,category,price,stock,created_at").order("created_at", { ascending: false }).limit(100);
          cols = [
            { key: "name", label: "Name" },
            { key: "category", label: "Category" },
            { key: "price", label: "Price", render: (v: number) => inr(Number(v ?? 0)) },
            { key: "stock", label: "Stock" },
          ];
          break;
        case "categories":
          q = supabase.from("categories").select("name,category_type,margin_percentage,created_at").order("name");
          cols = [
            { key: "name", label: "Name" },
            { key: "category_type", label: "Type" },
            { key: "margin_percentage", label: "Margin %" },
          ];
          break;
        case "banners":
          q = supabase.from("banners").select("title,is_active,created_at").order("created_at", { ascending: false });
          cols = [
            { key: "title", label: "Title" },
            { key: "is_active", label: "Active", render: (v: boolean) => (v ? "Yes" : "No") },
            { key: "created_at", label: "Created", render: (v: string) => fmtDate(v) },
          ];
          break;
        case "godowns":
          q = supabase.from("godowns").select("name,godown_type,created_at").order("name");
          cols = [
            { key: "name", label: "Name" },
            { key: "godown_type", label: "Type" },
          ];
          break;
        case "localBodies":
          q = supabase.from("locations_local_bodies").select("name,type,created_at").order("name");
          cols = [
            { key: "name", label: "Name" },
            { key: "type", label: "Type" },
          ];
          break;
        case "activeFlashSales":
          q = supabase.from("flash_sales").select("name,discount_type,discount_value,is_active,starts_at,ends_at").eq("is_active", true).order("created_at", { ascending: false });
          cols = [
            { key: "name", label: "Name" },
            { key: "discount_type", label: "Type" },
            { key: "discount_value", label: "Value" },
            { key: "ends_at", label: "Ends", render: (v: string) => fmtDate(v) },
          ];
          break;
        case "activeNotifications":
          q = supabase.from("notifications").select("title,target_type,created_at").eq("is_active", true).order("created_at", { ascending: false });
          cols = [
            { key: "title", label: "Title" },
            { key: "target_type", label: "Target" },
            { key: "created_at", label: "Created", render: (v: string) => fmtDate(v) },
          ];
          break;
        case "pennyPrimeCoupons":
          q = supabase.from("penny_prime_coupons").select("code,discount_type,discount_value,is_active,created_at").eq("is_active", true).order("created_at", { ascending: false });
          cols = [
            { key: "code", label: "Code" },
            { key: "discount_type", label: "Type" },
            { key: "discount_value", label: "Value" },
          ];
          break;
        case "walletBalance":
          q = supabase
            .from("customer_wallets")
            .select("balance, customer_user_id, updated_at")
            .order("balance", { ascending: false })
            .limit(100);
          cols = [
            { key: "customer_user_id", label: "Customer", render: (v: string) => String(v ?? "").slice(0, 8) },
            { key: "balance", label: "Balance", render: (v: number) => inr(Number(v ?? 0)) },
            { key: "updated_at", label: "Updated", render: (v: string) => fmtDate(v) },
          ];
          break;
      }

      if (q) {
        const { data, error } = await q;
        if (error) throw error;
        setDetailRows(data ?? []);
        setDetailColumns(cols);
      }
    } catch (e) {
      console.error("Detail fetch failed", e);
    } finally {
      setDetailLoading(false);
    }
  };

  const sections: { title: string; cards: StatCard[] }[] = [
    {
      title: "Revenue",
      cards: [
        { label: "Revenue Today", value: inr(stats.revenueToday), icon: IndianRupee, color: "text-emerald-600", perm: "read_orders", detailKey: "revenueToday", navigateTo: "/admin/orders" },
        { label: "Revenue This Month", value: inr(stats.revenueMonth), icon: TrendingUp, color: "text-emerald-600", perm: "read_orders", detailKey: "revenueMonth", navigateTo: "/admin/orders" },
        { label: "Lifetime Revenue", value: inr(stats.revenueTotal), icon: IndianRupee, color: "text-emerald-700", perm: "read_orders", detailKey: "revenueTotal", navigateTo: "/admin/orders" },
        { label: "Customer Wallet Pool", value: inr(stats.walletBalance), icon: Wallet, color: "text-purple-600", perm: "read_wallets", detailKey: "walletBalance" },
      ],
    },
    {
      title: "Orders",
      cards: [
        { label: "Total Orders", value: stats.orders, icon: ShoppingCart, color: "text-amber-600", perm: "read_orders", detailKey: "orders", navigateTo: "/admin/orders" },
        { label: "Orders Today", value: stats.ordersToday, icon: ShoppingCart, color: "text-amber-700", perm: "read_orders", detailKey: "ordersToday", navigateTo: "/admin/orders" },
        { label: "Pending", value: stats.pendingOrders, icon: Clock, color: "text-yellow-600", perm: "read_orders", detailKey: "pendingOrders", navigateTo: "/admin/orders" },
        { label: "Processing", value: stats.processingOrders, icon: Package, color: "text-blue-600", perm: "read_orders", detailKey: "processingOrders", navigateTo: "/admin/orders" },
        { label: "Delivered", value: stats.deliveredOrders, icon: CheckCircle2, color: "text-green-600", perm: "read_orders", detailKey: "deliveredOrders", navigateTo: "/admin/orders" },
        { label: "Cancelled", value: stats.cancelledOrders, icon: XCircle, color: "text-red-600", perm: "read_orders", detailKey: "cancelledOrders", navigateTo: "/admin/orders" },
        { label: "Returns", value: stats.returnOrders, icon: RotateCcw, color: "text-rose-600", perm: "read_orders", detailKey: "returnOrders", navigateTo: "/admin/orders" },
      ],
    },
    {
      title: "Users",
      cards: [
        { label: "Total Users", value: stats.users, icon: Users, color: "text-blue-600", perm: "read_users", detailKey: "users", navigateTo: "/admin/users" },
        { label: "New Users Today", value: stats.newUsersToday, icon: Users, color: "text-blue-700", perm: "read_users", detailKey: "newUsersToday", navigateTo: "/admin/users" },
        { label: "Delivery Staff", value: stats.deliveryStaff, icon: Truck, color: "text-orange-600", perm: "read_users", detailKey: "deliveryStaff", navigateTo: "/admin/delivery-staff" },
        { label: "Selling Partners", value: stats.sellers, icon: Store, color: "text-indigo-600", perm: "read_users", detailKey: "sellers", navigateTo: "/admin/selling-partners" },
      ],
    },
    {
      title: "Catalog & Operations",
      cards: [
        { label: "Products", value: stats.products, icon: Package, color: "text-green-600", perm: "read_products", detailKey: "products", navigateTo: "/admin/products" },
        { label: "Seller Products", value: stats.sellerProducts, icon: Store, color: "text-teal-600", perm: "read_products", detailKey: "sellerProducts", navigateTo: "/admin/seller-products" },
        { label: "Categories", value: stats.categories, icon: Grid3X3, color: "text-cyan-600", perm: "read_categories", detailKey: "categories", navigateTo: "/admin/categories" },
        { label: "Banners", value: stats.banners, icon: Image, color: "text-purple-600", perm: "read_banners", detailKey: "banners", navigateTo: "/admin/banners" },
        { label: "Godowns", value: stats.godowns, icon: Warehouse, color: "text-slate-600", perm: "read_godowns", detailKey: "godowns", navigateTo: "/admin/godowns" },
        { label: "Local Bodies", value: stats.localBodies, icon: MapPin, color: "text-slate-600", perm: "read_locations", detailKey: "localBodies", navigateTo: "/admin/locations" },
        { label: "Active Flash Sales", value: stats.activeFlashSales, icon: Gift, color: "text-pink-600", perm: "read_products", detailKey: "activeFlashSales", navigateTo: "/admin/flash-sales" },
        { label: "Active Notifications", value: stats.activeNotifications, icon: Bell, color: "text-yellow-700", perm: "read_settings", detailKey: "activeNotifications", navigateTo: "/admin/notifications" },
        { label: "Penny Prime Coupons", value: stats.pennyPrimeCoupons, icon: Handshake, color: "text-amber-700", perm: "read_penny_prime", detailKey: "pennyPrimeCoupons", navigateTo: "/admin/penny-prime" },
      ],
    },
  ];

  const visibleSections = sections
    .map((s) => ({ ...s, cards: s.cards.filter((c) => canSee(c.perm)) }))
    .filter((s) => s.cards.length > 0);

  return (
    <AdminLayout>
      <h1 className="mb-6 text-2xl font-bold">Dashboard</h1>
      {visibleSections.length === 0 ? (
        <p className="text-muted-foreground">No data available for your permissions.</p>
      ) : (
        <div className="space-y-8">
          {visibleSections.map((section) => (
            <div key={section.title}>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {section.title}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {section.cards.map((c) => (
                  <Card
                    key={c.label}
                    onClick={() => openDetail(c)}
                    className="cursor-pointer transition-all hover:shadow-md hover:border-primary/40 active:scale-[0.98]"
                  >
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
                      <c.icon className={`h-5 w-5 ${c.color}`} />
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">{c.value}</p>
                      <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">Tap to view details</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-3">
              <span>{detailTitle}</span>
              {detailNavTo && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setDetailOpen(false); navigate(detailNavTo!); }}
                >
                  <ExternalLink className="h-3.5 w-3.5 mr-1" /> Open page
                </Button>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-auto -mx-6 px-6">
            {detailLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading...
              </div>
            ) : detailRows.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No records found.</p>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      {detailColumns.map((c) => (
                        <th key={c.key} className="px-3 py-2 text-left font-medium text-muted-foreground">
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {detailRows.map((row, i) => (
                      <tr key={i} className="border-t hover:bg-muted/30">
                        {detailColumns.map((c) => (
                          <td key={c.key} className="px-3 py-2 align-top">
                            {c.render ? c.render(row[c.key], row) : (row[c.key] ?? "—")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {!detailLoading && detailRows.length >= 100 && (
              <p className="mt-2 text-[11px] text-muted-foreground text-center">
                Showing the latest 100 records. Open the page for full list and filters.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default Dashboard;
