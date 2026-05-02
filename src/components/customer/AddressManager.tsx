import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin, LocateFixed, Search, Loader2, ExternalLink, Trash2, Pencil, Plus, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useGoogleMaps } from "@/hooks/useGoogleMaps";

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

// India bounds (approx) for biasing search + map
const INDIA_BOUNDS = {
  south: 6.5,
  west: 68.0,
  north: 35.8,
  east: 97.5,
};
const INDIA_CENTER = { lat: 20.5937, lng: 78.9629 };
const isPhoneViewport = () =>
  typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;

const AddressManager = () => {
  const { user } = useAuth();
  const gmapsStatus = useGoogleMaps();
  const useGoogle = gmapsStatus === "ready";

  const [loading, setLoading] = useState(true);
  const [savedAddress, setSavedAddress] = useState<string | null>(null);
  const [savedLat, setSavedLat] = useState<number | null>(null);
  const [savedLng, setSavedLng] = useState<number | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editAddress, setEditAddress] = useState("");
  const [editLat, setEditLat] = useState<number | null>(null);
  const [editLng, setEditLng] = useState<number | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<NominatimResult[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const [gpsLoading, setGpsLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [removeOpen, setRemoveOpen] = useState(false);
  const [removing, setRemoving] = useState(false);

  // Google Maps refs
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const autocompleteInputRef = useRef<HTMLInputElement | null>(null);
  const autocompleteRef = useRef<any>(null);
  const [mapActivated, setMapActivated] = useState(false);

  // Load saved address
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("business_address, latitude, longitude")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setSavedAddress((data as any).business_address ?? null);
        setSavedLat((data as any).latitude ?? null);
        setSavedLng((data as any).longitude ?? null);
      }
      setLoading(false);
    })();
  }, [user]);

  // Debounced place search
  useEffect(() => {
    if (!dialogOpen || useGoogle) return; // Google handles its own autocomplete
    const q = searchQuery.trim();
    if (q.length < 3) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=6&countrycodes=in&q=${encodeURIComponent(q)}`;
        const res = await fetch(url, {
          signal: ac.signal,
          headers: { "Accept-Language": "en" },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: NominatimResult[] = await res.json();
        setResults(data || []);
      } catch (err: any) {
        if (err?.name !== "AbortError") {
          toast.error("Place search failed. You can still type the address manually.");
          setResults([]);
        }
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [searchQuery, dialogOpen, useGoogle]);

  const initializeGoogleMap = (force = false) => {
    if (!dialogOpen || !useGoogle || (!mapActivated && !force)) return;
    const g = (window as any).google;
    if (!g?.maps || !mapDivRef.current) return;

    mapDivRef.current.style.touchAction = "none";
    const startLat = editLat ?? INDIA_CENTER.lat;
    const startLng = editLng ?? INDIA_CENTER.lng;
    const startZoom = editLat != null && editLng != null ? 16 : 5;

    if (mapRef.current) {
      g.maps.event.trigger(mapRef.current, "resize");
      mapRef.current.panTo({ lat: startLat, lng: startLng });
      return;
    }

    mapRef.current = new g.maps.Map(mapDivRef.current, {
      center: { lat: startLat, lng: startLng },
      zoom: startZoom,
      gestureHandling: "greedy",
      clickableIcons: false,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      restriction: {
        latLngBounds: INDIA_BOUNDS,
        strictBounds: false,
      },
    });

    markerRef.current = new g.maps.Marker({
      map: mapRef.current,
      position: { lat: startLat, lng: startLng },
      draggable: true,
      visible: editLat != null && editLng != null,
    });

    const handlePos = async (lat: number, lng: number) => {
      setEditLat(lat);
      setEditLng(lng);
      markerRef.current?.setPosition({ lat, lng });
      markerRef.current?.setVisible(true);
      try {
        const geocoder = new g.maps.Geocoder();
        const res = await geocoder.geocode({ location: { lat, lng } });
        const formatted = res?.results?.[0]?.formatted_address;
        if (formatted) setEditAddress(formatted);
      } catch {
        /* ignore */
      }
    };

    mapRef.current.addListener("click", (e: any) => {
      if (!e.latLng) return;
      handlePos(e.latLng.lat(), e.latLng.lng());
    });
    markerRef.current.addListener("dragend", (e: any) => {
      if (!e.latLng) return;
      handlePos(e.latLng.lat(), e.latLng.lng());
    });

    if (autocompleteInputRef.current && !autocompleteRef.current) {
      autocompleteRef.current = new g.maps.places.Autocomplete(autocompleteInputRef.current, {
        componentRestrictions: { country: "in" },
        fields: ["formatted_address", "geometry", "name"],
        bounds: new g.maps.LatLngBounds(
          { lat: INDIA_BOUNDS.south, lng: INDIA_BOUNDS.west },
          { lat: INDIA_BOUNDS.north, lng: INDIA_BOUNDS.east }
        ),
      });
      autocompleteRef.current.addListener("place_changed", () => {
        const place = autocompleteRef.current.getPlace();
        if (!place?.geometry?.location) {
          toast.error("Please pick a place from the suggestions");
          return;
        }
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        setEditLat(lat);
        setEditLng(lng);
        setEditAddress(place.formatted_address || place.name || "");
        markerRef.current?.setPosition({ lat, lng });
        markerRef.current?.setVisible(true);
        mapRef.current?.panTo({ lat, lng });
        mapRef.current?.setZoom(16);
      });
    }

    setTimeout(() => {
      if (!mapRef.current) return;
      g.maps.event.trigger(mapRef.current, "resize");
      mapRef.current.panTo({ lat: startLat, lng: startLng });
    }, 150);
  };

  // Initialize Google Map + Autocomplete when the dialog is open and the user enables it.
  useEffect(() => {
    if (!dialogOpen || !useGoogle || !mapActivated) return;
    const frame = window.requestAnimationFrame(() => initializeGoogleMap());
    const t = window.setTimeout(() => initializeGoogleMap(), 250);

    return () => {
      window.cancelAnimationFrame(frame);
      clearTimeout(t);
    };
  }, [dialogOpen, useGoogle, mapActivated]);

  const activateMapPicker = () => {
    setMapActivated(true);
    initializeGoogleMap(true);
    window.setTimeout(() => initializeGoogleMap(true), 80);
  };

  const openAdd = () => {
    setEditAddress("");
    setEditLat(null);
    setEditLng(null);
    setSearchQuery("");
    setResults([]);
    setMapActivated(!isPhoneViewport());
    mapRef.current = null;
    markerRef.current = null;
    autocompleteRef.current = null;
    setDialogOpen(true);
  };

  const openEdit = () => {
    setEditAddress(savedAddress ?? "");
    setEditLat(savedLat);
    setEditLng(savedLng);
    setSearchQuery("");
    setResults([]);
    setMapActivated(!isPhoneViewport());
    mapRef.current = null;
    markerRef.current = null;
    autocompleteRef.current = null;
    setDialogOpen(true);
  };

  const pickResult = (r: NominatimResult) => {
    setEditAddress(r.display_name);
    setEditLat(parseFloat(r.lat));
    setEditLng(parseFloat(r.lon));
    setResults([]);
    setSearchQuery("");
    toast.success("Place selected");
  };

  const useCurrentGps = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setEditLat(latitude);
        setEditLng(longitude);
        // Update map if active
        if (useGoogle && mapRef.current && markerRef.current) {
          markerRef.current.setPosition({ lat: latitude, lng: longitude });
          markerRef.current.setVisible(true);
          mapRef.current.panTo({ lat: latitude, lng: longitude });
          mapRef.current.setZoom(16);
          try {
            const g = (window as any).google;
            const geocoder = new g.maps.Geocoder();
            const res = await geocoder.geocode({ location: { lat: latitude, lng: longitude } });
            const formatted = res?.results?.[0]?.formatted_address;
            if (formatted) {
              setEditAddress(formatted);
              toast.success("Location detected and address filled");
            } else {
              toast.success("Location detected");
            }
          } catch {
            toast.success("Location detected");
          }
          setGpsLoading(false);
          return;
        }
        // Reverse geocode to pre-fill address
        try {
          const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`;
          const res = await fetch(url, { headers: { "Accept-Language": "en" } });
          if (res.ok) {
            const data = await res.json();
            if (data?.display_name) {
              setEditAddress(data.display_name);
              toast.success("Location detected and address filled");
            } else {
              toast.success("Location detected");
            }
          } else {
            toast.success("Location detected");
          }
        } catch {
          toast.success("Location detected");
        }
        setGpsLoading(false);
      },
      (err) => {
        setGpsLoading(false);
        const msg =
          err.code === err.PERMISSION_DENIED
            ? "Location access denied. Please enable it in your browser settings."
            : err.code === err.POSITION_UNAVAILABLE
            ? "Location unavailable. Please try again."
            : err.code === err.TIMEOUT
            ? "Location request timed out. Please try again."
            : "Unable to get your location.";
        toast.error(msg);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const mapStatusLabel = useMemo(() => {
    const currentSite = typeof window !== "undefined" ? `${window.location.origin}/*` : "this site";
    switch (gmapsStatus) {
      case "loading":
        return "Loading Google Maps…";
      case "no-key":
        return "Google Maps not configured by admin — using basic search.";
      case "auth-error":
        return `Google Maps key is blocked for this site. In Google Cloud Console, add this HTTP referrer: ${currentSite}`;
      case "error":
        return "Could not load Google Maps — using basic search.";
      default:
        return null;
    }
  }, [gmapsStatus]);

  const handleSave = async () => {
    if (!user) {
      toast.error("Please login first");
      return;
    }
    const trimmed = editAddress.trim();
    if (!trimmed) {
      toast.error("Please enter an address");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        business_address: trimmed,
        latitude: editLat,
        longitude: editLng,
      } as any)
      .eq("user_id", user.id);
    setSaving(false);
    if (error) {
      toast.error(error.message || "Could not save address");
      return;
    }
    setSavedAddress(trimmed);
    setSavedLat(editLat);
    setSavedLng(editLng);
    setDialogOpen(false);
    toast.success("Delivery address saved");
  };

  const handleRemove = async () => {
    if (!user) return;
    setRemoving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ business_address: null, latitude: null, longitude: null } as any)
      .eq("user_id", user.id);
    setRemoving(false);
    if (error) {
      toast.error(error.message || "Could not remove address");
      return;
    }
    setSavedAddress(null);
    setSavedLat(null);
    setSavedLng(null);
    setRemoveOpen(false);
    toast.success("Address removed");
  };

  return (
    <>
      <Card>
        <CardContent className="p-6">
          {loading ? (
            <div className="text-center text-sm text-muted-foreground py-6">Loading...</div>
          ) : savedAddress ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    Saved Delivery Address
                  </p>
                  <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                    {savedAddress}
                  </p>
                  {savedLat != null && savedLng != null && (
                    <a
                      href={`https://www.google.com/maps?q=${savedLat},${savedLng}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <LocateFixed className="h-3 w-3" />
                      GPS: {savedLat.toFixed(5)}, {savedLng.toFixed(5)}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button variant="outline" size="sm" onClick={openEdit} className="flex-1">
                  <Pencil className="h-4 w-4 mr-1.5" /> Edit Address
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRemoveOpen(true)}
                  className="flex-1 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-1.5" /> Remove
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <MapPin className="h-10 w-10 mx-auto mb-2 opacity-40 text-muted-foreground" />
              <p className="font-medium text-foreground">No delivery address yet</p>
              <p className="text-sm mt-1 text-muted-foreground">
                Add your address to speed up checkout
              </p>
              <Button size="sm" className="mt-4" onClick={openAdd}>
                <Plus className="h-4 w-4 mr-1.5" /> Add Delivery Address
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{savedAddress ? "Edit Delivery Address" : "Set Delivery Address"}</DialogTitle>
            <DialogDescription>
              Search a place, use your GPS, or type your address manually.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {mapStatusLabel && (
              <p className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1.5 break-words">
                {mapStatusLabel}
              </p>
            )}

            {gmapsStatus === "auth-error" && (
              <div className="flex gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <p>
                  Pick-on-map will work after the saved Google Maps API key is authorized for this domain.
                </p>
              </div>
            )}

            {/* Search a place */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Search a place
              </label>
              {useGoogle ? (
                <div className="relative mt-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                  <Input
                    ref={autocompleteInputRef}
                    placeholder="Search city, area, landmark in India..."
                    className="pl-8"
                  />
                </div>
              ) : (
              <div className="relative mt-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search city, area, landmark..."
                  className="pl-8"
                />
                {searching && (
                  <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
                )}
              </div>
              )}
              {!useGoogle && results.length > 0 && (
                <div className="mt-2 max-h-48 overflow-y-auto rounded-md border border-border bg-popover">
                  {results.map((r) => (
                    <button
                      key={r.place_id}
                      type="button"
                      onClick={() => pickResult(r)}
                      className="block w-full text-left px-3 py-2 text-sm hover:bg-accent border-b border-border last:border-b-0"
                    >
                      <span className="line-clamp-2">{r.display_name}</span>
                    </button>
                  ))}
                </div>
              )}
              {!useGoogle && !searching && searchQuery.trim().length >= 3 && results.length === 0 && (
                <p className="mt-1 text-xs text-muted-foreground">No matching places.</p>
              )}
            </div>

            {/* Interactive Google Map */}
            {useGoogle && (
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Pick on map (drag pin)
                </label>
                <div className="relative mt-1 h-64 w-full overflow-hidden rounded-md border border-border bg-muted sm:h-56">
                  <div ref={mapDivRef} className="h-full w-full touch-none" />
                  {!mapActivated && (
                    <div className="absolute inset-0 flex items-center justify-center bg-muted/95 p-4">
                      <Button type="button" onClick={activateMapPicker} className="w-full max-w-56 justify-center">
                        <MapPin className="h-4 w-4 mr-1.5" /> Open Map Picker
                      </Button>
                    </div>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Tap Open Map Picker on phone, then tap the map or drag the pin.
                </p>
              </div>
            )}

            {/* Use current GPS */}
            <Button
              type="button"
              variant="outline"
              onClick={useCurrentGps}
              disabled={gpsLoading}
              className="w-full justify-center"
            >
              {gpsLoading ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <LocateFixed className="h-4 w-4 mr-1.5" />
              )}
              {gpsLoading ? "Getting location..." : "Use My Current GPS Location"}
            </Button>

            {editLat != null && editLng != null && (
              <p className="text-xs text-muted-foreground -mt-2 text-center">
                GPS attached: {editLat.toFixed(5)}, {editLng.toFixed(5)}
              </p>
            )}

            {/* Address textarea */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Full address
              </label>
              <Textarea
                value={editAddress}
                onChange={(e) => setEditAddress(e.target.value)}
                placeholder="House no, Street, Landmark, Pincode..."
                rows={4}
                className="mt-1 text-sm"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !editAddress.trim()}>
              {saving ? "Saving..." : "Save Address"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove confirm */}
      <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove delivery address?</AlertDialogTitle>
            <AlertDialogDescription>
              You will need to set it again at checkout.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove} disabled={removing}>
              {removing ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default AddressManager;