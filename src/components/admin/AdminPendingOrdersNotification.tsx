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
import { Bell, Package, Settings as SettingsIcon, Eye, Volume2, VolumeX } from "lucide-react";
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
      if (settings.autoPopup) setOpen(true);
    }
    prevCountRef.current = list.length;
  }, [playBeep, settings.autoPopup]);

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
      {/* Floating bell */}
      <div className="fixed bottom-20 right-4 z-50 flex flex-col items-end gap-2">
        <Popover open={settingsOpen} onOpenChange={setSettingsOpen}>
          <PopoverTrigger asChild>
            <Button
              size="icon"
              variant="outline"
              className="h-9 w-9 rounded-full shadow-md"
              title="Notification settings"
            >
              <SettingsIcon className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72">
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
            className="relative flex items-center justify-center h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg animate-bounce hover:animate-none transition-all"
            title="Pending orders"
          >
            <Bell className="h-6 w-6" />
            <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center">
              {orders.length}
            </span>
          </button>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Pending Orders ({orders.length})
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {orders.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No pending orders.</p>
            )}
            {orders.map((order) => (
              <div key={order.id} className="border rounded-lg p-3 space-y-2 bg-accent/30">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-medium">#{order.id.slice(0, 8)}</span>
                  <Badge variant="secondary">₹{order.total}</Badge>
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {order.shipping_address || "No address"}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {new Date(order.created_at).toLocaleString()} · {order.status.replace(/_/g, " ")}
                </p>
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      setOpen(false);
                      navigate("/admin/orders");
                    }}
                  >
                    <Eye className="h-3.5 w-3.5 mr-1" /> Open in Orders
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AdminPendingOrdersNotification;
