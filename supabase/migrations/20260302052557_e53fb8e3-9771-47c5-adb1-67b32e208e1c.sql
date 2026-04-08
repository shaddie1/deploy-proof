
-- Repair status enum
CREATE TYPE public.repair_status AS ENUM (
  'intake', 'diagnosis', 'in_repair', 'testing', 'completed', 'scrapped'
);

-- PCB Repairs table
CREATE TABLE public.pcb_repairs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deployment_id UUID REFERENCES public.deployments(id) ON DELETE SET NULL,
  item_id UUID REFERENCES public.items(id) ON DELETE SET NULL,
  serial_number TEXT NOT NULL DEFAULT '',
  fault_description TEXT NOT NULL DEFAULT '',
  diagnosis_notes TEXT DEFAULT '',
  repair_notes TEXT DEFAULT '',
  status repair_status NOT NULL DEFAULT 'intake',
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'critical')),
  technician_id UUID DEFAULT NULL,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  is_charger_repair BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Parts used in repairs
CREATE TABLE public.repair_parts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  repair_id UUID NOT NULL REFERENCES public.pcb_repairs(id) ON DELETE CASCADE,
  part_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_cost NUMERIC(10,2) DEFAULT 0,
  notes TEXT DEFAULT '',
  added_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pcb_repairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_parts ENABLE ROW LEVEL SECURITY;

-- RLS policies for pcb_repairs
CREATE POLICY "Authenticated can view repairs"
  ON public.pcb_repairs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and warehouse managers can manage repairs"
  ON public.pcb_repairs FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'warehouse_manager'));

CREATE POLICY "Field officers can create repairs"
  ON public.pcb_repairs FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'field_officer') AND auth.uid() = created_by);

CREATE POLICY "Technicians can update assigned repairs"
  ON public.pcb_repairs FOR UPDATE
  TO authenticated
  USING (auth.uid() = technician_id);

-- RLS policies for repair_parts
CREATE POLICY "Authenticated can view repair parts"
  ON public.repair_parts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and warehouse managers can manage repair parts"
  ON public.repair_parts FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'warehouse_manager'));

-- Updated_at trigger for pcb_repairs
CREATE TRIGGER update_pcb_repairs_updated_at
  BEFORE UPDATE ON public.pcb_repairs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
