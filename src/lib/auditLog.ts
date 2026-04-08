import { supabase } from "@/integrations/supabase/client";

interface AuditLogParams {
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  beforeData?: Record<string, unknown> | null;
  afterData?: Record<string, unknown> | null;
}

export async function logAudit({
  userId,
  action,
  entityType,
  entityId,
  beforeData = null,
  afterData = null,
}: AuditLogParams) {
  try {
    await supabase.from("audit_log").insert({
      user_id: userId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      before_data: beforeData as any,
      after_data: afterData as any,
    });
  } catch (err) {
    console.error("Audit log failed:", err);
  }
}
