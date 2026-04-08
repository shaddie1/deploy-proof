import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  FileCheck, Search, Image, FileText, Flag, MapPin, Shield, Eye, Download,
  Calendar, User, Hash, AlertTriangle, ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

type EvidenceFile = Tables<"evidence_files"> & {
  projects?: { name: string } | null;
};

export default function EvidencePage() {
  const { user, hasRole } = useAuth();
  const { toast } = useToast();
  const canFlag = hasRole("admin");

  const [files, setFiles] = useState<EvidenceFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [eventFilter, setEventFilter] = useState("all");
  const [flagFilter, setFlagFilter] = useState("all");

  // Preview dialog
  const [previewFile, setPreviewFile] = useState<EvidenceFile | null>(null);

  // Flag dialog
  const [flagOpen, setFlagOpen] = useState(false);
  const [flagTarget, setFlagTarget] = useState<EvidenceFile | null>(null);
  const [flagReason, setFlagReason] = useState("");
  const [flagging, setFlagging] = useState(false);

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("evidence_files")
      .select("*, projects(name)")
      .order("created_at", { ascending: false });
    setFiles((data || []) as unknown as EvidenceFile[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const filtered = files.filter((f) => {
    const matchSearch =
      !searchQuery ||
      f.file_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.sha256_hash.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.linked_entity_type.toLowerCase().includes(searchQuery.toLowerCase());
    const matchEvent = eventFilter === "all" || f.event_type === eventFilter;
    const matchFlag =
      flagFilter === "all" ||
      (flagFilter === "flagged" && f.is_flagged) ||
      (flagFilter === "clean" && !f.is_flagged);
    return matchSearch && matchEvent && matchFlag;
  });

  // Summary counts
  const counts = {
    total: files.length,
    photos: files.filter((f) => f.file_type.startsWith("image")).length,
    documents: files.filter((f) => !f.file_type.startsWith("image")).length,
    flagged: files.filter((f) => f.is_flagged).length,
  };

  const isImage = (fileType: string) =>
    fileType.startsWith("image") || /\.(jpg|jpeg|png|gif|webp)$/i.test(fileType);

  const getPublicUrl = (fileUrl: string) => {
    // If it's already a full URL, return it
    if (fileUrl.startsWith("http")) return fileUrl;
    // Otherwise build the storage URL
    const { data } = supabase.storage.from("evidence").getPublicUrl(fileUrl);
    return data.publicUrl;
  };

  const handleFlag = async () => {
    if (!flagTarget || !flagReason.trim()) return;
    setFlagging(true);

    const { error } = await supabase
      .from("evidence_files")
      .update({ is_flagged: true, flag_reason: flagReason.trim() })
      .eq("id", flagTarget.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "File flagged", description: `${flagTarget.file_name} has been flagged for review.` });
      setFlagOpen(false);
      setFlagTarget(null);
      setFlagReason("");
      fetchFiles();
    }
    setFlagging(false);
  };

  const openFlagDialog = (file: EvidenceFile) => {
    setFlagTarget(file);
    setFlagReason(file.flag_reason || "");
    setFlagOpen(true);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const summaryCards = [
    { title: "Total Files", value: counts.total, icon: FileCheck, colorClass: "text-primary" },
    { title: "Photos", value: counts.photos, icon: Image, colorClass: "text-status-info" },
    { title: "Documents", value: counts.documents, icon: FileText, colorClass: "text-status-success" },
    { title: "Flagged", value: counts.flagged, icon: AlertTriangle, colorClass: "text-status-danger" },
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
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Evidence Vault</h1>
        <p className="text-muted-foreground">
          Tamper-evident repository of all uploaded evidence — photos and documents
        </p>
      </div>

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
            placeholder="Search by filename, hash, or entity..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={eventFilter} onValueChange={setEventFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Event Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Events</SelectItem>
            <SelectItem value="shipment">Shipment</SelectItem>
            <SelectItem value="deployment">Deployment</SelectItem>
            <SelectItem value="audit">Audit</SelectItem>
            <SelectItem value="stock_adjustment">Stock Adjustment</SelectItem>
          </SelectContent>
        </Select>
        <Select value={flagFilter} onValueChange={setFlagFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Flag Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="flagged">Flagged</SelectItem>
            <SelectItem value="clean">Clean</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Evidence Files ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {searchQuery || eventFilter !== "all" || flagFilter !== "all"
                ? "No files match your filters"
                : "No evidence files yet. Files are uploaded during shipment receipts and deployments."}
            </p>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>GPS</TableHead>
                    <TableHead>Uploaded</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((f) => (
                    <TableRow key={f.id} className={cn(f.is_flagged && "bg-destructive/5")}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {isImage(f.file_type) ? (
                            <Image className="h-4 w-4 text-status-info" />
                          ) : (
                            <FileText className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className="max-w-[180px] truncate font-medium text-sm">
                            {f.file_name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs capitalize">
                          {f.event_type.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {f.linked_entity_type}
                      </TableCell>
                      <TableCell className="text-sm">
                        {f.projects?.name || "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatFileSize(f.file_size)}
                      </TableCell>
                      <TableCell>
                        {f.gps_latitude && f.gps_longitude ? (
                          <span className="flex items-center gap-1 text-xs text-status-success">
                            <MapPin className="h-3 w-3" />
                            Yes
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(f.created_at)}
                      </TableCell>
                      <TableCell>
                        {f.is_flagged ? (
                          <Badge className="bg-status-danger text-status-danger-foreground border-transparent text-xs">
                            <Flag className="mr-1 h-3 w-3" /> Flagged
                          </Badge>
                        ) : (
                          <Badge className="bg-status-success text-status-success-foreground border-transparent text-xs">
                            <Shield className="mr-1 h-3 w-3" /> Clean
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Preview"
                            onClick={() => setPreviewFile(f)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Download"
                            asChild
                          >
                            <a
                              href={getPublicUrl(f.file_url)}
                              target="_blank"
                              rel="noopener noreferrer"
                              download={f.file_name}
                            >
                              <Download className="h-4 w-4" />
                            </a>
                          </Button>
                          {canFlag && !f.is_flagged && (
                            <Button
                              size="icon"
                              variant="ghost"
                              title="Flag for review"
                              onClick={() => openFlagDialog(f)}
                              className="text-status-warning hover:text-status-danger"
                            >
                              <Flag className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={!!previewFile} onOpenChange={(open) => !open && setPreviewFile(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          {previewFile && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {isImage(previewFile.file_type) ? (
                    <Image className="h-5 w-5 text-status-info" />
                  ) : (
                    <FileText className="h-5 w-5 text-muted-foreground" />
                  )}
                  {previewFile.file_name}
                </DialogTitle>
                <DialogDescription>
                  Uploaded {formatDate(previewFile.created_at)}
                </DialogDescription>
              </DialogHeader>

              {/* File preview */}
              {isImage(previewFile.file_type) && (
                <div className="rounded-lg border overflow-hidden bg-muted">
                  <img
                    src={getPublicUrl(previewFile.file_url)}
                    alt={previewFile.file_name}
                    className="w-full max-h-[400px] object-contain"
                  />
                </div>
              )}

              {!isImage(previewFile.file_type) && (
                <div className="flex flex-col items-center gap-3 rounded-lg border bg-muted p-8">
                  <FileText className="h-12 w-12 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Document preview not available</p>
                  <Button variant="outline" size="sm" asChild>
                    <a
                      href={getPublicUrl(previewFile.file_url)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="mr-1 h-4 w-4" /> Open File
                    </a>
                  </Button>
                </div>
              )}

              {/* Metadata grid */}
              <div className="grid gap-3 sm:grid-cols-2">
                <DetailRow icon={Hash} label="SHA-256 Hash">
                  <code className="break-all rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                    {previewFile.sha256_hash}
                  </code>
                </DetailRow>
                <DetailRow icon={FileText} label="File Type">
                  {previewFile.file_type}
                </DetailRow>
                <DetailRow icon={Calendar} label="Event Type">
                  <Badge variant="outline" className="capitalize">
                    {previewFile.event_type.replace(/_/g, " ")}
                  </Badge>
                </DetailRow>
                <DetailRow icon={FileCheck} label="Linked Entity">
                  {previewFile.linked_entity_type} ({previewFile.linked_entity_id.slice(0, 8)}…)
                </DetailRow>
                <DetailRow icon={User} label="Uploaded By">
                  {previewFile.uploaded_by.slice(0, 8)}…
                </DetailRow>
                <DetailRow icon={FileText} label="Size">
                  {formatFileSize(previewFile.file_size)}
                </DetailRow>
                {previewFile.gps_latitude && previewFile.gps_longitude && (
                  <DetailRow icon={MapPin} label="GPS Coordinates">
                    <span className="text-xs font-mono">
                      {previewFile.gps_latitude.toFixed(6)}, {previewFile.gps_longitude.toFixed(6)}
                    </span>
                  </DetailRow>
                )}
                {previewFile.projects?.name && (
                  <DetailRow icon={FileCheck} label="Project">
                    {previewFile.projects.name}
                  </DetailRow>
                )}
              </div>

              {/* Flag status */}
              {previewFile.is_flagged && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                    <Flag className="h-4 w-4" /> Flagged for Review
                  </div>
                  {previewFile.flag_reason && (
                    <p className="mt-1 text-sm text-muted-foreground">{previewFile.flag_reason}</p>
                  )}
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Flag Dialog */}
      <Dialog open={flagOpen} onOpenChange={setFlagOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Flag Evidence File</DialogTitle>
            <DialogDescription>
              Flag "{flagTarget?.file_name}" for review. Files cannot be deleted — only flagged.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Reason for Flagging *</Label>
              <Textarea
                value={flagReason}
                onChange={(e) => setFlagReason(e.target.value)}
                placeholder="Describe the issue with this evidence file..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFlagOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleFlag}
              disabled={flagging || !flagReason.trim()}
            >
              {flagging ? "Flagging…" : "Flag File"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2 rounded-md border bg-card p-2.5">
      <Icon className="mt-0.5 h-4 w-4 text-muted-foreground shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="text-sm">{children}</div>
      </div>
    </div>
  );
}
