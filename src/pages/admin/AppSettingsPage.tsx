import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, ExternalLink, Upload, Smartphone, X, Apple } from "lucide-react";
import carbsLogo from "@/assets/carbs-logo.png";

const AppSettingsPage = () => {
  const { toast } = useToast();
  const [carbsUrl, setCarbsUrl] = useState("");
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
        .in("key", ["pennycarbs_url", "android_app_url", "ios_app_url"]);
      
      data?.forEach((row) => {
        if (row.key === "pennycarbs_url") setCarbsUrl(row.value ?? "");
        if (row.key === "android_app_url") setAndroidUrl(row.value ?? "");
        if (row.key === "ios_app_url") setIosUrl(row.value ?? "");
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
