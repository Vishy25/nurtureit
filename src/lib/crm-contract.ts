import { z } from 'zod';
export const entities = ['leads','contacts','organizations','opportunities','properties','tasks','enquiries'] as const;
export const entitySchema = z.enum(entities);
export const scopes = ['crm:read','crm:write','crm:assign','crm:references'] as const;
export const sourceSchema = z.string().trim().min(1).max(80).regex(/^[a-zA-Z0-9_-]+$/);
export const externalSchema = z.string().trim().min(1).max(200);
const text = z.string().trim().max(5000).nullable().optional();
const name = z.string().trim().min(1).max(200).optional();
const uuid = z.string().uuid().nullable().optional();
const custom = z.record(z.union([z.string().max(2000),z.number().finite(),z.boolean(),z.null()])).refine(v => Object.keys(v).length <= 50);
const owner = { external_owner_id: externalSchema.nullable().optional(), source_system: sourceSchema.optional() };
export const patches = {
 leads: z.object({full_name:name,email:z.string().email().max(255).nullable().optional(),phone:z.string().max(40).nullable().optional(),notes:text,status:z.enum(['new','accepted','nurturing','disqualified']).optional(),tags:z.array(z.string().max(40)).max(20).optional(),next_action:text,next_action_at:z.string().datetime().nullable().optional(),custom_fields:custom.optional(),...owner}).strict(),
 contacts:z.object({full_name:name,email:z.string().email().max(255).nullable().optional(),phone:z.string().max(40).nullable().optional(),title:name,notes:text,organization_id:uuid,custom_fields:custom.optional(),...owner}).strict(),
 organizations:z.object({name,industry:name,website:z.string().url().max(1000).nullable().optional(),phone:z.string().max(40).nullable().optional(),notes:text,...owner}).strict(),
 opportunities:z.object({name,value:z.number().nonnegative().nullable().optional(),expected_close:z.string().date().nullable().optional(),contact_id:uuid,organization_id:uuid,lead_id:uuid,...owner}).strict(),
 properties:z.object({title:name,location:name,project:name,price:z.number().nonnegative().nullable().optional(),status:z.enum(['available','reserved','sold','inactive']).optional(),notes:text}).strict(),
 tasks:z.object({title:name,notes:text,status:z.enum(['open','done','completed','cancelled']).optional(),due_at:z.string().datetime().nullable().optional(),lead_id:uuid,contact_id:uuid,opportunity_id:uuid,...owner}).strict(),
 enquiries:z.object({message:text,status:z.enum(['new','contacted','qualified','closed']).optional(),budget:z.number().nonnegative().nullable().optional(),timeline:text,contact_id:uuid,opportunity_id:uuid,custom_fields:custom.optional()}).strict(),
};
export const enquirySchema = z.object({source_system:sourceSchema,external_id:externalSchema,property_id:z.string().uuid().optional(),property_external_id:externalSchema.optional(),lead_id:z.string().uuid().optional(),full_name:z.string().trim().min(1).max(200).optional(),email:z.string().trim().email().max(255).optional(),phone:z.string().trim().min(6).max(40).optional(),message:text,budget:z.number().nonnegative().optional(),timeline:z.string().max(100).optional(),custom_fields:custom.optional()}).strict().superRefine((v,c)=>{
 if (Boolean(v.property_id)===Boolean(v.property_external_id)) c.addIssue({code:'custom',message:'Provide exactly one property reference'});
 if (!v.lead_id && (!v.full_name || (!v.email && !v.phone))) c.addIssue({code:'custom',message:'Provide lead_id or full_name and email/phone'});
});
export function canScope(granted: string[], required: string) { return granted.includes(required); }
export function retryDelay(attempt: number) { return Math.min(3600, 30 * 2 ** Math.max(0,attempt-1)); }
export function webhookUrl(raw:string) {
 const u=new URL(raw);
 // Domain names only: literal IPs, internal suffixes, credentials and alternate ports are forbidden.
 if(u.protocol!=='https:' || u.username || u.password || (u.port && u.port!=='443') || u.hash || !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i.test(u.hostname) || /\.(local|localhost|internal|test|invalid|example)$/i.test(u.hostname)) throw new Error('A public HTTPS domain is required');
 return u.toString();
}
