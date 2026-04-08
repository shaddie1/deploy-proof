import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { MapPin, Package, Warehouse, Rocket, Clock, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ProjectStats {
  totalProcured: number;
  inWarehouse: number;
  deployed: number;
  pending: number;
  repairCount: number;
}

interface ProjectStatCardProps {
  project: {
    id: string;
    name: string;
    country: string;
    region: string | null;
    target_quantity: number;
    description?: string | null;
  };
  stats: ProjectStats;
  onClick: () => void;
}

export function ProjectStatCard({ project, stats, onClick }: ProjectStatCardProps) {
  const progress =
    project.target_quantity > 0
      ? Math.min(100, Math.round((stats.deployed / project.target_quantity) * 100))
      : 0;

  const statItems = [
    { label: "Procured", value: stats.totalProcured, icon: Package, color: "text-blue-500" },
    { label: "Warehouse", value: stats.inWarehouse, icon: Warehouse, color: "text-green-500" },
    { label: "Deployed", value: stats.deployed, icon: Rocket, color: "text-primary" },
    { label: "Pending", value: stats.pending, icon: Clock, color: "text-amber-500" },
    {
      label: "Repairs",
      value: stats.repairCount,
      icon: Wrench,
      color: stats.repairCount > 0 ? "text-red-500" : "text-muted-foreground",
    },
  ];

  return (
    <Card className="cursor-pointer transition-shadow hover:shadow-md" onClick={onClick}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{project.name}</CardTitle>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3" />
          {project.country}
          {project.region ? `, ${project.region}` : ""}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-end justify-between text-sm">
          <span className="font-semibold">{stats.deployed} deployed</span>
          <span className="text-muted-foreground">target: {project.target_quantity}</span>
        </div>
        <Progress value={progress} className="h-1.5" />
        <div className="grid grid-cols-5 gap-1 pt-1">
          {statItems.map((item) => (
            <div key={item.label} className="flex flex-col items-center gap-0.5">
              <item.icon className={cn("h-3.5 w-3.5", item.color)} />
              <span className="text-xs font-semibold">{item.value}</span>
              <span className="text-[10px] leading-none text-muted-foreground">{item.label}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
