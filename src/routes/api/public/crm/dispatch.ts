import {createFileRoute} from '@tanstack/react-router';
import {sha256Hex} from '@/lib/intake.server';
export const Route=createFileRoute('/api/public/crm/dispatch')({server:{handlers:{POST:async({request})=>{
 const token=/^Bearer ([a-f0-9]{64})$/.exec(request.headers.get('authorization')??'')?.[1];
 if(!token)return new Response('Unauthorized',{status:401});
 const {supabaseAdmin:admin}=await import('@/integrations/supabase/client.server');
 const {data,error}=await admin.rpc('crm_consume_wake',{_hash:await sha256Hex(token)});
 if(error || !data)return new Response('Unauthorized',{status:401});
 const {dispatchWebhooks}=await import('@/lib/crm-webhooks.server');await dispatchWebhooks(admin);
 return Response.json({accepted:true});
}}});
