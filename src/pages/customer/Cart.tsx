import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Minus, Plus, Trash2, ShieldCheck, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const Cart = () => {
  const navigate = useNavigate();
  const { items, updateQuantity, removeItem, clearCart, totalPrice, totalItems } = useCart();
  const { user } = useAuth();
  const [showPayment, setShowPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [placingOrder, setPlacingOrder] = useState(false);

  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number; collabId?: string } | null>(null);
  const [couponError, setCouponError] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [useWallet, setUseWallet] = useState(false);
  const [walletBalance] = useState(0); // TODO: fetch from user wallet

  const totalMrp = items.reduce((s, i) => s + i.mrp * i.quantity, 0);
  const totalDiscount = totalMrp - totalPrice;
  const platformFee = items.length > 0 ? 7 : 0;
  const couponDiscount = appliedCoupon?.discount ?? 0;
  const walletDeduction = useWallet ? Math.min(walletBalance, totalPrice + platformFee - couponDiscount) : 0;
  const finalAmount = totalPrice + platformFee - couponDiscount - walletDeduction;
  const hasComingSoonItems = items.some(i => i.coming_soon);

  const handleApplyCoupon = async () => {
    setCouponError("");
    const code = couponCode.trim().toUpperCase();
    if (!code) return;
    setCouponLoading(true);
    try {
      // Look up penny prime collab code
      const { data: collab, error } = await supabase
        .from("penny_prime_collabs")
        .select(`
          id, collab_code,
          penny_prime_coupons (
            customer_discount_type, customer_discount_value,
            products (id, name, price)
          )
        `)
        .eq("collab_code", code)
        .maybeSingle();

      if (error || !collab) {
        setCouponError("Invalid or expired coupon code");
        setCouponLoading(false);
        return;
      }

      const coupon = (collab as any).penny_prime_coupons;
      if (!coupon) { setCouponError("Coupon not found"); setCouponLoading(false); return; }

      // Calculate discount
      let discount = 0;
      if (coupon.customer_discount_type === "amount") {
        discount = coupon.customer_discount_value;
      } else {
        discount = (totalPrice * coupon.customer_discount_value) / 100;
      }
      discount = Math.min(discount, totalPrice);

      setAppliedCoupon({ code, discount, collabId: collab.id });
    } catch {
      setCouponError("Failed to validate coupon");
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode("");
    setCouponError("");
  };

  const handlePlaceOrder = () => {
    if (!user) {
      toast.error("Please login to place an order");
      navigate("/customer/login");
      return;
    }
    setShowPayment(true);
  };

  const handleConfirmOrder = async () => {
    setPlacingOrder(true);
    try {
      // Split items by source: micro godown (products) vs area godown (seller_products)
      const microItems = items.filter(i => i.source !== "seller_product");
      const sellerItemsBySeller = new Map<string, typeof items>();

      items
        .filter(i => i.source === "seller_product")
        .forEach(i => {
          const sellerId = i.seller_id || "unknown";
          if (!sellerItemsBySeller.has(sellerId)) {
            sellerItemsBySeller.set(sellerId, []);
          }
          sellerItemsBySeller.get(sellerId)!.push(i);
        });

      const mapOrderItems = (orderItems: typeof items) =>
        orderItems.map(i => ({
          id: i.id,
          name: i.name,
          price: i.price,
          mrp: i.mrp,
          quantity: i.quantity,
          image: i.image,
          source: i.source || "product",
        }));

      const calcTotal = (orderItems: typeof items) => {
        const itemsTotal = orderItems.reduce((s, i) => s + i.price * i.quantity, 0);
        // Distribute platform fee and discounts proportionally
        const proportion = itemsTotal / totalPrice;
        const proportionalCoupon = couponDiscount * proportion;
        const proportionalWallet = walletDeduction * proportion;
        // Platform fee only on the first order (micro), or split
        return Math.max(0, itemsTotal - proportionalCoupon - proportionalWallet);
      };

      const ordersToInsert: any[] = [];

      // Micro godown order (regular flow)
      if (microItems.length > 0) {
        const microTotal = calcTotal(microItems) + (sellerItemsBySeller.size > 0 ? platformFee / 2 : platformFee);
        ordersToInsert.push({
          user_id: user!.id,
          items: mapOrderItems(microItems),
          total: microTotal,
          status: "pending",
          shipping_address: paymentMethod === "cod" ? "Cash on Delivery" : paymentMethod,
        });
      }

      // Area godown orders (one per seller, starts with seller_confirmation_pending)
      for (const [sellerId, sellerItems] of sellerItemsBySeller) {
        const sellerTotal = calcTotal(sellerItems) + (microItems.length > 0 ? platformFee / 2 : platformFee) / sellerItemsBySeller.size;
        ordersToInsert.push({
          user_id: user!.id,
          items: mapOrderItems(sellerItems),
          total: sellerTotal,
          status: "seller_confirmation_pending",
          shipping_address: paymentMethod === "cod" ? "Cash on Delivery" : paymentMethod,
          seller_id: sellerId === "unknown" ? null : sellerId,
        });
      }

      // Insert all orders and capture first order id
      let firstOrderId: string | null = null;
      for (const order of ordersToInsert) {
        const { data: insertedOrder, error } = await supabase.from("orders").insert(order).select("id").single();
        if (error) throw error;
        if (!firstOrderId && insertedOrder) firstOrderId = insertedOrder.id;
      }

      // Record penny prime coupon use if applied
      if (appliedCoupon?.collabId && firstOrderId && user) {
        await supabase.from("penny_prime_coupon_uses").insert({
          collab_id: appliedCoupon.collabId,
          order_id: firstOrderId,
          customer_user_id: user.id,
          discount_amount: couponDiscount,
          agent_margin_amount: 0, // will be calculated by admin on payout
        });
      }

      clearCart();
      setShowPayment(false);
      const orderCount = ordersToInsert.length;
      toast.success(
        orderCount > 1
          ? `${orderCount} orders placed successfully! Micro godown items ship directly. Seller items await seller confirmation.`
          : "Order placed successfully!"
      );
      navigate("/");
    } catch (err: any) {
      toast.error(err.message || "Failed to place order");
    } finally {
      setPlacingOrder(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
        <p className="text-lg text-muted-foreground">Your cart is empty</p>
        <Button onClick={() => navigate("/")}>Continue Shopping</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted">
      {/* Header */}
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-background px-4 py-3 shadow-sm">
        <button onClick={() => navigate(-1)} className="text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-base font-semibold text-foreground">Cart ({totalItems})</h1>
      </header>

      <div className="container max-w-5xl py-4 px-3 md:px-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          {/* Left: Cart Items */}
          <div className="flex-1 rounded-lg border border-border bg-card shadow-sm">
            {/* Items */}
            <div className="divide-y divide-border">
              {hasComingSoonItems && (
                <div className="flex items-center gap-2 bg-warning/10 border-b border-warning/30 px-4 py-3">
                  <Clock className="h-4 w-4 shrink-0 text-warning" />
                  <p className="text-sm font-medium text-warning">
                    Some items are marked <strong>Coming Soon</strong> and cannot be ordered yet. Please remove them to proceed.
                  </p>
                </div>
              )}
              {items.map(item => (
                <div key={item.id} className="p-4">
                  <div className="flex gap-4">
                    {/* Image */}
                    <img
                      src={item.image || "/placeholder.svg"}
                      alt={item.name}
                      className="h-24 w-24 shrink-0 cursor-pointer rounded-md object-cover bg-muted"
                      onClick={() => navigate(`/product/${item.id}`)}
                    />
                    {/* Info */}
                    <div className="flex flex-1 flex-col gap-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="line-clamp-2 text-sm text-foreground">{item.name}</span>
                        {item.coming_soon && (
                          <span className="flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-bold text-warning border border-warning/30">
                            <Clock className="h-3 w-3" /> Coming Soon
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-baseline gap-2">
                        {item.mrp > item.price && (
                          <span className="text-xs text-muted-foreground line-through">₹{item.mrp}</span>
                        )}
                        <span className="text-base font-bold text-foreground">₹{item.price}</span>
                        {item.mrp > item.price && (
                          <span className="text-xs font-medium text-secondary">
                            {Math.round(((item.mrp - item.price) / item.mrp) * 100)}% off
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Quantity & actions */}
                  <div className="mt-3 flex items-center gap-3">
                    <div className="flex items-center rounded-md border border-border">
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="flex h-8 w-8 items-center justify-center text-muted-foreground hover:bg-muted"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="flex h-8 w-10 items-center justify-center border-x border-border text-sm font-semibold">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="flex h-8 w-8 items-center justify-center text-muted-foreground hover:bg-muted"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="text-sm font-semibold uppercase tracking-wide text-muted-foreground hover:text-destructive"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Place Order - bottom of left card (mobile) */}
            <div className="border-t border-border p-4 lg:hidden">
              <Button className="w-full text-base font-semibold py-5" onClick={handlePlaceOrder} disabled={hasComingSoonItems}>Place Order</Button>
            </div>
          </div>

          {/* Right: Price Details */}
          <div className="w-full lg:w-80 shrink-0 space-y-4">
            {/* Coupon Code */}
            <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Apply Coupon
              </h2>
              {appliedCoupon ? (
                <div className="flex items-center justify-between rounded-md border border-secondary/30 bg-secondary/10 px-3 py-2">
                  <div>
                    <span className="text-sm font-semibold text-foreground">{appliedCoupon.code}</span>
                    <p className="text-xs text-secondary">You save ₹{appliedCoupon.discount.toFixed(2)}</p>
                  </div>
                  <button onClick={handleRemoveCoupon} className="text-xs font-semibold uppercase text-destructive hover:underline">Remove</button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    placeholder="Enter coupon code"
                    className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <Button size="sm" variant="outline" onClick={handleApplyCoupon} disabled={!couponCode.trim()}>
                    Apply
                  </Button>
                </div>
              )}
              {couponError && <p className="mt-1.5 text-xs text-destructive">{couponError}</p>}
            </div>

            {/* Wallet */}
            <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Wallet</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Balance: ₹{walletBalance.toFixed(2)}</p>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useWallet}
                    onChange={(e) => setUseWallet(e.target.checked)}
                    disabled={walletBalance <= 0}
                    className="h-4 w-4 rounded border-border text-primary accent-primary"
                  />
                  <span className="text-sm text-foreground">Use Wallet</span>
                </label>
              </div>
              {useWallet && walletDeduction > 0 && (
                <p className="mt-1.5 text-xs text-secondary">₹{walletDeduction.toFixed(2)} will be deducted from wallet</p>
              )}
            </div>

            {/* Price Details */}
            <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Price Details
              </h2>
              <Separator className="mb-3" />

              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-foreground">MRP ({totalItems} items)</span>
                  <span className="text-foreground">₹{totalMrp.toFixed(2)}</span>
                </div>
                {totalDiscount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-foreground">Discount on MRP</span>
                    <span className="font-medium text-secondary">− ₹{totalDiscount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-foreground">Platform Fee</span>
                  <span className="text-foreground">₹{platformFee}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground">Delivery Charges</span>
                  <span className="font-medium text-secondary">Free</span>
                </div>
                {couponDiscount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-foreground">Coupon Discount</span>
                    <span className="font-medium text-secondary">− ₹{couponDiscount.toFixed(2)}</span>
                  </div>
                )}
                {walletDeduction > 0 && (
                  <div className="flex justify-between">
                    <span className="text-foreground">Wallet</span>
                    <span className="font-medium text-secondary">− ₹{walletDeduction.toFixed(2)}</span>
                  </div>
                )}
              </div>

              <Separator className="my-3" />

              <div className="flex justify-between text-base font-bold">
                <span className="text-foreground">Total Amount</span>
                <span className="text-foreground">₹{finalAmount.toFixed(2)}</span>
              </div>

              {(totalDiscount + couponDiscount + walletDeduction) > 0 && (
                <p className="mt-2 text-xs font-medium text-secondary">
                  You will save ₹{(totalDiscount + couponDiscount + walletDeduction).toFixed(2)} on this order
                </p>
              )}
            </div>

            {/* Place Order - desktop */}
            <div className="hidden lg:block">
              <Button className="w-full text-base font-semibold py-5" onClick={handlePlaceOrder} disabled={hasComingSoonItems}>Place Order</Button>
            </div>

            {/* Trust badge */}
            <div className="flex items-start gap-2 rounded-lg border border-border bg-card p-3 text-xs text-muted-foreground shadow-sm">
              <ShieldCheck className="h-5 w-5 shrink-0 text-muted-foreground" />
              <span>Safe and Secure Payments. Easy returns. 100% Authentic products.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Method Dialog */}
      <Dialog open={showPayment} onOpenChange={setShowPayment}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Select Payment Method</DialogTitle>
            <DialogDescription>Choose how you'd like to pay for your order.</DialogDescription>
          </DialogHeader>
          <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="gap-3 py-2">
            <div className="flex items-center space-x-3 rounded-lg border border-border p-3">
              <RadioGroupItem value="cod" id="cod" />
              <Label htmlFor="cod" className="flex-1 cursor-pointer">
                <span className="font-medium">Cash on Delivery</span>
                <p className="text-xs text-muted-foreground">Pay when your order arrives</p>
              </Label>
            </div>
          </RadioGroup>
          <div className="flex justify-between text-sm font-bold pt-2">
            <span>Total: </span>
            <span>₹{finalAmount.toFixed(2)}</span>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPayment(false)}>Cancel</Button>
            <Button onClick={handleConfirmOrder} disabled={placingOrder}>
              {placingOrder ? "Placing..." : "Confirm Order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Cart;
