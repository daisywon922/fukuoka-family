/* 기기에서 바꾼 필드만 최신 서버 데이터에 병합합니다. */
(function(root){
  const clone=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
  const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
  function merge(base,local,remote,key=''){
    if(same(base,local))return clone(remote);
    if(same(base,remote)||same(local,remote))return clone(local);
    if(Array.isArray(base)&&Array.isArray(local)&&Array.isArray(remote)){
      if(['deletedEventIds','deletedBookingIds'].includes(key)){
        return [...new Set([...remote.filter(id=>!base.includes(id)||local.includes(id)),...local.filter(id=>!base.includes(id))])];
      }
      if(['names','memberNames'].includes(key))return local.map((value,i)=>merge(base[i],value,remote[i]));
      if(['records','commonChecklist'].includes(key)||key.startsWith('member-')){
        const result=[],b=new Map(base.map(x=>[x.id,x])),l=new Map(local.map(x=>[x.id,x])),r=new Map(remote.map(x=>[x.id,x]));
        // 이 기기에서 순서를 바꾼 경우 해당 순서를 우선하고 양쪽의 새 항목은 남깁니다.
        const order=same(base.map(x=>x.id),local.map(x=>x.id))?remote:local;
        for(const id of new Set([...order.map(x=>x.id),...remote.map(x=>x.id),...local.map(x=>x.id)])){
          const value=merge(b.get(id),l.get(id),r.get(id));if(value!==undefined)result.push(value);
        }return result;
      }
    }
    if(object(local)&&object(remote)&&(object(base)||base===undefined)){
      const result={};for(const name of new Set([...Object.keys(base||{}),...Object.keys(local),...Object.keys(remote)])){
        const value=merge(base?.[name],local[name],remote[name],name);if(value!==undefined)result[name]=value;
      }return result;
    }
    // 같은 필드를 동시에 수정했다면 나중에 서버에 저장하는 변경이 우선합니다.
    return clone(local);
  }
  root.FamilyMerge={merge,clone,same};
  if(typeof module!=='undefined')module.exports=root.FamilyMerge;
})(globalThis);
