import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Star, ArrowLeft, ChevronDown, ChevronUp, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import ProductRow from "@/components/ProductRow";
import { useCart } from "@/hooks/useCart";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface ProductData {
  id: string;
  name: string;
  price: number;
  mrp: number;
  discount_rate: number;
  description: string | null;
  image_url: string | null;
  image_url_2: string | null;
  image_url_3: string | null;
  video_url: string | null;
  category: string | null;
  stock: number;
}

const getYoutubeEmbedUrl = (url: string) => {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/);
  return match ? `https://www.youtube.com/embed/${match[1]}` : null;
};

const ProductDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<ProductData | null>(null);
  const [similarProducts, setSimilarProducts] = useState<ProductData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const { addItem } = useCart();
  const { toast } = useToast();
  const { profile } = useAuth();
  const [availableStock, setAvailableStock] = useState<number | null>(null);

  const handleAddToCart = () => {
    if (!product) return;
    addItem({
      id: product.id,
      name: product.name,
      price: product.price,
      mrp: product.mrp,
      image: product.image_url || "",
    });
    toast({ title: "Added to cart", description: `${product.name} added to your cart.` });
  };

  const handleBuyNow = () => {
    if (!product) return;
    addItem({
      id: product.id,
      name: product.name,
      price: product.price,
      mrp: product.mrp,
      image: product.image_url || "",
    });
    navigate("/cart");
  };

  const images = product
    ? [product.image_url, product.image_url_2, product.image_url_3].filter(Boolean) as string[]
    : [];

  // Fetch godown stock for user's area
  useEffect(() => {
    const fetchGodownStock = async () => {
      if (!product || !profile?.local_body_id || !profile?.ward_number) {
        setAvailableStock(product?.stock ?? 0);
        return;
      }

      // Get micro godown IDs
      const { data: microWards } = await supabase
        .from("godown_wards")
        .select("godown_id, godowns!inner(godown_type)")
        .eq("local_body_id", profile.local_body_id)
        .eq("ward_number", profile.ward_number)
        .eq("godowns.godown_type", "micro");

      // Get area godown IDs
      const { data: areaLocalBodies } = await supabase
        .from("godown_local_bodies")
        .select("godown_id, godowns!inner(godown_type)")
        .eq("local_body_id", profile.local_body_id)
        .eq("godowns.godown_type", "area");

      const godownIds = new Set<string>();
      microWards?.forEach(r => godownIds.add(r.godown_id));
      areaLocalBodies?.forEach(r => godownIds.add(r.godown_id));

      if (godownIds.size === 0) {
        setAvailableStock(product.stock);
        return;
      }

      const { data: stockData } = await supabase
        .from("godown_stock")
        .select("quantity")
        .eq("product_id", product.id)
        .in("godown_id", Array.from(godownIds));

      const totalGodownStock = stockData?.reduce((sum, s) => sum + s.quantity, 0) ?? 0;
      setAvailableStock(totalGodownStock > 0 ? totalGodownStock : product.stock);
    };

    fetchGodownStock();
  }, [product, profile?.local_body_id, profile?.ward_number]);

  useEffect(() => {
    const fetchProduct = async () => {
      if (!id) return;

      // Try main products table first
      let productData: ProductData | null = null;
      const { data } = await supabase
        .from("products")
        .select("id, name, price, mrp, discount_rate, description, image_url, image_url_2, image_url_3, video_url, category, stock")
        .eq("id", id)
        .eq("is_active", true)
        .maybeSingle();

      if (data) {
        productData = data as ProductData;
      } else {
        // Fallback: check seller_products table
        const { data: sellerData } = await supabase
          .from("seller_products")
          .select("id, name, price, mrp, discount_rate, description, image_url, image_url_2, image_url_3, video_url, category, stock")
          .eq("id", id)
          .eq("is_active", true)
          .eq("is_approved", true)
          .maybeSingle();
        if (sellerData) {
          productData = sellerData as ProductData;
        }
      }

      if (productData) {
        setProduct(productData);
        if (productData.category) {
          const { data: similar } = await supabase
            .from("products")
            .select("id, name, price, mrp, discount_rate, description, image_url, image_url_2, image_url_3, video_url, category, stock")
            .eq("category", productData.category)
            .eq("is_active", true)
            .neq("id", id)
            .limit(10);
          setSimilarProducts((similar as ProductData[]) || []);
        }
      }
      setLoading(false);
    };
    fetchProduct();
    setSelectedImage(0);
    setShowVideo(false);
    window.scrollTo(0, 0);
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Product not found</p>
        <Button variant="outline" onClick={() => navigate("/")}>Go Home</Button>
      </div>
    );
  }

  const effectiveStock = availableStock ?? product.stock;

  const discountPercent = product.mrp > product.price
    ? Math.round(((product.mrp - product.price) / product.mrp) * 100)
    : 0;

  const embedUrl = product.video_url ? getYoutubeEmbedUrl(product.video_url) : null;

  const similarRowProducts = similarProducts.map(p => ({
    id: p.id,
    name: p.name,
    price: p.price,
    originalPrice: p.mrp > p.price ? p.mrp : undefined,
    rating: 4.5,
    image: p.image_url || "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=300&h=300&fit=crop",
  }));

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      {/* Header */}
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-background px-4 py-3">
        <button onClick={() => navigate(-1)} className="text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="line-clamp-1 text-sm font-semibold text-foreground">{product.name}</h1>
      </header>

      <main>
        {/* Image Gallery */}
        <div className="flex flex-col md:flex-row">
          {/* Main image / video */}
          <div className="relative w-full md:w-1/2">
            {showVideo && embedUrl ? (
              <div className="aspect-square w-full bg-black">
                <iframe
                  src={embedUrl}
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title="Product video"
                />
              </div>
            ) : (
              <div className="aspect-square w-full overflow-hidden bg-muted">
                <img
                  src={images[selectedImage] || "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&h=600&fit=crop"}
                  alt={product.name}
                  className="h-full w-full object-contain"
                />
              </div>
            )}

            {/* Thumbnails */}
            <div className="flex gap-2 overflow-x-auto p-3">
              {images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => { setSelectedImage(i); setShowVideo(false); }}
                  className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition-all ${
                    !showVideo && selectedImage === i ? "border-primary" : "border-border"
                  }`}
                >
                  <img src={img} alt={`View ${i + 1}`} className="h-full w-full object-cover" />
                </button>
              ))}
              {embedUrl && (
                <button
                  onClick={() => setShowVideo(true)}
                  className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border-2 bg-muted transition-all ${
                    showVideo ? "border-primary" : "border-border"
                  }`}
                >
                  <Play className="h-6 w-6 text-primary" />
                </button>
              )}
            </div>
          </div>

          {/* Product Info */}
          <div className="flex-1 p-4 md:p-6">
            <h2 className="text-lg font-bold text-foreground md:text-xl">{product.name}</h2>

            <div className="mt-2 flex items-center gap-2">
              <div className="flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5">
                <Star className="h-3.5 w-3.5 fill-primary text-primary" />
                <span className="text-xs font-semibold text-primary">4.5</span>
              </div>
            </div>

            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-foreground">₹{product.price}</span>
              {discountPercent > 0 && (
                <>
                  <span className="text-sm text-muted-foreground line-through">₹{product.mrp}</span>
                  <span className="text-sm font-semibold text-destructive">{discountPercent}% OFF</span>
                </>
              )}
            </div>

            {effectiveStock <= 0 && (
              <p className="mt-2 text-sm font-medium text-destructive">Out of stock</p>
            )}

            {/* All Details Accordion */}
            <div className="mt-6 border-t border-border pt-4">
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="flex w-full items-center justify-between text-left"
              >
                <div>
                  <h3 className="font-bold text-foreground">All details</h3>
                  <p className="text-xs text-muted-foreground">Features, description and more</p>
                </div>
                {showDetails ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
              </button>
              {showDetails && (
                <div className="mt-3 text-sm text-muted-foreground whitespace-pre-wrap">
                  {product.description || "No additional details available."}
                </div>
              )}
            </div>

            {/* Sticky Add to Cart (desktop) */}
            <div className="mt-6 hidden gap-3 md:flex">
              <Button variant="outline" className="flex-1" disabled={effectiveStock <= 0} onClick={handleAddToCart}>
                Add to cart
              </Button>
              <Button className="flex-1" disabled={effectiveStock <= 0} onClick={handleBuyNow}>
                Buy at ₹{product.price}
              </Button>
            </div>
          </div>
        </div>

        {/* Similar Products */}
        {similarRowProducts.length > 0 && (
          <div className="mt-4">
            <ProductRow title="Similar Products" products={similarRowProducts} linkPrefix="/product/" />
          </div>
        )}
      </main>

      {/* Mobile sticky bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 flex gap-2 border-t border-border bg-background p-3 md:hidden">
        <Button variant="outline" className="flex-1" disabled={effectiveStock <= 0} onClick={handleAddToCart}>
          Add to cart
        </Button>
        <Button className="flex-1" disabled={effectiveStock <= 0} onClick={handleBuyNow}>
          Buy at ₹{product.price}
        </Button>
      </div>
    </div>
  );
};

export default ProductDetail;
