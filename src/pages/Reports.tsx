import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  BarChart3, Download, FileText, Ship, Warehouse, Rocket, Link2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      headers.map((h) => {
        const val = row[h];
        const str = val === null || val === undefined ? "" : String(val);
        return str.includes(",") || str.includes('"') || str.includes("\n")
          ? `"${str.replace(/"/g, '""')}"`
          : str;
      }).join(",")
    ),
  ];
  return lines.join("\n");
}

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const { toast } = useToast();
  const [exporting, setExporting] = useState<string | null>(null);

  // Date filters
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Chain-of-custody
  const [cocBatchId, setCocBatchId] = useState("");
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const exportShipments = async () => {
    setExporting("shipments");
    let query = supabase.from("shipments").select("*, items(name, category)").order("created_at", { ascending: false });
    if (dateFrom) query = query.gte("created_at", dateFrom);
    if (dateTo) query = query.lte("created_at", dateTo + "T23:59:59");
    if (statusFilter !== "all") query = query.eq("status", statusFilter as any);

    const { data, error } = await query;
    if (error || !data?.length) {
      toast({ title: error ? "Error" : "No data", description: error?.message || "No shipments match the filters.", variant: "destructive" });
      setExporting(null);
      return;
    }

    const rows = data.map((s: any) => ({
      id: s.id,
      item: s.items?.name || "",
      category: s.items?.category || "",
      quantity: s.quantity,
      supplier: s.supplier,
      origin_country: s.origin_country,
      status: s.status,
      expected_arrival: s.expected_arrival || "",
      actual_arrival: s.actual_arrival || "",
      created_at: s.created_at,
    }));

    downloadCsv(toCsv(rows), `shipments_${new Date().toISOString().split("T")[0]}.csv`);
    toast({ title: "Exported", description: `${rows.length} shipments exported to CSV.` });
    setExporting(null);
  };

  const exportStock = async () => {
    setExporting("stock");
    const { data, error } = await supabase
      .from("stock_batches")
      .select("*, items(name, category), shipments(supplier, origin_country)")
      .order("created_at", { ascending: false });

    if (error || !data?.length) {
      toast({ title: error ? "Error" : "No data", description: error?.message || "No stock batches found.", variant: "destructive" });
      setExporting(null);
      return;
    }

    const rows = data.map((b: any) => ({
      id: b.id,
      item: b.items?.name || "",
      category: b.items?.category || "",
      quantity_received: b.quantity_received,
      quantity_available: b.quantity_available,
      quantity_deployed: b.quantity_deployed,
      condition: b.condition,
      supplier: b.shipments?.supplier || "",
      origin: b.shipments?.origin_country || "",
      created_at: b.created_at,
    }));

    downloadCsv(toCsv(rows), `stock_${new Date().toISOString().split("T")[0]}.csv`);
    toast({ title: "Exported", description: `${rows.length} stock batches exported to CSV.` });
    setExporting(null);
  };

  const exportDeployments = async () => {
    setExporting("deployments");
    let query = supabase.from("deployments").select("*, items(name), projects(name)").order("created_at", { ascending: false });
    if (dateFrom) query = query.gte("deployment_date", dateFrom);
    if (dateTo) query = query.lte("deployment_date", dateTo);
    if (statusFilter !== "all") query = query.eq("status", statusFilter as any);

    const { data, error } = await query;
    if (error || !data?.length) {
      toast({ title: error ? "Error" : "No data", description: error?.message || "No deployments match the filters.", variant: "destructive" });
      setExporting(null);
      return;
    }

    const rows = data.map((d: any) => ({
      id: d.id,
      item: d.items?.name || "",
      project: d.projects?.name || "",
      quantity: d.quantity,
      status: d.status,
      deployment_date: d.deployment_date,
      location_name: d.location_name || "",
      gps_latitude: d.gps_latitude || "",
      gps_longitude: d.gps_longitude || "",
      verified_at: d.verified_at || "",
      created_at: d.created_at,
    }));

    downloadCsv(toCsv(rows), `deployments_${new Date().toISOString().split("T")[0]}.csv`);
    toast({ title: "Exported", description: `${rows.length} deployments exported to CSV.` });
    setExporting(null);
  };

  const generateChainOfCustody = async () => {
    if (!cocBatchId.trim()) {
      toast({ title: "Enter a batch ID", description: "Paste a stock batch UUID to generate the report.", variant: "destructive" });
      return;
    }
    setGeneratingPdf(true);

    const { data, error } = await supabase.functions.invoke("generate-coc-report", {
      body: { batch_id: cocBatchId.trim() },
    });

    if (error) {
      toast({ title: "Error", description: error.message || "Failed to generate report.", variant: "destructive" });
      setGeneratingPdf(false);
      return;
    }

    // Open the HTML report in a new tab for print/save as PDF
    const blob = new Blob([data], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    toast({ title: "Report generated", description: "Use your browser's Print → Save as PDF to export." });
    setGeneratingPdf(false);
  };

  const reports = [
    {
      title: "Shipments Export",
      description: "Export all shipments with item details, supplier, status, and dates as CSV.",
      icon: Ship,
      action: exportShipments,
      key: "shipments",
      filterable: true,
    },
    {
      title: "Stock Batches Export",
      description: "Export warehouse stock with quantities, condition, origin shipment details.",
      icon: Warehouse,
      action: exportStock,
      key: "stock",
      filterable: false,
    },
    {
      title: "Deployments Export",
      description: "Export deployments with project, GPS, status, and verification info.",
      icon: Rocket,
      action: exportDeployments,
      key: "deployments",
      filterable: true,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
        <p className="text-muted-foreground">Export data for analysis and generate MRV submission reports</p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
          <CardDescription>Apply date and status filters to CSV exports</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="space-y-1.5">
              <Label className="text-xs">From Date</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-[160px]" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">To Date</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-[160px]" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="ordered">Ordered</SelectItem>
                  <SelectItem value="in_transit">In Transit</SelectItem>
                  <SelectItem value="customs">Customs</SelectItem>
                  <SelectItem value="received">Received</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="deployed">Deployed</SelectItem>
                  <SelectItem value="verified">Verified</SelectItem>
                  <SelectItem value="flagged">Flagged</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(dateFrom || dateTo || statusFilter !== "all") && (
              <Button variant="ghost" size="sm" onClick={() => { setDateFrom(""); setDateTo(""); setStatusFilter("all"); }}>
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* CSV Exports */}
      <div className="grid gap-4 sm:grid-cols-3">
        {reports.map((report) => (
          <Card key={report.key}>
            <CardHeader className="flex flex-row items-start gap-3 pb-2">
              <report.icon className="mt-0.5 h-5 w-5 text-primary shrink-0" />
              <div>
                <CardTitle className="text-sm">{report.title}</CardTitle>
                <CardDescription className="text-xs mt-1">{report.description}</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <Button
                size="sm"
                className="w-full"
                onClick={report.action}
                disabled={exporting === report.key}
              >
                <Download className="mr-1 h-4 w-4" />
                {exporting === report.key ? "Exporting…" : "Export CSV"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Chain-of-Custody PDF */}
      <Card>
        <CardHeader className="flex flex-row items-start gap-3">
          <Link2 className="mt-0.5 h-5 w-5 text-primary shrink-0" />
          <div>
            <CardTitle className="text-base">Chain-of-Custody Report</CardTitle>
            <CardDescription>
              Generate a verifiable PDF-ready report for a specific stock batch — shows the full lifecycle
              from shipment origin to field deployment with SHA-256 evidence hashes.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1.5">
              <Label className="text-xs">Stock Batch ID</Label>
              <Input
                value={cocBatchId}
                onChange={(e) => setCocBatchId(e.target.value)}
                placeholder="Paste a stock batch UUID..."
                className="font-mono text-sm"
              />
            </div>
            <Button onClick={generateChainOfCustody} disabled={generatingPdf || !cocBatchId.trim()}>
              <FileText className="mr-1 h-4 w-4" />
              {generatingPdf ? "Generating…" : "Generate Report"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
