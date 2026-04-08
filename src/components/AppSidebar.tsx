import { useLocation, Link } from "react-router-dom";
import {
  LayoutDashboard, Ship, Warehouse, Rocket, FolderOpen,
  FileCheck, Package, ScrollText, BarChart3, Map, Users, LogOut, Sun, Moon, CircuitBoard, Coins,
} from "lucide-react";
import verstLogo from "@/assets/verst-carbon-logo.png";
import { useTheme } from "next-themes";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { useCurrency, CURRENCIES, type CurrencyCode } from "@/hooks/useCurrency";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const mainNav = [
  { title: "Dashboard", icon: LayoutDashboard, url: "/" },
  { title: "Shipments", icon: Ship, url: "/shipments" },
  { title: "Warehouse", icon: Warehouse, url: "/warehouse" },
  { title: "Deployments", icon: Rocket, url: "/deployments" },
  { title: "Projects", icon: FolderOpen, url: "/projects" },
];

const manageNav = [
  { title: "Evidence Vault", icon: FileCheck, url: "/evidence" },
  { title: "Items Catalog", icon: Package, url: "/items" },
  { title: "PCB Repairs", icon: CircuitBoard, url: "/pcb-repairs" },
  { title: "Audit Trail", icon: ScrollText, url: "/audit" },
  { title: "Reports", icon: BarChart3, url: "/reports" },
  { title: "Map View", icon: Map, url: "/map" },
];

const adminNav = [
  { title: "User Management", icon: Users, url: "/users" },
];

export function AppSidebar() {
  const location = useLocation();
  const { user, hasRole, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const { currency, setCurrency } = useCurrency();

  const isActive = (url: string) => {
    if (url === "/") return location.pathname === "/";
    return location.pathname.startsWith(url);
  };

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <Link to="/" className="flex items-center gap-2">
          <img src={verstLogo} alt="Verst Carbon" className="h-8 w-auto" />
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <Link to={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Manage</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {manageNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <Link to={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {hasRole("admin") && (
          <SidebarGroup>
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminNav.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                      <Link to={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Coins className="h-4 w-4 text-sidebar-foreground/70 shrink-0" />
          <Select value={currency} onValueChange={(v) => setCurrency(v as CurrencyCode)}>
            <SelectTrigger className="h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(CURRENCIES).map((c) => (
                <SelectItem key={c.code} value={c.code} className="text-xs">
                  {c.symbol} {c.code} — {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
        </button>
        <div className="flex items-center gap-2 text-xs text-sidebar-foreground/70">
          <div className="h-6 w-6 rounded-full bg-sidebar-accent flex items-center justify-center text-[10px] font-medium text-sidebar-accent-foreground">
            {user?.email?.[0]?.toUpperCase() || "?"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-sidebar-foreground">{user?.email}</p>
          </div>
          <button onClick={signOut} className="text-sidebar-foreground/50 hover:text-sidebar-foreground" title="Sign out">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
