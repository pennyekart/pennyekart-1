import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trophy, Sparkles, Loader2, Eraser } from "lucide-react";
import { ExternalLink } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { ScratchCard, useScratchCards } from "@/hooks/useScratchCards";
import { toast } from "@/hooks/use-toast";

interface Props {
  card: ScratchCard | null;
  onClose: () => void;
  onClaimed?: () => void;
}

const ScratchCardModal = ({ card, onClose, onClaimed }: Props) => {
  const { claim } = useScratchCards();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scratched, setScratched] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [reward, setReward] = useState<{
    amount: number;
    balance: number;
    reveal_text: string | null;
    reveal_image_url: string | null;
    product_link_url: string | null;
    product_discount_text: string | null;
  } | null>(null);
  const drawingRef = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const lastTouchTime = useRef(0);
  const [brushSize, setBrushSize] = useState(40);

  // Attach non-passive touch listeners for mobile scratch support
  useEffect(() => {
    const c = canvasRef.current;
    if (!c || card?.locked || reward) return;

    const getTouchXY = (e: TouchEvent) => {
      const rect = c.getBoundingClientRect();
      const scaleX = c.width / rect.width;
      const scaleY = c.height / rect.height;
      const t = e.touches[0] ?? e.changedTouches[0];
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY };
    };

    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      if (scratched) return;
      drawingRef.current = true;
      lastPos.current = null;
      const { x, y } = getTouchXY(e);
      scratchAt(x, y);
    };
    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (!drawingRef.current) return;
      const now = performance.now();
      if (now - lastTouchTime.current < 16) return;
      lastTouchTime.current = now;
      const { x, y } = getTouchXY(e);
      scratchAt(x, y);
    };
    const handleTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      onEnd();
    };

    c.addEventListener("touchstart", handleTouchStart, { passive: false });
    c.addEventListener("touchmove", handleTouchMove, { passive: false });
    c.addEventListener("touchend", handleTouchEnd, { passive: false });

    return () => {
      c.removeEventListener("touchstart", handleTouchStart);
      c.removeEventListener("touchmove", handleTouchMove);
      c.removeEventListener("touchend", handleTouchEnd);
    };
  });

  useEffect(() => {
    if (!card) {
      setScratched(false);
      setReward(null);
      setRevealing(false);
    }
  }, [card]);

  // Initialize scratch overlay
  useEffect(() => {
    if (!card || card.locked) return;
    const initCanvas = () => {
      const c = canvasRef.current;
      if (!c) return;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      const w = c.width;
      const h = c.height;
      ctx.fillStyle = "#4466EE";
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 0.15;
      const shapes = ['♦', '●', '▪', '✦', '★'];
      ctx.font = "10px system-ui";
      ctx.fillStyle = "#2244BB";
      for (let i = 0; i < 80; i++) {
        const sx = Math.random() * w;
        const sy = Math.random() * h;
        ctx.fillText(shapes[i % shapes.length], sx, sy);
      }
      ctx.globalAlpha = 1.0;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, 72, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(30, 50, 140, 0.55)";
      ctx.fill();
      ctx.fillStyle = "rgba(50, 70, 170, 0.9)";
      ctx.font = "bold 60px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("🏆", w / 2, h / 2);
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.font = "bold 14px system-ui, sans-serif";
      ctx.fillText("Scratch to reveal!", w / 2, h / 2 + 90);
    };
    // Wait for Dialog to mount the canvas element
    const raf = requestAnimationFrame(() => {
      if (canvasRef.current) {
        initCanvas();
      } else {
        // Retry after a short delay if canvas not yet mounted
        const timer = setTimeout(initCanvas, 150);
        return () => clearTimeout(timer);
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [card?.id, card?.locked]);

  const checkScratchPercent = () => {
    const c = canvasRef.current;
    if (!c) return 0;
    const ctx = c.getContext("2d");
    if (!ctx) return 0;
    const data = ctx.getImageData(0, 0, c.width, c.height).data;
    let cleared = 0;
    const total = data.length / 4;
    // Sample every 4th pixel for speed
    for (let i = 3; i < data.length; i += 16) {
      if (data[i] === 0) cleared++;
    }
    return (cleared * 4) / total;
  };

  const doClaim = async () => {
    if (!card || revealing) return;
    setRevealing(true);
    try {
      const res = await claim(card.id);
      setReward({
        amount: res.reward_amount,
        balance: res.balance,
        reveal_text: res.reveal_text,
        reveal_image_url: res.reveal_image_url,
        product_link_url: res.product_link_url,
        product_discount_text: res.product_discount_text,
      });
      onClaimed?.();
      // Fully clear canvas
      const c = canvasRef.current;
      if (c) {
        const ctx = c.getContext("2d");
        ctx?.clearRect(0, 0, c.width, c.height);
      }
    } catch (e: any) {
      toast({
        title: "Claim failed",
        description: e?.message || "Please try again",
        variant: "destructive",
      });
      setRevealing(false);
    }
  };

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    const scaleX = c.width / rect.width;
    const scaleY = c.height / rect.height;
    let cx: number, cy: number;
    if ("touches" in e) {
      cx = e.touches[0].clientX;
      cy = e.touches[0].clientY;
    } else {
      cx = e.clientX;
      cy = e.clientY;
    }
    return { x: (cx - rect.left) * scaleX, y: (cy - rect.top) * scaleY };
  };

  const scratchAt = (x: number, y: number) => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.globalCompositeOperation = "destination-out";
    if (lastPos.current) {
      ctx.lineWidth = brushSize;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(lastPos.current.x, lastPos.current.y);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
    ctx.fill();
    lastPos.current = { x, y };
  };

  const onStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (scratched || card?.locked) return;
    drawingRef.current = true;
    lastPos.current = null;
    const { x, y } = getPos(e);
    scratchAt(x, y);
  };

  const onMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawingRef.current) return;
    e.preventDefault();
    const { x, y } = getPos(e);
    scratchAt(x, y);
  };

  const onEnd = () => {
    drawingRef.current = false;
    lastPos.current = null;
    if (scratched) return;
    const pct = checkScratchPercent();
    if (pct > 0.55) {
      setScratched(true);
      doClaim();
    }
  };

  const fastReveal = () => {
    if (scratched || card?.locked || !canvasRef.current) return;
    const c = canvasRef.current;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    setScratched(true);
    doClaim();
  };

  if (!card) return null;

  return (
    <Dialog open={!!card} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm p-0 overflow-hidden border-0 bg-gradient-to-br from-primary/10 via-background to-accent/10">
        <DialogTitle className="sr-only">{card.title}</DialogTitle>
        <div className="p-6">
          <div className="text-center mb-4">
            <h3 className="text-xl font-bold">{card.title}</h3>
            {card.subtitle && (
              <p className="text-sm text-muted-foreground mt-1">{card.subtitle}</p>
            )}
          </div>

          {card.locked ? (
            <div className="aspect-square rounded-2xl bg-muted/40 flex flex-col items-center justify-center p-6 text-center border-2 border-dashed border-muted-foreground/30">  
              <Trophy className="h-12 w-12 text-muted-foreground mb-3" />
              <p className="font-semibold text-base">Keep your streak going!</p>
              <p className="text-sm text-muted-foreground mt-2">
                {card.streak_progress} / {card.streak_required} consecutive days completed
              </p>
              <div className="w-full bg-muted rounded-full h-2 mt-4 overflow-hidden">
                <div
                  className="bg-primary h-full transition-all"
                  style={{
                    width: `${Math.min(100, ((card.streak_progress ?? 0) / (card.streak_required || 1)) * 100)}%`,
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Add daily entries in "Today's Work" to unlock
              </p>
            </div>
          ) : (
            <div className="relative aspect-square rounded-2xl overflow-hidden shadow-xl" style={{ background: '#4466EE' }}>
              {/* Reward layer (under canvas) */}
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                {reward ? (
                  <div className="animate-scale-in flex flex-col items-center relative">
                    {/* Cloud-like white reveal shape */}
                    <div className="absolute inset-0 -m-8 rounded-[50%] bg-white/90 blur-md" />
                    <div className="relative flex flex-col items-center z-10">
                      {/* Dark circle with trophy */}
                      <div className="w-28 h-28 rounded-full bg-[#1a1a3e] flex items-center justify-center mb-3 shadow-lg">
                        <span className="text-5xl">🏆</span>
                      </div>
                      <p className="text-lg font-bold text-gray-800">You've won</p>
                      <p className="text-4xl font-extrabold text-gray-900 my-1">₹{reward.amount}</p>
                      {reward.reveal_text && (
                        <p className="text-sm mt-1 text-gray-600">{reward.reveal_text}</p>
                      )}
                      {reward.reveal_image_url && (
                        <img
                          src={reward.reveal_image_url}
                          alt=""
                          className="mt-2 max-h-20 rounded-lg"
                        />
                      )}
                      <p className="text-xs mt-2 text-gray-500">
                        Wallet balance: ₹{reward.balance.toFixed(2)}
                      </p>
                      {reward.product_link_url && (
                        <a
                          href={reward.product_link_url}
                          target={reward.product_link_url.startsWith("http") ? "_blank" : undefined}
                          rel="noopener noreferrer"
                          className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold shadow hover:opacity-90 transition"
                        >
                          <ExternalLink className="h-4 w-4" />
                          {reward.product_discount_text || "Get Benefit"}
                        </a>
                      )}
                    </div>
                  </div>
                ) : revealing ? (
                  <Loader2 className="h-10 w-10 animate-spin text-white" />
                ) : (
                  <>
                    <Trophy className="h-12 w-12 mb-3 text-white/80" />
                    <p className="text-2xl font-bold text-white">₹{card.reward_amount}</p>
                    <p className="text-sm mt-1 text-white/80">Scratch to claim</p>
                  </>
                )}
              </div>

              {/* Scratch canvas overlay */}
              {!reward && (
                <canvas
                  ref={canvasRef}
                  width={400}
                  height={400}
                  className="absolute inset-0 w-full h-full touch-none cursor-crosshair"
                  onMouseDown={onStart}
                  onMouseMove={onMove}
                  onMouseUp={onEnd}
                  onMouseLeave={onEnd}
                />
              )}
            </div>
          )}

          {/* Brush size slider & fast reveal - only when scratching */}
          {!card.locked && !reward && !scratched && (
            <div className="flex items-center gap-3 mt-3">
              <div className="flex-1 flex items-center gap-2">
                <Eraser className="h-4 w-4 text-muted-foreground shrink-0" />
                <Slider
                  value={[brushSize]}
                  onValueChange={(v) => setBrushSize(v[0])}
                  min={20}
                  max={80}
                  step={5}
                  className="flex-1"
                />
                <span className="text-xs text-muted-foreground w-6 text-right">{brushSize}</span>
              </div>
              <Button size="sm" variant="secondary" onClick={fastReveal} className="shrink-0">
                <Sparkles className="h-4 w-4 mr-1" />
                Reveal
              </Button>
            </div>
          )}

          <Button onClick={onClose} className="w-full mt-3" variant={reward ? "default" : "outline"}>
            {reward ? "Awesome!" : "Close"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ScratchCardModal;
