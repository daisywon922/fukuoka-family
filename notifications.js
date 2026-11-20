/* Notice history lives outside travel data. Permission and read state belong to this device. */
(()=>{
 const preview=typeof LOCAL_PREVIEW!=='undefined'&&LOCAL_PREVIEW;
 const key='fukuoka-notifications-preview',readKey='fukuoka-notifications-read';
 const dismissedKey='fukuoka-notifications-dismissed'+(preview?'-preview':'');let dismissed=new Set();try{dismissed=new Set(JSON.parse(localStorage.getItem(dismissedKey)||'[]'))}catch{}
 let notices=[],enabled=false,loading=false,adminClient=null,pushRegistration=null;
 const connection=()=>window.FamilyConnection;
 const node=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n};
 const gear='<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 13a7 7 0 0 0-14 0c0 8-3 8-3 11h20c0-2-2-3-2-6M10 27a3 3 0 0 0 6 0M11 5V3h4v2"/><g transform="translate(18 1)"><path d="m5 1 1-1 2 1 1 2 2 1v3l-2 1-1 2H5L4 8 2 7V4l2-1Z" fill="var(--surface)"/><circle cx="6.5" cy="5.5" r="2"/></g></svg>';

 function dialog(id,title,body,settings=false){const d=node('dialog','notification-window');d.id=id;d.setAttribute('aria-label',title);d.innerHTML=`<div class="notification-heading"><button aria-label="${title} 닫기">×</button><h2>${title}</h2><button ${settings?'aria-label="알림 설정 열기"':'hidden'}>${settings?gear:''}</button></div>${body}`;document.body.append(d);d.querySelector('button').onclick=()=>d.close();d.querySelector('button').classList.add('close-icon');if(settings)d.querySelectorAll('button')[1].onclick=()=>openSettings();return d}
 const historyDialog=dialog('notification-history','알림 히스토리','<p class="notification-preview" id="notification-preview" hidden>미리보기 · 실제 가족에게 발송되지 않습니다.</p><nav id="notification-tabs" class="notification-tabs" aria-label="알림 유형"></nav><div class="notification-content"><div id="notification-status" role="status"></div><div id="notification-disabled" hidden></div><div id="notification-list" class="notification-list"></div></div><p class="notification-retention">받은 알림은 90일 동안만 보관합니다.</p><div class="notification-footer"><button class="primary" id="notification-write">알림 발송</button></div>',true);
 const settingsDialog=dialog('notification-settings','알림 설정','<div class="notification-setting-row"><div><strong>앱 푸시</strong><p>push알림을 이 기기에서 받습니다.</p></div><button id="notification-toggle" class="notification-toggle" role="switch" aria-label="앱 푸시" aria-checked="false"></button></div><div id="notification-detail-settings" hidden><h3>상세 알림 설정</h3><div id="notification-detail-toggles"></div></div><p id="notification-device" class="notification-status" role="alert" hidden></p><p class="help">알림을 꺼도 알림센터에서 알림 이력을 확인할 수 있습니다.</p><p id="notification-setup" class="help"></p>');
 const compose=dialog('notification-compose','알림 발송','<form id="notification-form"><div class="formgrid"><label class="field full">제목<input id="notice-title" maxlength="60" required placeholder="예: 내일 집합 시간 안내"></label><label class="field full">내용<textarea id="notice-body" maxlength="500" rows="5" required placeholder="전달할 내용을 입력하세요."></textarea></label><label class="field full">이동할 화면<select id="notice-target"><option value="">지정 안 함</option><option value="schedule">일정</option><option value="places">장소</option><option value="overview">예약현황</option><option value="records">지출내역</option><option value="prepare">체크리스트</option><option value="memos">여행 메모</option></select></label><label class="field full" id="notice-detail-field" hidden>세부 대상<select id="notice-detail"><option value="">메뉴 첫 화면</option></select><small class="help">알림 카드와 휴대폰 알림을 누르면 같은 화면으로 이동합니다.</small></label></div><p class="help">가족 전체의 알림센터에 저장됩니다. 알림을 켠 기기에는 푸시 알림도 보냅니다.</p><div class="actions"><button id="notice-submit" class="primary" disabled>다음</button></div></form>');
 const confirmDialog=dialog('notification-confirm','가족에게 알림을 보낼까요?','<strong id="notice-confirm-title"></strong><p id="notice-confirm-body" class="notification-body"></p><p id="notice-confirm-target" class="help"></p><p class="help" id="notice-confirm-help"></p><div class="actions"><button id="notice-cancel">취소</button><button id="notice-send" class="primary">보내기</button></div>');
 const authDialog=dialog('notification-admin','관리자 확인','<p class="help">알림 발송은 최초 설정한 관리자 계정으로 확인합니다. 가족 프로필은 그대로 유지됩니다.</p><form id="notice-auth"><div class="formgrid"><label class="field full">이메일<input id="notice-email" type="email" autocomplete="username" required></label><label class="field full">비밀번호<input id="notice-password" type="password" autocomplete="current-password" required></label></div><p id="notice-auth-error" class="help" role="alert"></p><div class="actions"><button class="primary">확인</button></div></form>');
 const $n=id=>document.getElementById(id);
 let noticeFilter='all';
 const noticeTabs={all:'전체',manual:'공지',schedule:'일정',expense:'지출',memo:'메모'};
 function noticeKind(notice){return notice.kind||(notice.source==='automatic'?({schedule:'schedule',records:'expense',memos:'memo'}[notice.target]||'manual'):'manual')}
 function renderTabs(){const tabs=$n('notification-tabs');tabs.replaceChildren();for(const [value,label]of Object.entries(noticeTabs)){const b=node('button',noticeFilter===value?'active':'',label);b.type='button';b.setAttribute('aria-pressed',String(noticeFilter===value));b.onclick=()=>{noticeFilter=value;render()};tabs.append(b)}}
 const preferenceKey='fukuoka-notice-preferences';
 let preferences={schedule:true,expense:true,memo:true};try{const stored=JSON.parse(localStorage.getItem(preferenceKey)||'{}');for(const kind of Object.keys(preferences))if(typeof stored[kind]==='boolean')preferences[kind]=stored[kind]}catch{}
 const preferenceLabels={schedule:'새로운 일정 추가',expense:'새로운 지출 등록',memo:'새로운 메모 등록'};
 function renderPreferences(){
 $n('notification-detail-settings').hidden=false;$n('notification-detail-settings').classList.toggle('is-disabled',!enabled);const list=$n('notification-detail-toggles');list.replaceChildren();
 for(const [kind,label]of Object.entries(preferenceLabels)){const row=node('div','notification-setting-row'),toggle=node('button','notification-toggle');toggle.type='button';toggle.setAttribute('role','switch');toggle.setAttribute('aria-label',label);toggle.setAttribute('aria-checked',String(enabled&&preferences[kind]));toggle.disabled=!enabled;const text=node('div','notification-preference-copy');text.append(node('span','',label),node('p','',({schedule:'새 일정이 추가되면 알려드립니다.',expense:'새 지출내역이 등록되면 알려드립니다.',memo:'새 메모가 등록되면 알려드립니다.'})[kind]));row.append(text,toggle);list.append(row);toggle.onclick=async()=>{toggle.disabled=true;const next={...preferences,[kind]:!preferences[kind]};try{if(!preview){const r=await navigator.serviceWorker.getRegistration(),sub=await r?.pushManager.getSubscription();if(!sub||!connection())throw Error('알림 연결을 확인해주세요.');const {error}=await connection().client.from('family_push_subscriptions').update({preferences:next}).eq('endpoint',sub.endpoint);if(error)throw error}preferences=next;localStorage.setItem(preferenceKey,JSON.stringify(preferences));renderPreferences()}catch{toast('알림 설정을 저장하지 못했어요.');toggle.disabled=false}}}
 }
 let read=new Set();try{read=new Set(JSON.parse(localStorage.getItem(readKey)||'[]'))}catch{}
 const incomingRead=new URLSearchParams(location.search).get('readNotice');if(incomingRead){read.add(incomingRead);localStorage.setItem(readKey,JSON.stringify([...read]))}
 if(preview){try{notices=JSON.parse(localStorage.getItem(key)||'null')||[]}catch{}if(new URLSearchParams(location.search).get('notices')==='empty')notices=[];else if(!notices.length)notices=[{id:'sample-1',title:'출발 전 준비 확인',body:'여권과 예약 바우처를 챙겨주세요. 개인 체크리스트도 확인해주세요.',created_at:new Date().toISOString()},{id:'sample-2',title:'후쿠오카 여행 알림',body:'여행 중 함께 확인할 내용은 이곳에 모아둘게요.',created_at:new Date(Date.now()-86400000).toISOString()}];$n('notification-preview').hidden=false}
 const targetNames={schedule:'일정',places:'장소',overview:'예약현황',records:'지출내역',prepare:'체크리스트',memos:'여행 메모'};
 // Mark cards read only once they have actually been visible in the history viewport.
 const visibleNotices=new Set();
 const observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting)visibleNotices.add(entry.target.dataset.noticeId)},{root:$n('notification-list').parentElement,threshold:0.5});
 historyDialog.addEventListener('close',()=>{visibleNotices.forEach(id=>read.add(id));visibleNotices.clear();localStorage.setItem(readKey,JSON.stringify([...read]));render()});
 function detailOptions(target){
 const option=(value,label)=>({value,label});
 if(target==='schedule')return TRIP.days.flatMap((day,i)=>[option('day:'+day.date,'DAY'+(i+1)+' · '+day.date.slice(5).replace('-','/')), ...day.events.map(event=>option('event:'+event.id,(event.time||'시간 미정')+' · '+event.title))]);
 if(target==='overview')return bookingItems().map(item=>option('booking:'+item.id,item.title));
 if(target==='records')return state.records.filter(r=>r.type!=='memo').map(r=>option('expense:'+r.id,(r.date||'날짜 미정')+' · '+r.text));
 if(target==='places')return (state.places||[]).map(p=>option('place:'+p.id,p.name));
 if(target==='memos')return state.records.filter(r=>r.type==='memo').map(r=>option('memo:'+r.id,r.text.length>35?r.text.slice(0,35)+'…':r.text));
 if(target==='prepare')return [option('check:common','공통'),option('check:personal','내 개인 체크리스트')];return []
 }
 function renderDetails(){const target=$n('notice-target').value,field=$n('notice-detail-field'),select=$n('notice-detail');field.hidden=!target;select.replaceChildren();select.append(new Option('메뉴 첫 화면',''));for(const item of detailOptions(target))select.append(new Option(item.label,item.value))}
 $n('notice-target').addEventListener('change',renderDetails);
 function navigateNotice(target,detail){
 if(!targetNames[target])return;go(target);if(!detail)return;
 const split=detail.indexOf(':'),kind=detail.slice(0,split),id=detail.slice(split+1);let found=false;
 if(target==='schedule'&&kind==='day'){const i=TRIP.days.findIndex(day=>day.date===id);if(i>=0){selectDay(i);found=true}}
 if(target==='schedule'&&kind==='event'){const info=eventInfo(id);if(info){selectDay(TRIP.days.indexOf(info.day));openEventDetail(info.day,info.event);found=true}}
 if(target==='overview'&&kind==='booking'&&bookingItems().some(item=>item.id===id)){openBooking(id);found=true}
 if(target==='records'&&kind==='expense'){const item=state.records.find(r=>r.id===id&&r.type!=='memo');if(item){showExpenseDetail(item);found=true}}
 if(target==='places'&&kind==='place'&&(state.places||[]).some(p=>p.id===id)){openPlace(id);found=true}
 if(target==='memos'&&kind==='memo'&&state.records.some(r=>r.id===id&&r.type==='memo')){showMemo(id);found=true}
 if(target==='prepare'&&kind==='check'&&['common','personal'].includes(id)){selectChecklistTab(id);found=true}
 if(!found)toast('대상이 없어 해당 메뉴로 이동했어요.');
 }
 function destinationLabel(notice){const detail=detailOptions(notice.target).find(item=>item.value===notice.target_detail);return detail?detail.label:targetNames[notice.target]}
 function noticeDate(value){const d=new Date(value),pad=n=>String(n).padStart(2,'0');return `${String(d.getFullYear()).slice(-2)}.${pad(d.getMonth()+1)}.${pad(d.getDate())}(${'일월화수목금토'[d.getDay()]}) ${d.getHours()<12?'오전':'오후'} ${pad(d.getHours()%12||12)}:${pad(d.getMinutes())}`}
 // Only isolated local previews use client detection. Production uses the database trigger.
 if(preview&&window.NoticeEvents){
  const clone=value=>JSON.parse(JSON.stringify(value)),originalSave=save;let previous=clone(state);
  const seen=new Set(NoticeEvents.entries(previous).map(item=>item.key));
  save=function(){const result=originalSave();if(result===false)return result;for(const item of (previous.notificationImport!==state.notificationImport?(NoticeEvents.entries(state).forEach(x=>seen.add(x.key)),[]):NoticeEvents.added(previous,state,seen))){notices.unshift({...item,id:crypto.randomUUID(),created_at:new Date().toISOString()})}previous=clone(state);localStorage.setItem(key,JSON.stringify(notices));render();return result};
 }
 function attachDismiss(row,id,track){
 let start=null,dx=0,swiping=false,suppress=false,ready=false,pulsed=false;
 const threshold=()=>Math.max(90,row.clientWidth*.5);
 const reset=()=>{row.style.transform='';row.classList.remove('is-swiping');track.classList.remove('delete-ready');start=null;swiping=false;ready=false};
 row.style.touchAction='pan-y';
 row.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;start={x:e.clientX,y:e.clientY};dx=0;suppress=false;pulsed=false});
 row.addEventListener('pointermove',e=>{if(!start)return;dx=Math.min(0,e.clientX-start.x);const dy=e.clientY-start.y;if(!swiping&&Math.abs(dy)>12&&Math.abs(dy)>Math.abs(dx)){reset();return}if(!swiping&&dx<-10&&Math.abs(dx)>Math.abs(dy)*1.3){swiping=true;row.setPointerCapture(e.pointerId);row.classList.add('is-swiping')}if(swiping){suppress=true;row.style.transform='translateX('+dx+'px)';ready=-dx>=threshold();track.classList.toggle('delete-ready',ready);if(ready&&!pulsed){pulsed=true;if(typeof navigator.vibrate==='function')navigator.vibrate(12)}}});
 row.addEventListener('pointerup',()=>{if(swiping&&ready){try{dismissed.add(id);localStorage.setItem(dismissedKey,JSON.stringify([...dismissed]));row.classList.remove('is-swiping');row.style.transform='translateX(-110%)';setTimeout(()=>{render();toast('알림이 삭제되었어요.')},180)}catch{dismissed.delete(id);reset();toast('알림을 삭제하지 못했어요.')}}else reset();start=null});
 row.addEventListener('pointercancel',reset);
 row.addEventListener('click',e=>{if(suppress){e.preventDefault();e.stopImmediatePropagation();suppress=false}},true);
 }
 function render(){
 renderTabs();const list=$n('notification-list');observer.disconnect();list.replaceChildren();const visible=notices.filter(notice=>!dismissed.has(notice.id)).filter(notice=>noticeFilter==='all'||noticeKind(notice)===noticeFilter);
 const off=$n('notification-disabled');off.replaceChildren();off.hidden=enabled||loading;
 off.className='notification-disabled'+(!notices.length?' notification-disabled-empty':'');
 if(!off.hidden){
 if(!notices.length){const icon=node('div','notification-empty-icon');icon.innerHTML=gear;off.append(icon)}
 off.append(node('strong','','기기 알림이 꺼져있어요.'),node('p','','앱 푸시를 켜면 주요 알림을 바로 받을 수 있어요.'));
 const turnOn=node('button','primary','알림 켜기');turnOn.onclick=openSettings;off.append(turnOn);
 }
 for(const notice of visible){
 const target=targetNames[notice.target]?notice.target:null,b=node(target?'button':'article','notification-item'+(!read.has(notice.id)?' unread':'')),date=node('time','notification-card-date',noticeDate(notice.created_at));date.dateTime=notice.created_at;const meta=node('div','notification-meta');meta.append(date);b.append(meta,node('strong','',notice.title),node('p','',notice.body));
 b.dataset.noticeId=notice.id;
 if(target){meta.append(node('span','notification-destination','자세히 보기 ›'));b.onclick=()=>{historyDialog.close();navigateNotice(target,notice.target_detail)}}
 const track=node('div','notification-swipe'),background=node('div','notification-delete-background');background.setAttribute('aria-hidden','true');background.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6"/></svg>';track.append(background,b);list.append(track);observer.observe(b);attachDismiss(b,notice.id,track)
 }

 if(!visible.length&&(enabled||loading||notices.length))list.append(node('p','empty',loading?'불러오는 중…':'아직 받은 알림이 없습니다.'));
 $n('notification-dot').hidden=!notices.some(n=>!dismissed.has(n.id)&&!read.has(n.id));$n('notification-write').hidden=!isAdmin()
 }

 async function refresh(){if(preview){notices=notices.filter(n=>Date.parse(n.created_at)>=Date.now()-90*86400000);render();return}if(!connection()){$n('notification-status').textContent='가족 공유 연결을 기다리고 있습니다.';render();return}loading=true;render();const {data,error}=await connection().client.from('family_notices').select('id,title,body,created_at,target,target_detail,source').eq('family_id',connection().familyId).gte('created_at',new Date(Date.now()-90*86400000).toISOString()).order('created_at',{ascending:false}).limit(100);loading=false;if(error)$n('notification-status').textContent='알림 저장소 설정 후 알림 이력을 확인할 수 있습니다.';else{notices=data;$n('notification-status').textContent=''}render()}
 $n('notification-open').onclick=()=>{historyDialog.showModal();void updateSettings();void refresh()};
 async function openSettings(){if($n('menu-dialog').open)$n('menu-dialog').close();settingsDialog.showModal();await updateSettings();if(!preview&&'serviceWorker'in navigator&&'PushManager'in window){try{pushRegistration=await registration()}catch{}}}
 $n('notification-settings-menu').onclick=openSettings;
 const pushPromptKey='fukuoka-push-intro-seen'+(preview?'-preview':'');let promptingPush=false;
 async function maybePromptPush(){
 if(preview||promptingPush||document.hidden||!currentProfileId||!connection()||localStorage.getItem(pushPromptKey)||document.querySelector('dialog[open]')||document.activeElement?.matches('input,textarea,select,[contenteditable=true]'))return;
 const latest=APP_RELEASES.find(r=>!r.pending);if(latest&&localStorage.getItem('fukuoka-release-seen')!==latest.version)return;
 promptingPush=true;
 try{
 let active=false;
 if('serviceWorker'in navigator&&'PushManager'in window&&typeof Notification!=='undefined'){const r=await navigator.serviceWorker.getRegistration();active=!!(await r?.pushManager.getSubscription())&&Notification.permission==='granted'}
 if(active||document.hidden||document.querySelector('dialog[open]'))return;
 const d=dialog('notification-push-intro','중요한 알림을 받아보세요','<p class="push-intro-copy">일정·지출·메모가 추가되면 바로 알려드려요.</p><div class="actions"><button id="push-intro-later">나중에</button><button id="push-intro-enable" class="primary">알림 켜기</button></div>');
 d.addEventListener('close',()=>{d.remove();promptingPush=false},{once:true});
 document.getElementById('push-intro-later').onclick=()=>d.close();
 document.getElementById('push-intro-enable').onclick=()=>{d.close();void openSettings()};
 localStorage.setItem(pushPromptKey,'true');d.showModal();
 }catch{}finally{if(!document.getElementById('notification-push-intro')?.open)promptingPush=false}
 }
 document.addEventListener('close',()=>setTimeout(()=>void maybePromptPush(),0),true);
 window.addEventListener('family-connected',()=>setTimeout(()=>void maybePromptPush(),0));
 window.addEventListener('pageshow',()=>setTimeout(()=>void maybePromptPush(),0));
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)void maybePromptPush()});
 setTimeout(()=>void maybePromptPush(),1800);
 async function registration(){await navigator.serviceWorker.register('./push-worker.js',{scope:'./'});return navigator.serviceWorker.ready}
 async function updateSettings(){
 $n('notification-device').hidden=true;$n('notification-device').textContent='';
 if(preview){enabled=localStorage.getItem(key+'-enabled')==='true';$n('notification-setup').textContent='미리보기에서는 기기 알림 권한을 요청하지 않습니다.'}
 else{enabled=false;if('serviceWorker'in navigator&&'PushManager'in window&&typeof Notification!=='undefined'){const r=await navigator.serviceWorker.getRegistration();enabled=!!(await r?.pushManager.getSubscription())&&Notification.permission==='granted'}
 $n('notification-setup').textContent=typeof Notification!=='undefined'&&Notification.permission==='denied'?'알림이 차단되어 있습니다. 기기 또는 브라우저 설정에서 알림을 허용해주세요.':/iPhone|iPad/.test(navigator.userAgent)&&!navigator.standalone?'아이폰은 홈 화면에 추가한 앱에서 알림을 켜주세요.':'처음 켤 때 기기의 알림 허용을 선택해주세요.'}
 $n('notification-toggle').setAttribute('aria-checked',String(enabled));renderPreferences();render()
 }

 async function changePush(){
 const b=$n('notification-toggle');b.disabled=true;let stage='permission';
 try{
 if(preview){localStorage.setItem(key+'-enabled',String(!enabled));await updateSettings();return}
 if(!connection())throw Error('가족 공유 연결을 확인해주세요.');
 const publicKey=window.FUKUOKA_PUSH_CONFIG?.publicKey;if(!publicKey)throw Error('서버 알림 설정을 먼저 연결해야 합니다.');
 if(!('PushManager'in window)||!('serviceWorker'in navigator))throw Error('홈 화면에 추가한 앱에서 다시 시도해주세요.');
 if(!pushRegistration){pushRegistration=await registration();throw Error('알림 준비가 끝났어요. 앱 푸시를 한 번 더 눌러주세요.')}
 let sub;
 if(enabled){
 stage='save';sub=await pushRegistration.pushManager.getSubscription();if(sub){const {error}=await connection().client.from('family_push_subscriptions').delete().eq('endpoint',sub.endpoint);if(error)throw error;await sub.unsubscribe()}
 }else{
 // Subscribe is the first async operation: iOS receives the original tap gesture.
 const bytes=Uint8Array.from(atob(publicKey.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
 sub=await pushRegistration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes});
 stage='save';const session=await connection().client.auth.getUser();if(session.error||!session.data.user)throw Error('가족 공유 연결을 확인해주세요.');
 const {error}=await connection().client.from('family_push_subscriptions').upsert({user_id:session.data.user.id,family_id:connection().familyId,endpoint:sub.endpoint,subscription:sub.toJSON(),preferences},{onConflict:'user_id,endpoint'});if(error)throw error;
 }
 await updateSettings();
 }catch(e){
 $n('notification-device').hidden=false;
 $n('notification-device').textContent=stage==='save'?'알림 권한은 허용됐지만 서버에 기기를 등록하지 못했어요. 다시 켜주세요. ('+(e.code||e.message||'연결 오류')+')':e.name==='NotAllowedError'?'알림 권한을 확인해주세요. 아이폰 설정 → 알림 → 후쿠오카 여행에서 알림 허용을 켠 뒤 앱을 다시 열어주세요.':e.message||'알림을 켜지 못했어요. 다시 시도해주세요.';
 }finally{b.disabled=false}
 }

 const offConfirm=dialog('notification-off-confirm','알림을 끄시겠어요?','<p>알림을 끄면 주요 알림을 받을 수 없어요. 그래도 끄시겠어요?</p><div class="actions"><button id="notification-off-cancel">취소</button><button id="notification-off-yes" class="primary">끄기</button></div>');
 $n('notification-toggle').onclick=()=>{if(enabled)offConfirm.showModal();else void changePush()};
 $n('notification-off-cancel').onclick=()=>offConfirm.close();
 $n('notification-off-yes').onclick=async()=>{offConfirm.close();await changePush()};
 async function getAdmin(){if(adminClient)return adminClient;const {createClient}=await import('https://esm.sh/@supabase/supabase-js@2.49.8');const c=window.FUKUOKA_SHARED_CONFIG;adminClient=createClient(c.url,c.publishableKey,{auth:{storageKey:'fukuoka-notice-admin-session',persistSession:true,detectSessionInUrl:false}});return adminClient}
 $n('notification-write').onclick=async()=>{if(!isAdmin())return;if(preview){renderDetails();compose.showModal();return}try{const c=await getAdmin(),{data}=await c.auth.getUser();if(data.user?.id===connection()?.familyId){renderDetails();compose.showModal()}else authDialog.showModal()}catch{toast('관리자 확인을 시작하지 못했습니다.')}};
 $n('notice-auth').onsubmit=async e=>{e.preventDefault();const b=e.target.querySelector('button');b.disabled=true;try{const c=await getAdmin();const {data,error}=await c.auth.signInWithPassword({email:$n('notice-email').value,password:$n('notice-password').value});$n('notice-password').value='';if(error||data.user.id!==connection()?.familyId){await c.auth.signOut();throw Error('가족 저장소를 만든 관리자 계정인지 확인해주세요.')}authDialog.close();renderDetails();compose.showModal()}catch(e){$n('notice-auth-error').textContent=e.message}finally{b.disabled=false}};
 const valid=()=>$n('notice-title').value.trim()&&$n('notice-body').value.trim();$n('notification-form').oninput=()=>{$n('notice-submit').disabled=!valid()};let requestId;
 $n('notification-form').onsubmit=e=>{e.preventDefault();if(!valid()||!isAdmin())return;requestId=crypto.randomUUID();$n('notice-confirm-title').textContent=$n('notice-title').value.trim();$n('notice-confirm-body').textContent=$n('notice-body').value.trim();$n('notice-confirm-target').textContent=$n('notice-target').value?'이동 화면: '+targetNames[$n('notice-target').value]+($n('notice-detail').value?' · '+$n('notice-detail').selectedOptions[0].textContent:''):'이동 화면: 지정 안 함';$n('notice-confirm-help').textContent=preview?'미리보기 알림 이력에만 추가됩니다. 실제 발송되지 않습니다.':'알림을 켠 가족 기기에 전송됩니다.';confirmDialog.showModal()};$n('notice-cancel').onclick=()=>confirmDialog.close();
 $n('notice-send').onclick=async()=>{const b=$n('notice-send');b.disabled=true;try{const item={id:requestId,title:$n('notice-title').value.trim(),body:$n('notice-body').value.trim(),created_at:new Date().toISOString(),target:$n('notice-target').value||null,target_detail:$n('notice-target').value?($n('notice-detail').value||null):null};if(preview){notices.unshift(item);localStorage.setItem(key,JSON.stringify(notices))}else{const c=await getAdmin();const {data,error}=await c.functions.invoke('send-family-notice',{body:{requestId,title:item.title,body:item.body,target:item.target,target_detail:item.target_detail}});if(error||data?.error)throw Error('알림 전송 결과를 확인하지 못했습니다. 다시 시도해주세요.');toast(data.failed?'알림 저장 완료 · 일부 기기 알림 전송 실패':'알림을 보냈습니다.')}confirmDialog.close();compose.close();$n('notification-form').reset();$n('notice-submit').disabled=true;await refresh();if(preview)toast('미리보기 알림을 추가했습니다.')}catch(e){$n('notice-confirm-help').textContent=e.message}finally{b.disabled=false}};
 const requestedView=new URLSearchParams(location.search).get('view');let pendingDestination=targetNames[requestedView]?{target:requestedView,detail:new URLSearchParams(location.search).get('detail')}:null;
 function openIncoming(){if(!pendingDestination||(!preview&&!connection())||document.querySelector('dialog[open]'))return;const next=pendingDestination;pendingDestination=null;navigateNotice(next.target,next.detail)}
 document.addEventListener('close',()=>setTimeout(openIncoming,0),true);if(preview)setTimeout(openIncoming,0);else if(pendingDestination)go(requestedView);
 window.addEventListener('family-connected',()=>{void refresh();openIncoming()});document.addEventListener('visibilitychange',()=>{if(!document.hidden){void updateSettings();void refresh()}});setInterval(()=>{if(!document.hidden&&connection())void refresh()},30000);render();if(new URLSearchParams(location.search).get('section')==='notifications')setTimeout(()=>{historyDialog.showModal();void updateSettings();void refresh()},350);
})();
