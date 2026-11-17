/* 화면은 12시간 휠, 저장하는 시간은 기존 24시간 문자열을 유지합니다. */
function hour24FromClock(period,hour){return Number(hour)%12+(period==='pm'?12:0)}
function clockFromHour24(hour){return Number(hour)%12||12}
function renderScheduleTimeLabel(){
  const hour=$('schedule-hour').value,button=$('schedule-time-open');button.classList.toggle('is-empty',!hour);
  button.textContent=hour===''?'시간 선택':(Number(hour)<12?'오전 ':'오후 ')+clockFromHour24(hour)+':'+$('schedule-minute').value;
}
(function(){
  const rowHeight=44;
  function makeWheel(id,values,labels=values){
    const column=$(id);let frame=0;
    function index(){return Math.max(0,Math.min(values.length-1,Math.round(column.scrollTop/rowHeight)))}
    function paint(){const selected=index();[...column.children].forEach((option,i)=>option.setAttribute('aria-selected',String(i===selected)));column.setAttribute('aria-activedescendant',id+'-'+selected)}
    function choose(value){const selected=Math.max(0,values.indexOf(value));column.scrollTo({top:selected*rowHeight,behavior:'auto'});paint()}
    values.forEach((value,i)=>{const option=el('button','time-wheel-option',labels[i]);option.type='button';option.id=id+'-'+i;option.tabIndex=-1;option.setAttribute('role','option');option.setAttribute('aria-selected','false');option.setAttribute('aria-label',id==='time-wheel-hour'?value+'시':id==='time-wheel-minute'?value+'분':labels[i]);option.onclick=()=>choose(value);column.append(option)});
    column.addEventListener('scroll',()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(paint)},{passive:true});
    column.addEventListener('keydown',event=>{
      if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;event.preventDefault();
      const next=event.key==='Home'?0:event.key==='End'?values.length-1:Math.max(0,Math.min(values.length-1,index()+(event.key==='ArrowDown'?1:-1)));choose(values[next]);
    });
    return {choose,value:()=>values[index()]};
  }
  const period=makeWheel('time-wheel-period',['am','pm'],['오전','오후']),hour=makeWheel('time-wheel-hour',Array.from({length:12},(_,i)=>String(i+1))),minute=makeWheel('time-wheel-minute',['00','10','20','30','40','50']);
  $('schedule-time-open').onclick=()=>{
    const current=$('schedule-hour').value,selectedHour=current===''?13:Number(current);$('schedule-time-dialog').showModal();
    period.choose(selectedHour<12?'am':'pm');hour.choose(String(clockFromHour24(selectedHour)));minute.choose($('schedule-minute').value||'00');
  };
  $('schedule-time-apply').onclick=()=>{
    const pickedPeriod=period.value(),pickedHour=hour24FromClock(pickedPeriod,hour.value()),pickedMinute=minute.value();
    $('schedule-period').value=pickedPeriod;renderScheduleHours(String(pickedHour).padStart(2,'0'));syncScheduleTime();$('schedule-minute').value=pickedMinute;renderScheduleTimeLabel();updateScheduleSave();$('schedule-time-dialog').close();
  };
  renderScheduleTimeLabel();
})();
