-- Add tool and consumable categories
ALTER TYPE public.item_category ADD VALUE IF NOT EXISTS 'tool';
ALTER TYPE public.item_category ADD VALUE IF NOT EXISTS 'consumable';