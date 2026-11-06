import {describe,it,expect,beforeAll} from 'vitest';
import {readFile} from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';
import {Webhook} from 'standardwebhooks';
import {dispatchWebhooks} from '../src/lib/crm-webhooks.server';
import type {Database} from '../src/integrations/supabase/types';
type Workspace={tenantId:string;propertyId:string;keys:{full:string;read:string;write:string}};
const fixture=process.env['CRM_E2E_FIXTURES'];
const suite=fixture?describe:describe.skip;
suite('connected website → CRM workflow',()=>{
 let A:Workspace,B:Workspace,actor:string,leadId:string,enquiryId:string;
 const admin=createClient<Database>(process.env['SUPABASE_URL']??'http://localhost',process.env['SUPABASE_SERVICE_ROLE_KEY']??'test',{auth:{persistSession:false}});
 async function api(path:string,key:string,method='GET',payload?:unknown){const response=await fetch(`http://localhost:8080/api/crm/v1/${path}`,{method,headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},...(payload?{body:JSON.stringify(payload)}:{})});return {status:response.status,body:await response.json()};}
 beforeAll(async()=>{const f=JSON.parse(await readFile(fixture??'','utf8'));[A,B]=f.workspaces;actor=f.actor;});
 it('requires authentication',async()=>expect((await api('leads','invalid')).status).toBe(401));
 it('registers and looks up website property IDs',async()=>{
 expect((await api('references',A.keys.full,'PUT',{source_system:'estateorbit',entity_type:'properties',external_id:'unit-101',entity_id:A.propertyId})).status).toBe(200);
 const r=await api('properties?source_system=estateorbit&external_id=unit-101',A.keys.full);expect(r.body.data.id).toBe(A.propertyId);
 });
 it('creates a linked enquiry and unassigned lead atomically',async()=>{
 const r=await api('enquiries',A.keys.full,'POST',{source_system:'estateorbit',external_id:'visit-001',property_external_id:'unit-101',full_name:'Synthetic Visitor',email:'synthetic-crm@example.com',message:'Please arrange a viewing',budget:500000,timeline:'this month'});
 expect(r.status).toBe(201);leadId=r.body.enquiry.lead_id;enquiryId=r.body.enquiry.id;expect(r.body.enquiry.property_id).toBe(A.propertyId);
 const lead=await api(`leads/${leadId}`,A.keys.full);expect(lead.body.data.owner_id).toBeNull();
 const tasks=await api('tasks',A.keys.full);expect(tasks.body.data.some((t:{lead_id:string})=>t.lead_id===leadId)).toBe(true);
 });
 it('concurrent replay creates no duplicate enquiry or lead',async()=>{
 const request={source_system:'estateorbit',external_id:'visit-001',property_id:A.propertyId,lead_id:leadId};
 const results=await Promise.all([api('enquiries',A.keys.full,'POST',request),api('enquiries',A.keys.full,'POST',request)]);
 for(const r of results){expect(r.status).toBe(200);expect(r.body.enquiry.id).toBe(enquiryId);expect(r.body.replayed).toBe(true);}
 });
 it('preserves a repeat visitor enquiry for another property',async()=>{
 const {data:property,error}=await admin.from('properties').insert({tenant_id:A.tenantId,title:'Second verification property',property_type:'apartment',created_by:actor}).select().single();expect(error).toBeNull();if(!property)throw new Error('Property missing');
 const r=await api('enquiries',A.keys.full,'POST',{source_system:'estateorbit',external_id:'visit-002',property_id:property.id,full_name:'Synthetic Visitor',email:'synthetic-crm@example.com',message:'Second enquiry'});
 expect(r.status).toBe(201);expect(r.body.enquiry.lead_id).toBe(leadId);expect(r.body.enquiry.id).not.toBe(enquiryId);
 const list=await api(`enquiries?lead_id=${leadId}`,A.keys.full);expect(list.body.data.length).toBe(2);
 });
 it('reads and updates the lead independently of loaded UI rows',async()=>{const r=await api(`leads/${leadId}`,A.keys.full,'PATCH',{notes:'Website update verified'});expect(r.status).toBe(200);expect((await api(`leads/${leadId}`,A.keys.full)).body.data.notes).toBe('Website update verified');});
 it('read-only keys cannot update',async()=>expect((await api(`leads/${leadId}`,A.keys.read,'PATCH',{notes:'forbidden'})).status).toBe(403));
 it('write-only keys cannot read',async()=>expect((await api(`leads/${leadId}`,A.keys.write)).status).toBe(403));
 it('maps an active workspace owner and requires assignment scope',async()=>{
 expect((await api('owners',A.keys.full,'PUT',{source_system:'estateorbit',external_owner_id:'agent-1',user_id:actor})).status).toBe(200);
 expect((await api(`leads/${leadId}`,A.keys.write,'PATCH',{source_system:'estateorbit',external_owner_id:'agent-1'})).status).toBe(403);
 const r=await api(`leads/${leadId}`,A.keys.full,'PATCH',{source_system:'estateorbit',external_owner_id:'agent-1'});expect(r.body.data.owner_id).toBe(actor);
 });
 it('rejects unknown owners',async()=>expect((await api(`leads/${leadId}`,A.keys.full,'PATCH',{source_system:'estateorbit',external_owner_id:'missing'})).status).toBe(422));
 it('workspace B cannot read, update or link workspace A records',async()=>{
 expect((await api(`leads/${leadId}`,B.keys.full)).status).toBe(404);
 expect((await api(`leads/${leadId}`,B.keys.full,'PATCH',{notes:'intrusion'})).status).toBe(404);
 expect((await api('enquiries',B.keys.full,'POST',{source_system:'estateorbit',external_id:'attack',property_id:A.propertyId,full_name:'Attacker',email:'attack@example.com'})).status).toBe(422);
 expect((await api('references',B.keys.full,'PUT',{source_system:'estateorbit',entity_type:'leads',external_id:'attack',entity_id:leadId})).status).toBe(404);
 });
 it('rejects cross-workspace enquiry foreign keys at database level',async()=>{const {error}=await admin.from('enquiries').insert({tenant_id:B.tenantId,lead_id:leadId,property_id:B.propertyId,source_system:'verification',external_id:'bad-fk',created_by:actor});expect(error?.code).toBe('23503');});
 it('paginates and rejects oversized pages',async()=>{expect((await api('leads?limit=101',A.keys.full)).status).toBe(422);expect((await api('enquiries?limit=1',A.keys.full)).body.next_offset).toBe(1);});
 it('contacts and tasks cannot be read across workspaces',async()=>{
 const {data:contact,error}=await admin.from('contacts').insert({tenant_id:A.tenantId,full_name:'Synthetic Contact',created_by:actor}).select().single();expect(error).toBeNull();if(!contact)throw new Error('Contact missing');
 expect((await api(`contacts/${contact.id}`,B.keys.full)).status).toBe(404);
 const tasks=await api('tasks',A.keys.full);expect(tasks.body.data.length).toBeGreaterThan(0);expect((await api(`tasks/${tasks.body.data[0].id}`,B.keys.full)).status).toBe(404);
 expect((await api(`contacts/${contact.id}`,A.keys.full,'PATCH',{notes:'Connected contact update'})).status).toBe(200);
 expect((await api(`tasks/${tasks.body.data[0].id}`,A.keys.full,'PATCH',{status:'completed'})).body.data.completed_at).toBeTruthy();
 });
 it('expired keys and inactive credential administrators are rejected',async()=>{
 const {data:keys}=await admin.from('crm_credentials').select('id').eq('tenant_id',B.tenantId).eq('name','Verification read');if(!keys?.[0])throw new Error('Key missing');
 await admin.from('crm_credentials').update({expires_at:new Date(Date.now()-1000).toISOString()}).eq('id',keys[0].id);expect((await api('leads',B.keys.read)).status).toBe(401);
 await admin.from('memberships').update({status:'deactivated'}).eq('tenant_id',B.tenantId).eq('user_id',actor);
 try{expect((await api('leads',B.keys.full)).status).toBe(403);}finally{await admin.from('memberships').update({status:'active'}).eq('tenant_id',B.tenantId).eq('user_id',actor);}
 });
 it('the 121st request is blocked at the exact limit',async()=>{
 const {data:keys}=await admin.from('crm_credentials').select('id').eq('tenant_id',B.tenantId).eq('name','Verification full');if(!keys?.[0])throw new Error('Key missing');
 await admin.from('crm_credentials').update({window_start:new Date().toISOString(),request_count:119}).eq('id',keys[0].id);
 expect((await api('leads',B.keys.full)).status).toBe(200);expect((await api('leads',B.keys.full)).status).toBe(429);
 await admin.from('crm_credentials').update({request_count:0}).eq('id',keys[0].id);
 });
 it('conversion links enquiries to the resulting contact and deal',async()=>{
 const {data:session}=JSON.parse(await readFile('/root/.cache/lovable-auth/session.json','utf8')).session?{data:JSON.parse(await readFile('/root/.cache/lovable-auth/session.json','utf8')).session}:{data:null};if(!session)throw new Error('Session missing');
 const user=createClient<Database>(process.env['SUPABASE_URL']??'',process.env['SUPABASE_PUBLISHABLE_KEY']??'',{global:{headers:{Authorization:`Bearer ${session.access_token}`}},auth:{persistSession:false}});
 const {data:deal,error}=await user.rpc('convert_lead',{_lead_id:leadId,_deal_name:'Verification deal'});expect(error).toBeNull();
 const read=await api(`enquiries/${enquiryId}`,A.keys.full);expect(read.body.data.opportunity_id).toBe(deal);expect(read.body.data.contact_id).toBeTruthy();
 });
 it('webhook outbox sends a verifiable signature and retries safely',async()=>{
 const secret='whsec_'+btoa(String.fromCharCode(...new Uint8Array(32).fill(7)));
 const {data:hook,error}=await admin.from('crm_webhooks').insert({tenant_id:A.tenantId,name:'Synthetic receiver',url:'https://receiver.company.com/events',signing_secret:secret,events:['leads.updated'],created_by:actor}).select().single();expect(error).toBeNull();if(!hook)throw new Error('Hook missing');
 await api(`leads/${leadId}`,A.keys.full,'PATCH',{notes:'Webhook verification'});
 const original=globalThis.fetch;let received=0;let reject=true;
 globalThis.fetch=(async(input:RequestInfo|URL,init?:RequestInit)=>{
 const url=String(input);if(url.startsWith('https://cloudflare-dns.com/'))return Response.json({Answer:[{type:1,data:'93.184.216.34'}]});
 return original(input,init);
 }) as typeof fetch;
 const send=async(url:string,address:string,body:string,headers:Record<string,string>)=>{expect(url).toBe('https://receiver.company.com/events');expect(address).toBe('93.184.216.34');new Webhook(secret).verify(body,headers);received++;return reject?503:200;};
 try{
 await dispatchWebhooks(admin,A.tenantId,send);
 let {data:deliveries}=await admin.from('crm_deliveries').select('*').eq('webhook_id',hook.id);expect(deliveries?.[0]?.status).toBe('pending');expect(deliveries?.[0]?.attempts).toBe(1);
 await admin.from('crm_deliveries').update({next_attempt_at:new Date().toISOString()}).eq('webhook_id',hook.id);reject=false;
 await dispatchWebhooks(admin,A.tenantId,send);
 ({data:deliveries}=await admin.from('crm_deliveries').select('*').eq('webhook_id',hook.id));expect(deliveries?.[0]?.status).toBe('delivered');expect(deliveries?.[0]?.attempts).toBe(2);expect(received).toBe(2);
 }finally{globalThis.fetch=original;await admin.from('crm_webhooks').update({enabled:false}).eq('id',hook.id);}
 });
 it('revoked keys stop working immediately',async()=>{
 const {data:keys}=await admin.from('crm_credentials').select('id').eq('tenant_id',A.tenantId).eq('name','Verification read');if(!keys?.[0])throw new Error('Key missing');await admin.from('crm_credentials').update({revoked_at:new Date().toISOString()}).eq('id',keys[0].id);
 expect((await api('leads',A.keys.read)).status).toBe(401);
 });
});
