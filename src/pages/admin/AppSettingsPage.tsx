import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, ExternalLink, Upload, Smartphone, X, Apple, Utensils } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import carbsLogo from "@/assets/carbs-logo.png";

const AppSettingsPage = () => {
  const { toast } = useToast();
  const [carbsUrl, setCarbsUrl] = useState("");
  const [carbsApiUrl, setCarbsApiUrl] = useState("");
  const [carbsApiKey, setCarbsApiKey] = useState("");
  const [carbsBannerEnabled, setCarbsBannerEnabled] = useState(false);
  const [savingCarbsApi, setSavingCarbsApi] = useState(false);
  const [carbsSupabaseUrl, setCarbsSupabaseUrl] = useState("");
  const [carbsTable, setCarbsTable] = useState("products");
  const [carbsNameCol, setCarbsNameCol] = useState("name");
  const [carbsImageCol, setCarbsImageCol] = useState("image_url");
  const [carbsPriceCol, setCarbsPriceCol] = useState("price");
  const [carbsLimit, setCarbsLimit] = useState("8");
  const [androidUrl, setAndroidUrl] = useState("");
  const [iosUrl, setIosUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAndroid, setUploadingAndroid] = useState(false);
  const [uploadingIos, setUploadingIos] = useState(false);
  const androidFileRef = useRef<HTMLInputElement>(null);
  const iosFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("key, value")
        .in("key", [
          "pennycarbs_url",
          "android_app_url",
          "ios_app_url",
          "pennycarbs_items_api_url",
          "pennycarbs_api_key",
          "pennycarbs_banner_enabled",
          "pennycarbs_supabase_url",
          "pennycarbs_table",
          "pennycarbs_name_col",
          "pennycarbs_image_col",
          "pennycarbs_price_col",
          "pennycarbs_limit",
        ]);
      
      data?.forEach((row) => {
        if (row.key === "pennycarbs_url") setCarbsUrl(row.value ?? "");
        if (row.key === "android_app_url") setAndroidUrl(row.value ?? "");
        if (row.key === "ios_app_url") setIosUrl(row.value ?? "");
        if (row.key === "pennycarbs_items_api_url") setCarbsApiUrl(row.value ?? "");
        if (row.key === "pennycarbs_api_key") setCarbsApiKey(row.value ?? "");
        if (row.key === "pennycarbs_banner_enabled") setCarbsBannerEnabled(row.value === "true");
        if (row.key === "pennycarbs_supabase_url") setCarbsSupabaseUrl(row.value ?? "");
        if (row.key === "pennycarbs_table" && row.value) setCarbsTable(row.value);
        if (row.key === "pennycarbs_name_col" && row.value) setCarbsNameCol(row.value);
        if (row.key === "pennycarbs_image_col" && row.value) setCarbsImageCol(row.value);
        if (row.key === "pennycarbs_price_col" && row.value) setCarbsPriceCol(row.value);
        if (row.key === "pennycarbs_limit" && row.value) setCarbsLimit(row.value);
      });
      setLoading(false);
    };
    fetchSettings();
  }, []);

  const handleUploadFile = async (
    file: File,
    platform: "android" | "ios",
    setUploading: (v: boolean) => void,
    setUrl: (v: string) => void,
    settingsKey: string
  ) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const fileName = `${platform}-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("app-downloads")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("app-downloads")
        .getPublicUrl(fileName);

      const publicUrl = urlData.publicUrl;
      setUrl(publicUrl);

      await supabase
        .from("app_settings")
        .update({ value: publicUrl })
        .eq("key", settingsKey);

      toast({ title: `${platform === "android" ? "Android" : "iOS"} app uploaded successfully` });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveFile = async (
    platform: "android" | "ios",
    setUrl: (v: string) => void,
    settingsKey: string
  ) => {
    setUrl("");
    await supabase.from("app_settings").update({ value: null }).eq("key", settingsKey);
    toast({ title: `${platform === "android" ? "Android" : "iOS"} app removed` });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Check if row exists
      const { data: existing } = await supabase
        .from("app_settings")
        .select("id")
        .eq("key", "pennycarbs_url")
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("app_settings")
          .update({ value: carbsUrl.trim() })
          .eq("key", "pennycarbs_url");
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("app_settings")
          .insert({ key: "pennycarbs_url", value: carbsUrl.trim(), description: "Penny Carbs food delivery URL" });
        if (error) throw error;
      }

      toast({
        title: "Settings saved",
        description: "Penny Carbs URL has been updated successfully.",
      });
    } catch (err: any) {
      toast({
        title: "Error saving settings",
        description: err.message ?? "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const upsertSetting = async (key: string, value: string | null, description?: string) => {
    const { data: existing } = await supabase
      .from("app_settings")
      .select("id")
      .eq("key", key)
      .maybeSingle();
    if (existing) {
      const { error } = await supabase.from("app_settings").update({ value }).eq("key", key);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("app_settings")
        .insert({ key, value, description: description ?? key });
      if (error) throw error;
    }
  };

  const handleSaveCarbsApi = async () => {
    setSavingCarbsApi(true);
    try {
      await upsertSetting("pennycarbs_items_api_url", carbsApiUrl.trim(), "Penny Carbs items API URL");
      await upsertSetting("pennycarbs_api_key", carbsApiKey.trim(), "Penny Carbs items API key");
      await upsertSetting(
        "pennycarbs_banner_enabled",
        carbsBannerEnabled ? "true" : "false",
        "Show Penny Carbs banner on homepage"
      );
      await upsertSetting("pennycarbs_supabase_url", carbsSupabaseUrl.trim(), "Penny Carbs Supabase project URL");
      await upsertSetting("pennycarbs_table", carbsTable.trim() || "products", "Penny Carbs items table name");
      await upsertSetting("pennycarbs_name_col", carbsNameCol.trim() || "name", "Penny Carbs name column");
      await upsertSetting("pennycarbs_image_col", carbsImageCol.trim() || "image_url", "Penny Carbs image column");
      await upsertSetting("pennycarbs_price_col", carbsPriceCol.trim() || "price", "Penny Carbs price column");
      await upsertSetting("pennycarbs_limit", carbsLimit.trim() || "8", "Penny Carbs items max count");
      toast({ title: "Penny Carbs API settings saved" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSavingCarbsApi(false);
    }
  };

  return (
    <AdminLayout>
      <h1 className="mb-6 text-2xl font-bold">App Settings</h1>

      <div className="max-w-2xl space-y-6">
        {/* Penny Carbs Config */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <img src={carbsLogo} alt="Penny Carbs" className="h-6" />
              <div>
                <CardTitle>Penny Carbs — Food Delivery</CardTitle>
                <CardDescription>
                  Configure the external food delivery website URL. Customers will see this embedded inside the app.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading...
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="carbsUrl">External Website URL</Label>
                  <Input
                    id="carbsUrl"
                    type="url"
                    placeholder="https://your-food-delivery-site.com"
                    value={carbsUrl}
                    onChange={(e) => setCarbsUrl(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter the full URL of your Penny Carbs food delivery website. Leave blank to show "Coming Soon" to customers.
                  </p>
                </div>

                {carbsUrl && (
                  <div className="flex items-center gap-2 rounded-md bg-muted p-3 text-sm">
                    <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="truncate text-muted-foreground">{carbsUrl}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-auto shrink-0 h-auto py-0.5 px-2 text-xs"
                      onClick={() => window.open(carbsUrl, "_blank")}
                    >
                      Test
                    </Button>
                  </div>
                )}

                <Button onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save Settings
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Penny Carbs Items API */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Utensils className="h-6 w-6 text-accent" />
              <div>
                <CardTitle>Penny Carbs — Food Items API</CardTitle>
                <CardDescription>
                  Configure the API that powers the auto-rotating food banner shown below the navbar on the customer homepage.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading...
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <Label className="text-sm font-medium">Show banner on homepage</Label>
                    <p className="text-xs text-muted-foreground">Hides automatically when no items are returned.</p>
                  </div>
                  <Switch checked={carbsBannerEnabled} onCheckedChange={setCarbsBannerEnabled} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="carbsApiUrl">Items API URL</Label>
                  <Input
                    id="carbsApiUrl"
                    type="url"
                    placeholder="https://penny-carbs.vercel.app/api/featured-items"
                    value={carbsApiUrl}
                    onChange={(e) => setCarbsApiUrl(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Optional. If set, this custom endpoint is used and the Supabase config below is ignored. Must return <code className="rounded bg-muted px-1">[{`{ name, image_url, price? }`}]</code>.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="carbsApiKey">API Key / Supabase publishable key</Label>
                  <Input
                    id="carbsApiKey"
                    type="password"
                    placeholder="sb_publishable_… or your bearer token"
                    value={carbsApiKey}
                    onChange={(e) => setCarbsApiKey(e.target.value)}
                  />
                </div>

                <div className="rounded-md border border-dashed p-3 space-y-3">
                  <p className="text-xs font-medium text-muted-foreground">
                    Supabase source (used when no custom URL is set above)
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="carbsSupabaseUrl">Penny Carbs Supabase URL</Label>
                    <Input
                      id="carbsSupabaseUrl"
                      type="url"
                      placeholder="https://xxxxxx.supabase.co"
                      value={carbsSupabaseUrl}
                      onChange={(e) => setCarbsSupabaseUrl(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label htmlFor="carbsTable" className="text-xs">Table</Label>
                      <Input id="carbsTable" value={carbsTable} onChange={(e) => setCarbsTable(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="carbsLimit" className="text-xs">Max items</Label>
                      <Input id="carbsLimit" type="number" value={carbsLimit} onChange={(e) => setCarbsLimit(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="carbsNameCol" className="text-xs">Name column</Label>
                      <Input id="carbsNameCol" value={carbsNameCol} onChange={(e) => setCarbsNameCol(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="carbsImageCol" className="text-xs">Image column</Label>
                      <Input id="carbsImageCol" value={carbsImageCol} onChange={(e) => setCarbsImageCol(e.target.value)} />
                    </div>
                    <div className="space-y-1 col-span-2">
                      <Label htmlFor="carbsPriceCol" className="text-xs">Price column (optional)</Label>
                      <Input id="carbsPriceCol" value={carbsPriceCol} onChange={(e) => setCarbsPriceCol(e.target.value)} />
                    </div>
                  </div>
                </div>

                <Button onClick={handleSaveCarbsApi} disabled={savingCarbsApi}>
                  {savingCarbsApi ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save API Settings
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* App Downloads */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Smartphone className="h-6 w-6 text-primary" />
              <div>
                <CardTitle>Mobile App Downloads</CardTitle>
                <CardDescription>
                  Upload Android (APK) and iOS (IPA) app files. Customers can download and install from their profile menu.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading...
              </div>
            ) : (
              <>
                {/* Android */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4" /> Android App (.apk)
                  </Label>
                  {androidUrl ? (
                    <div className="flex items-center gap-2 rounded-md bg-muted p-3 text-sm">
                      <Smartphone className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="truncate text-muted-foreground flex-1">{androidUrl.split("/").pop()}</span>
                      <Button variant="ghost" size="sm" className="h-auto py-0.5 px-2 text-xs" onClick={() => window.open(androidUrl, "_blank")}>
                        Download
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleRemoveFile("android", setAndroidUrl, "android_app_url")}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      disabled={uploadingAndroid}
                      onClick={() => androidFileRef.current?.click()}
                      className="w-full justify-center gap-2 border-dashed h-16"
                    >
                      {uploadingAndroid ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      {uploadingAndroid ? "Uploading..." : "Upload Android APK"}
                    </Button>
                  )}
                  <input
                    ref={androidFileRef}
                    type="file"
                    accept=".apk,.aab"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUploadFile(file, "android", setUploadingAndroid, setAndroidUrl, "android_app_url");
                      e.target.value = "";
                    }}
                  />
                </div>

                {/* iOS */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <Apple className="h-4 w-4" /> iOS App (.ipa)
                  </Label>
                  {iosUrl ? (
                    <div className="flex items-center gap-2 rounded-md bg-muted p-3 text-sm">
                      <Apple className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="truncate text-muted-foreground flex-1">{iosUrl.split("/").pop()}</span>
                      <Button variant="ghost" size="sm" className="h-auto py-0.5 px-2 text-xs" onClick={() => window.open(iosUrl, "_blank")}>
                        Download
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleRemoveFile("ios", setIosUrl, "ios_app_url")}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      disabled={uploadingIos}
                      onClick={() => iosFileRef.current?.click()}
                      className="w-full justify-center gap-2 border-dashed h-16"
                    >
                      {uploadingIos ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      {uploadingIos ? "Uploading..." : "Upload iOS IPA"}
                    </Button>
                  )}
                  <input
                    ref={iosFileRef}
                    type="file"
                    accept=".ipa"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUploadFile(file, "ios", setUploadingIos, setIosUrl, "ios_app_url");
                      e.target.value = "";
                    }}
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AppSettingsPage;
