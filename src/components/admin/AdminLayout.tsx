import { ReactNode, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import {
  LayoutDashboard, Users, ShieldCheck, Package, ShoppingCart,
  Image, LogOut, ChevronLeft, Settings, Grid3X3, Wrench, MapPin, Warehouse, ClipboardList, Truck, Store, Star, SlidersHorizontal, BarChart3, Wallet, Handshake, Menu, X, Percent,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

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
  { label: "Delivery Staff", icon: Truck, path: "/admin/delivery", perm: "read_delivery_staff" },
  { label: "Selling Partners", icon: Store, path: "/admin/sellers", perm: "read_selling_partners" },
  { label: "Offers & Features", icon: Star, path: "/admin/offers", perm: "read_offers" },
  { label: "Stock Control", icon: BarChart3, path: "/admin/stock-control", perm: "read_stock" },
  { label: "App Settings", icon: SlidersHorizontal, path: "/admin/settings", perm: "read_settings" },
  { label: "Storage Config", icon: Settings, path: "/admin/storage", perm: null, superOnly: true },
  { label: "Wallets", icon: Wallet, path: "/admin/wallets", perm: "read_wallets" },
  { label: "Platform Margin", icon: Percent, path: "/admin/platform-margin", perm: "read_products" },
  { label: "Penny Prime", icon: Handshake, path: "/admin/penny-prime", perm: "read_penny_prime" },
  { label: "Sales Report", icon: BarChart3, path: "/admin/sales-report", perm: "read_reports" },
  { label: "Reports", icon: BarChart3, path: "/admin/reports", perm: "read_reports" },
];

const NavItems = ({ items, currentPath, onNavigate }: { items: typeof navItems; currentPath: string; onNavigate?: () => void }) => (
  <>
    {items.map((item) => {
      const active = currentPath === item.path;
      return (
        <Link
          key={item.path}
          to={item.path}
          onClick={onNavigate}
          className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
            active
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <item.icon className="h-4 w-4 shrink-0" />
          {item.label}
        </Link>
      );
    })}
  </>
);

const AdminLayout = ({ children }: { children: ReactNode }) => {
  const { signOut, profile } = useAuth();
  const { hasPermission, isSuperAdmin } = usePermissions();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const visibleItems = navItems.filter((item) => {
    if (item.superOnly) return isSuperAdmin;
    if (item.perm) return hasPermission(item.perm);
    return true;
  });

  const currentPageLabel = visibleItems.find((i) => i.path === location.pathname)?.label ?? "Admin";

  return (
    <div className="flex min-h-screen bg-muted/40">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 flex-col border-r bg-card lg:flex">
        <div className="flex h-16 items-center gap-2 border-b px-6">
          <Settings className="h-5 w-5 text-primary" />
          <span className="text-lg font-bold">Admin Panel</span>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-4">
          <NavItems items={visibleItems} currentPath={location.pathname} />
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

      {/* Mobile layout */}
      <div className="flex flex-1 flex-col lg:hidden">
        {/* Mobile top bar */}
        <header className="flex h-14 items-center justify-between border-b bg-card px-4">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <div className="flex h-14 items-center gap-2 border-b px-6">
                <Settings className="h-5 w-5 text-primary" />
                <span className="text-base font-bold">Admin Panel</span>
              </div>
              <nav className="flex-1 space-y-1 overflow-y-auto p-4 h-[calc(100vh-8rem)]">
                <NavItems
                  items={visibleItems}
                  currentPath={location.pathname}
                  onNavigate={() => setMobileOpen(false)}
                />
              </nav>
              <div className="border-t p-4">
                <p className="mb-2 truncate text-xs text-muted-foreground">{profile?.email}</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => { navigate("/"); setMobileOpen(false); }}>
                    <ChevronLeft className="mr-1 h-3 w-3" /> Store
                  </Button>
                  <Button variant="outline" size="sm" onClick={signOut}>
                    <LogOut className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>

          <span className="font-semibold text-sm">{currentPageLabel}</span>

          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={signOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <main className="flex-1 p-4">{children}</main>
      </div>

      {/* Desktop main content */}
      <div className="hidden flex-1 flex-col lg:flex">
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
};

export default AdminLayout;
