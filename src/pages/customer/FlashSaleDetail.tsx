import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Zap, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCart } from "@/hooks/useCart";
import { useToast } from "@/hooks/use-toast";

interface FlashSaleData {
  id: string;
  title: string;
  description: string | null;
  banner_color: string;
  start_time: string;
  end_time: string;
  discount_type: string;
  discount_value: number;
}

interface FlashProductItem {
  id: string;
  flash_price: number;
  flash_mrp: number;
  product_id: string | null;
  seller_product_id: string | null;
  product_name?: string;
  product_image?: string | null;
  product_description?: string | null;
  product_category?: string | null;
  source: "product" | "seller_product";
  actual_product_id: string;
}

const CountdownTimer = ({ endTime }: { endTime: string }) => {
  const [timeLeft, setTimeLeft] = useState({ h: 0, m: 0, s: 0 });

  useEffect(() => {
    const calc = () => {
      const diff = Math.max(0, new Date(endTime).getTime() - Date.now());
      setTimeLeft({
        h: Math.floor(diff / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000),
      });
    };
    calc();
    const id = setInterval(calc, 1000);
    return () => clearInterval(id);
  }, [endTime]);

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div className="flex items-center gap-1 text-primary-foreground">
      {[
        { val: timeLeft.h, label: "H" },
        { val: timeLeft.m, label: "M" },
        { val: timeLeft.s, label: "S" },
      ].map((t, i) => (
        <div key={i} className="flex items-center gap-0.5">
          {i > 0 && <span className="text-sm font-bold opacity-80">:</span>}
          <div className="bg-background/20 backdrop-blur-sm rounded px-2 py-1 min-w-[32px] text-center">
            <span className="text-base font-bold tabular-nums">{pad(t.val)}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

const FlashSaleDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [sale, setSale] = useState<FlashSaleData | null>(null);
  const [products, setProducts] = useState<FlashProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { addItem } = useCart();
  const { toast } = useToast();

  useEffect(() => {
    const fetchSale = async () => {
      if (!id) return;

      const { data: saleData } = await supabase
        .from("flash_sales")
        .select("id, title, description, banner_color, start_time, end_time, discount_type, discount_value")
        .eq("id", id)
        .eq("is_active", true)
        .single();

      if (!saleData) {
        setLoading(false);
        return;
      }
      setSale(saleData as FlashSaleData);

      // Fetch flash sale products
      const { data: fspData } = await supabase
        .from("flash_sale_products")
        .select("id, flash_price, flash_mrp, product_id, seller_product_id")
        .eq("flash_sale_id", id)
        .order("sort_order");

      if (!fspData || fspData.length === 0) {
        setLoading(false);
        return;
      }

      const enriched: FlashProductItem[] = [];
      for (const item of fspData) {
        if (item.product_id) {
          const { data: p } = await supabase
            .from("products")
            .select("name, image_url, description, category")
            .eq("id", item.product_id)
            .single();
          if (p) {
            enriched.push({
              ...item,
              product_name: p.name,
              product_image: p.image_url,
              product_description: p.description,
              product_category: (p as any).category || null,
              source: "product",
              actual_product_id: item.product_id,
            });
          }
        } else if (item.seller_product_id) {
          const { data: p } = await supabase
            .from("seller_products")
            .select("name, image_url, description")
            .eq("id", item.seller_product_id)
            .single();
          if (p) {
            enriched.push({
              ...item,
              product_name: p.name,
              product_image: p.image_url,
              product_description: p.description,
              source: "seller_product",
              actual_product_id: item.seller_product_id,
            });
          }
        }
      }
      setProducts(enriched);
      setLoading(false);
    };
    fetchSale();
  }, [id]);

  const handleAddToCart = (item: FlashProductItem) => {
    addItem({
      id: item.actual_product_id,
      name: item.product_name || "Product",
      price: item.flash_price,
      mrp: item.flash_mrp,
      image: item.product_image || "",
      source: item.source,
    });
    toast({ title: "Added to cart", description: `${item.product_name} added at flash sale price!` });
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!sale) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Flash sale not found or has ended</p>
        <Button variant="outline" onClick={() => navigate("/")}>Go Home</Button>
      </div>
    );
  }

  const discountLabel = sale.discount_value > 0
    ? sale.discount_type === "percentage"
      ? `${sale.discount_value}% OFF`
      : `₹${sale.discount_value} OFF`
    : null;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => navigate(-1)} className="text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="flex-1 text-sm font-semibold text-foreground truncate">{sale.title}</h1>
        </div>

        {/* Sale banner */}
        <div
          className="px-4 py-3 flex items-center justify-between text-primary-foreground"
          style={{ background: `linear-gradient(135deg, ${sale.banner_color}, ${sale.banner_color}dd)` }}
        >
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 fill-current animate-pulse" />
            <div>
              <p className="font-bold text-sm uppercase tracking-wide">{sale.title}</p>
              {sale.description && <p className="text-xs opacity-80">{sale.description}</p>}
              {discountLabel && (
                <Badge className="mt-1 bg-background/20 text-primary-foreground border-0 text-xs">
                  {discountLabel}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 opacity-70" />
            <CountdownTimer endTime={sale.end_time} />
          </div>
        </div>
      </header>

      {/* Products Grid */}
      <main className="p-3">
        {products.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">No products in this flash sale</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {products.map(item => {
              const discountPercent = item.flash_mrp > item.flash_price
                ? Math.round(((item.flash_mrp - item.flash_price) / item.flash_mrp) * 100)
                : 0;
              return (
                <div
                  key={item.id}
                  className="rounded-xl border border-border bg-card overflow-hidden flex flex-col"
                >
                  <div
                    className="aspect-square bg-muted cursor-pointer relative"
                    onClick={() => navigate(`/product/${item.actual_product_id}`)}
                  >
                    {item.product_image ? (
                      <img src={item.product_image} alt={item.product_name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-muted-foreground text-xs">No image</div>
                    )}
                    {discountPercent > 0 && (
                      <div className="absolute top-1.5 left-1.5 bg-destructive text-destructive-foreground text-[10px] font-bold px-1.5 py-0.5 rounded">
                        {discountPercent}% OFF
                      </div>
                    )}
                  </div>
                  <div className="p-2.5 flex flex-col flex-1">
                    <p
                      className="text-xs font-medium text-foreground line-clamp-2 cursor-pointer"
                      onClick={() => navigate(`/product/${item.actual_product_id}`)}
                    >
                      {item.product_name}
                    </p>
                    <div className="mt-1 flex items-baseline gap-1.5">
                      <span className="text-sm font-bold text-foreground">₹{item.flash_price}</span>
                      {item.flash_mrp > item.flash_price && (
                        <span className="text-[10px] text-muted-foreground line-through">₹{item.flash_mrp}</span>
                      )}
                    </div>
                    <Button
                      size="sm"
                      className="mt-auto w-full text-xs h-8"
                      onClick={() => handleAddToCart(item)}
                    >
                      Add to Cart
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default FlashSaleDetail;
