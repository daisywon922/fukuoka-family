// 필수 여부는 실제 required 속성으로 판단합니다. 동적으로 만들어진 예약 필드도 같은 표시를 씁니다.
(function(){
  function prepareLabels(){
    document.querySelectorAll('dialog label.field').forEach(label=>{
      if(label.querySelector(':scope > .field-caption'))return;
      const text=[...label.childNodes].find(node=>node.nodeType===3&&node.textContent.trim());
      if(!text)return;
      const caption=document.createElement('span');caption.className='field-caption';caption.textContent=text.textContent;label.replaceChild(caption,text);
    });
  }
  prepareLabels();
  new MutationObserver(prepareLabels).observe(document.body,{childList:true,subtree:true});
})();
