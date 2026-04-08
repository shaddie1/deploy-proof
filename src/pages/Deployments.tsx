import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/StatusBadge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Rocket, Plus, Search, MoreHorizontal, MapPin, Camera, CheckCircle2,
  AlertTriangle, Clock, Shield, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { logAudit } from "@/lib/auditLog";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

type DeploymentStatus = "scheduled" | "in_transit" | "deployed" | "verified" | "flagged";

type DeploymentRow = Tables<"deployments"> & {
  items: { name: string } | null;
  projects: { name: string } | null;
};

interface StockBatchOption {
  id: string;
  item_id: string;
  quantity_available: number;
  items: { name: string } | null;
  shipments: { supplier: string } | null;
}

interface ProjectOption { id: string; name: string }
interface ItemOption { id: string; name: string }

const STATUS_FLOW: Record<DeploymentStatus, DeploymentStatus[]> = {
  scheduled: ["in_transit"],
  in_transit: ["deployed"],
  deployed: ["verified", "flagged"],
  verified: [],
  flagged: [],
};

export default function DeploymentsPage() {
  const { user, hasRole } = useAuth();
  const { toast } = useToast();
  const canManage = hasRole("admin") || hasRole("field_officer");
  const canVerify = hasRole("admin") || hasRole("auditor");

  const [deployments, setDeployments] = useState<DeploymentRow[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [items, setItems] = useState<ItemOption[]>([]);
  const [batches, setBatches] = useState<StockBatchOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Create dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    project_id: "",
    item_id: "",
    stock_batch_id: "",
    quantity: "",
    location_name: "",
    gps_latitude: "",
    gps_longitude: "",
    deployment_date: new Date().toISOString().split("T")[0],
    notes: "",
  });
  const [gpsLoading, setGpsLoading] = useState(false);
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Verify / Flag dialog
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [verifyTarget, setVerifyTarget] = useState<DeploymentRow | null>(null);
  const [verifyAction, setVerifyAction] = useState<"verified" | "flagged">("verified");
  const [verifyNotes, setVerifyNotes] = useState("");
  const [verifying, setVerifying] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [{ data: depData }, { data: projData }, { data: itemData }, { data: batchData }] =
      await Promise.all([
        supabase
          .from("deployments")
          .select("*, items(name), projects(name)")
          .order("created_at", { ascending: false }),
        supabase.from("projects").select("id, name").order("name"),
        supabase.from("items").select("id, name").order("name"),
        supabase
          .from("stock_batches")
          .select("id, item_id, quantity_available, items(name), shipments(supplier)")
          .gt("quantity_available", 0)
          .order("created_at", { ascending: false }),
      ]);
    setDeployments((depData || []) as unknown as DeploymentRow[]);
    setProjects(projData || []);
    setItems(itemData || []);
    setBatches((batchData || []) as unknown as StockBatchOption[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Filter batches by selected item
  const filteredBatches = form.item_id
    ? batches.filter((b) => b.item_id === form.item_id)
    : batches;

  const selectedBatch = batches.find((b) => b.id === form.stock_batch_id);

  const filtered = deployments.filter((d) => {
    const matchSearch =
      !searchQuery ||
      d.items?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.projects?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.location_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = statusFilter === "all" || d.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const counts = {
    total: deployments.length,
    scheduled: deployments.filter((d) => d.status === "scheduled" || d.status === "in_transit").length,
    deployed: deployments.filter((d) => d.status === "deployed").length,
    verified: deployments.filter((d) => d.status === "verified").length,
    flagged: deployments.filter((d) => d.status === "flagged").length,
  };

  // GPS capture
  const captureGPS = () => {
    if (!navigator.geolocation) {
      toast({ title: "GPS not available", description: "Your browser doesn't support geolocation.", variant: "destructive" });
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({
          ...f,
          gps_latitude: pos.coords.latitude.toFixed(6),
          gps_longitude: pos.coords.longitude.toFixed(6),
        }));
        setGpsLoading(false);
        toast({ title: "GPS captured", description: `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}` });
      },
      (err) => {
        setGpsLoading(false);
        toast({ title: "GPS error", description: err.message, variant: "destructive" });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // SHA-256 hash helper
  const hashFile = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
  };

  const resetForm = () => {
    setForm({
      project_id: "", item_id: "", stock_batch_id: "", quantity: "",
      location_name: "", gps_latitude: "", gps_longitude: "",
      deployment_date: new Date().toISOString().split("T")[0], notes: "",
    });
    setEvidenceFile(null);
  };

  const handleCreate = async () => {
    if (!user || !form.project_id || !form.item_id || !form.stock_batch_id || !form.quantity) return;
    const qty = parseInt(form.quantity, 10);
    if (!selectedBatch || qty > selectedBatch.quantity_available) {
      toast({ title: "Error", description: "Quantity exceeds available stock.", variant: "destructive" });
      return;
    }

    setSaving(true);

    // 1. Insert deployment
    const payload: TablesInsert<"deployments"> = {
      project_id: form.project_id,
      item_id: form.item_id,
      stock_batch_id: form.stock_batch_id,
      quantity: qty,
      field_officer_id: user.id,
      created_by: user.id,
      location_name: form.location_name || null,
      gps_latitude: form.gps_latitude ? parseFloat(form.gps_latitude) : null,
      gps_longitude: form.gps_longitude ? parseFloat(form.gps_longitude) : null,
      deployment_date: form.deployment_date,
      notes: form.notes || null,
    };

    const { data: newDep, error: depErr } = await supabase.from("deployments").insert(payload).select("id").single();
    if (depErr || !newDep) {
      toast({ title: "Error", description: depErr?.message || "Failed to create deployment", variant: "destructive" });
      setSaving(false);
      return;
    }

    // 2. Deduct stock
    const { error: stockErr } = await supabase
      .from("stock_batches")
      .update({
        quantity_available: selectedBatch.quantity_available - qty,
        quantity_deployed: (selectedBatch as any).quantity_deployed
          ? (selectedBatch as any).quantity_deployed + qty
          : qty,
      })
      .eq("id", form.stock_batch_id);

    if (stockErr) {
      toast({ title: "Warning", description: `Deployment created but stock deduction failed: ${stockErr.message}`, variant: "destructive" });
    }

    // 3. Upload evidence photo if provided
    if (evidenceFile) {
      setUploading(true);
      const hash = await hashFile(evidenceFile);
      const filePath = `deployments/${newDep.id}/${Date.now()}_${evidenceFile.name}`;
      const { error: uploadErr } = await supabase.storage.from("evidence").upload(filePath, evidenceFile);

      if (!uploadErr) {
        const { data: urlData } = supabase.storage.from("evidence").getPublicUrl(filePath);
        await supabase.from("evidence_files").insert({
          event_type: "deployment" as const,
          linked_entity_type: "deployment",
          linked_entity_id: newDep.id,
          project_id: form.project_id,
          file_name: evidenceFile.name,
          file_type: evidenceFile.type || "image/jpeg",
          file_size: evidenceFile.size,
          file_url: urlData.publicUrl,
          sha256_hash: hash,
          uploaded_by: user.id,
          gps_latitude: form.gps_latitude ? parseFloat(form.gps_latitude) : null,
          gps_longitude: form.gps_longitude ? parseFloat(form.gps_longitude) : null,
        });
      }
      setUploading(false);
    }

    logAudit({ userId: user.id, action: "create", entityType: "deployment", entityId: newDep.id, afterData: payload as any });
    toast({ title: "Deployment created", description: `${qty} units scheduled for deployment.` });
    setCreateOpen(false);
    resetForm();
    fetchData();
    setSaving(false);
  };

  const updateStatus = async (dep: DeploymentRow, newStatus: DeploymentStatus) => {
    if (newStatus === "verified" || newStatus === "flagged") {
      setVerifyTarget(dep);
      setVerifyAction(newStatus);
      setVerifyNotes("");
      setVerifyOpen(true);
      return;
    }

    const { error } = await supabase
      .from("deployments")
      .update({ status: newStatus })
      .eq("id", dep.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Status updated", description: `Deployment marked as ${newStatus.replace(/_/g, " ")}` });
      fetchData();
    }
  };

  const handleVerify = async () => {
    if (!verifyTarget || !user) return;
    setVerifying(true);

    const { error } = await supabase
      .from("deployments")
      .update({
        status: verifyAction,
        verified_by: user.id,
        verified_at: new Date().toISOString(),
        verification_notes: verifyNotes || null,
      })
      .eq("id", verifyTarget.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      logAudit({ userId: user.id, action: verifyAction === "verified" ? "verify" : "flag", entityType: "deployment", entityId: verifyTarget.id, beforeData: { status: verifyTarget.status }, afterData: { status: verifyAction, verification_notes: verifyNotes } });
      toast({
        title: verifyAction === "verified" ? "Deployment verified" : "Deployment flagged",
        description: verifyAction === "verified"
          ? "This deployment has been verified successfully."
          : "This deployment has been flagged for review.",
      });
      setVerifyOpen(false);
      fetchData();
    }
    setVerifying(false);
  };

  const summaryCards = [
    { title: "Total Deployments", value: counts.total, icon: Rocket, colorClass: "text-primary" },
    { title: "Pending", value: counts.scheduled, icon: Clock, colorClass: "text-status-warning" },
    { title: "Deployed", value: counts.deployed, icon: MapPin, colorClass: "text-status-info" },
    { title: "Verified", value: counts.verified, icon: CheckCircle2, colorClass: "text-status-success" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Deployments</h1>
          <p className="text-muted-foreground">Field deployments with GPS tracking and verification</p>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => { resetForm(); setCreateOpen(true); }}>
            <Plus className="mr-1 h-4 w-4" /> New Deployment
          </Button>
        )}
      </div>

      {/* Flagged alert */}
      {counts.flagged > 0 && (
        <Card className="border-status-danger/30 bg-status-danger/5">
          <CardContent className="flex items-center gap-2 py-3">
            <AlertTriangle className="h-4 w-4 text-status-danger" />
            <span className="text-sm font-medium text-status-danger">
              {counts.flagged} deployment{counts.flagged > 1 ? "s" : ""} flagged for review
            </span>
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
              <card.icon className={cn("h-4 w-4", card.colorClass)} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by item, project, or location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="in_transit">In Transit</SelectItem>
            <SelectItem value="deployed">Deployed</SelectItem>
            <SelectItem value="verified">Verified</SelectItem>
            <SelectItem value="flagged">Flagged</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Deployments ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {searchQuery || statusFilter !== "all" ? "No deployments match your filters" : "No deployments yet."}
            </p>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>GPS</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((d) => {
                    const nextStatuses = STATUS_FLOW[d.status as DeploymentStatus] || [];
                    const allowedNext = nextStatuses.filter((ns) => {
                      if (ns === "verified" || ns === "flagged") return canVerify;
                      return canManage;
                    });

                    return (
                      <TableRow key={d.id} className={d.status === "flagged" ? "bg-status-danger/5" : ""}>
                        <TableCell className="font-medium">{d.projects?.name || "—"}</TableCell>
                        <TableCell>{d.items?.name || "—"}</TableCell>
                        <TableCell className="text-right">{d.quantity}</TableCell>
                        <TableCell>{d.location_name || "—"}</TableCell>
                        <TableCell>{d.deployment_date}</TableCell>
                        <TableCell>
                          {d.gps_latitude && d.gps_longitude ? (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              {Number(d.gps_latitude).toFixed(4)}, {Number(d.gps_longitude).toFixed(4)}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell><StatusBadge status={d.status} /></TableCell>
                        <TableCell className="text-right">
                          {allowedNext.length > 0 ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="icon" variant="ghost">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {allowedNext.map((ns) => (
                                  <DropdownMenuItem key={ns} onClick={() => updateStatus(d, ns)}>
                                    {ns === "verified" && <Shield className="mr-2 h-4 w-4 text-status-success" />}
                                    {ns === "flagged" && <AlertTriangle className="mr-2 h-4 w-4 text-status-danger" />}
                                    {ns === "in_transit" && <Clock className="mr-2 h-4 w-4" />}
                                    {ns === "deployed" && <MapPin className="mr-2 h-4 w-4" />}
                                    Mark as {ns.replace(/_/g, " ")}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {d.status === "verified" ? "✓" : d.status === "flagged" ? "⚠" : "—"}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Deployment Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Deployment</DialogTitle>
            <DialogDescription>Schedule a field deployment with GPS and evidence.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Project */}
            <div className="space-y-2">
              <Label>Project *</Label>
              <Select value={form.project_id} onValueChange={(v) => setForm((f) => ({ ...f, project_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>
                  {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Item & Batch */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Item *</Label>
                <Select
                  value={form.item_id}
                  onValueChange={(v) => setForm((f) => ({ ...f, item_id: v, stock_batch_id: "" }))}
                >
                  <SelectTrigger><SelectValue placeholder="Select item" /></SelectTrigger>
                  <SelectContent>
                    {items.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Stock Batch *</Label>
                <Select
                  value={form.stock_batch_id}
                  onValueChange={(v) => setForm((f) => ({ ...f, stock_batch_id: v }))}
                  disabled={!form.item_id}
                >
                  <SelectTrigger><SelectValue placeholder="Select batch" /></SelectTrigger>
                  <SelectContent>
                    {filteredBatches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.shipments?.supplier || "Batch"} — {b.quantity_available} avail
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.item_id && filteredBatches.length === 0 && (
                  <p className="text-xs text-status-warning">No stock available for this item.</p>
                )}
              </div>
            </div>

            {/* Quantity & Date */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Quantity *</Label>
                <Input
                  type="number"
                  min={1}
                  max={selectedBatch?.quantity_available}
                  value={form.quantity}
                  onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                  placeholder={selectedBatch ? `Max: ${selectedBatch.quantity_available}` : ""}
                />
              </div>
              <div className="space-y-2">
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={form.deployment_date}
                  onChange={(e) => setForm((f) => ({ ...f, deployment_date: e.target.value }))}
                />
              </div>
            </div>

            {/* Location */}
            <div className="space-y-2">
              <Label>Location Name</Label>
              <Input
                value={form.location_name}
                onChange={(e) => setForm((f) => ({ ...f, location_name: e.target.value }))}
                placeholder="e.g. Kibera Community Centre"
              />
            </div>

            {/* GPS */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>GPS Coordinates</Label>
                <Button type="button" size="sm" variant="outline" onClick={captureGPS} disabled={gpsLoading}>
                  {gpsLoading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <MapPin className="mr-1 h-3 w-3" />}
                  {gpsLoading ? "Capturing…" : "Capture GPS"}
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="number"
                  step="any"
                  placeholder="Latitude"
                  value={form.gps_latitude}
                  onChange={(e) => setForm((f) => ({ ...f, gps_latitude: e.target.value }))}
                />
                <Input
                  type="number"
                  step="any"
                  placeholder="Longitude"
                  value={form.gps_longitude}
                  onChange={(e) => setForm((f) => ({ ...f, gps_longitude: e.target.value }))}
                />
              </div>
            </div>

            {/* Evidence Photo */}
            <div className="space-y-2">
              <Label>Evidence Photo</Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById("evidence-upload")?.click()}
                >
                  <Camera className="mr-1 h-3 w-3" />
                  {evidenceFile ? "Change Photo" : "Upload Photo"}
                </Button>
                {evidenceFile && (
                  <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                    {evidenceFile.name}
                  </span>
                )}
              </div>
              <input
                id="evidence-upload"
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => setEvidenceFile(e.target.files?.[0] || null)}
              />
              <p className="text-xs text-muted-foreground">
                GPS-tagged photo evidence for deployment verification.
              </p>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Additional deployment notes..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              onClick={handleCreate}
              disabled={
                saving || uploading ||
                !form.project_id || !form.item_id || !form.stock_batch_id || !form.quantity
              }
            >
              {saving || uploading ? "Creating…" : "Create Deployment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Verify / Flag Dialog */}
      <Dialog open={verifyOpen} onOpenChange={setVerifyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {verifyAction === "verified" ? "Verify Deployment" : "Flag Deployment"}
            </DialogTitle>
            <DialogDescription>
              {verifyTarget?.items?.name} — {verifyTarget?.quantity} units at{" "}
              {verifyTarget?.location_name || "unknown location"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {verifyAction === "flagged" && (
              <Card className="border-status-danger/30 bg-status-danger/5">
                <CardContent className="flex items-center gap-2 py-3">
                  <AlertTriangle className="h-4 w-4 text-status-danger" />
                  <span className="text-sm text-status-danger">
                    Flagging marks this deployment for investigation.
                  </span>
                </CardContent>
              </Card>
            )}
            <div className="space-y-2">
              <Label>Verification Notes {verifyAction === "flagged" ? "*" : ""}</Label>
              <Textarea
                value={verifyNotes}
                onChange={(e) => setVerifyNotes(e.target.value)}
                placeholder={
                  verifyAction === "verified"
                    ? "Confirmed deployment at site..."
                    : "Reason for flagging this deployment..."
                }
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVerifyOpen(false)}>Cancel</Button>
            <Button
              onClick={handleVerify}
              disabled={verifying || (verifyAction === "flagged" && !verifyNotes.trim())}
              variant={verifyAction === "flagged" ? "destructive" : "default"}
            >
              {verifying
                ? "Processing…"
                : verifyAction === "verified"
                  ? "Confirm Verification"
                  : "Flag Deployment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
