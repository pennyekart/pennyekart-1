import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Zap, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface FlashSale {
  id: string;
  title: string;
  description: string | null;
  banner_color: string;
  start_time: string;
  end_time: string;
}

interface FlashProduct {
  id: string;
  flash_price: number;
  flash_mrp: number;
  product_id: string | null;
  seller_product_id: string | null;
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
    <div className="flex items-center gap-1.5">
      {[
        { val: timeLeft.h, label: "HRS" },
        { val: timeLeft.m, label: "MIN" },
        { val: timeLeft.s, label: "SEC" },
      ].map((t, i) => (
        <div key={i} className="flex items-center gap-1">
          {i > 0 && <span className="text-base font-black text-primary-foreground/90 -mt-2">:</span>}
          <div className="bg-black/40 backdrop-blur-md rounded-lg px-2 py-1 md:px-2.5 md:py-1.5 min-w-[36px] md:min-w-[44px] text-center border border-white/20 shadow-lg">
            <span className="block text-base md:text-xl font-black tabular-nums text-primary-foreground leading-none">{pad(t.val)}</span>
            <span className="block text-[8px] md:text-[9px] font-bold tracking-widest text-primary-foreground/70 mt-0.5">{t.label}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

const FlashSaleBanner = () => {
  const [dismissed, setDismissed] = useState<string[]>([]);
  const navigate = useNavigate();

  const { data: activeSales } = useQuery({
    queryKey: ["flash-sales-active"],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data } = await supabase
        .from("flash_sales")
        .select("id, title, description, banner_color, start_time, end_time")
        .eq("is_active", true)
        .lte("start_time", now)
        .gte("end_time", now)
        .order("start_time");
      return (data as FlashSale[]) ?? [];
    },
    refetchInterval: 60000,
    staleTime: 30000,
  });

  const { data: saleProducts } = useQuery({
    queryKey: ["flash-sale-products-count", activeSales?.map(s => s.id)],
    queryFn: async () => {
      if (!activeSales?.length) return {};
      const result: Record<string, number> = {};
      for (const sale of activeSales) {
        const { count } = await supabase
          .from("flash_sale_products")
          .select("id", { count: "exact", head: true })
          .eq("flash_sale_id", sale.id);
        result[sale.id] = count ?? 0;
      }
      return result;
    },
    enabled: !!activeSales?.length,
    staleTime: 60000,
  });

  const visibleSales = useMemo(
    () => (activeSales ?? []).filter(s => !dismissed.includes(s.id) && (saleProducts?.[s.id] ?? 0) > 0),
    [activeSales, dismissed, saleProducts]
  );

  if (visibleSales.length === 0) return null;

  return (
    <div className="space-y-0">
      {visibleSales.map(sale => (
        <div
          key={sale.id}
          className="relative overflow-hidden cursor-pointer"
          style={{ background: `linear-gradient(135deg, ${sale.banner_color}, ${sale.banner_color}dd, ${sale.banner_color}99)` }}
          onClick={() => navigate(`/flash-sale/${sale.id}`)}
        >
          {/* Animated background effects */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-4 -left-4 w-24 h-24 rounded-full opacity-20 animate-pulse" style={{ background: "radial-gradient(circle, white 0%, transparent 70%)" }} />
            <div className="absolute -bottom-4 -right-4 w-32 h-32 rounded-full opacity-15 animate-pulse" style={{ background: "radial-gradient(circle, white 0%, transparent 70%)", animationDelay: "1s" }} />
          </div>

          <div className="relative px-3 py-2 md:px-6 md:py-2.5">
            <div className="flex items-center justify-between gap-2">
              {/* Left: Icon + Title */}
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className="flex items-center justify-center shrink-0">
                  <Zap className="h-4 w-4 md:h-5 md:w-5 text-primary-foreground fill-current animate-pulse" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs md:text-sm font-bold text-primary-foreground truncate uppercase tracking-wide">
                      {sale.title}
                    </h3>
                    {sale.description && (
                      <span className="hidden md:inline text-[10px] text-primary-foreground/80 truncate">
                        {sale.description}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-primary-foreground/70 md:hidden truncate">
                    {saleProducts?.[sale.id] ?? 0} products on sale
                  </p>
                </div>
              </div>

              {/* Center: Countdown */}
              <div className="flex items-center gap-2 shrink-0">
                <span className="hidden md:inline text-[10px] text-primary-foreground/80 uppercase tracking-wider">Ends in</span>
                <CountdownTimer endTime={sale.end_time} />
              </div>

              {/* Right: Dismiss */}
              <button
                onClick={e => { e.stopPropagation(); setDismissed(d => [...d, sale.id]); }}
                className="shrink-0 p-1 rounded-full hover:bg-primary-foreground/20 transition-colors"
              >
                <X className="h-3 w-3 text-primary-foreground/70" />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default FlashSaleBanner;
