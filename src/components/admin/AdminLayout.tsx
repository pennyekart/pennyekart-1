import { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import {
  LayoutDashboard, Users, ShieldCheck, Package, ShoppingCart,
  Image, LogOut, ChevronLeft, Settings, Grid3X3, Wrench, MapPin, Warehouse, ClipboardList, Truck, Store, Star, SlidersHorizontal, BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/admin", perm: null },
  { label: "Users", icon: Users, path: "/admin/users", perm: "read_users" },
  { label: "Roles & Permissions", icon: ShieldCheck, path: "/admin/roles", perm: null, superOnly: true },
  { label: "Categories", icon: Grid3X3, path: "/admin/categories", perm: "read_categories" },
  { label: "Products", icon: Package, path: "/admin/products", perm: "read_products" },
  { label: "Orders", icon: ShoppingCart, path: "/admin/orders", perm: "read_orders" },
  { label: "Banners", icon: Image, path: "/admin/banners", perm: "read_banners" },
  { label: "Services", icon: Wrench, path: "/admin/services", perm: "read_services" },
  { label: "Locations", icon: MapPin, path: "/admin/locations", perm: "read_locations" },
  { label: "Godowns", icon: Warehouse, path: "/admin/godowns", perm: "read_godowns" },
  { label: "Purchase", icon: ClipboardList, path: "/admin/purchase", perm: "create_stock" },
  { label: "Delivery Staff", icon: Truck, path: "/admin/delivery", perm: "read_users" },
  { label: "Selling Partners", icon: Store, path: "/admin/sellers", perm: "read_users" },
  { label: "Offers & Features", icon: Star, path: "/admin/offers", perm: "read_products" },
  { label: "Stock Control", icon: BarChart3, path: "/admin/stock-control", perm: "read_stock" },
  { label: "App Settings", icon: SlidersHorizontal, path: "/admin/settings", perm: "read_products" },
];

const AdminLayout = ({ children }: { children: ReactNode }) => {
  const { signOut, profile } = useAuth();
  const { hasPermission, isSuperAdmin } = usePermissions();
  const location = useLocation();
  const navigate = useNavigate();

  const visibleItems = navItems.filter((item) => {
    if (item.superOnly) return isSuperAdmin;
    if (item.perm) return hasPermission(item.perm);
    return true;
  });

  return (
    <div className="flex min-h-screen bg-muted/40">
      {/* Sidebar */}
      <aside className="hidden w-64 flex-col border-r bg-card lg:flex">
        <div className="flex h-16 items-center gap-2 border-b px-6">
          <Settings className="h-5 w-5 text-primary" />
          <span className="text-lg font-bold">Admin Panel</span>
        </div>
        <nav className="flex-1 space-y-1 p-4">
          {visibleItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t p-4">
          <p className="mb-2 truncate text-xs text-muted-foreground">{profile?.email}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={() => navigate("/")}>
              <ChevronLeft className="mr-1 h-3 w-3" /> Store
            </Button>
            <Button variant="outline" size="sm" onClick={signOut}>
              <LogOut className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b bg-card px-4 lg:hidden">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            <span className="font-bold">Admin</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {/* Mobile nav */}
        <nav className="flex gap-1 overflow-x-auto border-b bg-card px-2 py-2 lg:hidden">
          {visibleItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                <item.icon className="h-3.5 w-3.5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
};

export default AdminLayout;
