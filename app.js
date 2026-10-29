import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const $ = id => document.getElementById(id);
const config = window.APP_CONFIG || {};
const connected = Boolean(config.supabaseUrl && config.supabasePublishableKey);
const db = connected ? createClient(config.supabaseUrl, config.supabasePublishableKey) : null;
const asset = {head:'assets/heart.png',shoulder:'assets/smile.png',belly:'assets/thinking.png',feet:'assets/crying.png'};
const reactions = {head:'와, 이번 학기 폼 미쳤다! 💖',shoulder:'오? 꽤 잘하고 있는데? 😎',belly:'음… 다음 학기엔 더 올라가 볼까? 🤔',feet:'이번 학기는 쉽지 않았네… 다음 학기는 반등 가자! 🥹'};
const cutoffs = [3.78,3.02,1.98]; // 시연용 점수 구간. 실제 백분위가 아닙니다.
let schools = [], school = '', scale = 4.5, grade = null, normalized = null, tab = 'national';
let hasSaved = false, latestStats = null, modalFocus = null;
try { const r = await fetch('./schools.json'); schools = await r.json(); } catch(e) { $('schoolHint').textContent='학교 목록 로드 실패: 사이트를 웹서버로 열어 주세요.'; }
const schoolInput=$('schoolSearch'), options=$('schoolOptions');
function showSuggestions(){
 const term=schoolInput.value.trim().toLocaleLowerCase();
 const hits = (term ? schools.filter(s=>s.toLocaleLowerCase().includes(term)) : schools).slice(0,15);
 options.replaceChildren();
 hits.forEach(name=>{ const b=document.createElement('button'); b.type='button'; b.className='school-option'; b.setAttribute('role','option'); b.textContent=name; b.onclick=()=>{school=name;schoolInput.value=name;options.hidden=true;schoolInput.setAttribute('aria-expanded','false');$('schoolHint').textContent=`✓ ${name} 선택됨`;validate();};options.appendChild(b);});
 if(!hits.length){const d=document.createElement('div');d.className='school-option';d.textContent='검색 결과가 없어요. 목록 보완이 필요합니다.';options.appendChild(d);}
 options.hidden=false;schoolInput.setAttribute('aria-expanded','true');
}
schoolInput.addEventListener('focus',showSuggestions);
schoolInput.addEventListener('input',()=>{school='';$('schoolHint').textContent='목록에서 학교를 선택해 주세요.';showSuggestions();validate();});
$('clearSchool').onclick=()=>{school='';schoolInput.value='';schoolInput.focus();showSuggestions();validate();};
document.addEventListener('click',e=>{if(!e.target.closest('.search-wrap')){options.hidden=true;schoolInput.setAttribute('aria-expanded','false');}});
document.querySelectorAll('[data-scale]').forEach(b=>b.onclick=()=>{scale=Number(b.dataset.scale);document.querySelectorAll('[data-scale]').forEach(x=>x.classList.toggle('selected',x===b));$('gpaInput').max=String(scale);validate();});
function validGrade(){ const s=$('gpaInput').value.trim(), n=Number(s);return s!==''&&Number.isFinite(n)&&n>=0&&n<=scale&&/^\d+(?:\.\d{1,2})?$/.test(s); }
function validate(){ $('checkBtn').disabled=!(Boolean(school)&&validGrade()); }
$('gpaInput').addEventListener('input',validate);
function zoneForScore(score){return score>=cutoffs[0]?'head':score>=cutoffs[1]?'shoulder':score>=cutoffs[2]?'belly':'feet';}
function position(score){const values=[4.5,3.78,3.02,1.98,0],ys=[10,33,56,79,94];for(let i=0;i<4;i++){if(score>=values[i+1])return ys[i]+(values[i]-score)/(values[i]-values[i+1])*(ys[i+1]-ys[i]);}return 94;}
function renderVisual(){let z=zoneForScore(normalized), pos=position(normalized);if(latestStats && latestStats.count>=30){
 // 통계 백분위 구간으로 표정 변경 (상위 25%,50%,75% 경계)
 const topPct=latestStats.top_percent;
 z=topPct<=25?'head':topPct<=50?'shoulder':topPct<=75?'belly':'feet';
 pos=Math.min(94,Math.max(10,10+(topPct/100)*84));
}
 $('capybara').src=asset[z];$('capybara').alt=`${z==='head'?'하트눈':z==='shoulder'?'웃음':z==='belly'?'고민':'울음'} 카피바라`;
 $('reaction').textContent=reactions[z];$('meLine').style.top=pos+'%';
}
function setInfo(title,desc){$('statTitle').textContent=title;$('statDescription').textContent=desc;}
async function ensureAuth(){let {data:{session},error}=await db.auth.getSession();if(error)throw error;if(!session){const response=await db.auth.signInAnonymously();if(response.error)throw response.error;} }
async function saveGrade(){ if(!connected){hasSaved=false;return;} await ensureAuth(); const {error}=await db.rpc('save_my_grade',{p_school:school,p_grade:grade,p_scale:scale});if(error)throw error;hasSaved=true; }
async function loadStats(){latestStats=null;renderVisual();
 if(!connected){setInfo('체험 모드 · 실제 비교 데이터 미연결','파란 점선과 구간은 점수 기반 시연용이에요. Supabase 연결 후 실제 참여자 통계로 바뀝니다.');return;}
 if(!hasSaved){setInfo('체험 모드 · 통계에 참여하지 않았어요','저장에 동의하지 않았거나 저장이 완료되지 않았어요. 파란 점선은 점수 시연용입니다.');return;}
 try {let {data,error}=await db.rpc('get_grade_summary',{p_scope:tab});if(error)throw error;latestStats=Array.isArray(data)?data[0]:data;
 if(!latestStats || latestStats.count<30){setInfo(tab==='school'?'우리 학교 비교 데이터 준비 중 🏫':'전국 비교 데이터 준비 중 🎓',`현재 이 범위에 참여자가 ${latestStats?.count??0}명 있어요. 30명 이상 모이면 참여자 기준 위치를 보여줄게요. (아래 캐릭터 위치는 점수 예시)`);latestStats=null;}
 else{let pc=Number(latestStats.top_percent);latestStats.top_percent=pc;setInfo(`참여자 ${latestStats.count}명 기준 · 상위 약 ${pc.toFixed(1)}%`, `평균 ${Number(latestStats.average_grade).toFixed(2)} / 4.5 · ${tab==='school'?school+' 참여자':'전체 참여자'} 기준이에요. 학교 인증이 없으므로 전체 학생을 대표하지 않아요.`);}
 }catch(e){latestStats=null;setInfo('통계를 불러오지 못했어요','Supabase SQL 설정과 인터넷 연결을 확인해 주세요.');console.error(e)}renderVisual();}
function showResult(){ $('backdrop').hidden=true;document.body.style.overflow='';$('entry').hidden=true;$('result').hidden=false;window.scrollTo({top:0,behavior:'smooth'});$('score').textContent=scale===4.3?`내 누적 평균 학점 ${grade.toFixed(2)} / 4.3 → ${normalized.toFixed(2)} / 4.5`:`내 누적 평균 학점 ${normalized.toFixed(2)} / 4.5`;loadStats();}
function showModal(){modalFocus=document.activeElement;$('backdrop').hidden=false;document.body.style.overflow='hidden';$('closeModal').focus();}
function closeModal(){if($('backdrop').hidden)return;$('backdrop').hidden=true;document.body.style.overflow='';if(modalFocus?.focus)modalFocus.focus();}
$('gradeForm').addEventListener('submit',async e=>{e.preventDefault();if(!school||!validGrade()){validate();return;}grade=Number($('gpaInput').value);normalized=Math.round((scale===4.3?grade/4.3*4.5:grade)*100)/100;$('formError').hidden=true;const b=$('checkBtn');b.disabled=true;b.textContent='결과 준비 중…';try{if($('storeConsent').checked) await saveGrade();else hasSaved=false;}catch(err){hasSaved=false;$('formError').hidden=false;$('formError').textContent='학점 저장에 실패했어요. 결과는 체험용으로 표시됩니다. 연결 설정을 확인해 주세요.';console.error(err);}finally{b.textContent='내 학점 위치 확인하기 →';validate();}
 showResult();showModal();});
$('closeModal').onclick=closeModal;$('viewResult').onclick=closeModal;
$('backdrop').addEventListener('click',e=>{if(e.target===$('backdrop'))closeModal();});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();});
$('retry').onclick=()=>{closeModal();$('result').hidden=true;$('entry').hidden=false;window.scrollTo(0,0);};
$('reopen').onclick=showModal;
function switchTab(next){tab=next;$('tabNational').classList.toggle('active',tab==='national');$('tabSchool').classList.toggle('active',tab==='school');loadStats();}
$('tabNational').onclick=()=>switchTab('national');$('tabSchool').onclick=()=>switchTab('school');
$('deleteData').onclick=async()=>{if(!connected){alert('현재는 체험 모드로 데이터가 서버에 저장되지 않았어요.');return;}if(!confirm('서버에 저장된 내 학점 기록을 삭제할까요?'))return;try{await ensureAuth();let {error}=await db.rpc('delete_my_grade');if(error)throw error;hasSaved=false;latestStats=null;alert('내 학점 기록을 삭제했어요.');await loadStats();}catch(e){alert('삭제에 실패했어요. Supabase 연결을 확인해 주세요.');console.error(e);}};
document.querySelectorAll('a.signup').forEach(a=>a.addEventListener('click',()=>{const event={event:'gemini_signup_click',position:a.dataset.position};console.info('click event (analytics not connected)',event);if(typeof window.gtag==='function')window.gtag('event',event.event,{button_position:event.position});}));
