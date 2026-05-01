import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, BarChart3, Loader2, Download, MessageCircle, ChevronDown } from "lucide-react";
import ImageUpload from "@/components/admin/ImageUpload";
import { useAuth } from "@/hooks/useAuth";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";

interface Notification {
  id: string;
  title: string;
  message: string;
  image_url: string | null;
  link_url: string | null;
  link_label: string | null;
  target_audience: string;
  target_local_body_ids: string[];
  is_active: boolean;
  auto_dismiss_seconds: number;
  created_at: string;
}

interface LocalBody {
  id: string;
  name: string;
  body_type: string;
}

const PROJECT_ID = "xxlocaexuoowxdzupjcs";

const NotificationsPage = () => {
  const { session } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [localBodies, setLocalBodies] = useState<LocalBody[]>([]);
  const [editing, setEditing] = useState<Partial<Notification> | null>(null);
  const [analyticsFor, setAnalyticsFor] = useState<Notification | null>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [filterPanchayath, setFilterPanchayath] = useState("all");
  const [filterWard, setFilterWard] = useState("all");

  const fetchData = async () => {
    const [{ data: notifs }, { data: lbs }] = await Promise.all([
      supabase.from("notifications").select("*").order("created_at", { ascending: false }),
      supabase.from("locations_local_bodies").select("id, name, body_type").eq("is_active", true).order("name"),
    ]);
    setNotifications((notifs ?? []) as Notification[]);
    setLocalBodies(lbs ?? []);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSave = async () => {
    if (!editing?.title || !editing?.message) {
      toast({ title: "Title and message required", variant: "destructive" });
      return;
    }
    const payload = {
      title: editing.title,
      message: editing.message,
      image_url: editing.image_url || null,
      link_url: editing.link_url || null,
      link_label: editing.link_label || null,
      target_audience: editing.target_audience || "all",
      target_local_body_ids: editing.target_local_body_ids || [],
      is_active: editing.is_active ?? true,
      auto_dismiss_seconds: Math.max(0, Number(editing.auto_dismiss_seconds) || 0),
    };
    const { error } = editing.id
      ? await supabase.from("notifications").update(payload).eq("id", editing.id)
      : await supabase.from("notifications").insert(payload);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Notification saved" });
    setEditing(null);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this notification?")) return;
    const { error } = await supabase.from("notifications").delete().eq("id", id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Deleted" });
    fetchData();
  };

  const openAnalytics = async (n: Notification) => {
    setAnalyticsFor(n);
    setAnalytics(null);
    setAnalyticsLoading(true);
    setFilterPanchayath("all");
    setFilterWard("all");
    try {
      const res = await fetch(
        `https://${PROJECT_ID}.supabase.co/functions/v1/notifications-resolve?action=analytics&notification_id=${n.id}`,
        { headers: { Authorization: `Bearer ${session?.access_token}` } }
      );
      const data = await res.json();
      setAnalytics(data);
    } catch (e) {
      toast({ title: "Failed to load analytics", variant: "destructive" });
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const targetSummary = (n: Notification) => {
    if (n.target_audience === "all") return "All Users";
    if (n.target_audience === "agents") return "e-Life Agents";
    if (n.target_audience === "panchayath") {
      const names = n.target_local_body_ids
        .map((id) => localBodies.find((lb) => lb.id === id)?.name)
        .filter(Boolean)
        .slice(0, 2);
      return `Panchayath: ${names.join(", ")}${n.target_local_body_ids.length > 2 ? "..." : ""}`;
    }
    return n.target_audience;
  };

  const toggleLocalBody = (id: string) => {
    const cur = editing?.target_local_body_ids || [];
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    setEditing({ ...editing, target_local_body_ids: next });
  };

  // Deduplicate users by user_id (keep the most recent record by read/clicked/delivered)
  const dedupedUsers = (() => {
    const map = new Map<string, any>();
    for (const u of (analytics?.users ?? [])) {
      const key = u.user_id || `${u.mobile_number || ""}-${u.full_name || ""}`;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, u);
      } else {
        // Merge: prefer non-null timestamps (latest activity)
        map.set(key, {
          ...existing,
          ...u,
          delivered_at: u.delivered_at || existing.delivered_at,
          read_at: u.read_at || existing.read_at,
          clicked_at: u.clicked_at || existing.clicked_at,
        });
      }
    }
    return Array.from(map.values());
  })();

  const filteredUsers = dedupedUsers.filter((u: any) => {
    if (filterPanchayath !== "all" && u.local_body_name !== filterPanchayath) return false;
    if (filterWard !== "all" && String(u.ward_number) !== filterWard) return false;
    return true;
  });

  const uniquePanchayaths = Array.from(new Set((analytics?.users ?? []).map((u: any) => u.local_body_name).filter(Boolean))).sort() as string[];
  const uniqueWards = Array.from(new Set(filteredUsers.map((u: any) => u.ward_number).filter((w: any) => w != null))).sort((a: any, b: any) => a - b);

  // Group rows by same panchayath+ward, then apply filters and sort by panchayath then ward
  const filteredGroups = (analytics?.byPanchayath ?? [])
    .filter((g: any) => {
      if (filterPanchayath !== "all" && g.local_body_name !== filterPanchayath) return false;
      if (filterWard !== "all" && String(g.ward_number) !== filterWard) return false;
      return true;
    })
    .sort((a: any, b: any) => {
      const p = String(a.local_body_name || "").localeCompare(String(b.local_body_name || ""));
      if (p !== 0) return p;
      return (Number(a.ward_number) || 0) - (Number(b.ward_number) || 0);
    });

  // Subtotals per panchayath for visual grouping
  const groupedByPanchayath: Record<string, any[]> = filteredGroups.reduce((acc: Record<string, any[]>, g: any) => {
    const key = g.local_body_name || "Unknown";
    (acc[key] = acc[key] || []).push(g);
    return acc;
  }, {} as Record<string, any[]>);

  const downloadCSV = (filename: string, rows: (string | number | null | undefined)[][]) => {
    const escape = (v: any) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = rows.map((r) => r.map(escape).join(",")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportGroupsCSV = () => {
    const safeTitle = (analyticsFor?.title || "notification").replace(/[^a-z0-9]+/gi, "_");
    const rows: any[][] = [["Panchayath", "Ward", "Delivered", "Read", "Clicked"]];
    Object.entries(groupedByPanchayath).forEach(([panchayath, groups]) => {
      let pd = 0, pr = 0, pc = 0;
      (groups as any[]).forEach((g: any) => {
        rows.push([g.local_body_name, g.ward_number ?? "", g.delivered, g.read, g.clicked]);
        pd += g.delivered; pr += g.read; pc += g.clicked;
      });
      rows.push([`${panchayath} — Subtotal`, "", pd, pr, pc]);
    });
    downloadCSV(`${safeTitle}_by_panchayath_ward.csv`, rows);
  };

  const exportUsersCSV = (users?: any[], suffix = "users") => {
    const safeTitle = (analyticsFor?.title || "notification").replace(/[^a-z0-9]+/gi, "_");
    const list = users ?? filteredUsers;
    const rows: any[][] = [["Name", "Mobile", "Role", "Panchayath", "Ward", "Delivered", "Read", "Clicked"]];
    list.forEach((u: any) => {
      rows.push([
        u.full_name || "",
        u.mobile_number || "",
        u.role_name || "",
        u.local_body_name || "",
        u.ward_number ?? "",
        u.delivered_at || "",
        u.read_at || "",
        u.clicked_at || "",
      ]);
    });
    downloadCSV(`${safeTitle}_${suffix}.csv`, rows);
  };

  // Group users by panchayath for the drilldown
  const groupedUsersByPanchayath: Record<string, any[]> = filteredUsers.reduce((acc: Record<string, any[]>, u: any) => {
    const key = u.local_body_name || "Unknown";
    (acc[key] = acc[key] || []).push(u);
    return acc;
  }, {} as Record<string, any[]>);

  const shareUsersToWhatsApp = (panchayath: string, users: any[]) => {
    const d = users.filter((u) => u.delivered_at).length;
    const r = users.filter((u) => u.read_at).length;
    const c = users.filter((u) => u.clicked_at).length;
    const lines = [
      `*${analyticsFor?.title || "Notification"}*`,
      `📍 *${panchayath}* — Per-User`,
      ``,
      `Users: ${users.length}  |  Delivered: ${d}  |  Read: ${r}  |  Clicked: ${c}`,
      ``,
      `*Users:*`,
      ...[...users]
        .sort((a, b) => (Number(a.ward_number) || 0) - (Number(b.ward_number) || 0))
        .map(
          (u) =>
            `• ${u.full_name || "-"} (${u.mobile_number || "-"}) W${u.ward_number ?? "-"} — ${u.read_at ? "✅Read" : u.delivered_at ? "📨Delivered" : "—"}${u.clicked_at ? " 🔗" : ""}`
        ),
    ];
    const text = encodeURIComponent(lines.join("\n"));
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  const shareToWhatsApp = (panchayath: string, groups: any[]) => {
    const sub = groups.reduce(
      (a, g: any) => ({ d: a.d + g.delivered, r: a.r + g.read, c: a.c + g.clicked }),
      { d: 0, r: 0, c: 0 }
    );
    const lines = [
      `*${analyticsFor?.title || "Notification"}*`,
      `📍 *${panchayath}*`,
      ``,
      `Delivered: ${sub.d}  |  Read: ${sub.r}  |  Clicked: ${sub.c}`,
      ``,
      `*Ward breakdown:*`,
      ...[...groups]
        .sort((a: any, b: any) => (Number(a.ward_number) || 0) - (Number(b.ward_number) || 0))
        .map((g: any) => `• Ward ${g.ward_number ?? "-"}: ${g.delivered} delivered, ${g.read} read, ${g.clicked} clicked`),
    ];
    const text = encodeURIComponent(lines.join("\n"));
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Notifications</h1>
            <p className="text-sm text-muted-foreground">Send announcements to customers, agents, or specific panchayaths</p>
          </div>
          <Button onClick={() => setEditing({ target_audience: "all", is_active: true, target_local_body_ids: [] })}>
            <Plus className="h-4 w-4 mr-2" /> New Notification
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {notifications.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No notifications yet
                    </TableCell>
                  </TableRow>
                ) : (
                  notifications.map((n) => (
                    <TableRow key={n.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {n.image_url && <img src={n.image_url} alt="" className="w-8 h-8 rounded object-cover" />}
                          <div>
                            <p className="font-medium">{n.title}</p>
                            <p className="text-xs text-muted-foreground line-clamp-1 max-w-xs">{n.message}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{targetSummary(n)}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={n.is_active ? "default" : "secondary"}>
                          {n.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(n.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" onClick={() => openAnalytics(n)}>
                          <BarChart3 className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setEditing(n)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => handleDelete(n.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Edit / Create dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit Notification" : "New Notification"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title *</Label>
              <Input value={editing?.title || ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
            </div>
            <div>
              <Label>Message *</Label>
              <Textarea
                rows={4}
                value={editing?.message || ""}
                onChange={(e) => setEditing({ ...editing, message: e.target.value })}
              />
            </div>
            <ImageUpload
              bucket="banners"
              value={editing?.image_url || ""}
              onChange={(url) => setEditing({ ...editing, image_url: url })}
              label="Image / Poster (optional)"
            />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Link URL (optional)</Label>
                <Input
                  placeholder="https://... or /product/123"
                  value={editing?.link_url || ""}
                  onChange={(e) => setEditing({ ...editing, link_url: e.target.value })}
                />
              </div>
              <div>
                <Label>Link Button Label</Label>
                <Input
                  placeholder="Open"
                  value={editing?.link_label || ""}
                  onChange={(e) => setEditing({ ...editing, link_label: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Target Audience</Label>
              <Select
                value={editing?.target_audience || "all"}
                onValueChange={(v) => setEditing({ ...editing, target_audience: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  <SelectItem value="agents">e-Life Hierarchy Agents Only</SelectItem>
                  <SelectItem value="panchayath">Selected Panchayaths</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editing?.target_audience === "panchayath" && (
              <div>
                <Label>Select Panchayaths ({editing.target_local_body_ids?.length || 0} selected)</Label>
                <div className="border rounded-md max-h-48 overflow-y-auto p-2 space-y-1 mt-1">
                  {localBodies.map((lb) => (
                    <label key={lb.id} className="flex items-center gap-2 px-2 py-1 hover:bg-muted rounded cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={editing.target_local_body_ids?.includes(lb.id) || false}
                        onChange={() => toggleLocalBody(lb.id)}
                      />
                      <span>{lb.name}</span>
                      <Badge variant="outline" className="ml-auto text-[10px]">{lb.body_type}</Badge>
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div>
              <Label>Auto-dismiss after (seconds)</Label>
              <Input
                type="number"
                min={0}
                placeholder="0 = stay until closed"
                value={editing?.auto_dismiss_seconds ?? 0}
                onChange={(e) => setEditing({ ...editing, auto_dismiss_seconds: Number(e.target.value) })}
              />
              <p className="text-xs text-muted-foreground mt-1">Set how many seconds the popup stays before auto-closing. Use 0 to keep it open until the user closes it.</p>
            </div>
            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch
                checked={editing?.is_active ?? true}
                onCheckedChange={(c) => setEditing({ ...editing, is_active: c })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Analytics dialog */}
      <Dialog open={!!analyticsFor} onOpenChange={(o) => !o && setAnalyticsFor(null)}>
        <DialogContent className="max-w-4xl w-[95vw] sm:w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Analytics: {analyticsFor?.title}</DialogTitle>
          </DialogHeader>
          {analyticsLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : analytics ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <Card><CardHeader className="pb-2 px-3 sm:px-6"><CardTitle className="text-xs sm:text-sm">Delivered</CardTitle></CardHeader><CardContent className="px-3 sm:px-6"><p className="text-xl sm:text-2xl font-bold">{analytics.totals.delivered}</p></CardContent></Card>
                <Card><CardHeader className="pb-2 px-3 sm:px-6"><CardTitle className="text-xs sm:text-sm">Read</CardTitle></CardHeader><CardContent className="px-3 sm:px-6"><p className="text-xl sm:text-2xl font-bold text-primary">{analytics.totals.read}</p></CardContent></Card>
                <Card><CardHeader className="pb-2 px-3 sm:px-6"><CardTitle className="text-xs sm:text-sm">Clicked</CardTitle></CardHeader><CardContent className="px-3 sm:px-6"><p className="text-xl sm:text-2xl font-bold text-emerald-600">{analytics.totals.clicked}</p></CardContent></Card>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Select value={filterPanchayath} onValueChange={setFilterPanchayath}>
                  <SelectTrigger className="flex-1 min-w-[140px] h-9"><SelectValue placeholder="Panchayath" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Panchayaths</SelectItem>
                    {uniquePanchayaths.map((p: any) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={filterWard} onValueChange={setFilterWard}>
                  <SelectTrigger className="w-28 h-9"><SelectValue placeholder="Ward" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Wards</SelectItem>
                    {uniqueWards.map((w: any) => <SelectItem key={w} value={String(w)}>Ward {w}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" onClick={exportGroupsCSV} className="h-9">
                  <Download className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Export</span>
                </Button>
              </div>

              <Accordion type="multiple" className="w-full">
                <AccordionItem value="by-panchayath">
                  <AccordionTrigger className="font-semibold">By Panchayath</AccordionTrigger>
                  <AccordionContent>
                    {Object.entries(groupedByPanchayath).length === 0 ? (
                      <p className="text-center text-muted-foreground py-4 text-sm">No data</p>
                    ) : (
                      <Accordion type="multiple" className="w-full space-y-2">
                        {(Object.entries(groupedByPanchayath) as [string, any[]][]).map(([panchayath, groups]) => {
                          const subtotal = groups.reduce(
                            (a: { d: number; r: number; c: number }, g: any) => ({ d: a.d + g.delivered, r: a.r + g.read, c: a.c + g.clicked }),
                            { d: 0, r: 0, c: 0 }
                          );
                          return (
                            <AccordionItem key={panchayath} value={panchayath} className="border rounded-md px-3">
                              <AccordionTrigger className="hover:no-underline py-3">
                                <div className="flex-1 flex items-center justify-between gap-2 pr-2 min-w-0">
                                  <span className="font-medium text-sm sm:text-base truncate text-left">{panchayath}</span>
                                  <div className="flex items-center gap-1.5 text-xs shrink-0">
                                    <Badge variant="outline" className="font-normal">D {subtotal.d}</Badge>
                                    <Badge variant="outline" className="font-normal text-primary border-primary/40">R {subtotal.r}</Badge>
                                    <Badge variant="outline" className="font-normal text-emerald-600 border-emerald-600/40">C {subtotal.c}</Badge>
                                  </div>
                                </div>
                              </AccordionTrigger>
                              <AccordionContent>
                                <div className="flex justify-end mb-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 text-emerald-600 border-emerald-600/40 hover:bg-emerald-50 hover:text-emerald-700"
                                    onClick={() => shareToWhatsApp(panchayath, groups)}
                                  >
                                    <MessageCircle className="h-3.5 w-3.5 mr-1" /> Share to WhatsApp
                                  </Button>
                                </div>
                                <div className="overflow-x-auto">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead className="w-20">Ward</TableHead>
                                        <TableHead className="text-right">Delivered</TableHead>
                                        <TableHead className="text-right">Read</TableHead>
                                        <TableHead className="text-right">Clicked</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {[...groups]
                                        .sort((a: any, b: any) => (Number(a.ward_number) || 0) - (Number(b.ward_number) || 0))
                                        .map((g: any, i: number) => (
                                          <TableRow key={`${panchayath}-${i}`}>
                                            <TableCell className="font-medium">Ward {g.ward_number ?? "-"}</TableCell>
                                            <TableCell className="text-right">{g.delivered}</TableCell>
                                            <TableCell className="text-right">{g.read}</TableCell>
                                            <TableCell className="text-right">{g.clicked}</TableCell>
                                          </TableRow>
                                        ))}
                                      <TableRow className="bg-muted/40">
                                        <TableCell className="font-semibold text-xs">Subtotal</TableCell>
                                        <TableCell className="text-right font-semibold">{subtotal.d}</TableCell>
                                        <TableCell className="text-right font-semibold">{subtotal.r}</TableCell>
                                        <TableCell className="text-right font-semibold">{subtotal.c}</TableCell>
                                      </TableRow>
                                    </TableBody>
                                  </Table>
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          );
                        })}
                      </Accordion>
                    )}
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="per-user">
                  <AccordionTrigger className="font-semibold">Per-User Drilldown</AccordionTrigger>
                  <AccordionContent>
                    <div className="flex justify-end mb-2">
                      <Button size="sm" variant="outline" onClick={() => exportUsersCSV()} className="h-8">
                        <Download className="h-3.5 w-3.5 mr-1" /> Export All
                      </Button>
                    </div>
                    {Object.entries(groupedUsersByPanchayath).length === 0 ? (
                      <p className="text-center text-muted-foreground py-4 text-sm">No users</p>
                    ) : (
                      <Accordion type="multiple" className="w-full space-y-2">
                        {(Object.entries(groupedUsersByPanchayath) as [string, any[]][])
                          .sort(([a], [b]) => a.localeCompare(b))
                          .map(([panchayath, users]) => {
                            const d = users.filter((u) => u.delivered_at).length;
                            const r = users.filter((u) => u.read_at).length;
                            const c = users.filter((u) => u.clicked_at).length;
                            return (
                              <AccordionItem key={panchayath} value={panchayath} className="border rounded-md px-3">
                                <AccordionTrigger className="hover:no-underline py-3">
                                  <div className="flex-1 flex items-center justify-between gap-2 pr-2 min-w-0">
                                    <span className="font-medium text-sm sm:text-base truncate text-left">
                                      {panchayath} <span className="text-xs text-muted-foreground">({users.length})</span>
                                    </span>
                                    <div className="flex items-center gap-1.5 text-xs shrink-0">
                                      <Badge variant="outline" className="font-normal">D {d}</Badge>
                                      <Badge variant="outline" className="font-normal text-primary border-primary/40">R {r}</Badge>
                                      <Badge variant="outline" className="font-normal text-emerald-600 border-emerald-600/40">C {c}</Badge>
                                    </div>
                                  </div>
                                </AccordionTrigger>
                                <AccordionContent>
                                  <div className="flex flex-wrap justify-end gap-2 mb-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-8"
                                      onClick={() => exportUsersCSV(users, `${panchayath.replace(/[^a-z0-9]+/gi, "_")}_users`)}
                                    >
                                      <Download className="h-3.5 w-3.5 mr-1" /> Export
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-8 text-emerald-600 border-emerald-600/40 hover:bg-emerald-50 hover:text-emerald-700"
                                      onClick={() => shareUsersToWhatsApp(panchayath, users)}
                                    >
                                      <MessageCircle className="h-3.5 w-3.5 mr-1" /> Share to WhatsApp
                                    </Button>
                                  </div>
                                  {/* Mobile: card list */}
                                  <div className="sm:hidden space-y-2">
                                    {[...users]
                                      .sort((a, b) => (Number(a.ward_number) || 0) - (Number(b.ward_number) || 0))
                                      .map((u: any) => (
                                        <div key={u.user_id} className="border rounded-md p-3 text-sm space-y-1">
                                          <div className="flex items-center justify-between gap-2">
                                            <p className="font-medium truncate">{u.full_name || "-"}</p>
                                            <span className="text-xs text-muted-foreground shrink-0">{u.mobile_number || "-"}</span>
                                          </div>
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            <p className="text-xs text-muted-foreground">Ward {u.ward_number ?? "-"}</p>
                                            {u.role_name ? (
                                              <Badge variant="secondary" className="text-[10px] h-5">{u.role_name}</Badge>
                                            ) : (
                                              <Badge variant="outline" className="text-[10px] h-5 text-muted-foreground">No role</Badge>
                                            )}
                                          </div>
                                          <div className="grid grid-cols-3 gap-1 text-[11px] pt-1">
                                            <div><span className="text-muted-foreground">D:</span> {u.delivered_at ? new Date(u.delivered_at).toLocaleDateString() : "-"}</div>
                                            <div><span className="text-muted-foreground">R:</span> {u.read_at ? new Date(u.read_at).toLocaleDateString() : "-"}</div>
                                            <div><span className="text-muted-foreground">C:</span> {u.clicked_at ? new Date(u.clicked_at).toLocaleDateString() : "-"}</div>
                                          </div>
                                        </div>
                                      ))}
                                  </div>
                                  {/* Desktop: table */}
                                  <div className="hidden sm:block overflow-x-auto">
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead>Name</TableHead>
                                          <TableHead>Mobile</TableHead>
                                          <TableHead>Role</TableHead>
                                          <TableHead className="w-20">Ward</TableHead>
                                          <TableHead>Delivered</TableHead>
                                          <TableHead>Read</TableHead>
                                          <TableHead>Clicked</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {[...users]
                                          .sort((a, b) => (Number(a.ward_number) || 0) - (Number(b.ward_number) || 0))
                                          .map((u: any) => (
                                            <TableRow key={u.user_id}>
                                              <TableCell>{u.full_name || "-"}</TableCell>
                                              <TableCell className="text-xs">{u.mobile_number || "-"}</TableCell>
                                              <TableCell>
                                                {u.role_name ? (
                                                  <Badge variant="secondary" className="text-[10px]">{u.role_name}</Badge>
                                                ) : (
                                                  <span className="text-xs text-muted-foreground">—</span>
                                                )}
                                              </TableCell>
                                              <TableCell>Ward {u.ward_number ?? "-"}</TableCell>
                                              <TableCell className="text-xs">{u.delivered_at ? new Date(u.delivered_at).toLocaleString() : "-"}</TableCell>
                                              <TableCell className="text-xs">{u.read_at ? new Date(u.read_at).toLocaleString() : "-"}</TableCell>
                                              <TableCell className="text-xs">{u.clicked_at ? new Date(u.clicked_at).toLocaleString() : "-"}</TableCell>
                                            </TableRow>
                                          ))}
                                      </TableBody>
                                    </Table>
                                  </div>
                                </AccordionContent>
                              </AccordionItem>
                            );
                          })}
                      </Accordion>
                    )}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default NotificationsPage;
