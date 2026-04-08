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
  Warehouse, AlertTriangle, Package, ArrowDownUp, Search, Plus, Minus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { logAudit } from "@/lib/auditLog";
import { useToast } from "@/hooks/use-toast";

interface StockBatchRow {
  id: string;
  item_id: string;
  shipment_id: string;
  quantity_received: number;
  quantity_available: number;
  quantity_deployed: number;
  condition: string | null;
  notes: string | null;
  created_at: string;
  items: { name: string; category: string; unit_of_measure: string } | null;
  shipments: { supplier: string; origin_country: string } | null;
}

interface StockSummary {
  totalItems: number;
  totalAvailable: number;
  totalDeployed: number;
  lowStockCount: number;
}

interface LowStockItem {
  id: string;
  name: string;
  available: number;
  threshold: number;
}

export default function WarehousePage() {
  const { user, hasRole } = useAuth();
  const { toast } = useToast();
  const [batches, setBatches] = useState<StockBatchRow[]>([]);
  const [summary, setSummary] = useState<StockSummary>({ totalItems: 0, totalAvailable: 0, totalDeployed: 0, lowStockCount: 0 });
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [conditionFilter, setConditionFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  // Adjustment dialog
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<StockBatchRow | null>(null);
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjusting, setAdjusting] = useState(false);

  const canManage = hasRole("admin") || hasRole("warehouse_manager");

  const fetchData = useCallback(async () => {
    setLoading(true);

    // Fetch stock batches with joins
    const { data: batchData } = await supabase
      .from("stock_batches")
      .select("*, items(name, category, unit_of_measure), shipments(supplier, origin_country)")
      .order("created_at", { ascending: false });

    const rows = (batchData || []) as unknown as StockBatchRow[];
    setBatches(rows);

    // Summary
    const totalAvailable = rows.reduce((s, b) => s + b.quantity_available, 0);
    const totalDeployed = rows.reduce((s, b) => s + b.quantity_deployed, 0);

    // Low stock check
    const { data: items } = await supabase.from("items").select("id, name, low_stock_threshold");
    const lowItems: LowStockItem[] = [];
    if (items) {
      for (const item of items) {
        const available = rows
          .filter((b) => b.item_id === item.id)
          .reduce((s, b) => s + b.quantity_available, 0);
        if (available <= item.low_stock_threshold) {
          lowItems.push({ id: item.id, name: item.name, available, threshold: item.low_stock_threshold });
        }
      }
    }
    setLowStockItems(lowItems);

    setSummary({
      totalItems: items?.length || 0,
      totalAvailable,
      totalDeployed,
      lowStockCount: lowItems.length,
    });

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredBatches = batches.filter((b) => {
    const matchesSearch =
      !searchQuery ||
      b.items?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.shipments?.supplier?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCondition = conditionFilter === "all" || b.condition === conditionFilter;
    return matchesSearch && matchesCondition;
  });

  const handleAdjust = async () => {
    if (!selectedBatch || !user || !adjustQty || !adjustReason.trim()) return;
    const qty = parseInt(adjustQty, 10);
    if (isNaN(qty) || qty === 0) return;

    const newAvailable = selectedBatch.quantity_available + qty;
    if (newAvailable < 0) {
      toast({ title: "Error", description: "Cannot reduce below 0.", variant: "destructive" });
      return;
    }

    setAdjusting(true);

    // Insert adjustment record
    const { error: adjError } = await supabase.from("stock_adjustments").insert({
      stock_batch_id: selectedBatch.id,
      quantity_change: qty,
      reason: adjustReason.trim(),
      adjusted_by: user.id,
    });

    if (adjError) {
      toast({ title: "Error", description: adjError.message, variant: "destructive" });
      setAdjusting(false);
      return;
    }

    // Update batch available quantity
    const { error: batchError } = await supabase
      .from("stock_batches")
      .update({ quantity_available: newAvailable })
      .eq("id", selectedBatch.id);

    if (batchError) {
      toast({ title: "Error", description: batchError.message, variant: "destructive" });
    } else {
      logAudit({ userId: user.id, action: "stock_adjustment", entityType: "stock_batch", entityId: selectedBatch.id, beforeData: { quantity_available: selectedBatch.quantity_available }, afterData: { quantity_available: newAvailable, change: qty, reason: adjustReason.trim() } });
      toast({ title: "Stock adjusted", description: `${qty > 0 ? "+" : ""}${qty} units applied.` });
      setAdjustDialogOpen(false);
      setAdjustQty("");
      setAdjustReason("");
      setSelectedBatch(null);
      fetchData();
    }
    setAdjusting(false);
  };

  const openAdjustDialog = (batch: StockBatchRow) => {
    setSelectedBatch(batch);
    setAdjustQty("");
    setAdjustReason("");
    setAdjustDialogOpen(true);
  };

  const summaryCards = [
    { title: "Item Types", value: summary.totalItems, icon: Package, colorClass: "text-primary" },
    { title: "Available Stock", value: summary.totalAvailable, icon: Warehouse, colorClass: "text-status-success" },
    { title: "Deployed", value: summary.totalDeployed, icon: ArrowDownUp, colorClass: "text-status-info" },
    {
      title: "Low Stock Alerts",
      value: summary.lowStockCount,
      icon: AlertTriangle,
      colorClass: summary.lowStockCount > 0 ? "text-status-danger" : "text-muted-foreground",
    },
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
        <h1 className="text-2xl font-bold tracking-tight">Warehouse</h1>
        <p className="text-muted-foreground">Live inventory and stock batch management</p>
      </div>

      {/* Summary Cards */}
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

      {/* Low Stock Alerts */}
      {lowStockItems.length > 0 && (
        <Card className="border-status-danger/30 bg-status-danger/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-status-danger">
              <AlertTriangle className="h-4 w-4" />
              Low Stock Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {lowStockItems.map((item) => (
                <Badge key={item.id} variant="outline" className="border-status-danger/40 text-status-danger">
                  {item.name}: {item.available} / {item.threshold} threshold
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by item or supplier..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={conditionFilter} onValueChange={setConditionFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Condition" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Conditions</SelectItem>
            <SelectItem value="good">Good</SelectItem>
            <SelectItem value="damaged">Damaged</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stock Batches Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Stock Batches ({filteredBatches.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredBatches.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {searchQuery || conditionFilter !== "all" ? "No batches match your filters" : "No stock batches yet. Receive a shipment to create stock."}
            </p>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead className="text-right">Received</TableHead>
                    <TableHead className="text-right">Available</TableHead>
                    <TableHead className="text-right">Deployed</TableHead>
                    <TableHead>Condition</TableHead>
                    {canManage && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBatches.map((batch) => {
                    const isLow =
                      lowStockItems.some((li) => li.id === batch.item_id) && batch.quantity_available > 0;
                    return (
                      <TableRow key={batch.id}>
                        <TableCell className="font-medium">{batch.items?.name || "—"}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="capitalize">
                            {batch.items?.category?.replace(/_/g, " ") || "—"}
                          </Badge>
                        </TableCell>
                        <TableCell>{batch.shipments?.supplier || "—"}</TableCell>
                        <TableCell className="text-right">{batch.quantity_received}</TableCell>
                        <TableCell className={cn("text-right font-semibold", isLow && "text-status-danger")}>
                          {batch.quantity_available}
                        </TableCell>
                        <TableCell className="text-right">{batch.quantity_deployed}</TableCell>
                        <TableCell>
                          <ConditionBadge condition={batch.condition} />
                        </TableCell>
                        {canManage && (
                          <TableCell className="text-right">
                            <Button size="sm" variant="outline" onClick={() => openAdjustDialog(batch)}>
                              <ArrowDownUp className="mr-1 h-3 w-3" /> Adjust
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Adjustment Dialog */}
      <Dialog open={adjustDialogOpen} onOpenChange={setAdjustDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Stock</DialogTitle>
            <DialogDescription>
              {selectedBatch?.items?.name} — Currently {selectedBatch?.quantity_available} available
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Quantity Change</Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={() => setAdjustQty((prev) => String((parseInt(prev) || 0) - 1))}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Input
                  type="number"
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(e.target.value)}
                  placeholder="e.g. -5 or +10"
                  className="text-center"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={() => setAdjustQty((prev) => String((parseInt(prev) || 0) + 1))}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Use negative values to reduce, positive to add.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Reason *</Label>
              <Textarea
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="e.g. Damaged units removed, stock count correction..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAdjust}
              disabled={adjusting || !adjustQty || parseInt(adjustQty) === 0 || !adjustReason.trim()}
            >
              {adjusting ? "Applying…" : "Apply Adjustment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ConditionBadge({ condition }: { condition: string | null }) {
  const c = condition || "good";
  const styles: Record<string, string> = {
    good: "bg-status-success/10 text-status-success border-status-success/30",
    damaged: "bg-status-danger/10 text-status-danger border-status-danger/30",
    expired: "bg-status-warning/10 text-status-warning border-status-warning/30",
  };
  return (
    <Badge variant="outline" className={cn("capitalize", styles[c] || "")}>
      {c}
    </Badge>
  );
}
