import {describe,it,expect} from 'vitest';
import {enquirySchema,patches,canScope,webhookUrl,retryDelay} from './crm-contract';
import {Webhook} from 'standardwebhooks';
describe('CRM integration safety',()=>{
 it('requires property-linked enquiries',()=>expect(enquirySchema.safeParse({source_system:'website',external_id:'1',full_name:'Jane Doe',email:'jane@example.com'}).success).toBe(false));
 it('accepts website property references',()=>expect(enquirySchema.parse({source_system:'website',external_id:'1',property_external_id:'unit-1',full_name:'Jane Doe',email:'jane@example.com'}).property_external_id).toBe('unit-1'));
 it('does not permit caller-supplied workspace changes',()=>expect(patches.leads.safeParse({tenant_id:'00000000-0000-4000-8000-000000000001'}).success).toBe(false));
 it('does not permit direct owner IDs',()=>expect(patches.leads.safeParse({owner_id:'00000000-0000-4000-8000-000000000001'}).success).toBe(false));
 it('read keys cannot update',()=>expect(canScope(['crm:read'],'crm:write')).toBe(false));
 it('write keys cannot assign',()=>expect(canScope(['crm:write'],'crm:assign')).toBe(false));
 it('commercial closure is not an unrestricted API patch',()=>expect(patches.opportunities.safeParse({state:'won',stage:'closed_won'}).success).toBe(false));
 it.each(['http://receiver.com','https://127.0.0.1','https://receiver.local','https://receiver.com:8443','https://user:pass@receiver.com'])('rejects unsafe destinations %s',url=>expect(()=>webhookUrl(url)).toThrow());
 it('verifies signatures and rejects tampering',()=>{const w=new Webhook(new Uint8Array(32).fill(3));const body=JSON.stringify({type:'enquiries.created'});const now=new Date();const headers={'webhook-id':'event-1','webhook-timestamp':String(Math.floor(now.getTime()/1000)),'webhook-signature':w.sign('event-1',now,body)};expect(w.verify(body,headers)).toEqual({type:'enquiries.created'});expect(()=>w.verify('{}',headers)).toThrow();});
 it('backs off retries with a one-hour cap',()=>{expect(retryDelay(1)).toBe(30);expect(retryDelay(8)).toBe(3600);});
});
