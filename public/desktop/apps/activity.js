// Live demo activity stays inside the simulated desktop.
import { $, $$, LIGHTS, registerApp, openWindow, windows, every, pick, notify, bounce, addBadge, launch, closeWindow, on } from '../os.js';
const toolbar = title => `<div class="bar" data-drag>${LIGHTS}<b>${title}</b></div>`;
const quotes = [ ['NOVA', 'Nova Systems', 184.62, 2.41], ['ORBT', 'Orbit Labs', 93.14, -1.82], ['WAVE', 'Wave Energy', 214.83, 5.14], ['FLUX', 'Flux Motors', 42.68, -3.27] ];
function chart(index) {
 const points=Array.from({length:32},(_,i)=>`${i*8},${24+Math.sin(i*1.7+index)*10+Math.cos(i*.8)*7}`).join(' ');
 return `<svg viewBox="0 0 248 52" preserveAspectRatio="none"><polyline points="${points}" fill="none" stroke="currentColor" stroke-width="2"/></svg>`;
}
function drawStocks(win) {
 $('.market-quotes',win.el).innerHTML=quotes.map(([symbol,name,price,change],i)=>`<button data-symbol="${i}" class="market-row ${change<0?'down':'up'}"><span><b>${symbol}</b><small>${name}</small></span>${chart(i+price)}<span><b>${price.toFixed(2)}</b><em>${change>0?'+':''}${change.toFixed(2)}%</em></span></button>`).join('');
}
registerApp({id:'stocks',name:'Stocks',icon:'assets/dock-stocks.svg',open(o={}){
 const win=openWindow({app:'stocks',title:'Markets',w:335,h:310,...o,className:'stocks',html:toolbar('Markets')+'<div class="market-header"><b>Watchlist</b><span>● MARKET OPEN</span></div><div class="market-quotes"></div><div class="market-ticker">LIVE · Earnings in 12 minutes · Futures turn lower · Volume +24%</div>'});
 drawStocks(win);win.el.addEventListener('click',e=>{const row=e.target.closest('[data-symbol]');if(row)launch('web',{url:`search?q=${encodeURIComponent(quotes[+row.dataset.symbol][1]+' earnings')}`});});return win;
}});
every(500,1100,()=>{quotes.forEach(q=>{q[2]+=(Math.random()-.5)*1.2;q[3]+=(Math.random()-.5)*.2;});windows.filter(w=>w.kind==='window' && w.app==='stocks'&&!w.minimized).forEach(drawStocks);});
let remaining=4*60+32, paused=false;
function drawClock(){windows.filter(w=>w.kind==='window' && w.app==='clock').forEach(w=>{ $('.timer-digits',w.el).textContent=`${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')}`;$('.timer-toggle',w.el).textContent=paused?'Resume':'Pause'; });}
registerApp({id:'clock',name:'Clock',icon:'assets/dock-clock.svg',open(o={}){
 const win=openWindow({app:'clock',title:'Standup',w:265,h:205,...o,className:'countdown',html:toolbar('Next meeting')+'<div class="timer-digits"></div><p>Standup starts soon</p><div class="timer-actions"><button class="timer-toggle">Pause</button><button data-reset>＋ 5 minutes</button></div>'});
 win.el.onclick=e=>{if(e.target.closest('.timer-toggle'))paused=!paused;if(e.target.closest('[data-reset]'))remaining+=300;drawClock();};drawClock();return win;
}});
every(1000,1000,()=>{if(!paused){remaining=Math.max(0,remaining-1);drawClock();if(!remaining){notify({app:'clock',title:'You’re late',text:'Standup started. Everyone is waiting.',quietIfFront:false});remaining=300;}}});
const code=`// launch.js\nimport { ship, coffee } from './essentials';\n\nexport async function launchFriday() {\n  const deadline = 'yesterday';\n  const tabs = 47;\n\n  await coffee.refill();\n  // TODO: fix before the demo\n  return ship({ deadline, tabs, ready: false });\n}\n\nlaunchFriday().catch(console.error);`;
registerApp({id:'editor',name:'Code',icon:'assets/dock-editor.svg',open(o={}){
 const win=openWindow({app:'editor',title:'launch.js — project',w:490,h:330,...o,className:'codeapp',html:toolbar('launch.js — project')+`<div class="code-tabs"><span>launch.js <i>●</i></span><span>README.md</span><span>package.json</span></div><div class="code-workspace"><nav>EXPLORER<br><br>▾ website<br>　 launch.js<br>　 styles.css<br>　 index.html<br><br>▸ node_modules</nav><textarea aria-label="Code editor" spellcheck="false"></textarea></div><div class="code-status"><span>⑂ main*</span><span class="code-position">Ln 1, Col 1</span><button data-run>▷ Run check</button></div><div class="code-result">3 problems · 12 warnings</div>`});
 const input=$('textarea',win.el);input.value=code;input.oninput=()=>{$('.code-position',win.el).textContent=`${input.value.split('\n').length} lines · Unsaved`;};$('[data-run]',win.el).onclick=()=>{$('.code-result',win.el).textContent='Checking…';setTimeout(()=>{if(win.el.isConnected)$('.code-result',win.el).textContent='Demo check complete · Save your changes before shipping';},700);};return win;
}});
const logLines=['[vite] page reload /src/App.tsx','WARN dependency cycle detected','fetching 1,204 modules…','✓ compiled in 482ms','ERROR request timed out — retrying','watching for file changes','test checkout > expected 200, received 503','npm WARN deprecated package@2.4.1'];
every(450,950,()=>{windows.filter(w=>w.kind==='window' && w.app==='term'&&!w.minimized).forEach(w=>{if(w.el.contains(document.activeElement)||w.el.matches(':hover'))return;const out=$('.terminal-output',w.el);const lines=out.textContent.split('\n');lines.push(pick(logLines));out.textContent=lines.slice(-70).join('\n');out.scrollTop=out.scrollHeight;});});
every(1500,2500,()=>{windows.filter(w=>w.kind==='window' && w.app==='social'&&!w.minimized).forEach(w=>{const el=$('.social-scroll',w.el);if(w.el.matches(':hover')||w.el.contains(document.activeElement))return;el.scrollTo({top:el.scrollTop+110>el.scrollHeight-el.clientHeight?0:el.scrollTop+110,behavior:'smooth'});});});
const interruptions=[
 ['mail','Mail','Another reply-all: “Can you send that again?”'],
 ['team','#incidents','Dana: can you jump on for literally one second'],
 ['chat','Mom','Hello???'],
 ['clock','Calendar','Design review starts in 2 minutes'],
 ['news','Breaking news','Markets just reversed course again'],
 ['store','Software Update','A restart is waiting for you'],
 ['settings','Storage almost full','Your startup disk has 1.2 GB available'],
 ['chat','Delivery','Your driver is trying to reach you'],
];
export function seedInterruptions(){interruptions.slice(0,3).forEach(([app,title,text])=>notify({app,title,text,quietIfFront:false}));}
every(850,1600,()=>{const [app,title,text]=pick(interruptions);addBadge(app);bounce(app);notify({app,title,text,quietIfFront:false});});
export function openReminder(){
 const win=openWindow({app:'clock',title:'Meeting reminder',x:innerWidth*.69,y:innerHeight*.43,w:265,h:190,resizable:false,className:'meeting-alert',kind:'reminder',html:toolbar('Calendar')+'<div class="meeting-content"><b>Design review</b><p>12 people are waiting in the room</p><div><button data-snooze>Remind me later</button><button data-join>Join meeting</button></div></div>'});
 $('[data-snooze]',win.el).onclick=()=>closeWindow(win);
 $('[data-join]',win.el).onclick=()=>{closeWindow(win);launch('chat');};
}
