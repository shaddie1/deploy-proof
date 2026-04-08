import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/StatusBadge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft, Edit, Rocket, Ship, Package, DollarSign, Wrench, ShoppingCart,
} from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { useCurrency } from "@/hooks/useCurrency";

type Project = Tables<"projects">;

interface ProjectDetailProps {
  project: Project;
  canManage: boolean;
  onBack: () => void;
  onEdit: (project: Project) => void;
}

export function ProjectDetail({ project, canManage, onBack, onEdit }: ProjectDetailProps) {
  const [deployments, setDeployments] = useState<any[]>([]);
  const [shipments, setShipments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { formatAmount } = useCurrency();

  const [activeRepairs, setActiveRepairs] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [{ data: deps }, { data: ships }, { data: repairsData }] = await Promise.all([
      supabase
        .from("deployments")
        .select("*, items(name, category)")
        .eq("project_id", project.id)
        .order("deployment_date", { ascending: false }),
      supabase
        .from("shipments")
        .select("*, items(name, category)")
        .eq("project_id", project.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("pcb_repairs")
        .select("id, status")
        .eq("project_id", project.id),
    ]);
    setDeployments(deps || []);
    setShipments(ships || []);
    setActiveRepairs(
      (repairsData || []).filter(
        (r) => r.status !== "completed" && r.status !== "scrapped"
      ).length
    );
    setLoading(false);
  }, [project.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Deployment stats
  const totalDeployed = deployments.reduce((s, d) => s + d.quantity, 0);
  const verified = deployments.filter(d => d.status === "verified").reduce((s, d) => s + d.quantity, 0);
  const pending = deployments.filter(d => d.status === "scheduled" || d.status === "in_transit").reduce((s, d) => s + d.quantity, 0);
  const progress = project.target_quantity > 0
    ? Math.min(100, Math.round((totalDeployed / project.target_quantity) * 100))
    : 0;

  // Shipment / cost stats
  const totalShipmentCost = shipments.reduce((s, sh) => s + (Number(sh.total_cost) || 0), 0);
  const totalShipped = shipments.reduce((s, sh) => s + sh.quantity, 0);

  // Materials breakdown by category
  type MatCat = { qty: number; cost: number; items: string[] };
  const materialsByCategory = shipments.reduce((acc: Record<string, MatCat>, sh: any) => {
    const cat = sh.procurement_category || "other";
    if (!acc[cat]) acc[cat] = { qty: 0, cost: 0, items: [] };
    acc[cat].qty += sh.quantity;
    acc[cat].cost += Number(sh.total_cost) || 0;
    const itemName = sh.items?.name;
    if (itemName && !acc[cat].items.includes(itemName)) acc[cat].items.push(itemName);
    return acc;
  }, {});

  const categoryLabels: Record<string, string> = {
    consumable: "Consumables",
    tool: "Tools",
    pcb_dc: "PCB (DC)",
    pcb_ac: "PCB (AC)",
    other: "Other",
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
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
          <p className="text-muted-foreground">
            {project.country}{project.region ? `, ${project.region}` : ""}
          </p>
        </div>
        {canManage && (
          <Button variant="outline" size="sm" onClick={() => onEdit(project)}>
            <Edit className="mr-1 h-4 w-4" /> Edit
          </Button>
        )}
      </div>

      {project.description && (
        <p className="text-sm text-muted-foreground">{project.description}</p>
      )}

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Deployed</CardTitle>
            <Rocket className="h-4 w-4 text-status-success" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalDeployed}</div>
            <p className="text-xs text-muted-foreground">/ {project.target_quantity} target</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Shipped</CardTitle>
            <Ship className="h-4 w-4 text-status-info" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalShipped}</div>
            <p className="text-xs text-muted-foreground">{shipments.length} shipments</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-status-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatAmount(totalShipmentCost)}</div>
            <p className="text-xs text-muted-foreground">
              {totalShipped > 0 ? `${formatAmount(totalShipmentCost / totalShipped)}/unit avg` : "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Verified</CardTitle>
            <Package className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{verified}</div>
            <p className="text-xs text-muted-foreground">{pending} pending</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Repairs</CardTitle>
            <Wrench className={`h-4 w-4 ${activeRepairs > 0 ? "text-red-500" : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{activeRepairs}</div>
            <p className="text-xs text-muted-foreground">in repair tracker</p>
          </CardContent>
        </Card>
      </div>

      {/* Deployment progress bar */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Deployment Progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Progress value={progress} className="h-3" />
          <p className="text-xs text-muted-foreground text-right">{progress}% complete</p>
        </CardContent>
      </Card>

      {/* Materials breakdown */}
      {Object.keys(materialsByCategory).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" /> Materials Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(materialsByCategory).map(([cat, data]) => {
                  const d = data as MatCat;
                  return (
                    <TableRow key={cat}>
                      <TableCell className="font-medium">{categoryLabels[cat] || cat}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {d.items.join(", ") || "—"}
                      </TableCell>
                      <TableCell className="text-right">{d.qty}</TableCell>
                      <TableCell className="text-right">{formatAmount(d.cost)}</TableCell>
                    </TableRow>
                  );
                })}
                <TableRow className="font-semibold border-t-2">
                  <TableCell>Total</TableCell>
                  <TableCell />
                  <TableCell className="text-right">{totalShipped}</TableCell>
                  <TableCell className="text-right">{formatAmount(totalShipmentCost)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Tabs for Shipments and Deployments */}
      <Tabs defaultValue="shipments">
        <TabsList>
          <TabsTrigger value="shipments">Shipments ({shipments.length})</TabsTrigger>
          <TabsTrigger value="deployments">Deployments ({deployments.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="shipments">
          <Card>
            <CardContent className="pt-6">
              {shipments.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No shipments linked to this project.</p>
              ) : (
                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Supplier</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Unit Price</TableHead>
                        <TableHead className="text-right">Total Cost</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {shipments.map((s: any) => (
                        <TableRow key={s.id}>
                          <TableCell className="font-medium">{s.items?.name || "—"}</TableCell>
                          <TableCell>{s.supplier || "—"}</TableCell>
                          <TableCell>{categoryLabels[s.procurement_category] || s.procurement_category}</TableCell>
                          <TableCell className="text-right">{s.quantity}</TableCell>
                          <TableCell className="text-right">
                            {s.unit_price ? formatAmount(Number(s.unit_price)) : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            {s.total_cost ? formatAmount(Number(s.total_cost)) : "—"}
                          </TableCell>
                          <TableCell><StatusBadge status={s.status} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deployments">
          <Card>
            <CardContent className="pt-6">
              {deployments.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No deployments linked to this project.</p>
              ) : (
                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {deployments.map((d: any) => (
                        <TableRow key={d.id}>
                          <TableCell className="font-medium">{d.items?.name || "—"}</TableCell>
                          <TableCell className="text-right">{d.quantity}</TableCell>
                          <TableCell>
                            {d.location_name || (
                              d.gps_latitude && d.gps_longitude
                                ? `${d.gps_latitude.toFixed(4)}, ${d.gps_longitude.toFixed(4)}`
                                : "—"
                            )}
                          </TableCell>
                          <TableCell>{d.deployment_date}</TableCell>
                          <TableCell><StatusBadge status={d.status} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
