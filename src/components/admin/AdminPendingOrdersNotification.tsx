import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Bell, Package, Settings as SettingsIcon, Eye, Volume2, VolumeX, Clock, MapPin, Sparkles, AlarmClock } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";

interface PendingOrder {
  id: string;
  status: string;
  total: number;
  shipping_address: string | null;
  created_at: string;
  items: any;
}

const PENDING_STATUSES = ["pending", "seller_confirmation_pending"];
const SETTINGS_KEY = "admin_pending_orders_notify";
const SUPPRESS_KEY = "admin_pending_orders_suppress_session";

interface Settings {
  enabled: boolean;
  intervalMinutes: number;
  sound: boolean;
  autoPopup: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  intervalMinutes: 2,
  sound: true,
  autoPopup: true,
};

const loadSettings = (): Settings => {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_SETTINGS;
};

const AdminPendingOrdersNotification = () => {
  const { hasPermission, isSuperAdmin } = usePermissions();
  const canSee = isSuperAdmin || hasPermission("read_orders");
  const navigate = useNavigate();

  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [autoPopupSuppressed, setAutoPopupSuppressed] = useState<boolean>(() => {
    try { return sessionStorage.getItem(SUPPRESS_KEY) === "1"; } catch { return false; }
  });
  const prevCountRef = useRef(0);
  const seenIdsRef = useRef<Set<string>>(new Set());

  const playBeep = useCallback(() => {
    if (!settings.sound) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const beep = (freq: number, delay: number) => {
        setTimeout(() => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = freq;
          gain.gain.value = 0.25;
          osc.start();
          osc.stop(ctx.currentTime + 0.25);
        }, delay);
      };
      beep(880, 0);
      beep(1100, 300);
    } catch {}
  }, [settings.sound]);

  const fetchPending = useCallback(async () => {
    const { data, error } = await supabase
      .from("orders")
      .select("id, status, total, shipping_address, created_at, items")
      .in("status", PENDING_STATUSES)
      .order("created_at", { ascending: false });
    if (error) return;
    const list = (data as PendingOrder[]) ?? [];

    const newOnes = list.filter((o) => !seenIdsRef.current.has(o.id));
    const hadNew = newOnes.length > 0 && prevCountRef.current > 0;

    list.forEach((o) => seenIdsRef.current.add(o.id));
    setOrders(list);

    if (list.length > 0 && (hadNew || prevCountRef.current === 0)) {
      playBeep();
      if (settings.autoPopup && !autoPopupSuppressed) setOpen(true);
    }
    prevCountRef.current = list.length;
  }, [playBeep, settings.autoPopup, autoPopupSuppressed]);

  useEffect(() => {
    if (!canSee || !settings.enabled) return;
    fetchPending();
    const ms = Math.max(0.25, settings.intervalMinutes) * 60 * 1000;
    const interval = setInterval(fetchPending, ms);
    return () => clearInterval(interval);
  }, [canSee, settings.enabled, settings.intervalMinutes, fetchPending]);

  const saveSettings = (next: Settings) => {
    setSettings(next);
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    } catch {}
  };

  if (!canSee) return null;

  return (
    <>
      {/* Floating bell — left on mobile to avoid ChatBot overlap, right on desktop */}
      <div className="fixed bottom-20 left-3 sm:left-auto sm:right-4 z-50 flex flex-col items-start sm:items-end gap-2">
        <Popover open={settingsOpen} onOpenChange={setSettingsOpen}>
          <PopoverTrigger asChild>
            <Button
              size="icon"
              variant="outline"
              className="h-8 w-8 sm:h-9 sm:w-9 rounded-full shadow-md bg-background/80 backdrop-blur-sm"
              title="Notification settings"
            >
              <SettingsIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 sm:w-72">
            <div className="space-y-3">
              <h4 className="font-semibold text-sm">Pending Orders Alerts</h4>
              <div className="flex items-center justify-between">
                <Label htmlFor="np-enabled" className="text-xs">Enable polling</Label>
                <Switch
                  id="np-enabled"
                  checked={settings.enabled}
                  onCheckedChange={(v) => saveSettings({ ...settings, enabled: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="np-popup" className="text-xs">Auto-open popup</Label>
                <Switch
                  id="np-popup"
                  checked={settings.autoPopup}
                  onCheckedChange={(v) => saveSettings({ ...settings, autoPopup: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="np-sound" className="text-xs flex items-center gap-1">
                  {settings.sound ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />}
                  Sound
                </Label>
                <Switch
                  id="np-sound"
                  checked={settings.sound}
                  onCheckedChange={(v) => saveSettings({ ...settings, sound: v })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="np-interval" className="text-xs">Repeat interval (minutes)</Label>
                <Input
                  id="np-interval"
                  type="number"
                  min={0.25}
                  step={0.25}
                  value={settings.intervalMinutes}
                  onChange={(e) =>
                    saveSettings({
                      ...settings,
                      intervalMinutes: Math.max(0.25, Number(e.target.value) || 1),
                    })
                  }
                />
                <p className="text-[10px] text-muted-foreground">
                  Re-check every {settings.intervalMinutes} min. Beeps when new pending orders arrive.
                </p>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {orders.length > 0 && (
          <button
            onClick={() => setOpen(true)}
            className="relative flex items-center justify-center h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-gradient-to-br from-[#0a1f44] via-[#0f5132] to-[#d4af37] text-white shadow-lg shadow-[#0a1f44]/40 animate-bounce hover:animate-none transition-all hover:scale-105 active:scale-95 ring-2 ring-[#d4af37]/40"
            title="Pending orders"
          >
            <Bell className="h-5 w-5 sm:h-6 sm:w-6" />
            <span className="absolute -top-1 -right-1 bg-gradient-to-br from-[#d4af37] to-[#b8860b] text-[#0a1f44] text-[10px] sm:text-xs font-bold rounded-full h-5 w-5 sm:h-6 sm:w-6 flex items-center justify-center shadow-md ring-1 ring-white/60">
              {orders.length}
            </span>
          </button>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-hidden rounded-2xl sm:rounded-2xl p-0 gap-0 border-0 shadow-2xl flex flex-col">
          {/* Header with animated gradient */}
          <div className="relative overflow-hidden bg-gradient-to-br from-[#0a1f44] via-[#0f5132] to-[#d4af37] p-4 sm:p-5 text-white">
            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top_right,white,transparent_60%)]" />
            <div className="absolute -top-6 -right-6 h-24 w-24 rounded-full bg-[#d4af37]/20 blur-2xl animate-pulse" />
            <DialogHeader className="space-y-1 relative">
              <DialogTitle className="flex items-center gap-2 text-white text-base sm:text-lg">
                <div className="relative">
                  <Package className="h-5 w-5 sm:h-6 sm:w-6" />
                  <Sparkles className="h-3 w-3 absolute -top-1 -right-1 text-[#ffd700] animate-pulse" />
                </div>
                <span className="font-bold tracking-tight">New Pending Orders</span>
                <span className="ml-auto bg-[#d4af37]/90 backdrop-blur-sm text-[#0a1f44] text-xs font-bold rounded-full min-w-6 h-6 px-2 flex items-center justify-center ring-2 ring-white/40 animate-pulse">
                  {orders.length}
                </span>
              </DialogTitle>
              <p className="text-[11px] sm:text-xs text-white/90 pl-7">
                {orders.length > 0
                  ? `${orders.length} order${orders.length > 1 ? "s" : ""} waiting for your action`
                  : "All caught up — nothing pending."}
              </p>
            </DialogHeader>
          </div>


          <div className="p-3 sm:p-5 space-y-2 sm:space-y-3 overflow-y-auto flex-1">
            {orders.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">No pending orders.</p>
            )}
            {orders.map((order) => (
              <div
                key={order.id}
                className="relative overflow-hidden rounded-xl border bg-card p-3 sm:p-4 space-y-2 sm:space-y-3 shadow-sm hover:shadow-md hover:border-[#d4af37] transition-all"
              >
                {/* Gradient accent bar */}
                <div className="absolute left-0 top-0 bottom-1 w-1 rounded-l-xl bg-gradient-to-b from-[#0a1f44] via-[#0f5132] to-[#d4af37]" />

                {/* Top row: ID + Amount */}
                <div className="flex items-center justify-between pl-2">
                  <div className="flex items-center gap-2 min-w-1">
                    <span className="font-mono text-xs sm:text-sm font-semibold text-foreground">
                      #{order.id.slice(0, 8)}
                    </span>
                    <Badge
                      variant="outline"
                      className="text-[10px] sm:text-xs h-5 border-[#0a1f44]/30 bg-[#0a1f44]/5 text-[#0a1f44] hidden sm:inline-flex"
                    >
                      {order.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  <span className="text-sm sm:text-base font-bold bg-gradient-to-r from-[#0a1f44] via-[#0f5132] to-[#b8860b] bg-clip-text text-transparent">
                    ₹{order.total}
                  </span>
                </div>

                {/* Status badge on mobile */}
                <div className="pl-2 sm:hidden">
                  <Badge
                    variant="outline"
                    className="text-[10px] h-5 border-[#0a1f44]/30 bg-[#0a1f44]/5 text-[#0a1f44]"
                  >
                    {order.status.replace(/_/g, " ")}
                  </Badge>
                </div>

                {/* Address */}
                <p className="text-[11px] sm:text-xs text-muted-foreground truncate pl-2 flex items-center gap-1">
                  <MapPin className="h-3 w-3 shrink-0" />
                  {order.shipping_address || "No address"}
                </p>

                {/* Time */}
                <p className="text-[10px] sm:text-xs text-muted-foreground pl-2 flex items-center gap-1">
                  <Clock className="h-3 w-3 shrink-0" />
                  {new Date(order.created_at).toLocaleString()}
                </p>

                {/* Action button */}
                <div className="flex gap-2 pt-1 pl-2">
                  <Button
                    size="sm"
                    className="flex-1 bg-gradient-to-r from-[#0a1f44] via-[#0f5132] to-[#d4af37] hover:opacity-90 text-white shadow-md shadow-[#0a1f44]/30 text-xs sm:text-sm h-8 sm:h-9"
                    onClick={() => {
                      setOpen(false);
                      navigate("/admin/orders");
                    }}
                  >
                    <Eye className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1" /> Open in Orders
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Sticky footer with prominent actions */}
          {orders.length > 0 && (
            <div className="border-t bg-background/95 backdrop-blur-sm p-3 sm:p-4 flex flex-col sm:flex-row gap-2 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
              <Button
                size="lg"
                variant="outline"
                className="flex-1 h-11 border-2 border-amber-400 text-amber-700 hover:bg-amber-50 hover:text-amber-800 hover:border-amber-500 font-semibold shadow-sm"
                onClick={() => {
                  try { sessionStorage.setItem(SUPPRESS_KEY, "1"); } catch {}
                  setAutoPopupSuppressed(true);
                  setOpen(false);
                }}
              >
                <AlarmClock className="h-4 w-4 mr-1.5" />
                Show me Later
              </Button>
              <Button
                size="lg"
                className="flex-1 h-11 bg-gradient-to-r from-amber-500 to-emerald-600 hover:from-amber-600 hover:to-emerald-700 text-white shadow-md font-semibold"
                onClick={() => {
                  setOpen(false);
                  navigate("/admin/orders");
                }}
              >
                <Eye className="h-4 w-4 mr-1.5" />
                View All Orders
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export default AdminPendingOrdersNotification;
