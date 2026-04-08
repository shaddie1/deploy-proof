import { ReactNode } from "react";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Separator } from "@/components/ui/separator";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from "@/components/ui/breadcrumb";
import { useLocation } from "react-router-dom";

const routeTitles: Record<string, string> = {
  "/": "Dashboard",
  "/shipments": "Shipments",
  "/warehouse": "Warehouse",
  "/deployments": "Deployments",
  "/projects": "Projects",
  "/evidence": "Evidence Vault",
  "/items": "Items Catalog",
  "/audit": "Audit Trail",
  "/reports": "Reports",
  "/map": "Map View",
  "/users": "User Management",
  "/pcb-repairs": "PCB Repair Tracker",
};

export function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const pageTitle = routeTitles[location.pathname] || "Page";

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>{pageTitle}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <div className="flex-1 overflow-auto p-4 md:p-6">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
