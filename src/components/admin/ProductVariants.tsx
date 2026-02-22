import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";

interface Variant {
  id?: string;
  variant_label: string;
  variant_value: string;
  price: number;
  mrp: number;
  price_adjustment: number;
  stock: number;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
}

interface ProductVariantsProps {
  productId: string | null;
  variationType: string | null;
  basePrice: number;
  baseMrp: number;
}

const SIZE_PRESETS = ["S", "M", "L", "XL", "XXL", "XXXL"];
const COLOR_PRESETS = ["Red", "Blue", "Green", "Yellow", "Black", "White", "Pink", "Orange"];

const getVariationLabel = (type: string | null) => {
  switch (type) {
    case "size": return "Size";
    case "weight": return "Weight";
    case "color": return "Color";
    case "measurement": return "Measurement";
    default: return "Variant";
  }
};

const getPlaceholder = (type: string | null) => {
  switch (type) {
    case "size": return "e.g. S, M, L";
    case "weight": return "e.g. 100g, 500g, 1kg";
    case "color": return "e.g. Red, Blue";
    case "measurement": return "e.g. 10cm, 45inch";
    default: return "Variant value";
  }
};

const ProductVariants = ({ productId, variationType, basePrice, baseMrp }: ProductVariantsProps) => {
  const [variants, setVariants] = useState<Variant[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (productId) {
      fetchVariants();
    } else {
      setVariants([]);
    }
  }, [productId]);

  const fetchVariants = async () => {
    if (!productId) return;
    const { data } = await supabase
      .from("product_variants")
      .select("*")
      .eq("product_id", productId)
      .order("sort_order");
    if (data) {
      setVariants(data.map(v => ({
        id: v.id,
        variant_label: v.variant_label,
        variant_value: v.variant_value ?? "",
        price: v.price,
        mrp: v.mrp,
        price_adjustment: v.price_adjustment,
        stock: v.stock,
        is_default: v.is_default,
        is_active: v.is_active,
        sort_order: v.sort_order,
      })));
    }
  };

  const addVariant = (label?: string) => {
    const newVariant: Variant = {
      variant_label: label || "",
      variant_value: "",
      price: basePrice,
      mrp: baseMrp,
      price_adjustment: 0,
      stock: 0,
      is_default: variants.length === 0,
      is_active: true,
      sort_order: variants.length,
    };
    setVariants([...variants, newVariant]);
  };

  const updateVariant = (index: number, field: keyof Variant, value: any) => {
    const updated = [...variants];
    (updated[index] as any)[field] = value;
    if (field === "is_default" && value === true) {
      updated.forEach((v, i) => { if (i !== index) v.is_default = false; });
    }
    setVariants(updated);
  };

  const removeVariant = async (index: number) => {
    const v = variants[index];
    if (v.id) {
      await supabase.from("product_variants").delete().eq("id", v.id);
    }
    setVariants(variants.filter((_, i) => i !== index));
  };

  const saveVariants = async () => {
    if (!productId) {
      toast({ title: "Save the product first before adding variants", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      for (const v of variants) {
        const payload = {
          product_id: productId,
          product_type: "regular" as const,
          variant_label: v.variant_label,
          variant_value: v.variant_value,
          price: v.price,
          mrp: v.mrp,
          price_adjustment: v.price_adjustment,
          stock: v.stock,
          is_default: v.is_default,
          is_active: v.is_active,
          sort_order: v.sort_order,
        };
        if (v.id) {
          await supabase.from("product_variants").update(payload).eq("id", v.id);
        } else {
          const { data } = await supabase.from("product_variants").insert(payload).select("id").single();
          if (data) v.id = data.id;
        }
      }
      toast({ title: "Variants saved successfully" });
      fetchVariants();
    } catch {
      toast({ title: "Error saving variants", variant: "destructive" });
    }
    setLoading(false);
  };

  const presets = variationType === "size" ? SIZE_PRESETS : variationType === "color" ? COLOR_PRESETS : null;

  return (
    <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold flex items-center gap-2">
          {getVariationLabel(variationType)} Variants
          <Badge variant="outline" className="text-xs">{variants.length}</Badge>
        </Label>
        <Button type="button" variant="outline" size="sm" onClick={() => addVariant()}>
          <Plus className="h-3 w-3 mr-1" /> Add
        </Button>
      </div>

      {presets && variants.length === 0 && (
        <div className="flex flex-wrap gap-1">
          <span className="text-xs text-muted-foreground mr-1">Quick add:</span>
          {presets.map(p => (
            <Button key={p} type="button" variant="outline" size="sm" className="h-6 text-xs px-2" onClick={() => addVariant(p)}>
              {p}
            </Button>
          ))}
        </div>
      )}

      {variants.map((v, i) => (
        <div key={i} className="border rounded p-2 space-y-2 bg-background">
          <div className="flex items-center gap-2">
            <Input
              placeholder={getPlaceholder(variationType)}
              value={v.variant_label}
              onChange={e => updateVariant(i, "variant_label", e.target.value)}
              className="h-8 text-sm"
            />
            <Button type="button" variant="ghost" size="sm" onClick={() => removeVariant(i)}>
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">MRP</Label>
              <Input type="number" value={v.mrp} onChange={e => updateVariant(i, "mrp", +e.target.value)} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Price</Label>
              <Input type="number" value={v.price} onChange={e => updateVariant(i, "price", +e.target.value)} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Stock</Label>
              <Input type="number" value={v.stock} onChange={e => updateVariant(i, "stock", +e.target.value)} className="h-8 text-sm" />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <Switch checked={v.is_default} onCheckedChange={val => updateVariant(i, "is_default", val)} className="scale-75" />
              <Label className="text-xs">Default</Label>
            </div>
            <div className="flex items-center gap-1">
              <Switch checked={v.is_active} onCheckedChange={val => updateVariant(i, "is_active", val)} className="scale-75" />
              <Label className="text-xs">Active</Label>
            </div>
          </div>
        </div>
      ))}

      {variants.length > 0 && (
        <Button type="button" className="w-full" size="sm" onClick={saveVariants} disabled={loading}>
          {loading ? "Saving..." : "Save Variants"}
        </Button>
      )}

      {!productId && variants.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-2">
          Save the product first, then add variants here.
        </p>
      )}
    </div>
  );
};

export default ProductVariants;
