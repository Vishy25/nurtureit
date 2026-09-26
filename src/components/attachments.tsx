import { useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Paperclip, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const MAX = 10 * 1024 * 1024;

export function Attachments({ tenantId, entityType, entityId, canUpload }: { tenantId: string; entityType: string; entityId: string; canUpload: boolean }) {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const key = ["attachments", entityType, entityId];

  const { data: files = [] } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase.from("attachments").select("*").eq("entity_type", entityType).eq("entity_id", entityId).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (file.size > MAX) throw new Error("Files must be 10 MB or smaller");
      const path = `${tenantId}/${entityType}/${entityId}/${crypto.randomUUID()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
      const up = await supabase.storage.from("attachments").upload(path, file, { contentType: file.type });
      if (up.error) throw up.error;
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("attachments").insert({
        tenant_id: tenantId, entity_type: entityType, entity_id: entityId, file_name: file.name,
        storage_path: path, size_bytes: file.size, content_type: file.type || null, created_by: u.user!.id,
      });
      if (error) { await supabase.storage.from("attachments").remove([path]); throw error; }
    },
    onSuccess: () => { toast.success("File attached"); qc.invalidateQueries({ queryKey: key }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (f: { id: string; storage_path: string }) => {
      const { error } = await supabase.from("attachments").delete().eq("id", f.id);
      if (error) throw error;
      await supabase.storage.from("attachments").remove([f.storage_path]);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
    onError: (e: Error) => toast.error(e.message),
  });

  async function open(path: string) {
    const { data, error } = await supabase.storage.from("attachments").createSignedUrl(path, 60);
    if (error) return toast.error(error.message);
    window.open(data.signedUrl, "_blank", "noopener");
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Attachments</h4>
        {canUpload && (
          <>
            <input ref={input} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.mutate(f); e.target.value = ""; }} />
            <Button size="sm" variant="outline" disabled={upload.isPending} onClick={() => input.current?.click()}>
              <Paperclip className="mr-1 size-4" />{upload.isPending ? "Uploading…" : "Attach file"}
            </Button>
          </>
        )}
      </div>
      {files.map((f) => (
        <div key={f.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
          <button className="truncate text-left underline-offset-2 hover:underline" onClick={() => open(f.storage_path)}>{f.file_name}</button>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {(f.size_bytes / 1024).toFixed(0)} KB
            {canUpload && <Button size="icon" variant="ghost" className="size-7" aria-label="Delete file" onClick={() => remove.mutate(f)}><Trash2 className="size-4" /></Button>}
          </div>
        </div>
      ))}
      {!files.length && <p className="text-xs text-muted-foreground">No files. Max 10 MB each.</p>}
    </div>
  );
}
