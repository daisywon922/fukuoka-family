/* 사용자 지정 기본 준비물. 구성원 이름으로 전용 항목을 구분합니다. */
(function(root){
  const revision='2026-11-19-v1';
  const nameKey=name=>String(name||'').replace(/\s/g,'');
  const textKey=text=>String(text||'').replace(/\s/g,'').toLowerCase();
  function build(name){
    const who=nameKey(name),both=['안인숙','원예은'].includes(who),won=who==='원예은';
    const leaf=(id,text)=>({id:'pack-'+id,text,checked:false});
    const essentials=[leaf('passport','여권'),leaf('first-aid','비상약'),leaf('phone-charger','휴대폰 충전기 (C-Type)'),leaf('earphones','이어폰'),leaf('power-bank','보조배터리')];
    if(both)essentials.push(leaf('watch-charger','애플워치 충전기'));
    essentials.push(leaf('tissues','물티슈/휴지/손수건'),leaf('umbrella','우산'));
    if(both)essentials.push(leaf('shopping-bag','장바구니'),leaf('sunglasses','선글라스'),leaf('eye-drops','인공눈물'));
    if(won)essentials.push(leaf('contact-lenses','렌즈/렌즈보존액'));
    const cosmetics=[leaf('toner','토너'),leaf('cream','크림'),leaf('sunscreen','썬크림')];
    if(both)cosmetics.push(leaf('foundation','파운데이션'),leaf('compact','팩트'));
    return [
      {id:'pack-essentials',text:'필수품',checked:false,children:essentials},
      {id:'pack-wash',text:'세안도구',checked:false,children:[leaf('toothbrush','치약/칫솔')]},
      {id:'pack-cosmetics',text:'화장품',checked:false,children:cosmetics},
      {id:'pack-clothes',text:'옷',checked:false,children:[leaf('outerwear','외투'),leaf('tops','상의'),leaf('bottoms','하의'),leaf('underwear','속옷'),leaf('socks','양말')]}
    ];
  }
  function identity(text){const key=textKey(text);return key==='충전기'?textKey('휴대폰 충전기 (C-Type)'):key==='선크림'?textKey('썬크림'):key}
  function mergeDefaults(existing,name){
    let remaining=JSON.parse(JSON.stringify(existing||[]));const result=[];
    for(const group of build(name)){
      const old=remaining.find(item=>item.id===group.id||identity(item.text)===identity(group.text));
      if(old)remaining=remaining.filter(item=>item.id!==old.id);
      const children=old?.children||[],used=new Set();
      const merged=group.children.map(child=>{
        let found=children.find(item=>item.id===child.id||identity(item.text)===identity(child.text));
        if(found)used.add(found.id);
        else{found=remaining.find(item=>!item.children?.length&&(item.id===child.id||identity(item.text)===identity(child.text)));if(found)remaining=remaining.filter(item=>item.id!==found.id);}
        if(!found)return child;const copy={...found,text:child.text};delete copy.children;return copy;
      });
      merged.push(...children.filter(item=>!used.has(item.id)));
      result.push({...group,...old,text:group.text,children:merged});
    }
    result.push(...remaining);return root.PersonalChecklist.normalize(result);
  }
  function apply(state){
    const ids=['member-1','member-2','member-3'];let result=state;
    ids.forEach((id,index)=>{
      const name=state.memberNames?.[index]||'',stamp=revision;
      if(state.personalChecklistDefaults?.[id]===stamp)return;
      const items=mergeDefaults(state.personalLists?.[id]||[],name);if(!root.PersonalChecklist.validate(items))return;
      if(result===state)result={...state,personalLists:{...state.personalLists},personalChecklistDefaults:{...state.personalChecklistDefaults}};
      result.personalLists[id]=items;result.personalChecklistDefaults[id]=stamp;
    });return result;
  }
  const api={revision,build,mergeDefaults,apply};root.PersonalChecklistDefaults=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
