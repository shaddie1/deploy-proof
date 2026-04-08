-- Add new item categories
ALTER TYPE public.item_category ADD VALUE IF NOT EXISTS 'dmrv_pcb';
ALTER TYPE public.item_category ADD VALUE IF NOT EXISTS 'dc_pcb';
ALTER TYPE public.item_category ADD VALUE IF NOT EXISTS 'ac_pcb';
ALTER TYPE public.item_category ADD VALUE IF NOT EXISTS 'home_gas_meter';
ALTER TYPE public.item_category ADD VALUE IF NOT EXISTS 'industrial_gas_meter';