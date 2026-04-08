
-- Add new columns to shipments table
ALTER TABLE public.shipments ADD COLUMN unit_price numeric DEFAULT 0;
ALTER TABLE public.shipments ADD COLUMN total_cost numeric DEFAULT 0;
ALTER TABLE public.shipments ADD COLUMN procurement_type text NOT NULL DEFAULT 'imported';
ALTER TABLE public.shipments ADD COLUMN project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;

-- Create procurement category enum
CREATE TYPE public.procurement_category AS ENUM ('consumable', 'tool', 'pcb_dc', 'pcb_ac', 'other');
ALTER TABLE public.shipments ADD COLUMN procurement_category public.procurement_category NOT NULL DEFAULT 'other';
