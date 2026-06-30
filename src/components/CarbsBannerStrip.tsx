import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

interface CarbItem {
  id: string;
  name: string;
  price: number;
  image_url: string;
}

const fetchCarbs = async (): Promise<CarbItem[]> => {
  const { data, error } = await supabase.functions.invoke("pennycarbs-items", { body: {} });
  if (error) return [];
  return (data as any)?.items ?? [];
};

const CarbsBannerStrip = () => {
  const navigate = useNavigate();
  const [idx, setIdx] = useState(0);

  const { data: items = [] } = useQuery({
    queryKey: ["pennycarbs-banner-items"],
    queryFn: fetchCarbs,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  useEffect(() => {
    if (items.length < 2) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % items.length), 3000);
    return () => clearInterval(t);
  }, [items.length]);

  if (!items.length) return null;
  const item = items[idx];

  return (
    <button
      onClick={() => navigate("/pennycarbs")}
      className="block w-full px-2"
      aria-label="Open Penny Carbs"
    >
      <div className="relative overflow-hidden rounded-xl shadow-md bg-gradient-to-r from-amber-500/90 to-orange-600/90 text-white h-24 sm:h-28">
        <img
          key={item.id}
          src={item.image_url}
          alt={item.name}
          className="absolute right-0 top-0 h-full w-1/2 object-cover opacity-90 transition-opacity duration-700"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent" />
        <div className="relative z-10 h-full flex flex-col justify-center px-4">
          <span className="text-[10px] uppercase tracking-widest opacity-90">Penny Carbs</span>
          <span className="text-base sm:text-lg font-semibold leading-tight line-clamp-1">{item.name}</span>
          <span className="text-sm font-medium">₹{item.price}</span>
        </div>
      </div>
    </button>
  );
};

export default CarbsBannerStrip;