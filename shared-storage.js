/* 공용 데이터 연결. 프로필 선택은 기존 기기 저장소에 유지합니다. */
(async function(){
  if(typeof LOCAL_PREVIEW!=='undefined'&&LOCAL_PREVIEW)return;
  const config=window.FUKUOKA_SHARED_CONFIG||{}, {merge,clone,same}=FamilyMerge;
  const enabled=Boolean(config.url&&config.publishableKey), OUTBOX=KEY+'-shared-outbox';
  let client,user,familyId,base=null,revision=0,ready=false,busy=false,queued=false,refreshNeeded=false;
  let status='연결 전',channel;
  const statusButton=document.createElement('button');
  statusButton.type='button';statusButton.className='sync-status';statusButton.textContent='공용 저장소 연결';
  document.querySelector('#settings').prepend(statusButton);
  const dialog=document.createElement('dialog');dialog.id='shared-dialog';dialog.setAttribute('aria-label','공용 저장소');
  dialog.innerHTML='<div class="titleline"><h2>가족 저장소 연결</h2><button type="button" class="close-icon" aria-label="닫기">×</button></div><p class="help" id="sync-message">연결을 확인하고 있어요.</p><div class="actions"><button id="shared-seed" class="primary" hidden>현재 기록으로 공유 시작</button><button id="shared-retry" hidden>다시 연결</button></div>';
  document.body.append(dialog);
  const message=dialog.querySelector('#sync-message'),seed=dialog.querySelector('#shared-seed'),retry=dialog.querySelector('#shared-retry');
  dialog.querySelector('.close-icon').onclick=()=>dialog.close();
  const setStatus=(text,detail)=>{status=text;statusButton.textContent='공용 저장소 · '+text;if(detail)message.textContent=detail;};
  statusButton.onclick=()=>{if(!enabled)message.textContent='연결 준비 중입니다. Supabase 프로젝트 설정 후 가족과 공유할 수 있어요.';dialog.showModal()};
  if(!enabled){setStatus('설정 필요');return;}
  // 설정된 앱은 연결 전 수정을 허용하지 않아 로컬 변경이 서버 데이터로 오인되지 않게 합니다.
  const localSave=save;
  const surfaces=[document.querySelector('main'),document.querySelector('header')];
  const lock=locked=>{surfaces.forEach(node=>{if(node)node.inert=locked});dialog.querySelector('.close-icon').hidden=locked;};
  lock(true);
  document.querySelectorAll('dialog[open]').forEach(node=>node.close());
  dialog.addEventListener('cancel',event=>{if(!ready)event.preventDefault()});
  save=function(){
    if(!ready){toast('공용 저장소에 먼저 연결해 주세요.');return false;}
    if(!localSave())return false;
    try{localStorage.setItem(OUTBOX,JSON.stringify({owner:familyId,base}));}
    catch(error){toast('공유 대기 기록을 보관하지 못했어요.');return false;}
    setStatus(navigator.onLine?'저장 중…':'연결 대기');void sync();return true;
  };
  function materialize(){
    const result=clone(state);
    result.commonChecklist=clone(commonItems());
    result.personalLists=Object.fromEntries(PROFILE_IDS.map(id=>[id,clone(personalItems(id))]));
    result.eventOverrides=Object.fromEntries(TRIP.days.flatMap(day=>day.events.map(event=>[event.id,{date:day.date,event:{...clone(event),time:event.time||''}}])));
    result.bookingOverrides=Object.fromEntries(bookingItems().map(item=>[item.id,clone(item)]));
    result.sharedCanonical=true;
    return result;
  }
  function paint(){
    if(document.querySelector('dialog[open]')||document.activeElement?.matches('input,select,textarea,[contenteditable=true]')){refreshNeeded=true;return;}
    refreshNeeded=false;applyScheduleEdits();renderBookings();renderNames();renderChecks();renderRecords();renderTimeline();renderMemos();if(typeof renderPlaces==='function')renderPlaces();
  }
  document.addEventListener('close',()=>{if(refreshNeeded)setTimeout(paint,0)},true);
  document.addEventListener('focusout',()=>{if(refreshNeeded)setTimeout(paint,0)});
  async function latest(){
    const {data,error}=await client.from('family_trip').select('*').eq('owner_id',familyId).maybeSingle();
    if(error)throw error;return data;
  }
  function accept(row,localBase=base){
    if(!row||!valid(row.data))throw new Error('저장된 데이터 형식을 확인해 주세요.');
    let next=localBase?merge(localBase,state,row.data):clone(row.data);
    if(typeof PersonalChecklistDefaults!=='undefined')next=PersonalChecklistDefaults.apply(next);
    if(!valid(next))throw new Error('기록을 합치는 중 확인이 필요해요.');
    const changed=!same(state,next);state=next;base=clone(row.data);revision=row.revision;
    localStorage.setItem(KEY,JSON.stringify(state));
    if(same(state,base))localStorage.removeItem(OUTBOX);
    else localStorage.setItem(OUTBOX,JSON.stringify({owner:familyId,base}));
    if(changed)paint();
  }
  async function sync(){
    if(!ready)return;
    if(busy){queued=true;return;}
    busy=true;
    try{
      for(let attempt=0;attempt<6;attempt++){
        const row=await latest();if(!row)throw new Error('공용 기록을 찾을 수 없어요.');
        accept(row);
        if(same(state,base)){setStatus('공유됨','일정·예약·지출·메모·체크리스트를 함께 사용합니다.');break;}
        const sent=clone(state);
        const {data,error}=await client.rpc('save_family_trip',{family_id:familyId,expected_revision:revision,next_data:sent});
        if(error)throw error;
        if(!data?.length)continue; // 다른 기기가 먼저 저장했다면 최신 기록에 다시 합칩니다.
        accept(data[0],sent);
        if(same(state,base)){setStatus('공유됨','일정·예약·지출·메모·체크리스트를 함께 사용합니다.');break;}
      }
      if(!same(state,base))setStatus('저장 대기','다른 기기 변경을 반영 중입니다. 잠시 후 다시 저장합니다.');
    }catch(error){
      setStatus('연결 대기','인터넷 연결 또는 공용 저장소 설정을 확인해 주세요. 이 기기의 변경은 보관하고 다시 연결되면 전송합니다.');
      retry.hidden=false;
    }finally{busy=false;if(queued){queued=false;setTimeout(()=>void sync(),300);}}
  }
  async function connect(){
    const {data,error}=await client.auth.getSession();if(error)throw error;
    user=data.session?.user;
    const token=new URLSearchParams(location.hash.slice(1)).get('invite');
    if(!user&&token){
      const signed=await client.auth.signInAnonymously();if(signed.error)throw signed.error;user=signed.data.user;
    }
    if(!user){ready=false;retry.hidden=false;setStatus('초대 링크 필요','처음 사용하는 기기에서는 가족 초대 링크로 접속해 주세요.');return;}
    if(token){
      const joined=await client.rpc('redeem_family_invite',{invite_token:token});if(joined.error)throw joined.error;
      // 홈 화면 추가 시 설치한 초대 URL을 사용할 수 있도록 일반 브라우저에서는 유지합니다.
      if(matchMedia('(display-mode: standalone)').matches||navigator.standalone)history.replaceState(null,'',location.pathname+location.search);
    }
    const membership=await client.rpc('current_family');if(membership.error)throw membership.error;
    familyId=membership.data;
    if(!familyId){ready=false;retry.hidden=false;setStatus('초대 링크 필요','가족 초대 링크로 다시 접속해 주세요. 기존 여행 기록은 유지됩니다.');return;}
    document.querySelector('#settings .card:last-of-type .help:last-of-type').textContent='백업을 불러오면 가족 공용 기록도 교체됩니다.';const row=await latest();
    if(!row){setStatus('공유 시작 전','첫 연결 기기의 현재 기록을 공용 저장소에 올립니다. 기록이 있는 기기에서 한 번만 시작해 주세요.');seed.hidden=false;ready=false;return;}
    seed.hidden=true;
    let pending=null;try{pending=JSON.parse(localStorage.getItem(OUTBOX));}catch(error){}
    // 다른 기기의 첫 접속은 기존 서버 기록을 우선합니다.
    accept(row,pending?.owner===familyId?pending.base:null);ready=true;lock(false);window.FamilyConnection={client,familyId,async flush(){await sync();const until=Date.now()+15000;while(localStorage.getItem(OUTBOX)&&Date.now()<until){await new Promise(resolve=>setTimeout(resolve,200))}if(localStorage.getItem(OUTBOX))throw Error('일정 저장을 기다리고 있어요. 연결 확인 후 다시 시도해 주세요.')}};window.dispatchEvent?.(new Event("family-connected"));
    if(!currentProfileId)dialog.addEventListener('close',()=>openProfiles(),{once:true});
    if(channel)await client.removeChannel(channel);
    channel=client.channel('family-trip-'+familyId).on('postgres_changes',{event:'*',schema:'public',table:'family_trip',filter:'owner_id=eq.'+familyId},()=>void sync()).subscribe();
    void sync();
  }
  seed.onclick=async()=>{
    if(!confirm('현재 이 기기의 일정·예약·지출·메모·체크리스트로 가족 공유를 시작할까요?'))return;
    seed.disabled=true;
    try{
      localStorage.setItem(KEY+'-before-shared',JSON.stringify(state));
      const initial=materialize();if(!valid(initial))throw new Error('공유할 기록의 형식 확인이 필요해요.');
      const {error}=await client.from('family_trip').insert({owner_id:familyId,data:initial});
      if(error&&error.code!=='23505')throw error;
      await connect();dialog.close();toast('가족 공유를 시작했어요.');
    }catch(error){setStatus('설정 확인 필요','공유를 시작하지 못했어요. SQL 설정과 연결 상태를 확인해 주세요.');}
    finally{seed.disabled=false;}
  };
  retry.onclick=()=>void (client?(ready?sync():connect()):Promise.reject()).catch(()=>setStatus('연결 실패','연결 설정을 확인해 주세요.'));
  try{
    const {createClient}=await import('https://esm.sh/@supabase/supabase-js@2.49.8');
    client=createClient(config.url,config.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
    await connect();
    if(!ready){document.querySelectorAll('dialog[open]').forEach(node=>node.close());dialog.showModal();}
    else if(!currentProfileId)openProfiles();
    setInterval(()=>{if(!document.hidden)void sync()},15000);
    window.addEventListener('online',()=>void sync());
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)void sync()});
  }catch(error){retry.hidden=false;if(!dialog.open)dialog.showModal();setStatus('연결 실패','공용 저장소를 연결하지 못했어요. 설정과 인터넷 연결을 확인해 주세요.');}
})();
