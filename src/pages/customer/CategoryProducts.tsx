import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Star, Clock, Coins } from "lucide-react";
import MobileBottomNav from "@/components/MobileBottomNav";
import { Skeleton } from "@/components/ui/skeleton";

interface CategoryProduct {
  id: string;
  name: string;
  price: number;
  mrp: number;
  image_url: string | null;
  coming_soon: boolean;
  wallet_points: number;
  source: "own" | "seller";
}

const fetchCategoryProducts = async (categoryName: string): Promise<CategoryProduct[]> => {
  const [ownRes, sellerRes] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, price, mrp, image_url, coming_soon, wallet_points, category, section")
      .eq("is_active", true)
      .eq("coming_soon", false)
      .or(`category.eq.${categoryName},section.eq.${categoryName}`),
    supabase
      .from("seller_products")
      .select("id, name, price, mrp, image_url, coming_soon, wallet_points, category, stock")
      .eq("is_active", true)
      .eq("is_approved", true)
      .eq("coming_soon", false)
      .gt("stock", 0)
      .eq("category", categoryName),
  ]);

  const products: CategoryProduct[] = [];
  ownRes.data?.forEach(p => products.push({ ...p, source: "own" }));
  sellerRes.data?.forEach(p => products.push({ ...p, source: "seller" }));

  // Sort: available first, coming_soon last
  return products.sort((a, b) => {
    if (a.coming_soon && !b.coming_soon) return 1;
    if (!a.coming_soon && b.coming_soon) return -1;
    return 0;
  });
};

const CategoryProducts = () => {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const decodedName = decodeURIComponent(name || "");

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["category-products", decodedName],
    queryFn: () => fetchCategoryProducts(decodedName),
    enabled: !!decodedName,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-50 flex items-center gap-3 border-b border-border bg-background px-4 py-3">
        <button onClick={() => navigate(-1)} className="rounded-full p-1 hover:bg-muted">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <h1 className="text-lg font-bold text-foreground">{decodedName}</h1>
        <span className="ml-auto text-sm text-muted-foreground">{products.length} items</span>
      </div>

      {/* Grid */}
      <div className="container py-4">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[3/4] rounded-xl" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">No products found in "{decodedName}"</div>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {products.map(p => (
              <div
                key={`${p.source}-${p.id}`}
                onClick={() => !p.coming_soon && navigate(`/product/${p.id}`)}
                className={`group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all hover:shadow-lg ${p.coming_soon ? "cursor-not-allowed opacity-80" : "cursor-pointer"}`}
              >
                <div className="relative aspect-square overflow-hidden bg-muted">
                  <img
                    src={p.image_url || "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=300&h=300&fit=crop"}
                    alt={p.name}
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    loading="lazy"
                  />
                  {p.coming_soon ? (
                    <span className="absolute left-0 right-0 top-0 flex items-center justify-center gap-1 bg-foreground/70 py-1 text-[10px] font-bold text-background">
                      <Clock className="h-3 w-3" /> Coming Soon
                    </span>
                  ) : p.mrp > p.price ? (
                    <span className="absolute left-1.5 top-1.5 rounded-md bg-destructive px-1.5 py-0.5 text-[10px] font-bold text-destructive-foreground">
                      {Math.round(((p.mrp - p.price) / p.mrp) * 100)}% OFF
                    </span>
                  ) : null}
                  {!p.coming_soon && p.wallet_points > 0 && (
                    <span className="absolute right-1.5 top-1.5 flex items-center gap-0.5 rounded-md bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      <Coins className="h-3 w-3" /> Earn {p.wallet_points} pts
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-1 p-2.5">
                  <span className="line-clamp-2 text-xs font-medium text-foreground">{p.name}</span>
                  {!p.coming_soon ? (
                    <>
                      <div className="flex items-center gap-1">
                        <Star className="h-3 w-3 fill-primary text-primary" />
                        <span className="text-[11px] text-muted-foreground">4.5</span>
                      </div>
                      <div className="mt-auto flex items-baseline gap-1.5">
                        <span className="text-sm font-bold text-foreground">₹{p.price}</span>
                        {p.mrp > p.price && (
                          <span className="text-[11px] text-muted-foreground line-through">₹{p.mrp}</span>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="mt-auto text-[11px] font-semibold text-muted-foreground">Launching soon</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <MobileBottomNav />
    </div>
  );
};

export default CategoryProducts;
