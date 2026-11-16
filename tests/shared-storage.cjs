const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {merge,clone,same}=require('../shared-merge.js');
const seed={names:['🌼','🐻','👸🏻'],checks:{a:false,b:false},records:[]};
let row={owner_id:'family',revision:1,data:clone(seed)},online=true;
function node(){return {hidden:false,open:false,style:{},classList:{},setAttribute(){},prepend(){},append(){},querySelector(){return node()},querySelectorAll(){return []},addEventListener(){},close(){this.open=false},showModal(){this.open=true}}}
function device(){
 const store=new Map(),nodes=new Map(),get=id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id)};
 const client={auth:{getSession:async()=>({data:{session:{user:{id:'family'}}}})},from(){return {select(){return this},eq(){return this},async maybeSingle(){if(!online)throw Error('offline');return {data:clone(row)};}}},async rpc(name,args){if(name==='current_family')return {data:'family'};if(name==='redeem_family_invite')return {data:'family'};if(!online)throw Error('offline');if(args.expected_revision!==row.revision)return {data:[]};row={...row,revision:row.revision+1,data:clone(args.next_data)};return {data:[clone(row)]}},channel(){return {on(){return this},subscribe(){return this}}},removeChannel:async()=>{}};
 const context=vm.createContext({console,location:{hash:'',pathname:'/',search:''},URLSearchParams,history:{replaceState(){}},FamilyMerge:{merge,clone,same},window:{FUKUOKA_SHARED_CONFIG:{url:'test',publishableKey:'test'},addEventListener(){}},document:{hidden:false,createElement:node,querySelector:selector=>selector==='dialog[open]'?node():get(selector),querySelectorAll:()=>[],addEventListener(){},body:node()},navigator:{onLine:true},localStorage:{setItem:(k,v)=>store.set(k,v),getItem:k=>store.get(k)||null,removeItem:k=>store.delete(k)},setInterval(){},setTimeout,KEY:'test',state:clone(seed),save(){return true},toast(){},valid:()=>true,currentProfileId:'member-1',createClient:()=>client});
 const code=fs.readFileSync(require.resolve('../shared-storage.js'),'utf8').replace("await import('https://esm.sh/@supabase/supabase-js@2.49.8')","await Promise.resolve({createClient:globalThis.createClient})");
 const started=vm.runInContext(code,context);return {context,started};
}
const settle=()=>new Promise(resolve=>setTimeout(resolve,40));
(async()=>{
 const a=device(),b=device();await Promise.all([a.started,b.started]);await settle();
 vm.runInContext('state.checks.a=true;save()',a.context);
 vm.runInContext('state.checks.b=true;save()',b.context);await settle();
 assert.deepEqual(row.data.checks,{a:true,b:true});
 vm.runInContext("state.records.push({id:'one',text:'meal'});save()",a.context);
 vm.runInContext("state.records.push({id:'two',text:'bus'});save()",b.context);await settle();
 assert.equal(row.data.records.length,2);
 online=false;vm.runInContext("state.records.push({id:'offline',text:'hotel'});save()",a.context);await settle();
 assert.equal(row.data.records.length,2);
 online=true;vm.runInContext('save()',a.context);await settle();assert.equal(row.data.records.length,3);
 assert.equal(a.context.localStorage.getItem('test-shared-outbox'),null);
 console.log('Two-device concurrent edits, additions, offline retry and outbox checks passed');
})().catch(error=>{console.error(error);process.exitCode=1});
