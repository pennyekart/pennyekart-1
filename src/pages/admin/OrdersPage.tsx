import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { Truck, Clock, PackageCheck, XCircle, Package, RotateCcw, Eye, Store, Search, AlertCircle } from "lucide-react";
import OrderDetailDialog from "@/components/OrderDetailDialog";

interface Order {
  id: string;
  user_id: string | null;
  seller_id: string | null;
  status: string;
  total: number;
  shipping_address: string | null;
  created_at: string;
  is_self_delivery: boolean;
  items: any;
}

interface ProfileLite {
  user_id: string;
  full_name: string | null;
  mobile_number: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  seller_confirmation_pending: "Awaiting Seller",
  confirmed: "Confirmed",
  seller_accepted: "Seller Accepted",
  accepted: "Accepted",
  processing: "Processing",
  packed: "Packed",
  seller_packed: "Seller Packed",
  pickup: "Ready for Pickup",
  shipped: "Shipped",
  seller_shipped: "Seller Shipped",
  self_delivery_pickup: "Self Delivery Pickup",
  self_delivery_shipped: "Self Delivery Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  return_requested: "Return Requested",
  return_confirmed: "Return Confirmed",
};

const statusLabel = (s: string) => STATUS_LABELS[s] ?? s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

const PENDING = ["pending", "seller_confirmation_pending"];
const PROCESSING = ["confirmed", "processing", "accepted", "packed", "seller_packed", "pickup", "shipped", "seller_accepted", "seller_shipped", "self_delivery_pickup", "self_delivery_shipped"];
const DELIVERED = ["delivered"];
const RETURNS = ["return_requested", "return_confirmed"];
const CANCELLED = ["cancelled"];
const KNOWN = new Set([...PENDING, ...PROCESSING, ...DELIVERED, ...RETURNS, ...CANCELLED]);

const statuses = [...PENDING, ...PROCESSING, ...DELIVERED, ...RETURNS, ...CANCELLED];

const statusColor = (s: string): "default" | "destructive" | "secondary" | "outline" => {
  if (s === "delivered") return "default";
  if (s === "cancelled") return "destructive";
  if (RETURNS.includes(s)) return "destructive";
  if (PENDING.includes(s)) return "secondary";
  return "outline";
};

const isSellerOrder = (o: Order) => {
  if (o.seller_id) return true;
  const items = Array.isArray(o.items) ? o.items : [];
  return items.some((it: any) => it?.source === "seller_product" || it?.seller_id);
};

const OrdersPage = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"all" | "seller" | "direct">("all");
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const { hasPermission } = usePermissions();
  const { toast } = useToast();

  const fetchOrders = async () => {
    const { data } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
    const list = (data as Order[]) ?? [];
    setOrders(list);

    const ids = Array.from(new Set([
      ...list.map(o => o.user_id).filter(Boolean) as string[],
      ...list.map(o => o.seller_id).filter(Boolean) as string[],
    ]));
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("user_id, full_name, mobile_number").in("user_id", ids);
      const map: Record<string, ProfileLite> = {};
      (profs ?? []).forEach((p: any) => { map[p.user_id] = p; });
      setProfiles(map);
    }
  };

  useEffect(() => { fetchOrders(); }, []);

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("orders").update({ status }).eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else fetchOrders();
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter(o => {
      if (sourceFilter === "seller" && !isSellerOrder(o)) return false;
      if (sourceFilter === "direct" && isSellerOrder(o)) return false;
      if (!q) return true;
      const cust = o.user_id ? profiles[o.user_id] : undefined;
      return (
        o.id.toLowerCase().includes(q) ||
        (cust?.full_name ?? "").toLowerCase().includes(q) ||
        (cust?.mobile_number ?? "").toLowerCase().includes(q)
      );
    });
  }, [orders, profiles, search, sourceFilter]);

  const buckets = useMemo(() => ({
    pending: filtered.filter(o => PENDING.includes(o.status)),
    processing: filtered.filter(o => PROCESSING.includes(o.status)),
    delivered: filtered.filter(o => DELIVERED.includes(o.status)),
    returns: filtered.filter(o => RETURNS.includes(o.status)),
    cancelled: filtered.filter(o => CANCELLED.includes(o.status)),
    other: filtered.filter(o => !KNOWN.has(o.status)),
  }), [filtered]);

  const openDetail = (o: Order) => { setDetailOrder(o); setDetailOpen(true); };

  const OrderTable = ({ items }: { items: Order[] }) => (
    <div className="admin-table-wrap">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Order</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Seller</TableHead>
            <TableHead>Items</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Date</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((o) => {
            const cust = o.user_id ? profiles[o.user_id] : undefined;
            const seller = o.seller_id ? profiles[o.seller_id] : undefined;
            const sellerOrder = isSellerOrder(o);
            const itemCount = Array.isArray(o.items) ? o.items.length : 0;
            return (
              <TableRow key={o.id}>
                <TableCell className="font-mono text-xs">{o.id.slice(0, 8)}…</TableCell>
                <TableCell className="text-xs">
                  <div className="font-medium">{cust?.full_name ?? "—"}</div>
                  <div className="text-muted-foreground">{cust?.mobile_number ?? ""}</div>
                </TableCell>
                <TableCell className="text-xs">
                  {sellerOrder ? (
                    <div className="flex flex-col gap-1">
                      <div className="font-medium">{seller?.full_name ?? "Seller"}</div>
                      <Badge variant="secondary" className="text-xs w-fit"><Store className="h-3 w-3 mr-1" />Seller</Badge>
                    </div>
                  ) : (
                    <Badge variant="outline" className="text-xs">Direct</Badge>
                  )}
                </TableCell>
                <TableCell className="text-xs">{itemCount}</TableCell>
                <TableCell>₹{o.total}</TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    {hasPermission("update_orders") ? (
                      <Select value={o.status} onValueChange={(v) => updateStatus(o.id, v)}>
                        <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {statuses.map((s) => <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>)}
                          {!statuses.includes(o.status) && <SelectItem value={o.status}>{statusLabel(o.status)}</SelectItem>}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant={statusColor(o.status)}>{statusLabel(o.status)}</Badge>
                    )}
                    {o.is_self_delivery && <Badge variant="outline" className="text-xs w-fit"><Truck className="h-3 w-3 mr-1" />Self Delivery</Badge>}
                  </div>
                </TableCell>
                <TableCell className="text-xs">{new Date(o.created_at).toLocaleDateString()}</TableCell>
                <TableCell>
                  <Button size="sm" variant="ghost" onClick={() => openDetail(o)}><Eye className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            );
          })}
          {items.length === 0 && (
            <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">No orders</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <AdminLayout>
      <h1 className="mb-6 text-2xl font-bold">Orders</h1>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search ID / customer / mobile" className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={sourceFilter} onValueChange={(v: any) => setSourceFilter(v)}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All orders</SelectItem>
            <SelectItem value="seller">Seller orders</SelectItem>
            <SelectItem value="direct">Direct orders</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="pending" className="gap-2">
            <Clock className="h-4 w-4" /> Pending
            {buckets.pending.length > 0 && <Badge variant="secondary" className="ml-1">{buckets.pending.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="processing" className="gap-2">
            <Package className="h-4 w-4" /> Processing
            {buckets.processing.length > 0 && <Badge variant="outline" className="ml-1">{buckets.processing.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="delivered" className="gap-2">
            <PackageCheck className="h-4 w-4" /> Delivered
            {buckets.delivered.length > 0 && <Badge variant="outline" className="ml-1">{buckets.delivered.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="returns" className="gap-2">
            <RotateCcw className="h-4 w-4" /> Returns
            {buckets.returns.length > 0 && <Badge variant="destructive" className="ml-1">{buckets.returns.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="cancelled" className="gap-2">
            <XCircle className="h-4 w-4" /> Cancelled
            {buckets.cancelled.length > 0 && <Badge variant="destructive" className="ml-1">{buckets.cancelled.length}</Badge>}
          </TabsTrigger>
          {buckets.other.length > 0 && (
            <TabsTrigger value="other" className="gap-2">
              <AlertCircle className="h-4 w-4" /> Other
              <Badge variant="secondary" className="ml-1">{buckets.other.length}</Badge>
            </TabsTrigger>
          )}
        </TabsList>
        <TabsContent value="pending"><OrderTable items={buckets.pending} /></TabsContent>
        <TabsContent value="processing"><OrderTable items={buckets.processing} /></TabsContent>
        <TabsContent value="delivered"><OrderTable items={buckets.delivered} /></TabsContent>
        <TabsContent value="returns"><OrderTable items={buckets.returns} /></TabsContent>
        <TabsContent value="cancelled"><OrderTable items={buckets.cancelled} /></TabsContent>
        {buckets.other.length > 0 && <TabsContent value="other"><OrderTable items={buckets.other} /></TabsContent>}
      </Tabs>

      <OrderDetailDialog
        order={detailOrder}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        statusLabel={statusLabel}
      />
    </AdminLayout>
  );
};

export default OrdersPage;
