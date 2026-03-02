import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useLiteMode } from "@/hooks/useLiteMode";
import { Zap } from "lucide-react";
import logo from "@/assets/logo.png";

const CUSTOMER_PASSWORD = "pennyekart_customer_2024";

const CustomerLogin = () => {
  const [mobile, setMobile] = useState("");
  const [loading, setLoading] = useState(false);
  const [showLiteSuggestion, setShowLiteSuggestion] = useState(false);
  const [failCount, setFailCount] = useState(0);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { setLiteMode } = useLiteMode();
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{10}$/.test(mobile)) {
      toast({ title: "Enter a valid 10-digit mobile number", variant: "destructive" });
      return;
    }
    setLoading(true);

    // Safety timeout - if login takes more than 15 seconds, reset
    timeoutRef.current = setTimeout(() => {
      setLoading(false);
      setShowLiteSuggestion(true);
      toast({ title: "Login timed out", description: "Please try again or switch to Lite version.", variant: "destructive" });
    }, 15000);

    try {
      const email = `${mobile}@pennyekart.in`;
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: CUSTOMER_PASSWORD });

      clearTimeout(timeoutRef.current);

      if (error) {
        setLoading(false);
        toast({ title: "Not registered", description: "Redirecting to sign up...", variant: "default" });
        setTimeout(() => navigate("/customer/signup", { state: { mobile } }), 800);
        return;
      }

      // Navigate immediately, profile check happens in background via AuthProvider
      setLoading(false);
      navigate("/");
    } catch (err) {
      clearTimeout(timeoutRef.current);
      setShowLiteSuggestion(true);
      toast({ title: "Connection error", description: "Please check your internet connection and try again.", variant: "destructive" });
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <img src={logo} alt="Pennyekart" className="mx-auto mb-4 h-12" />
          <CardTitle className="text-2xl">Customer Login</CardTitle>
          <CardDescription>Enter your mobile number to continue</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="mobile">Mobile Number</Label>
              <Input id="mobile" type="tel" placeholder="10-digit number" value={mobile} onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))} required />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Logging in..." : "Login"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              New customer? <Link to="/customer/signup" className="text-primary underline">Sign up here</Link>
            </p>
            {showLiteSuggestion && (
              <div className="rounded-lg border border-accent bg-accent/10 p-3 text-center">
                <p className="text-sm font-medium text-foreground mb-2">
                  Having trouble? Try our Lite version
                </p>
                <p className="text-xs text-muted-foreground mb-3">
                  Faster loading, works better on older phones
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    setLiteMode(true);
                    navigate("/");
                  }}
                >
                  <Zap className="h-3.5 w-3.5" />
                  Switch to Lite Version
                </Button>
              </div>
            )}
            <div className="flex justify-center gap-4 text-xs text-muted-foreground pt-2">
              <Link to="/selling-partner/login" className="text-primary underline">Selling Partner Login</Link>
              <span>·</span>
              <Link to="/delivery-staff/login" className="text-primary underline">Delivery Partner Login</Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CustomerLogin;
