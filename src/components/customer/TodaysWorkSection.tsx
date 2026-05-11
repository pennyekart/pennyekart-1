import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, Loader2, Plus, Save, Pencil, Trash2, Briefcase, UserX, UserCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

type WorkLog = {
  id: string;
  agent_id: string;
  work_date: string;
  work_details: string;
  created_at: string;
  updated_at: string;
};

type Agent = { id: string; name: string; role: string; mobile: string };

type DeptAgent = { id: string; name: string; role: string; mobile: string };
type Department = { name: string; agent_count: number; present_count: number; absent_count: number; present_agents: DeptAgent[]; absent_agents: DeptAgent[] };

const ymd = (d: Date) => format(d, "yyyy-MM-dd");

export const TodaysWorkSection = () => {
  const { profile } = useAuth();
  const [checking, setChecking] = useState(true);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [notAgent, setNotAgent] = useState(false);
  const [date, setDate] = useState<Date>(new Date());
  const [logs, setLogs] = useState<WorkLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [deptLoading, setDeptLoading] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);

  const canViewAbsent = useMemo(() => {
    const allowed = ["scode", "s_code", "team_leader", "teamleader", "team-lead", "admin", "super_admin", "superadmin"];
    const norm = (s?: string | null) => (s || "").toLowerCase().replace(/\s+/g, "_");
    if (profile?.is_super_admin) return true;
    if (allowed.includes(norm(agent?.role))) return true;
    return false;
  }, [agent?.role, profile?.is_super_admin]);

  const callFn = async (opts: { method: string; query?: Record<string, string>; body?: any }) => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) throw new Error("Not authenticated");
    const base = (supabase as any).functionsUrl || `${(supabase as any).supabaseUrl}/functions/v1`;
    const qs = opts.query ? "?" + new URLSearchParams(opts.query).toString() : "";
    const res = await fetch(`${base}/agent-work-logs${qs}`, {
      method: opts.method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        apikey: (supabase as any).supabaseKey,
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const j = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, body: j };
  };

  useEffect(() => {
    (async () => {
      setChecking(true);
      const r = await callFn({ method: "GET", query: { date: ymd(new Date()) } });
      if (r.status === 404 && r.body?.error === "not_an_agent") {
        setNotAgent(true);
      } else if (r.ok) {
        setAgent(r.body.agent);
        setLogs(r.body.logs || []);
      } else {
        setNotAgent(true);
      }
      setChecking(false);
    })();
  }, []);

  useEffect(() => {
    if (!agent) return;
    (async () => {
      setLoading(true);
      const r = await callFn({ method: "GET", query: { date: ymd(date) } });
      if (r.ok) setLogs(r.body.logs || []);
      setLoading(false);
    })();
  }, [date, agent?.id]);

  useEffect(() => {
    if (!agent || !canViewAbsent) return;
    (async () => {
      setDeptLoading(true);
      const r = await callFn({ method: "GET", query: { date: ymd(date), scope: "department" } });
      if (r.ok) setDepartments(r.body.departments || []);
      else toast.error(r.body?.error || "Failed to load department logs");
      setDeptLoading(false);
    })();
  }, [date, agent?.id, canViewAbsent]);

  const isToday = useMemo(() => ymd(date) === ymd(new Date()), [date]);

  const handleAdd = async () => {
    if (!draft.trim()) return;
    setSaving(true);
    const r = await callFn({ method: "POST", body: { work_date: ymd(date), work_details: draft.trim() } });
    setSaving(false);
    if (!r.ok) { toast.error(r.body?.error || "Failed to save"); return; }
    setDraft("");
    setLogs((prev) => [r.body.log, ...prev]);
    toast.success("Work log saved to e-Life");
  };

  const handleUpdate = async (id: string) => {
    if (!editingText.trim()) return;
    setSaving(true);
    const r = await callFn({ method: "PUT", body: { id, work_details: editingText.trim() } });
    setSaving(false);
    if (!r.ok) { toast.error(r.body?.error || "Failed to update"); return; }
    setLogs((prev) => prev.map((l) => (l.id === id ? r.body.log : l)));
    setEditingId(null);
    setEditingText("");
    toast.success("Updated");
  };

  const handleDelete = async (id: string) => {
    const r = await callFn({ method: "DELETE", query: { id } });
    if (!r.ok) { toast.error(r.body?.error || "Failed to delete"); return; }
    setLogs((prev) => prev.filter((l) => l.id !== id));
    toast.success("Deleted");
  };

  if (checking) {
    return (
      <Card>
        <CardContent className="py-6 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (notAgent || !agent) return null;

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Briefcase className="h-4 w-4 text-primary" />
              {isToday ? "Today's Work- ഇന്നത്തെ വർക്ക്" : `Work — ${format(date, "PPP")}`}
            </CardTitle>
            <CardDescription className="text-xs">
              Synced with e-Life Society • Agent: <span className="font-medium">{agent.name}</span>{" "}
              <Badge variant="secondary" className="ml-1 text-[10px]">{agent.role}</Badge>
            </CardDescription>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("gap-2", !isToday && "border-primary/40")}>
                <CalendarIcon className="h-4 w-4" />
                {format(date, "dd MMM yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(d) => d && setDate(d)}
                disabled={(d) => d > new Date()}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={isToday ? "നിങ്ങൾ ഇന്ന് എന്തെങ്കിലും ജോലി ചെയ്തത് ഇവിടെ നോട്ട് ചെയ്യൂ .." : `Add a log entry for ${format(date, "PPP")}`}
            rows={3}
            className="resize-none"
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={handleAdd} disabled={saving || !draft.trim()}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
              Add entry
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          {loading ? (
            <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
          ) : logs.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">No work logs for this date yet.</p>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="rounded-lg border bg-muted/20 p-3 text-sm space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-muted-foreground">
                    {format(new Date(log.created_at), "dd MMM yyyy • HH:mm")}
                    {log.updated_at !== log.created_at && (
                      <span className="ml-1">(edited {format(new Date(log.updated_at), "HH:mm")})</span>
                    )}
                  </span>
                  <div className="flex gap-1">
                    {editingId !== log.id && (
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingId(log.id); setEditingText(log.work_details); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete work log?</AlertDialogTitle>
                          <AlertDialogDescription>This will be removed from e-Life Society too.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(log.id)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>

                {editingId === log.id ? (
                  <div className="space-y-2">
                    <Textarea value={editingText} onChange={(e) => setEditingText(e.target.value)} rows={3} className="resize-none" />
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="outline" onClick={() => { setEditingId(null); setEditingText(""); }}>Cancel</Button>
                      <Button size="sm" onClick={() => handleUpdate(log.id)} disabled={saving}>
                        {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap text-sm">{log.work_details}</p>
                )}
              </div>
            ))
          )}
        </div>
      </CardContent>

      {canViewAbsent && (
      <CardContent className="border-t pt-4 space-y-3">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <UserX className="h-4 w-4 text-destructive" />
            Absent Details — ഹാജരാകാത്തവരുടെ വിശദാംശങ്ങൾ
          </h3>
          <p className="text-xs text-muted-foreground">Agents who did not submit work log for {format(date, "PPP")}</p>
        </div>

        {deptLoading ? (
          <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
        ) : departments.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-3">No departments found.</p>
        ) : (
          <Accordion type="multiple" className="w-full">
            {departments.map((dept) => (
              <AccordionItem key={dept.name} value={dept.name}>
                <AccordionTrigger className="text-sm hover:no-underline">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{dept.name}</span>
                    <Badge variant="secondary" className="text-[10px]">{dept.agent_count} agent{dept.agent_count === 1 ? "" : "s"}</Badge>
                    <Badge variant="default" className="text-[10px] bg-green-600 hover:bg-green-700">{dept.present_count} present</Badge>
                    <Badge variant="destructive" className="text-[10px]">{dept.absent_count} absent</Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  {dept.absent_agents.length === 0 ? (
                    <p className="text-xs text-green-600 py-2 flex items-center gap-1">
                      <UserCheck className="h-3 w-3" /> All agents are present today.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {dept.absent_agents.map((a) => (
                        <div key={a.id} className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <UserX className="h-4 w-4 text-destructive" />
                            <span className="font-medium">{a.name}</span>
                            {a.role && (
                              <Badge variant="secondary" className="text-[10px]">{a.role}</Badge>
                            )}
                          </div>
                          <span className="text-[11px] text-muted-foreground">{a.mobile}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </CardContent>
      )}
    </Card>
  );
};
