import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Package, Warehouse, Rocket, Clock, Wrench, Plus, Search, FolderOpen } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { ProjectStatCard, type ProjectStats } from "@/components/ProjectStatCard";

interface ProjectWithStats {
  id: string;
  name: string;
  country: string;
  region: string | null;
  target_quantity: number;
  description: string | null;
  stats: ProjectStats;
}

export default function Index() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      const [
        { data: projectsData },
        { data: shipmentsData },
        { data: stockData },
        { data: deploymentsData },
        { data: repairsData },
      ] = await Promise.all([
        supabase
          .from("projects")
          .select("id, name, country, region, target_quantity, description")
          .order("created_at", { ascending: false }),
        supabase
          .from("shipments")
          .select("id, project_id, quantity, status")
          .not("project_id", "is", null),
        supabase.from("stock_batches").select("shipment_id, quantity_available"),
        supabase.from("deployments").select("project_id, quantity, status"),
        supabase
          .from("pcb_repairs")
          .select("project_id, status")
          .not("project_id", "is", null),
      ]);

      if (!projectsData) {
        setLoading(false);
        return;
      }

      // Build shipment -> project lookup for the warehouse join
      const shipmentProjectMap = new Map<string, string>();
      (shipmentsData || []).forEach((s) => {
        if (s.project_id) shipmentProjectMap.set(s.id, s.project_id);
      });

      // Initialize per-project stats
      const statsMap = new Map<string, ProjectStats>();
      projectsData.forEach((p) => {
        statsMap.set(p.id, {
          totalProcured: 0,
          inWarehouse: 0,
          deployed: 0,
          pending: 0,
          repairCount: 0,
        });
      });

      // Total Procured: shipments with received/partial status
      (shipmentsData || []).forEach((s) => {
        if (!s.project_id) return;
        const entry = statsMap.get(s.project_id);
        if (!entry) return;
        if (s.status === "received" || s.status === "partial") {
          entry.totalProcured += s.quantity;
        }
      });

      // In Warehouse: stock_batches -> shipments -> project chain
      (stockData || []).forEach((b) => {
        const projectId = shipmentProjectMap.get(b.shipment_id);
        if (!projectId) return;
        const entry = statsMap.get(projectId);
        if (!entry) return;
        entry.inWarehouse += b.quantity_available;
      });

      // Deployed and Pending from deployments table
      (deploymentsData || []).forEach((d) => {
        if (!d.project_id) return;
        const entry = statsMap.get(d.project_id);
        if (!entry) return;
        if (d.status === "deployed" || d.status === "verified") {
          entry.deployed += d.quantity;
        } else if (d.status === "scheduled" || d.status === "in_transit") {
          entry.pending += d.quantity;
        }
      });

      // Active repairs per project (exclude completed and scrapped)
      (repairsData || []).forEach((r) => {
        if (!r.project_id) return;
        const entry = statsMap.get(r.project_id);
        if (!entry) return;
        if (r.status !== "completed" && r.status !== "scrapped") {
          entry.repairCount += 1;
        }
      });

      setProjects(
        projectsData.map((p) => ({
          ...p,
          stats: statsMap.get(p.id) || {
            totalProcured: 0,
            inWarehouse: 0,
            deployed: 0,
            pending: 0,
            repairCount: 0,
          },
        }))
      );
      setLoading(false);
    };

    fetchData();
  }, []);

  const filtered = projects.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.country.toLowerCase().includes(q) ||
      (p.region || "").toLowerCase().includes(q)
    );
  });

  // Global summary across all projects
  const global = projects.reduce(
    (acc, p) => ({
      totalProcured: acc.totalProcured + p.stats.totalProcured,
      inWarehouse: acc.inWarehouse + p.stats.inWarehouse,
      deployed: acc.deployed + p.stats.deployed,
      pending: acc.pending + p.stats.pending,
      repairCount: acc.repairCount + p.stats.repairCount,
    }),
    { totalProcured: 0, inWarehouse: 0, deployed: 0, pending: 0, repairCount: 0 }
  );

  const globalStats = [
    { label: "Total Procured", value: global.totalProcured, icon: Package, color: "text-blue-500" },
    { label: "In Warehouse", value: global.inWarehouse, icon: Warehouse, color: "text-green-500" },
    { label: "Deployed", value: global.deployed, icon: Rocket, color: "text-primary" },
    { label: "Pending", value: global.pending, icon: Clock, color: "text-amber-500" },
    {
      label: "Active Repairs",
      value: global.repairCount,
      icon: Wrench,
      color: global.repairCount > 0 ? "text-red-500" : "text-muted-foreground",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Overview of your projects and deployments</p>
        </div>
        <div className="flex gap-2">
          <Button asChild size="sm">
            <Link to="/shipments">
              <Plus className="mr-1 h-4 w-4" /> Log Shipment
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/deployments">
              <Rocket className="mr-1 h-4 w-4" /> Log Deployment
            </Link>
          </Button>
        </div>
      </div>

      {/* Global summary bar */}
      <div className="grid grid-cols-5 gap-3">
        {globalStats.map((stat) => (
          <div
            key={stat.label}
            className="flex flex-col items-center rounded-lg border bg-card p-3 text-center shadow-sm"
          >
            <stat.icon className={`mb-1 h-4 w-4 ${stat.color}`} />
            <span className="text-lg font-bold">{stat.value}</span>
            <span className="text-xs text-muted-foreground">{stat.label}</span>
          </div>
        ))}
      </div>

      {/* Search + view all */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search projects by name, country, or region..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/projects">
            <FolderOpen className="mr-1 h-4 w-4" /> All Projects
          </Link>
        </Button>
      </div>

      {/* Project cards */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border bg-card py-12 text-center">
          <p className="text-sm text-muted-foreground">
            {search
              ? "No projects match your search."
              : "No projects yet. Create one from the Projects page."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((project) => (
            <ProjectStatCard
              key={project.id}
              project={project}
              stats={project.stats}
              onClick={() => navigate("/projects", { state: { openProjectId: project.id } })}
            />
          ))}
        </div>
      )}
    </div>
  );
}
