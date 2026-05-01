import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Map as MapIcon, Eye, EyeOff, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { invalidateGoogleMapsKey } from "@/hooks/useGoogleMaps";

const KEY = "google_maps_api_key";

const GoogleMapsKeyCard = () => {
  const { toast } = useToast();
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", KEY)
        .maybeSingle();
      setValue(((data?.value as string) ?? "").trim());
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    const trimmed = value.trim();
    const { data: existing } = await supabase
      .from("app_settings")
      .select("id")
      .eq("key", KEY)
      .maybeSingle();
    const payload = {
      key: KEY,
      value: trimmed,
      description: "Google Maps JavaScript API key (Places + Maps + Geocoding)",
    };
    const { error } = existing
      ? await supabase.from("app_settings").update(payload).eq("id", existing.id)
      : await supabase.from("app_settings").insert(payload);
    setSaving(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    invalidateGoogleMapsKey();
    toast({ title: "Google Maps API key saved" });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <MapIcon className="h-5 w-5 text-primary" /> Google Maps API Key
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Enables interactive map, Places Autocomplete, and pin-drop on the customer's
          "Set Delivery Location" picker. Required APIs: <strong>Maps JavaScript</strong>,{" "}
          <strong>Places</strong>, <strong>Geocoding</strong>.{" "}
          <a
            href="https://console.cloud.google.com/google/maps-apis/credentials"
            target="_blank"
            rel="noreferrer"
            className="text-primary inline-flex items-center gap-1 hover:underline"
          >
            Get a key <ExternalLink className="h-3 w-3" />
          </a>
        </p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              type={show ? "text" : "password"}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={loading ? "Loading..." : "AIza..."}
              disabled={loading}
              className="pr-9"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
              tabIndex={-1}
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <Button onClick={save} disabled={saving || loading}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Restrict this key in Google Cloud Console to your site's HTTP referrers.
        </p>
      </CardContent>
    </Card>
  );
};

export default GoogleMapsKeyCard;