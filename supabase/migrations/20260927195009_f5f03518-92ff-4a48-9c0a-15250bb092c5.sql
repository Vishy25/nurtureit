ALTER TABLE public.custom_field_defs DROP CONSTRAINT IF EXISTS custom_field_defs_entity_check;
ALTER TABLE public.custom_field_defs ADD CONSTRAINT custom_field_defs_entity_check CHECK (entity IN ('lead','contact'));
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb;