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

const mostOrdered = [
  { name: "Wireless Bluetooth Earbuds", price: 499, originalPrice: 1299, rating: 4.3, image: "https://images.unsplash.com/photo-1590658268037-6bf12f032f55?w=300&h=300&fit=crop" },
  { name: "Cotton T-Shirt Combo Pack", price: 399, originalPrice: 999, rating: 4.5, image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=300&h=300&fit=crop" },
  { name: "Stainless Steel Water Bottle", price: 249, originalPrice: 599, rating: 4.7, image: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=300&h=300&fit=crop" },
  { name: "LED Desk Lamp Adjustable", price: 599, originalPrice: 1499, rating: 4.2, image: "https://images.unsplash.com/photo-1507473885765-e6ed057ab6fe?w=300&h=300&fit=crop" },
  { name: "Organic Green Tea 100 Bags", price: 199, originalPrice: 450, rating: 4.6, image: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=300&h=300&fit=crop" },
  { name: "Phone Back Cover Premium", price: 149, originalPrice: 499, rating: 4.1, image: "https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?w=300&h=300&fit=crop" },
];

const newArrivals = [
  { name: "Smart Watch Ultra Series", price: 2499, originalPrice: 4999, rating: 4.8, image: "https://images.unsplash.com/photo-1546868871-af0de0ae72be?w=300&h=300&fit=crop" },
  { name: "Portable Bluetooth Speaker", price: 899, originalPrice: 1999, rating: 4.4, image: "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=300&h=300&fit=crop" },
  { name: "Running Shoes Lightweight", price: 1299, originalPrice: 2999, rating: 4.6, image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=300&h=300&fit=crop" },
  { name: "Bamboo Cutting Board Set", price: 349, originalPrice: 799, rating: 4.3, image: "https://images.unsplash.com/photo-1594226801341-41427b4e5c22?w=300&h=300&fit=crop" },
  { name: "Wireless Charging Pad", price: 699, originalPrice: 1499, rating: 4.5, image: "https://images.unsplash.com/photo-1586816879360-004f5b0c51e3?w=300&h=300&fit=crop" },
  { name: "Yoga Mat Premium Anti-Slip", price: 599, originalPrice: 1200, rating: 4.7, image: "https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=300&h=300&fit=crop" },
];

const lowBudget = [
  { name: "USB LED Light Flexible", price: 29, originalPrice: 99, rating: 4.0, image: "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=300&h=300&fit=crop" },
  { name: "Hair Clips Set of 12", price: 49, originalPrice: 149, rating: 4.2, image: "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=300&h=300&fit=crop" },
  { name: "Notebook Spiral A5 Pack", price: 59, originalPrice: 150, rating: 4.3, image: "https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=300&h=300&fit=crop" },
  { name: "Kitchen Sponge Set of 6", price: 39, originalPrice: 99, rating: 4.1, image: "https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=300&h=300&fit=crop" },
  { name: "Mobile Phone Stand", price: 79, originalPrice: 199, rating: 4.4, image: "https://images.unsplash.com/photo-1586105449897-20b5efeb3233?w=300&h=300&fit=crop" },
  { name: "Pen Set 10 Colors Gel", price: 69, originalPrice: 199, rating: 4.5, image: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=300&h=300&fit=crop" },
];

const Index = () => {
  const [platform, setPlatform] = useState("pennyekart");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { products: areaProducts, loading: areaLoading } = useAreaProducts();

  const isCustomer = user && profile?.user_type === "customer";

  // Group area products by category
  const groupedProducts = areaProducts.reduce<Record<string, typeof areaProducts>>((acc, p) => {
    const cat = p.category || "Other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(p);
    return acc;
  }, {});

  const toRowFormat = (items: typeof areaProducts) =>
    items.map(p => ({
      name: p.name,
      price: p.price,
      originalPrice: p.mrp > p.price ? p.mrp : undefined,
      rating: 4.5,
      image: p.image_url || "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=300&h=300&fit=crop",
    }));

  const handlePlatformSelect = (id: string) => {
    if (id === "pennyservices") {
      navigate("/services");
      return;
    }
    setPlatform(id);
  };

  const handleCategoryClick = (name: string) => {
    setSelectedCategory(prev => prev === name ? null : name);
  };

  // Determine which category groups to show
  const categoriesToShow = selectedCategory
    ? { [selectedCategory]: groupedProducts[selectedCategory] || [] }
    : groupedProducts;

  return (
    <div className="min-h-screen pb-16 md:pb-0">
      <header className="sticky top-0 z-40">
        <PlatformSelector selected={platform} onSelect={handlePlatformSelect} />
        <SearchBar />
      </header>

      <main className="space-y-2">
        <CategoryBar />
        <BannerCarousel />
        <GroceryCategories onCategoryClick={handleCategoryClick} selectedCategory={selectedCategory} />

        {isCustomer ? (
          areaLoading ? (
            <div className="py-8 text-center text-muted-foreground">Loading products for your area...</div>
          ) : Object.keys(groupedProducts).length > 0 ? (
            Object.entries(categoriesToShow).map(([cat, items]) =>
              items.length > 0 ? (
                <ProductRow key={cat} title={cat} products={toRowFormat(items)} />
              ) : selectedCategory ? (
                <div key={cat} className="py-8 text-center text-muted-foreground">
                  No products available in "{cat}" for your area yet.
                </div>
              ) : null
            )
          ) : (
            <div className="py-8 text-center text-muted-foreground">No products available in your area yet.</div>
          )
        ) : (
          <>
            <ProductRow title="Most Ordered Items" products={mostOrdered} />
            <ProductRow title="New Arrivals" products={newArrivals} />
            <ProductRow title="Low Budget Picks" products={lowBudget} />
          </>
        )}
      </main>

      <Footer />
      <MobileBottomNav />
    </div>
  );
};

export default Index;
