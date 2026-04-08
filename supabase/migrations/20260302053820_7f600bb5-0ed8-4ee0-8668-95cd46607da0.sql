-- Add total_cost column to pcb_repairs for tracking repair charges in KSH
ALTER TABLE public.pcb_repairs ADD COLUMN total_cost numeric DEFAULT 0;