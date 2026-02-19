import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ArrowLeft, Tag, Users, Share2, Copy, CheckCheck, Handshake } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

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
  products: {
    id: string;
    name: string;
    price: number;
    mrp: number;
    image_url: string | null;
  } | null;
  profiles: {
    full_name: string | null;
    company_name: string | null;
  } | null;
}

const PennyPrime = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [coupons, setCoupons] = useState<CouponListing[]>([]);
  const [loading, setLoading] = useState(true);

  // Collab dialog state
  const [collabDialogOpen, setCollabDialogOpen] = useState(false);
  const [selectedCoupon, setSelectedCoupon] = useState<CouponListing | null>(null);
  const [mobile, setMobile] = useState("");
  const [mobileError, setMobileError] = useState("");
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [collabLoading, setCollabLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchCoupons = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("penny_prime_coupons")
      .select(`
        *,
        products (id, name, price, mrp, image_url),
        profiles!penny_prime_coupons_seller_id_fkey (full_name, company_name)
      `)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
    } else {
      setCoupons((data as any) ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCoupons();
  }, []);

  const openCollab = (coupon: CouponListing) => {
    if (!user) {
      toast.error("Please login to collaborate");
      navigate("/customer/login");
      return;
    }
    setSelectedCoupon(coupon);
    setMobile("");
    setGeneratedCode(null);
    setMobileError("");
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
      // Take 4 digits from mobile: first 2 + last 2
      const mobilePart = cleanMobile.slice(0, 2) + cleanMobile.slice(-2);
      const collabCode = `${selectedCoupon.seller_code}-${mobilePart}`;

      // Check if code already exists for this collab
      const { data: existing } = await supabase
        .from("penny_prime_collabs")
        .select("collab_code")
        .eq("collab_code", collabCode)
        .maybeSingle();

      if (existing) {
        // Code already created — show it
        setGeneratedCode(collabCode);
        setCollabLoading(false);
        return;
      }

      // Insert new collab
      const { error } = await supabase.from("penny_prime_collabs").insert({
        coupon_id: selectedCoupon.id,
        agent_user_id: user.id,
        agent_mobile: cleanMobile,
        collab_code: collabCode,
      });

      if (error) throw error;

      setGeneratedCode(collabCode);
    } catch (err: any) {
      toast.error(err.message || "Failed to generate code");
    } finally {
      setCollabLoading(false);
    }
  };

  const copyCode = async () => {
    if (!generatedCode) return;
    await navigator.clipboard.writeText(generatedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareWhatsApp = () => {
    if (!generatedCode || !selectedCoupon) return;
    const product = selectedCoupon.products;
    const discountText =
      selectedCoupon.customer_discount_type === "percent"
        ? `${selectedCoupon.customer_discount_value}% off`
        : `₹${selectedCoupon.customer_discount_value} off`;
    const msg = `🌟 *Penny Prime Deal!*\n\nProduct: ${product?.name ?? "Special Product"}\n💰 Discount: ${discountText}\n\nUse my exclusive code: *${generatedCode}*\n\nShop on Pennyekart and save big! 🛒`;
    const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  };

  const formatDiscount = (type: string, value: number) =>
    type === "percent" ? `${value}%` : `₹${value}`;

  const sellerName = (c: CouponListing) =>
    c.profiles?.company_name || c.profiles?.full_name || "Seller";

  return (
    <div className="min-h-screen bg-muted">
      {/* Header */}
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-background px-4 py-3 shadow-sm">
        <button onClick={() => navigate(-1)} className="text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-base font-bold text-foreground">Penny Prime</h1>
          <p className="text-xs text-muted-foreground">Collaborate & Earn</p>
        </div>
      </header>

      {/* Hero Banner */}
      <div className="bg-gradient-to-br from-primary to-primary/70 px-4 py-8 text-primary-foreground text-center">
        <div className="flex justify-center mb-2">
          <Handshake className="h-10 w-10 opacity-90" />
        </div>
        <h2 className="text-xl font-bold mb-1">Become a Penny Prime Agent</h2>
        <p className="text-sm opacity-80 max-w-xs mx-auto">
          Pick a deal, generate your personal code, share it — earn margin when your referral delivers!
        </p>
      </div>

      <div className="container max-w-2xl px-3 py-5 space-y-4">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-36 rounded-xl bg-card animate-pulse" />
            ))}
          </div>
        ) : coupons.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Tag className="mx-auto h-10 w-10 mb-3 opacity-40" />
            <p>No active Penny Prime deals right now.</p>
            <p className="text-sm mt-1">Check back soon!</p>
          </div>
        ) : (
          coupons.map(coupon => (
            <Card key={coupon.id} className="overflow-hidden shadow-sm">
              <CardHeader className="pb-0 pt-4 px-4">
                <div className="flex items-start gap-3">
                  {coupon.products?.image_url ? (
                    <img
                      src={coupon.products.image_url}
                      alt={coupon.products.name}
                      className="h-16 w-16 rounded-lg object-cover border border-border flex-shrink-0"
                    />
                  ) : (
                    <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 border border-border">
                      <Tag className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground font-medium">{sellerName(coupon)}</p>
                    <h3 className="font-semibold text-foreground text-sm line-clamp-2">
                      {coupon.products?.name ?? "Special Product"}
                    </h3>
                    {coupon.products && coupon.products.mrp > coupon.products.price && (
                      <div className="flex items-baseline gap-1.5 mt-0.5">
                        <span className="text-xs text-muted-foreground line-through">₹{coupon.products.mrp}</span>
                        <span className="text-sm font-bold text-foreground">₹{coupon.products.price}</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-4 pt-3 pb-4">
                <div className="flex flex-wrap gap-2 mb-3">
                  <Badge variant="secondary" className="text-xs gap-1">
                    <Tag className="h-3 w-3" />
                    Customer saves {formatDiscount(coupon.customer_discount_type, coupon.customer_discount_value)}
                  </Badge>
                  <Badge className="text-xs gap-1 bg-primary/15 text-primary border-primary/20">
                    <Users className="h-3 w-3" />
                    You earn {formatDiscount(coupon.agent_margin_type, coupon.agent_margin_value)}
                  </Badge>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    Code: <span className="font-mono font-bold text-foreground">{coupon.seller_code}</span>
                  </p>
                  <Button size="sm" onClick={() => openCollab(coupon)} className="gap-1.5">
                    <Handshake className="h-3.5 w-3.5" />
                    Collab
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Collab Dialog */}
      <Dialog open={collabDialogOpen} onOpenChange={setCollabDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Handshake className="h-5 w-5 text-primary" />
              Generate Your Collab Code
            </DialogTitle>
            <DialogDescription>
              {selectedCoupon && (
                <>For <strong>{selectedCoupon.products?.name ?? "this product"}</strong></>
              )}
            </DialogDescription>
          </DialogHeader>

          {!generatedCode ? (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Your Mobile Number</label>
                <Input
                  type="tel"
                  placeholder="Enter 10-digit mobile"
                  value={mobile}
                  onChange={e => { setMobile(e.target.value); setMobileError(""); }}
                  maxLength={10}
                />
                {mobileError && <p className="text-xs text-destructive mt-1">{mobileError}</p>}
                <p className="text-xs text-muted-foreground mt-1">
                  4 digits from your number will be added to create a unique code.
                </p>
              </div>
              <Button className="w-full" onClick={generateCollabCode} disabled={collabLoading || !mobile}>
                {collabLoading ? "Generating..." : "Generate Code"}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Your Personal Collab Code</p>
                <p className="font-mono text-2xl font-bold text-primary tracking-widest">{generatedCode}</p>
              </div>

              {selectedCoupon && (
                <div className="rounded-lg bg-muted p-3 space-y-1 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Customer gets</span>
                    <span className="font-semibold text-foreground">
                      {formatDiscount(selectedCoupon.customer_discount_type, selectedCoupon.customer_discount_value)} off
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>You earn (after 7 days of delivery)</span>
                    <span className="font-semibold text-primary">
                      {formatDiscount(selectedCoupon.agent_margin_type, selectedCoupon.agent_margin_value)}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 gap-1.5" onClick={copyCode}>
                  {copied ? <CheckCheck className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copied!" : "Copy"}
                </Button>
                <Button className="flex-1 gap-1.5 bg-[#25D366] hover:bg-[#1ebe5d] text-white" onClick={shareWhatsApp}>
                  <Share2 className="h-4 w-4" />
                  WhatsApp
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PennyPrime;
