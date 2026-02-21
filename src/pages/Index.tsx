import { useState } from "react";
import { useNavigate } from "react-router-dom";
import PlatformSelector from "@/components/PlatformSelector";
import SearchBar from "@/components/SearchBar";
import CategoryBar from "@/components/CategoryBar";
import BannerCarousel from "@/components/BannerCarousel";
import GroceryCategories from "@/components/GroceryCategories";
import ProductRow from "@/components/ProductRow";
import MobileBottomNav from "@/components/MobileBottomNav";
import Footer from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { useAreaProducts } from "@/hooks/useAreaProducts";
import { useSectionProducts } from "@/hooks/useSectionProducts";

const sectionOrder = ["featured", "sponsors", "most_ordered", "new_arrivals", "low_budget"];

const Index = () => {
  const [platform, setPlatform] = useState("pennyekart");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { products: areaProducts, loading: areaLoading } = useAreaProducts();
  const { grouped: sectionGrouped, loading: sectionLoading } = useSectionProducts();

  const isCustomer = user && profile?.user_type === "customer";

  // Helper to convert products to row format
  const toRowFormat = (items: { id?: string; name: string; price: number; mrp: number; image_url: string | null; coming_soon?: boolean }[]) =>
    items.map(p => ({
      id: (p as any).id,
      name: p.name,
      price: p.price,
      originalPrice: p.mrp > p.price ? p.mrp : undefined,
      rating: 4.5,
      image: p.image_url || "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=300&h=300&fit=crop",
      coming_soon: p.coming_soon,
    }));

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

  const sectionLabels: Record<string, string> = {
    featured: "Featured Products",
    most_ordered: "Most Ordered Items",
    new_arrivals: "New Arrivals",
    low_budget: "Low Budget Picks",
    sponsors: "Sponsors",
  };

  // Render section-based products (from admin)
  const renderSectionProducts = () => {
    if (sectionLoading) {
      return <div className="py-8 text-center text-muted-foreground">Loading products...</div>;
    }

    // If category filter is active, show selected category first then others
    if (selectedCategory) {
      const sourceProducts = isCustomer ? groupedByCategory : sectionByCategory;
      const selectedItems = sourceProducts[selectedCategory] || [];
      const rows: React.ReactNode[] = [];

      if (selectedItems.length > 0) {
        rows.push(<ProductRow key={selectedCategory} title={selectedCategory} products={toRowFormat(selectedItems)} />);
      } else {
        rows.push(
          <div key="empty" className="py-4 text-center text-muted-foreground">
            No products available in "{selectedCategory}" yet.
          </div>
        );
      }

      // Show all other categories after
      Object.entries(sourceProducts)
        .filter(([cat]) => cat !== selectedCategory)
        .forEach(([cat, items]) => {
          if (items.length > 0) {
            rows.push(<ProductRow key={cat} title={cat} products={toRowFormat(items)} />);
          }
        });

      return rows;
    }

    // For logged-in customers: show section rows from area products, then remaining by category
    if (isCustomer) {
      if (areaLoading) {
        return <div className="py-8 text-center text-muted-foreground">Loading products for your area...</div>;
      }
      if (areaProducts.length === 0) {
        return <div className="py-8 text-center text-muted-foreground">No products available in your area yet.</div>;
      }

      const sectionRows = sectionOrder
        .filter(s => areaBySection[s]?.length > 0)
        .map(sec => (
          <ProductRow key={sec} title={sectionLabels[sec] || sec} products={toRowFormat(areaBySection[sec])} sectionKey={sec} />
        ));

      // Products without a section, grouped by category
      const nonsectionProducts = areaProducts.filter(p => !p.section || p.section === "" || p.section === "seller");
      const nonsectionByCategory = nonsectionProducts.reduce<Record<string, typeof areaProducts>>((acc, p) => {
        const cat = p.category || "Other";
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(p);
        return acc;
      }, {});
      const categoryRows = Object.entries(nonsectionByCategory).map(([cat, items]) =>
        items.length > 0 ? <ProductRow key={cat} title={cat} products={toRowFormat(items)} /> : null
      );

      return [...sectionRows, ...categoryRows];
    }

    // For non-logged-in: show section-based products from DB
    const sections = sectionOrder.filter(s => sectionGrouped[s]?.items.length > 0);
    if (sections.length === 0) {
      return <div className="py-8 text-center text-muted-foreground">No products available yet.</div>;
    }
    return sections.map(sec => (
      <ProductRow key={sec} title={sectionGrouped[sec].label} products={toRowFormat(sectionGrouped[sec].items)} sectionKey={sec} />
    ));
  };

  return (
    <div className="min-h-screen pb-16 md:pb-0">
      <header className="sticky top-0 z-50">
        <PlatformSelector selected={platform} onSelect={handlePlatformSelect} />
        <SearchBar />
      </header>

      <main className="relative z-0 space-y-2">
        <CategoryBar onCategoryClick={handleCategoryClick} selectedCategory={selectedCategory} />
        <BannerCarousel />
        <GroceryCategories onCategoryClick={handleCategoryClick} selectedCategory={selectedCategory} />
        {renderSectionProducts()}
      </main>

      <Footer />
      <MobileBottomNav />
    </div>
  );
};

export default Index;
