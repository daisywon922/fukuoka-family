/* 일정과 별도로 모아 두는 가족 공용 장소 목록. */
const PLACE_CATEGORIES=['맛집','카페','관광지','쇼핑','휴식','기타'];
let placeFilter='',activePlaceId=null,editingPlaceId=null,placeOriginal='';
function placeMapURL(item){return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(item.map.trim()||item.name+' Fukuoka Japan')}
function placeDraft(){return {category:$('place-category').value,name:$('place-name').value.trim(),map:$('place-map').value.trim(),note:$('place-note').value.trim()}}
function updatePlaceSave(){const draft=placeDraft();$('place-save').disabled=!draft.category||!draft.name||!$('place-form').checkValidity()||JSON.stringify(draft)===placeOriginal}
function renderPlaces(){
  const filters=$('place-filters');filters.replaceChildren();
  for(const category of ['',...PLACE_CATEGORIES]){const button=el('button',category===placeFilter?'active':'',category||'전체');button.type='button';button.setAttribute('aria-pressed',String(category===placeFilter));button.onclick=()=>{placeFilter=category;renderPlaces()};filters.append(button)}
  const list=$('place-list');list.replaceChildren();
  const items=(state.places||[]).filter(item=>!placeFilter||item.category===placeFilter).sort((a,b)=>Number(b.favorite===true)-Number(a.favorite===true));
  if(!items.length){list.append(el('p','empty',placeFilter?'이 카테고리에 저장한 장소가 없습니다.':'아직 저장한 장소가 없습니다.'));return;}
  items.forEach(item=>{
    const card=el('article','place-card'),star=el('button','place-favorite'),open=el('button','place-open'),map=el('a','place-map-link','↗');
    star.type='button';star.setAttribute('aria-label',item.name+' 즐겨찾기');star.setAttribute('aria-pressed',String(item.favorite===true));star.dataset.placeId=item.id;star.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.8 5.8 6.4.9-4.6 4.5 1.1 6.4-5.7-3-5.7 3 1.1-6.4L2.8 9.7l6.4-.9Z"/></svg>';star.onclick=()=>togglePlaceFavorite(item.id);open.type='button';open.setAttribute('aria-label',item.name+' 장소 상세');open.setAttribute('aria-haspopup','dialog');open.append(el('span','place-category-tag',item.category),el('strong','',item.name));
    if(item.note)open.append(el('span','place-preview-note',item.note));open.onclick=()=>openPlace(item.id);
    map.href=placeMapURL(item);map.target='_blank';map.rel='noopener';map.setAttribute('aria-label',item.name+' 구글지도');map.title='구글지도';card.append(star,open,map);list.append(card);
  });
}
function togglePlaceFavorite(id){
  const item=(state.places||[]).find(item=>item.id===id);if(!item)return;
  const previous=state;state={...state,places:state.places.map(value=>value.id===id?{...value,favorite:value.favorite!==true}:value)};
  if(!save()){state=previous;return;}renderPlaces();
  [...$('place-list').querySelectorAll('.place-favorite')].find(button=>button.dataset.placeId===id)?.focus({preventScroll:true});
}
let schedulePlaceCopied=null,schedulePlaceActive=-1;
function closeSchedulePlaces(){
  $('schedule-place-options').hidden=true;$('schedule-place').setAttribute('aria-expanded','false');$('schedule-place-toggle').setAttribute('aria-expanded','false');$('schedule-place').removeAttribute('aria-activedescendant');schedulePlaceActive=-1;
}
function selectSchedulePlace(id){
  const item=(state.places||[]).find(item=>item.id===id);if(!item){closeSchedulePlaces();return;}
  // 문자열 값만 복사하며, 장소 ID나 목록 참조는 일정에 저장하지 않습니다.
  $('schedule-place').value=item.name;$('schedule-map').value=item.map;schedulePlaceCopied={name:item.name,map:item.map};closeSchedulePlaces();updateScheduleSave();$('schedule-place').focus();closeSchedulePlaces();
}
function showSchedulePlaces(query=''){
  const list=$('schedule-place-options');list.replaceChildren();schedulePlaceActive=-1;
  const needle=query.trim().toLocaleLowerCase();
  const items=[...(state.places||[])].filter(item=>!needle||item.name.toLocaleLowerCase().includes(needle)||item.category.includes(needle)).sort((a,b)=>Number(b.favorite===true)-Number(a.favorite===true));
  items.forEach((item,index)=>{
    const option=el('button','schedule-place-option');option.type='button';option.id='schedule-place-choice-'+index;option.setAttribute('role','option');option.setAttribute('aria-selected','false');option.append(el('span','',item.name),el('small','',item.category));option.onpointerdown=event=>event.preventDefault();option.onclick=()=>selectSchedulePlace(item.id);list.append(option);
  });
  if(!items.length){closeSchedulePlaces();return;}
  list.hidden=false;$('schedule-place').setAttribute('aria-expanded','true');$('schedule-place-toggle').setAttribute('aria-expanded','true');$('schedule-place').removeAttribute('aria-activedescendant');
}
function renderSchedulePlaces(){schedulePlaceCopied=null;closeSchedulePlaces()}
$('schedule-place').addEventListener('focus',()=>showSchedulePlaces($('schedule-place').value));
$('schedule-place').addEventListener('input',()=>{
  // 선택 후 직접 이름을 바꾸면 자동 복사된 지도값만 비웁니다. 직접 수정한 주소는 보존합니다.
  if(schedulePlaceCopied){if($('schedule-map').value===schedulePlaceCopied.map)$('schedule-map').value='';schedulePlaceCopied=null;}
  showSchedulePlaces($('schedule-place').value);updateScheduleSave();
});
$('schedule-place-toggle').onclick=()=>{if(!$('schedule-place-options').hidden){closeSchedulePlaces();return;}$('schedule-place').focus();showSchedulePlaces()};
$('schedule-place').addEventListener('keydown',event=>{
  if(event.isComposing)return;
  if(event.key==='Escape'){if(!$('schedule-place-options').hidden){event.preventDefault();event.stopPropagation();closeSchedulePlaces()}return;}
  if(!['ArrowDown','ArrowUp','Enter'].includes(event.key))return;
  if(event.key==='Enter'){
    const options=$('schedule-place-options').querySelectorAll('[role=option]');
    if(!$('schedule-place-options').hidden&&schedulePlaceActive>=0){event.preventDefault();options[schedulePlaceActive]?.click()}return;
  }
  event.preventDefault();if($('schedule-place-options').hidden)showSchedulePlaces($('schedule-place').value);
  const options=[...$('schedule-place-options').querySelectorAll('[role=option]')];if(!options.length)return;
  schedulePlaceActive=schedulePlaceActive<0?(event.key==='ArrowDown'?0:options.length-1):(schedulePlaceActive+(event.key==='ArrowDown'?1:-1)+options.length)%options.length;
  options.forEach((option,index)=>option.setAttribute('aria-selected',String(index===schedulePlaceActive)));const active=options[schedulePlaceActive];$('schedule-place').setAttribute('aria-activedescendant',active.id);active.scrollIntoView({block:'nearest'});
});
$('schedule-place').addEventListener('blur',event=>{if(!$('schedule-place-combo').contains(event.relatedTarget))closeSchedulePlaces()});
document.addEventListener('click',event=>{if(!$('schedule-place-combo').contains(event.target))closeSchedulePlaces()});
$('schedule-editor').addEventListener('close',closeSchedulePlaces);
function openPlace(id){
  const item=(state.places||[]).find(item=>item.id===id);if(!item){toast('삭제된 장소입니다.');return;}
  activePlaceId=id;$('place-detail-title').textContent=item.name;$('place-detail-category').textContent=item.category;$('place-detail-map').textContent=item.map||'-';$('place-detail-note').textContent=item.note||'-';$('place-detail-link').href=placeMapURL(item);if(!$('place-detail').open)$('place-detail').showModal();
}
function editPlace(id=null){
  const item=id?(state.places||[]).find(item=>item.id===id):null;if(id&&!item){toast('삭제된 장소입니다.');return;}
  editingPlaceId=id;$('place-editor-title').textContent=id?'장소 수정':'장소 추가';$('place-category').value=item?.category||(placeFilter||'');$('place-name').value=item?.name||'';$('place-map').value=item?.map||'';$('place-note').value=item?.note||'';placeOriginal=id?JSON.stringify(placeDraft()):'';updatePlaceSave();$('place-editor').showModal();
}
PLACE_CATEGORIES.forEach(category=>{const option=el('option','',category);option.value=category;$('place-category').append(option)});
$('place-add').onclick=()=>editPlace();$('place-edit').onclick=()=>editPlace(activePlaceId);
$('place-form').addEventListener('input',updatePlaceSave);$('place-form').addEventListener('change',updatePlaceSave);
$('place-form').onsubmit=event=>{
  event.preventDefault();updatePlaceSave();if($('place-save').disabled)return;
  const old=(state.places||[]).find(item=>item.id===editingPlaceId);if(editingPlaceId&&!old){toast('다른 기기에서 삭제된 장소입니다.');$('place-editor').close();$('place-detail').close();renderPlaces();return;}
  if(!old&&(state.places||[]).length>=500){toast('장소는 최대 500개까지 저장할 수 있어요.');return;}
  const item={...old,...placeDraft(),id:old?.id||'place-'+(globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2)),createdAt:old?.createdAt||new Date().toISOString()};
  const previous=state;state={...state,places:old?state.places.map(value=>value.id===item.id?item:value):[item,...(state.places||[])]};if(!save()){state=previous;return;}
  if(placeFilter&&item.category!==placeFilter)placeFilter=item.category;renderPlaces();$('place-editor').close();if($('place-detail').open)openPlace(item.id);toast(old?'장소를 수정했어요.':'장소를 저장했어요.');
};
$('place-remove').onclick=()=>{const item=(state.places||[]).find(item=>item.id===activePlaceId);if(!item)return;$('place-delete-message').textContent=item.name+' 장소를 삭제할까요?';$('place-delete-dialog').showModal()};
$('place-delete-confirm').onclick=()=>{const previous=state;state={...state,places:(state.places||[]).filter(item=>item.id!==activePlaceId)};if(!save()){state=previous;return;}$('place-delete-dialog').close();$('place-detail').close();activePlaceId=null;renderPlaces();toast('장소를 삭제했어요.')};
if(LOCAL_PREVIEW){
  $('demo-note').textContent='미리보기 · 실제 여행 기록에는 반영되지 않습니다.';$('demo-note').hidden=false;
  if(state.places===undefined){state.places=[
    {id:'preview-canal',category:'쇼핑',name:'캐널시티 하카타',map:'Canal City Hakata, Fukuoka',note:'쇼핑하는 날 동선에 맞으면 들르기'},
    {id:'preview-ohori',category:'관광지',name:'오호리 공원',map:'Ohori Park, Fukuoka',note:'걷는 시간을 넉넉하게 잡기',favorite:true},
    {id:'preview-tenjin',category:'쇼핑',name:'텐진 지하상가',map:'Tenjin Underground Shopping Center, Fukuoka',note:'비 오는 날 둘러볼 곳'}
  ];save();}
  if(!currentProfileId){currentProfileId=PROFILE_IDS[0];renderNames();renderChecks();$('profile-dialog').close();}go('places');
}
renderPlaces();
