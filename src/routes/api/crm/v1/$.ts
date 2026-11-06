import { createFileRoute } from '@tanstack/react-router';
import { handleCrm } from '@/lib/crm.server';
export const Route=createFileRoute('/api/crm/v1/$')({server:{handlers:{
 GET:({request,params})=>handleCrm(request,params._splat??''),
 PATCH:({request,params})=>handleCrm(request,params._splat??''),
 POST:({request,params})=>handleCrm(request,params._splat??''),
 PUT:({request,params})=>handleCrm(request,params._splat??''),
}}});
