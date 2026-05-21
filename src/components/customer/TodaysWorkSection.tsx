import { useEffect, useMemo, useState, useCallback } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isAfter, startOfDay } from "date-fns";
import { CalendarIcon, Loader2, Plus, Save, Pencil, Trash2, Briefcase, CheckCircle2, XCircle, Users, Phone, MessageCircle, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type WorkLog = {
  id: string;
  agent_id: string;
  work_date: string;
  work_details: string;
  created_at: string;
  updated_at: string;
};

type Agent = { id: string; name: string; role: string; mobile: string; panchayath_id?: string | null; ward?: string | null };

type Panchayath = { id: string; name: string; name_ml?: string | null; district?: string | null; ward?: string | number | null };
type AbsentAgent = { id: string; name: string; role: string; mobile: string; ward: string | null; panchayath_id: string };

const ymd = (d: Date) => format(d, "yyyy-MM-dd");

export const TodaysWorkSection = () => {
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
  const [monthLogs, setMonthLogs] = useState<WorkLog[]>([]);
  const [monthCursor, setMonthCursor] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<"day" | "all">("day");
  const [allLogs, setAllLogs] = useState<WorkLog[]>([]);
  const [allLoading, setAllLoading] = useState(false);

  // Absent details state
  const [panchayaths, setPanchayaths] = useState<Panchayath[]>([]);
  const [filterPanchayath, setFilterPanchayath] = useState<string>("");
  const [filterWard, setFilterWard] = useState<string>("all");
  const [absentLoading, setAbsentLoading] = useState(false);
  const [absentList, setAbsentList] = useState<AbsentAgent[]>([]);
  const [presentCount, setPresentCount] = useState(0);
  const [totalAgents, setTotalAgents] = useState(0);

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

  // Load month attendance whenever the calendar's visible month changes
  useEffect(() => {
    if (!agent) return;
    (async () => {
      const r = await callFn({ method: "GET", query: { month: format(monthCursor, "yyyy-MM") } });
      if (r.ok) setMonthLogs(r.body.logs || []);
    })();
  }, [monthCursor, agent?.id]);

  const isToday = useMemo(() => ymd(date) === ymd(new Date()), [date]);

  const attendance = useMemo(() => {
    const today = startOfDay(new Date());
    const monthStart = startOfMonth(monthCursor);
    const monthEnd = endOfMonth(monthCursor);
    // Cap end at today (don't count future days as absent)
    const end = isAfter(monthEnd, today) ? today : monthEnd;
    const days = isAfter(monthStart, today) ? [] : eachDayOfInterval({ start: monthStart, end });
    const presentSet = new Set(monthLogs.map((l) => l.work_date));
    const presentDays = days.filter((d) => presentSet.has(ymd(d)));
    const absentDays = days.filter((d) => !presentSet.has(ymd(d)));
    return { totalDays: days.length, presentDays, absentDays, presentSet };
  }, [monthLogs, monthCursor]);

  const selectedAttendance = useMemo(() => {
    const today = startOfDay(new Date());
    const sel = startOfDay(date);
    if (isAfter(sel, today)) return "future" as const;
    return attendance.presentSet.has(ymd(date)) ? "present" as const : "absent" as const;
  }, [date, attendance.presentSet]);

  const refreshMonth = async () => {
    const r = await callFn({ method: "GET", query: { month: format(monthCursor, "yyyy-MM") } });
    if (r.ok) setMonthLogs(r.body.logs || []);
  };

  const handleAdd = async () => {
    if (!draft.trim()) return;
    setSaving(true);
    const r = await callFn({ method: "POST", body: { work_date: ymd(date), work_details: draft.trim() } });
    setSaving(false);
    if (!r.ok) { toast.error(r.body?.error || "Failed to save"); return; }
    setDraft("");
    // Reload selected day so we see the appended/merged record
    const reload = await callFn({ method: "GET", query: { date: ymd(date) } });
    if (reload.ok) setLogs(reload.body.logs || []);
    refreshMonth();
    toast.success("Marked present • Saved to e-Life");
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
    setAllLogs((prev) => prev.filter((l) => l.id !== id));
    refreshMonth();
    toast.success("Deleted");
  };

  const loadAll = useCallback(async () => {
    setAllLoading(true);
    const r = await callFn({ method: "GET", query: { all: "1" } });
    if (r.ok) setAllLogs(r.body.logs || []);
    setAllLoading(false);
  }, [agent?.id]);

  useEffect(() => {
    if (viewMode === "all" && agent) loadAll();
  }, [viewMode, agent?.id, loadAll]);

  const handleUpdateAll = async (id: string) => {
    if (!editingText.trim()) return;
    setSaving(true);
    const r = await callFn({ method: "PUT", body: { id, work_details: editingText.trim() } });
    setSaving(false);
    if (!r.ok) { toast.error(r.body?.error || "Failed to update"); return; }
    setAllLogs((prev) => prev.map((l) => (l.id === id ? r.body.log : l)));
    setLogs((prev) => prev.map((l) => (l.id === id ? r.body.log : l)));
    setEditingId(null);
    setEditingText("");
    toast.success("Updated");
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
                month={monthCursor}
                onMonthChange={setMonthCursor}
                disabled={(d) => d > new Date()}
                modifiers={{
                  present: attendance.presentDays,
                  absent: attendance.absentDays,
                }}
                modifiersClassNames={{
                  present: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-semibold",
                  absent: "bg-destructive/10 text-destructive/80",
                }}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* View toggle */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={viewMode === "day" ? "default" : "outline"}
            onClick={() => setViewMode("day")}
            className="h-7 text-xs"
          >
            By Day
          </Button>
          <Button
            size="sm"
            variant={viewMode === "all" ? "default" : "outline"}
            onClick={() => setViewMode("all")}
            className="h-7 text-xs"
          >
            All Entries {allLogs.length > 0 && `(${allLogs.length})`}
          </Button>
        </div>

        {viewMode === "all" ? (
          <div className="space-y-2">
            {allLoading ? (
              <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
            ) : allLogs.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-3">No work logs yet.</p>
            ) : (
              allLogs.map((log) => (
                <div key={log.id} className="rounded-lg border bg-muted/20 p-3 text-sm space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-[10px]">{format(new Date(log.work_date), "dd MMM yyyy")}</Badge>
                      <span className="text-[11px] text-muted-foreground">
                        {format(new Date(log.created_at), "HH:mm")}
                        {log.updated_at !== log.created_at && (
                          <span className="ml-1">(edited)</span>
                        )}
                      </span>
                    </div>
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
                        <Button size="sm" onClick={() => handleUpdateAll(log.id)} disabled={saving}>
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
        ) : (
        <>

        <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="text-xs font-medium text-muted-foreground">
              Attendance — {format(monthCursor, "MMMM yyyy")}
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/15 border-0 gap-1">
                <CheckCircle2 className="h-3 w-3" />
                {attendance.presentDays.length} / {attendance.totalDays} days present
              </Badge>
              {attendance.absentDays.length > 0 && (
                <Badge variant="outline" className="text-destructive border-destructive/30 gap-1">
                  <XCircle className="h-3 w-3" />
                  {attendance.absentDays.length} absent
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-muted-foreground">Selected: {format(date, "dd MMM yyyy")}</span>
            {selectedAttendance === "present" ? (
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                <CheckCircle2 className="h-3.5 w-3.5" /> Present
              </span>
            ) : selectedAttendance === "absent" ? (
              <span className="inline-flex items-center gap-1 text-destructive font-medium">
                <XCircle className="h-3.5 w-3.5" /> Absent — add an entry to mark present
              </span>
            ) : null}
          </div>
        </div>

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

        <AbsentDetails
          callFn={callFn}
          date={date}
          panchayaths={panchayaths}
          setPanchayaths={setPanchayaths}
          filterPanchayath={filterPanchayath}
          setFilterPanchayath={setFilterPanchayath}
          filterWard={filterWard}
          setFilterWard={setFilterWard}
          absentLoading={absentLoading}
          setAbsentLoading={setAbsentLoading}
          absentList={absentList}
          setAbsentList={setAbsentList}
          presentCount={presentCount}
          setPresentCount={setPresentCount}
          totalAgents={totalAgents}
          setTotalAgents={setTotalAgents}
          defaultPanchayath={agent.panchayath_id || ""}
        />
        </>
        )}
      </CardContent>
    </Card>
  );
};

type AbsentProps = {
  callFn: (opts: { method: string; query?: Record<string, string>; body?: any }) => Promise<{ ok: boolean; status: number; body: any }>;
  date: Date;
  panchayaths: Panchayath[];
  setPanchayaths: (p: Panchayath[]) => void;
  filterPanchayath: string;
  setFilterPanchayath: (v: string) => void;
  filterWard: string;
  setFilterWard: (v: string) => void;
  absentLoading: boolean;
  setAbsentLoading: (v: boolean) => void;
  absentList: AbsentAgent[];
  setAbsentList: (v: AbsentAgent[]) => void;
  presentCount: number;
  setPresentCount: (v: number) => void;
  totalAgents: number;
  setTotalAgents: (v: number) => void;
  defaultPanchayath: string;
};

const AbsentDetails = ({
  callFn, date, panchayaths, setPanchayaths,
  filterPanchayath, setFilterPanchayath, filterWard, setFilterWard,
  absentLoading, setAbsentLoading, absentList, setAbsentList,
  presentCount, setPresentCount, totalAgents, setTotalAgents,
  defaultPanchayath,
}: AbsentProps) => {
  // Load panchayaths once
  useEffect(() => {
    if (panchayaths.length > 0) return;
    (async () => {
      const r = await callFn({ method: "GET", query: { panchayaths: "1" } });
      if (r.ok) setPanchayaths(r.body.panchayaths || []);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Default-select caller's panchayath when list arrives
  useEffect(() => {
    if (!filterPanchayath && defaultPanchayath && panchayaths.some((p) => p.id === defaultPanchayath)) {
      setFilterPanchayath(defaultPanchayath);
    } else if (!filterPanchayath && panchayaths.length > 0) {
      setFilterPanchayath(panchayaths[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panchayaths.length, defaultPanchayath]);

  const selectedPanchayath = useMemo(
    () => panchayaths.find((p) => p.id === filterPanchayath) || null,
    [panchayaths, filterPanchayath],
  );

  const wardCount = useMemo(() => {
    const w = selectedPanchayath?.ward;
    const n = typeof w === "number" ? w : parseInt(String(w || "0"), 10);
    return isFinite(n) && n > 0 ? n : 0;
  }, [selectedPanchayath]);

  const fetchAbsent = async () => {
    if (!filterPanchayath) return;
    setAbsentLoading(true);
    const r = await callFn({
      method: "GET",
      query: { absent: "1", date: ymd(date), panchayath: filterPanchayath, ward: filterWard },
    });
    setAbsentLoading(false);
    if (!r.ok) { toast.error(r.body?.error || "Failed to load absent details"); return; }
    setAbsentList(r.body.absent || []);
    setPresentCount((r.body.present || []).length);
    setTotalAgents(r.body.totalAgents || 0);
  };

  // Auto-fetch on filter/date change
  useEffect(() => {
    if (filterPanchayath) fetchAbsent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterPanchayath, filterWard, date]);

  return (
    <div className="rounded-lg border bg-card p-3 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Users className="h-4 w-4 text-primary" />
          Absent Details — ഹാജരാകാത്തവരുടെ വിശദാംശങ്ങൾ
        </div>
        <Button size="sm" variant="ghost" onClick={fetchAbsent} disabled={absentLoading || !filterPanchayath}>
          <RefreshCw className={cn("h-3.5 w-3.5", absentLoading && "animate-spin")} />
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <label className="text-[11px] text-muted-foreground">Panchayath</label>
          <Select
            value={filterPanchayath}
            onValueChange={(v) => { setFilterPanchayath(v); setFilterWard("all"); }}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Select panchayath" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {panchayaths.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}{p.name_ml ? ` • ${p.name_ml}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground">Ward</label>
          <Select value={filterWard} onValueChange={setFilterWard}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="All wards" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="all">All wards</SelectItem>
              {Array.from({ length: wardCount }, (_, i) => String(i + 1)).map((w) => (
                <SelectItem key={w} value={w}>Ward {w}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs">
        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/15 border-0 gap-1">
          <CheckCircle2 className="h-3 w-3" /> {presentCount} present
        </Badge>
        <Badge variant="outline" className="text-destructive border-destructive/30 gap-1">
          <XCircle className="h-3 w-3" /> {absentList.length} absent
        </Badge>
        <span className="text-muted-foreground ml-auto">Total: {totalAgents}</span>
      </div>

      {absentLoading ? (
        <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
      ) : absentList.length === 0 ? (
        <p className="text-xs text-center text-emerald-600 dark:text-emerald-400 py-3">
          🎉 Everyone is present for {format(date, "dd MMM yyyy")}!
        </p>
      ) : (
        <div className="space-y-1.5 max-h-72 overflow-y-auto">
          {absentList.map((a) => {
            const tel = (a.mobile || "").replace(/\D/g, "");
            const wa = tel.length === 10 ? `91${tel}` : tel;
            return (
              <div key={a.id} className="flex items-center justify-between gap-2 rounded-md border bg-muted/20 px-2.5 py-1.5">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{a.name}</div>
                  <div className="text-[11px] text-muted-foreground flex gap-2 flex-wrap">
                    <span>{a.role}</span>
                    {a.ward ? <span>• Ward {a.ward}</span> : null}
                    <span>• {a.mobile}</span>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  {tel && (
                    <a href={`tel:${tel}`} className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-muted">
                      <Phone className="h-3.5 w-3.5" />
                    </a>
                  )}
                  {wa && (
                    <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center h-8 w-8 rounded-md text-emerald-600 hover:bg-muted">
                      <MessageCircle className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
