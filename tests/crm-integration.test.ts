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
 const r=await api('enquiries',A.keys.full,'POST',{source_system:'estateorbit',external_id:'visit-002',property_id:A.propertyId,full_name:'Synthetic Visitor',email:'synthetic-crm@example.com',message:'Second enquiry'});
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
 it('webhook outbox sends a verifiable signature and retries safely',async()=>{
 const secret='whsec_'+btoa(String.fromCharCode(...new Uint8Array(32).fill(7)));
 const {data:hook,error}=await admin.from('crm_webhooks').insert({tenant_id:A.tenantId,name:'Synthetic receiver',url:'https://receiver.company.com/events',signing_secret:secret,events:['leads.updated'],created_by:actor}).select().single();expect(error).toBeNull();if(!hook)throw new Error('Hook missing');
 await api(`leads/${leadId}`,A.keys.full,'PATCH',{notes:'Webhook verification'});
 const original=globalThis.fetch;let received=0;let reject=true;
 globalThis.fetch=(async(input:RequestInfo|URL,init?:RequestInit)=>{
 const url=String(input);if(url.startsWith('https://cloudflare-dns.com/'))return Response.json({Answer:[{type:1,data:'93.184.216.34'}]});
 if(url==='https://receiver.company.com/events'){const headers=new Headers(init?.headers);new Webhook(secret).verify(String(init?.body),{'webhook-id':headers.get('webhook-id')??'','webhook-timestamp':headers.get('webhook-timestamp')??'','webhook-signature':headers.get('webhook-signature')??''});received++;return new Response('',{status:reject?503:200});}
 return original(input,init);
 }) as typeof fetch;
 try{
 await dispatchWebhooks(admin,A.tenantId);
 let {data:deliveries}=await admin.from('crm_deliveries').select('*').eq('webhook_id',hook.id);expect(deliveries?.[0]?.status).toBe('pending');expect(deliveries?.[0]?.attempts).toBe(1);
 await admin.from('crm_deliveries').update({next_attempt_at:new Date().toISOString()}).eq('webhook_id',hook.id);reject=false;
 await dispatchWebhooks(admin,A.tenantId);
 ({data:deliveries}=await admin.from('crm_deliveries').select('*').eq('webhook_id',hook.id));expect(deliveries?.[0]?.status).toBe('delivered');expect(deliveries?.[0]?.attempts).toBe(2);expect(received).toBe(2);
 }finally{globalThis.fetch=original;await admin.from('crm_webhooks').update({enabled:false}).eq('id',hook.id);}
 });
 it('revoked keys stop working immediately',async()=>{
 const {data:keys}=await admin.from('crm_credentials').select('id').eq('tenant_id',A.tenantId).eq('name','Verification read');if(!keys?.[0])throw new Error('Key missing');await admin.from('crm_credentials').update({revoked_at:new Date().toISOString()}).eq('id',keys[0].id);
 expect((await api('leads',A.keys.read)).status).toBe(401);
 });
});
