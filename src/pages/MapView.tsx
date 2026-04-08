import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { MapPin, Rocket, CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { Tables } from "@/integrations/supabase/types";

type Deployment = Tables<"deployments"> & {
  items?: { name: string } | null;
  projects?: { name: string } | null;
};

const STATUS_COLORS: Record<string, string> = {
  scheduled: "#3b82f6",   // blue
  in_transit: "#f59e0b",  // amber
  deployed: "#22c55e",    // green
  verified: "#16a34a",    // dark green
  flagged: "#ef4444",     // red
};

export default function MapPage() {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");

  const fetchDeployments = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("deployments")
      .select("*, items(name), projects(name)")
      .not("gps_latitude", "is", null)
      .not("gps_longitude", "is", null)
      .order("deployment_date", { ascending: false });
    setDeployments((data || []) as unknown as Deployment[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchDeployments();
  }, [fetchDeployments]);

  const projects = useMemo(() => {
    const names = new Set(deployments.map((d) => d.projects?.name).filter(Boolean) as string[]);
    return [...names].sort();
  }, [deployments]);

  const filtered = deployments.filter((d) => {
    const matchStatus = statusFilter === "all" || d.status === statusFilter;
    const matchProject = projectFilter === "all" || d.projects?.name === projectFilter;
    return matchStatus && matchProject;
  });

  // Compute center from data or default to Africa
  const center = useMemo<[number, number]>(() => {
    if (filtered.length === 0) return [0, 20];
    const avgLat = filtered.reduce((s, d) => s + (d.gps_latitude || 0), 0) / filtered.length;
    const avgLng = filtered.reduce((s, d) => s + (d.gps_longitude || 0), 0) / filtered.length;
    return [avgLat, avgLng];
  }, [filtered]);

  const statusCounts = {
    total: filtered.length,
    deployed: filtered.filter((d) => d.status === "deployed").length,
    verified: filtered.filter((d) => d.status === "verified").length,
    flagged: filtered.filter((d) => d.status === "flagged").length,
  };

  const summaryCards = [
    { title: "On Map", value: statusCounts.total, icon: MapPin, colorClass: "text-primary" },
    { title: "Deployed", value: statusCounts.deployed, icon: Rocket, colorClass: "text-status-success" },
    { title: "Verified", value: statusCounts.verified, icon: CheckCircle2, colorClass: "text-status-success" },
    { title: "Flagged", value: statusCounts.flagged, icon: AlertTriangle, colorClass: "text-status-danger" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Map View</h1>
        <p className="text-muted-foreground">Deployment locations color-coded by status</p>
      </div>

      {/* Summary */}
      <div className="grid gap-3 sm:grid-cols-4">
        {summaryCards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground">{card.title}</CardTitle>
              <card.icon className={cn("h-4 w-4", card.colorClass)} />
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="text-2xl font-bold">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters + Legend */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
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
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Project" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-3 text-xs">
          {Object.entries(STATUS_COLORS).map(([status, color]) => (
            <div key={status} className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
              <span className="capitalize">{status.replace(/_/g, " ")}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Map */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <MapPin className="h-10 w-10 mb-2 opacity-40" />
              <p className="text-sm">No deployments with GPS coordinates found.</p>
              <p className="text-xs">Add GPS locations to deployments to see them on the map.</p>
            </div>
          ) : (
            <div style={{ height: "calc(100vh - 380px)", minHeight: 400 }}>
              <MapContainer
                center={center}
                zoom={filtered.length === 1 ? 10 : 5}
                style={{ height: "100%", width: "100%" }}
                scrollWheelZoom
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {filtered.map((d) => (
                  <CircleMarker
                    key={d.id}
                    center={[d.gps_latitude!, d.gps_longitude!]}
                    radius={8}
                    pathOptions={{
                      color: STATUS_COLORS[d.status] || "#888",
                      fillColor: STATUS_COLORS[d.status] || "#888",
                      fillOpacity: 0.8,
                      weight: 2,
                    }}
                  >
                    <Popup>
                      <div className="text-sm space-y-1 min-w-[180px]">
                        <p className="font-semibold">{d.items?.name || "Unknown Item"}</p>
                        <p className="text-xs text-muted-foreground">{d.projects?.name || "No project"}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-xs">Qty: {d.quantity}</span>
                          <Badge
                            className="text-[10px] capitalize"
                            style={{
                              backgroundColor: STATUS_COLORS[d.status],
                              color: "#fff",
                              border: "none",
                            }}
                          >
                            {d.status.replace(/_/g, " ")}
                          </Badge>
                        </div>
                        {d.location_name && (
                          <p className="text-xs">📍 {d.location_name}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {d.deployment_date} · {d.gps_latitude!.toFixed(5)}, {d.gps_longitude!.toFixed(5)}
                        </p>
                      </div>
                    </Popup>
                  </CircleMarker>
                ))}
              </MapContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
