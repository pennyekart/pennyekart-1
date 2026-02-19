import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tag, Handshake, Wallet, CheckCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { useToast } from "@/hooks/use-toast";

interface Collab {
  id: string;
  collab_code: string;
  agent_mobile: string;
  agent_user_id: string | null;
  margin_status: string;
  margin_paid_at: string | null;
  created_at: string;
  penny_prime_coupons: {
    seller_code: string;
    agent_margin_type: string;
    agent_margin_value: number;
    agent_margin_value_type?: string;
    products: { name: string; price: number } | null;
    profiles: { full_name: string | null; company_name: string | null } | null;
  } | null;
  penny_prime_coupon_uses: { id: string; order_id: string | null; agent_margin_amount: number; used_at: string }[];
}

const PennyPrimePage = () => {
  const { toast: toastHook } = useToast();
  const [collabs, setCollabs] = useState<Collab[]>([]);
  const [loading, setLoading] = useState(true);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [selectedCollab, setSelectedCollab] = useState<Collab | null>(null);
  const [paying, setPaying] = useState(false);

  const fetchCollabs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("penny_prime_collabs")
      .select(`
        *,
        penny_prime_coupons (
          seller_code, agent_margin_type, agent_margin_value,
          products (name, price),
          profiles!penny_prime_coupons_seller_id_fkey (full_name, company_name)
        ),
        penny_prime_coupon_uses (id, order_id, agent_margin_amount, used_at)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
    } else {
      setCollabs((data as any) ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCollabs();
  }, []);

  const openPayDialog = (collab: Collab) => {
    setSelectedCollab(collab);
    setPayDialogOpen(true);
  };

  const handlePayMargin = async () => {
    if (!selectedCollab) return;
    setPaying(true);
    try {
      // Calculate total margin
      const coupon = selectedCollab.penny_prime_coupons;
      const uses = selectedCollab.penny_prime_coupon_uses;
      let totalMargin = 0;

      if (uses.length > 0) {
        totalMargin = uses.reduce((s, u) => s + u.agent_margin_amount, 0);
      } else if (coupon) {
        totalMargin = coupon.agent_margin_value;
      }

      if (selectedCollab.agent_user_id) {
        // Get or create agent wallet
        let { data: wallet } = await supabase
          .from("customer_wallets")
          .select("*")
          .eq("customer_user_id", selectedCollab.agent_user_id)
          .maybeSingle();

        if (!wallet) {
          const { data: newWallet } = await supabase
            .from("customer_wallets")
            .insert({ customer_user_id: selectedCollab.agent_user_id, balance: totalMargin })
            .select()
            .single();
          wallet = newWallet;
        } else {
          await supabase
            .from("customer_wallets")
            .update({ balance: wallet.balance + totalMargin })
            .eq("id", wallet.id);
        }

        if (wallet) {
          await supabase.from("customer_wallet_transactions").insert({
            wallet_id: wallet.id,
            customer_user_id: selectedCollab.agent_user_id,
            type: "credit",
            amount: totalMargin,
            description: `Penny Prime agent margin for code: ${selectedCollab.collab_code}`,
          });
        }
      }

      // Mark collab as paid
      const { data: authUser } = await supabase.auth.getUser();
      await supabase
        .from("penny_prime_collabs")
        .update({
          margin_status: "paid",
          margin_paid_at: new Date().toISOString(),
          margin_paid_by: authUser.user?.id,
        })
        .eq("id", selectedCollab.id);

      toastHook({ title: `₹${totalMargin} credited to agent wallet!` });
      setPayDialogOpen(false);
      fetchCollabs();
    } catch (err: any) {
      toast.error(err.message || "Payment failed");
    } finally {
      setPaying(false);
    }
  };

  const pending = collabs.filter(c => c.margin_status === "pending");
  const paid = collabs.filter(c => c.margin_status === "paid");

  const getMarginAmount = (c: Collab) => {
    const uses = c.penny_prime_coupon_uses;
    if (uses.length > 0) return uses.reduce((s, u) => s + u.agent_margin_amount, 0);
    return c.penny_prime_coupons?.agent_margin_value ?? 0;
  };

  const CollabTable = ({ items }: { items: Collab[] }) => (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Code</TableHead>
            <TableHead>Product</TableHead>
            <TableHead>Seller</TableHead>
            <TableHead>Agent Mobile</TableHead>
            <TableHead>Margin</TableHead>
            <TableHead>Uses</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                No records found
              </TableCell>
            </TableRow>
          ) : (
            items.map(c => (
              <TableRow key={c.id}>
                <TableCell className="font-mono font-bold text-primary text-xs">{c.collab_code}</TableCell>
                <TableCell className="text-xs">{c.penny_prime_coupons?.products?.name ?? "—"}</TableCell>
                <TableCell className="text-xs">
                  {c.penny_prime_coupons?.profiles?.company_name || c.penny_prime_coupons?.profiles?.full_name || "—"}
                </TableCell>
                <TableCell className="text-xs">{c.agent_mobile}</TableCell>
                <TableCell className="text-xs font-semibold">₹{getMarginAmount(c)}</TableCell>
                <TableCell className="text-xs">{c.penny_prime_coupon_uses.length}</TableCell>
                <TableCell>
                  {c.margin_status === "paid" ? (
                    <Badge className="bg-primary/15 text-primary border-primary/20 text-xs gap-1">
                      <CheckCircle className="h-3 w-3" /> Paid
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs gap-1">
                      <Clock className="h-3 w-3" /> Pending
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  {c.margin_status === "pending" && (
                    <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => openPayDialog(c)}>
                      <Wallet className="h-3.5 w-3.5" /> Pay Margin
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Handshake className="h-6 w-6 text-primary" /> Penny Prime
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Manage agent collabs and margin payouts</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card>
            <CardContent className="pt-5 pb-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Collabs</p>
              <p className="text-2xl font-bold mt-1">{collabs.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Pending Payout</p>
              <p className="text-2xl font-bold mt-1 text-amber-600">{pending.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Paid Out</p>
              <p className="text-2xl font-bold mt-1 text-primary">{paid.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Uses</p>
              <p className="text-2xl font-bold mt-1">{collabs.reduce((s, c) => s + c.penny_prime_coupon_uses.length, 0)}</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="pending">
          <TabsList>
            <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
            <TabsTrigger value="paid">Paid ({paid.length})</TabsTrigger>
            <TabsTrigger value="all">All ({collabs.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="pending" className="mt-4">
            {loading ? <p className="text-muted-foreground text-sm">Loading...</p> : <CollabTable items={pending} />}
          </TabsContent>
          <TabsContent value="paid" className="mt-4">
            {loading ? <p className="text-muted-foreground text-sm">Loading...</p> : <CollabTable items={paid} />}
          </TabsContent>
          <TabsContent value="all" className="mt-4">
            {loading ? <p className="text-muted-foreground text-sm">Loading...</p> : <CollabTable items={collabs} />}
          </TabsContent>
        </Tabs>
      </div>

      {/* Pay Margin Dialog */}
      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" /> Pay Agent Margin
            </DialogTitle>
            <DialogDescription>
              Confirm you want to credit the agent's wallet for collab code{" "}
              <span className="font-mono font-bold text-foreground">{selectedCollab?.collab_code}</span>
            </DialogDescription>
          </DialogHeader>
          {selectedCollab && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Agent Mobile</span>
                  <span className="font-semibold">{selectedCollab.agent_mobile}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Margin Amount</span>
                  <span className="font-bold text-primary">₹{getMarginAmount(selectedCollab)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Times Used</span>
                  <span>{selectedCollab.penny_prime_coupon_uses.length}</span>
                </div>
              </div>
              {!selectedCollab.agent_user_id && (
                <p className="text-xs text-amber-600 bg-amber-50 rounded p-2 border border-amber-200">
                  ⚠️ This agent is not linked to an account. Wallet credit may not apply.
                </p>
              )}
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setPayDialogOpen(false)}>Cancel</Button>
                <Button className="flex-1" onClick={handlePayMargin} disabled={paying}>
                  {paying ? "Processing..." : "Confirm & Pay"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default PennyPrimePage;
