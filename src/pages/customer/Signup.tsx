import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, Link, useLocation, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import logo from "@/assets/logo.png";

interface District {
  id: string;
  name: string;
}

interface LocalBody {
  id: string;
  name: string;
  body_type: string;
  ward_count: number;
}

const CUSTOMER_PASSWORD = "pennyekart_customer_2024";

const CustomerSignup = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const referralCode = searchParams.get("ref") || "";
  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState((location.state as any)?.mobile || "");
  const [districtId, setDistrictId] = useState("");
  const [localBodyId, setLocalBodyId] = useState("");
  const [wardNumber, setWardNumber] = useState("");
  const [districts, setDistricts] = useState<District[]>([]);
  const [localBodies, setLocalBodies] = useState<LocalBody[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const fetchDistricts = async () => {
      try {
        const { data, error } = await supabase
          .from("locations_districts")
          .select("id, name")
          .eq("is_active", true)
          .order("sort_order");
        if (error) {
          console.error("District fetch error:", error);
          setFetchError("Could not load districts. Please refresh.");
          return;
        }
        setDistricts(data ?? []);
      } catch (err) {
        console.error("District fetch failed:", err);
        setFetchError("Network error loading districts. Please check your connection.");
      }
    };
    fetchDistricts();
  }, []);

  useEffect(() => {
    if (!districtId) { setLocalBodies([]); return; }
    const fetchLocalBodies = async () => {
      try {
        const { data, error } = await supabase
          .from("locations_local_bodies")
          .select("id, name, body_type, ward_count")
          .eq("district_id", districtId)
          .eq("is_active", true)
          .order("sort_order");
        if (error) {
          console.error("Local body fetch error:", error);
          return;
        }
        setLocalBodies((data as LocalBody[]) ?? []);
      } catch (err) {
        console.error("Local body fetch failed:", err);
      }
    };
    fetchLocalBodies();
  }, [districtId]);

  const selectedLocalBody = localBodies.find(lb => lb.id === localBodyId);
  const wardOptions = selectedLocalBody ? Array.from({ length: selectedLocalBody.ward_count }, (_, i) => i + 1) : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{10}$/.test(mobile)) {
      toast({ title: "Enter a valid 10-digit mobile number", variant: "destructive" });
      return;
    }
    if (!localBodyId || !wardNumber) {
      toast({ title: "Please select your panchayath and ward", variant: "destructive" });
      return;
    }
    setLoading(true);

    try {
      const email = `${mobile}@pennyekart.in`;
      const { error } = await supabase.auth.signUp({
        email,
        password: CUSTOMER_PASSWORD,
        options: {
          data: {
            full_name: fullName.trim(),
            mobile_number: mobile,
            user_type: "customer",
            local_body_id: localBodyId,
            ward_number: parseInt(wardNumber),
            referral_code: referralCode || undefined,
          },
        },
      });

      if (error) {
        if (error.message.includes("already registered")) {
          toast({ title: "Mobile number already registered", description: "Please login instead.", variant: "destructive" });
        } else {
          toast({ title: "Signup failed", description: error.message, variant: "destructive" });
        }
      } else {
        toast({ title: "Registration successful!", description: "You can now start shopping." });
        navigate("/", { state: { showSignupReward: true } });
      }
    } catch (err) {
      toast({ title: "Connection error", description: "Please check your internet connection and try again.", variant: "destructive" });
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <img src={logo} alt="Pennyekart" className="mx-auto mb-4 h-12" />
          <CardTitle className="text-2xl">Customer Signup</CardTitle>
          <CardDescription>Create your account to start shopping</CardDescription>
        </CardHeader>
        <CardContent>
          {fetchError && (
            <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {fetchError}
              <Button variant="link" size="sm" className="ml-2 p-0 h-auto text-destructive underline" onClick={() => window.location.reload()}>
                Refresh
              </Button>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="fullName">Full Name</Label>
              <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required maxLength={100} />
            </div>
            <div>
              <Label htmlFor="mobile">Mobile Number</Label>
              <Input id="mobile" type="tel" placeholder="10-digit number" value={mobile} onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))} required />
            </div>
            <div>
              <Label>State</Label>
              <Input value="Kerala" disabled />
            </div>
            <div>
              <Label htmlFor="district">District</Label>
              <select
                id="district"
                value={districtId}
                onChange={(e) => { setDistrictId(e.target.value); setLocalBodyId(""); setWardNumber(""); }}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">Select district</option>
                {districts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="localBody">Panchayath / Municipality</Label>
              <select
                id="localBody"
                value={localBodyId}
                onChange={(e) => { setLocalBodyId(e.target.value); setWardNumber(""); }}
                disabled={!districtId}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Select panchayath</option>
                {localBodies.map(lb => <option key={lb.id} value={lb.id}>{lb.name} ({lb.body_type})</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="ward">Ward</Label>
              <select
                id="ward"
                value={wardNumber}
                onChange={(e) => setWardNumber(e.target.value)}
                disabled={!localBodyId}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Select ward</option>
                {wardOptions.map(w => <option key={w} value={String(w)}>Ward {w}</option>)}
              </select>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Registering..." : "Sign Up"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Already registered? <Link to="/customer/login" className="text-primary underline">Login here</Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CustomerSignup;
