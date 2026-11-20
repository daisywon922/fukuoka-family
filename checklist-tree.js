/* 개인 체크리스트: 기존 한 단계 목록과 두 단계 목록을 함께 지원합니다. */
(function(root){
  const maxTotal=100,maxRoots=50,maxChildren=30;
  const children=item=>Array.isArray(item?.children)?item.children:[];
  const total=items=>items.reduce((n,item)=>n+1+children(item).length,0);
  function validate(items){
    if(!Array.isArray(items)||items.length>maxRoots||total(items)>maxTotal)return false;
    const seen=new Set();
    const leaf=item=>{if(!item||typeof item.id!=='string'||!item.id||item.id.length>100||seen.has(item.id)||typeof item.text!=='string'||!item.text.trim()||item.text.length>80||typeof item.checked!=='boolean')return false;seen.add(item.id);return true};
    return items.every(item=>leaf(item)&&(item.children===undefined||Array.isArray(item.children)&&item.children.length<=maxChildren&&item.children.every(child=>leaf(child)&&child.children===undefined)));
  }
  function normalize(items){return items.map(item=>{const result={...item,text:item.text.trim()};if(item.children!==undefined){result.children=children(item).map(child=>({...child,text:child.text.trim()}));if(result.children.length)result.checked=result.children.every(child=>child.checked)}return result})}
  function toggle(items,id,checked){return normalize(items.map(item=>item.id===id?{...item,checked,...(children(item).length?{children:children(item).map(child=>({...child,checked}))}:{})}:{...item,...(item.children?{children:children(item).map(child=>child.id===id?{...child,checked}:child)}:{})}))}
  function progress(items){const leaves=items.flatMap(item=>children(item).length?children(item):[item]);return {done:leaves.filter(item=>item.checked).length,total:leaves.length}}
  function move(items,from,to,parentId=null){const result=items.map(item=>({...item,...(item.children?{children:item.children.map(child=>({...child}))}:{})})),list=parentId?result.find(item=>item.id===parentId)?.children:result;if(!list||from<0||to<0||from>=list.length||to>=list.length||from===to)return result;const [item]=list.splice(from,1);list.splice(to,0,item);return result}
  const api={children,total,validate,normalize,toggle,progress,move,maxTotal,maxRoots,maxChildren};root.PersonalChecklist=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
