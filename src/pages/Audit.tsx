import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ScrollText, Search, Eye, Clock, Plus, Edit, Trash2, RefreshCw, ArrowRightLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

type AuditEntry = Tables<"audit_log"> & {
  profiles?: { full_name: string; email: string | null } | null;
};

const ACTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  create: Plus,
  insert: Plus,
  update: Edit,
  delete: Trash2,
  status_change: RefreshCw,
};

const ACTION_COLORS: Record<string, string> = {
  create: "bg-status-success text-status-success-foreground border-transparent",
  insert: "bg-status-success text-status-success-foreground border-transparent",
  update: "bg-status-info text-status-info-foreground border-transparent",
  delete: "bg-status-danger text-status-danger-foreground border-transparent",
  status_change: "bg-status-warning text-status-warning-foreground border-transparent",
};

const ENTITY_TYPES = [
  "shipment", "deployment", "stock_batch", "stock_adjustment",
  "project", "item", "evidence_file", "user_role",
];

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [entityFilter, setEntityFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");

  // Detail dialog
  const [detailEntry, setDetailEntry] = useState<AuditEntry | null>(null);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("audit_log")
      .select("*, profiles:user_id(full_name, email)")
      .order("created_at", { ascending: false })
      .limit(500);
    setEntries((data || []) as unknown as AuditEntry[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const filtered = entries.filter((e) => {
    const q = searchQuery.toLowerCase();
    const matchSearch =
      !searchQuery ||
      e.action.toLowerCase().includes(q) ||
      e.entity_type.toLowerCase().includes(q) ||
      e.entity_id.toLowerCase().includes(q) ||
      (e.profiles?.full_name || "").toLowerCase().includes(q) ||
      (e.profiles?.email || "").toLowerCase().includes(q);
    const matchEntity = entityFilter === "all" || e.entity_type === entityFilter;
    const matchAction = actionFilter === "all" || e.action.toLowerCase().includes(actionFilter);
    return matchSearch && matchEntity && matchAction;
  });

  const uniqueActions = [...new Set(entries.map((e) => e.action))];

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleString("en-US", {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });

  const renderJsonDiff = (before: unknown, after: unknown) => {
    const beforeObj = (before && typeof before === "object" ? before : {}) as Record<string, unknown>;
    const afterObj = (after && typeof after === "object" ? after : {}) as Record<string, unknown>;
    const allKeys = [...new Set([...Object.keys(beforeObj), ...Object.keys(afterObj)])];

    if (allKeys.length === 0) {
      return <p className="text-xs text-muted-foreground italic">No data recorded</p>;
    }

    return (
      <div className="space-y-1">
        {allKeys.map((key) => {
          const bVal = JSON.stringify(beforeObj[key] ?? null);
          const aVal = JSON.stringify(afterObj[key] ?? null);
          const changed = bVal !== aVal;
          return (
            <div key={key} className={cn("rounded px-2 py-1 text-xs font-mono", changed ? "bg-status-warning/10" : "")}>
              <span className="font-semibold text-foreground">{key}:</span>{" "}
              {before !== null && before !== undefined && (
                <span className={cn(changed ? "line-through text-status-danger" : "text-muted-foreground")}>
                  {bVal}
                </span>
              )}
              {changed && after !== null && after !== undefined && (
                <>
                  {" → "}
                  <span className="text-status-success">{aVal}</span>
                </>
              )}
              {!changed && (
                <span className="text-muted-foreground">{aVal}</span>
              )}
            </div>
          );
        })}
      </div>
    );
  };

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
        <h1 className="text-2xl font-bold tracking-tight">Audit Trail</h1>
        <p className="text-muted-foreground">
          Immutable log of every action — who did what, when, and what changed
        </p>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Entries</CardTitle>
            <ScrollText className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent><div className="text-3xl font-bold">{entries.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Entity Types</CardTitle>
            <ArrowRightLeft className="h-4 w-4 text-status-info" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {new Set(entries.map((e) => e.entity_type)).size}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Unique Users</CardTitle>
            <Clock className="h-4 w-4 text-status-success" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {new Set(entries.map((e) => e.user_id)).size}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by action, entity, user..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={entityFilter} onValueChange={setEntityFilter}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Entity Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Entities</SelectItem>
            {ENTITY_TYPES.map((t) => (
              <SelectItem key={t} value={t} className="capitalize">
                {t.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            {uniqueActions.map((a) => (
              <SelectItem key={a} value={a}>{a.replace(/_/g, " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Log Entries ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {searchQuery || entityFilter !== "all" || actionFilter !== "all"
                ? "No entries match your filters"
                : "No audit entries recorded yet."}
            </p>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Entity ID</TableHead>
                    <TableHead className="text-right">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((entry) => {
                    const ActionIcon = ACTION_ICONS[entry.action] || RefreshCw;
                    const actionColor = ACTION_COLORS[entry.action] || "";
                    return (
                      <TableRow key={entry.id}>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(entry.created_at)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {entry.profiles?.full_name || entry.profiles?.email || entry.user_id.slice(0, 8) + "…"}
                        </TableCell>
                        <TableCell>
                          <Badge className={cn("text-xs capitalize gap-1", actionColor)}>
                            <ActionIcon className="h-3 w-3" />
                            {entry.action.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs capitalize">
                            {entry.entity_type.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground">
                          {entry.entity_id.slice(0, 8)}…
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="icon" variant="ghost" onClick={() => setDetailEntry(entry)}>
                            <Eye className="h-4 w-4" />
                          </Button>
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

      {/* Detail Dialog */}
      <Dialog open={!!detailEntry} onOpenChange={(open) => !open && setDetailEntry(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          {detailEntry && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ScrollText className="h-5 w-5 text-primary" />
                  Audit Entry Detail
                </DialogTitle>
              </DialogHeader>

              <div className="grid gap-3 sm:grid-cols-2">
                <InfoRow label="Timestamp">{formatDate(detailEntry.created_at)}</InfoRow>
                <InfoRow label="User">
                  {detailEntry.profiles?.full_name || detailEntry.profiles?.email || detailEntry.user_id}
                </InfoRow>
                <InfoRow label="Action">
                  <Badge className={cn("text-xs capitalize", ACTION_COLORS[detailEntry.action] || "")}>
                    {detailEntry.action.replace(/_/g, " ")}
                  </Badge>
                </InfoRow>
                <InfoRow label="Entity Type">
                  <Badge variant="outline" className="capitalize text-xs">
                    {detailEntry.entity_type.replace(/_/g, " ")}
                  </Badge>
                </InfoRow>
                <InfoRow label="Entity ID" className="sm:col-span-2">
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono break-all">
                    {detailEntry.entity_id}
                  </code>
                </InfoRow>
              </div>

              {/* Before / After */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Changes</h3>
                {detailEntry.before_data || detailEntry.after_data ? (
                  renderJsonDiff(detailEntry.before_data, detailEntry.after_data)
                ) : (
                  <p className="text-xs text-muted-foreground italic">No before/after data recorded for this entry.</p>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoRow({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-md border bg-card p-2.5", className)}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="text-sm mt-0.5">{children}</div>
    </div>
  );
}
