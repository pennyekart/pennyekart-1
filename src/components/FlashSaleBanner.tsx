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
          className="relative overflow-hidden cursor-pointer shadow-2xl"
          style={{ background: `linear-gradient(120deg, ${sale.banner_color} 0%, ${sale.banner_color}ee 40%, ${sale.banner_color}bb 70%, ${sale.banner_color} 100%)` }}
          onClick={() => navigate(`/flash-sale/${sale.id}`)}
        >
          {/* Animated shimmer sweep */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-8 -left-8 w-40 h-40 rounded-full opacity-30 animate-pulse" style={{ background: "radial-gradient(circle, white 0%, transparent 70%)" }} />
            <div className="absolute -bottom-8 -right-8 w-48 h-48 rounded-full opacity-20 animate-pulse" style={{ background: "radial-gradient(circle, white 0%, transparent 70%)", animationDelay: "1s" }} />
            <div
              className="absolute inset-y-0 -left-1/2 w-1/2 opacity-30"
              style={{
                background: "linear-gradient(115deg, transparent 0%, rgba(255,255,255,0.5) 50%, transparent 100%)",
                animation: "flash-shimmer 3s linear infinite",
              }}
            />
            <style>{`@keyframes flash-shimmer { 0% { transform: translateX(0); } 100% { transform: translateX(400%); } }`}</style>
          </div>

          {/* Top + bottom accent strips */}
          <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-white/80 to-transparent" />
          <div className="absolute bottom-0 inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-white/60 to-transparent" />

          <div className="relative px-3 py-3 md:px-6 md:py-4">
            <div className="flex items-center justify-between gap-3">
              {/* Left: Icon + Title */}
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="relative flex items-center justify-center shrink-0 h-9 w-9 md:h-11 md:w-11 rounded-full bg-white/25 backdrop-blur-sm border border-white/40 shadow-lg">
                  <Zap className="h-5 w-5 md:h-6 md:w-6 text-primary-foreground fill-current animate-pulse drop-shadow" />
                  <span className="absolute inset-0 rounded-full bg-white/30 animate-ping opacity-40" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-block text-[9px] md:text-[10px] font-black tracking-[0.2em] text-primary-foreground/90 bg-black/30 px-1.5 py-0.5 rounded uppercase">
                      ⚡ Flash Sale
                    </span>
                  </div>
                  <h3 className="text-sm md:text-lg font-black text-primary-foreground truncate uppercase tracking-wide drop-shadow leading-tight mt-0.5">
                    {sale.title}
                  </h3>
                  <p className="text-[10px] md:text-xs text-primary-foreground/90 truncate font-semibold">
                    {(saleProducts?.[sale.id] ?? 0)} products · Tap to shop now →
                  </p>
                </div>
              </div>

              {/* Center: Countdown */}
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className="text-[9px] md:text-[10px] font-bold text-primary-foreground/90 uppercase tracking-wider">Ends in</span>
                <CountdownTimer endTime={sale.end_time} />
              </div>

              {/* Right: Dismiss */}
              <button
                onClick={e => { e.stopPropagation(); setDismissed(d => [...d, sale.id]); }}
                className="shrink-0 p-1 rounded-full hover:bg-primary-foreground/20 transition-colors self-start"
              >
                <X className="h-3.5 w-3.5 text-primary-foreground/80" />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default FlashSaleBanner;
