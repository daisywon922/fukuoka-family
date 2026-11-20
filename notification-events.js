/* New-item detection and display formatting shared by isolated previews and tests. */
(function(root){
 const dateLabel=value=>{const d=new Date(value+'T12:00:00+09:00');return Number(value.slice(5,7))+'월 '+Number(value.slice(8,10))+'일 ('+'일월화수목금토'[d.getUTCDay()]+')'};
 const amount=r=>Number(r.amount).toLocaleString('ko-KR')+(r.currency==='JPY'?'':'원');
 function entries(data){const items=[];for(const [id,p]of Object.entries(data.eventOverrides||{}))if(!(data.deletedEventIds||[]).includes(id))items.push({key:'event:'+id,kind:'schedule',title:'새로운 일정이 추가되었어요',body:dateLabel(p.date)+' '+(p.event?.title||'새 일정'),target:'schedule',target_detail:'event:'+id});for(const r of data.records||[]){if(r.type==='expense')items.push({key:'expense:'+r.id,kind:'expense',title:'새로운 지출내역이 등록되었어요',body:(r.category||'기타')+' • '+(r.currency==='JPY'?'¥ ':'')+amount(r),target:'records',target_detail:'expense:'+r.id});if(r.type==='memo'){const index=r.authorId?['member-1','member-2','member-3'].indexOf(r.authorId):r.payer;items.push({key:'memo:'+r.id,kind:'memo',title:'새로운 메모가 추가되었어요',body:'작성자: '+(data.memberNames?.[index]||'구성원'),target:'memos',target_detail:'memo:'+r.id})}}return items}
 function added(before,after,seen=new Set()){for(const item of entries(before))seen.add(item.key);return entries(after).filter(item=>{if(seen.has(item.key))return false;seen.add(item.key);return true})}
 const api={entries,added};if(typeof module!=='undefined')module.exports=api;else root.NoticeEvents=api;
})(typeof window==='undefined'?globalThis:window);
