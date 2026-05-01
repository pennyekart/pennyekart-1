import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Trash2, Shield, Users, Clock, Edit2, Check, X, LayoutDashboard, ShoppingCart, Package, MapPin, Warehouse, Tags, Zap, Wallet, Settings, HardDrive, Truck, FileText, Crown, Image } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Role { id: string; name: string; description: string | null; created_at: string; updated_at: string; }
interface Permission { id: string; name: string; description: string | null; feature: string; action: string; }
interface RolePermission { role_id: string; permission_id: string; }

const featureIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  users: Users,
  products: Package,
  orders: ShoppingCart,
  categories: Tags,
  banners: Image,
  locations: MapPin,
  godowns: Warehouse,
  stock: Package,
  purchase: FileText,
  offers: Zap,
  penny_prime: Crown,
  wallets: Wallet,
  settings: Settings,
  storage: HardDrive,
  delivery: Truck,
  delivery_staff: Truck,
  selling_partners: Users,
  sellers: Users,
  services: Settings,
  reports: FileText,
};

const featureOrder = [
  'dashboard', 'users', 'products', 'categories', 'orders', 'banners',
  'locations', 'godowns', 'stock', 'purchase', 'offers', 'penny_prime',
  'wallets', 'delivery', 'delivery_staff', 'selling_partners', 'sellers',
  'services', 'reports', 'settings', 'storage'
];

const RolesPage = () => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [rolePerms, setRolePerms] = useState<RolePermission[]>([]);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDesc, setNewRoleDesc] = useState("");
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [editingDesc, setEditingDesc] = useState<string | null>(null);
  const [editDescValue, setEditDescValue] = useState("");
  const { toast } = useToast();

  const fetchData = async () => {
    const [r, p, rp] = await Promise.all([
      supabase.from("roles").select("*").order("name"),
      supabase.from("permissions").select("*").order("feature,action"),
      supabase.from("role_permissions").select("role_id, permission_id"),
    ]);
    setRoles((r.data as Role[]) ?? []);
    setPermissions((p.data as Permission[]) ?? []);
    setRolePerms((rp.data as RolePermission[]) ?? []);
  };

  useEffect(() => { fetchData(); }, []);

  const addRole = async () => {
    if (!newRoleName.trim()) return;
    const { error } = await supabase.from("roles").insert({ 
      name: newRoleName.trim().toLowerCase(),
      description: newRoleDesc.trim() || null
    });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { setNewRoleName(""); setNewRoleDesc(""); fetchData(); }
  };

  const deleteRole = async (id: string) => {
    const { error } = await supabase.from("roles").delete().eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { if (selectedRole === id) setSelectedRole(null); fetchData(); }
  };

  const updateDescription = async (id: string) => {
    const { error } = await supabase.from("roles").update({ description: editDescValue.trim() || null }).eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { setEditingDesc(null); fetchData(); }
  };

  const togglePermission = async (roleId: string, permId: string, has: boolean) => {
    if (has) {
      await supabase.from("role_permissions").delete().eq("role_id", roleId).eq("permission_id", permId);
    } else {
      await supabase.from("role_permissions").insert({ role_id: roleId, permission_id: permId });
    }
    fetchData();
  };

  const toggleAllFeaturePerms = async (roleId: string, featurePerms: Permission[], allGranted: boolean) => {
    if (allGranted) {
      // Remove all
      for (const p of featurePerms) {
        await supabase.from("role_permissions").delete().eq("role_id", roleId).eq("permission_id", p.id);
      }
    } else {
      // Add missing
      for (const p of featurePerms) {
        if (!hasPermission(roleId, p.id)) {
          await supabase.from("role_permissions").insert({ role_id: roleId, permission_id: p.id });
        }
      }
    }
    fetchData();
  };

  const hasPermission = (roleId: string, permId: string) =>
    rolePerms.some((rp) => rp.role_id === roleId && rp.permission_id === permId);

  const getPermCount = (roleId: string) => rolePerms.filter((rp) => rp.role_id === roleId).length;

  const features = [...new Set(permissions.map((p) => p.feature))].sort((a, b) => {
    const aIdx = featureOrder.indexOf(a);
    const bIdx = featureOrder.indexOf(b);
    if (aIdx === -1 && bIdx === -1) return a.localeCompare(b);
    if (aIdx === -1) return 1;
    if (bIdx === -1) return -1;
    return aIdx - bIdx;
  });
  
  const selectedRoleData = roles.find((r) => r.id === selectedRole);

  const formatFeatureName = (feat: string) => feat.replace(/_/g, ' ');

  return (
    <AdminLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Roles & Permissions</h1>
          <p className="text-sm text-muted-foreground">Manage user roles and their access permissions</p>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Shield className="h-4 w-4" />
            <span>{roles.length} Roles</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            <span>{permissions.length} Permissions</span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Roles list */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Roles</CardTitle>
            <CardDescription>Create and manage user roles</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Add new role form */}
            <div className="space-y-2 rounded-lg border border-dashed p-3">
              <Input 
                placeholder="Role name" 
                value={newRoleName} 
                onChange={(e) => setNewRoleName(e.target.value)} 
              />
              <Input 
                placeholder="Description (optional)" 
                value={newRoleDesc} 
                onChange={(e) => setNewRoleDesc(e.target.value)} 
              />
              <Button size="sm" className="w-full" onClick={addRole} disabled={!newRoleName.trim()}>
                <Plus className="mr-1.5 h-4 w-4" /> Add Role
              </Button>
            </div>

            {/* Roles list */}
            <ScrollArea className="h-[400px]">
              <div className="space-y-2 pr-3">
                {roles.map((r) => (
                  <div
                    key={r.id}
                    className={`group cursor-pointer rounded-lg border p-3 transition-all ${
                      selectedRole === r.id 
                        ? "border-primary bg-primary/5 ring-1 ring-primary" 
                        : "hover:border-muted-foreground/30 hover:bg-muted/50"
                    }`}
                    onClick={() => setSelectedRole(r.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium capitalize">{r.name}</span>
                          <Badge variant="secondary" className="text-xs">
                            {getPermCount(r.id)} perms
                          </Badge>
                        </div>
                        {editingDesc === r.id ? (
                          <div className="mt-1.5 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <Input
                              value={editDescValue}
                              onChange={(e) => setEditDescValue(e.target.value)}
                              className="h-7 text-xs"
                              placeholder="Add description..."
                            />
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => updateDescription(r.id)}>
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingDesc(null)}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <p 
                            className="mt-0.5 text-xs text-muted-foreground line-clamp-1 group-hover:cursor-text"
                            onClick={(e) => { e.stopPropagation(); setEditingDesc(r.id); setEditDescValue(r.description || ""); }}
                          >
                            {r.description || <span className="italic opacity-50">No description</span>}
                            <Edit2 className="ml-1 inline h-3 w-3 opacity-0 group-hover:opacity-50" />
                          </p>
                        )}
                        <div className="mt-1.5 flex items-center gap-1 text-[10px] text-muted-foreground/70">
                          <Clock className="h-3 w-3" />
                          Updated {formatDistanceToNow(new Date(r.updated_at), { addSuffix: true })}
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); deleteRole(r.id); }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
                {roles.length === 0 && (
                  <p className="py-8 text-center text-sm text-muted-foreground">No roles created yet</p>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Permissions matrix */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">
              {selectedRoleData ? (
                <span className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  <span className="capitalize">{selectedRoleData.name}</span>
                  <span className="text-muted-foreground font-normal">permissions</span>
                </span>
              ) : (
                "Permission Matrix"
              )}
            </CardTitle>
            <CardDescription>
              {selectedRoleData 
                ? selectedRoleData.description || "Configure which features this role can access"
                : "Select a role to configure its permissions"
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedRole ? (
              <ScrollArea className="h-[500px] pr-4">
                <div className="space-y-4">
                  {features.map((feat) => {
                    const featurePerms = permissions.filter((p) => p.feature === feat);
                    const grantedCount = featurePerms.filter((p) => hasPermission(selectedRole, p.id)).length;
                    const allGranted = grantedCount === featurePerms.length;
                    const Icon = featureIcons[feat] || Shield;
                    
                    return (
                      <div key={feat} className="rounded-lg border p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                            <h3 className="text-sm font-semibold capitalize">{formatFeatureName(feat)}</h3>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={allGranted ? "default" : grantedCount > 0 ? "secondary" : "outline"}>
                              {grantedCount}/{featurePerms.length}
                            </Badge>
                            <Button
                              size="sm"
                              variant={allGranted ? "outline" : "default"}
                              className="h-7 text-xs"
                              onClick={() => toggleAllFeaturePerms(selectedRole, featurePerms, allGranted)}
                            >
                              {allGranted ? "Revoke All" : "Grant All"}
                            </Button>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          {featurePerms.map((p) => {
                            const has = hasPermission(selectedRole, p.id);
                            return (
                              <label 
                                key={p.id} 
                                className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                                  has ? "border-primary/50 bg-primary/5" : "hover:bg-muted/50"
                                }`}
                                title={p.description || undefined}
                              >
                                <Checkbox 
                                  checked={has} 
                                  onCheckedChange={() => togglePermission(selectedRole, p.id, has)} 
                                />
                                <span className="capitalize">{p.action}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Shield className="mb-3 h-12 w-12 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">Click a role to manage its permissions</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default RolesPage;
