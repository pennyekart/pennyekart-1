import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import carbsLogo from "@/assets/carbs-logo.png";

interface CarbItem {
  name: string;
  image_url: string;
  price?: number;
}

const fetchItems = async (): Promise<{ enabled: boolean; items: CarbItem[] }> => {
  const { data, error } = await supabase.functions.invoke("pennycarbs-items");
  if (error || !data) return { enabled: false, items: [] };
  return data as { enabled: boolean; items: CarbItem[] };
};

const CarbsBannerStrip = () => {
  const navigate = useNavigate();
  const [idx, setIdx] = useState(0);

  const { data } = useQuery({
    queryKey: ["pennycarbs-items"],
    queryFn: fetchItems,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const items = data?.items ?? [];

  useEffect(() => {
    if (items.length < 2) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % items.length), 3000);
    return () => clearInterval(id);
  }, [items.length]);

  if (!data?.enabled || items.length === 0) return null;

  const active = items[idx % items.length];

  return (
    <section className="px-2 pt-2">
      <div className="container px-0">
        <button
          onClick={() => navigate("/pennycarbs")}
          className="group relative flex w-full items-stretch gap-3 overflow-hidden rounded-xl border border-accent/40 bg-card text-left shadow-sm transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-accent"
        >
          {/* Image (rotates) */}
          <div className="relative h-20 w-20 shrink-0 overflow-hidden bg-muted sm:h-28 sm:w-28">
            {items.map((it, i) => (
              <img
                key={it.image_url + i}
                src={it.image_url}
                alt={it.name}
                loading="lazy"
                className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
                  i === idx ? "opacity-100" : "opacity-0"
                }`}
              />
            ))}
          </div>

          {/* Text */}
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 py-2 pr-2">
            <div className="flex items-center gap-2">
              <img src={carbsLogo} alt="Penny Carbs" className="h-3.5 sm:h-4" />
              <span className="font-serif text-sm font-semibold text-foreground sm:text-base">
                Penny Carbs
              </span>
              <span className="hidden text-xs text-muted-foreground sm:inline">
                · Food Delivery
              </span>
            </div>
            <div className="truncate text-sm font-medium text-foreground sm:text-base">
              {active.name}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {active.price != null && (
                <span className="font-semibold text-accent">₹{active.price}</span>
              )}
              <span className="ml-auto inline-flex items-center gap-0.5 font-medium text-primary group-hover:underline">
                Order now <ChevronRight className="h-3.5 w-3.5" />
              </span>
            </div>

            {/* Dots */}
            {items.length > 1 && (
              <div className="mt-1 flex gap-1">
                {items.map((_, i) => (
                  <span
                    key={i}
                    className={`h-1 rounded-full transition-all ${
                      i === idx ? "w-4 bg-accent" : "w-1 bg-muted-foreground/30"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </button>
      </div>
    </section>
  );
};

export default CarbsBannerStrip;