import { request } from 'node:https';
/** Pin the DNS-validated IPv4 address while retaining the original TLS hostname. */
export function pinnedPost(url:string,address:string,body:string,headers:Record<string,string>):Promise<number>{
 return new Promise((resolve,reject)=>{
 const u=new URL(url);
 const req=request(u,{method:'POST',headers,lookup:(_hostname,options,callback)=>{
 if(typeof options==='object' && options.all) callback(null,[{address,family:4}]);
 else callback(null,address,4);
 },timeout:10000},res=>{res.resume();resolve(res.statusCode??500);});
 req.on('timeout',()=>req.destroy(new Error('Delivery timeout')));req.on('error',reject);req.end(body);
 });
}
