import { useState, useCallback } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { CartProvider } from "@/hooks/useCart";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import SplashScreen from "./components/SplashScreen";
import ProtectedRoute from "./components/admin/ProtectedRoute";
import ProtectedPartnerRoute from "./components/ProtectedPartnerRoute";
import Dashboard from "./pages/admin/Dashboard";
import UsersPage from "./pages/admin/UsersPage";
import RolesPage from "./pages/admin/RolesPage";
import ProductsPage from "./pages/admin/ProductsPage";
import OrdersPage from "./pages/admin/OrdersPage";
import BannersPage from "./pages/admin/BannersPage";
import CategoriesPage from "./pages/admin/CategoriesPage";
import ServicesPage from "./pages/admin/ServicesPage";
import LocationsPage from "./pages/admin/LocationsPage";
import GodownsPage from "./pages/admin/GodownsPage";
import PurchasePage from "./pages/admin/PurchasePage";
import DeliveryManagementPage from "./pages/admin/DeliveryManagementPage";
import SellingPartnersPage from "./pages/admin/SellingPartnersPage";
import OffersPage from "./pages/admin/OffersPage";
import PennyServices from "./pages/PennyServices";
import ServiceDetail from "./pages/ServiceDetail";
import PennyCarbs from "./pages/PennyCarbs";
import AppSettingsPage from "./pages/admin/AppSettingsPage";
import StockControlPage from "./pages/admin/StockControlPage";
import DeliveryStaffSignup from "./pages/delivery-staff/Signup";
import DeliveryStaffLogin from "./pages/delivery-staff/Login";
import DeliveryStaffForgotPassword from "./pages/delivery-staff/ForgotPasswordPage";
import DeliveryStaffDashboard from "./pages/delivery-staff/Dashboard";
import SellingPartnerSignup from "./pages/selling-partner/Signup";
import SellingPartnerLogin from "./pages/selling-partner/Login";
import SellingPartnerForgotPassword from "./pages/selling-partner/ForgotPasswordPage";
import SellingPartnerDashboard from "./pages/selling-partner/Dashboard";
import CustomerSignup from "./pages/customer/Signup";
import CustomerLogin from "./pages/customer/Login";
import ProductDetail from "./pages/customer/ProductDetail";
import Cart from "./pages/customer/Cart";
import CustomerProfile from "./pages/customer/Profile";

const queryClient = new QueryClient();

const App = () => {
  const [showSplash, setShowSplash] = useState(true);
  const hideSplash = useCallback(() => setShowSplash(false), []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        {showSplash && <SplashScreen onComplete={hideSplash} />}
        <BrowserRouter>
          <AuthProvider>
            <CartProvider>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/admin" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/admin/users" element={<ProtectedRoute requirePermission="read_users"><UsersPage /></ProtectedRoute>} />
              <Route path="/admin/roles" element={<ProtectedRoute requireSuperAdmin><RolesPage /></ProtectedRoute>} />
              <Route path="/admin/products" element={<ProtectedRoute requirePermission="read_products"><ProductsPage /></ProtectedRoute>} />
              <Route path="/admin/orders" element={<ProtectedRoute requirePermission="read_orders"><OrdersPage /></ProtectedRoute>} />
              <Route path="/admin/banners" element={<ProtectedRoute requirePermission="read_banners"><BannersPage /></ProtectedRoute>} />
              <Route path="/admin/categories" element={<ProtectedRoute requirePermission="read_categories"><CategoriesPage /></ProtectedRoute>} />
              <Route path="/admin/services" element={<ProtectedRoute requirePermission="read_services"><ServicesPage /></ProtectedRoute>} />
              <Route path="/admin/locations" element={<ProtectedRoute requirePermission="read_locations"><LocationsPage /></ProtectedRoute>} />
              <Route path="/admin/godowns" element={<ProtectedRoute requirePermission="read_godowns"><GodownsPage /></ProtectedRoute>} />
              <Route path="/admin/purchase" element={<ProtectedRoute requirePermission="create_stock"><PurchasePage /></ProtectedRoute>} />
              <Route path="/admin/delivery" element={<ProtectedRoute requirePermission="read_users"><DeliveryManagementPage /></ProtectedRoute>} />
              <Route path="/admin/sellers" element={<ProtectedRoute requirePermission="read_users"><SellingPartnersPage /></ProtectedRoute>} />
              <Route path="/admin/offers" element={<ProtectedRoute requirePermission="read_products"><OffersPage /></ProtectedRoute>} />
              <Route path="/services" element={<PennyServices />} />
              <Route path="/services/:id" element={<ServiceDetail />} />
              <Route path="/pennycarbs" element={<PennyCarbs />} />
              <Route path="/admin/stock-control" element={<ProtectedRoute requirePermission="read_stock"><StockControlPage /></ProtectedRoute>} />
              <Route path="/admin/settings" element={<ProtectedRoute requirePermission="read_products"><AppSettingsPage /></ProtectedRoute>} />

              {/* Delivery Staff */}
              <Route path="/delivery-staff/signup" element={<DeliveryStaffSignup />} />
              <Route path="/delivery-staff/login" element={<DeliveryStaffLogin />} />
              <Route path="/delivery-staff/forgot-password" element={<DeliveryStaffForgotPassword />} />
              <Route path="/delivery-staff/dashboard" element={
                <ProtectedPartnerRoute userType="delivery_staff" loginPath="/delivery-staff/login">
                  <DeliveryStaffDashboard />
                </ProtectedPartnerRoute>
              } />

              {/* Customer */}
              <Route path="/product/:id" element={<ProductDetail />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/customer/signup" element={<CustomerSignup />} />
              <Route path="/customer/login" element={<CustomerLogin />} />
              <Route path="/customer/profile" element={<CustomerProfile />} />

              {/* Selling Partner */}
              <Route path="/selling-partner/signup" element={<SellingPartnerSignup />} />
              <Route path="/selling-partner/login" element={<SellingPartnerLogin />} />
              <Route path="/selling-partner/forgot-password" element={<SellingPartnerForgotPassword />} />
              <Route path="/selling-partner/dashboard" element={
                <ProtectedPartnerRoute userType="selling_partner" loginPath="/selling-partner/login">
                  <SellingPartnerDashboard />
                </ProtectedPartnerRoute>
              } />

              <Route path="*" element={<NotFound />} />
            </Routes>
            </CartProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
