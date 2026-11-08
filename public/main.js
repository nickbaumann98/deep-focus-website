import { $, bootOS, launch, startChaos, stopChaos, closePopup, registerApp } from './desktop/os.js';
import './desktop/apps/talk.js';
import './desktop/apps/web.js';
import './desktop/apps/work.js';
import { seedInterruptions, openReminder } from './desktop/apps/activity.js';
const DOWNLOAD_URL = '';
const HOLD_SECONDS=5, FEATHER=190;
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const touchOnly=matchMedia('(hover: none) and (pointer: coarse)').matches;
const walls = {};
const hero = $("#hero");
const backing = $("#backing");
const wallsEl = $("#walls");
const line = $("#line");
const pill = $("#pill");
const ring = $("#ring");
const keys = [...document.querySelectorAll("kbd")];
const RING_LENGTH = 56.55;

let state = "idle"; // idle, entering, focused, exiting
const timers = [];

function sizeWalls() {
  const length = (innerWidth + innerHeight) * 2 + 800;
  document.querySelectorAll(".wall").forEach((wall) => {
    const side = wall.dataset.side;
    const edge = wall.firstElementChild;
    wall.style.width = wall.style.height = length + "px";
    const horizontal = side === "left" || side === "right";
    edge.style.width = horizontal ? FEATHER + "px" : length + "px";
    edge.style.height = horizontal ? length + "px" : FEATHER + "px";
    edge.style.left = side === "left" ? length + "px" : side === "right" ? -FEATHER + "px" : "0";
    edge.style.top = side === "top" ? length + "px" : side === "bottom" ? -FEATHER + "px" : "0";
    edge.style.transformOrigin = { left: "0 50%", right: "100% 50%", top: "50% 0", bottom: "50% 100%" }[side];
    walls[side] = { wall, edge, length };
  });
}

// Where a wall's body sits so its inner face is on a given edge of the hole.
function wallTransform(side, hole) {
  const { length } = walls[side];
  switch (side) {
    case "left": return `translate(${hole.left - length}px, ${-innerHeight}px)`;
    case "right": return `translate(${hole.right}px, ${-innerHeight}px)`;
    case "top": return `translate(${-innerWidth}px, ${hole.top - length}px)`;
    default: return `translate(${-innerWidth}px, ${hole.bottom}px)`;
  }
}

function edgeTransform(side, scale) {
  return side === "left" || side === "right" ? `scaleX(${scale})` : `scaleY(${scale})`;
}

const openHole = () => ({
  left: -FEATHER - 24, top: -FEATHER - 24,
  right: innerWidth + FEATHER + 24, bottom: innerHeight + FEATHER + 24,
});

function placeWalls(hole) {
  for (const side of Object.keys(walls)) walls[side].wall.style.transform = wallTransform(side, hole);
}

function placeBacking() {
  const box = hero.getBoundingClientRect();
  Object.assign(backing.style, {
    left: box.left - 1 + "px", top: box.top - 1 + "px",
    width: box.width + 2 + "px", height: box.height + 2 + "px",
  });
  return box;
}

function later(ms, run) {
  timers.push(setTimeout(run, ms));
}

function setLine() {
  if (state === "focused" || state === "entering") {
    line.textContent = "Everything else goes quiet so you can focus on what matters";
  } else {
    line.textContent = touchOnly
      ? "Tap the keys to enter Deep Focus mode"
      : "Press ⌘⇧F to enter Deep Focus mode";
  }
}

function enter() {
  if (state !== "idle") return;
  state = "entering";
  document.body.classList.remove("exploring");
  closePopup();
  $("#center").classList.remove("open");
  $("#spotlight").classList.remove("open");
  $("#desktop").inert = true;
  setLine();
  keys.forEach((key) => key.classList.add("lit"));
  later(240, () => keys.forEach((key) => key.classList.remove("lit")));

  const box = placeBacking();
  const open = openHole();
  wallsEl.style.visibility = "visible";
  wallsEl.style.pointerEvents = "none";
  placeWalls(box);

  // Moving only pre-built layers, the same as the app, so it stays smooth.
  const duration = reducedMotion ? 1 : 900;
  for (const side of Object.keys(walls)) {
    const { wall, edge } = walls[side];
    wall.getAnimations().forEach((a) => a.cancel());
    edge.getAnimations().forEach((a) => a.cancel());
    wall.animate(
      [{ transform: wallTransform(side, open) }, { transform: wallTransform(side, box) }],
      { duration, easing: "cubic-bezier(.3, .02, .12, 1)" },
    );
    // The soft edge outlasts the wall: it covers the seam, then draws back off the window.
    edge.style.transform = edgeTransform(side, 0.001);
    edge.animate(
      [{ transform: edgeTransform(side, 1) }, { transform: edgeTransform(side, 0.001) }],
      { duration: reducedMotion ? 1 : 1350, easing: "cubic-bezier(.5, 0, .14, 1)" },
    );
  }

  later(reducedMotion ? 0 : 720, () => {
    backing.style.transition = "opacity .22s";
    backing.style.opacity = 1;
  });
  later(reducedMotion ? 0 : 1200, () => {
    state = "focused";
    document.body.classList.add("focused");
    pill.tabIndex = 0;
  });
  later(reducedMotion ? 0 : 1400, () => {
    document.body.classList.add("quiet");
    stopChaos();
  });
}

function exit() {
  if (state !== "focused") return;
  state = "exiting";
  timers.splice(0).forEach(clearTimeout);
  document.body.classList.remove("quiet", "focused");
  pill.tabIndex = -1;
  startChaos();
  backing.style.transition = "opacity .16s";
  backing.style.opacity = 0;
  ring.style.strokeDashoffset = RING_LENGTH;

  const box = hero.getBoundingClientRect();
  const open = openHole();
  const duration = reducedMotion ? 1 : 850;
  let finished;
  for (const side of Object.keys(walls)) {
    const { wall, edge } = walls[side];
    wall.style.transform = wallTransform(side, open);
    finished = wall.animate(
      [{ transform: wallTransform(side, box) }, { transform: wallTransform(side, open) }],
      { duration, easing: "cubic-bezier(.6, 0, .2, 1)" },
    );
    edge.style.transform = edgeTransform(side, 1);
    // Softens first, so the walls never part with a hard edge.
    edge.animate(
      [{ transform: edgeTransform(side, 0.001) }, { transform: edgeTransform(side, 1) }],
      { duration: duration * 0.4, easing: "cubic-bezier(.2, .7, .3, 1)" },
    );
  }
  finished.onfinish = () => {
    wallsEl.style.visibility = "hidden";
    state = "idle";
    $("#desktop").inert = false;
    setLine();
  };
}

/* ------------------------------------------------------------------ */
/* Hold to exit                                                        */
/* ------------------------------------------------------------------ */

let holdAnimation = null;

function beginHold() {
  if (state !== "focused" || holdAnimation) return;
  holdAnimation = ring.animate(
    [{ strokeDashoffset: RING_LENGTH }, { strokeDashoffset: 0 }],
    { duration: HOLD_SECONDS * 1000, easing: "linear", fill: "forwards" },
  );
  holdAnimation.onfinish = () => {
    holdAnimation.cancel();
    holdAnimation = null;
    exit();
  };
}

function endHold() {
  if (!holdAnimation) return;
  const progress = holdAnimation.currentTime / (HOLD_SECONDS * 1000);
  holdAnimation.cancel();
  holdAnimation = null;
  ring.animate(
    [{ strokeDashoffset: RING_LENGTH * (1 - progress) }, { strokeDashoffset: RING_LENGTH }],
    { duration: 450, easing: "cubic-bezier(.2, .8, .2, 1)" },
  );
}

pill.addEventListener("pointerdown", (event) => {
  pill.setPointerCapture(event.pointerId);
  beginHold();
});
pill.addEventListener("pointerup", endHold);
pill.addEventListener("pointercancel", endHold);
pill.addEventListener("contextmenu", (event) => event.preventDefault());
pill.addEventListener("keydown", (event) => {
  if ((event.key === " " || event.key === "Enter") && !event.repeat) { event.preventDefault(); beginHold(); }
});
pill.addEventListener("keyup", (event) => {
  if (event.key === " " || event.key === "Enter") endHold();
});

/* ------------------------------------------------------------------ */
/* Input                                                               */
/* ------------------------------------------------------------------ */

let shortcutHeld = false;

addEventListener("keydown", (event) => {
  if (state === "idle") {
    keys[0].classList.toggle("lit", event.metaKey || event.ctrlKey);
    keys[1].classList.toggle("lit", event.shiftKey);
  }
  if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "f") {
    event.preventDefault();
    if (event.repeat) return;
    shortcutHeld = true;
    if (state === "idle") enter();
    else beginHold();
  }
});

addEventListener("keyup", (event) => {
  if (state === "idle") {
    keys[0].classList.toggle("lit", event.metaKey || event.ctrlKey);
    keys[1].classList.toggle("lit", event.shiftKey);
  }
  // Macs don't report letter keys being released while ⌘ is down, so ⌘ counts too.
  if (shortcutHeld && (event.key.toLowerCase() === "f" || event.key === "Meta" || event.key === "Control" || event.key === "Shift")) {
    shortcutHeld = false;
    endHold();
  }
});

addEventListener("blur", () => {
  keys.forEach((key) => key.classList.remove("lit"));
  shortcutHeld = false;
  endHold();
});

$("#keys").addEventListener("click", enter);

const download = $("#download");
if (DOWNLOAD_URL) {
  download.href = DOWNLOAD_URL;
} else {
  download.textContent = "Coming soon for Mac";
  download.setAttribute("aria-disabled", "true");
  download.addEventListener("click", (event) => { event.preventDefault(); line.textContent = "The Mac download will be available when the signed build is ready"; });
}

addEventListener("resize", () => {
  sizeWalls();
  if (state === "focused") {
    placeWalls(placeBacking());
  }
});

// Don't burn someone's battery in a background tab.
document.addEventListener("visibilitychange", () => {
  if (state !== "idle" && state !== "exiting") return;
  if (document.hidden) stopChaos();
  else startChaos();
});

/* ------------------------------------------------------------------ */

registerApp({id:'focus',name:'Deep Focus',icon:'icon.png',activate:()=>{document.body.classList.remove('exploring');enter();}});
$('#desktop').addEventListener('pointerdown',e=>{if(e.target.closest('.win, #dock'))document.body.classList.add('exploring');});
bootOS();
const updateClock=()=>$("#clock").textContent=new Date().toLocaleString("en",{weekday:"short",hour:"numeric",minute:"2-digit"});
updateClock();
setInterval(updateClock,60000);
// Overlapping, live windows surround the one quiet window.
launch('files', { x:innerWidth*.25, y:48,w:510,h:340 });
launch('editor', { x:innerWidth*.27, y:innerHeight*.48,w:510,h:350 });
launch('cal', { x:innerWidth*.51, y:innerHeight*.54,w:490,h:335 });
launch('social', { x:innerWidth*.24, y:38,w:350,h:430 });
launch('stocks', { x:innerWidth*.51, y:36,w:330,h:280 });
launch('term', { x:12, y:innerHeight*.49,w:460,h:280 });
launch('team', { x:16, y:44,w:500,h:Math.min(410,innerHeight*.48) });
launch('web', { x:innerWidth-565, y:62,w:550,h:390,tabs:['streamly.tv','flyfinder.co/sfo-jfk','search?q=best+desk+chair','','search?q=why+am+I+tired'] });
launch('chat', { x:18, y:innerHeight-320,w:410,h:225 });
launch('mail', { x:innerWidth-580,y:innerHeight-360,w:565,h:280 });
launch('music', { x:innerWidth*.31,y:innerHeight-285,w:335,h:200 });
launch('clock', { x:innerWidth*.65,y:innerHeight*.43,w:250,h:190 });
openReminder();
seedInterruptions();
sizeWalls();
setLine();
if (!reducedMotion) startChaos();
let autoTimer;
let interacted = false;
function cancelAuto() { interacted = true; clearTimeout(autoTimer); keys.forEach(k=>k.classList.remove('lit')); }
['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(type=>addEventListener(type,cancelAuto,{capture:true,passive:true}));
function scheduleAuto() {
 clearTimeout(autoTimer);
 if (interacted || document.hidden || state !== 'idle') return;
 autoTimer=setTimeout(()=>{
   keys[0].classList.add('lit');
   autoTimer=setTimeout(()=>{keys[1].classList.add('lit');
     autoTimer=setTimeout(()=>{keys[2].classList.add('lit');
       autoTimer=setTimeout(enter,220);
     },180);
   },180);
 },3000);
}
document.addEventListener('visibilitychange',()=>{if(document.hidden)clearTimeout(autoTimer);else scheduleAuto();});
scheduleAuto();
