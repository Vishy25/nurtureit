import { createClient } from '@supabase/supabase-js';
import { readFile,writeFile } from 'node:fs/promises';
import { randomBytes,createHash } from 'node:crypto';
import type {Database} from '../src/integrations/supabase/types';
const url=process.env['SUPABASE_URL'],adminKey=process.env['SUPABASE_SERVICE_ROLE_KEY'],publicKey=process.env['SUPABASE_PUBLISHABLE_KEY'];
if(!url||!adminKey||!publicKey)throw new Error('Test backend environment required');
const admin=createClient<Database>(url,adminKey,{auth:{persistSession:false}});
const minted=JSON.parse(await readFile(process.env['CRM_TEST_SESSION_FILE']??'/root/.cache/lovable-auth/session.json','utf8'));
const user=createClient<Database>(url,publicKey,{global:{headers:{Authorization:`Bearer ${minted.session.access_token}`}},auth:{persistSession:false}});
const created:{tenantId:string;propertyId:string;keys:Record<string,string>}[]=[];
for(const suffix of ['A','B']){
 const {data:tid,error}=await user.rpc('create_tenant',{_name:`CRM integration verification ${suffix} ${Date.now()}`,_industry:'real_estate',_is_demo:true});if(error)throw error;if(!tid)throw new Error('Workspace missing');
 const {data:property,error:pe}=await admin.from('properties').insert({tenant_id:tid,title:`Verification property ${suffix}`,property_type:'apartment',created_by:minted.user_id}).select().single();if(pe)throw pe;
 const keys:Record<string,string>={};for(const [label,scopes] of Object.entries({full:['crm:read','crm:write','crm:assign','crm:references'],read:['crm:read'],write:['crm:write']})){
 const key='crm_'+randomBytes(32).toString('hex');keys[label]=key;
 const {error}=await admin.from('crm_credentials').insert({tenant_id:tid,name:`Verification ${label}`,key_hash:createHash('sha256').update(key).digest('hex'),key_prefix:key.slice(0,12),scopes,created_by:minted.user_id,expires_at:new Date(Date.now()+86400000).toISOString()});if(error)throw error;
 }
 created.push({tenantId:tid,propertyId:property.id,keys});
}
await writeFile(process.env['CRM_E2E_FIXTURES']??'/tmp/browser/crm/fixtures.json',JSON.stringify({actor:minted.user_id,workspaces:created}),{mode:0o600});
console.log('Created two isolated synthetic integration workspaces.');
