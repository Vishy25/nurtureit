import {useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {useServerFn} from '@tanstack/react-start';
import {toast} from 'sonner';
import {supabase} from '@/integrations/supabase/client';
import {manageCrm} from '@/lib/crm.functions';
import {scopes,entities} from '@/lib/crm-contract';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Checkbox} from '@/components/ui/checkbox';
import {Label} from '@/components/ui/label';
export function CrmIntegrationControls({tenantId}:{tenantId:string}){
 const manage=useServerFn(manageCrm);const qc=useQueryClient();
 const [name,setName]=useState('');const [url,setUrl]=useState('');const [secret,setSecret]=useState('');const [busy,setBusy]=useState(false);
 const [selected,setSelected]=useState<string[]>(['crm:read']);const [events,setEvents]=useState<string[]>(['enquiries.created','leads.updated']);
 const {data:keys=[]}=useQuery({queryKey:['crm-keys',tenantId],queryFn:async()=>{const {data,error}=await supabase.from('crm_credentials').select('id,name,key_prefix,scopes,expires_at,revoked_at').eq('tenant_id',tenantId);if(error)throw error;return data;}});
 const {data:hooks=[]}=useQuery({queryKey:['crm-hooks',tenantId],queryFn:async()=>{const {data,error}=await supabase.from('crm_webhooks').select('id,name,url,events,enabled').eq('tenant_id',tenantId);if(error)throw error;return data;}});
 const {data:deliveries=[]}=useQuery({queryKey:['crm-deliveries',tenantId],queryFn:async()=>{const {data,error}=await supabase.from('crm_deliveries').select('id,event_type,status,attempts,last_error,created_at').eq('tenant_id',tenantId).order('created_at',{ascending:false}).limit(30);if(error)throw error;return data;}});
 async function submit(action:'key'|'webhook'|'dispatch'){
 setBusy(true);setSecret('');try{const r=await manage({data:{tenantId,action,name,scopes:selected as typeof scopes[number][],url,events}});if('secret' in r && r.secret)setSecret(r.secret);toast.success(action==='dispatch'?'Delivery batch processed':'Created');await qc.invalidateQueries({queryKey:['crm-keys']});await qc.invalidateQueries({queryKey:['crm-hooks']});await qc.invalidateQueries({queryKey:['crm-deliveries']});}catch(e){toast.error(e instanceof Error?e.message:'Request failed');}finally{setBusy(false);}}
 const toggle=(values:string[],value:string)=>values.includes(value)?values.filter(v=>v!==value):[...values,value];
 return <section className="mb-8 space-y-5 border-b pb-8">
 <h2 className="font-display text-xl font-semibold">CRM connections</h2>
 <div className="flex flex-wrap gap-3"><Input className="max-w-md" aria-label="Connection name" placeholder="Connection name" value={name} onChange={e=>setName(e.target.value)}/></div>
 <fieldset className="flex flex-wrap gap-4"><legend className="mb-2 text-sm font-medium">Access</legend>{scopes.map(s=><Label key={s} className="flex items-center gap-2"><Checkbox checked={selected.includes(s)} onCheckedChange={()=>setSelected(toggle(selected,s))}/>{s.replace('crm:','')}</Label>)}</fieldset>
 <Button onClick={()=>submit('key')} disabled={busy||!name.trim()||!selected.length}>Create CRM key</Button>
 {secret&&<div className="border p-3"><p className="text-sm font-medium">Copy now — shown once</p><code className="block break-all">{secret}</code><Button variant="outline" size="sm" onClick={()=>{navigator.clipboard.writeText(secret);toast.success('Copied');}}>Copy secret</Button></div>}
 <div className="divide-y">{keys.map(k=><div key={k.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"><div>{k.name} · {k.key_prefix}…<div className="text-muted-foreground">{k.scopes.join(', ')} · expires {new Date(k.expires_at).toLocaleDateString()}</div></div><Button variant="outline" size="sm" disabled={Boolean(k.revoked_at)} onClick={async()=>{const {error}=await supabase.from('crm_credentials').update({revoked_at:new Date().toISOString()}).eq('id',k.id).eq('tenant_id',tenantId);if(error)toast.error(error.message);else await qc.invalidateQueries({queryKey:['crm-keys']});}}>{k.revoked_at?'Revoked':'Revoke'}</Button></div>)}</div>
 <h3 className="font-display text-lg font-semibold">Outbound webhooks</h3>
 <Input aria-label="Webhook destination" placeholder="https://your-service.com/crm-events" value={url} onChange={e=>setUrl(e.target.value)}/>
 <fieldset className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><legend className="mb-2 text-sm font-medium">Events</legend>{entities.flatMap(t=>[`${t}.created`,`${t}.updated`]).map(e=><Label key={e} className="flex items-center gap-2"><Checkbox checked={events.includes(e)} onCheckedChange={()=>setEvents(toggle(events,e))}/>{e}</Label>)}</fieldset>
 <div className="flex gap-2"><Button disabled={busy||!name.trim()||!url||!events.length} onClick={()=>submit('webhook')}>Add webhook</Button><Button variant="outline" disabled={busy} onClick={()=>submit('dispatch')}>Deliver pending</Button></div>
 <div className="divide-y">{hooks.map(h=><div key={h.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"><div className="min-w-0">{h.name}<div className="break-all text-muted-foreground">{h.url}</div></div><Button size="sm" variant="outline" onClick={async()=>{const {error}=await supabase.from('crm_webhooks').update({enabled:!h.enabled}).eq('id',h.id);if(error)toast.error(error.message);else await qc.invalidateQueries({queryKey:['crm-hooks']});}}>{h.enabled?'Disable':'Enable'}</Button></div>)}</div>
 <h3 className="font-display text-lg font-semibold">Recent deliveries</h3><div className="divide-y">{deliveries.map(d=><div key={d.id} className="py-2 text-sm">{d.event_type} · {d.status} · {d.attempts} attempts{d.last_error&&<p className="text-destructive">{d.last_error}</p>}</div>)}{!deliveries.length&&<p className="text-sm text-muted-foreground">No deliveries yet.</p>}</div>
 </section>;
}
