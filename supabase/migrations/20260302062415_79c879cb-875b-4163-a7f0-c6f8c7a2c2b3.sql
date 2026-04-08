-- Allow field officers to insert shipments
CREATE POLICY "Field officers can create shipments"
ON public.shipments
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'field_officer'::app_role) AND auth.uid() = created_by
);