import {useQuery} from '@tanstack/react-query';
import {supabase} from '@/integrations/supabase/client';
import {Badge} from '@/components/ui/badge';
export function LeadEnquiries({tenantId,leadId}:{tenantId:string,leadId:string}){
 const {data=[],isPending,error}=useQuery({queryKey:['lead-enquiries',tenantId,leadId],queryFn:async()=>{
 const {data,error}=await supabase.from('enquiries').select('id,message,status,source_system,external_id,budget,timeline,created_at,properties(title,location)').eq('tenant_id',tenantId).eq('lead_id',leadId).order('created_at',{ascending:false});if(error)throw error;return data;
 }});
 return <section className="mx-4 mt-6 border-t pt-4"><h3 className="font-medium">Property enquiries</h3>{isPending?<p className="mt-2 text-sm text-muted-foreground">Loading…</p>:error?<p className="text-sm text-destructive">Enquiries could not be loaded.</p>:data.length?<div className="divide-y">{data.map(e=><article key={e.id} className="space-y-2 py-3"><div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-medium">{e.properties?.title??'Property'}</h4><Badge variant="outline">{e.status}</Badge></div><p className="text-xs text-muted-foreground">{e.source_system} · {e.external_id} · {new Date(e.created_at).toLocaleString()}</p>{e.message&&<p className="whitespace-pre-wrap text-sm">{e.message}</p>}<p className="text-sm text-muted-foreground">{e.budget!=null?`Budget: ${e.budget.toLocaleString()}`:''}{e.timeline?` · ${e.timeline}`:''}</p></article>)}</div>:<p className="mt-2 text-sm text-muted-foreground">No property enquiries.</p>}</section>;
}
