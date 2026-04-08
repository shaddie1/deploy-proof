
-- Fix the permissive audit_log INSERT policy to require user_id = auth.uid()
DROP POLICY "System can insert audit log" ON public.audit_log;
CREATE POLICY "Authenticated can insert own audit entries" ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
