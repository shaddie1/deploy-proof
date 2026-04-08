import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Users, Search, Shield, ShieldCheck, Binoculars, Warehouse, UserPlus, Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { logAudit } from "@/lib/auditLog";
import type { Tables } from "@/integrations/supabase/types";

type Profile = Tables<"profiles">;
type AppRole = "admin" | "warehouse_manager" | "field_officer" | "auditor";

interface UserWithRoles extends Profile {
  roles: AppRole[];
}

const ROLES: { value: AppRole; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "admin", label: "Admin", icon: ShieldCheck },
  { value: "warehouse_manager", label: "Warehouse Manager", icon: Warehouse },
  { value: "field_officer", label: "Field Officer", icon: Binoculars },
  { value: "auditor", label: "Auditor", icon: Shield },
];

const roleColors: Record<AppRole, string> = {
  admin: "bg-destructive text-destructive-foreground border-transparent",
  warehouse_manager: "bg-status-warning text-status-warning-foreground border-transparent",
  field_officer: "bg-status-info text-status-info-foreground border-transparent",
  auditor: "bg-status-success text-status-success-foreground border-transparent",
};

export default function UsersPage() {
  const { hasRole, user: currentUser } = useAuth();
  const { toast } = useToast();
  const isAdmin = hasRole("admin");

  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  // Add role dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null);
  const [newRole, setNewRole] = useState<AppRole>("field_officer");
  const [saving, setSaving] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("*")
      .order("full_name", { ascending: true });

    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id, role");

    const roleMap = new Map<string, AppRole[]>();
    (roles || []).forEach((r) => {
      const existing = roleMap.get(r.user_id) || [];
      existing.push(r.role as AppRole);
      roleMap.set(r.user_id, existing);
    });

    const combined: UserWithRoles[] = (profiles || []).map((p) => ({
      ...p,
      roles: roleMap.get(p.id) || [],
    }));

    setUsers(combined);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const filtered = users.filter((u) => {
    const matchSearch =
      !searchQuery ||
      u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.email || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchRole = roleFilter === "all" || u.roles.includes(roleFilter as AppRole);
    return matchSearch && matchRole;
  });

  const roleCounts = ROLES.map((r) => ({
    ...r,
    count: users.filter((u) => u.roles.includes(r.value)).length,
  }));

  const openAddRole = (user: UserWithRoles) => {
    setSelectedUser(user);
    // Default to a role the user doesn't have yet
    const available = ROLES.filter((r) => !user.roles.includes(r.value));
    setNewRole(available.length > 0 ? available[0].value : "field_officer");
    setDialogOpen(true);
  };

  const handleAddRole = async () => {
    if (!selectedUser) return;
    setSaving(true);

    const { error } = await supabase.from("user_roles").insert({
      user_id: selectedUser.id,
      role: newRole,
    });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      if (currentUser) logAudit({ userId: currentUser.id, action: "assign_role", entityType: "user_role", entityId: selectedUser.id, afterData: { role: newRole, target_user: selectedUser.full_name } });
      toast({ title: "Role assigned", description: `${ROLES.find((r) => r.value === newRole)?.label} → ${selectedUser.full_name || selectedUser.email}` });
      setDialogOpen(false);
      fetchUsers();
    }
    setSaving(false);
  };

  const handleRemoveRole = async (userId: string, role: AppRole) => {
    if (userId === currentUser?.id && role === "admin") {
      toast({ title: "Cannot remove", description: "You cannot remove your own admin role.", variant: "destructive" });
      return;
    }

    const { error } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .eq("role", role);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      if (currentUser) logAudit({ userId: currentUser.id, action: "remove_role", entityType: "user_role", entityId: userId, beforeData: { role } });
      toast({ title: "Role removed" });
      fetchUsers();
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Shield className="h-12 w-12 text-muted-foreground" />
        <h1 className="mt-4 text-xl font-bold">Access Denied</h1>
        <p className="mt-1 text-muted-foreground">Only administrators can manage users.</p>
      </div>
    );
  }

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
        <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
        <p className="text-muted-foreground">View platform users and manage their role assignments</p>
      </div>

      {/* Role summary */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {roleCounts.map((r) => (
          <Card
            key={r.value}
            className={cn(
              "cursor-pointer transition-shadow hover:shadow-md",
              roleFilter === r.value && "ring-2 ring-primary"
            )}
            onClick={() => setRoleFilter(roleFilter === r.value ? "all" : r.value)}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{r.label}</CardTitle>
              <r.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{r.count}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" /> Users ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No users match your filters.</p>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Roles</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((u) => {
                    const availableRoles = ROLES.filter((r) => !u.roles.includes(r.value));
                    return (
                      <TableRow key={u.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-medium">
                              {u.full_name?.[0]?.toUpperCase() || u.email?.[0]?.toUpperCase() || "?"}
                            </div>
                            <span className="font-medium">{u.full_name || "—"}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{u.email || "—"}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {u.roles.length === 0 && (
                              <span className="text-xs text-muted-foreground">No roles</span>
                            )}
                            {u.roles.map((role) => (
                              <Badge
                                key={role}
                                className={cn("gap-1 text-xs capitalize", roleColors[role])}
                              >
                                {role.replace(/_/g, " ")}
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleRemoveRole(u.id, role); }}
                                  className="ml-0.5 rounded-full p-0.5 hover:bg-background/20"
                                  title="Remove role"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(u.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {availableRoles.length > 0 && (
                            <Button size="sm" variant="outline" onClick={() => openAddRole(u)}>
                              <UserPlus className="mr-1 h-3 w-3" /> Add Role
                            </Button>
                          )}
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

      {/* Add Role Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Role</DialogTitle>
            <DialogDescription>
              Add a new role to <strong>{selectedUser?.full_name || selectedUser?.email}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={newRole} onValueChange={(v) => setNewRole(v as AppRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.filter((r) => !selectedUser?.roles.includes(r.value)).map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddRole} disabled={saving}>
              {saving ? "Assigning…" : "Assign Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
