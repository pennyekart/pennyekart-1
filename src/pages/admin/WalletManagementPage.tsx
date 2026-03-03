import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { Wallet, ArrowUpCircle, ArrowDownCircle, Settings, RefreshCw, Gift, ShoppingCart, Moon, CreditCard, Search, Eye } from "lucide-react";

interface WalletRow {
  id: string;
  user_id: string;
  balance: number;
  earning_balance?: number;
  min_usage_amount?: number;
  user_name: string;
  email: string;
  created_at: string;
}

interface TransactionRow {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  created_at: string;
  order_id: string | null;
}

interface WalletRule {
  key: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  enabledKey: string;
  amountKey: string;
  enabled: boolean;
  amount: string;
}

const RULE_DEFINITIONS = [
  {
    key: "signup_bonus",
    label: "New Signup Bonus",
    description: "Reward customers with wallet points when they sign up for the first time.",
    icon: <Gift className="h-5 w-5 text-green-600" />,
    enabledKey: "wallet_rule_signup_enabled",
    amountKey: "wallet_rule_signup_amount",
  },
  {
    key: "first_purchase",
    label: "First Purchase Reward",
    description: "Credit wallet points after a customer completes their first order.",
    icon: <ShoppingCart className="h-5 w-5 text-blue-600" />,
    enabledKey: "wallet_rule_first_purchase_enabled",
    amountKey: "wallet_rule_first_purchase_amount",
  },
  {
    key: "midnight_order",
    label: "Midnight Order Bonus",
    description: "Extra wallet points for orders placed between 12:00 AM – 5:00 AM.",
    icon: <Moon className="h-5 w-5 text-purple-600" />,
    enabledKey: "wallet_rule_midnight_enabled",
    amountKey: "wallet_rule_midnight_amount",
  },
  {
    key: "min_order_wallet",
    label: "Wallet Applicable Min Order",
    description: "Minimum cart/order amount required for customers to redeem wallet balance at checkout.",
    icon: <CreditCard className="h-5 w-5 text-orange-600" />,
    enabledKey: "wallet_rule_min_order_enabled",
    amountKey: "wallet_min_usage_amount",
  },
];

const WalletManagementPage = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("rules");
  const [customerWallets, setCustomerWallets] = useState<WalletRow[]>([]);
  const [sellerWallets, setSellerWallets] = useState<WalletRow[]>([]);
  const [deliveryWallets, setDeliveryWallets] = useState<WalletRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Transaction dialog
  const [txnOpen, setTxnOpen] = useState(false);
  const [txnWallet, setTxnWallet] = useState<WalletRow | null>(null);
  const [txnType, setTxnType] = useState<"credit" | "debit">("credit");
  const [txnAmount, setTxnAmount] = useState("");
  const [txnDesc, setTxnDesc] = useState("");
  const [txnLoading, setTxnLoading] = useState(false);

  // Min amount dialog (customer only)
  const [minOpen, setMinOpen] = useState(false);
  const [minWallet, setMinWallet] = useState<WalletRow | null>(null);
  const [minAmount, setMinAmount] = useState("");

  // Wallet rules
  const [walletRules, setWalletRules] = useState<WalletRule[]>([]);
  const [rulesSaving, setRulesSaving] = useState(false);

  // Transaction history
  const [histOpen, setHistOpen] = useState(false);
  const [histWallet, setHistWallet] = useState<WalletRow | null>(null);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [histLoading, setHistLoading] = useState(false);

  // Detail view dialog
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailWallet, setDetailWallet] = useState<WalletRow | null>(null);

  const fetchWalletRules = async () => {
    const allKeys = RULE_DEFINITIONS.flatMap((r) => [r.enabledKey, r.amountKey]);
    const { data } = await supabase.from("app_settings").select("key, value").in("key", allKeys);
    const settingsMap = new Map((data ?? []).map((s: any) => [s.key, s.value]));

    setWalletRules(
      RULE_DEFINITIONS.map((def) => ({
        ...def,
        enabled: settingsMap.get(def.enabledKey) === "true",
        amount: settingsMap.get(def.amountKey) ?? (def.key === "min_order_wallet" ? "100" : "0"),
      }))
    );
  };

  const saveWalletRules = async () => {
    setRulesSaving(true);
    try {
      for (const rule of walletRules) {
        // Upsert enabled flag
        const { data: existingEnabled } = await supabase
          .from("app_settings")
          .select("id")
          .eq("key", rule.enabledKey)
          .maybeSingle();
        if (existingEnabled) {
          await supabase.from("app_settings").update({ value: String(rule.enabled), updated_by: user?.id } as any).eq("id", existingEnabled.id);
        } else {
          await supabase.from("app_settings").insert({ key: rule.enabledKey, value: String(rule.enabled), description: `${rule.label} - enabled`, updated_by: user?.id } as any);
        }

        // Upsert amount
        const { data: existingAmount } = await supabase
          .from("app_settings")
          .select("id")
          .eq("key", rule.amountKey)
          .maybeSingle();
        if (existingAmount) {
          await supabase.from("app_settings").update({ value: rule.amount, updated_by: user?.id } as any).eq("id", existingAmount.id);
        } else {
          await supabase.from("app_settings").insert({ key: rule.amountKey, value: rule.amount, description: `${rule.label} - amount`, updated_by: user?.id } as any);
        }
      }

      // If min_order_wallet rule changed, also update all customer wallets
      const minOrderRule = walletRules.find((r) => r.key === "min_order_wallet");
      if (minOrderRule) {
        await supabase.from("customer_wallets").update({ min_usage_amount: Number(minOrderRule.amount) } as any).neq("id", "00000000-0000-0000-0000-000000000000");
      }

      toast({ title: "Wallet rules saved successfully" });
    } catch (e: any) {
      toast({ title: "Error saving rules", description: e.message, variant: "destructive" });
    }
    setRulesSaving(false);
  };

  const updateRule = (key: string, field: "enabled" | "amount", value: any) => {
    setWalletRules((prev) =>
      prev.map((r) => (r.key === key ? { ...r, [field]: value } : r))
    );
  };

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([fetchCustomerWallets(), fetchSellerWallets(), fetchDeliveryWallets(), fetchWalletRules()]);
    setLoading(false);
  };

  const fetchCustomerWallets = async () => {
    const { data: wallets } = await supabase.from("customer_wallets").select("*");
    if (!wallets) return setCustomerWallets([]);
    const userIds = wallets.map((w: any) => w.customer_user_id);
    const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, email").in("user_id", userIds);
    const profileMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));
    setCustomerWallets(wallets.map((w: any) => ({
      id: w.id, user_id: w.customer_user_id, balance: w.balance,
      min_usage_amount: w.min_usage_amount, user_name: profileMap.get(w.customer_user_id)?.full_name || "N/A",
      email: profileMap.get(w.customer_user_id)?.email || "", created_at: w.created_at,
    })));
  };

  const fetchSellerWallets = async () => {
    const { data: wallets } = await supabase.from("seller_wallets").select("*");
    if (!wallets) return setSellerWallets([]);
    const userIds = wallets.map((w: any) => w.seller_id);
    const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, email").in("user_id", userIds);
    const profileMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));
    setSellerWallets(wallets.map((w: any) => ({
      id: w.id, user_id: w.seller_id, balance: w.balance,
      user_name: profileMap.get(w.seller_id)?.full_name || "N/A",
      email: profileMap.get(w.seller_id)?.email || "", created_at: w.created_at,
    })));
  };

  const fetchDeliveryWallets = async () => {
    const { data: wallets } = await supabase.from("delivery_staff_wallets").select("*");
    if (!wallets) return setDeliveryWallets([]);
    const userIds = wallets.map((w: any) => w.staff_user_id);
    const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, email").in("user_id", userIds);
    const profileMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));
    setDeliveryWallets(wallets.map((w: any) => ({
      id: w.id, user_id: w.staff_user_id, balance: w.balance, earning_balance: w.earning_balance,
      user_name: profileMap.get(w.staff_user_id)?.full_name || "N/A",
      email: profileMap.get(w.staff_user_id)?.email || "", created_at: w.created_at,
    })));
  };

  useEffect(() => { fetchAll(); }, []);

  const handleTransaction = async () => {
    if (!txnWallet || !txnAmount || Number(txnAmount) <= 0) {
      toast({ title: "Invalid amount", variant: "destructive" }); return;
    }
    setTxnLoading(true);
    const amount = Number(txnAmount);
    const walletType = activeTab;

    try {
      if (walletType === "customer") {
        const newBalance = txnType === "credit" ? txnWallet.balance + amount : txnWallet.balance - amount;
        if (newBalance < 0) { toast({ title: "Insufficient balance", variant: "destructive" }); setTxnLoading(false); return; }
        await supabase.from("customer_wallets").update({ balance: newBalance } as any).eq("id", txnWallet.id);
        await supabase.from("customer_wallet_transactions").insert({
          wallet_id: txnWallet.id, customer_user_id: txnWallet.user_id,
          type: txnType, amount, description: txnDesc || `Admin ${txnType}`, created_by: user?.id,
        } as any);
      } else if (walletType === "seller") {
        const newBalance = txnType === "credit" ? txnWallet.balance + amount : txnWallet.balance - amount;
        if (newBalance < 0) { toast({ title: "Insufficient balance", variant: "destructive" }); setTxnLoading(false); return; }
        await supabase.from("seller_wallets").update({ balance: newBalance }).eq("id", txnWallet.id);
        await supabase.from("seller_wallet_transactions").insert({
          wallet_id: txnWallet.id, seller_id: txnWallet.user_id,
          type: txnType, amount, description: txnDesc || `Admin ${txnType}`, settled_by: user?.id,
        });
      } else {
        const newBalance = txnType === "credit" ? txnWallet.balance + amount : txnWallet.balance - amount;
        if (newBalance < 0) { toast({ title: "Insufficient balance", variant: "destructive" }); setTxnLoading(false); return; }
        await supabase.from("delivery_staff_wallets").update({ balance: newBalance }).eq("id", txnWallet.id);
        await supabase.from("delivery_staff_wallet_transactions").insert({
          wallet_id: txnWallet.id, staff_user_id: txnWallet.user_id,
          type: txnType, amount, description: txnDesc || `Admin ${txnType}`,
        });
      }

      toast({ title: `${txnType === "credit" ? "Credited" : "Debited"} ₹${amount} successfully` });
      setTxnOpen(false); setTxnAmount(""); setTxnDesc("");
      fetchAll();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setTxnLoading(false);
  };

  const handleMinAmountSave = async () => {
    if (!minWallet || !minAmount) return;
    await supabase.from("customer_wallets").update({ min_usage_amount: Number(minAmount) } as any).eq("id", minWallet.id);
    toast({ title: "Minimum usage amount updated" });
    setMinOpen(false);
    fetchAll();
  };

  const fetchTransactions = async (wallet: WalletRow) => {
    setHistWallet(wallet);
    setHistOpen(true);
    setHistLoading(true);
    let data: any[] = [];
    if (activeTab === "customer") {
      const res = await supabase.from("customer_wallet_transactions").select("*").eq("wallet_id", wallet.id).order("created_at", { ascending: false }).limit(50);
      data = res.data ?? [];
    } else if (activeTab === "seller") {
      const res = await supabase.from("seller_wallet_transactions").select("*").eq("wallet_id", wallet.id).order("created_at", { ascending: false }).limit(50);
      data = res.data ?? [];
    } else {
      const res = await supabase.from("delivery_staff_wallet_transactions").select("*").eq("wallet_id", wallet.id).order("created_at", { ascending: false }).limit(50);
      data = res.data ?? [];
    }
    setTransactions(data);
    setHistLoading(false);
  };

  const filterWallets = (wallets: WalletRow[]) => {
    if (!searchQuery.trim()) return wallets;
    const q = searchQuery.toLowerCase();
    return wallets.filter(
      (w) => w.user_name.toLowerCase().includes(q) || w.email.toLowerCase().includes(q)
    );
  };

  const renderWalletTable = (wallets: WalletRow[], type: string) => {
    const filtered = filterWallets(wallets);
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead className="hidden sm:table-cell">Email</TableHead>
            <TableHead className="text-right">Balance (₹)</TableHead>
            {type === "delivery" && <TableHead className="text-right hidden sm:table-cell">Earnings (₹)</TableHead>}
            {type === "customer" && <TableHead className="text-right hidden sm:table-cell">Min Usage (₹)</TableHead>}
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 && (
            <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No wallets found</TableCell></TableRow>
          )}
          {filtered.map((w) => (
            <TableRow key={w.id}>
              <TableCell className="font-medium">{w.user_name}</TableCell>
              <TableCell className="text-muted-foreground hidden sm:table-cell">{w.email}</TableCell>
              <TableCell className="text-right font-semibold">₹{Number(w.balance).toFixed(2)}</TableCell>
              {type === "delivery" && <TableCell className="text-right hidden sm:table-cell">₹{Number(w.earning_balance ?? 0).toFixed(2)}</TableCell>}
              {type === "customer" && <TableCell className="text-right hidden sm:table-cell">₹{Number(w.min_usage_amount ?? 0).toFixed(2)}</TableCell>}
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button size="icon" variant="outline" className="h-7 w-7" title="Credit" onClick={() => { setTxnWallet(w); setTxnType("credit"); setTxnOpen(true); }}>
                    <ArrowUpCircle className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="outline" className="h-7 w-7" title="Debit" onClick={() => { setTxnWallet(w); setTxnType("debit"); setTxnOpen(true); }}>
                    <ArrowDownCircle className="h-3.5 w-3.5" />
                  </Button>
                  {type === "customer" && (
                    <Button size="icon" variant="outline" className="h-7 w-7" title="Set Min Amount" onClick={() => { setMinWallet(w); setMinAmount(String(w.min_usage_amount ?? 100)); setMinOpen(true); }}>
                      <Settings className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" className="h-7 w-7" title="View Details" onClick={() => { setDetailWallet(w); setDetailOpen(true); }}>
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  const totalBalance = (wallets: WalletRow[]) => wallets.reduce((s, w) => s + Number(w.balance), 0);

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Wallet className="h-6 w-6" /> Wallet Management</h1>
            <p className="text-muted-foreground text-sm">Manage wallets, rules & rewards</p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Customer Wallets</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">₹{totalBalance(customerWallets).toFixed(2)}</p><p className="text-xs text-muted-foreground">{customerWallets.length} wallets</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Seller Wallets</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">₹{totalBalance(sellerWallets).toFixed(2)}</p><p className="text-xs text-muted-foreground">{sellerWallets.length} wallets</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Delivery Staff Wallets</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">₹{totalBalance(deliveryWallets).toFixed(2)}</p><p className="text-xs text-muted-foreground">{deliveryWallets.length} wallets</p></CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="rules">
              <Settings className="h-3.5 w-3.5 mr-1" /> Reward Rules
            </TabsTrigger>
            <TabsTrigger value="customer">Customers</TabsTrigger>
            <TabsTrigger value="seller">Sellers</TabsTrigger>
            <TabsTrigger value="delivery">Delivery Staff</TabsTrigger>
          </TabsList>

          {/* Wallet Reward Rules Tab */}
          <TabsContent value="rules">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Gift className="h-5 w-5" /> Wallet Reward Rules
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Configure automatic wallet rewards and usage rules. Enable/disable each rule and set the reward amount (₹).
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {walletRules.map((rule) => (
                  <div
                    key={rule.key}
                    className={`flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-lg border transition-colors ${
                      rule.enabled ? "border-primary/40 bg-primary/5" : "border-border bg-muted/30"
                    }`}
                  >
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="mt-0.5">{rule.icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{rule.label}</span>
                          <Badge variant={rule.enabled ? "default" : "secondary"} className="text-[10px]">
                            {rule.enabled ? "Active" : "Off"}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{rule.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 sm:gap-4 ml-8 sm:ml-0">
                      <div className="flex items-center gap-2">
                        <Label className="text-xs whitespace-nowrap">Amount (₹)</Label>
                        <Input
                          type="number"
                          min="0"
                          className="w-24 h-8 text-sm"
                          value={rule.amount}
                          onChange={(e) => updateRule(rule.key, "amount", e.target.value)}
                        />
                      </div>
                      <Switch
                        checked={rule.enabled}
                        onCheckedChange={(v) => updateRule(rule.key, "enabled", v)}
                      />
                    </div>
                  </div>
                ))}

                <div className="flex justify-end pt-2">
                  <Button onClick={saveWalletRules} disabled={rulesSaving}>
                    {rulesSaving ? "Saving..." : "Save All Rules"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="customer">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">Customer Wallets</CardTitle>
                    <p className="text-xs text-muted-foreground">Customers must reach the minimum usage amount before they can use wallet balance for orders.</p>
                  </div>
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search by name or email..." className="pl-8 h-9" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                  </div>
                </div>
              </CardHeader>
              <CardContent>{renderWalletTable(customerWallets, "customer")}</CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="seller">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <CardTitle className="text-base">Seller Wallets</CardTitle>
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search by name or email..." className="pl-8 h-9" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                  </div>
                </div>
              </CardHeader>
              <CardContent>{renderWalletTable(sellerWallets, "seller")}</CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="delivery">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <CardTitle className="text-base">Delivery Staff Wallets</CardTitle>
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search by name or email..." className="pl-8 h-9" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                  </div>
                </div>
              </CardHeader>
              <CardContent>{renderWalletTable(deliveryWallets, "delivery")}</CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Credit/Debit Dialog */}
      <Dialog open={txnOpen} onOpenChange={setTxnOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{txnType === "credit" ? "Credit" : "Debit"} Wallet — {txnWallet?.user_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Type</Label>
              <Select value={txnType} onValueChange={(v) => setTxnType(v as "credit" | "debit")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="credit">Credit</SelectItem>
                  <SelectItem value="debit">Debit</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Amount (₹)</Label><Input type="number" min="1" value={txnAmount} onChange={(e) => setTxnAmount(e.target.value)} placeholder="Enter amount" /></div>
            <div><Label>Description</Label><Textarea value={txnDesc} onChange={(e) => setTxnDesc(e.target.value)} placeholder="Reason for transaction" /></div>
            <p className="text-xs text-muted-foreground">Current balance: ₹{Number(txnWallet?.balance ?? 0).toFixed(2)}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTxnOpen(false)}>Cancel</Button>
            <Button onClick={handleTransaction} disabled={txnLoading}>{txnLoading ? "Processing..." : "Confirm"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Min Usage Dialog */}
      <Dialog open={minOpen} onOpenChange={setMinOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Set Minimum Usage Amount — {minWallet?.user_name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Customer must have at least this amount in their wallet before they can use it for purchases.</p>
            <div><Label>Minimum Amount (₹)</Label><Input type="number" min="0" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMinOpen(false)}>Cancel</Button>
            <Button onClick={handleMinAmountSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transaction History Dialog */}
      <Dialog open={histOpen} onOpenChange={setHistOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Transaction History — {histWallet?.user_name}</DialogTitle></DialogHeader>
          {histLoading ? <p className="text-center py-4">Loading...</p> : (
            <div className="max-h-80 overflow-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Description</TableHead></TableRow></TableHeader>
                <TableBody>
                  {transactions.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No transactions</TableCell></TableRow>}
                  {transactions.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="text-xs">{new Date(t.created_at).toLocaleDateString()}</TableCell>
                      <TableCell><Badge variant={t.type === "credit" ? "default" : "destructive"} className="text-xs">{t.type}</Badge></TableCell>
                      <TableCell className="text-right font-medium">₹{Number(t.amount).toFixed(2)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">{t.description}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Wallet Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Wallet Details — {detailWallet?.user_name}</DialogTitle></DialogHeader>
          {detailWallet && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Name</span><p className="font-medium">{detailWallet.user_name}</p></div>
                <div><span className="text-muted-foreground">Email</span><p className="font-medium break-all">{detailWallet.email || "N/A"}</p></div>
                <div><span className="text-muted-foreground">Balance</span><p className="font-semibold text-lg">₹{Number(detailWallet.balance).toFixed(2)}</p></div>
                {detailWallet.earning_balance !== undefined && (
                  <div><span className="text-muted-foreground">Earnings</span><p className="font-semibold">₹{Number(detailWallet.earning_balance).toFixed(2)}</p></div>
                )}
                {detailWallet.min_usage_amount !== undefined && (
                  <div><span className="text-muted-foreground">Min Usage</span><p className="font-medium">₹{Number(detailWallet.min_usage_amount).toFixed(2)}</p></div>
                )}
                <div><span className="text-muted-foreground">Created</span><p className="font-medium">{new Date(detailWallet.created_at).toLocaleDateString()}</p></div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => { setDetailOpen(false); setTxnWallet(detailWallet); setTxnType("credit"); setTxnOpen(true); }}>
                  <ArrowUpCircle className="h-3.5 w-3.5 mr-1" /> Credit
                </Button>
                <Button size="sm" variant="outline" className="flex-1" onClick={() => { setDetailOpen(false); setTxnWallet(detailWallet); setTxnType("debit"); setTxnOpen(true); }}>
                  <ArrowDownCircle className="h-3.5 w-3.5 mr-1" /> Debit
                </Button>
                <Button size="sm" variant="outline" className="flex-1" onClick={() => { setDetailOpen(false); fetchTransactions(detailWallet); }}>
                  History
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default WalletManagementPage;
