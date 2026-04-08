import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StatusVariant = "success" | "warning" | "danger" | "info" | "default";

const statusMap: Record<string, StatusVariant> = {
  // Shipment statuses
  ordered: "info",
  in_transit: "warning",
  customs: "warning",
  received: "success",
  partial: "warning",
  // Deployment statuses
  scheduled: "info",
  deployed: "success",
  verified: "success",
  flagged: "danger",
};

const variantClasses: Record<StatusVariant, string> = {
  success: "bg-status-success text-status-success-foreground border-transparent",
  warning: "bg-status-warning text-status-warning-foreground border-transparent",
  danger: "bg-status-danger text-status-danger-foreground border-transparent",
  info: "bg-status-info text-status-info-foreground border-transparent",
  default: "",
};

export function StatusBadge({ status }: { status: string }) {
  const variant = statusMap[status] || "default";
  const label = status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <Badge className={cn(variantClasses[variant])}>
      {label}
    </Badge>
  );
}
