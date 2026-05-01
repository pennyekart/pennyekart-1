import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Status = "idle" | "loading" | "ready" | "error" | "no-key";

let cachedKey: string | null | undefined = undefined;
let loadPromise: Promise<void> | null = null;

async function fetchKey(): Promise<string | null> {
  if (cachedKey !== undefined) return cachedKey;
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "google_maps_api_key")
    .maybeSingle();
  cachedKey = (data?.value as string | undefined)?.trim() || null;
  return cachedKey;
}

export function invalidateGoogleMapsKey() {
  cachedKey = undefined;
  loadPromise = null;
}

function loadScript(key: string): Promise<void> {
  if ((window as any).google?.maps?.places) return Promise.resolve();
  if (loadPromise) return loadPromise;
  loadPromise = new Promise((resolve, reject) => {
    const cbName = `__gmapsReady_${Date.now()}`;
    (window as any)[cbName] = () => {
      resolve();
      delete (window as any)[cbName];
    };
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      key
    )}&libraries=places&callback=${cbName}&region=IN&language=en`;
    s.async = true;
    s.defer = true;
    s.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(s);
  });
  return loadPromise;
}

export function useGoogleMaps() {
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStatus("loading");
      const key = await fetchKey();
      if (cancelled) return;
      if (!key) {
        setStatus("no-key");
        return;
      }
      try {
        await loadScript(key);
        if (!cancelled) setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return status;
}