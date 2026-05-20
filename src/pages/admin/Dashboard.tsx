import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users, Package, ShoppingCart, Image, Store, Truck,
  Clock, CheckCircle2, XCircle, RotateCcw, IndianRupee,
  TrendingUp, Wallet, Gift, Bell, Grid3X3, Warehouse, MapPin, Handshake,
} from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import { usePermissions } from "@/hooks/usePermissions";

interface StatCard {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  perm: string | null;
}

const Dashboard = () => {
  const { hasPermission, isSuperAdmin } = usePermissions();
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

  const canSee = (perm: string | null) => {
    if (!perm) return true;
    return isSuperAdmin || hasPermission(perm);
  };

  useEffect(() => {
    const fetchStats = async () => {
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

      const tasks: { key: string; run: () => Promise<any> }[] = [];

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

  const sections: { title: string; cards: StatCard[] }[] = [
    {
      title: "Revenue",
      cards: [
        { label: "Revenue Today", value: inr(stats.revenueToday), icon: IndianRupee, color: "text-emerald-600", perm: "read_orders" },
        { label: "Revenue This Month", value: inr(stats.revenueMonth), icon: TrendingUp, color: "text-emerald-600", perm: "read_orders" },
        { label: "Lifetime Revenue", value: inr(stats.revenueTotal), icon: IndianRupee, color: "text-emerald-700", perm: "read_orders" },
        { label: "Customer Wallet Pool", value: inr(stats.walletBalance), icon: Wallet, color: "text-purple-600", perm: "read_wallets" },
      ],
    },
    {
      title: "Orders",
      cards: [
        { label: "Total Orders", value: stats.orders, icon: ShoppingCart, color: "text-amber-600", perm: "read_orders" },
        { label: "Orders Today", value: stats.ordersToday, icon: ShoppingCart, color: "text-amber-700", perm: "read_orders" },
        { label: "Pending", value: stats.pendingOrders, icon: Clock, color: "text-yellow-600", perm: "read_orders" },
        { label: "Processing", value: stats.processingOrders, icon: Package, color: "text-blue-600", perm: "read_orders" },
        { label: "Delivered", value: stats.deliveredOrders, icon: CheckCircle2, color: "text-green-600", perm: "read_orders" },
        { label: "Cancelled", value: stats.cancelledOrders, icon: XCircle, color: "text-red-600", perm: "read_orders" },
        { label: "Returns", value: stats.returnOrders, icon: RotateCcw, color: "text-rose-600", perm: "read_orders" },
      ],
    },
    {
      title: "Users",
      cards: [
        { label: "Total Users", value: stats.users, icon: Users, color: "text-blue-600", perm: "read_users" },
        { label: "New Users Today", value: stats.newUsersToday, icon: Users, color: "text-blue-700", perm: "read_users" },
        { label: "Delivery Staff", value: stats.deliveryStaff, icon: Truck, color: "text-orange-600", perm: "read_users" },
        { label: "Selling Partners", value: stats.sellers, icon: Store, color: "text-indigo-600", perm: "read_users" },
      ],
    },
    {
      title: "Catalog & Operations",
      cards: [
        { label: "Products", value: stats.products, icon: Package, color: "text-green-600", perm: "read_products" },
        { label: "Seller Products", value: stats.sellerProducts, icon: Store, color: "text-teal-600", perm: "read_products" },
        { label: "Categories", value: stats.categories, icon: Grid3X3, color: "text-cyan-600", perm: "read_categories" },
        { label: "Banners", value: stats.banners, icon: Image, color: "text-purple-600", perm: "read_banners" },
        { label: "Godowns", value: stats.godowns, icon: Warehouse, color: "text-slate-600", perm: "read_godowns" },
        { label: "Local Bodies", value: stats.localBodies, icon: MapPin, color: "text-slate-600", perm: "read_locations" },
        { label: "Active Flash Sales", value: stats.activeFlashSales, icon: Gift, color: "text-pink-600", perm: "read_products" },
        { label: "Active Notifications", value: stats.activeNotifications, icon: Bell, color: "text-yellow-700", perm: "read_settings" },
        { label: "Penny Prime Coupons", value: stats.pennyPrimeCoupons, icon: Handshake, color: "text-amber-700", perm: "read_penny_prime" },
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
                  <Card key={c.label}>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
                      <c.icon className={`h-5 w-5 ${c.color}`} />
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">{c.value}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  );
};

export default Dashboard;
