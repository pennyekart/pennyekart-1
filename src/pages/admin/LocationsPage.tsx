import { useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, MapPin, Building2, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const LocationsPage = () => {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [newDistrict, setNewDistrict] = useState("");
  const [selectedDistrictId, setSelectedDistrictId] = useState<string | null>(null);
  const [newBodyName, setNewBodyName] = useState("");
  const [newBodyType, setNewBodyType] = useState("panchayath");
  const [newWardCount, setNewWardCount] = useState("25");

  // Fetch districts
  const { data: districts = [] } = useQuery({
    queryKey: ["locations-districts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("locations_districts")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Fetch local bodies for selected district
  const { data: localBodies = [] } = useQuery({
    queryKey: ["locations-local-bodies", selectedDistrictId],
    queryFn: async () => {
      if (!selectedDistrictId) return [];
      const { data, error } = await supabase
        .from("locations_local_bodies")
        .select("*")
        .eq("district_id", selectedDistrictId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedDistrictId,
  });

  // Add district
  const addDistrict = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from("locations_districts").insert({ name });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["locations-districts"] });
      setNewDistrict("");
      toast({ title: "District added" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Delete district
  const deleteDistrict = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("locations_districts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["locations-districts"] });
      if (selectedDistrictId) setSelectedDistrictId(null);
      toast({ title: "District deleted" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Add local body
  const addLocalBody = useMutation({
    mutationFn: async () => {
      if (!selectedDistrictId) return;
      const { error } = await supabase.from("locations_local_bodies").insert({
        district_id: selectedDistrictId,
        name: newBodyName,
        body_type: newBodyType,
        ward_count: parseInt(newWardCount) || 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["locations-local-bodies"] });
      setNewBodyName("");
      setNewWardCount("25");
      toast({ title: "Local body added" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Delete local body
  const deleteLocalBody = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("locations_local_bodies").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["locations-local-bodies"] });
      toast({ title: "Local body deleted" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const selectedDistrict = districts.find((d) => d.id === selectedDistrictId);

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Location Management</h1>
          <p className="text-sm text-muted-foreground">India → Kerala → Districts → Panchayath/Municipality → Wards</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Districts */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <MapPin className="h-5 w-5 text-primary" /> Districts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="District name"
                  value={newDistrict}
                  onChange={(e) => setNewDistrict(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && newDistrict.trim() && addDistrict.mutate(newDistrict.trim())}
                />
                <Button size="sm" onClick={() => newDistrict.trim() && addDistrict.mutate(newDistrict.trim())} disabled={!newDistrict.trim()}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-1">
                {districts.map((d) => (
                  <div
                    key={d.id}
                    className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm cursor-pointer transition-colors ${
                      selectedDistrictId === d.id
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    }`}
                    onClick={() => setSelectedDistrictId(d.id)}
                  >
                    <span className="flex items-center gap-2">
                      {d.name}
                      {selectedDistrictId === d.id && <ChevronRight className="h-4 w-4" />}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={(e) => { e.stopPropagation(); deleteDistrict.mutate(d.id); }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                {districts.length === 0 && (
                  <p className="text-sm text-muted-foreground py-4 text-center">No districts added yet</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Local Bodies & Wards */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Building2 className="h-5 w-5 text-primary" />
                {selectedDistrict ? `${selectedDistrict.name} — Local Bodies` : "Select a District"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedDistrictId ? (
                <>
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Name (e.g. Manjeri)"
                        value={newBodyName}
                        onChange={(e) => setNewBodyName(e.target.value)}
                        className="flex-1"
                      />
                      <Select value={newBodyType} onValueChange={setNewBodyType}>
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="panchayath">Panchayath</SelectItem>
                          <SelectItem value="municipality">Municipality</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        placeholder="No. of wards"
                        value={newWardCount}
                        onChange={(e) => setNewWardCount(e.target.value)}
                        min={1}
                        className="w-32"
                      />
                      <span className="flex items-center text-xs text-muted-foreground">wards (1–{newWardCount || "?"})</span>
                      <Button
                        size="sm"
                        className="ml-auto"
                        onClick={() => newBodyName.trim() && addLocalBody.mutate()}
                        disabled={!newBodyName.trim()}
                      >
                        <Plus className="mr-1 h-4 w-4" /> Add
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {localBodies.map((lb) => (
                      <div key={lb.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                        <div>
                          <span className="font-medium text-sm">{lb.name}</span>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge variant="secondary" className="text-xs capitalize">{lb.body_type}</Badge>
                            <span className="text-xs text-muted-foreground">
                              Wards: 1–{lb.ward_count}
                            </span>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => deleteLocalBody.mutate(lb.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                    {localBodies.length === 0 && (
                      <p className="text-sm text-muted-foreground py-4 text-center">No local bodies added yet</p>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground py-8 text-center">← Select a district to manage its local bodies</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
};

export default LocationsPage;
