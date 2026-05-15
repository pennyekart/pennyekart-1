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

  const microGodownIds = new Set<string>();
  microRes.data?.forEach(r => microGodownIds.add(r.godown_id));
  const areaGodownIds = new Set<string>();
  areaRes.data?.forEach(r => areaGodownIds.add(r.godown_id));

  const allGodownIds = new Set<string>([...microGodownIds, ...areaGodownIds]);
  if (allGodownIds.size === 0) return [];

  const microArr = Array.from(microGodownIds);
  const areaArr = Array.from(areaGodownIds);
  const allArr = Array.from(allGodownIds);

  // Fetch admin product stock + seller products visible to this customer
  // Seller products are visible if:
  //   (a) assign_to_all_micro_godowns = true, OR
  //   (b) linked via seller_product_micro_godowns to one of the customer's micro godowns
  // We also still respect area_godown_id (existing behaviour) for non-grocery seller items.
  const sellerProductSelect = "id, name, price, mrp, discount_rate, image_url, description, category, stock, coming_soon, wallet_points, seller_id, is_grocery, assign_to_all_micro_godowns";

  const linkedIdsPromise = microArr.length
    ? supabase
        .from("seller_product_micro_godowns")
        .select("seller_product_id")
        .in("godown_id", microArr)
    : Promise.resolve({ data: [] as { seller_product_id: string }[] });

  const [stockRes, sellerAllRes, sellerAreaRes, linkedRes] = await Promise.all([
    supabase
      .from("godown_stock")
      .select("product_id, quantity")
      .in("godown_id", allArr)
      .gt("quantity", 0),
    // Seller products with "assign to all micro godowns" flag
    supabase
      .from("seller_products")
      .select(sellerProductSelect)
      .eq("is_active", true)
      .eq("is_approved", true)
      .eq("coming_soon", false)
      .eq("assign_to_all_micro_godowns", true)
      .gt("stock", 0)
      .limit(60),
    // Existing area-godown based seller products (kept for non-grocery / legacy)
    areaArr.length
      ? supabase
          .from("seller_products")
          .select(sellerProductSelect)
          .in("area_godown_id", areaArr)
          .eq("is_active", true)
          .eq("is_approved", true)
          .eq("coming_soon", false)
          .gt("stock", 0)
          .limit(60)
      : Promise.resolve({ data: [] as any[] }),
    linkedIdsPromise,
  ]);

  let allProducts: AreaProduct[] = [];

  // Admin products via godown stock
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

  // Seller products visible specifically to this customer's micro godowns
  const linkedIds = [...new Set((linkedRes.data ?? []).map((r: any) => r.seller_product_id))];
  let sellerLinkedRes: { data: any[] | null } = { data: [] };
  if (linkedIds.length) {
    sellerLinkedRes = await supabase
      .from("seller_products")
      .select(sellerProductSelect)
      .in("id", linkedIds)
      .eq("is_active", true)
      .eq("is_approved", true)
      .eq("coming_soon", false)
      .gt("stock", 0)
      .limit(60);
  }

  // Merge & dedupe seller products from three sources
  const sellerMap = new Map<string, any>();
  const pushAll = (rows: any[] | null | undefined) => {
    (rows ?? []).forEach((row) => {
      // For grocery items only show via micro-godown rules (all-flag or linked).
      // The area-godown query may include grocery rows that should NOT be visible —
      // skip them when they aren't allowed by the new visibility model.
      if (row.is_grocery && !row.assign_to_all_micro_godowns) {
        if (!linkedIds.includes(row.id)) return;
      }
      sellerMap.set(row.id, row);
    });
  };
  pushAll(sellerAllRes.data);
  pushAll(sellerLinkedRes.data);
  pushAll(sellerAreaRes.data);

  if (sellerMap.size > 0) {
    allProducts.push(
      ...Array.from(sellerMap.values()).map((sp) => ({
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
