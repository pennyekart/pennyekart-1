import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import * as LucideIcons from "lucide-react";

interface GroceryCategory {
  id: string;
  name: string;
  icon: string | null;
  image_url: string | null;
}

const iconMap: Record<string, LucideIcons.LucideIcon> = {
  Apple: LucideIcons.Apple,
  Carrot: LucideIcons.Carrot,
  Milk: LucideIcons.Milk,
  Wheat: LucideIcons.Wheat,
  Fish: LucideIcons.Fish,
  Egg: LucideIcons.Egg,
  Cookie: LucideIcons.Cookie,
  Coffee: LucideIcons.Coffee,
  Citrus: LucideIcons.Citrus,
  Beef: LucideIcons.Beef,
  ShoppingBag: LucideIcons.ShoppingBag,
};

const fallbackIcon = LucideIcons.ShoppingBag;

interface GroceryCategoriesProps {
  onCategoryClick?: (categoryName: string) => void;
  selectedCategory?: string | null;
}

const GroceryCategories = ({ onCategoryClick, selectedCategory }: GroceryCategoriesProps) => {
  const [categories, setCategories] = useState<GroceryCategory[]>([]);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("categories")
        .select("id, name, icon, image_url")
        .eq("category_type", "grocery")
        .eq("is_active", true)
        .order("sort_order");
      setCategories((data as GroceryCategory[]) ?? []);
    };
    fetch();
  }, []);

  if (categories.length === 0) return null;

  const renderButton = (g: GroceryCategory, compact = false) => {
    const Icon = (g.icon && iconMap[g.icon]) || fallbackIcon;
    const isSelected = selectedCategory === g.name;
    return (
      <button
        key={g.id}
        onClick={() => onCategoryClick?.(g.name)}
        className={`group flex shrink-0 flex-col items-center gap-1.5 rounded-xl border bg-background transition-all ${
          compact ? "px-3 py-2.5" : "px-4 py-3 hover:shadow-md"
        } ${isSelected ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary"}`}
      >
        <div className={`flex items-center justify-center rounded-full transition-colors ${
          compact ? "h-11 w-11" : "h-12 w-12"
        } ${isSelected ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground"}`}>
          {g.image_url ? (
            <img src={g.image_url} alt={g.name} className={`rounded-full object-cover ${compact ? "h-11 w-11" : "h-12 w-12"}`} />
          ) : (
            <Icon className={compact ? "h-5 w-5" : "h-6 w-6"} />
          )}
        </div>
        <span className={`font-medium text-foreground ${compact ? "text-[11px]" : "text-xs font-semibold"}`}>{g.name}</span>
      </button>
    );
  };

  const half = Math.ceil(categories.length / 2);

  return (
    <section className="bg-card py-4">
      <div className="container">
        <h2 className="mb-3 font-heading text-lg font-bold text-foreground md:text-xl">
          Grocery & Essentials
        </h2>
        {/* Desktop */}
        <div className="hidden md:flex items-center gap-3 overflow-x-auto scrollbar-hide">
          {categories.map((g) => renderButton(g))}
        </div>
        {/* Mobile: two rows */}
        <div className="md:hidden space-y-2">
          <div className="flex gap-3 overflow-x-auto scrollbar-hide">
            {categories.slice(0, half).map((g) => renderButton(g, true))}
          </div>
          <div className="flex gap-3 overflow-x-auto scrollbar-hide">
            {categories.slice(half).map((g) => renderButton(g, true))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default GroceryCategories;
