import { useCart } from "@/hooks/useCart";
import { useNavigate } from "react-router-dom";
import { ShoppingCart, ArrowRight, X } from "lucide-react";
import { useState } from "react";

const CartReminderBanner = () => {
  const { totalItems, totalPrice } = useCart();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  if (totalItems === 0 || dismissed) return null;

  return (
    <div className="sticky top-0 z-40 mx-3 mt-2 mb-1 rounded-xl bg-primary/10 border border-primary/20 p-3 flex items-center gap-3 animate-in slide-in-from-top-2 duration-300 backdrop-blur-sm">
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
        <ShoppingCart className="w-5 h-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">
          You have {totalItems} item{totalItems > 1 ? "s" : ""} in your cart
        </p>
        <p className="text-xs text-muted-foreground">
          Total: ₹{totalPrice.toFixed(2)} — Complete your order!
        </p>
      </div>
      <button
        onClick={() => navigate("/cart")}
        className="flex-shrink-0 bg-primary text-primary-foreground text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1"
      >
        View <ArrowRight className="w-3 h-3" />
      </button>
      <button
        onClick={() => setDismissed(true)}
        className="flex-shrink-0 p-1 text-muted-foreground hover:text-foreground"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export default CartReminderBanner;
