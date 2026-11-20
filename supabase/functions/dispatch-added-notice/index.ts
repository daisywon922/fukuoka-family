import { createClient } from 'npm:@supabase/supabase-js@2.49.8';
import webpush from 'npm:web-push@3.6.7';
// Invoked ONLY by the database webhook; no browser or family profile can invoke it.
Deno.serve(async req=>{
 const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
 if(req.method!=='POST')return reply({error:'Method not allowed'},405);
 const secret=Deno.env.get('NOTICE_WEBHOOK_SECRET');
 if(!secret||req.headers.get('x-notice-secret')!==secret)return reply({error:'Unauthorized'},401);
 try{
 const input=await req.json();if(input.type!=='INSERT'||input.table!=='family_notices'||input.schema!=='public')return reply({error:'Invalid event'},400);
 const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
 const id=input.record?.id;if(typeof id!=='string')return reply({error:'Invalid id'},400);
 // Read the server row rather than trusting event-supplied recipients or content.
 const {data:notice,error:noticeError}=await db.from('family_notices').select('*').eq('id',id).eq('source','automatic').maybeSingle();
 if(noticeError)throw noticeError;if(!notice)return reply({skipped:true});
 const pub=Deno.env.get('VAPID_PUBLIC_KEY'),priv=Deno.env.get('VAPID_PRIVATE_KEY'),subject=Deno.env.get('VAPID_SUBJECT');
 if(!pub||!priv||!subject)return reply({error:'Push setup required'},503);
 const {data:claimed,error:claimError}=await db.from('family_notices').update({push_claimed_at:new Date().toISOString()}).eq('id',id).is('push_claimed_at',null).select('id');
 if(claimError)throw claimError;if(!claimed?.length)return reply({duplicate:true});
 webpush.setVapidDetails(subject,pub,priv);
 const {data:subs,error:subError}=await db.from('family_push_subscriptions').select('user_id,endpoint,subscription,preferences').eq('family_id',notice.family_id);if(subError)throw subError;
 const requestId=notice.id,title=notice.title,body=notice.body,target=notice.target,target_detail=notice.target_detail;
 let sent=0,failed=0;
 const kind=notice.target==='schedule'?'schedule':notice.target==='records'?'expense':notice.target==='memos'?'memo':null;
 await Promise.all((subs||[]).filter(sub=>kind&&sub.preferences?.[kind]!==false).map(async sub=>{try{
 // Validate again before any outbound request (avoid arbitrary endpoint requests).
 const url=new URL(sub.endpoint);if(url.protocol!=='https:'||url.port||!(/^(fcm\.googleapis\.com|[a-z0-9.-]+\.push\.services\.mozilla\.com|web\.push\.apple\.com)$/.test(url.hostname)))throw Error('Invalid push endpoint');
 await webpush.sendNotification(sub.subscription,JSON.stringify({id:requestId,title:title.trim(),body:body.trim(),target,target_detail}),{TTL:86400,timeout:10000});sent++;
 }catch(e){failed++;if(e.statusCode===404||e.statusCode===410)await db.from('family_push_subscriptions').delete().eq('user_id',sub.user_id).eq('endpoint',sub.endpoint)}}));
 return reply({sent,failed});
 }catch{return reply({error:'Dispatch failed'},500)}
});
