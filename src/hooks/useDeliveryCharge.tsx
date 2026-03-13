import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CartItem } from "@/hooks/useCart";

interface DeliveryChargeRule {
  id: string;
  rule_type: "category" | "godown" | "free_delivery" | "time_based";
  name: string;
  is_active: boolean;
  category_name: string | null;
  godown_id: string | null;
  charge_amount: number;
  min_purchase_amount: number;
  time_slot_label: string | null;
  time_slot_start: string | null;
  time_slot_end: string | null;
  priority: number;
}

interface DeliveryChargeResult {
  totalCharge: number;
  isFreeDelivery: boolean;
  freeDeliveryThreshold: number | null;
  amountToFreeDelivery: number;
  breakdown: { label: string; amount: number }[];
  loading: boolean;
}

export const useDeliveryCharge = (
  items: CartItem[],
  orderSubtotal: number,
  userGodownId?: string | null
): DeliveryChargeResult => {
  const [rules, setRules] = useState<DeliveryChargeRule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRules = async () => {
      const { data } = await supabase
        .from("delivery_charge_rules")
        .select("*")
        .eq("is_active", true)
        .order("priority");
      setRules((data as any[]) ?? []);
      setLoading(false);
    };
    fetchRules();
  }, []);

  const calculate = useCallback((): Omit<DeliveryChargeResult, "loading"> => {
    if (items.length === 0 || rules.length === 0) {
      return { totalCharge: 0, isFreeDelivery: true, freeDeliveryThreshold: null, amountToFreeDelivery: 0, breakdown: [] };
    }

    let charge = 0;
    const breakdown: { label: string; amount: number }[] = [];

    // 1. Check free delivery rules first
    const freeRules = rules.filter(r => r.rule_type === "free_delivery");
    let freeDeliveryThreshold: number | null = null;
    let qualifiesForFree = false;

    for (const rule of freeRules) {
      freeDeliveryThreshold = rule.min_purchase_amount;
      if (orderSubtotal >= rule.min_purchase_amount) {
        qualifiesForFree = true;
        break;
      }
    }

    if (qualifiesForFree) {
      return {
        totalCharge: 0,
        isFreeDelivery: true,
        freeDeliveryThreshold,
        amountToFreeDelivery: 0,
        breakdown: [{ label: "Free Delivery", amount: 0 }],
      };
    }

    // 2. Category-wise charges
    const categoryRules = rules.filter(r => r.rule_type === "category");
    const itemCategories = new Set(items.map(i => (i as any).category).filter(Boolean));
    
    // Track which categories already have charges applied
    const chargedCategories = new Set<string>();
    for (const rule of categoryRules) {
      if (rule.category_name && itemCategories.has(rule.category_name) && !chargedCategories.has(rule.category_name)) {
        charge += rule.charge_amount;
        breakdown.push({ label: `${rule.name}`, amount: rule.charge_amount });
        chargedCategories.add(rule.category_name);
      }
    }

    // 3. Godown-wise charges
    const godownRules = rules.filter(r => r.rule_type === "godown");
    if (userGodownId) {
      const matchingRule = godownRules.find(r => r.godown_id === userGodownId);
      if (matchingRule) {
        charge += matchingRule.charge_amount;
        breakdown.push({ label: matchingRule.name, amount: matchingRule.charge_amount });
      }
    } else if (godownRules.length > 0 && categoryRules.length === 0) {
      // Default: apply the first godown rule as a base charge
      const defaultRule = godownRules[0];
      charge += defaultRule.charge_amount;
      breakdown.push({ label: defaultRule.name, amount: defaultRule.charge_amount });
    }

    // 4. Time-based charges
    const timeRules = rules.filter(r => r.rule_type === "time_based");
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    
    for (const rule of timeRules) {
      if (rule.time_slot_start && rule.time_slot_end) {
        const inSlot = currentTime >= rule.time_slot_start && currentTime <= rule.time_slot_end;
        if (inSlot) {
          charge += rule.charge_amount;
          breakdown.push({ label: rule.time_slot_label || rule.name, amount: rule.charge_amount });
        }
      }
    }

    // If no rules matched, delivery is free
    if (charge === 0 && breakdown.length === 0) {
      return { totalCharge: 0, isFreeDelivery: true, freeDeliveryThreshold, amountToFreeDelivery: 0, breakdown: [] };
    }

    const amountToFree = freeDeliveryThreshold ? Math.max(0, freeDeliveryThreshold - orderSubtotal) : 0;

    return { totalCharge: charge, isFreeDelivery: false, freeDeliveryThreshold, amountToFreeDelivery: amountToFree, breakdown };
  }, [items, rules, orderSubtotal, userGodownId]);

  const result = calculate();

  return { ...result, loading };
};
