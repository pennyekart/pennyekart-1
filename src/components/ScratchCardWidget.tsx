import { useState } from "react";
import { Gift, Sparkles, Lock } from "lucide-react";
import { useScratchCards, ScratchCard } from "@/hooks/useScratchCards";
import ScratchCardModal from "./ScratchCardModal";
import { Card } from "@/components/ui/card";

interface Props {
  title?: string;
  className?: string;
}

const ScratchCardWidget = ({ title = "Scratch & Win", className = "" }: Props) => {
  const { cards, loading, refetch } = useScratchCards();
  const [active, setActive] = useState<ScratchCard | null>(null);

  if (loading || cards.length === 0) return null;

  return (
    <section className={`px-4 py-3 ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-5 w-5 text-primary" />
        <h2 className="text-base font-bold">{title}</h2>
        <span className="text-xs text-muted-foreground ml-1">{cards.length} reward{cards.length > 1 ? "s" : ""}</span>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory scrollbar-hide">
        {cards.map((c) => (
          <button
            key={c.id}
            onClick={() => setActive(c)}
            className="snap-start shrink-0 w-36 sm:w-40 group"
          >
            <Card
              className={`relative aspect-square overflow-hidden border-2 ${
                c.locked
                  ? "border-muted bg-muted/30"
                  : "border-primary/20 bg-gradient-to-br from-primary to-accent text-primary-foreground"
              } shadow-md transition-transform group-hover:scale-105 group-active:scale-95`}
            >
              {c.cover_image_url && !c.locked && (
                <img
                  src={c.cover_image_url}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover opacity-30"
                />
              )}
              <div className="relative h-full w-full flex flex-col items-center justify-center p-3 text-center">
                {c.locked ? (
                  <>
                    <Lock className="h-7 w-7 text-muted-foreground mb-2" />
                    <p className="text-xs font-semibold line-clamp-2 text-foreground">{c.title}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {c.streak_progress}/{c.streak_required} day streak
                    </p>
                  </>
                ) : (
                  <>
                    <Gift className="h-8 w-8 mb-2" />
                    <p className="text-xs font-semibold line-clamp-2">{c.title}</p>
                    <p className="text-lg font-bold mt-1">₹{c.reward_amount}</p>
                    <p className="text-[10px] mt-1 opacity-80">Tap to scratch</p>
                  </>
                )}
              </div>
            </Card>
          </button>
        ))}
      </div>

      <ScratchCardModal
        card={active}
        onClose={() => {
          setActive(null);
          refetch();
        }}
        onClaimed={refetch}
      />
    </section>
  );
};

export default ScratchCardWidget;
