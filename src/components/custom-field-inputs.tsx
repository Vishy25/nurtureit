import type { CustomFieldDef } from "@/lib/workspace-config";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function CustomFieldInputs({
  fields, values, onChange, disabled,
}: {
  fields: CustomFieldDef[];
  values: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
  disabled?: boolean;
}) {
  if (!fields.length) return null;
  const set = (k: string, v: unknown) => onChange({ ...values, [k]: v });
  return (
    <div className="grid grid-cols-2 gap-3">
      {fields.map((f) => {
        const v = values[f.field_key];
        return (
          <div key={f.id} className="space-y-1">
            <Label>{f.label}{f.required && " *"}</Label>
            {f.field_type === "select" ? (
              <Select value={v ? String(v) : ""} onValueChange={(x) => set(f.field_key, x)} disabled={!!disabled}>
                <SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger>
                <SelectContent>{f.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
              </Select>
            ) : f.field_type === "boolean" ? (
              <label className="flex h-9 items-center gap-2 text-sm">
                <input type="checkbox" checked={v === true} onChange={(e) => set(f.field_key, e.target.checked)} disabled={disabled} /> Yes
              </label>
            ) : (
              <Input
                type={f.field_type === "number" ? "number" : f.field_type === "date" ? "date" : "text"}
                value={v == null ? "" : String(v)}
                onChange={(e) => set(f.field_key, e.target.value)}
                disabled={disabled}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
