import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ArrowLeft, Tag, Users, Share2, Copy, CheckCheck, Handshake, ShoppingCart, Eye, Crown, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import pennyPrimeLogo from "@/assets/penny-prime-logo.jpg";

interface CouponListing {
  id: string;
  seller_code: string;
  customer_discount_type: string;
  customer_discount_value: number;
  agent_margin_type: string;
  agent_margin_value: number;
  is_active: boolean;
  created_at: string;
  seller_id: string;
  product_id: string;
  products: {
    id: string;
    name: string;
    price: number;
    mrp: number;
    image_url: string | null;
    description?: string | null;
  } | null;
  profiles: {
    full_name: string | null;
    company_name: string | null;
  } | null;
  existingCollabCode?: string | null;
}

// Dark teal + gold theme colors
const TEAL = "#0d2e2e";
const TEAL_LIGHT = "#143d3d";
const TEAL_CARD = "#112f2f";
const GOLD = "#c9a84c";
const GOLD_LIGHT = "#e6c878";
const GOLD_PALE = "#f5e6b8";

const PennyPrime = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addItem } = useCart();
  const [coupons, setCoupons] = useState<CouponListing[]>([]);
  const [loading, setLoading] = useState(true);

  const [collabDialogOpen, setCollabDialogOpen] = useState(false);
  const [selectedCoupon, setSelectedCoupon] = useState<CouponListing | null>(null);
  const [mobile, setMobile] = useState("");
  const [mobileError, setMobileError] = useState("");
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [collabLoading, setCollabLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [viewingCoupon, setViewingCoupon] = useState<CouponListing | null>(null);

  const fetchCoupons = async () => {
    setLoading(true);
    const { data: rawCoupons, error } = await supabase
      .from("penny_prime_coupons")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error || !rawCoupons) {
      console.error(error);
      setLoading(false);
      return;
    }

    const sellerIds = [...new Set(rawCoupons.map(c => c.seller_id).filter(Boolean))];
    const { data: profiles } = sellerIds.length > 0
      ? await supabase.from("profiles").select("user_id, full_name, company_name").in("user_id", sellerIds)
      : { data: [] };
    const profileMap = new Map((profiles ?? []).map(p => [p.user_id, p]));

    const productIds = [...new Set(rawCoupons.map(c => c.product_id).filter(Boolean))];
    const { data: sellerProds } = productIds.length > 0
      ? await supabase.from("seller_products").select("id, name, price, mrp, image_url, description").in("id", productIds)
      : { data: [] };
    const { data: regularProds } = productIds.length > 0
      ? await supabase.from("products").select("id, name, price, mrp, image_url, description").in("id", productIds)
      : { data: [] };
    const prodMap = new Map([
      ...(regularProds ?? []).map((p: any) => [p.id, p] as [string, any]),
      ...(sellerProds ?? []).map((p: any) => [p.id, p] as [string, any]),
    ]);

    let existingCollabs = new Map<string, string>();
    if (user) {
      const couponIds = rawCoupons.map(c => c.id);
      const { data: collabs } = await supabase
        .from("penny_prime_collabs")
        .select("coupon_id, collab_code")
        .eq("agent_user_id", user.id)
        .in("coupon_id", couponIds);
      (collabs ?? []).forEach(c => existingCollabs.set(c.coupon_id, c.collab_code));
    }

    const enriched = rawCoupons.map(c => ({
      ...c,
      products: prodMap.get(c.product_id) ?? null,
      profiles: profileMap.get(c.seller_id) ?? null,
      existingCollabCode: existingCollabs.get(c.id) ?? null,
    }));

    setCoupons(enriched as any);
    setLoading(false);
  };

  useEffect(() => {
    fetchCoupons();
  }, [user]);

  const openProductPopup = (coupon: CouponListing) => {
    setViewingCoupon(coupon);
    setProductDialogOpen(true);
  };

  const openCollab = (coupon: CouponListing) => {
    if (!user) {
      toast.error("Please login to collaborate");
      navigate("/customer/login");
      return;
    }
    setSelectedCoupon(coupon);
    setMobile("");
    setMobileError("");
    if (coupon.existingCollabCode) {
      setGeneratedCode(coupon.existingCollabCode);
    } else {
      setGeneratedCode(null);
    }
    setCollabDialogOpen(true);
  };

  const generateCollabCode = async () => {
    if (!selectedCoupon || !user) return;
    setMobileError("");

    const cleanMobile = mobile.replace(/\D/g, "");
    if (cleanMobile.length < 10) {
      setMobileError("Enter a valid 10-digit mobile number");
      return;
    }

    setCollabLoading(true);
    try {
      const mobilePart = cleanMobile.slice(0, 2) + cleanMobile.slice(-2);
      const collabCode = `${selectedCoupon.seller_code}-${mobilePart}`;

      const { data: existing } = await supabase
        .from("penny_prime_collabs")
        .select("collab_code")
        .eq("collab_code", collabCode)
        .maybeSingle();

      if (existing) {
        setGeneratedCode(collabCode);
        setCollabLoading(false);
        return;
      }

      const { error } = await supabase.from("penny_prime_collabs").insert({
        coupon_id: selectedCoupon.id,
        agent_user_id: user.id,
        agent_mobile: cleanMobile,
        collab_code: collabCode,
      });

      if (error) throw error;

      setGeneratedCode(collabCode);
      setCoupons(prev => prev.map(c => c.id === selectedCoupon.id ? { ...c, existingCollabCode: collabCode } : c));
    } catch (err: any) {
      toast.error(err.message || "Failed to generate code");
    } finally {
      setCollabLoading(false);
    }
  };

  const copyCode = async (code?: string) => {
    const codeToCopy = code || generatedCode;
    if (!codeToCopy) return;
    await navigator.clipboard.writeText(codeToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareWhatsApp = (coupon?: CouponListing, code?: string) => {
    const c = coupon || selectedCoupon;
    const shareCode = code || generatedCode;
    if (!shareCode || !c) return;
    const product = c.products;
    const discountText =
      c.customer_discount_type === "percent"
        ? `${c.customer_discount_value}% off`
        : `₹${c.customer_discount_value} off`;
    const msg = `🌟 *Penny Prime Deal!*\n\nProduct: ${product?.name ?? "Special Product"}\n💰 Discount: ${discountText}\n\nUse my exclusive code: *${shareCode}*\n\nShop on Pennyekart and save big! 🛒`;
    const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  };

  const handleAddToCart = (coupon: CouponListing) => {
    if (!coupon.products) return;
    const p = coupon.products;
    addItem({
      id: p.id,
      name: p.name,
      price: p.price,
      mrp: p.mrp,
      image: p.image_url || "/placeholder.svg",
      source: "seller_product",
      seller_id: coupon.seller_id,
    });
    toast.success(`${p.name} added to cart`);
  };

  const formatDiscount = (type: string, value: number) =>
    type === "percent" ? `${value}%` : `₹${value}`;

  const sellerName = (c: CouponListing) =>
    c.profiles?.company_name || c.profiles?.full_name || "Seller";

  return (
    <div className="min-h-screen" style={{ background: TEAL }}>
      {/* Header */}
      <header
        className="sticky top-0 z-40 flex items-center gap-3 px-4 py-3 shadow-lg"
        style={{ background: TEAL_LIGHT, borderBottom: `1px solid ${GOLD}33` }}
      >
        <button onClick={() => navigate(-1)} style={{ color: GOLD }}>
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <img src={pennyPrimeLogo} alt="Penny Prime" className="h-8 w-8 rounded-full object-cover" />
          <div>
            <h1 className="text-base font-bold" style={{ color: GOLD_LIGHT }}>Penny Prime</h1>
            <p className="text-xs" style={{ color: `${GOLD}99` }}>Earning Society</p>
          </div>
        </div>
      </header>

      {/* Hero Banner */}
      <div
        className="relative overflow-hidden px-4 py-10 text-center"
        style={{ background: `linear-gradient(135deg, ${TEAL_LIGHT} 0%, #0a2424 100%)`, borderBottom: `1px solid ${GOLD}44` }}
      >
        {/* Decorative stars */}
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(8)].map((_, i) => (
            <Star
              key={i}
              className="absolute opacity-20"
              style={{
                color: GOLD,
                width: `${8 + (i % 3) * 6}px`,
                height: `${8 + (i % 3) * 6}px`,
                top: `${10 + (i * 11) % 70}%`,
                left: `${5 + (i * 13) % 90}%`,
              }}
              fill={GOLD}
            />
          ))}
        </div>

        <div className="relative z-10 flex flex-col items-center">
          <img
            src={pennyPrimeLogo}
            alt="Penny Prime"
            className="h-28 w-28 rounded-2xl object-cover shadow-2xl mb-4"
            style={{ border: `2px solid ${GOLD}66` }}
          />
          <div
            className="text-xs font-semibold tracking-[0.3em] uppercase mb-1"
            style={{ color: GOLD }}
          >
            Earning Society
          </div>
          <h2 className="text-2xl font-bold mb-1" style={{ color: GOLD_LIGHT }}>
            Penny Prime
          </h2>
          <p className="text-sm max-w-xs mx-auto" style={{ color: `${GOLD_PALE}bb` }}>
            Pick a deal · Generate your code · Share &amp; earn margin on every referral
          </p>
        </div>
      </div>

      {/* Stats bar */}
      <div
        className="flex justify-around px-4 py-3"
        style={{ background: TEAL_CARD, borderBottom: `1px solid ${GOLD}22` }}
      >
        {[
          { label: "Active Deals", value: loading ? "—" : coupons.length },
          { label: "Earn Margin", value: "On Delivery" },
          { label: "Your Codes", value: loading ? "—" : coupons.filter(c => c.existingCollabCode).length },
        ].map(s => (
          <div key={s.label} className="text-center">
            <div className="text-base font-bold" style={{ color: GOLD_LIGHT }}>{s.value}</div>
            <div className="text-xs" style={{ color: `${GOLD}88` }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div className="container max-w-2xl px-3 py-5 space-y-4">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-36 rounded-xl animate-pulse" style={{ background: TEAL_CARD }} />
            ))}
          </div>
        ) : coupons.length === 0 ? (
          <div className="text-center py-16" style={{ color: `${GOLD}88` }}>
            <Crown className="mx-auto h-10 w-10 mb-3 opacity-40" style={{ color: GOLD }} />
            <p style={{ color: GOLD_PALE }}>No active Penny Prime deals right now.</p>
            <p className="text-sm mt-1" style={{ color: `${GOLD}77` }}>Check back soon!</p>
          </div>
        ) : (
          coupons.map(coupon => (
            <div
              key={coupon.id}
              className="rounded-xl overflow-hidden shadow-lg"
              style={{ background: TEAL_CARD, border: `1px solid ${GOLD}33` }}
            >
              {/* Card Header */}
              <div className="px-4 pt-4 pb-0">
                <div className="flex items-start gap-3">
                  <div className="cursor-pointer" onClick={() => openProductPopup(coupon)}>
                    {coupon.products?.image_url ? (
                      <img
                        src={coupon.products.image_url}
                        alt={coupon.products.name}
                        className="h-16 w-16 rounded-lg object-cover flex-shrink-0"
                        style={{ border: `1px solid ${GOLD}44` }}
                      />
                    ) : (
                      <div
                        className="h-16 w-16 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: `${GOLD}15`, border: `1px solid ${GOLD}33` }}
                      >
                        <Tag className="h-6 w-6" style={{ color: GOLD }} />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium" style={{ color: `${GOLD}99` }}>{sellerName(coupon)}</p>
                    <h3
                      className="font-semibold text-sm line-clamp-2 cursor-pointer transition-colors"
                      style={{ color: GOLD_PALE }}
                      onClick={() => openProductPopup(coupon)}
                    >
                      {coupon.products?.name ?? "Special Product"}
                    </h3>
                    {coupon.products && coupon.products.mrp > coupon.products.price && (
                      <div className="flex items-baseline gap-1.5 mt-0.5">
                        <span className="text-xs line-through" style={{ color: `${GOLD}66` }}>₹{coupon.products.mrp}</span>
                        <span className="text-sm font-bold" style={{ color: GOLD_LIGHT }}>₹{coupon.products.price}</span>
                      </div>
                    )}
                  </div>
                  <button onClick={() => openProductPopup(coupon)} className="shrink-0" style={{ color: `${GOLD}88` }}>
                    <Eye className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Card Content */}
              <div className="px-4 pt-3 pb-4">
                <div className="flex flex-wrap gap-2 mb-3">
                  <span
                    className="text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1"
                    style={{ background: `${GOLD}18`, color: GOLD_LIGHT, border: `1px solid ${GOLD}33` }}
                  >
                    <Tag className="h-3 w-3" />
                    Customer saves {formatDiscount(coupon.customer_discount_type, coupon.customer_discount_value)}
                  </span>
                  <span
                    className="text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1"
                    style={{ background: `${GOLD}28`, color: GOLD_LIGHT, border: `1px solid ${GOLD}55` }}
                  >
                    <Users className="h-3 w-3" />
                    You earn {formatDiscount(coupon.agent_margin_type, coupon.agent_margin_value)}
                  </span>
                </div>

                {coupon.existingCollabCode ? (
                  <div
                    className="rounded-lg p-3 mb-3"
                    style={{ background: `${GOLD}12`, border: `1px solid ${GOLD}44` }}
                  >
                    <p className="text-xs mb-1" style={{ color: `${GOLD}88` }}>Your Collab Code</p>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-base font-bold tracking-wider" style={{ color: GOLD_LIGHT }}>
                        {coupon.existingCollabCode}
                      </span>
                      <div className="flex gap-1.5">
                        <button onClick={() => copyCode(coupon.existingCollabCode!)} style={{ color: `${GOLD}88` }}>
                          {copied ? <CheckCheck className="h-4 w-4" style={{ color: GOLD }} /> : <Copy className="h-4 w-4" />}
                        </button>
                        <button onClick={() => shareWhatsApp(coupon, coupon.existingCollabCode!)} style={{ color: `${GOLD}88` }}>
                          <Share2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs" style={{ color: `${GOLD}77` }}>
                      Code: <span className="font-mono font-bold" style={{ color: GOLD_LIGHT }}>{coupon.seller_code}</span>
                    </p>
                    <button
                      onClick={() => openCollab(coupon)}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80"
                      style={{ background: `linear-gradient(135deg, ${GOLD} 0%, ${GOLD_LIGHT} 100%)`, color: TEAL }}
                    >
                      <Handshake className="h-3.5 w-3.5" />
                      Collab
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Product Detail Popup */}
      <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
        <DialogContent className="sm:max-w-md" style={{ background: TEAL_LIGHT, border: `1px solid ${GOLD}44` }}>
          <DialogHeader>
            <DialogTitle style={{ color: GOLD_LIGHT }}>Product Details</DialogTitle>
            <DialogDescription style={{ color: `${GOLD}88` }}>
              {viewingCoupon && sellerName(viewingCoupon)}
            </DialogDescription>
          </DialogHeader>
          {viewingCoupon?.products && (
            <div className="space-y-4">
              {viewingCoupon.products.image_url && (
                <img
                  src={viewingCoupon.products.image_url}
                  alt={viewingCoupon.products.name}
                  className="w-full h-56 object-contain rounded-lg"
                  style={{ background: `${GOLD}10` }}
                />
              )}
              <div>
                <h3 className="font-semibold text-lg" style={{ color: GOLD_PALE }}>{viewingCoupon.products.name}</h3>
                {viewingCoupon.products.description && (
                  <p className="text-sm mt-1" style={{ color: `${GOLD}88` }}>{viewingCoupon.products.description}</p>
                )}
                <div className="flex items-baseline gap-2 mt-2">
                  {viewingCoupon.products.mrp > viewingCoupon.products.price && (
                    <span className="text-sm line-through" style={{ color: `${GOLD}66` }}>₹{viewingCoupon.products.mrp}</span>
                  )}
                  <span className="text-xl font-bold" style={{ color: GOLD_LIGHT }}>₹{viewingCoupon.products.price}</span>
                  {viewingCoupon.products.mrp > viewingCoupon.products.price && (
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: `${GOLD}22`, color: GOLD_LIGHT }}>
                      {Math.round(((viewingCoupon.products.mrp - viewingCoupon.products.price) / viewingCoupon.products.mrp) * 100)}% off
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  className="flex-1 flex items-center justify-center gap-1.5 text-sm font-semibold py-2 rounded-lg border transition-opacity hover:opacity-80"
                  style={{ borderColor: `${GOLD}55`, color: GOLD_LIGHT, background: `${GOLD}10` }}
                  onClick={() => { handleAddToCart(viewingCoupon); setProductDialogOpen(false); }}
                >
                  <ShoppingCart className="h-4 w-4" />
                  Add to Cart
                </button>
                <button
                  className="flex-1 flex items-center justify-center gap-1.5 text-sm font-semibold py-2 rounded-lg transition-opacity hover:opacity-80"
                  style={{ background: `linear-gradient(135deg, ${GOLD} 0%, ${GOLD_LIGHT} 100%)`, color: TEAL }}
                  onClick={() => { setProductDialogOpen(false); openCollab(viewingCoupon); }}
                >
                  <Handshake className="h-4 w-4" />
                  Collab
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Collab Dialog */}
      <Dialog open={collabDialogOpen} onOpenChange={setCollabDialogOpen}>
        <DialogContent className="sm:max-w-sm" style={{ background: TEAL_LIGHT, border: `1px solid ${GOLD}44` }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2" style={{ color: GOLD_LIGHT }}>
              <Crown className="h-5 w-5" style={{ color: GOLD }} />
              Generate Your Collab Code
            </DialogTitle>
            <DialogDescription style={{ color: `${GOLD}88` }}>
              {selectedCoupon && (
                <>For <strong style={{ color: GOLD_LIGHT }}>{selectedCoupon.products?.name ?? "this product"}</strong></>
              )}
            </DialogDescription>
          </DialogHeader>

          {!generatedCode ? (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block" style={{ color: GOLD_LIGHT }}>Your Mobile Number</label>
                <Input
                  type="tel"
                  placeholder="Enter 10-digit mobile"
                  value={mobile}
                  onChange={e => { setMobile(e.target.value); setMobileError(""); }}
                  maxLength={10}
                  style={{ background: `${GOLD}10`, borderColor: `${GOLD}44`, color: GOLD_PALE }}
                />
                {mobileError && <p className="text-xs text-red-400 mt-1">{mobileError}</p>}
                <p className="text-xs mt-1" style={{ color: `${GOLD}77` }}>
                  4 digits from your number will be added to create a unique code.
                </p>
              </div>
              <button
                className="w-full py-2.5 rounded-lg font-semibold text-sm transition-opacity hover:opacity-80 disabled:opacity-50"
                style={{ background: `linear-gradient(135deg, ${GOLD} 0%, ${GOLD_LIGHT} 100%)`, color: TEAL }}
                onClick={generateCollabCode}
                disabled={collabLoading || !mobile}
              >
                {collabLoading ? "Generating..." : "Generate Code"}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div
                className="rounded-xl p-4 text-center"
                style={{ background: `${GOLD}15`, border: `1px solid ${GOLD}55` }}
              >
                <p className="text-xs mb-1" style={{ color: `${GOLD}88` }}>Your Personal Collab Code</p>
                <p className="font-mono text-2xl font-bold tracking-widest" style={{ color: GOLD_LIGHT }}>{generatedCode}</p>
              </div>

              {selectedCoupon && (
                <div className="rounded-lg p-3 space-y-1 text-xs" style={{ background: `${GOLD}0d` }}>
                  <div className="flex justify-between">
                    <span style={{ color: `${GOLD}88` }}>Customer gets</span>
                    <span className="font-semibold" style={{ color: GOLD_LIGHT }}>
                      {formatDiscount(selectedCoupon.customer_discount_type, selectedCoupon.customer_discount_value)} off
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: `${GOLD}88` }}>You earn (after 7 days)</span>
                    <span className="font-semibold" style={{ color: GOLD_LIGHT }}>
                      {formatDiscount(selectedCoupon.agent_margin_type, selectedCoupon.agent_margin_value)}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  className="flex-1 flex items-center justify-center gap-1.5 text-sm font-semibold py-2 rounded-lg border transition-opacity hover:opacity-80"
                  style={{ borderColor: `${GOLD}55`, color: GOLD_LIGHT, background: `${GOLD}10` }}
                  onClick={() => copyCode()}
                >
                  {copied ? <CheckCheck className="h-4 w-4" style={{ color: GOLD }} /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copied!" : "Copy"}
                </button>
                <button
                  className="flex-1 flex items-center justify-center gap-1.5 text-sm font-semibold py-2 rounded-lg text-white transition-opacity hover:opacity-80"
                  style={{ background: "#25D366" }}
                  onClick={() => shareWhatsApp()}
                >
                  <Share2 className="h-4 w-4" />
                  WhatsApp
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PennyPrime;
