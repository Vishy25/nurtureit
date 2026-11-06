import { Webhook } from 'standardwebhooks';
import { retryDelay,webhookUrl } from './crm-contract';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
export async function assertPublicDestination(raw:string) {
 const url=webhookUrl(raw);const host=new URL(url).hostname;
 for(const type of ['A','AAAA']){
 const response=await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=${type}`,{headers:{accept:'application/dns-json'},signal:AbortSignal.timeout(5000)});
 if(!response.ok)throw new Error('DNS validation unavailable');
 const data=await response.json() as {Answer?:{type:number,data:string}[]};
 for(const answer of data.Answer??[]){if(answer.type===1){const parts=answer.data.split('.').map(Number);const a=parts[0];const b=parts[1];if(a===undefined||b===undefined||a===0||a===10||a===127||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&b===168||a===100&&b>=64&&b<=127||a>=224)throw new Error('Private destination rejected');}
 if(answer.type===28 && !/^2[0-9a-f]{3}:/i.test(answer.data))throw new Error('Private IPv6 destination rejected');}
 }
 return url;
}
export async function dispatchWebhooks(admin:SupabaseClient<Database>,tenant?:string) {
 const {data:jobs,error}=await admin.rpc('crm_claim_deliveries',tenant?{_tenant:tenant}:{});if(error)throw error;
 for(const job of jobs??[]){
 try{
 const {data:hook}=await admin.from('crm_webhooks').select('*').eq('id',job.webhook_id).eq('tenant_id',job.tenant_id).single();
 if(!hook?.enabled)throw new Error('Subscription disabled');
 const url=await assertPublicDestination(hook.url);
 const payload=JSON.stringify(job.payload);const now=new Date();const signature=new Webhook(hook.signing_secret).sign(job.event_id,now,payload);
 const response=await fetch(url,{method:'POST',body:payload,redirect:'error',signal:AbortSignal.timeout(10000),headers:{'content-type':'application/json','webhook-id':job.event_id,'webhook-timestamp':String(Math.floor(now.getTime()/1000)),'webhook-signature':signature}});
 await response.body?.cancel();
 if(!response.ok)throw new Error(`HTTP ${response.status}`);
 const {error:updateError}=await admin.from('crm_deliveries').update({status:'delivered',delivered_at:now.toISOString(),locked_until:null,last_status:response.status,last_error:null}).eq('id',job.id).eq('attempts',job.attempts);if(updateError)throw updateError;
 }catch(e){await admin.from('crm_deliveries').update({status:job.attempts>=8?'failed':'pending',locked_until:null,last_error:e instanceof Error?e.message:'Delivery failed',next_attempt_at:new Date(Date.now()+retryDelay(job.attempts)*1000).toISOString()}).eq('id',job.id).eq('attempts',job.attempts);}
 }
 return {processed:jobs?.length??0};
}
