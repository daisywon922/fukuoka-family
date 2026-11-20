import { createClient } from 'npm:@supabase/supabase-js@2.49.8';
import webpush from 'npm:web-push@3.6.7';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'};
Deno.serve(async req=>{
 const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return reply({error:'Method not allowed'},405);
 try{
 const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
 const token=(req.headers.get('Authorization')||'').replace(/^Bearer /,'');
 const {data:{user},error:authError}=await db.auth.getUser(token);
 if(authError||!user||user.is_anonymous)return reply({error:'Unauthorized'},401);
 // Only the stable family owner account can publish, never a selected profile.
 const {data:trip,error:tripError}=await db.from('family_trip').select('owner_id').eq('owner_id',user.id).maybeSingle();
 if(tripError)throw tripError;if(!trip)return reply({error:'Forbidden'},403);
 const input=await req.json(),{title,body,requestId,target=null,target_detail=null}=input;
 if(typeof title!=='string'||!title.trim()||title.length>60||typeof body!=='string'||!body.trim()||body.length>500||typeof requestId!=='string'||!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(requestId))return reply({error:'Invalid notice'},400);
 if(target!==null&&!['schedule','places','overview','records','prepare','memos'].includes(target))return reply({error:'Invalid destination'},400);
 if(target_detail!==null&&(target===null||typeof target_detail!=='string'||target_detail.length>240||! /^(day|event|booking|expense|place|memo|check):.+$/.test(target_detail)))return reply({error:'Invalid detail'},400);
 const pub=Deno.env.get('VAPID_PUBLIC_KEY'),priv=Deno.env.get('VAPID_PRIVATE_KEY'),subject=Deno.env.get('VAPID_SUBJECT');
 if(!pub||!priv||!subject)return reply({error:'Push setup required'},503);
 webpush.setVapidDetails(subject,pub,priv);
 const {data:subs,error:subError}=await db.from('family_push_subscriptions').select('user_id,endpoint,subscription').eq('family_id',user.id);if(subError)throw subError;
 const {error}=await db.from('family_notices').insert({id:requestId,family_id:user.id,title:title.trim(),body:body.trim(),target,target_detail});
 if(error?.code==='23505')return reply({saved:true,duplicate:true});if(error)throw error;
 let sent=0,failed=0;
 await Promise.all((subs||[]).map(async sub=>{try{
 // Validate again before any outbound request (avoid arbitrary endpoint requests).
 const url=new URL(sub.endpoint);if(url.protocol!=='https:'||url.port||!(/^(fcm\.googleapis\.com|[a-z0-9.-]+\.push\.services\.mozilla\.com|web\.push\.apple\.com)$/.test(url.hostname)))throw Error('Invalid push endpoint');
 await webpush.sendNotification(sub.subscription,JSON.stringify({id:requestId,title:title.trim(),body:body.trim(),target,target_detail}),{TTL:86400,timeout:10000});sent++;
 }catch(e){failed++;if(e.statusCode===404||e.statusCode===410)await db.from('family_push_subscriptions').delete().eq('user_id',sub.user_id).eq('endpoint',sub.endpoint)}}));
 return reply({saved:true,sent,failed});
 }catch{return reply({error:'Notice request failed'},500)}
});
