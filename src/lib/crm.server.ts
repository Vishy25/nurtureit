import { z } from 'zod';
import { entities,entitySchema,patches,enquirySchema,sourceSchema,externalSchema,canScope } from './crm-contract';
import { sha256Hex } from './intake.server';
import { normalizeEmail,normalizePhone,scoreLead,resolveScoring } from './scoring';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
type Admin=SupabaseClient<Database>;
class ApiError extends Error { constructor(public status:number,message:string){super(message);} }
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
async function body(request:Request) {
 const reader=request.body?.getReader(); if(!reader) throw new ApiError(400,'JSON body required');
 let length=0;const chunks:Uint8Array[]=[];
 while(true){const r=await reader.read();if(r.done)break;length+=r.value.length;if(length>64000){await reader.cancel();throw new ApiError(413,'Body exceeds 64 KB');}chunks.push(r.value);}
 const all=new Uint8Array(length);let i=0;for(const c of chunks){all.set(c,i);i+=c.length;}
 try{return JSON.parse(new TextDecoder().decode(all));}catch{throw new ApiError(400,'Invalid JSON');}
}
async function target(admin:Admin,tenant:string,entity:typeof entities[number],id:string){
 const {data,error}=await admin.from(entity).select('*').eq('tenant_id',tenant).eq('id',id).maybeSingle();
 if(error)throw new ApiError(500,'Record lookup failed');if(!data)throw new ApiError(404,'Record not found');return data;
}
export async function handleCrm(request:Request,path:string) {
 try {
 const token=/^Bearer (crm_[a-f0-9]{64})$/.exec(request.headers.get('authorization')??'')?.[1];
 if(!token)throw new ApiError(401,'CRM bearer key required');
 const {supabaseAdmin:admin}=await import('@/integrations/supabase/client.server');
 const {data:credentials,error:authError}=await admin.rpc('crm_authenticate',{_hash:await sha256Hex(token)});
 const cred=credentials?.[0];if(authError || !cred)throw new ApiError(401,'Invalid, expired or revoked key');
 if(cred.request_count>120)throw new ApiError(429,'Rate limit exceeded');
 const {data:member}=await admin.from('memberships').select('role').eq('tenant_id',cred.tenant_id).eq('user_id',cred.created_by).eq('status','active').maybeSingle();
 const {data:tenant}=await admin.from('tenants').select('status,scoring_config').eq('id',cred.tenant_id).maybeSingle();
 if(member?.role!=='tenant_admin' || tenant?.status!=='active')throw new ApiError(403,'Credential administrator or workspace is inactive');
 const need=(scope:string)=>{if(!canScope(cred.scopes,scope))throw new ApiError(403,`Missing scope: ${scope}`);};
 const tenantId=cred.tenant_id;const pieces=path.split('/').filter(Boolean);const url=new URL(request.url);
 if(pieces[0]==='references' && request.method==='PUT'){
 need('crm:references');const p=z.object({source_system:sourceSchema,entity_type:entitySchema,external_id:externalSchema,entity_id:z.string().uuid()}).strict().parse(await body(request));
 await target(admin,tenantId,p.entity_type,p.entity_id);
 const {data,error}=await admin.from('crm_external_ids').upsert({...p,tenant_id:tenantId},{onConflict:'tenant_id,source_system,entity_type,external_id'}).select('*').single();
 if(error)throw new ApiError(409,'External reference conflicts');return reply({data});
 }
 if(pieces[0]==='owners'){
 if(request.method==='GET'){need('crm:read');const {data,error}=await admin.from('crm_owner_mappings').select('source_system,external_owner_id,user_id').eq('tenant_id',tenantId).limit(100);if(error)throw error;return reply({data});}
 if(request.method==='PUT'){need('crm:assign');const p=z.object({source_system:sourceSchema,external_owner_id:externalSchema,user_id:z.string().uuid()}).strict().parse(await body(request));
 const {data,error}=await admin.from('crm_owner_mappings').upsert({...p,tenant_id:tenantId},{onConflict:'tenant_id,source_system,external_owner_id'}).select('*').single();
 if(error)throw new ApiError(422,'Owner must be an active seller in this workspace');return reply({data});}
 }
 const entity=entitySchema.parse(pieces[0]);
 if(request.method==='POST' && entity==='enquiries' && pieces.length===1){
 need('crm:write');const p=enquirySchema.parse(await body(request));
 const clean={...p,email:normalizeEmail(p.email)??undefined,phone:normalizePhone(p.phone)??undefined};
 if(!p.lead_id && !clean.email && !clean.phone)throw new ApiError(422,'Valid email or phone required');
 const score=scoreLead({...clean,source:p.source_system},resolveScoring(tenant?.scoring_config)).total;
 const {data,error}=await admin.rpc('crm_create_enquiry',{_tenant:tenantId,_actor:cred.created_by,_body:clean,_score:score});
 if(error)throw new ApiError(422,'Invalid property/lead reference or conflicting enquiry');
 return reply(data,(data as {replayed?:boolean})?.replayed?200:201);
 }
 if(request.method==='GET'){
 need('crm:read');
 if(pieces.length===2)return reply({data:await target(admin,tenantId,entity,z.string().uuid().parse(pieces[1]))});
 if(pieces.length!==1)throw new ApiError(404,'Endpoint not found');
 const external=url.searchParams.get('external_id');
 if(external){const source=sourceSchema.parse(url.searchParams.get('source_system'));
 const {data}=await admin.from('crm_external_ids').select('entity_id').eq('tenant_id',tenantId).eq('entity_type',entity).eq('source_system',source).eq('external_id',externalSchema.parse(external)).maybeSingle();
 if(!data)throw new ApiError(404,'External ID not found');return reply({data:await target(admin,tenantId,entity,data.entity_id)});}
 const limit=z.coerce.number().int().min(1).max(100).parse(url.searchParams.get('limit')??50);
 const offset=z.coerce.number().int().min(0).max(1000000).parse(url.searchParams.get('offset')??0);
 let q=admin.from(entity).select('*').eq('tenant_id',tenantId).order('id').range(offset,offset+limit);
 const lead=url.searchParams.get('lead_id');if(lead && entity==='enquiries')q=q.eq('lead_id',z.string().uuid().parse(lead));
 const {data,error}=await q;if(error)throw new ApiError(500,'Could not read records');
 return reply({data:data?.slice(0,limit)??[],next_offset:(data?.length??0)>limit?offset+limit:null});
 }
 if(request.method==='PATCH' && pieces.length===2){
 need('crm:write');const id=z.string().uuid().parse(pieces[1]);await target(admin,tenantId,entity,id);
 const parsed=patches[entity].parse(await body(request));const p:Record<string,unknown>={...parsed};
 if(!Object.keys(p).length)throw new ApiError(422,'At least one update field is required');
 if('external_owner_id' in p){need('crm:assign');let owner:string|null=null;
 if(p['external_owner_id']!==null){const source=sourceSchema.parse(p['source_system']);
 const {data:mapping}=await admin.from('crm_owner_mappings').select('user_id').eq('tenant_id',tenantId).eq('source_system',source).eq('external_owner_id',String(p['external_owner_id'])).maybeSingle();
 if(!mapping)throw new ApiError(422,'Owner mapping not found');
 const {data:active}=await admin.from('memberships').select('role').eq('tenant_id',tenantId).eq('user_id',mapping.user_id).eq('status','active').maybeSingle();
 if(!active || !['tenant_admin','sales_manager','sales_rep'].includes(active.role))throw new ApiError(422,'Mapped owner inactive');owner=mapping.user_id;
 }p[entity==='tasks'?'assignee_id':'owner_id']=owner;delete p['external_owner_id'];}
 delete p['source_system'];
 const relations:Record<string,typeof entities[number]>={lead_id:'leads',contact_id:'contacts',organization_id:'organizations',opportunity_id:'opportunities'};
 for(const [field,type] of Object.entries(relations)){if(typeof p[field]==='string')await target(admin,tenantId,type,String(p[field]));}
 if(typeof p['email']==='string')p['email']=normalizeEmail(p['email']);if(typeof p['phone']==='string')p['phone']=normalizePhone(p['phone']);
 if(entity==='tasks' && p['status'])p['completed_at']=p['status']==='completed'?new Date().toISOString():null;
 const {data,error}=await admin.from(entity).update(p).eq('tenant_id',tenantId).eq('id',id).select('*').single();
 if(error)throw new ApiError(422,'Update rejected by CRM validation');
 await admin.from('audit_events').insert({tenant_id:tenantId,actor_id:cred.created_by,action:'crm.api.updated',entity_type:entity,entity_id:id,metadata:{credential_id:cred.id,fields:Object.keys(p)}});
 return reply({data});
 }
 throw new ApiError(405,'Method not supported');
 }catch(error){if(error instanceof ApiError)return reply({error:error.message},error.status);if(error instanceof z.ZodError)return reply({error:'Invalid request',issues:error.issues.map(i=>({path:i.path,message:i.message}))},422);return reply({error:'Integration request failed'},500);}
}
