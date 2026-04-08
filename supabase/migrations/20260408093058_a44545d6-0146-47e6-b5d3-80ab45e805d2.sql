
ALTER TABLE public.pcb_repairs
  ADD COLUMN IF NOT EXISTS batch text DEFAULT '',
  ADD COLUMN IF NOT EXISTS device_type text DEFAULT '',
  ADD COLUMN IF NOT EXISTS cooker_model text DEFAULT '',
  ADD COLUMN IF NOT EXISTS device_origin text DEFAULT '',
  ADD COLUMN IF NOT EXISTS fault_source text DEFAULT 'PCB Fault',
  ADD COLUMN IF NOT EXISTS fault_category text DEFAULT '',
  ADD COLUMN IF NOT EXISTS repair_action text DEFAULT '',
  ADD COLUMN IF NOT EXISTS components_replaced text DEFAULT '',
  ADD COLUMN IF NOT EXISTS meter_replaced boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS replacement_serial text DEFAULT '',
  ADD COLUMN IF NOT EXISTS replacement_device_type text DEFAULT 'External Metering',
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id);
