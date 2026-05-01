import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { Truck, Clock, PackageCheck, XCircle, Package } from "lucide-react";

interface Order {
  id: string; user_id: string | null; status: string; total: number;
  shipping_address: string | null; created_at: string; is_self_delivery: boolean;
}

const statuses = ["pending", "confirmed", "processing", "shipped", "self_delivery_pickup", "self_delivery_shipped", "delivered", "cancelled"];

const OrdersPage = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const { hasPermission } = usePermissions();
  const { toast } = useToast();

  const fetchOrders = async () => {
    const { data } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
    setOrders((data as Order[]) ?? []);
  };

  useEffect(() => { fetchOrders(); }, []);

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("orders").update({ status }).eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else fetchOrders();
  };

  const statusColor = (s: string) => {
    switch (s) {
      case "delivered": return "default";
      case "cancelled": return "destructive";
      case "pending": return "secondary";
      default: return "outline";
    }
  };

  const pendingOrders = orders.filter(o => o.status === "pending");
  const processingOrders = orders.filter(o => ["confirmed", "processing", "shipped", "self_delivery_pickup", "self_delivery_shipped"].includes(o.status));
  const deliveredOrders = orders.filter(o => o.status === "delivered");
  const cancelledOrders = orders.filter(o => o.status === "cancelled");

  const OrderTable = ({ items }: { items: Order[] }) => (
    <div className="admin-table-wrap">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Order ID</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((o) => (
            <TableRow key={o.id}>
              <TableCell className="font-mono text-xs">{o.id.slice(0, 8)}…</TableCell>
              <TableCell>₹{o.total}</TableCell>
              <TableCell>
                <div className="flex flex-col gap-1">
                  {hasPermission("update_orders") ? (
                    <Select value={o.status} onValueChange={(v) => updateStatus(o.id, v)}>
                      <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {statuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant={statusColor(o.status) as any}>{o.status}</Badge>
                  )}
                  {o.is_self_delivery && <Badge variant="outline" className="text-xs w-fit"><Truck className="h-3 w-3 mr-1" />Self Delivery</Badge>}
                </div>
              </TableCell>
              <TableCell className="text-xs">{new Date(o.created_at).toLocaleDateString()}</TableCell>
            </TableRow>
          ))}
          {items.length === 0 && (
            <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No orders</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <AdminLayout>
      <h1 className="mb-6 text-2xl font-bold">Orders</h1>
      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="pending" className="gap-2">
            <Clock className="h-4 w-4" /> Pending
            {pendingOrders.length > 0 && <Badge variant="secondary" className="ml-1">{pendingOrders.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="processing" className="gap-2">
            <Package className="h-4 w-4" /> Processing
            {processingOrders.length > 0 && <Badge variant="outline" className="ml-1">{processingOrders.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="delivered" className="gap-2">
            <PackageCheck className="h-4 w-4" /> Delivered
            {deliveredOrders.length > 0 && <Badge variant="outline" className="ml-1">{deliveredOrders.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="cancelled" className="gap-2">
            <XCircle className="h-4 w-4" /> Cancelled
            {cancelledOrders.length > 0 && <Badge variant="destructive" className="ml-1">{cancelledOrders.length}</Badge>}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="pending"><OrderTable items={pendingOrders} /></TabsContent>
        <TabsContent value="processing"><OrderTable items={processingOrders} /></TabsContent>
        <TabsContent value="delivered"><OrderTable items={deliveredOrders} /></TabsContent>
        <TabsContent value="cancelled"><OrderTable items={cancelledOrders} /></TabsContent>
      </Tabs>
    </AdminLayout>
  );
};

export default OrdersPage;
