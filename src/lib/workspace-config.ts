import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getTemplate } from "@/lib/industry-templates";
import { resolveScoring, type ScoringConfig } from "@/lib/scoring";

export type CustomFieldDef = {
  id: string;
  field_key: string;
  label: string;
  field_type: "text" | "number" | "date" | "select" | "boolean";
  options: string[];
  required: boolean;
  position: number;
};

export type WorkspaceConfig = {
  stageLabels: string[];
  scoring: ScoringConfig;
  hasCustomScoring: boolean;
  fields: CustomFieldDef[];
};

export function useWorkspaceConfig(tenantId: string | undefined, industry: string | undefined) {
  return useQuery({
    queryKey: ["workspace-config", tenantId],
    enabled: !!tenantId,
    queryFn: async (): Promise<WorkspaceConfig> => {
      const sb = supabase as any;
      const [{ data: t }, { data: f }] = await Promise.all([
        sb.from("tenants").select("stage_labels, scoring_config").eq("id", tenantId).single(),
        sb.from("custom_field_defs").select("id, field_key, label, field_type, options, required, position").eq("tenant_id", tenantId).eq("entity", "lead").order("position"),
      ]);
      const base = getTemplate(industry).stages;
      const labels: string[] = Array.isArray(t?.stage_labels) && t.stage_labels.length === 7 ? t.stage_labels : base;
      return { stageLabels: labels, scoring: resolveScoring(t?.scoring_config), hasCustomScoring: !!t?.scoring_config, fields: f ?? [] };
    },
  });
}

/** Validates custom field values against definitions; returns cleaned values or throws. */
export function cleanCustomValues(fields: CustomFieldDef[], values: Record<string, unknown>) {
  const out: Record<string, string | number | boolean | null> = {};
  for (const f of fields) {
    const v = values[f.field_key];
    const empty = v === undefined || v === null || v === "";
    if (empty) {
      if (f.required && f.field_type !== "boolean") throw new Error(`${f.label} is required`);
      out[f.field_key] = f.field_type === "boolean" ? false : null;
      continue;
    }
    if (f.field_type === "number") {
      const n = Number(v);
      if (Number.isNaN(n)) throw new Error(`${f.label} must be a number`);
      out[f.field_key] = n;
    } else if (f.field_type === "boolean") out[f.field_key] = v === true || v === "true";
    else if (f.field_type === "select") {
      if (!f.options.includes(String(v))) throw new Error(`${f.label}: choose one of the options`);
      out[f.field_key] = String(v);
    } else out[f.field_key] = String(v).slice(0, 500);
  }
  return out;
}
