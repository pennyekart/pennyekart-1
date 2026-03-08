import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import PlatformSelector from "@/components/PlatformSelector";
import SearchBar from "@/components/SearchBar";
import CategoryBar from "@/components/CategoryBar";
import BannerCarousel from "@/components/BannerCarousel";
import GroceryCategories from "@/components/GroceryCategories";
import ProductRow from "@/components/ProductRow";
import MobileBottomNav from "@/components/MobileBottomNav";
import FlashSaleBanner from "@/components/FlashSaleBanner";
import Footer from "@/components/Footer";
import CartReminderBanner from "@/components/CartReminderBanner";
import WalletRewardPopup from "@/components/WalletRewardPopup";
import SortFilterBar, { SortOption } from "@/components/SortFilterBar";
import { useAuth } from "@/hooks/useAuth";
import { useAreaProducts } from "@/hooks/useAreaProducts";
import { useSectionProducts } from "@/hooks/useSectionProducts";
import { supabase } from "@/integrations/supabase/client";

const sectionOrder = ["featured", "sponsors", "most_ordered", "new_arrivals", "low_budget"];

const Index = () => {
  const [platform, setPlatform] = useState("pennyekart");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>("relevance");
  const [showSignupReward, setShowSignupReward] = useState(false);
  const [signupRewardAmount, setSignupRewardAmount] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile } = useAuth();

  // Check for signup reward popup
  useEffect(() => {
    const state = location.state as any;
    if (state?.showSignupReward && user) {
      window.history.replaceState({}, document.title);
      const fetchWalletBonus = async () => {
        const { data } = await supabase
          .from("customer_wallets")
          .select("balance")
          .eq("customer_user_id", user.id)
          .maybeSingle();
        const amount = data?.balance ?? 50;
        setSignupRewardAmount(Number(amount));
        setShowSignupReward(true);
      };
      setTimeout(fetchWalletBonus, 1500);
    }
  }, [location.state, user]);

  const { products: areaProducts, loading: areaLoading } = useAreaProducts();
  const { grouped: sectionGrouped, loading: sectionLoading } = useSectionProducts();

  const isCustomer = user && profile?.user_type === "customer";

  const toRowFormat = (items: { id?: string; name: string; price: number; mrp: number; image_url: string | null; coming_soon?: boolean; wallet_points?: number }[]) =>
    items.map(p => ({
      id: (p as any).id,
      name: p.name,
      price: p.price,
      originalPrice: p.mrp > p.price ? p.mrp : undefined,
      rating: 4.5,
      image: p.image_url || "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=300&h=300&fit=crop",
      coming_soon: p.coming_soon,
      wallet_points: p.wallet_points,
    }));

  // Sort products based on selected sort option
  const applySorting = <T extends { price: number; mrp: number; coming_soon?: boolean; section?: string | null }>(items: T[]): T[] => {
    if (sortBy === "relevance") return items;
    return [...items].sort((a, b) => {
      if (a.coming_soon && !b.coming_soon) return 1;
      if (!a.coming_soon && b.coming_soon) return -1;
      switch (sortBy) {
        case "price_low":
          return a.price - b.price;
        case "price_high":
          return b.price - a.price;
        case "rating":
          return 0;
        case "discount": {
          const discA = a.mrp > a.price ? ((a.mrp - a.price) / a.mrp) * 100 : 0;
          const discB = b.mrp > b.price ? ((b.mrp - b.price) / b.mrp) * 100 : 0;
          return discB - discA;
        }
        case "most_ordered":
          return (a.section === "most_ordered" ? -1 : 0) - (b.section === "most_ordered" ? -1 : 0);
        default:
          return 0;
      }
    });
  };

  // Group area products by category
  const groupedByCategory = areaProducts.reduce<Record<string, typeof areaProducts>>((acc, p) => {
    const cat = p.category || "Other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(p);
    return acc;
  }, {});

  // For non-logged-in users, group section products by category for filtering
  const sectionProductsFlat = Object.values(sectionGrouped).flatMap(g => g.items);
  const sectionByCategory = sectionProductsFlat.reduce<Record<string, typeof sectionProductsFlat>>((acc, p) => {
    const cat = p.category || "Other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(p);
    return acc;
  }, {});

  const handlePlatformSelect = (id: string) => {
    if (id === "pennyservices") {
      navigate("/services");
      return;
    }
    if (id === "pennycarbs") {
      navigate("/pennycarbs");
      return;
    }
    setPlatform(id);
  };

  const handleCategoryClick = (name: string) => {
    setSelectedCategory(prev => prev === name ? null : name);
  };

  // Group area products by section for logged-in customers
  const areaBySection = areaProducts.reduce<Record<string, typeof areaProducts>>((acc, p) => {
    if (p.section && p.section !== "" && p.section !== "seller") {
      if (!acc[p.section]) acc[p.section] = [];
      acc[p.section].push(p);
    }
    return acc;
  }, {});

  // Merge section products from admin offers with area section products for logged-in customers
  const mergedBySection = (() => {
    if (!isCustomer) return {};
    const merged: Record<string, any[]> = {};
    // Start with section products from useSectionProducts (admin offers)
    for (const sec of sectionOrder) {
      const sectionItems = sectionGrouped[sec]?.items || [];
      const areaItems = areaBySection[sec] || [];
      // Merge, dedup by id
      const seen = new Set<string>();
      const combined: any[] = [];
      for (const item of [...sectionItems, ...areaItems]) {
        if (!seen.has(item.id)) {
          seen.add(item.id);
          combined.push(item);
        }
      }
      if (combined.length > 0) merged[sec] = combined;
    }
    return merged;
  })();

    // For non-logged-in: show section-based products from DB
    const sections = sectionOrder.filter(s => sectionGrouped[s]?.items.length > 0);
    if (sections.length > 0) {
      return sections.map(sec => (
        <ProductRow key={sec} title={sectionGrouped[sec].label} products={toRowFormat(applySorting(sectionGrouped[sec].items))} sectionKey={sec} />
      ));
    }

    // Fallback: show all products grouped by category
    if (sectionLoading) {
      return <div className="py-8 text-center text-muted-foreground">Loading products...</div>;
    }
    const allProducts = Object.values(sectionGrouped).flatMap(g => g.items);
    if (allProducts.length === 0) {
      return <div className="py-8 text-center text-muted-foreground">No products available yet.</div>;
    }
    const allByCategory = allProducts.reduce<Record<string, typeof allProducts>>((acc, p) => {
      const cat = p.category || "Other";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(p);
      return acc;
    }, {});
    return Object.entries(allByCategory).map(([cat, items]) => (
      <ProductRow key={cat} title={cat} products={toRowFormat(applySorting(items))} />
    ));
  };

  return (
    <div className="min-h-screen pb-16 md:pb-0">
      <header className="sticky top-0 z-50">
        <PlatformSelector selected={platform} onSelect={handlePlatformSelect} />
        <SearchBar />
      </header>

      <main className="relative z-0 space-y-2">
        <CartReminderBanner />
        <FlashSaleBanner />
        <CategoryBar onCategoryClick={handleCategoryClick} selectedCategory={selectedCategory} />
        <SortFilterBar selected={sortBy} onChange={setSortBy} />
        <BannerCarousel />
        <GroceryCategories onCategoryClick={handleCategoryClick} selectedCategory={selectedCategory} />
        {renderSectionProducts()}
      </main>

      <Footer />
      <MobileBottomNav />

      <WalletRewardPopup
        open={showSignupReward}
        onClose={() => setShowSignupReward(false)}
        rewards={[{ amount: signupRewardAmount, desc: "Signup bonus credited to your wallet" }]}
        totalAmount={signupRewardAmount}
      />
    </div>
  );
};

export default Index;
