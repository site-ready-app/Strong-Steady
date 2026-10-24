/* Strong & Steady — reward games. Unlocked for the day by doing any exercise session (or on an unwell day),
   and new games open up as the player's rank rises. Play is unlimited once unlocked.
   All games: big tiles, tap rather than drag where possible, unlimited undo/hints, no timers, progress saved. */
"use strict";
window.GAMES=[
  {id:"flow",icon:"🔵",name:"Connect the dots",desc:"Join each pair of matching dots with a line. Fill every square, and don't let the lines cross.",rank:"Starter"},
  {id:"sol",icon:"🃏",name:"Solitaire",desc:"Classic patience. Tap a card and it moves to the best place.",rank:"Walker"},
  {id:"word",icon:"🔤",name:"Word of the day",desc:"Guess the five-letter word in six tries. A new word every day, and practice words any time.",rank:"Rambler"},
  {id:"sudoku",icon:"🔢",name:"Sudoku",desc:"Fill the grid so every row, column and box has the numbers 1 to 9.",rank:"Hiker"},
  {id:"jig",icon:"🧩",name:"Picture puzzle",desc:"Swap the pieces to rebuild the picture. Use one of ours or your own photo.",rank:"Trailblazer"}
];
let G=null; /* the game currently open */
function gstate(id){S.games=S.games||{};return S.games[id]=S.games[id]||{}}
function gamesToday(){const t=dk();return S.sessions.some(x=>x.d===t)||isIll(t)}
function rankPts(name){const r=RANKS.find(x=>x[1]===name);return r?r[0]:0}
function gameOpen(g){return points()>=rankPts(g.rank)}
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[a[i],a[j]]=[a[j],a[i]]}return a}
function gameShell(g,inner,tools){
  $("#full").innerHTML=`<div class="ghead"><button class="btn ghost small" id="gback" style="width:auto">‹ Games</button><h2 style="margin:0;flex:1;text-align:right">${g.icon} ${esc(g.name)}</h2></div>${inner}${tools?`<div class="gtools">${tools}</div>`:""}`;
  $("#gback").onclick=closeGame;
}
function closeGame(){G=null;show(false);TAB="games";renderAll()}
function gameWin(title,text,again){
  save();celebrate([{emoji:"🏆",title,text,big:true,ok:again||"Lovely!"}]);
}

/* ---------------- hub ---------------- */
function gamesView(){
  const ok=gamesToday(),p=points();
  let h=`<h1>Games</h1>`;
  if(ok)h+=`<div class="card gold"><b>🎮 Games are unlocked for today.</b> You've done your exercise, so play as much as you like!</div>`;
  else{const sug=suggestRoutine()||"mix";h+=`<div class="card hero"><b>🔒 Do any exercise session today to unlock the games.</b><p class="small muted" style="margin-bottom:10px">Once unlocked, you can play as much as you like until midnight.</p><button class="btn" data-go="${sug}">▶ Start ${esc(R(sug).name)}</button></div>`}
  h+=`<div class="rlist">`;
  GAMES.forEach(g=>{const open=gameOpen(g),need=rankPts(g.rank)-p;
    h+=`<button class="rbtn" data-game="${g.id}" ${open&&ok?"":"disabled"} style="${open?"":"opacity:.55"}"><span class="ic">${open?g.icon:"🔒"}</span><span><b>${esc(g.name)}</b><span>${open?esc(g.desc):"Unlocks at "+esc(g.rank)+" rank: "+fmt(need)+" more points ("+Math.ceil(need/10)+" stars)."}</span></span></button>`});
  h+=`</div><p class="small muted" style="margin-top:12px">Every star is worth 10 points. New games open up as your rank goes up.</p>`;
  $("#view").innerHTML=h;
  $("#view").querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>startRoutine(b.dataset.go));
  $("#view").querySelectorAll("[data-game]").forEach(b=>b.onclick=()=>openGame(b.dataset.game));
}
function openGame(id){const g=GAMES.find(x=>x.id===id);if(!g||!gameOpen(g)||!gamesToday())return;G=g;show(true);({flow:flowGame,sol:solGame,word:wordGame,sudoku:sudokuGame,jig:jigGame})[id](g)}

/* ================= Connect the dots ================= */
const FLOW_COL=["#d62828","#1d4ed8","#2b9348","#e9b200","#f77f00","#7b2cbf","#00a6a6","#e0559a","#8d5524"];
const FLOW_SIZES=[[5,0],[6,5],[7,15],[8,30]];
function flowMake(n){
  let path=[];for(let r=0;r<n;r++)for(let c=0;c<n;c++)path.push([r,r%2?n-1-c:c]);
  const key=(r,c)=>r*n+c;
  for(let it=0;it<n*n*40;it++){
    if(Math.random()<.5)path.reverse();
    const end=path[path.length-1],nb=[[1,0],[-1,0],[0,1],[0,-1]].map(([a,b])=>[end[0]+a,end[1]+b]).filter(([r,c])=>r>=0&&c>=0&&r<n&&c<n);
    const pick=nb[Math.random()*nb.length|0],prev=path[path.length-2];
    if(prev&&pick[0]===prev[0]&&pick[1]===prev[1])continue;
    const idx=path.findIndex(p=>p[0]===pick[0]&&p[1]===pick[1]);
    path=path.slice(0,idx+1).concat(path.slice(idx+1).reverse());
  }
  const k=n,lens=Array(k).fill(3);let rest=n*n-3*k;while(rest-->0)lens[Math.random()*k|0]++;
  const pairs=[];let i=0;lens.forEach(L=>{const seg=path.slice(i,i+L);i+=L;pairs.push([key(...seg[0]),key(...seg[seg.length-1])])});
  return {n,pairs,paths:pairs.map(()=>[])};
}
function flowGame(g){
  const st=gstate("flow");st.solved=st.solved||0;st.size=st.size||5;
  if(!st.cur||st.cur.n!==st.size)st.cur=flowMake(st.size);
  const P=st.cur,n=P.n,dotAt={};P.pairs.forEach((pr,ci)=>pr.forEach(k=>dotAt[k]=ci));
  let drawing=-1;
  const sizes=FLOW_SIZES.map(([s,need])=>`<button class="btn small ${s===st.size?"":"soft"}" data-sz="${s}" ${st.solved>=need?"":"disabled"} title="${st.solved>=need?"":"Solve "+need+" puzzles to unlock"}">${s}×${s}${st.solved>=need?"":" 🔒"}</button>`).join("");
  gameShell(g,`<p class="muted small" style="margin:6px 0">Touch a dot and slide your finger to its partner. Puzzles solved: <b>${st.solved}</b></p>
    <div id="fwrap" style="touch-action:none"></div><p class="cue" id="fmsg"></p>`,
    `<div class="row">${sizes}</div><div class="row" style="margin-top:10px"><button class="btn soft" id="fclr">Clear</button><button class="btn soft" id="fhint">Hint</button><button class="btn soft" id="fnew">New puzzle</button></div>`);
  const wrap=$("#fwrap");
  function cellOf(e){const sv=wrap.querySelector("svg"),r=sv.getBoundingClientRect(),c=Math.floor((e.clientX-r.left)/r.width*n),rr=Math.floor((e.clientY-r.top)/r.height*n);if(c<0||rr<0||c>=n||rr>=n)return -1;return rr*n+c}
  const owner=k=>P.paths.findIndex(p=>p.includes(k));
  const done=ci=>{const p=P.paths[ci],[a,b]=P.pairs[ci];return p.length>1&&((p[0]===a&&p[p.length-1]===b)||(p[0]===b&&p[p.length-1]===a))};
  function draw(){
    const W=100/n;let s=`<svg viewBox="0 0 100 100" style="width:100%;max-width:520px;display:block;margin:0 auto;background:var(--card);border:2px solid var(--line);border-radius:12px">`;
    for(let i=1;i<n;i++)s+=`<path d="M${i*W} 0V100M0 ${i*W}H100" stroke="var(--line)" stroke-width=".4"/>`;
    P.paths.forEach((p,ci)=>{if(p.length>0){p.forEach(k=>{s+=`<rect x="${k%n*W}" y="${Math.floor(k/n)*W}" width="${W}" height="${W}" fill="${FLOW_COL[ci]}" opacity=".16"/>`});
      if(p.length>1)s+=`<polyline points="${p.map(k=>(k%n*W+W/2)+","+(Math.floor(k/n)*W+W/2)).join(" ")}" fill="none" stroke="${FLOW_COL[ci]}" stroke-width="${W*.34}" stroke-linecap="round" stroke-linejoin="round"/>`}});
    P.pairs.forEach((pr,ci)=>pr.forEach(k=>{const x=k%n*W+W/2,y=Math.floor(k/n)*W+W/2;
      s+=`<circle cx="${x}" cy="${y}" r="${W*.36}" fill="${FLOW_COL[ci]}" stroke="${done(ci)?"#fff":"none"}" stroke-width="1"/><text x="${x}" y="${y+W*.13}" text-anchor="middle" font-size="${W*.36}" font-weight="700" fill="#fff" font-family="sans-serif">${"ABCDEFGHI"[ci]}</text>`}));
    s+=`</svg>`;wrap.innerHTML=s;
    const filled=new Set(P.paths.flat()).size,linked=P.pairs.filter((_,ci)=>done(ci)).length;
    $("#fmsg").textContent=linked+" of "+P.pairs.length+" pairs joined · "+Math.round(filled/(n*n)*100)+"% filled";
  }
  function check(){if(P.pairs.every((_,ci)=>done(ci))&&new Set(P.paths.flat()).size===n*n){st.solved++;st.cur=null;save();
    gameWin("Puzzle solved!","That's "+st.solved+" solved. "+(FLOW_SIZES.find(([s,need])=>need===st.solved)?"You've unlocked a bigger grid!":"Ready for another?"),"Next puzzle");
    const go=()=>{if(showing){setTimeout(go,300);return}if(G&&G.id==="flow")flowGame(g)};setTimeout(go,400);return true}return false}
  wrap.onpointerdown=e=>{const k=cellOf(e);if(k<0)return;wrap.setPointerCapture&&wrap.setPointerCapture(e.pointerId);
    if(k in dotAt){drawing=dotAt[k];P.paths[drawing]=[k]}
    else{const o=owner(k);if(o<0)return;drawing=o;const p=P.paths[o];P.paths[o]=p.slice(0,p.indexOf(k)+1)}
    draw()};
  wrap.onpointermove=e=>{if(drawing<0)return;const k=cellOf(e);if(k<0)return;const p=P.paths[drawing],head=p[p.length-1];if(k===head)return;
    if(p.includes(k)){P.paths[drawing]=p.slice(0,p.indexOf(k)+1);draw();return}
    if(done(drawing))return;
    const hr=Math.floor(head/n),hc=head%n,kr=Math.floor(k/n),kc=k%n;if(Math.abs(hr-kr)+Math.abs(hc-kc)!==1)return;
    if(k in dotAt&&dotAt[k]!==drawing)return;
    const o=owner(k);if(o>=0&&o!==drawing){const q=P.paths[o];P.paths[o]=q.slice(0,q.indexOf(k))}
    p.push(k);draw();if(done(drawing))blip()};
  const up=()=>{if(drawing<0)return;drawing=-1;save();check()};
  wrap.onpointerup=up;wrap.onpointercancel=up;
  $("#fclr").onclick=()=>{P.paths=P.pairs.map(()=>[]);save();draw()};
  $("#fnew").onclick=()=>{st.cur=flowMake(st.size);save();flowGame(g)};
  $("#fhint").onclick=()=>{const ci=P.pairs.findIndex((_,i)=>!done(i));if(ci<0)return;toast("Try joining the "+"ABCDEFGHI"[ci]+" dots next. Lines can bend round corners.")};
  document.querySelectorAll("[data-sz]").forEach(b=>b.onclick=()=>{st.size=+b.dataset.sz;st.cur=null;save();flowGame(g)});
  draw();
}

/* ================= Solitaire (Klondike, turn one card) ================= */
const SUIT=["♠","♥","♦","♣"],RANKN=["","A","2","3","4","5","6","7","8","9","10","J","Q","K"];
const red=c=>c.s===1||c.s===2;
function solDeal(){const d=[];for(let s=0;s<4;s++)for(let r=1;r<=13;r++)d.push({s,r,up:false});shuffle(d);
  const tab=[];for(let i=0;i<7;i++){tab.push(d.splice(0,i+1));tab[i][i].up=true}
  return {stock:d,waste:[],found:[[],[],[],[]],tab,moves:0,undo:[]}}
function solGame(g){
  const st=gstate("sol");st.won=st.won||0;if(!st.cur)st.cur=solDeal();
  const D=()=>st.cur;let hintAt=null;
  const snap=()=>{const d=D(),c=JSON.parse(JSON.stringify({stock:d.stock,waste:d.waste,found:d.found,tab:d.tab,moves:d.moves}));d.undo.push(c);if(d.undo.length>150)d.undo.shift()};
  const fitFound=(c)=>{const d=D();return d.found.findIndex(f=>(!f.length&&c.r===1)||(f.length&&f[f.length-1].s===c.s&&f[f.length-1].r===c.r-1))};
  const fitTab=(c,from)=>{const d=D();let empty=-1;for(let i=0;i<7;i++){if(i===from)continue;const t=d.tab[i];if(!t.length){if(c.r===13&&empty<0)empty=i;continue}const top=t[t.length-1];if(top.up&&red(top)!==red(c)&&top.r===c.r+1)return i}return empty};
  const flipTops=()=>D().tab.forEach(t=>{if(t.length&&!t[t.length-1].up)t[t.length-1].up=true});
  function tapTab(col,idx){const d=D(),t=d.tab[col],c=t[idx];if(!c.up)return;
    if(idx===t.length-1){const f=fitFound(c);if(f>=0){snap();d.found[f].push(t.pop());return moved()}}
    const to=fitTab(c,col);if(to>=0&&!(c.r===13&&idx===0&&!d.tab[to].length)){snap();d.tab[to].push(...t.splice(idx));return moved()}
    nope()}
  function tapWaste(){const d=D();if(!d.waste.length)return;const c=d.waste[d.waste.length-1];
    const f=fitFound(c);if(f>=0){snap();d.found[f].push(d.waste.pop());return moved()}
    const to=fitTab(c,-1);if(to>=0){snap();d.tab[to].push(d.waste.pop());return moved()}nope()}
  function tapStock(){const d=D();snap();if(d.stock.length){const c=d.stock.pop();c.up=true;d.waste.push(c)}else{d.stock=d.waste.reverse().map(c=>(c.up=false,c));d.waste=[]}d.moves++;save();draw()}
  function tapFound(fi){const d=D(),f=d.found[fi];if(!f.length)return;const c=f[f.length-1],to=fitTab(c,-1);if(to>=0){snap();d.tab[to].push(f.pop());moved()}else nope()}
  function moved(){const d=D();d.moves++;flipTops();hintAt=null;blip();save();draw();
    if(d.found.every(f=>f.length===13)){st.won++;st.cur=null;save();gameWin("You won Solitaire!","Games won: "+st.won+". Well played!","Deal again");const go=()=>{if(showing){setTimeout(go,300);return}if(G&&G.id==="sol")solGame(g)};setTimeout(go,400)}}
  function nope(){toast("That card can't move just now.",1400)}
  function canFinish(){const d=D();return !d.stock.length&&!d.waste.length&&d.tab.every(t=>t.every(c=>c.up))}
  function finish(){const d=D();const step=()=>{for(let i=0;i<7;i++){const t=d.tab[i];if(!t.length)continue;const c=t[t.length-1],f=fitFound(c);if(f>=0){d.found[f].push(t.pop());draw();return setTimeout(step,120)}}moved()};step()}
  function hint(){const d=D();
    for(let i=0;i<7;i++){const t=d.tab[i];if(t.length&&t[t.length-1].up&&fitFound(t[t.length-1])>=0){hintAt="t"+i+"-"+(t.length-1);return draw()}}
    if(d.waste.length){const c=d.waste[d.waste.length-1];if(fitFound(c)>=0||fitTab(c,-1)>=0){hintAt="w";return draw()}}
    for(let i=0;i<7;i++){const t=d.tab[i],j=t.findIndex(c=>c.up);if(j<0)continue;if(fitTab(t[j],i)>=0&&!(j===0&&t[j].r===13)){hintAt="t"+i+"-"+j;return draw()}}
    hintAt="s";draw();toast(d.stock.length?"Try turning over a new card.":"Tap the empty space to turn the pile over again.")}
  const card=(c,id,extra)=>c.up?`<button class="pcard ${red(c)?"red":""} ${hintAt===id?"hint":""}" data-id="${id}" style="${extra||""}"><span>${RANKN[c.r]}${SUIT[c.s]}</span><b>${SUIT[c.s]}</b></button>`:`<button class="pcard back ${hintAt===id?"hint":""}" data-id="${id}" style="${extra||""}"></button>`;
  function draw(){const d=D();
    let top=`<div class="ptop7"><div class="pslot" data-id="s">${d.stock.length?card({up:false},"s"):`<button class="pcard empty ${hintAt==="s"?"hint":""}" data-id="s">↻</button>`}</div>
      <div class="pslot">${d.waste.length?card(d.waste[d.waste.length-1],"w"):`<div class="pcard empty"></div>`}</div><div></div>
      ${d.found.map((f,i)=>`<div class="pslot">${f.length?card(f[f.length-1],"f"+i):`<div class="pcard empty">${["♠","♥","♦","♣"][i]}</div>`}</div>`).join("")}</div>`;
    let tab=`<div class="ptab">`;d.tab.forEach((t,i)=>{let y=0;tab+=`<div class="pcol">`;if(!t.length)tab+=`<div class="pcard empty">K</div>`;
      t.forEach((c,j)=>{tab+=card(c,"t"+i+"-"+j,`top:${y}px`);y+=c.up?34:12});tab+=`<div style="height:${y+80}px"></div></div>`});tab+=`</div>`;
    const ui=$("#solb");ui.innerHTML=top+tab;
    $("#solinfo").textContent="Moves: "+d.moves+" · Games won: "+st.won;
    const fb=$("#solfin");fb.hidden=!canFinish();
  }
  gameShell(g,`<p class="muted small" id="solinfo" style="margin:6px 0"></p><div id="solb"></div><button class="btn gold" id="solfin" hidden>Finish for me ✨</button>`,
    `<div class="row"><button class="btn soft" id="solu">↶ Undo</button><button class="btn soft" id="solh">Hint</button><button class="btn soft" id="soln">New game</button></div>`);
  $("#solb").onclick=e=>{const b=e.target.closest("[data-id]");if(!b)return;const id=b.dataset.id;
    if(id==="s")return tapStock();if(id==="w")return tapWaste();if(id[0]==="f")return tapFound(+id.slice(1));
    const[col,idx]=id.slice(1).split("-").map(Number);const t=D().tab[col];if(!t[idx].up&&idx===t.length-1){snap();t[idx].up=true;save();return draw()}tapTab(col,idx)};
  $("#solu").onclick=()=>{const d=D(),u=d.undo.pop();if(!u)return;Object.assign(d,u);save();draw()};
  $("#solh").onclick=hint;
  $("#soln").onclick=()=>confirmBox("Start a new game?","This game will be lost.","Yes, deal again","No, keep playing",()=>{st.cur=solDeal();save();solGame(g)});
  $("#solfin").onclick=finish;
  draw();
}

/* ================= Word of the day ================= */
let VALID=null;
function wordFor(dkey){let h=0;for(const ch of "steady"+dkey)h=(h*31+ch.charCodeAt(0))>>>0;return WORD_ANSWERS[h%WORD_ANSWERS.length]}
function scoreWord(guess,ans){const res=Array(5).fill("absent"),left={};
  for(let i=0;i<5;i++){if(guess[i]===ans[i])res[i]="correct";else left[ans[i]]=(left[ans[i]]||0)+1}
  for(let i=0;i<5;i++){if(res[i]!=="correct"&&left[guess[i]]){res[i]="present";left[guess[i]]--}}return res}
function wordGame(g,mode){
  if(!VALID)VALID=new Set(WORD_VALID.split(" "));
  const st=gstate("word"),t=dk();st.wins=st.wins||0;st.streak=st.streak||0;
  mode=mode||(st.daily&&st.daily.d===t&&st.daily.over?"practice":"daily");
  let W;
  if(mode==="daily"){if(!st.daily||st.daily.d!==t)st.daily={d:t,ans:wordFor(t),guesses:[],over:false};W=st.daily}
  else{if(!st.practice||st.practice.over)st.practice={ans:WORD_ANSWERS[Math.random()*WORD_ANSWERS.length|0],guesses:[],over:false};W=st.practice}
  let cur="";
  gameShell(g,`<div class="row" style="margin:8px 0"><button class="btn small ${mode==="daily"?"":"soft"}" id="wd">Today's word</button><button class="btn small ${mode==="practice"?"":"soft"}" id="wp">Practice word</button></div>
    <div id="wgrid" class="wgrid"></div><p class="cue" id="wmsg" style="min-height:1.5em"></p><div id="wkeys"></div>
    <p class="small muted">✓ green = right letter, right place · • gold = in the word, wrong place · grey = not in the word. Daily wins in a row: <b>${st.streak}</b></p>`);
  function letterState(){const m={};W.guesses.forEach(gu=>scoreWord(gu,W.ans).forEach((s,i)=>{const L=gu[i],rk={correct:3,present:2,absent:1};if(!m[L]||rk[s]>rk[m[L]])m[L]=s}));return m}
  function draw(){let h="";for(let r=0;r<6;r++){const gu=W.guesses[r],sc=gu?scoreWord(gu,W.ans):null,txt=gu||(r===W.guesses.length&&!W.over?cur:"");
      h+=`<div class="wrow">`;for(let i=0;i<5;i++){const L=(txt[i]||"").toUpperCase(),s=sc?sc[i]:"";h+=`<div class="wt ${s} ${!sc&&L?"typed":""}">${L}${s==="correct"?"<i>✓</i>":s==="present"?"<i>•</i>":""}</div>`}h+=`</div>`}
    $("#wgrid").innerHTML=h;
    const ls=letterState(),rows=["qwertyuiop","asdfghjkl","+zxcvbnm-"];
    $("#wkeys").innerHTML=rows.map(r=>`<div class="krow">${[...r].map(k=>k==="+"?`<button class="key wide" data-k="enter">Enter</button>`:k==="-"?`<button class="key wide" data-k="back">⌫</button>`:`<button class="key ${ls[k]||""}" data-k="${k}">${k.toUpperCase()}</button>`).join("")}</div>`).join("");
  }
  function finish(won){W.over=true;
    if(mode==="daily"){if(won){st.wins++;st.streak++}else st.streak=0}
    save();draw();
    if(won)gameWin(["Genius!","Magnificent!","Splendid!","Great!","Phew, well done!","Just in time!"][W.guesses.length-1],"You found "+W.ans.toUpperCase()+" in "+W.guesses.length+" tr"+(W.guesses.length>1?"ies":"y")+"."+(mode==="daily"?" Come back tomorrow for a new word, or try a practice word.":""));
    else{$("#wmsg").textContent="The word was "+W.ans.toUpperCase()+". Better luck next time!";chime()}}
  function key(k){if(W.over)return;$("#wmsg").textContent="";
    if(k==="back"){cur=cur.slice(0,-1);return draw()}
    if(k==="enter"){if(cur.length<5){$("#wmsg").textContent="Five letters, please.";return}
      if(!VALID.has(cur)){$("#wmsg").textContent="That's not in our word list. Try another word.";return}
      W.guesses.push(cur);cur="";save();draw();if(W.guesses[W.guesses.length-1]===W.ans)return finish(true);if(W.guesses.length>=6)return finish(false);return}
    if(cur.length<5&&/^[a-z]$/.test(k)){cur+=k;draw()}}
  $("#wkeys").onclick=e=>{const b=e.target.closest("[data-k]");if(b)key(b.dataset.k)};
  document.onkeydown=e=>{if(!G||G.id!=="word")return;if(e.key==="Enter")key("enter");else if(e.key==="Backspace")key("back");else key(e.key.toLowerCase())};
  $("#wd").onclick=()=>wordGame(g,"daily");$("#wp").onclick=()=>wordGame(g,"practice");
  draw();
  if(W.over&&mode==="daily")$("#wmsg").textContent="You've done today's word ("+W.ans.toUpperCase()+"). Try a practice word!";
}

/* ================= Sudoku ================= */
function sdkFill(b){const idx=b.indexOf(0);if(idx<0)return true;const r=Math.floor(idx/9),c=idx%9;
  for(const v of shuffle([1,2,3,4,5,6,7,8,9])){if(sdkOk(b,r,c,v)){b[idx]=v;if(sdkFill(b))return true;b[idx]=0}}return false}
function sdkCount(b,limit){const idx=b.indexOf(0);if(idx<0)return 1;const r=Math.floor(idx/9),c=idx%9;let n=0;
  for(let v=1;v<=9&&n<limit;v++){if(sdkOk(b,r,c,v)){b[idx]=v;n+=sdkCount(b,limit-n);b[idx]=0}}return n}
function sdkOk(b,r,c,v){for(let i=0;i<9;i++){if(b[r*9+i]===v||b[i*9+c]===v)return false}const br=r-r%3,bc=c-c%3;for(let i=0;i<3;i++)for(let j=0;j<3;j++)if(b[(br+i)*9+bc+j]===v)return false;return true}
function sdkMake(level){
  const sol=Array(81).fill(0);sdkFill(sol);
  const puz=sol.slice(),target={easy:40,medium:32,hard:27}[level];let givens=81;
  for(const i of shuffle([...Array(81).keys()])){if(givens<=target)break;const keep=puz[i];puz[i]=0;if(sdkCount(puz.slice(),2)!==1)puz[i]=keep;else givens--}
  return {level,sol,puz,cur:puz.slice()};
}
function sudokuGame(g){
  const st=gstate("sudoku");st.solved=st.solved||0;st.level=st.level||"easy";st.check=st.check!==false;
  if(!st.game)st.game=sdkMake(st.level);
  const Q=st.game;let sel=-1;
  gameShell(g,`<div class="row" style="margin:8px 0">${["easy","medium","hard"].map(l=>`<button class="btn small ${st.level===l?"":"soft"}" data-lv="${l}">${l[0].toUpperCase()+l.slice(1)}</button>`).join("")}</div>
    <div id="sgrid" class="sgrid"></div><div class="spad" id="spad">${[1,2,3,4,5,6,7,8,9].map(n=>`<button class="key" data-n="${n}">${n}</button>`).join("")}<button class="key" data-n="0">⌫</button></div>
    <p class="small muted">Tap a square, then a number. Puzzles solved: <b>${st.solved}</b></p>`,
    `<div class="toggle"><span><b>Show mistakes</b></span><input type="checkbox" id="schk" ${st.check?"checked":""}></div><div class="row" style="margin-top:10px"><button class="btn soft" id="shint">Hint</button><button class="btn soft" id="snew">New puzzle</button></div>`);
  function draw(){let h="";const sv=sel>=0?Q.cur[sel]:0;
    for(let i=0;i<81;i++){const r=Math.floor(i/9),c=i%9,v=Q.cur[i],given=Q.puz[i]!==0,wrong=st.check&&v&&!given&&v!==Q.sol[i];
      const same=sel>=0&&(Math.floor(sel/9)===r||sel%9===c||(Math.floor(sel/27)===Math.floor(i/27)&&Math.floor(sel%9/3)===Math.floor(c/3)));
      h+=`<button class="sc ${given?"given":""} ${wrong?"wrong":""} ${i===sel?"sel":same?"peer":""} ${sv&&v===sv&&i!==sel?"samev":""} ${c%3===2&&c<8?"br":""} ${r%3===2&&r<8?"bb":""}" data-i="${i}">${v||""}${wrong?"<i>✗</i>":""}</button>`}
    $("#sgrid").innerHTML=h}
  function check(){if(Q.cur.every((v,i)=>v===Q.sol[i])){st.solved++;st.game=null;save();gameWin("Sudoku solved!","That's "+st.solved+" solved. Excellent thinking!","Next puzzle");const go=()=>{if(showing){setTimeout(go,300);return}if(G&&G.id==="sudoku")sudokuGame(g)};setTimeout(go,400)}}
  $("#sgrid").onclick=e=>{const b=e.target.closest("[data-i]");if(!b)return;sel=+b.dataset.i;draw()};
  $("#spad").onclick=e=>{const b=e.target.closest("[data-n]");if(!b||sel<0||Q.puz[sel])return;Q.cur[sel]=+b.dataset.n;save();draw();check()};
  $("#schk").onchange=e=>{st.check=e.target.checked;save();draw()};
  $("#shint").onclick=()=>{let i=sel>=0&&!Q.puz[sel]&&Q.cur[sel]!==Q.sol[sel]?sel:Q.cur.findIndex((v,i)=>v!==Q.sol[i]);if(i<0)return;Q.cur[i]=Q.sol[i];sel=i;save();draw();check()};
  $("#snew").onclick=()=>{st.game=sdkMake(st.level);save();sudokuGame(g)};
  document.querySelectorAll("[data-lv]").forEach(b=>b.onclick=()=>{st.level=b.dataset.lv;st.game=sdkMake(st.level);save();sudokuGame(g)});
  draw();
}

/* ================= Picture puzzle ================= */
const SCENES=[["wall","Hadrian's Wall at sunset"],["sea","The seaside"],["cottage","Cottage garden"],["lake","Mountains and lake"]];
function paintScene(name,cv){
  const x=cv.getContext("2d"),W=cv.width,H=cv.height;
  const grad=(y0,y1,a,b)=>{const g=x.createLinearGradient(0,y0,0,y1);g.addColorStop(0,a);g.addColorStop(1,b);return g};
  const hill=(y,amp,col,ph)=>{x.fillStyle=col;x.beginPath();x.moveTo(0,H);for(let i=0;i<=W;i+=10)x.lineTo(i,y+Math.sin(i/W*Math.PI*2+ph)*amp+Math.sin(i/W*9+ph)*amp*.25);x.lineTo(W,H);x.fill()};
  if(name==="wall"){x.fillStyle=grad(0,H*.6,"#5b3a8c","#f4a259");x.fillRect(0,0,W,H);x.fillStyle="#ffd27a";x.beginPath();x.arc(W*.72,H*.38,W*.08,0,7);x.fill();
    hill(H*.55,H*.05,"#6a8f4e",1);hill(H*.66,H*.06,"#4f7a3a",2.4);
    x.fillStyle="#8b8378";for(let i=0;i<W;i+=4){const y=H*.64+Math.sin(i/W*Math.PI*2+2.4)*H*.06+Math.sin(i/W*9+2.4)*H*.015;x.fillRect(i,y-H*.035,4,H*.035)}
    x.fillStyle="#3b2a1a";x.fillRect(W*.47,H*.48,W*.02,H*.12);x.fillStyle="#2f5a26";x.beginPath();x.arc(W*.48,H*.45,W*.07,0,7);x.fill();
    hill(H*.82,H*.04,"#3d6b2e",4);}
  if(name==="sea"){x.fillStyle=grad(0,H*.55,"#4aa3df","#bfe3f7");x.fillRect(0,0,W,H);x.fillStyle="#fff";[[.2,.15],[.6,.1],[.8,.22]].forEach(([a,b])=>{x.beginPath();x.ellipse(W*a,H*b,W*.08,H*.03,0,0,7);x.fill()});
    x.fillStyle=grad(H*.55,H*.8,"#1f6fa8","#2f95c9");x.fillRect(0,H*.55,W,H*.25);x.fillStyle="#f1d9a7";x.beginPath();x.moveTo(0,H*.78);x.quadraticCurveTo(W*.5,H*.72,W,H*.82);x.lineTo(W,H);x.lineTo(0,H);x.fill();
    for(let i=0;i<6;i++){x.fillStyle=i%2?"#fff":"#d62828";x.fillRect(W*.78,H*(.3+i*.05),W*.06,H*.05)}x.fillStyle="#333";x.fillRect(W*.77,H*.27,W*.08,H*.03);x.fillStyle="#ffe066";x.fillRect(W*.79,H*.23,W*.04,H*.04);
    [[.25,.62,"#e76f51"],[.45,.66,"#f4a261"]].forEach(([a,b,c])=>{x.fillStyle=c;x.beginPath();x.moveTo(W*a-30,H*b);x.lineTo(W*a+30,H*b);x.lineTo(W*a+20,H*b+14);x.lineTo(W*a-20,H*b+14);x.fill();x.fillStyle="#fff";x.beginPath();x.moveTo(W*a,H*b-50);x.lineTo(W*a,H*b-4);x.lineTo(W*a+28,H*b-4);x.fill()});}
  if(name==="cottage"){x.fillStyle=grad(0,H*.5,"#8ecae6","#e0f2f8");x.fillRect(0,0,W,H);hill(H*.55,H*.03,"#7fb069",0);x.fillStyle="#5a8f3e";x.fillRect(0,H*.7,W,H*.3);
    x.fillStyle="#f2e8cf";x.fillRect(W*.25,H*.38,W*.5,H*.3);x.fillStyle="#9c6644";x.beginPath();x.moveTo(W*.2,H*.4);x.lineTo(W*.5,H*.2);x.lineTo(W*.8,H*.4);x.fill();
    x.fillStyle="#1d4e89";x.fillRect(W*.45,H*.52,W*.1,H*.16);x.fillStyle="#bde0fe";[[.3,.45],[.6,.45]].forEach(([a,b])=>x.fillRect(W*a,H*b,W*.1,H*.08));
    x.fillStyle="#fff";for(let i=0;i<W;i+=W/16){x.fillRect(i,H*.72,W/40,H*.08)}x.fillRect(0,H*.75,W,H*.012);
    const cols=["#e63946","#ffb703","#ff70a6","#9b5de5","#ffffff"];for(let i=0;i<140;i++){x.fillStyle=cols[i%5];x.beginPath();x.arc(Math.random()*W,H*.82+Math.random()*H*.16,W*.012,0,7);x.fill()}}
  if(name==="lake"){x.fillStyle=grad(0,H*.5,"#2a6f97","#a9d6e5");x.fillRect(0,0,W,H);
    const peak=(px,ph,w,col)=>{x.fillStyle=col;x.beginPath();x.moveTo(px-w,H*.55);x.lineTo(px,H*ph);x.lineTo(px+w,H*.55);x.fill();x.fillStyle="#fff";x.beginPath();x.moveTo(px-w*.25,H*(ph+(.55-ph)*.25));x.lineTo(px,H*ph);x.lineTo(px+w*.25,H*(ph+(.55-ph)*.25));x.fill()};
    peak(W*.3,.18,W*.3,"#4a5d6e");peak(W*.68,.25,W*.32,"#5c6f7f");x.fillStyle=grad(H*.55,H,"#3a86a8","#1b4965");x.fillRect(0,H*.55,W,H*.45);
    x.globalAlpha=.25;x.save();x.translate(0,H*1.1);x.scale(1,-1);peak(W*.3,.18,W*.3,"#4a5d6e");peak(W*.68,.25,W*.32,"#5c6f7f");x.restore();x.globalAlpha=1;
    for(let i=0;i<9;i++){const px=W*(.03+i*.12),py=H*(.62+(i%2)*.04);x.fillStyle="#1b4332";x.beginPath();x.moveTo(px,py-H*.12);x.lineTo(px-W*.04,py);x.lineTo(px+W*.04,py);x.fill()}}
}
function jigGame(g){
  const st=gstate("jig");st.solved=st.solved||0;st.size=st.size||3;
  if(!st.cur){const sc=SCENES[st.solved%SCENES.length][0];st.cur={src:"scene:"+sc,n:st.size,order:null}}
  const Q=st.cur,n=Q.n;
  if(!Q.order){do{Q.order=shuffle([...Array(n*n).keys()])}while(Q.order.every((v,i)=>v===i))}
  let img=null,sel=-1;
  if(Q.src.startsWith("scene:")){const cv=document.createElement("canvas");cv.width=cv.height=720;paintScene(Q.src.slice(6),cv);img=cv.toDataURL("image/jpeg",.85)}else img=Q.src;
  const title=Q.src.startsWith("scene:")?(SCENES.find(s=>"scene:"+s[0]===Q.src)||["",""])[1]:"Your photo";
  gameShell(g,`<p class="muted small" style="margin:6px 0">${esc(title)}. Tap two pieces to swap them. Pieces in the right place lock with a tick. Solved: <b>${st.solved}</b></p>
    <div id="jgrid" class="jgrid" style="grid-template-columns:repeat(${n},1fr)"></div>`,
    `<div class="row">${[3,4,5].map(s=>`<button class="btn small ${s===n?"":"soft"}" data-js="${s}">${s}×${s}</button>`).join("")}</div>
    <div class="row" style="margin-top:10px"><button class="btn soft" id="jpeek">Peek at the picture</button><button class="btn soft" id="jnew">New picture</button></div>
    <label class="btn soft" style="margin-top:10px">📷 Use one of my photos<input type="file" accept="image/*" id="jfile" hidden></label>`);
  function draw(){let h="";Q.order.forEach((p,i)=>{const ok=p===i,px=p%n,py=Math.floor(p/n);
      h+=`<button class="jp ${ok?"ok":""} ${i===sel?"sel":""}" data-i="${i}" style="background-image:url(${img});background-size:${n*100}% ${n*100}%;background-position:${n>1?px/(n-1)*100:0}% ${n>1?py/(n-1)*100:0}%">${ok?"<i>✓</i>":""}</button>`});
    $("#jgrid").innerHTML=h}
  $("#jgrid").onclick=e=>{const b=e.target.closest("[data-i]");if(!b)return;const i=+b.dataset.i;if(Q.order[i]===i)return;
    if(sel<0){sel=i;return draw()}if(sel===i){sel=-1;return draw()}
    [Q.order[sel],Q.order[i]]=[Q.order[i],Q.order[sel]];sel=-1;blip();save();draw();
    if(Q.order.every((v,k)=>v===k)){st.solved++;st.cur=null;save();gameWin("Picture complete!","Lovely work. That's "+st.solved+" pictures done.","Next picture");const go=()=>{if(showing){setTimeout(go,300);return}if(G&&G.id==="jig")jigGame(g)};setTimeout(go,400)}};
  $("#jpeek").onclick=()=>{openLayer(`<div class="dialog plain"><img src="${img}" style="width:100%;border-radius:12px" alt="The finished picture"><button class="btn" id="cx" style="margin-top:10px">Back to the puzzle</button></div>`);$("#cx").onclick=closeLayer};
  $("#jnew").onclick=()=>{const i=(SCENES.findIndex(s=>"scene:"+s[0]===Q.src)+1)%SCENES.length;st.cur={src:"scene:"+SCENES[i][0],n:st.size,order:null};save();jigGame(g)};
  document.querySelectorAll("[data-js]").forEach(b=>b.onclick=()=>{st.size=+b.dataset.js;st.cur={src:Q.src,n:st.size,order:null};save();jigGame(g)});
  $("#jfile").onchange=e=>{const f=e.target.files[0];if(!f)return;const fr=new FileReader();fr.onload=()=>{const im=new Image();im.onload=()=>{
      const s=Math.min(im.width,im.height),cv=document.createElement("canvas");cv.width=cv.height=720;cv.getContext("2d").drawImage(im,(im.width-s)/2,(im.height-s)/2,s,s,0,0,720,720);
      st.cur={src:cv.toDataURL("image/jpeg",.8),n:st.size,order:null};save();jigGame(g)};im.src=fr.result};fr.readAsDataURL(f)};
  draw();
}
