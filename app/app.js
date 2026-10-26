/* Strong & Steady — app logic. Runs as an Android app (Capacitor, with the native "Steady" plugin
   for steps, reminders, speech and sharing) and as a plain offline web app (manual activity logging). */
"use strict";
window.APP_VERSION="1.5.1";

/* ================= utilities ================= */
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const pad=n=>String(n).padStart(2,"0");
function dk(d){d=d||new Date();return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate())}
function fromKey(k){const[y,m,d]=k.split("-").map(Number);return new Date(y,m-1,d,12)}
function addDays(k,n){const d=fromKey(k);d.setDate(d.getDate()+n);return dk(d)}
function weekStart(k){const d=fromKey(k);const wd=(d.getDay()+6)%7;d.setDate(d.getDate()-wd);return dk(d)}
function mins(hhmm){const[h,m]=String(hhmm||"0:0").split(":").map(Number);return h*60+(m||0)}
function hhmm(m){m=((Math.round(m)%1440)+1440)%1440;return pad(Math.floor(m/60))+":"+pad(m%60)}
function nice(hm){let m=mins(hm),h=Math.floor(m/60),mm=m%60,ap=h>=12?"pm":"am";h=h%12||12;return h+(mm?":"+pad(mm):"")+ap}
function nowMin(){const d=new Date();return d.getHours()*60+d.getMinutes()}
const fmt=n=>Number(n).toLocaleString("en-GB");
const dayName=k=>fromKey(k).toLocaleDateString("en-GB",{weekday:"long"});
const shortDate=k=>fromKey(k).toLocaleDateString("en-GB",{day:"numeric",month:"short"});
function toast(msg,ms){const t=document.createElement("div");t.className="toast";t.textContent=msg;document.body.appendChild(t);setTimeout(()=>t.remove(),ms||2600)}

/* ================= state ================= */
const KEY="strong-steady";
const DEFAULTS={v:1,setup:false,created:null,name:"",seated:false,wake:"08:00",mainTime:"10:30",nudges:true,cutoff:"16:00",
  treat:"a cup of tea and a biscuit",bigTreat:"fish and chips",stepGoal:3000,theme:"teal",size:"L",mode:"auto",voice:true,sound:true,
  levels:{},feel:{},sessions:[],walks:[],steps:{},illDays:{},illUntil:null,illFrom:null,comebackPending:false,
  journey:{id:"hadrian",start:null,laps:0,seen:0},push:{topic:null,on:false,last:"",lastAt:0,snooze:0},cal:{on:false,time:null},badges:{},checks:[],cel:{days:{},streaks:{}},timeAsk:{snooze:null},family:[],stepsSource:null};
let S=load();
function load(){let s={};try{s=JSON.parse(localStorage.getItem(KEY)||"{}")}catch(e){}
  const o=Object.assign(JSON.parse(JSON.stringify(DEFAULTS)),s);o.cel=Object.assign({days:{},streaks:{}},o.cel||{});return o}
function save(){try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}syncNative();schedulePush()}
function applyLook(){const r=document.documentElement;r.dataset.theme=S.theme;r.dataset.size=S.size;r.dataset.mode=S.mode}

/* ================= native bridge ================= */
const CAP=window.Capacitor;
const NATIVE=!!(CAP&&CAP.isNativePlatform&&CAP.isNativePlatform());
const NP=NATIVE&&CAP.Plugins?CAP.Plugins.Steady:null;
const native={
  ok:!!NP,
  async status(){if(!NP)return null;try{return await NP.status()}catch(e){return null}},
  async requestSteps(){if(!NP)return false;try{return (await NP.requestStepPermission()).granted}catch(e){return false}},
  async requestNotify(){if(!NP)return false;try{return (await NP.requestNotificationPermission()).granted}catch(e){return false}},
  async steps(){if(!NP)return null;try{return await NP.getSteps()}catch(e){return null}},
  configure(cfg){if(NP)NP.configure({config:JSON.stringify(cfg)}).catch(()=>{})},
  speak(t){if(NP){NP.speak({text:t}).catch(()=>{});return true}return false},
  stopSpeaking(){if(NP)NP.stopSpeaking().catch(()=>{})},
  awake(on){if(NP)NP.keepAwake({on:!!on}).catch(()=>{})},
  share(t){if(NP){NP.share({text:t}).catch(()=>{});return true}return false},
  battery(){if(NP)NP.openBatterySettings().catch(()=>{})},
  testNudge(){if(NP)NP.testNudge().catch(()=>{})},
  async updStatus(){if(!NP)return null;try{return await NP.updateStatus()}catch(e){return null}},
  async updCheck(force){if(!NP)return null;try{return await NP.checkUpdate({force:!!force})}catch(e){return null}},
  async updInstall(){if(!NP)return false;try{return (await NP.installUpdate()).started}catch(e){return false}},
  updQuiet(){if(NP)NP.installUpdate({quiet:true}).catch(()=>{})},
  updSettings(){if(NP)NP.openInstallSettings().catch(()=>{})}
};
function syncNative(){
  if(!native.ok||!S.setup)return;
  const t=dk(),done=[];for(let i=0;i<3;i++){const d=addDays(t,-i);if(S.sessions.some(x=>x.d===d))done.push(d)}
  const nl=nextStop();
  native.configure({enabled:!!S.nudges,wake:S.wake,mainTime:S.mainTime,cutoff:S.cutoff,name:S.name,stepGoal:S.stepGoal,
    illToday:isIll(t),illOpen:S.illUntil==="open",doneDates:done,streak:streak(),
    nextStop:nl?nl.stop.name:"",milesToNext:nl?Math.max(0,Math.round(nl.left*10)/10):0});
}

/* ================= derived data ================= */
const R=id=>ROUTINES.find(r=>r.id===id);
const isIll=d=>!!S.illDays[d];
const walkMin=d=>S.walks.filter(w=>w.d===d).reduce((a,w)=>a+w.min,0);
function dayStars(d){
  const ss=S.sessions.filter(x=>x.d===d),has=k=>ss.some(x=>(R(x.r)||{stars:[]}).stars.includes(k));
  return {move:(S.steps[d]||0)>=S.stepGoal||walkMin(d)>=15, strength:has("strength"), steady:has("steady")};
}
const starCount=d=>{const s=dayStars(d);return (s.move?1:0)+(s.strength?1:0)+(s.steady?1:0)};
function streak(){
  const t=dk();let d=t;if(!starCount(t))d=addDays(t,-1);
  const first=S.created||t;let n=0;const used={};
  for(let i=0;i<2000&&d>=first;i++){
    if(starCount(d))n++;
    else if(!isIll(d)){const w=weekStart(d);if(n>0&&!used[w]&&d!==t){used[w]=1}else break}
    d=addDays(d,-1);
  }
  return n;
}
function allDays(){const s=new Set();S.sessions.forEach(x=>s.add(x.d));S.walks.forEach(x=>s.add(x.d));Object.keys(S.steps).forEach(k=>s.add(k));return [...s].sort()}
function totalStars(){return allDays().reduce((a,d)=>a+starCount(d),0)}
function points(){return totalStars()*10+Object.keys(S.badges).length*25+S.checks.length*20}
function rank(){const p=points();let cur=RANKS[0],nxt=null;for(let i=0;i<RANKS.length;i++){if(p>=RANKS[i][0]){cur=RANKS[i];nxt=RANKS[i+1]||null}}return {p,name:cur[1],next:nxt,base:cur[0]}}
function weekStats(k){
  const ws=weekStart(k||dk());let stars=0,sbDays=0,moveDays=0;
  for(let i=0;i<7;i++){const d=addDays(ws,i),s=dayStars(d);stars+=starCount(d);if(s.strength||s.steady)sbDays++;if(s.move)moveDays++}
  return {ws,stars,sbDays,moveDays};
}
const J=()=>JOURNEYS.find(j=>j.id===S.journey.id)||JOURNEYS[0];
function journeyMiles(){
  const st=S.journey.start;if(!st)return 0;let m=0;
  allDays().forEach(d=>{if(d<st)return;const w=S.walks.filter(x=>x.d===d&&x.kind==="Walk").reduce((a,x)=>a+x.min,0);
    m+=Math.max((S.steps[d]||0)/STEPS_PER_MILE,w/WALK_MIN_PER_MILE)});
  m+=S.sessions.filter(x=>x.d>=st&&x.r!=="gentle").length*SESSION_MILES;
  return Math.min(m,J().miles);
}
function nextStop(){const m=journeyMiles(),j=J();const s=j.stops.find(x=>x.mi>m+1e-9);return s?{stop:s,left:s.mi-m}:null}
function level(rid){return S.levels[rid]||1}
function scaleReps(b,L){return L===1?b:L===2?Math.round(b*1.5):b*2}
function scaleHold(p,L){if(!p.holdMax||L===1)return p.hold;return L===2?Math.round((p.hold+p.holdMax)/2):p.holdMax}
function routineIds(r){
  let ids=r.list.map(id=>S.seated?(id in SEATED?SEATED[id]:id):id).filter(Boolean);
  return [...new Set(ids)];
}
function available(r){return !(S.seated&&r.standingOnly)&&!r.hidden}
function buildPlan(rid){
  const r=R(rid),L=level(rid),items=[];
  routineIds(r).forEach(id=>{const e=EX[id],p=e.plan,reps=scaleReps(p.reps,L),hold=scaleHold(p,L),sets=Math.min(p.sets||1,L);
    for(let s=1;s<=sets;s++){
      if(p.type==="each"){p.labels.forEach(lb=>items.push({id,side:lb,reps,hold,pace:p.pace||4,set:s,sets}))}
      else items.push({id,alt:p.type==="alt"?p.labels:null,reps:p.type==="alt"?reps*2:reps,hold,pace:p.pace||4,set:s,sets});
    }});
  return items;
}
function itemSecs(it){return it.reps*(it.hold?it.hold+5:it.pace)+15}
function planMinutes(rid){return Math.max(2,Math.round(buildPlan(rid).reduce((a,it)=>a+itemSecs(it),0)/60))}
function planText(it){
  const e=EX[it.id],u=e.plan.unit||"time";
  if(it.alt){const per=it.reps/2;return per+" "+(per===1?u:u+"s")+" each side"+(it.hold?", holding for "+it.hold+" seconds":"")}
  return it.reps+" "+(it.reps===1?u:u+"s")+(it.hold?", holding for "+it.hold+" seconds each":"");
}

/* ================= suggestions ================= */
function suggestRoutine(){
  const s=dayStars(dk()),last=(S.sessions[S.sessions.length-1]||{}).r;
  if(!s.strength){if(S.seated)return "chair";return last==="strength"?"chair":"strength"}
  if(!s.steady){if(S.seated)return "flex";return last==="balance"?"flex":"balance"}
  return null;
}
function encouragement(){
  const t=dk(),s=dayStars(t),n=starCount(t),now=nowMin(),st=streak(),name=S.name?", "+S.name:"";
  const hour=new Date().getHours(),hi=hour<12?"Good morning":hour<18?"Good afternoon":"Good evening";
  if(isIll(t))return {hi,msg:"Rest up and get well. Your streak and your journey are safe while you're unwell."};
  if(n===3)return {hi:hi+name,msg:"All three stars today. You've earned "+S.treat+"!"};
  const keep=st>0&&!n?" Do something today to make it "+(st+1)+" days in a row.":"";
  if(now<mins(S.mainTime)-30&&!n)return {hi:hi+name,msg:"Your exercise time today is "+nice(S.mainTime)+". Or start now if you fancy it."+keep};
  if(now>=mins(S.cutoff)+60&&!n)return {hi:hi+name,msg:"There's still time for a gentle few minutes if you'd like. If not, rest and start fresh tomorrow."};
  if(!n)return {hi:hi+name,msg:"It's exercise time! A short session earns your first star."+keep};
  const need=[!s.move&&"Move",!s.strength&&"Strength",!s.steady&&"Steady"].filter(Boolean);
  return {hi:hi+name,msg:"Lovely work. "+(3-n)+" more star"+(3-n>1?"s":"")+" ("+need.join(" and ")+") and you've earned "+S.treat+"."};
}

/* ================= speech, sound, confetti ================= */
let voice=null;
function pickVoice(){if(!window.speechSynthesis)return;const v=speechSynthesis.getVoices();voice=v.find(x=>/en-GB/i.test(x.lang))||v.find(x=>/^en/i.test(x.lang))||null}
if(window.speechSynthesis){pickVoice();speechSynthesis.onvoiceschanged=pickVoice}
function say(t){if(!S.voice||!t)return;if(native.speak(t))return;
  if(!window.speechSynthesis)return;try{speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(t);u.rate=.92;if(voice)u.voice=voice;u.lang="en-GB";speechSynthesis.speak(u)}catch(e){}}
function hush(){native.stopSpeaking();try{window.speechSynthesis&&speechSynthesis.cancel()}catch(e){}}
let AC=null;
function tone(seq){if(!S.sound)return;try{AC=AC||new (window.AudioContext||window.webkitAudioContext)();const t0=AC.currentTime;
  seq.forEach(([f,at,dur])=>{const o=AC.createOscillator(),g=AC.createGain();o.type="sine";o.frequency.value=f;o.connect(g);g.connect(AC.destination);
    g.gain.setValueAtTime(0,t0+at);g.gain.linearRampToValueAtTime(.22,t0+at+.02);g.gain.exponentialRampToValueAtTime(.001,t0+at+dur);o.start(t0+at);o.stop(t0+at+dur+.05)})}catch(e){}}
const chime=()=>tone([[523,0,.35],[659,.12,.35],[784,.24,.6]]);
const fanfare=()=>tone([[523,0,.25],[659,.15,.25],[784,.3,.25],[1047,.45,.8],[784,.75,.3],[1047,.9,1]]);
const blip=()=>tone([[880,0,.15]]);
function confetti(){
  const c=$("#confetti");if(matchMedia("(prefers-reduced-motion: reduce)").matches)return;
  c.hidden=false;c.width=innerWidth;c.height=innerHeight;const x=c.getContext("2d");
  const cols=["#e0a526","#0e5a57","#d9572b","#6a3b73","#2b8a3e","#2b4a6f"];
  const P=Array.from({length:140},()=>({x:Math.random()*c.width,y:-20-Math.random()*c.height*.5,vx:(Math.random()-.5)*3,vy:2+Math.random()*3,r:Math.random()*6,s:5+Math.random()*7,c:cols[Math.random()*cols.length|0],w:Math.random()*.2}));
  const end=performance.now()+2800;
  (function f(t){x.clearRect(0,0,c.width,c.height);P.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.r+=p.w;x.save();x.translate(p.x,p.y);x.rotate(p.r);x.fillStyle=p.c;x.fillRect(-p.s/2,-p.s/4,p.s,p.s/2);x.restore()});
    if(t<end)requestAnimationFrame(f);else{x.clearRect(0,0,c.width,c.height);c.hidden=true}})(performance.now());
}

/* ================= celebrations ================= */
let CQ=[],showing=false;
function celebrate(items){CQ.push(...items);if(!showing)nextCel()}
function nextCel(){
  const it=CQ.shift();if(!it){showing=false;closeLayer();renderAll();return}
  showing=true;
  const fam=it.family;
  openLayer(`<div class="dialog" role="dialog" aria-modal="true">
    <div class="emoji">${it.emoji||"🎉"}</div><h2>${esc(it.title)}</h2>
    ${it.text?`<p>${esc(it.text)}</p>`:""}
    ${it.treat?`<div class="treat">🎁 You've earned ${esc(it.treat)}!</div>`:""}
    ${fam?`<div class="note" style="text-align:left"><b>A message from ${esc(fam.from||"your family")}:</b><br>${esc(fam.text)}${fam.audio?`<br><button class="btn soft small" id="famplay" style="margin-top:8px">▶ Play the recording</button>`:""}</div>`:""}
    <button class="btn gold" id="celok" style="margin-top:12px">${esc(it.ok||"Lovely!")}</button></div>`);
  if(it.big){fanfare();confetti()}else{chime();if(it.confetti)confetti()}
  say(it.title+". "+(it.text||"")+(it.treat?" You've earned "+it.treat+"!":""));
  if(fam&&fam.audio){const a=new Audio(fam.audio);const pb=$("#famplay");pb.onclick=()=>{hush();a.currentTime=0;a.play().catch(()=>{})};setTimeout(()=>{hush();a.play().catch(()=>{})},2500)}
  $("#celok").onclick=()=>{hush();nextCel()};
}
function familyFor(kind){
  const list=S.family.filter(m=>m.when===kind||m.when==="any");if(!list.length)return null;
  list.sort((a,b)=>(a.played||0)-(b.played||0));const m=list[0];m.played=Date.now();return m;
}
const STREAK_MARKS=[3,7,14,30,60,100,150,200,365];
function evaluate(){
  const t=dk(),items=[],s=dayStars(t),c=S.cel.days[t]=S.cel.days[t]||[];
  const labels={move:["👟","Move star earned!","You've reached your step goal for today."],strength:["💪","Strength star earned!","Strong muscles help you get up, carry and climb."],steady:["⚖️","Steady star earned!","Good balance and flexibility keep you safe on your feet."]};
  ["move","strength","steady"].forEach(k=>{if(s[k]&&!c.includes(k)){c.push(k);const[e,ti,tx]=labels[k];
    const n=c.length;items.push({emoji:e,title:ti,text:tx+(n<3?" "+(3-n)+" more to go today.":""),confetti:n===3})}});
  if(c.length===3&&!c.includes("treat")){c.push("treat");items.push({emoji:"🌟",title:"Three stars today!",text:"A full set. You should be proud of yourself.",treat:S.treat,big:true})}
  const st=streak();
  STREAK_MARKS.forEach(m=>{if(st>=m&&!S.cel.streaks[m]){S.cel.streaks[m]=t;
    const bigOne=m>=7;items.push({emoji:m>=30?"🏆":"🔥",title:m+" days in a row!",text:m>=30?"That's a real habit now. Brilliant.":"You're building a great habit. Keep it going!",
      treat:bigOne?S.bigTreat:null,big:bigOne,family:m>=7?familyFor("streak"):null})}});
  const j=J(),mi=journeyMiles();
  if(!S.journey.start){S.journey.start=t}
  j.stops.forEach((sp,i)=>{if(i>0&&mi>=sp.mi&&i>(S.journey.seen||0)){S.journey.seen=i;
    const end=i===j.stops.length-1;items.push({emoji:end?"🏁":"📮",title:end?"You've walked the whole "+j.name+"!":"You've reached "+sp.name,text:sp.fact,big:end,confetti:!end,
      family:end?familyFor("journey"):null,ok:end?"Wonderful!":"Keep walking"})}});
  S.cel.games=S.cel.games||{};
  if(gamesToday()&&!S.cel.games[t]&&S.sessions.some(x=>x.d===t)){S.cel.games[t]=1;items.push({emoji:"🎮",title:"Games unlocked for today!",text:"You've done your exercise, so the games are yours to play as much as you like until midnight.",ok:"Brilliant"})}
  GAMES.forEach(g=>{if(g.rank!=="Starter"&&gameOpen(g)&&!S.cel.games["new-"+g.id]){S.cel.games["new-"+g.id]=t;items.push({emoji:g.icon,title:"New game unlocked: "+g.name+"!",text:"You've reached "+g.rank+" rank. Find it on the Games page.",big:true})}});
  newBadges().filter(b=>!/^s\d+$/.test(b.id)).forEach(b=>items.push({emoji:b.icon,title:"New badge: "+b.name,text:b.desc,confetti:true}));
  save();
  if(items.length)celebrate(items);
}
function newBadges(){
  const got=[],has=id=>S.badges[id],give=id=>{if(!has(id)){S.badges[id]=Date.now();got.push(BADGES.find(b=>b.id===id))}};
  const ds=allDays(),st=streak();
  if(S.sessions.length)give("first");
  if(ds.some(d=>starCount(d)===3))give("three");
  [[3,"s3"],[7,"s7"],[14,"s14"],[30,"s30"],[60,"s60"],[100,"s100"],[200,"s200"]].forEach(([n,id])=>{if(st>=n)give(id)});
  const weeks=new Set(ds.map(weekStart));weeks.forEach(w=>{const k=weekStats(w);if(k.sbDays>=2)give("nhs");if(k.stars>=14)give("week3")});
  if(Object.values(S.levels).some(l=>l>1))give("level");
  if(Object.values(S.levels).some(l=>l>=3))give("top");
  if(S.checks.length)give("checkup");
  if(S.checks.some(c=>c.bal>=4))give("steady");
  if(S.checks.some(c=>c.pb))give("pb");
  if(Object.values(S.steps).some(n=>n>=5000))give("steps5k");
  if(Object.values(S.steps).some(n=>n>=8000))give("steps8k");
  const mi=journeyMiles();if(mi>=J().miles/2||S.journey.laps)give("halfway");if(mi>=J().miles||S.journey.laps)give("journey");
  const done=new Set(S.sessions.map(x=>x.r));if(ROUTINES.filter(available).every(r=>done.has(r.id)))give("variety");
  if(S.sessions.some(x=>x.comeback))give("comeback");
  return got.filter(Boolean);
}

/* ================= layer (dialogs) ================= */
function openLayer(html){$("#layer").innerHTML=`<div class="overlay">${html}</div>`}
function closeLayer(){$("#layer").innerHTML=""}
function confirmBox(title,text,yes,no,onYes,onNo){
  openLayer(`<div class="dialog plain"><h2>${esc(title)}</h2><p>${esc(text)}</p><div class="stack"><button class="btn" id="cy">${esc(yes)}</button><button class="btn ghost" id="cn">${esc(no)}</button></div></div>`);
  $("#cy").onclick=()=>{closeLayer();onYes&&onYes()};$("#cn").onclick=()=>{closeLayer();onNo&&onNo()};
}

/* ================= poses (simple line drawings) ================= */
function pose(p){
  const chair=`<path d="M44 64 h40 M44 64 V26 M46 64 v34 M82 64 v34" stroke-width="5" opacity=".55"/>`;
  const fig={
    sit:`${chair}<circle cx="60" cy="16" r="9"/><path d="M60 25 V58 H92 V96 H102 M60 36 L80 50"/>`,
    "chair-front":`${chair}<circle cx="74" cy="16" r="9"/><path d="M72 25 L78 58 H100 V96 H110 M74 36 L90 52"/>`,
    "chair-back":`<path d="M24 60 h30 M54 60 V28 M26 60 v38 M54 60 v38" stroke-width="5" opacity=".55"/><circle cx="84" cy="16" r="9"/><path d="M84 25 v38 M84 63 l-6 35 M84 63 l6 35 M84 38 L56 32"/>`,
    wall:`<path d="M24 8 V100" stroke-width="7"/><circle cx="58" cy="18" r="9"/><path d="M58 27 v36 M58 63 l-8 33 M58 63 l8 33 M58 38 l-32 6"/>`,
    "wall-face":`<path d="M24 8 V100" stroke-width="7"/><circle cx="66" cy="18" r="9"/><path d="M66 27 v36 M66 63 l-6 33 M66 63 l8 33 M66 36 l-40 4 M66 40 l-40 6"/>`,
    stand:`<circle cx="70" cy="18" r="9"/><path d="M70 27 v36 M70 63 l-8 33 M70 63 l8 33 M70 38 l-14 18 M70 38 l14 18"/>`,
    step:`<path d="M10 98 H74 V76 H132" stroke-width="5" opacity=".55"/><path d="M100 76 V34" stroke-width="4" opacity=".55"/><circle cx="52" cy="16" r="9"/><path d="M52 25 V62 M52 62 L46 98 M52 62 L72 64 L80 76 M52 36 L98 40"/>`
  }[p]||"";
  return `<svg viewBox="0 0 140 104" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${fig}</svg>`;
}
function posLabel(p){return {sit:"Sitting on a firm chair without arms","chair-front":"Sitting on the front of a firm chair","chair-back":"Standing behind a firm chair, holding its back",wall:"Standing beside a wall or worktop","wall-face":"Standing facing a wall",stand:"Standing, with a chair nearby",step:"At the bottom stair, holding the rail"}[p]||""}

/* ================= views ================= */
let TAB="today";
function show(full){$("#shell").hidden=!!full;$("#full").hidden=!full;window.scrollTo(0,0)}
function renderAll(){
  if(!S.setup){setupView(0);return}
  if(P||G)return;
  show(false);
  const st=streak(),rk=rank();
  $("#chip-streak").textContent="🔥 "+st;$("#chip-rank").textContent="⭐ "+rk.name;
  document.querySelectorAll("#tabs button").forEach(b=>b.setAttribute("aria-current",b.dataset.tab===TAB?"page":"false"));
  ({today:todayView,exercise:exerciseView,journey:journeyView,games:gamesView,progress:progressView,more:moreView})[TAB]();
}
document.getElementById("gear").onclick=()=>{TAB="more";renderAll();window.scrollTo(0,0)};
document.getElementById("tabs").addEventListener("click",e=>{const b=e.target.closest("button[data-tab]");if(!b)return;TAB=b.dataset.tab;renderAll();window.scrollTo(0,0)});

function starsHTML(d){const s=dayStars(d),stp=S.steps[d]||0,wm=walkMin(d);
  const moveSub=S.stepsSource?fmt(stp)+" of "+fmt(S.stepGoal)+" steps"+(wm?" · "+wm+" min walked":""):(wm?wm+" of 15 min":"Walk 15 min");
  const w=[["move",s.move,"👟","Move",moveSub],["strength",s.strength,"💪","Strength","Strength or chair"],["steady",s.steady,"⚖️","Steady","Balance or stretch"]];
  return `<div class="stars">${w.map(([k,on,e,n,sub])=>`<button class="star ${on?"on":""}" data-star="${k}" aria-label="${n} star: ${on?"earned":"not yet"}. Tap for details"><div class="s">⭐</div>${e} ${n}<span class="w">${on?"✓ "+(k==="move"?esc(sub):"Earned"):esc(sub)}</span></button>`).join("")}</div>`}
async function stepsPanel(){
  const t=dk();let st=null;if(native.ok){st=await native.status();await refreshSteps(true)}
  const stp=S.steps[t]||0,wm=walkMin(t),left=Math.max(0,S.stepGoal-stp),when=S.stepsAt?new Date(S.stepsAt).toLocaleTimeString("en-GB",{hour:"numeric",minute:"2-digit"}):null;
  let h=`<div class="dialog plain"><h2>👟 Your Move star</h2>`;
  if(native.ok&&st&&st.steps){h+=`<div class="big" style="font-size:2.6em">${fmt(stp)}</div><p class="sub">steps today${when?" (checked at "+when+")":""}</p>
    <div class="bar" style="margin:10px 0"><i style="width:${Math.min(100,Math.round(stp/S.stepGoal*100))}%"></i></div>
    <p>${dayStars(t).move?"You've earned your Move star today. Well done!":"Your goal is "+fmt(S.stepGoal)+" steps: "+fmt(left)+" to go. A walk of 15 minutes or more also earns the star."}</p>
    <p class="small muted">Steps are counted while the phone is with you, in a pocket, bag or hand. Walks without the phone can be added below.</p>`}
  else if(native.ok&&st&&!st.sensor){h+=`<p>This phone doesn't have a step counter, so walks are added by hand instead. 15 minutes earns the Move star.</p>`}
  else if(native.ok){h+=`<p>Step counting isn't switched on yet.</p><button class="btn" id="sp-allow">Allow step counting</button><p class="small muted" style="margin-top:8px">If nothing happens, open the phone's Settings → Apps → Strong &amp; Steady → Permissions → Physical activity → Allow.</p>`}
  else h+=`<p>On this device, walks are added by hand. 15 minutes earns the Move star.</p>`;
  if(wm)h+=`<p><b>Walks and activity logged today: ${wm} minutes.</b></p>`;
  h+=`<div class="stack" style="margin-top:12px"><button class="btn soft" id="sp-walk">➕ Add a walk or other activity</button>${native.ok&&st&&st.steps?`<button class="btn soft" id="sp-refresh">↻ Check my steps again</button>`:""}<button class="btn ghost" id="sp-x">Close</button></div></div>`;
  openLayer(h);
  $("#sp-x").onclick=closeLayer;$("#sp-walk").onclick=logWalk;
  const r=$("#sp-refresh");if(r)r.onclick=()=>stepsPanel();
  const a=$("#sp-allow");if(a)a.onclick=async()=>{const ok=await native.requestSteps();if(ok){S.stepsSource="phone";save()}stepsPanel()};
}
function todayView(){
  const t=dk(),en=encouragement(),sug=suggestRoutine(),st=streak(),wk=weekStats(),ns=nextStop(),ill=isIll(t),rk=rank();
  const calNeedsUpdate=isIOS()&&webReminders()&&S.cal&&S.cal.on&&S.cal.time!==calSlot(S.mainTime);
  const remCard=calNeedsUpdate?`<div class="card gold"><b>📅 Your exercise time has changed</b><p class="small muted" style="margin:4px 0 10px">Update your daily Calendar reminder to ${nice(calSlot(S.mainTime))}.</p><button class="btn small" id="rem-go">Update the reminder</button></div>`:
    webReminders()&&S.nudges&&!(S.push&&S.push.on)&&!(S.cal&&S.cal.on)&&!(S.push&&S.push.snooze>Date.now())?`<div class="card"><b>🔔 Would you like reminders on this phone?</b><p class="small muted" style="margin:4px 0 10px">A gentle nudge at your exercise time, only on days you haven't exercised yet.</p><div class="row"><button class="btn small" id="rem-go">Set up (2 minutes)</button><button class="btn ghost small" id="rem-no">Not now</button></div></div>`:"";
  let h=`<h1>${esc(en.hi)}</h1>${updCard()}<div class="card ${starCount(t)===3?"gold":"hero"}"><p style="margin-top:0"><b>${esc(en.msg)}</b></p>${starsHTML(t)}`;
  if(ill){h+=`<button class="btn" id="better">I'm feeling better</button><button class="btn ghost" id="gentle" style="margin-top:10px">Try a gentle few minutes (optional)</button>`;
    const days=S.illFrom?Math.round((fromKey(t)-fromKey(S.illFrom))/864e5)+1:1;
    if(days>=7)h+=`<div class="note">You've been unwell for ${days} days. If you're not getting better, it's a good idea to speak to your GP or call NHS 111.</div>`;}
  else if(sug){const r=R(sug);h+=`<button class="btn" data-go="${sug}">▶ Start ${esc(r.name)} · about ${planMinutes(sug)} min</button>`}
  else if(!dayStars(t).move){h+=`<button class="btn" id="logw">👟 I've been for a walk</button>`}
  else h+=`<button class="btn soft" data-go="mix">Fancy a bonus Quick mix?</button>`;
  h+=`</div>`+remCard;
  if(!ill&&(sug||dayStars(t).move))h+=`<button class="btn soft" id="logw" style="margin-bottom:14px">👟 Add a walk or other activity</button>`;
  h+=gamesToday()?`<button class="btn gold" id="gogames" style="margin-bottom:14px">🎮 Games unlocked: play now</button>`:`<div class="card"><b>🎮 Games are locked today.</b> <span class="muted">Do any exercise session to unlock them.</span></div>`;
  if(due())h+=`<div class="card"><h3>📋 Your monthly check-up is due</h3><p>Three quick tests that show how much stronger and steadier you're getting.</p><button class="btn soft" id="chk">Do my check-up</button></div>`;
  h+=`<div class="tiles"><div class="tile"><b>🔥 ${st}</b><span>day${st===1?"":"s"} in a row</span></div>
    <div class="tile"><b>${wk.stars}</b><span>stars this week</span></div>
    <div class="tile"><b>${wk.sbDays} of 2</b><span>NHS strength &amp; balance days ${wk.sbDays>=2?"✓ done":""}</span></div>
    <div class="tile"><b>${ns?ns.left.toFixed(1)+" mi":"🏁"}</b><span>${ns?"to "+esc(ns.stop.name):"Journey complete!"}</span></div></div>`;
  const pc=rk.next?Math.round((rk.p-rk.base)/(rk.next[0]-rk.base)*100):100;
  h+=`<div class="card"><div class="row" style="align-items:center"><div><b>⭐ ${esc(rk.name)}</b> <span class="muted small">${fmt(rk.p)} points</span></div></div>
    <div class="bar goldbar" style="margin:8px 0"><i style="width:${pc}%"></i></div><span class="muted small">${rk.next?fmt(rk.next[0]-rk.p)+" points to "+esc(rk.next[1])+". Every star is 10 points.":"The very top. Amazing!"}</span></div>`;
  if(!ill)h+=`<button class="btn stop" id="unwell">🤒 I'm unwell today</button>`;
  $("#view").innerHTML=h;
  $("#view").querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>startRoutine(b.dataset.go));
  const lw=$("#logw");if(lw)lw.onclick=logWalk;
  const uw=$("#unwell");if(uw)uw.onclick=illDialog;
  const bt=$("#better");if(bt)bt.onclick=()=>{endIll();toast("Welcome back! Take it gently to start with.");renderAll()};
  const gn=$("#gentle");if(gn)gn.onclick=()=>startRoutine("gentle");
  const ck=$("#chk");if(ck)ck.onclick=()=>checkup();
  const gg=$("#gogames");if(gg)gg.onclick=()=>{TAB="games";renderAll()};
  const ug=$("#updgo");if(ug)ug.onclick=updInstall;
  const rg=$("#rem-go");if(rg)rg.onclick=()=>isIOS()?calSetup():reminderSetup();
  const rn=$("#rem-no");if(rn)rn.onclick=()=>{S.push.snooze=Date.now()+7*864e5;save();renderAll()};
  $("#view").querySelectorAll("[data-star]").forEach(b=>b.onclick=()=>{const k=b.dataset.star;
    if(k==="move")return stepsPanel();
    const rid=k==="strength"?(S.seated?"chair":"strength"):(S.seated?"flex":"balance");
    if(dayStars(dk())[k]){toast("You've already earned this star today. Well done!");return}
    confirmBox(R(rid).name,"Start "+R(rid).name+" now? It takes about "+planMinutes(rid)+" minutes.","▶ Start","Not now",()=>startRoutine(rid))});
}
const ICON={strength:"💪",balance:"⚖️",chair:"🪑",flex:"🙆",mix:"✨",gentle:"🌿"};
function exerciseView(){
  let h=`<h1>Exercise</h1><p class="muted">Each session takes about 5–12 minutes. Do them at your own pace.</p><div class="rlist">`;
  ROUTINES.filter(r=>!r.hidden).forEach(r=>{const ok=available(r);
    h+=`<button class="rbtn" data-go="${r.id}" ${ok?"":"disabled"}><span class="ic">${ICON[r.id]}</span><span><b>${esc(r.name)}</b><span>${ok?esc(r.blurb)+" About "+planMinutes(r.id)+" min.":"Done standing, so it's switched off in seated-only mode."}</span></span><span class="lv">Level ${level(r.id)}</span></button>`});
  h+=`</div><h2 style="margin-top:22px">All the exercises</h2><p class="muted small">Tap one to see how to do it.</p><div class="rlist">`;
  Object.keys(EX).forEach(id=>{const e=EX[id];h+=`<button class="rbtn" data-ex="${id}" style="min-height:64px"><span class="ic" style="font-size:1em;width:auto;color:var(--pri)">${pose(e.pos).replace("<svg","<svg style='width:56px;height:42px'")}</span><span><b>${esc(e.name)}</b><span>${esc(e.why)}</span></span></button>`});
  h+=`</div><p class="muted small" style="margin-top:14px">Exercises from the NHS strength, balance, flexibility and sitting exercise guides. Seated versions marked "adapted" are gentle variations for people who exercise sitting down.</p>`;
  $("#view").innerHTML=h;
  $("#view").querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>startRoutine(b.dataset.go));
  $("#view").querySelectorAll("[data-ex]").forEach(b=>b.onclick=()=>exInfo(b.dataset.ex));
}
function exInfo(id){const e=EX[id];
  openLayer(`<div class="dialog plain"><div class="pose">${pose(e.pos)}</div><h2>${esc(e.name)}</h2><p class="muted">${esc(posLabel(e.pos))}</p><p>${esc(e.why)}</p><ol class="steps-list">${e.steps.map(s=>`<li>${esc(s)}</li>`).join("")}</ol><p class="small muted">Source: ${e.src==="adapted"?"a gentle seated version":esc(e.src)}.</p><button class="btn" id="cx">Close</button></div>`);
  $("#cx").onclick=closeLayer;}

function journeyView(){
  const j=J(),mi=journeyMiles(),pc=mi/j.miles,ns=nextStop();
  const pts=j.stops.map(s=>s.mi/j.miles);
  const W=640,H=220,px=f=>30+f*(W-60),py=f=>110+Math.sin(f*Math.PI*3)*55;
  let path="";for(let i=0;i<=100;i++){const f=i/100;path+=(i?"L":"M")+px(f).toFixed(1)+" "+py(f).toFixed(1)}
  let walked="";for(let i=0;i<=100;i++){const f=Math.min(pc,i/100);walked+=(i?"L":"M")+px(f).toFixed(1)+" "+py(f).toFixed(1);if(i/100>=pc)break}
  let h=`<h1>${esc(j.name)}</h1><p class="muted">From ${esc(j.from)} to ${esc(j.to)}: ${j.miles} miles coast to coast.${S.journey.laps?" You've finished it "+S.journey.laps+" time"+(S.journey.laps>1?"s":"")+" already!":""}</p>
  <div class="card"><svg class="map" viewBox="0 0 ${W} ${H}" role="img" aria-label="Map of your progress"><path d="${path}" stroke="var(--line)" stroke-width="10" fill="none" stroke-linecap="round"/>
  <path d="${walked}" stroke="var(--gold)" stroke-width="10" fill="none" stroke-linecap="round"/>
  ${pts.map((f,i)=>`<circle cx="${px(f)}" cy="${py(f)}" r="${i===0||i===pts.length-1?9:6}" fill="${f<=pc?"var(--gold)":"var(--card)"}" stroke="var(--pri)" stroke-width="3"/>`).join("")}
  <text x="${px(pc)}" y="${py(pc)-16}" text-anchor="middle" font-size="26">🚶</text></svg>
  <div class="bar goldbar"><i style="width:${(pc*100).toFixed(1)}%"></i></div>
  <p><b>${mi.toFixed(1)} of ${j.miles} miles</b>${ns?` · ${ns.left.toFixed(1)} miles to ${esc(ns.stop.name)}`:""}</p>
  <p class="small muted">How you move along: every ${fmt(STEPS_PER_MILE)} steps is about a mile${S.stepsSource?"":" (or 25 minutes of walking that you log)"}, plus half a mile for every exercise session.</p></div>`;
  if(mi>=j.miles)h+=`<button class="btn gold" id="again" style="margin-bottom:14px">Walk it again</button>`;
  h+=`<div class="card"><h2>Postcards</h2>`;
  j.stops.forEach((s,i)=>{const done=mi>=s.mi,next=ns&&ns.stop===s;
    h+=`<div class="stop-row ${done?"done":""} ${next?"next":""}"><div class="dot">${done?"✓":i+1}</div><div><b>${esc(s.name)}</b> <span class="muted small">mile ${s.mi}</span><br><span class="small ${done?"":"muted"}">${done?esc(s.fact):next?"Next stop. Keep going!":"Not reached yet"}</span></div></div>`});
  h+=`<p class="small muted">Distances are approximate, based on the National Trail's six stages.</p></div>`;
  $("#view").innerHTML=h;
  const ag=$("#again");if(ag)ag.onclick=()=>{S.journey.laps=(S.journey.laps||0)+1;S.journey.start=addDays(dk(),1);S.journey.seen=0;save();toast("New lap starts tomorrow. Here we go again!");renderAll()};
}

function progressView(){
  const t=dk(),wk=weekStats();
  let h=`<h1>Your progress</h1><div class="tiles"><div class="tile"><b>${totalStars()}</b><span>stars in total</span></div><div class="tile"><b>${S.sessions.length}</b><span>sessions done</span></div>
  <div class="tile"><b>${Object.keys(S.badges).length} / ${BADGES.length}</b><span>badges</span></div><div class="tile"><b>${journeyMiles().toFixed(1)}</b><span>miles walked on your journey</span></div></div>`;
  h+=`<div class="card"><h2>The last four weeks</h2><div class="cal">${["M","T","W","T","F","S","S"].map(x=>`<div class="h">${x}</div>`).join("")}`;
  const start=addDays(weekStart(t),-21);
  for(let i=0;i<28;i++){const d=addDays(start,i),n=starCount(d),fut=d>t;
    h+=`<div class="d ${d===t?"today":""} ${isIll(d)?"ill":""} ${fut?"future":""}"><span class="n">${fromKey(d).getDate()}</span>${fut?"":isIll(d)?"🤒":n?"⭐".repeat(n):"·"}</div>`}
  h+=`</div><p class="small muted">⭐ = a star earned · 🤒 = unwell (your streak is protected) · Everyone gets one rest day a week without breaking their streak.</p>
  <button class="btn soft" id="share">📤 Share my week with family</button></div>`;
  h+=`<div class="card"><h2>Badges</h2><div class="badges">${BADGES.map(b=>`<div class="badge ${S.badges[b.id]?"":"locked"}"><span class="e">${b.icon}</span><b>${esc(b.name)}</b><br>${esc(b.desc)}</div>`).join("")}</div></div>`;
  h+=`<div class="card"><h2>📋 Check-ups</h2><p>Once a month, three short tests show how much stronger and steadier you're getting. Beat your best and you earn a badge.</p>`;
  if(S.checks.length){h+=`<table style="width:100%;border-collapse:collapse;font-size:.9em"><tr><th align="left">Date</th>${S.seated?"":"<th>Stands</th>"}<th>Curls</th>${S.seated?"":"<th>Balance</th>"}</tr>`+
    S.checks.slice(-6).reverse().map(c=>`<tr><td>${shortDate(c.d)}</td>${S.seated?"":`<td align="center">${c.stand??"–"}</td>`}<td align="center">${c.curl??"–"}</td>${S.seated?"":`<td align="center">${c.bal??"–"} / 4</td>`}</tr>`).join("")+`</table>`}
  h+=`<button class="btn soft" id="chk" style="margin-top:10px">${S.checks.length?"Do a check-up":"Do my first check-up"}</button></div>`;
  h+=`<div class="card"><h2>Recent activity</h2>`;
  const recent=[...S.sessions.map(x=>({t:x.t,txt:(ICON[x.r]||"")+" "+(R(x.r)?R(x.r).name:x.r)+(x.partial?" (part)":"")})),...S.walks.map(w=>({t:w.t,txt:"👟 "+w.kind+", "+w.min+" min",w}))].sort((a,b)=>b.t-a.t).slice(0,10);
  h+=recent.length?recent.map(r=>`<div class="setrow"><b>${esc(r.txt)}</b><br><span class="muted small">${new Date(r.t).toLocaleString("en-GB",{weekday:"short",day:"numeric",month:"short",hour:"numeric",minute:"2-digit"})}</span></div>`).join(""):`<p class="muted">Nothing yet. Your first session will appear here.</p>`;
  h+=`</div>`;
  $("#view").innerHTML=h;
  $("#share").onclick=shareWeek;$("#chk").onclick=()=>checkup();
}
function shareWeek(){
  const wk=weekStats(),ns=nextStop();
  const txt=`${S.name||"My"}${S.name?"'s":""} week on Strong & Steady: ⭐ ${wk.stars} stars, 🔥 ${streak()} days in a row, 💪 ${wk.sbDays} strength & balance days. 🗺️ ${journeyMiles().toFixed(1)} miles along ${J().name}${ns?", heading for "+ns.stop.name:""}.`;
  if(native.share(txt))return;
  if(navigator.share){navigator.share({text:txt}).catch(()=>{});return}
  navigator.clipboard&&navigator.clipboard.writeText(txt).then(()=>toast("Copied. Paste it into a message."),()=>toast(txt,6000));
}

/* ================= settings ================= */
function moreView(){
  const timeOpts=(sel,from,to,step)=>{let o="";for(let m=from;m<=to;m+=step){const v=hhmm(m);o+=`<option value="${v}" ${v===sel?"selected":""}>${nice(v)}</option>`}return o};
  let h=`<h1>Settings and help</h1>
  <div class="card"><h2>About you</h2>
  <label class="f" for="s-name">Your name</label><input type="text" id="s-name" value="${esc(S.name)}" maxlength="30">
  <div class="toggle"><span><b>Seated-only exercises</b><br><span class="small muted">Everything done sitting in a chair.</span></span><input type="checkbox" id="s-seated" ${S.seated?"checked":""}></div>
  <label class="f" for="s-goal">Daily step goal</label><select id="s-goal">${[1500,2000,2500,3000,4000,5000,6000,7000,8000,10000].map(n=>`<option ${n===S.stepGoal?"selected":""} value="${n}">${fmt(n)} steps</option>`).join("")}</select></div>
  <div class="card"><h2>Your day</h2>
  <label class="f" for="s-wake">I usually get up around</label><select id="s-wake">${timeOpts(S.wake,300,720,30)}</select>
  <label class="f" for="s-main">My exercise time</label><select id="s-main">${timeOpts(S.mainTime,360,1260,15)}</select>
  <div class="toggle"><span><b>Reminders</b><br><span class="small muted">${native.ok?"A gentle nudge if you haven't exercised yet.":webReminders()?(S.cal&&S.cal.on?"A daily reminder in your Calendar at "+nice(S.cal.time)+".":S.push&&S.push.on?"Set up on this phone, through the ntfy app.":"Needs a quick setup on this phone (below)."):"Reminders work in the phone app version."}</span></span><input type="checkbox" id="s-nudge" ${S.nudges?"checked":""}></div>
  <label class="f" for="s-cut">No reminders after</label><select id="s-cut">${timeOpts(S.cutoff,600,1260,30)}</select>
  ${webReminders()?(isIOS()?`<button class="btn soft small" id="s-cal" style="margin-top:12px">${S.cal&&S.cal.on?"Update my daily Calendar reminder":"Add a daily reminder to my Calendar"}</button><button class="link" id="s-rem" style="display:block">Other option: reminders through the ntfy app</button>`:`<button class="btn soft small" id="s-rem" style="margin-top:12px">${S.push&&S.push.on?"Reminder set-up and test":"Set up reminders on this phone"}</button>`):""}
  ${native.ok?`<button class="btn soft small" id="s-test" style="margin-top:12px">Send me a test reminder</button><button class="btn soft small" id="s-batt" style="margin-top:10px">Let reminders through the battery saver</button>`:""}</div>
  <div class="card"><h2>Treats</h2><p class="small muted">What you've earned when you get all three stars, and for big streaks.</p>
  <label class="f" for="s-treat">Daily treat</label><input type="text" id="s-treat" value="${esc(S.treat)}" maxlength="60">
  <label class="f" for="s-big">Big treat</label><input type="text" id="s-big" value="${esc(S.bigTreat)}" maxlength="60"></div>
  <div class="card"><h2>Look and sound</h2>
  <label class="f" for="s-size">Text size</label><select id="s-size"><option value="L" ${S.size==="L"?"selected":""}>Large</option><option value="XL" ${S.size==="XL"?"selected":""}>Extra large</option></select>
  <label class="f" for="s-theme">Colours</label><select id="s-theme"><option value="teal" ${S.theme==="teal"?"selected":""}>Teal</option><option value="heather" ${S.theme==="heather"?"selected":""}>Heather</option><option value="slate" ${S.theme==="slate"?"selected":""}>Slate blue</option></select>
  <label class="f" for="s-mode">Light or dark</label><select id="s-mode"><option value="auto" ${S.mode==="auto"?"selected":""}>Same as the phone</option><option value="light" ${S.mode==="light"?"selected":""}>Always light</option><option value="dark" ${S.mode==="dark"?"selected":""}>Always dark</option></select>
  <div class="toggle"><span><b>Spoken instructions</b></span><input type="checkbox" id="s-voice" ${S.voice?"checked":""}></div>
  <div class="toggle"><span><b>Sounds</b></span><input type="checkbox" id="s-sound" ${S.sound?"checked":""}></div></div>
  <div class="card"><h2>💌 Messages from family</h2><p class="small muted">Family can leave messages that pop up at big moments, like a 7-day streak or the end of a journey.</p>
  ${S.family.map((m,i)=>`<div class="setrow"><b>${esc(m.from||"Family")}</b>: ${esc(m.text)} ${m.audio?"🎙️":""}<br><span class="small muted">${({any:"Any big moment",streak:"Streaks",journey:"Finishing a journey",pb:"A personal best"})[m.when]}</span> <button class="link" data-del="${i}">Remove</button></div>`).join("")}
  <button class="btn soft" id="s-fam" style="margin-top:10px">Add a message</button></div>
  <div class="card"><h2>Exercising safely</h2>${SAFETY}</div>
  ${native.ok?`<div class="card"><h2>App updates</h2><p id="upd-st" class="small">The app checks for new versions by itself and installs them when it can.</p><div class="stack"><button class="btn soft" id="s-upd">Check for an update now</button></div></div>`:""}
  <div class="card"><h2>About</h2><p>Strong &amp; Steady, version ${APP_VERSION}. Free to use. Your information stays on this phone.</p>
  <p class="small">Exercises from the NHS <i>Strength and flexibility exercises</i> guides (sitting, strength, balance and flexibility). Weekly targets from the NHS <i>Physical activity guidelines for older adults</i>. Journey distances from National Trails. This app is not medical advice.</p>
  </div>
  <div class="card"><h2>Back up your progress</h2><p class="small muted">Useful if you change phone or reinstall the app. Send the backup to yourself (for example by email or WhatsApp), then paste it back in here.</p>
  <div class="stack"><button class="btn soft" id="s-backup">📤 Send a backup</button><button class="btn soft" id="s-restore">📥 Restore from a backup</button>
  <button class="btn ghost small" id="s-reset">Start again (clear everything)</button></div></div>`;
  $("#view").innerHTML=h;
  const bind=(id,key,conv)=>{const el=$(id);el.onchange=()=>{S[key]=conv?conv(el):el.value;applyLook();save();if(key==="seated")renderAll()}};
  bind("#s-name","name",el=>el.value.trim());bind("#s-seated","seated",el=>el.checked);bind("#s-goal","stepGoal",el=>+el.value);
  bind("#s-wake","wake");bind("#s-main","mainTime");bind("#s-nudge","nudges",el=>el.checked);bind("#s-cut","cutoff");
  bind("#s-treat","treat",el=>el.value.trim()||"a cup of tea and a biscuit");bind("#s-big","bigTreat",el=>el.value.trim()||"fish and chips");
  bind("#s-size","size");bind("#s-theme","theme");bind("#s-mode","mode");bind("#s-voice","voice",el=>el.checked);bind("#s-sound","sound",el=>el.checked);
  const ts=$("#s-test");if(ts)ts.onclick=()=>{native.testNudge();toast("A test reminder is on its way.")};
  const sb=$("#s-batt");if(sb)sb.onclick=batteryHelp;
  const sr=$("#s-rem");if(sr)sr.onclick=reminderSetup;
  const sc=$("#s-cal");if(sc)sc.onclick=calSetup;
  const su=$("#s-upd");if(su){native.updStatus().then(st=>{if(st&&$("#upd-st"))$("#upd-st").textContent="You have version "+APP_VERSION+(st.lastCheck?". Last checked "+new Date(st.lastCheck).toLocaleString("en-GB",{weekday:"short",hour:"numeric",minute:"2-digit"})+".":".")});
    su.onclick=async()=>{su.disabled=true;su.textContent="Checking…";const r=await updCheck(true);su.disabled=false;su.textContent="Check for an update now";
      if(r&&r.ready)updInstall();else if(r&&r.latest>r.current)toast("A new version is downloading. It'll be ready shortly.");else if(r&&!r.error)toast("You have the latest version.");else toast("Couldn't check just now. Is the phone online?")}}
  $("#s-fam").onclick=addFamily;
  $("#view").querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>{S.family.splice(+b.dataset.del,1);save();renderAll()});
  $("#s-backup").onclick=()=>{const copy=Object.assign({},S,{family:S.family.map(m=>Object.assign({},m,{audio:null}))});
    const txt="STRONG-STEADY-BACKUP "+btoa(unescape(encodeURIComponent(JSON.stringify(copy))));
    if(native.share(txt))return;if(navigator.share){navigator.share({text:txt}).catch(()=>{});return}
    navigator.clipboard&&navigator.clipboard.writeText(txt).then(()=>toast("Backup copied. Paste it into an email to yourself."))};
  $("#s-restore").onclick=()=>{openLayer(`<div class="dialog plain"><h2>Restore from a backup</h2><p>Paste the whole backup message below.</p><textarea id="rb" rows="5"></textarea><div class="stack" style="margin-top:10px"><button class="btn" id="rbok">Restore</button><button class="btn ghost" id="rbx">Cancel</button></div></div>`);
    $("#rbx").onclick=closeLayer;$("#rbok").onclick=()=>{try{const m=$("#rb").value.match(/STRONG-STEADY-BACKUP\s+([A-Za-z0-9+/=]+)/);const o=JSON.parse(decodeURIComponent(escape(atob(m[1]))));
      if(!o||!o.setup)throw 0;const keepAudio=S.family;S=Object.assign(load(),o);if(keepAudio.length&&!S.family.length)S.family=keepAudio;save();applyLook();closeLayer();renderAll();toast("Progress restored. Welcome back!")}catch(e){toast("That doesn't look like a complete backup. Try copying it again.")}}};
  $("#s-reset").onclick=()=>confirmBox("Clear everything?","This removes all your stars, badges, journey and settings from this phone. It can't be undone.","Yes, clear everything","No, keep it",()=>{localStorage.removeItem(KEY);S=load();applyLook();renderAll()});
}
const SAFETY=`<ul class="plain"><li>If you haven't exercised for a while, or you have a health condition, check with your GP first.</li>
<li>Use a firm chair without wheels or arms. Wear comfortable clothes and keep water nearby.</li>
<li>Do balance exercises near a wall or a sturdy chair you can hold.</li>
<li>Start slowly and build up gradually. Only move as far as is comfortable.</li>
<li>Feeling a bit warm, slightly out of breath and your heart beating faster is normal.</li></ul>
<div class="warn"><b>Stop and sit down</b> if you feel dizzy, have chest pain, or your heartbeat feels irregular. Don't carry on that day. If chest pain doesn't go away when you rest, call 999.</div>`;
function batteryHelp(){
  openLayer(`<div class="dialog plain"><h2>Let reminders through</h2><p>Some phones, including Oppo, close apps in the background to save battery, which can stop reminders and step counting.</p>
  <ol class="steps-list"><li>Tap <b>Open battery settings</b> below.</li><li>Find <b>Strong &amp; Steady</b>.</li><li>Choose <b>Allow background activity</b> (or turn off <b>Optimise battery use</b>).</li></ol>
  <p class="small muted">On Oppo phones this is usually under Settings → Battery → More settings → Optimise battery use, or App info → Battery usage.</p>
  <div class="stack"><button class="btn" id="ob">Open battery settings</button><button class="btn ghost" id="cx">Done</button></div></div>`);
  $("#ob").onclick=()=>native.battery();$("#cx").onclick=closeLayer;
}
function addFamily(){
  let rec=null,chunks=[],audio=null;
  openLayer(`<div class="dialog plain"><h2>Add a family message</h2>
  <label class="f" for="fm-from">From</label><input type="text" id="fm-from" placeholder="e.g. Mark" maxlength="30">
  <label class="f" for="fm-text">Message</label><textarea id="fm-text" rows="3" maxlength="200" placeholder="e.g. So proud of you, keep it up!"></textarea>
  <label class="f" for="fm-when">Show it for</label><select id="fm-when"><option value="any">Any big moment</option><option value="streak">Streaks of 7 days or more</option><option value="journey">Finishing a journey</option><option value="pb">A personal best in a check-up</option></select>
  <div class="stack" style="margin-top:12px">${navigator.mediaDevices&&window.MediaRecorder?`<button class="btn soft" id="fm-rec">🎙️ Record a voice message (optional)</button>`:""}<p class="small muted" id="fm-st"></p>
  <button class="btn" id="fm-save">Save message</button><button class="btn ghost" id="fm-x">Cancel</button></div></div>`);
  const rb=$("#fm-rec");
  if(rb)rb.onclick=async()=>{
    if(rec&&rec.state==="recording"){rec.stop();return}
    try{const stream=await navigator.mediaDevices.getUserMedia({audio:true});chunks=[];rec=new MediaRecorder(stream);
      rec.ondataavailable=e=>chunks.push(e.data);
      rec.onstop=()=>{stream.getTracks().forEach(t=>t.stop());const b=new Blob(chunks,{type:rec.mimeType||"audio/webm"});const fr=new FileReader();fr.onload=()=>{audio=fr.result;$("#fm-st").textContent="Recording saved ("+Math.round(b.size/1024)+" KB).";rb.textContent="🎙️ Record again"};fr.readAsDataURL(b)};
      rec.start();rb.textContent="⏹ Stop recording";$("#fm-st").textContent="Recording… (up to 20 seconds)";setTimeout(()=>{if(rec&&rec.state==="recording")rec.stop()},20000);
    }catch(e){$("#fm-st").textContent="The microphone isn't available. A written message works just as well."}};
  $("#fm-save").onclick=()=>{const text=$("#fm-text").value.trim();if(!text&&!audio){toast("Write a message or record one first.");return}
    S.family.push({id:Date.now(),from:$("#fm-from").value.trim(),text:text||"(voice message)",audio,when:$("#fm-when").value});save();closeLayer();renderAll();toast("Message saved. It'll pop up at the right moment.")};
  $("#fm-x").onclick=closeLayer;
}

/* ================= unwell + walks ================= */
function illDialog(){
  openLayer(`<div class="dialog plain"><h2>Sorry you're not feeling well</h2><p>Your streak and journey will be paused, and there will be no reminders.</p>
  <div class="stack"><button class="btn" id="i1">Just for today</button><button class="btn" id="i2">Until I tell you I'm better</button><button class="btn ghost" id="ix">Cancel</button></div>
  <p class="small muted">If you feel very unwell, contact your GP or call NHS 111. In an emergency, call 999.</p></div>`);
  $("#i1").onclick=()=>{S.illDays[dk()]=1;S.illFrom=S.illFrom||dk();S.illUntil=dk();save();closeLayer();renderAll()};
  $("#i2").onclick=()=>{S.illDays[dk()]=1;S.illFrom=S.illFrom||dk();S.illUntil="open";save();closeLayer();renderAll()};
  $("#ix").onclick=closeLayer;
}
function endIll(){const t=dk();if(S.illDays[t]&&!S.sessions.some(x=>x.d===t)&&!starCount(t))delete S.illDays[t];S.illUntil=null;S.illFrom=null;S.comebackPending=true;save()}
function rollIll(){ /* keep "until I'm better" days marked even if the app wasn't opened */
  if(S.illUntil==="open"&&S.illFrom){let d=S.illFrom;const t=dk();while(d<=t){S.illDays[d]=1;d=addDays(d,1)}}
  else if(S.illUntil&&S.illUntil!=="open"&&S.illUntil<dk()){S.illUntil=null;S.illFrom=null;S.comebackPending=true}
}
function logWalk(){
  let kind="Walk",min=20;
  const kinds=["Walk","Gardening","Housework","Swimming","Dancing","Other"],ms=[10,15,20,30,45,60];
  const draw=()=>{openLayer(`<div class="dialog plain"><h2>What did you do?</h2><div class="opts" style="grid-template-columns:1fr 1fr">${kinds.map(k=>`<button class="opt" data-k="${k}" aria-pressed="${k===kind}">${k}</button>`).join("")}</div>
    <h3 style="margin-top:14px">For how long?</h3><div class="opts" style="grid-template-columns:1fr 1fr 1fr">${ms.map(m=>`<button class="opt" data-m="${m}" aria-pressed="${m===min}">${m} min</button>`).join("")}</div>
    <div class="stack" style="margin-top:14px"><button class="btn" id="ws">Save</button><button class="btn ghost" id="wx">Cancel</button></div><p class="small muted">15 minutes or more of activity earns your Move star.</p></div>`);
    document.querySelectorAll("[data-k]").forEach(b=>b.onclick=()=>{kind=b.dataset.k;draw()});
    document.querySelectorAll("[data-m]").forEach(b=>b.onclick=()=>{min=+b.dataset.m;draw()});
    $("#ws").onclick=()=>{S.walks.push({d:dk(),t:Date.now(),kind,min});save();closeLayer();renderAll();evaluate()};$("#wx").onclick=closeLayer};
  draw();
}

/* ================= player ================= */
let P=null,wl=null;
function startRoutine(rid){
  closeLayer();
  const items=buildPlan(rid);if(!items.length){toast("There's nothing in this routine in seated-only mode.");return}
  P={rid,items,i:0,phase:"intro",rep:0,left:0,paused:false,started:Date.now(),doneItems:0,timer:null};
  awake(true);show(true);renderPlayer(true);
}
function awake(on){native.awake(on);if(!native.ok&&navigator.wakeLock){if(on)navigator.wakeLock.request("screen").then(l=>wl=l).catch(()=>{});else if(wl){wl.release().catch(()=>{});wl=null}}}
function cueFor(it,rep){return it.alt?it.alt[rep%2]:""}
function renderPlayer(speak){
  const it=P.items[P.i],e=EX[it.id],n=P.items.length,r=R(P.rid);
  let body="";
  if(P.phase==="intro"){
    body=`<div class="pose">${pose(e.pos)}</div><p class="sub" style="margin:0">${esc(posLabel(e.pos))}</p>
    <h1 style="text-align:center;margin-top:8px">${esc(e.name)}</h1>
    ${it.side?`<p class="cue">${esc(it.side[0].toUpperCase()+it.side.slice(1))}</p>`:""}
    ${it.sets>1?`<p class="sub">Set ${it.set} of ${it.sets}</p>`:""}
    <ol class="steps-list">${e.steps.map(s=>`<li>${esc(s)}</li>`).join("")}</ol>
    <p class="note"><b>Do it ${esc(planText(it))}.</b> ${esc(e.why)}</p>
    <button class="btn" id="go">▶ Start</button>
    <div class="row" style="margin-top:10px"><button class="btn ghost small" id="back" ${P.i?"":"disabled"}>‹ Back</button><button class="btn ghost small" id="skip">Skip this one ›</button></div>`;
  }else if(P.phase==="run"){
    const ph=P.sub;
    body=`<h2 style="text-align:center">${esc(e.name)}</h2>${it.side?`<p class="sub">${esc(it.side)}</p>`:""}
    <div class="counter"><div class="sub">${esc(it.reps>1?"Number "+(P.rep+1)+" of "+it.reps:"")}</div>
    <div class="big" id="big">${ph==="hold"?P.left:P.rep+1}</div><div class="cue" id="cue">${esc(P.cue||"")}</div></div>
    <div class="bar"><i style="width:${Math.round(P.rep/it.reps*100)}%"></i></div>
    <div class="row" style="margin-top:14px"><button class="btn soft" id="pause">${P.paused?"▶ Carry on":"⏸ Pause"}</button><button class="btn ghost" id="fin">Done ›</button></div>`;
  }else if(P.phase==="rest"){
    const nx=P.items[P.i+1],ne=EX[nx.id];
    body=`<h1 style="text-align:center">Well done! 👏</h1><div class="counter"><div class="sub">Have a little rest. Next up:</div><h2 style="text-align:center;margin:6px 0">${esc(ne.name)}</h2>${nx.side?`<p class="sub">${esc(nx.side)}</p>`:""}<div class="big">${P.left}</div></div>
    <button class="btn" id="nextnow">I'm ready ›</button>`;
  }
  $("#full").innerHTML=`<div class="player"><div class="ptop"><div class="prog"><div class="small muted">${esc(r.name)} · ${P.i+1} of ${n}</div><div class="bar"><i style="width:${Math.round(P.i/n*100)}%"></i></div></div>
    <button class="btn stop small" id="unw" style="width:auto">🤒 I feel unwell</button></div>${body}
    <button class="link" id="endq" style="display:block;margin:16px auto 0">End this session</button></div>`;
  $("#unw").onclick=unwellStop;$("#endq").onclick=endEarly;
  if(P.phase==="intro"){
    $("#go").onclick=()=>{blip();runItem()};$("#skip").onclick=()=>advance(false);const b=$("#back");b.onclick=()=>{if(P.i){P.i--;P.phase="intro";renderPlayer(true)}};
    if(speak)say(e.name+(it.side?", "+it.side:"")+". "+e.steps.join(" ")+" Do it "+planText(it)+". Tap Start when you're ready.");
  }else if(P.phase==="run"){
    $("#pause").onclick=()=>{P.paused=!P.paused;if(P.paused)hush();renderPlayer()};$("#fin").onclick=()=>finishItem();
  }else if(P.phase==="rest"){$("#nextnow").onclick=()=>{clearTimeout(P.timer);P.i++;P.phase="intro";renderPlayer(true)}}
}
function runItem(){P.phase="run";P.rep=0;P.paused=false;startRep()}
function startRep(){
  const it=P.items[P.i];clearTimeout(P.timer);
  const c=cueFor(it,P.rep);
  if(it.hold){P.sub="move";P.cue=c?(c[0].toUpperCase()+c.slice(1)):"Get into position";renderPlayer();say(P.cue);
    tick(3,()=>{P.sub="hold";P.left=it.hold;P.cue="Hold";renderPlayer();say("Hold");
      countdown(()=>{P.sub="relax";P.cue="And relax";renderPlayer();say("And relax");blip();tick(3,nextRep)})});}
  else{P.sub="count";P.cue=c?c[0].toUpperCase()+c.slice(1):"";renderPlayer();say(String(P.rep+1)+(c?". "+c:""));tick(it.pace,nextRep)}
}
function tick(secs,then){let s=secs;const step=()=>{if(!P)return;if(P.paused){P.timer=setTimeout(step,300);return}if(s<=0){then();return}s--;P.timer=setTimeout(step,1000)};P.timer=setTimeout(step,1000);s--}
function countdown(then){const step=()=>{if(!P)return;if(P.paused){P.timer=setTimeout(step,300);return}
  P.left--;const b=$("#big");if(b)b.textContent=Math.max(0,P.left);if(P.left<=3&&P.left>0)say(String(P.left));if(P.left<=0){then();return}P.timer=setTimeout(step,1000)};P.timer=setTimeout(step,1000)}
function nextRep(){const it=P.items[P.i];P.rep++;if(P.rep>=it.reps){finishItem();return}startRep()}
function finishItem(){clearTimeout(P.timer);P.doneItems++;chime();advance(true)}
function advance(rest){
  clearTimeout(P.timer);
  if(P.i>=P.items.length-1){sessionDone(false);return}
  if(rest){P.phase="rest";P.left=15;renderPlayer();const nx=EX[P.items[P.i+1].id];say("Well done. Have a little rest. Next up, "+nx.name+".");
    const step=()=>{if(!P)return;P.left--;if(P.left<=0){P.i++;P.phase="intro";renderPlayer(true);return}const b=document.querySelector(".big");if(b)b.textContent=P.left;P.timer=setTimeout(step,1000)};P.timer=setTimeout(step,1000)}
  else{P.i++;P.phase="intro";renderPlayer(true)}
}
function unwellStop(){
  const was=P.paused;P.paused=true;hush();
  openLayer(`<div class="dialog plain"><h2>Take a rest</h2><p>Sit down and rest for a few minutes.</p>${SAFETY.split('<div class="warn">')[1]?'<div class="warn">'+SAFETY.split('<div class="warn">')[1]:""}
  <div class="stack" style="margin-top:12px"><button class="btn" id="u1">End the session and rest</button><button class="btn ghost" id="u2">I'm fine now, carry on</button></div></div>`);
  say("Stop and sit down. Rest for a few minutes.");
  $("#u1").onclick=()=>{closeLayer();sessionDone(true)};$("#u2").onclick=()=>{closeLayer();P.paused=was;renderPlayer()};
}
function endEarly(){P.paused=true;hush();confirmBox("End this session?",P.doneItems>=Math.ceil(P.items.length/2)?"You've done more than half, so it still counts. Well done!":"No problem, every bit helps. You can try again later.","Yes, end it","No, carry on",()=>sessionDone(true),()=>{P.paused=false;renderPlayer()})}
function sessionDone(early){
  clearTimeout(P.timer);hush();awake(false);
  const half=P.doneItems>=Math.ceil(P.items.length/2),counts=!early||half,rid=P.rid,dur=Math.round((Date.now()-P.started)/60000);
  const startedAt=P.started;P=null;
  if(!counts){show(false);renderAll();return}
  const t=dk();
  const rec={d:t,t:startedAt,r:rid,dur,lvl:level(rid),partial:early||undefined};
  if(S.comebackPending){rec.comeback=true;S.comebackPending=false}
  S.sessions.push(rec);save();
  $("#full").innerHTML=`<div class="card hero" style="text-align:center;margin-top:20px"><div style="font-size:4em">🎉</div><h1>${early?"Good effort!":"Session complete!"}</h1><p>${esc(R(rid).name)} done${dur?" in "+dur+" minute"+(dur>1?"s":""):""}. That's another half-mile on your journey.</p>
  ${rid!=="gentle"&&!early?`<h2>How did that feel?</h2><div class="stack"><button class="btn soft" data-f="easy">😊 Too easy</button><button class="btn soft" data-f="ok">👍 About right</button><button class="btn soft" data-f="hard">😓 Too hard</button></div>`:`<button class="btn" data-f="ok">Carry on</button>`}</div>`;
  say(early?"Good effort. That still counts.":"Session complete. Well done! How did that feel?");confetti();fanfare();
  document.querySelectorAll("[data-f]").forEach(b=>b.onclick=()=>afterFeel(rid,b.dataset.f,rec));
}
function afterFeel(rid,f,rec){
  rec.feel=f;const fl=S.feel[rid]=(S.feel[rid]||[]);fl.push(f);if(fl.length>5)fl.shift();save();
  show(false);TAB="today";renderAll();evaluate();
  const L=level(rid),last2=fl.slice(-2);
  const later=()=>{if(!showing)return levelOrTime();setTimeout(later,600)};
  function levelOrTime(){
    if(f==="easy"&&L<3&&last2.length===2&&last2.every(x=>x==="easy")){
      confirmBox("Ready to move up?","You've found "+R(rid).name+" easy twice in a row. Level "+(L+1)+" adds a few more repetitions.","Yes, level "+(L+1)+" please","Not yet",()=>{S.levels[rid]=L+1;S.feel[rid]=[];save();evaluate();renderAll()},timeAsk);
    }else if(f==="hard"&&L>1){
      confirmBox("Make it a bit easier?","Shall I take "+R(rid).name+" back to level "+(L-1)+"? There's no rush; build up slowly.","Yes, make it easier","Keep it as it is",()=>{S.levels[rid]=L-1;S.feel[rid]=[];save();renderAll()},timeAsk);
    }else if(f==="hard"&&L===1&&!S.seated&&rid!=="chair"){
      confirmBox("That's OK","Everyone starts somewhere. The Chair exercises are gentler and all done sitting. Do you want to try those next time?","Yes, show me","No thanks",()=>{TAB="exercise";renderAll()},timeAsk);
    }else timeAsk();
  }
  setTimeout(later,400);
}
/* suggest a new exercise time: 5 of the last 7 sessions started 60+ min away from the set time, within an hour of each other */
function timeAsk(){
  if(!S.nudges)return;const now=Date.now();if(S.timeAsk.snooze&&now<S.timeAsk.snooze)return;
  const byDay={};S.sessions.filter(x=>x.r!=="gentle").forEach(x=>{if(!byDay[x.d])byDay[x.d]=x});
  const last=Object.values(byDay).sort((a,b)=>a.t-b.t).slice(-7);if(last.length<5)return;
  const m=last.map(x=>{const d=new Date(x.t);return d.getHours()*60+d.getMinutes()}),set=mins(S.mainTime);
  const off=m.filter(v=>Math.abs(v-set)>=60).sort((a,b)=>a-b);if(off.length<5)return;
  let best=null;for(let i=0;i+4<off.length;i++){if(off[i+4]-off[i]<=60){best=off.slice(i,i+5);break}}if(!best)return;
  const sug=hhmm(Math.round(best[2]/15)*15);
  confirmBox("A better time for you?","You usually exercise around "+nice(sug)+". Shall I remind you then instead of "+nice(S.mainTime)+"?","Yes, change it","No, keep it as it is",
    ()=>{S.mainTime=sug;if(mins(S.cutoff)<mins(sug)+60)S.cutoff=hhmm(Math.min(mins(sug)+120,1260));S.timeAsk.snooze=null;save();toast("Done. Reminders will now be at "+nice(sug)+".")},
    ()=>{S.timeAsk.snooze=now+28*864e5;save()});
}

/* ================= check-up ================= */
function due(){if(!S.sessions.length)return false;const l=S.checks[S.checks.length-1];if(!l)return S.sessions.length>=3;return (Date.now()-fromKey(l.d))/864e5>=28}
function checkup(){
  const res={d:dk()},tests=S.seated?["curl"]:["stand","curl","bal"];let ti=0;
  const best=k=>S.checks.reduce((a,c)=>c[k]!=null&&c[k]>a?c[k]:a,-1);
  show(true);
  const intro=()=>{$("#full").innerHTML=`<div class="card hero"><h1>📋 Fitness check-up</h1><p>${tests.length===1?"One short test":"Three short tests"}. It takes about 5 minutes and shows how much stronger and steadier you're getting.</p>
    <div class="note">${S.seated?"Sit on a firm chair. Have a light weight ready, such as a filled water bottle.":"Have someone nearby if you can. Use a firm chair against a wall, and stand near a worktop for the balance test."}</div>
    <button class="btn" id="cgo">Start</button><button class="link" id="cx" style="display:block;margin:12px auto 0">Not now</button></div>`;
    $("#cgo").onclick=next;$("#cx").onclick=()=>{show(false);renderAll()}};
  const next=()=>{if(ti>=tests.length)return finish();const k=tests[ti++];({stand:standTest,curl:curlTest,bal:balTest})[k]()};
  function tapTest(title,how,key,unit,after){
    $("#full").innerHTML=`<div class="card"><h1>${esc(title)}</h1><ol class="steps-list">${how.map(s=>`<li>${esc(s)}</li>`).join("")}</ol><p class="note">Tap the big button each time${esc(unit)}. You have 30 seconds.${best(key)>=0?" Your best so far: "+best(key)+".":""}</p><button class="btn" id="tgo">I'm ready. Start the clock</button></div>`;
    say(title+". "+how.join(" "));
    $("#tgo").onclick=()=>{let n=0,left=33;
      const draw=()=>{$("#full").innerHTML=`<div class="card" style="text-align:center"><h2>${esc(title)}</h2><div class="big" id="tl">${left>30?"Get ready…":left}</div><p class="sub">seconds left</p><button class="btn tapper" id="tap" ${left>30?"disabled":""}>Tap: <span id="tn">${n}</span></button></div>`;
        $("#tap").onclick=()=>{if(left>0&&left<=30){n++;$("#tn").textContent=n;blip()}}};
      draw();say("Get ready. 3, 2, 1, go!");
      const iv=setInterval(()=>{left--;if(left===30){draw();say("Go!")}const tl=$("#tl");if(tl)tl.textContent=left>30?"Get ready…":left;
        if(left===10)say("10 seconds");if(left<=0){clearInterval(iv);res[key]=n;say("Stop. You did "+n+".");after(n)}},1000)}}
  function standTest(){tapTest("Chair stand",["Sit in the middle of the chair with your arms crossed over your chest.","Stand up fully, then sit back down.","Do as many as you safely can in 30 seconds."],"stand"," you stand up",n=>resultScreen("Chair stand",n,best("stand"),"stands"))}
  function curlTest(){tapTest("Arm curls",["Sit on the chair holding a light weight (a filled water bottle) in your stronger hand.","Curl it up to your shoulder, then lower it all the way.","Do as many as you comfortably can in 30 seconds."],"curl"," you finish a curl",n=>resultScreen("Arm curls",n,best("curl"),"curls"))}
  function resultScreen(name,n,b,u){const pb=b>=0&&n>b;if(pb)res.pb=true;
    $("#full").innerHTML=`<div class="card ${pb?"gold":""}" style="text-align:center"><div style="font-size:3em">${pb?"🏅":"👏"}</div><h1>${n} ${u}</h1><p>${pb?"A new personal best! Up from "+b+".":b>=0?"Your best is "+b+". Keep practising and watch it grow.":"That's your starting score. Next month you can try to beat it."}</p><button class="btn" id="cn">Next</button></div>`;
    if(pb){fanfare();confetti();say("A new personal best!")}else chime();$("#cn").onclick=next}
  function balTest(){
    const stages=[["Feet side by side","Stand with your feet together, touching."],["Half step","Put the instep of one foot against the big toe of the other."],["Heel to toe","Put one foot directly in front of the other, heel touching toe."],["One leg","Stand on one leg."]];
    let si=0;
    const stage=()=>{if(si>=stages.length){res.bal=4;return balDone()}const[t,d]=stages[si];
      $("#full").innerHTML=`<div class="card"><p class="muted">Balance test · ${si+1} of 4</p><h1>${esc(t)}</h1><p>${esc(d)} Try to hold it for 10 seconds without holding on. Keep a hand near the worktop, just in case.</p><button class="btn" id="bgo">Start 10 seconds</button><button class="btn ghost" id="bno" style="margin-top:10px">I'd rather not try this one</button></div>`;
      say(t+". "+d+" Try to hold it for 10 seconds.");
      $("#bno").onclick=()=>{res.bal=si;balDone()};
      $("#bgo").onclick=()=>{let l=10;$("#full").innerHTML=`<div class="card" style="text-align:center"><h2>${esc(t)}</h2><div class="big" id="bl">10</div></div>`;
        const iv=setInterval(()=>{l--;$("#bl").textContent=l;if(l<=3&&l>0)say(String(l));if(l<=0){clearInterval(iv);
          $("#full").innerHTML=`<div class="card" style="text-align:center"><h2>Did you hold it for the full 10 seconds?</h2><div class="stack"><button class="btn" id="by">Yes</button><button class="btn soft" id="bn">No, I had to hold on</button></div></div>`;say("Did you hold it?");
          $("#by").onclick=()=>{si++;chime();stage()};$("#bn").onclick=()=>{res.bal=si;balDone()}}},1000)}};
    const balDone=()=>{const b=best("bal");const pb=b>=0&&res.bal>b;if(pb)res.pb=true;
      $("#full").innerHTML=`<div class="card ${pb?"gold":""}" style="text-align:center"><div style="font-size:3em">${res.bal>=4?"🦩":pb?"🏅":"👏"}</div><h1>Balance: ${res.bal} of 4</h1><p>${res.bal>=4?"You held all four, including standing on one leg. Superb!":pb?"Better than last time!":"The Balance routine will help this improve."}</p><button class="btn" id="cn">Next</button></div>`;
      if(pb||res.bal>=4){fanfare();confetti()}else chime();$("#cn").onclick=next};
    stage();
  }
  function finish(){S.checks.push(res);save();show(false);TAB="progress";renderAll();
    const items=[{emoji:"📋",title:"Check-up done!",text:"Well done. Your results are on the Progress page. The next one is in about 4 weeks.",confetti:true}];
    if(res.pb)items.push({emoji:"🏅",title:"Personal best!",text:"You're getting stronger. That's real, measurable progress.",big:true,family:familyFor("pb")});
    celebrate(items);evaluate()}
  intro();
}

/* ================= setup ================= */
const SU={};
function setupView(step){
  show(true);const sv=$("#full"),total=6;
  const head=`<p class="muted small">Getting started · ${step+1} of ${total}</p>`;
  const timeOpts=(sel,from,to,stepm)=>{let o="";for(let m=from;m<=to;m+=stepm){const v=hhmm(m);o+=`<option value="${v}" ${v===sel?"selected":""}>${nice(v)}</option>`}return o};
  const nav=(ok)=>`<div class="stack" style="margin-top:16px"><button class="btn" id="nx">${ok||"Next"}</button>${step?`<button class="btn ghost" id="bk">Back</button>`:""}</div>`;
  if(step===0){sv.innerHTML=`<div class="card hero">${head}<div style="font-size:3em">🌿</div><h1>Welcome to Strong &amp; Steady</h1><p>Short, guided exercises to keep you strong and steady on your feet, with stars, streaks and treats along the way.</p><h2>Before you start</h2>${SAFETY}${nav("I understand. Let's start")}</div>`}
  if(step===1){sv.innerHTML=`<div class="card">${head}<h1>What should we call you?</h1><input type="text" id="su-name" value="${esc(S.name)}" maxlength="30" placeholder="Your first name" autocomplete="given-name">${nav()}</div>`}
  if(step===2){sv.innerHTML=`<div class="card">${head}<h1>How do you like to exercise?</h1><div class="opts"><button class="opt" data-v="0" aria-pressed="${!S.seated}"><span><b>Standing, with a chair or wall to hold</b><br><span class="small muted">Includes balance exercises. You can sit down any time.</span></span></button><button class="opt" data-v="1" aria-pressed="${S.seated}"><span><b>Sitting down only</b><br><span class="small muted">Everything done from a chair. You can change this later.</span></span></button></div>${nav()}</div>`;
    sv.querySelectorAll("[data-v]").forEach(b=>b.onclick=()=>{S.seated=b.dataset.v==="1";setupView(2)})}
  if(step===3){const presets=[["09:30","Morning, after breakfast"],["11:00","Late morning"],["14:30","Afternoon"],["16:30","Late afternoon"]];
    sv.innerHTML=`<div class="card">${head}<h1>Your day</h1><label class="f" for="su-wake">I usually get up around</label><select id="su-wake">${timeOpts(S.wake,300,720,30)}</select>
    <h3 style="margin-top:16px">When suits you best for exercise?</h3><div class="opts">${presets.map(([v,l])=>`<button class="opt" data-t="${v}" aria-pressed="${S.mainTime===v}">${l} (${nice(v)})</button>`).join("")}</div>
    <label class="f" for="su-main">Or pick a time</label><select id="su-main">${timeOpts(S.mainTime,360,1260,15)}</select>
    <div class="toggle"><span><b>Send me a gentle reminder</b><br><span class="small muted">Only if I haven't exercised yet.</span></span><input type="checkbox" id="su-nudge" ${S.nudges?"checked":""}></div>
    <label class="f" for="su-cut">No reminders after</label><select id="su-cut">${timeOpts(S.cutoff,600,1260,30)}</select>${nav()}</div>`;
    sv.querySelectorAll("[data-t]").forEach(b=>b.onclick=()=>{S.wake=$("#su-wake").value;S.mainTime=b.dataset.t;if(mins(S.cutoff)<mins(S.mainTime)+90)S.cutoff=hhmm(Math.min(1260,mins(S.mainTime)+150));setupView(3)});
    $("#su-main").onchange=e=>{S.mainTime=e.target.value;if(mins(S.cutoff)<mins(S.mainTime)+90)S.cutoff=hhmm(Math.min(1260,mins(S.mainTime)+150));setupView(3)}}
  if(step===4){sv.innerHTML=`<div class="card">${head}<h1>Your treats</h1><p>When you earn all three stars in a day, what have you earned?</p>
    <div class="opts">${TREATS_DAILY.map(t=>`<button class="opt" data-tr="${esc(t)}" aria-pressed="${S.treat===t}">${esc(t[0].toUpperCase()+t.slice(1))}</button>`).join("")}</div>
    <label class="f" for="su-treat">Or write your own</label><input type="text" id="su-treat" value="${esc(S.treat)}" maxlength="60">
    <h3 style="margin-top:16px">And a big treat for a 7-day streak?</h3><select id="su-big">${TREATS_BIG.map(t=>`<option ${t===S.bigTreat?"selected":""}>${esc(t)}</option>`).join("")}<option value="__own">Something else…</option></select>
    <input type="text" id="su-bigown" hidden maxlength="60" placeholder="Your big treat" style="margin-top:8px">${nav()}</div>`;
    sv.querySelectorAll("[data-tr]").forEach(b=>b.onclick=()=>{S.treat=b.dataset.tr;setupView(4)});
    $("#su-big").onchange=e=>{$("#su-bigown").hidden=e.target.value!=="__own"}}
  if(step===5){
    sv.innerHTML=`<div class="card">${head}<h1>Counting your steps</h1>${native.ok?`<p>The phone can count your steps for your Move star and your journey along Hadrian's Wall. It needs your permission to do this, and to send reminders.</p>
      <div class="stack"><button class="btn" id="perm">Allow step counting and reminders</button><p id="permst" class="small muted"></p></div>
      <label class="f" for="su-goal">A daily step goal to start with</label>`:`<p>On this device, tap <b>"I've been for a walk"</b> to log your walks and other activity. 15 minutes earns your Move star.</p><label class="f" for="su-goal">If you use a step counter, a daily goal</label>`}
      <select id="su-goal">${[1500,2000,2500,3000,4000,5000,6000,8000].map(n=>`<option ${n===S.stepGoal?"selected":""} value="${n}">${fmt(n)} steps</option>`).join("")}</select>
      <p class="small muted">Not sure? 3,000 is a good start. You can change it any time.</p>${nav("Finish setting up")}</div>`;
    const pm=$("#perm");if(pm)pm.onclick=async()=>{const a=await native.requestSteps(),b=await native.requestNotify();$("#permst").textContent=(a?"✓ Step counting is on. ":"Step counting wasn't allowed. You can log walks instead. ")+(b?"✓ Reminders are on.":"Reminders weren't allowed.");if(a)S.stepsSource="phone"}}
  const nx=$("#nx"),bk=$("#bk");if(bk)bk.onclick=()=>setupView(step-1);
  nx.onclick=()=>{
    if(step===1)S.name=$("#su-name").value.trim();
    if(step===3){S.wake=$("#su-wake").value;S.mainTime=$("#su-main").value;S.nudges=$("#su-nudge").checked;S.cutoff=$("#su-cut").value}
    if(step===4){const own=$("#su-treat").value.trim();if(own)S.treat=own;const bg=$("#su-big").value;S.bigTreat=bg==="__own"?($("#su-bigown").value.trim()||"a big treat"):bg}
    if(step===5){S.stepGoal=+$("#su-goal").value;S.setup=true;S.created=S.created||dk();S.journey.start=S.journey.start||dk();save();
      show(false);TAB="today";renderAll();say("All set"+(S.name?", "+S.name:"")+". Let's get started!");
      if(native.ok)setTimeout(batteryHelp,600);return}
    save();setupView(step+1)};
}



/* ================= iPhone: daily alert in Apple Calendar ================= */
const isIOS=()=>/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
function calSlot(t){const m=Math.round(mins(t)/15)*15,c=Math.min(22*60,Math.max(5*60,m));return hhmm(c)}
function calLink(){return "cal/exercise-"+calSlot(S.mainTime).replace(":","")+".ics"}
function calUrls(){const path=location.pathname.replace(/[^/]*$/,"")+calLink();return {webcal:"webcal://"+location.host+path,https:"https://"+location.host+path}}
function calSetup(){
  S.cal=S.cal||{};const t=calSlot(S.mainTime),changing=S.cal.on&&S.cal.time&&S.cal.time!==t,u=calUrls();
  openLayer(`<div class="dialog plain"><h2>🔔 A daily reminder</h2>
    ${changing?`<div class="note"><b>First, remove the old one (${nice(S.cal.time)}):</b> open the <b>Calendar</b> app, tap <b>Calendars</b> at the bottom, tap the <b>ⓘ</b> next to <b>Strong &amp; Steady</b>, then <b>Unsubscribe</b> (or <b>Delete Calendar</b>). Then come back here.</div>`:""}
    <p>Your iPhone's own Calendar will remind you every day at <b>${nice(t)}</b>.</p>
    <ol class="steps-list"><li>Tap <b>Add to my Calendar</b> below.</li><li>When the iPhone asks, tap <b>Subscribe</b>.</li>
    <li><b>Important:</b> on the next screen, turn <b>off</b> <b>Remove Alerts</b>, so the reminder can pop up.</li><li>Tap <b>Add</b> (or <b>Done</b>), then come back to Steady.</li></ol>
    <div class="stack"><a class="btn" id="cal-add" href="${u.webcal}">📅 Add to my Calendar</a>
    <button class="btn soft" id="cal-done">I've added it</button>
    <details style="margin-top:4px"><summary class="link" style="display:inline">That didn't work?</summary>
      <p class="small">Try it in Safari instead: tap <b>Copy the link</b>, open <b>Safari</b>, tap the address bar, paste it in and go. Then tap <b>Add All</b>.</p>
      <button class="btn ghost small" id="cal-copy">Copy the link</button><p class="small muted" style="word-break:break-all">${u.https}</p></details>
    <button class="btn ghost" id="cal-x">Not now</button></div>
    <p class="small muted">It reminds you every day at that time, even if you've already exercised. If you change your exercise time, Steady will help you update it.</p></div>`);
  $("#cal-copy").onclick=()=>{navigator.clipboard&&navigator.clipboard.writeText(u.https).then(()=>toast("Link copied. Now open Safari and paste it."),()=>toast("Press and hold the link below to copy it."))};
  $("#cal-done").onclick=()=>{S.cal={on:true,time:t};S.push=S.push||{};S.push.snooze=0;save();closeLayer();renderAll();
    celebrate([{emoji:"📅",title:"Daily reminder added!",text:"Your iPhone will remind you at "+nice(t)+" every day. Tap the reminder to open Steady.",ok:"Lovely"}])};
  $("#cal-x").onclick=()=>{closeLayer()};
}

/* ================= reminders for the iPhone / web version (sent by GitHub through ntfy) ================= */
const NTFY="https://ntfy.sh",REG_TOPIC="strong-steady-reg-q7v2k9wx4m";
const REM_PUB="MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA8zi9KR0nErQqrlBCx/TNSc/eyOduKbFIKKzE13hm7PpK1wPhs8hS3ePcloTasHIYt2BKJbhH7Yz6D6Qs8i3ZXqoTejGdnRmoTZbx3Qx5v1egIsTDakoBJSwltIpSFvMdfhPZeHNLipFGaNj05eStTWkZwqB+1TNNNf5Pw/KLW3f86audBAwWOLOg8vaic1QMghZf3TRBn3VH73IigW7IWZE0qH8tYyWDBEHfQWC5BOekZs5/55ErxolW1tlnp+Zvq5Ay7sPcDBrOsBvvOt6T5VjU6j7f+EZP+KyMMxkaBlfUKkSAxY81swGK5rU3/zHHT7A9JfgHeFTF+HpYrqx94QIDAQAB";
const NTFY_IOS="https://apps.apple.com/gb/app/ntfy/id1625396347",NTFY_ANDROID="https://play.google.com/store/apps/details?id=io.heckel.ntfy";
const webReminders=()=>!native.ok&&/^https?:$/.test(location.protocol);
function pushTopic(){S.push=S.push||{};if(!S.push.topic){const a=new Uint8Array(20);crypto.getRandomValues(a);S.push.topic="ss-"+[...a].map(b=>"abcdefghijkmnpqrstuvwxyz23456789"[b%32]).join("");try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}}return S.push.topic}
let pushTimer=null;
function schedulePush(){if(!webReminders()||!S.push||!S.push.on)return;clearTimeout(pushTimer);pushTimer=setTimeout(()=>pushState(false),1500)}
function pushCfg(){const t=dk(),last=S.sessions.reduce((m,x)=>x.r!=="gentle"&&x.d>m?x.d:m,""),ns=nextStop();
  return {u:pushTopic(),t:S.mainTime,c:S.cutoff,n:S.nudges?1:0,i:S.illUntil==="open"?"open":(isIll(t)?t:""),d:last,
    z:(Intl.DateTimeFormat().resolvedOptions().timeZone||"Europe/London").slice(0,32),s:streak(),x:ns?ns.stop.name.split(",")[0].slice(0,22):""}}
async function encryptForReminders(obj){
  const der=Uint8Array.from(atob(REM_PUB),c=>c.charCodeAt(0));
  const key=await crypto.subtle.importKey("spki",der,{name:"RSA-OAEP",hash:"SHA-256"},false,["encrypt"]);
  const ct=await crypto.subtle.encrypt({name:"RSA-OAEP"},key,new TextEncoder().encode(JSON.stringify(obj)));
  let bin="";new Uint8Array(ct).forEach(b=>bin+=String.fromCharCode(b));return btoa(bin)}
async function pushState(force){
  if(!webReminders()||!S.setup||!S.push||!S.push.on||!crypto.subtle)return false;
  const cfg=pushCfg(),sig=JSON.stringify(cfg);
  if(!force&&sig===S.push.last&&Date.now()-(S.push.lastAt||0)<6*3600e3)return true;
  try{const body=await encryptForReminders(Object.assign(cfg,{v:Math.floor(Date.now()/1000)}));
    const r=await fetch(NTFY+"/"+REG_TOPIC,{method:"POST",body});if(!r.ok)return false;
    S.push.last=sig;S.push.lastAt=Date.now();try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}return true}catch(e){return false}}
async function testReminder(){
  const u=pushTopic(),q="?priority=4&title="+encodeURIComponent("Strong & Steady test")+"&tags=muscle&click="+encodeURIComponent(location.href.split("#")[0]);
  try{const r=await fetch(NTFY+"/"+u+q,{method:"POST",body:"Reminders are working. You'll get a gentle nudge at your exercise time if you haven't exercised yet."});return r.ok}catch(e){return false}}
function reminderSetup(){
  const u=pushTopic(),ios=/iPhone|iPad|iPod/.test(navigator.userAgent);
  openLayer(`<div class="dialog plain"><h2>🔔 Reminders on this phone</h2><p>A free app called <b>ntfy</b> shows the reminders. It takes about two minutes to set up, just once.</p>
    <ol class="steps-list"><li><b>Install ntfy</b> (it's free).<br><a class="btn soft small" style="margin-top:6px" href="${ios?NTFY_IOS:NTFY_ANDROID}" target="_blank" rel="noopener">Get ntfy</a></li>
    <li>Open ntfy and allow notifications when it asks.</li>
    <li>Tap <b>+</b> and type in your reminder code exactly as shown. Leave everything else as it is, then tap <b>Subscribe</b>.<div class="treat" style="font-family:monospace;font-size:1em;white-space:nowrap;overflow-x:auto;user-select:all;-webkit-user-select:all;text-align:center">${u}</div><button class="btn ghost small" id="rs-copy">Copy the code</button></li>
    <li>Come back here and send yourself a test.</li></ol>
    <div class="stack"><button class="btn" id="rs-test">Send a test reminder</button><p class="small muted" id="rs-st"></p><button class="btn ghost" id="rs-x">Close</button></div>
    <p class="small muted">Only the times you chose and whether you've exercised are shared with the reminder service, never your name or progress.</p></div>`);
  $("#rs-copy").onclick=()=>{navigator.clipboard&&navigator.clipboard.writeText(u).then(()=>toast("Code copied"),()=>{})};
  $("#rs-x").onclick=()=>{closeLayer();renderAll()};
  $("#rs-test").onclick=async()=>{$("#rs-st").textContent="Sending…";const ok=await testReminder();
    if(!ok){$("#rs-st").textContent="It couldn't be sent. Is the phone online?";return}
    $("#rs-st").innerHTML="Sent! <b>Did a notification from ntfy pop up?</b> (Close the ntfy app first, or it shows inside ntfy instead.)";
    document.querySelectorAll(".rs-ans").forEach(b=>b.remove());
    const yes=document.createElement("button");yes.className="btn gold rs-ans";yes.textContent="Yes, it arrived";
    const no=document.createElement("button");no.className="btn soft rs-ans";no.textContent="No, or it only showed inside ntfy";
    $("#rs-st").after(yes,no);
    yes.onclick=async()=>{S.push.on=true;S.nudges=true;save();await pushState(true);closeLayer();renderAll();
      celebrate([{emoji:"🔔",title:"Reminders are set up!",text:"You'll get a gentle nudge around "+nice(S.mainTime)+" on days you haven't exercised yet. Change the time in Settings (⚙️) whenever you like.",ok:"Lovely"}])};
    no.onclick=()=>{document.querySelectorAll(".rs-ans").forEach(b=>b.remove());$("#rs-st").innerHTML="<b>Please check:</b><br>• The code in ntfy matches exactly.<br>• iPhone <b>Settings → Notifications → ntfy</b>: Allow Notifications on; Lock Screen, Notification Centre and Banners all ticked; Banner Style <b>Persistent</b>.<br>• ntfy isn't in <b>Scheduled Summary</b>, and Focus / Do Not Disturb is off.<br>• Swipe the ntfy app closed, then send the test again."}};
}

/* ================= app updates (phone app installed from GitHub) ================= */
let UPD=null;
async function updCheck(force){
  if(!native.ok||!S.setup)return null;
  const r=await native.updCheck(force);if(!r)return null;const was=UPD&&UPD.ready;UPD=r;
  if(r.ready&&!was&&!P&&!G&&!showing&&TAB==="today"&&$("#layer").innerHTML==="")renderAll();
  return r;
}
function updCard(){
  if(!UPD||!UPD.ready)return "";
  return `<div class="card gold"><h3 style="margin-top:0">✨ A new version of the app is ready</h3><p>It has improvements and fixes. Installing takes a few seconds and keeps all your stars and progress.</p><button class="btn" id="updgo">Install the update</button></div>`;
}
async function updInstall(){
  const st=await native.updStatus();
  if(!st||!st.ready){toast("The update isn't ready yet. Try again in a little while.");return}
  if(!st.canInstall){
    openLayer(`<div class="dialog plain"><h2>One quick setting (just once)</h2><p>So the app can update itself, the phone needs your permission. You only do this once.</p>
      <ol class="steps-list"><li>Tap <b>Open the setting</b> below.</li><li>Turn on <b>Allow from this source</b>.</li><li>Tap the phone's <b>back</b> button to come back here.</li></ol>
      <div class="stack"><button class="btn" id="u-open">Open the setting</button><button class="btn soft" id="u-done">I've done it. Install now</button><button class="btn ghost" id="u-x">Not now</button></div></div>`);
    $("#u-open").onclick=()=>native.updSettings();
    $("#u-done").onclick=()=>{closeLayer();updInstall()};
    $("#u-x").onclick=closeLayer;return}
  openLayer(`<div class="dialog plain"><h2>Installing the update…</h2><p>If the phone asks <b>"Do you want to update this app?"</b>, tap <b>Update</b>.</p><p class="small muted">The app will close for a moment. Open it again afterwards and you'll find everything just as you left it.</p><button class="btn ghost" id="u-x">Close</button></div>`);
  $("#u-x").onclick=closeLayer;
  try{S.cel.preUpdate=APP_VERSION;save()}catch(e){}
  const ok=await native.updInstall();if(!ok){closeLayer();toast("The update couldn't start. Please try again later.")}
}
function updatedNotice(){
  if(!S.setup)return;const last=S.lastVersion;
  if(last&&last!==APP_VERSION){S.lastVersion=APP_VERSION;save();
    celebrate([{emoji:"✨",title:"The app has been updated",text:"You're now on version "+APP_VERSION+". "+(WHATS_NEW[APP_VERSION]||"Everything you've done so far is safe."),ok:"Lovely"}])}
  else if(!last){S.lastVersion=APP_VERSION;save()}
}
const WHATS_NEW={"1.5":"On iPhone, you can now add a daily reminder to your Calendar with one tap.","1.4":"Behind the scenes: the app now also works on iPhones, with reminders through the free ntfy app.","1.3":"The app now keeps itself up to date. New versions arrive by themselves, usually within the hour."};

/* ================= steps refresh ================= */
async function refreshSteps(quiet){
  if(!native.ok||!S.setup)return;
  const r=await native.steps();if(!r||!r.days)return;
  let changed=false;Object.entries(r.days).forEach(([d,n])=>{n=+n||0;if(n>(S.steps[d]||0)){S.steps[d]=n;changed=true}});
  if(r.available)S.stepsSource="phone";S.stepsAt=Date.now();
  if(changed){save();if(!quiet&&!P&&!G&&!showing&&$("#layer").innerHTML===""){renderAll();evaluate()}}
}

/* ================= web: offline + automatic updates (same approach as Site Ready) ================= */
const hosted=/^https?:$/.test(location.protocol)&&!NATIVE;
let updateReady=false,lastCheck=0;
function checkForUpdate(){
  if(!window.SITE_BUILD||!window.caches||updateReady||Date.now()-lastCheck<60000)return;
  lastCheck=Date.now();const bust="t="+Date.now();
  fetch("version.json?"+bust,{cache:"no-store"}).then(r=>r.ok?r.json():null).then(v=>{
    if(!v||!v.build||v.build===window.SITE_BUILD)return;
    return caches.open("steady-app").then(c=>Promise.all(["index.html","app.js","data.js","games.js","words.js","style.css"].map(f=>fetch(f+"?"+bust,{cache:"no-store"}).then(r=>{if(!r.ok)throw 0;return c.put(f==="index.html"?"index.html":f,r.clone()).then(()=>f==="index.html"?c.put("./",r):null)})))).then(()=>{updateReady=true;applyUpdateIfSafe()});
  }).catch(()=>{});
}
function applyUpdateIfSafe(){if(!updateReady||P||G||showing||!$("#full").hidden)return;try{sessionStorage.setItem("steady.updated","1")}catch(e){}location.reload()}
if(hosted){
  if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(()=>{}));
  checkForUpdate();
  if(navigator.storage&&navigator.storage.persist)navigator.storage.persist().catch(()=>{});
  try{if(sessionStorage.getItem("steady.updated")){sessionStorage.removeItem("steady.updated");setTimeout(()=>toast("Updated to version "+APP_VERSION),300)}}catch(e){}
}

/* ================= start ================= */
let lastDay=dk();
function onWake(){
  if(dk()!==lastDay){lastDay=dk();if(!P)renderAll()}
  rollIll();refreshSteps();updCheck(false);pushState(false);if(hosted){checkForUpdate();applyUpdateIfSafe()}
}
document.addEventListener("visibilitychange",()=>{if(!document.hidden)onWake();
  else if(UPD&&UPD.ready&&UPD.canInstall&&!P){try{S.cel.preUpdate=APP_VERSION;save()}catch(e){}native.updQuiet()}});
setInterval(()=>{if(!document.hidden)refreshSteps()},5*60000);
applyLook();rollIll();renderAll();
if(S.setup){refreshSteps();setTimeout(()=>pushState(false),2000);setTimeout(evaluate,500);setTimeout(updatedNotice,900);setTimeout(()=>updCheck(false),3000);syncNative()}
window.__steady={state:()=>S,set:o=>{Object.assign(S,o);save();applyLook();renderAll()},evaluate,streak,journeyMiles,buildPlan};
