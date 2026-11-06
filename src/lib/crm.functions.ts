import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { scopes,entities,webhookUrl } from './crm-contract';
import { sha256Hex } from './intake.server';
const schema=z.object({tenantId:z.string().uuid(),action:z.enum(['key','webhook','dispatch','retry']),deliveryId:z.string().uuid().optional(),name:z.string().trim().min(1).max(100).optional(),scopes:z.array(z.enum(scopes)).min(1).optional(),url:z.string().max(2000).optional(),events:z.array(z.string().max(80)).min(1).max(14).optional()});
export const manageCrm=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(d=>schema.parse(d)).handler(async({data,context})=>{
 const {data:membership}=await context.supabase.from('memberships').select('role').eq('tenant_id',data.tenantId).eq('user_id',context.userId).eq('status','active').maybeSingle();
 if(membership?.role!=='tenant_admin')throw new Error('Workspace administrator required');
 const {supabaseAdmin:admin}=await import('@/integrations/supabase/client.server');
 if(data.action==='key'){
 const key='crm_'+Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
 const {error}=await admin.from('crm_credentials').insert({tenant_id:data.tenantId,name:z.string().min(1).parse(data.name),scopes:z.array(z.enum(scopes)).min(1).parse(data.scopes),key_hash:await sha256Hex(key),key_prefix:key.slice(0,12),created_by:context.userId,expires_at:new Date(Date.now()+90*86400000).toISOString()});if(error)throw error;return {secret:key};
 }
 const {assertPublicDestination,dispatchWebhooks}=await import('./crm-webhooks.server');
 if(data.action==='retry'){
 const id=z.string().uuid().parse(data.deliveryId);
 const {error}=await admin.from('crm_deliveries').update({status:'pending',attempts:0,next_attempt_at:new Date().toISOString(),locked_until:null}).eq('id',id).eq('tenant_id',data.tenantId).eq('status','failed');if(error)throw error;
 return {processed:(await dispatchWebhooks(admin,data.tenantId)).processed};
 }
 if(data.action==='dispatch')return {processed:(await dispatchWebhooks(admin,data.tenantId)).processed};
 const url=await assertPublicDestination(webhookUrl(z.string().parse(data.url)));
 const events=z.array(z.string()).min(1).parse(data.events);if(events.some(e=>!entities.some(t=>e===`${t}.created`||e===`${t}.updated`)))throw new Error('Unsupported event');
 const bytes=crypto.getRandomValues(new Uint8Array(32));const secret='whsec_'+btoa(String.fromCharCode(...bytes));
 const {error}=await admin.from('crm_webhooks').insert({tenant_id:data.tenantId,name:z.string().min(1).parse(data.name),url,signing_secret:secret,events,created_by:context.userId});if(error)throw error;
 return {secret};
});
