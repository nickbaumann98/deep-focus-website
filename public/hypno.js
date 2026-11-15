// The hypnotic layer: once the walls close, window-shaped rings drift in
// from the edges of the screen toward the one open window, with a slow twist
// and a glow that breathes at about six breaths a minute. One small canvas,
// no libraries; it stops when the tab is hidden or focus mode ends.

const canvas = document.createElement("canvas");
canvas.id = "tunnel";
canvas.setAttribute("aria-hidden", "true");
document.body.append(canvas);
const ctx = canvas.getContext("2d");

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const RINGS = 26;
const CYCLE = 9000;     // ms for a ring to travel from the edge to the window
const BREATH = 10000;   // ms per breath (in and out)

let hole = null;        // the window's rect, rings converge on it
let radius = 26;
let frame = 0;
let started = 0;
let fade = 0;           // 0..1, eases the whole layer in and out
let target = 0;
let pointer = { x: 0, y: 0 }, lean = { x: 0, y: 0 };
let dpr = 1;

function size() {
  dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(innerWidth * dpr);
  canvas.height = Math.round(innerHeight * dpr);
}

function roundRect(x, y, w, h, r, keep) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  if (!keep) ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function draw(now) {
  const W = innerWidth, H = innerHeight;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  if (!hole || fade <= 0.001) return;

  const cx = hole.left + hole.width / 2, cy = hole.top + hole.height / 2;
  // How far out a ring has to start so it begins off-screen.
  const reach = Math.max(
    (Math.max(cx, W - cx) + 60) / (hole.width / 2),
    (Math.max(cy, H - cy) + 60) / (hole.height / 2),
  );
  const t0 = reducedMotion ? 0 : (now - started) / CYCLE;
  const breath = reducedMotion ? 0.5 : 0.5 - 0.5 * Math.cos(((now - started) / BREATH) * Math.PI * 2);

  // Keep the window itself clear.
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  roundRect(hole.left - 1, hole.top - 1, hole.width + 2, hole.height + 2, radius, true);
  ctx.clip("evenodd");

  // Breathing glow hugging the window.
  const glow = ctx.createRadialGradient(cx, cy, Math.min(hole.width, hole.height) * 0.45, cx, cy, Math.max(hole.width, hole.height) * (0.95 + breath * 0.25));
  glow.addColorStop(0, `rgba(237, 222, 192, ${(0.10 + breath * 0.10) * fade})`);
  glow.addColorStop(1, "rgba(237, 222, 192, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  for (let i = 0; i < RINGS; i++) {
    // p runs 1 -> 0: each ring is born at the edge and sinks into the window.
    const p = 1 - (((i / RINGS) + t0) % 1);
    const depth = p * p;                         // perspective: rings bunch near the window
    const s = 1 + (reach - 1) * depth;
    const w = hole.width * s, h = hole.height * s;
    const ox = lean.x * depth * 40, oy = lean.y * depth * 40;
    const twist = reducedMotion ? 0 : Math.sin((now - started) / 7000 + p * 2.2) * 0.05 * depth;
    // Fade in at the edge, out as it reaches the window.
    const alpha = Math.min(1, (1 - p) * 6) * Math.min(1, p * 5) * (0.24 + 0.4 * (1 - p)) * (0.75 + breath * 0.5) * fade;
    if (alpha < 0.004) continue;
    ctx.save();
    ctx.translate(cx + ox, cy + oy);
    ctx.rotate(twist);
    roundRect(-w / 2, -h / 2, w, h, radius * s);
    ctx.lineWidth = 1 + depth * 2.5;
    // Warmer toward the window, like the lamp in the icon.
    ctx.strokeStyle = `rgba(${Math.round(240 - 12 * (1 - p))}, ${Math.round(222 - 34 * (1 - p))}, ${Math.round(192 - 70 * (1 - p))}, ${alpha})`;
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

function loop(now) {
  fade += (target - fade) * (target ? 0.04 : 0.12);
  lean.x += (pointer.x - lean.x) * 0.03;
  lean.y += (pointer.y - lean.y) * 0.03;
  draw(now);
  if (target === 0 && fade < 0.002) { fade = 0; draw(now); frame = 0; return; }
  if (reducedMotion && Math.abs(target - fade) < 0.002) { fade = target; draw(now); frame = 0; return; }
  frame = requestAnimationFrame(loop);
}

function kick() {
  if (!frame && !document.hidden) frame = requestAnimationFrame(loop);
}

export function startTunnel(rect, cornerRadius) {
  hole = rect;
  radius = cornerRadius || radius;
  started = performance.now();
  target = 1;
  if (reducedMotion) fade = 1;
  kick();
}

export function moveTunnel(rect) {
  hole = rect;
  if (reducedMotion) draw(performance.now());
}

export function stopTunnel() {
  target = 0;
  if (reducedMotion) { fade = 0; draw(performance.now()); return; }
  kick();
}

addEventListener("resize", () => { size(); draw(performance.now()); });
addEventListener("pointermove", (e) => {
  pointer.x = e.clientX / innerWidth - 0.5;
  pointer.y = e.clientY / innerHeight - 0.5;
}, { passive: true });
document.addEventListener("visibilitychange", () => {
  if (document.hidden) { cancelAnimationFrame(frame); frame = 0; } else if (target || fade) kick();
});
size();
