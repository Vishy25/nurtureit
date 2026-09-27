ALTER TABLE public.ai_runs DROP CONSTRAINT ai_runs_status_check;
ALTER TABLE public.ai_runs ADD CONSTRAINT ai_runs_status_check CHECK (status IN ('running','completed','failed','blocked','uncertain'));
ALTER TABLE public.ai_agent_settings ADD COLUMN autonomy text NOT NULL DEFAULT 'suggest' CHECK (autonomy IN ('off','suggest','low_risk'));
ALTER TABLE public.tenants ADD COLUMN ai_monthly_run_budget integer NOT NULL DEFAULT 3000 CHECK (ai_monthly_run_budget >= 0);