import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./useAuth";

const PROJECT_ID = "xxlocaexuoowxdzupjcs";
const FN_URL = `https://${PROJECT_ID}.supabase.co/functions/v1/scratch-claim`;

export interface ScratchCard {
  id: string;
  title: string;
  subtitle: string | null;
  cover_image_url: string | null;
  reveal_text: string | null;
  reveal_image_url: string | null;
  reward_amount: number;
  target_audience: string;
  start_at: string;
  end_at: string;
  max_claims_per_user: number;
  requires_agent_streak_days: number | null;
  streak_progress: number | null;
  streak_required: number | null;
  locked: boolean;
  product_link_url: string | null;
  product_discount_text: string | null;
}

export const useScratchCards = () => {
  const { session } = useAuth();
  const [cards, setCards] = useState<ScratchCard[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchCards = useCallback(async () => {
    if (!session?.access_token) {
      setCards([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${FN_URL}?action=list`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      setCards(data?.cards ?? []);
    } catch (e) {
      console.error("scratch cards list failed", e);
      setCards([]);
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  const claim = useCallback(
    async (cardId: string) => {
      if (!session?.access_token) throw new Error("Login required");
      const res = await fetch(FN_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ card_id: cardId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Claim failed");
      return data as {
        success: boolean;
        reward_amount: number;
        balance: number;
        reveal_text: string | null;
        reveal_image_url: string | null;
        product_link_url: string | null;
        product_discount_text: string | null;
      };
    },
    [session?.access_token],
  );

  return { cards, loading, refetch: fetchCards, claim };
};
