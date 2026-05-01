import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface AreaProduct {
  id: string;
  name: string;
  price: number;
  mrp: number;
  discount_rate: number;
  image_url: string | null;
  description: string | null;
  category: string | null;
  section: string | null;
  stock: number;
  coming_soon?: boolean;
  wallet_points?: number;
}

const fetchAreaProducts = async (localBodyId: string, wardNumber: number): Promise<AreaProduct[]> => {
  // Get micro godown IDs and area godown IDs in parallel
  const [microRes, areaRes] = await Promise.all([
    supabase
      .from("godown_wards")
      .select("godown_id, godowns!inner(godown_type)")
      .eq("local_body_id", localBodyId)
      .eq("ward_number", wardNumber)
      .eq("godowns.godown_type", "micro"),
    supabase
      .from("godown_local_bodies")
      .select("godown_id, godowns!inner(godown_type)")
      .eq("local_body_id", localBodyId)
      .eq("godowns.godown_type", "area"),
  ]);

  const godownIds = new Set<string>();
  microRes.data?.forEach(r => godownIds.add(r.godown_id));
  areaRes.data?.forEach(r => godownIds.add(r.godown_id));

  if (godownIds.size === 0) return [];

  const godownArr = Array.from(godownIds);

  // Fetch stock and seller products in parallel
  const [stockRes, sellerRes] = await Promise.all([
    supabase
      .from("godown_stock")
      .select("product_id, quantity")
      .in("godown_id", godownArr)
      .gt("quantity", 0),
    supabase
      .from("seller_products")
      .select("id, name, price, mrp, discount_rate, image_url, description, category, stock, coming_soon, wallet_points, seller_id")
      .in("area_godown_id", godownArr)
      .eq("is_active", true)
      .eq("is_approved", true)
      .eq("coming_soon", false)
      .gt("stock", 0)
      .limit(30),
  ]);

  let allProducts: AreaProduct[] = [];

  if (stockRes.data?.length) {
    const productIds = [...new Set(stockRes.data.map(s => s.product_id))];
    const { data: productData } = await supabase
      .from("products")
      .select("id, name, price, mrp, discount_rate, image_url, description, category, section, stock, coming_soon, wallet_points")
      .in("id", productIds)
      .eq("is_active", true)
      .eq("coming_soon", false)
      .limit(50);
    if (productData) allProducts.push(...(productData as AreaProduct[]));
  }

  if (sellerRes.data && sellerRes.data.length > 0) {
    // Note: seller_products.is_approved is already filtered server-side by an admin,
    // so we don't need to re-check the seller's profile.is_approved here.
    // Doing so would fail silently because RLS on `profiles` only allows users to
    // read their own profile — making the approved set empty and hiding all seller items.
    allProducts.push(
      ...sellerRes.data.map(sp => ({
        ...sp,
        section: "seller" as string | null,
      } as AreaProduct))
    );
  }

  return allProducts;
};

export const useAreaProducts = () => {
  const { profile } = useAuth();
  const localBodyId = profile?.local_body_id;
  const wardNumber = profile?.ward_number;

  const { data: products = [], isLoading: loading } = useQuery({
    queryKey: ["area-products", localBodyId, wardNumber],
    queryFn: () => fetchAreaProducts(localBodyId!, wardNumber!),
    enabled: !!localBodyId && !!wardNumber,
    staleTime: 5 * 60 * 1000, // 5 min cache
    gcTime: 10 * 60 * 1000,
  });

  return { products, loading };
};
