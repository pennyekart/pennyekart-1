import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";

interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  mobile_number: string | null;
  role_id: string | null;
  is_super_admin: boolean;
  is_approved: boolean;
  user_type: string;
  local_body_id: string | null;
  ward_number: number | null;
}

interface Role {
  id: string;
  name: string;
}

const USER_TYPE_LABELS: Record<string, string> = {
  all: "All Users",
  customer: "Customers",
  delivery_staff: "Delivery Staff",
  selling_partner: "Selling Partners",
};

const UsersPage = () => {
  const [users, setUsers] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [filterType, setFilterType] = useState("all");
  const { isSuperAdmin } = usePermissions();
  const { toast } = useToast();

  const fetchData = async () => {
    const [usersRes, rolesRes] = await Promise.all([
      supabase.from("profiles").select("*"),
      supabase.from("roles").select("*"),
    ]);
    setUsers((usersRes.data as unknown as Profile[]) ?? []);
    setRoles((rolesRes.data as Role[]) ?? []);
  };

  useEffect(() => { fetchData(); }, []);

  const filteredUsers = filterType === "all" ? users : users.filter(u => u.user_type === filterType);

  const updateRole = async (userId: string, roleId: string) => {
    const { error } = await supabase.from("profiles").update({ role_id: roleId === "none" ? null : roleId }).eq("user_id", userId);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Role updated" }); fetchData(); }
  };

  const toggleSuperAdmin = async (userId: string, current: boolean) => {
    const { error } = await supabase.from("profiles").update({ is_super_admin: !current }).eq("user_id", userId);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Super admin toggled" }); fetchData(); }
  };

  const toggleApproval = async (userId: string, current: boolean) => {
    const { error } = await supabase.from("profiles").update({ is_approved: !current }).eq("user_id", userId);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: !current ? "User approved" : "User unapproved" }); fetchData(); }
  };

  const getTypeBadgeVariant = (type: string) => {
    switch (type) {
      case "delivery_staff": return "default";
      case "selling_partner": return "secondary";
      default: return "outline";
    }
  };

  return (
    <AdminLayout>
      <h1 className="mb-4 text-2xl font-bold">Users Management</h1>

      <Tabs value={filterType} onValueChange={setFilterType} className="mb-4">
        <TabsList>
          {Object.entries(USER_TYPE_LABELS).map(([key, label]) => (
            <TabsTrigger key={key} value={key}>
              {label}
              <Badge variant="outline" className="ml-2 text-xs">
                {key === "all" ? users.length : users.filter(u => u.user_type === key).length}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email / Mobile</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Approved</TableHead>
              <TableHead>Role</TableHead>
              {isSuperAdmin && <TableHead>Super Admin</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.map((u) => (
              <TableRow key={u.id}>
                <TableCell>{u.full_name ?? "—"}</TableCell>
                <TableCell>
                  <div>{u.email ?? "—"}</div>
                  {u.mobile_number && <div className="text-xs text-muted-foreground">{u.mobile_number}</div>}
                </TableCell>
                <TableCell>
                  <Badge variant={getTypeBadgeVariant(u.user_type)}>
                    {USER_TYPE_LABELS[u.user_type] ?? u.user_type}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Switch checked={u.is_approved} onCheckedChange={() => toggleApproval(u.user_id, u.is_approved)} />
                </TableCell>
                <TableCell>
                  {isSuperAdmin ? (
                    <Select value={u.role_id ?? "none"} onValueChange={(v) => updateRole(u.user_id, v)}>
                      <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No role</SelectItem>
                        {roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant="secondary">{roles.find((r) => r.id === u.role_id)?.name ?? "No role"}</Badge>
                  )}
                </TableCell>
                {isSuperAdmin && (
                  <TableCell>
                    <Switch checked={u.is_super_admin} onCheckedChange={() => toggleSuperAdmin(u.user_id, u.is_super_admin)} />
                  </TableCell>
                )}
              </TableRow>
            ))}
            {filteredUsers.length === 0 && (
              <TableRow>
                <TableCell colSpan={isSuperAdmin ? 6 : 5} className="text-center text-muted-foreground py-8">
                  No users found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </AdminLayout>
  );
};

export default UsersPage;
