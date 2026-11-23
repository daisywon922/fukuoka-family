const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const handlers={},shown=[],opened=[];
const scope='https://example.org/fukuoka-family/';
const self={registration:{scope,showNotification:async(...args)=>shown.push(args)},clients:{matchAll:async()=>[],openWindow:async url=>opened.push(url)},addEventListener:(name,fn)=>handlers[name]=fn};
vm.runInNewContext(fs.readFileSync('push-worker.js','utf8'),{self,URL});
(async()=>{let task;
for(const target of ['schedule','places','overview','records','prepare','memos','info',null,'https://malicious.example/']){
 handlers.push({data:{json:()=>({id:'test',title:'여행 알림',body:'호텔에서 만나요',target,target_detail:'booking:hotel'})},waitUntil:p=>task=p});await task;
 const notification=shown.at(-1);assert.equal(notification[0],'여행 알림');assert.equal(notification[1].body,'호텔에서 만나요');
 handlers.notificationclick({notification:{data:notification[1].data,close(){}},waitUntil:p=>task=p});await task;
 const url=new URL(opened.at(-1));assert.equal(url.origin,'https://example.org');assert.equal(url.pathname,'/fukuoka-family/');assert.equal(url.searchParams.get('readNotice'),'test');if(target&&target!=='https://malicious.example/'){assert.equal(url.searchParams.get('view'),target);assert.equal(url.searchParams.get('detail'),'booking:hotel');}else assert.equal(url.searchParams.get('section'),'notifications');
}
assert.equal(handlers.fetch,undefined);console.log('All six destinations, unspecified/unsafe destination fallback, clicked notice read ID, and no page caching passed');})().catch(e=>{console.error(e);process.exitCode=1});
