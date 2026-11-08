// A small window server: windows, the Dock, the menu bar, notifications and files.
// Apps register themselves here and build their own windows.

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
export const pick = (list) => list[Math.floor(Math.random() * list.length)];
export const between = (low, high) => low + Math.random() * (high - low);
export const esc = (text) => String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const clockTime = (date = new Date()) => date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

export const MENU_HEIGHT = 30;
const touch = matchMedia("(hover: none) and (pointer: coarse)").matches;

export const settings = {
  volume: 0.5, brightness: 1, dnd: false, dark: false, wifi: true, bluetooth: true, airdrop: false,
  network: "Northwind Guest", dockSize: 54, magnify: true, wallpaper: "coast",
};
export const WALLPAPERS = { glass: "Glass", coast: "Coast", swirl: "Swirl", bloom: "Bloom" };

const listeners = {};
export const on = (name, run) => (listeners[name] ||= []).push(run);
export const emit = (name, value) => (listeners[name] || []).forEach((run) => run(value));

/* ------------------------------------------------------------------ */
/* Apps                                                                */
/* ------------------------------------------------------------------ */

export const apps = {};
export const dockOrder = [];

export function registerApp(app) {
  apps[app.id] = { badge: 0, ...app };
  if (app.dock !== false) dockOrder.push(app.id);
}

export function iconHTML(id) {
  const app = apps[id];
  if (app.drawIcon) return app.drawIcon();
  return `<img class="icon" src="${app.icon}" alt="" draggable="false">`;
}

/* ------------------------------------------------------------------ */
/* Windows                                                             */
/* ------------------------------------------------------------------ */

export const LIGHTS = `<div class="lights">
  <button class="l-close" aria-label="Close" tabindex="-1"><svg viewBox="0 0 10 10"><path d="m2.5 2.5 5 5m0-5-5 5"/></svg></button>
  <button class="l-min" aria-label="Minimize" tabindex="-1"><svg viewBox="0 0 10 10"><path d="M2 5h6"/></svg></button>
  <button class="l-zoom" aria-label="Zoom" tabindex="-1"><svg viewBox="0 0 10 10"><path class="fill" d="M2.5 2.500h3.800L2.500 6.300zM7.500 7.500H3.700L7.500 3.700z"/></svg></button>
</div>`;

export const windows = [];
let topZ = 10;
let cascade = 0;
let activeWindow = null;

const workArea = () => ({
  left: 0, top: MENU_HEIGHT, right: innerWidth, bottom: innerHeight - (innerWidth < 720 ? 62 : settings.dockSize + 22),
});

function applyBox(win) {
  const { x, y, w, h } = win.box;
  Object.assign(win.el.style, { left: x + "px", top: y + "px", width: w + "px", height: h + "px" });
}

export function openWindow({ app, title = "", x, y, w = 560, h = 400, minW = 240, minH = 130, html = "", className = "", resizable = true, kind = "window", onClose }) {
  const el = document.createElement("section");
  el.className = `win ${className}`;
  el.innerHTML = html + (resizable ? ["n", "e", "s", "w", "ne", "nw", "se", "sw"].map((d) => `<i class="rz rz-${d}" data-rz="${d}"></i>`).join("") : "");

  const area = workArea();
  w = Math.min(w, innerWidth - 12);
  h = Math.min(h, area.bottom - area.top - 6);
  if (x === undefined) { x = 90 + (cascade % 7) * 28; y = MENU_HEIGHT + 24 + (cascade % 7) * 26; cascade += 1; }
  x = Math.round(Math.max(Math.min(x, innerWidth - w + 6), -6));
  y = Math.round(Math.max(Math.min(y, area.bottom - 60), MENU_HEIGHT + 2));

  const win = { el, app, title, kind, box: { x, y, w, h }, minW: Math.min(minW, innerWidth - 12), minH: Math.min(minH, area.bottom - area.top - 6), zoomedFrom: null, minimized: false, onClose };
  el.win = win;
  applyBox(win);
  $("#windows").append(el);
  windows.push(win);
  focusWindow(win);
  renderDock();
  return win;
}

export function focusWindow(win) {
  if (win.minimized) restore(win);
  win.el.style.zIndex = ++topZ;
  if (activeWindow === win) return;
  if (activeWindow) activeWindow.el.classList.remove("active");
  activeWindow = win;
  win.el.classList.add("active");
  setFrontApp(win.app);
}

export const frontWindow = () => activeWindow;

// Nothing is frontmost, so the Dock icon and menu bar fall back to the next window.
function focusNext() {
  activeWindow = null;
  const next = windows.filter((w) => !w.minimized).sort((a, b) => b.el.style.zIndex - a.el.style.zIndex)[0];
  if (next) focusWindow(next);
  else setFrontApp("files");
}

export function closeWindow(win) {
  if (!windows.includes(win)) return;
  windows.splice(windows.indexOf(win), 1);
  win.onClose?.();
  const out = win.el.animate(
    [{ opacity: 1, transform: "scale(1)" }, { opacity: 0, transform: "scale(.96)" }],
    { duration: 130, easing: "ease-in", fill: "forwards" },
  );
  out.onfinish = () => win.el.remove();
  if (activeWindow === win) focusNext();
  renderDock();
}

function dockTarget(win) {
  const cell = $(`#dock .cell[data-app="${win.app}"]`);
  return cell ? cell.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight, width: 40, height: 40 };
}

function genie(win) {
  const box = win.el.getBoundingClientRect();
  const to = dockTarget(win);
  return {
    transform: `translate(${to.left + to.width / 2 - (box.left + box.width / 2)}px, ${to.top + to.height / 2 - (box.top + box.height / 2)}px) scale(${Math.max(0.05, to.width / box.width)})`,
    opacity: 0,
  };
}

export function minimize(win) {
  if (win.minimized) return;
  win.minimized = true;
  const out = win.el.animate(
    [{ transform: "none", opacity: 1 }, genie(win)],
    { duration: 300, easing: "cubic-bezier(.5, 0, .75, .4)" },
  );
  out.onfinish = () => { win.el.style.display = "none"; };
  if (activeWindow === win) focusNext();
}

export function restore(win) {
  if (!win.minimized) return;
  win.minimized = false;
  win.el.style.display = "";
  win.el.animate([genie(win), { transform: "none", opacity: 1 }], { duration: 300, easing: "cubic-bezier(.2, .7, .3, 1)" });
}

function animateBox(win) {
  win.el.classList.add("moving");
  applyBox(win);
  setTimeout(() => { win.el.classList.remove("moving"); emit("resize", win); }, 260);
}

export function zoom(win) {
  if (win.zoomedFrom) {
    win.box = win.zoomedFrom;
    win.zoomedFrom = null;
    win.el.classList.remove("zoomed");
  } else {
    win.zoomedFrom = { ...win.box };
    const area = workArea();
    win.box = { x: 0, y: area.top, w: area.right, h: area.bottom - area.top };
    win.el.classList.add("zoomed");
  }
  animateBox(win);
}

const INTERACTIVE = "button, input, textarea, select, a, label, [contenteditable], .no-drag";

function setUpWindowEvents() {
  const host = $("#windows");

  host.addEventListener("pointerdown", (event) => {
    const el = event.target.closest(".win");
    if (!el) return;
    const win = el.win;
    focusWindow(win);

    const light = event.target.closest(".lights button");
    if (light) return;

    const handle = event.target.closest("[data-rz]");
    if (handle) return startResize(win, handle.dataset.rz, event);

    const dragger = event.target.closest("[data-drag]");
    if (dragger && !event.target.closest(INTERACTIVE)) startMove(win, event);
  });

  host.addEventListener("click", (event) => {
    const light = event.target.closest(".lights button");
    if (!light) return;
    const win = light.closest(".win").win;
    if (light.classList.contains("l-close")) closeWindow(win);
    if (light.classList.contains("l-min")) minimize(win);
    if (light.classList.contains("l-zoom")) zoom(win);
  });

  host.addEventListener("dblclick", (event) => {
    const dragger = event.target.closest("[data-drag]");
    if (dragger && !event.target.closest(INTERACTIVE) && !event.target.closest(".alert")) zoom(event.target.closest(".win").win);
  });
}

function track(event, move, done) {
  const up = () => {
    removeEventListener("pointermove", move);
    removeEventListener("pointerup", up);
    removeEventListener("pointercancel", up);
    document.body.classList.remove("dragging");
    done?.();
  };
  document.body.classList.add("dragging");
  addEventListener("pointermove", move);
  addEventListener("pointerup", up);
  addEventListener("pointercancel", up);
}

function startMove(win, event) {
  const start = { px: event.clientX, py: event.clientY, x: win.box.x, y: win.box.y };
  track(event, (e) => {
    if (win.zoomedFrom && Math.abs(e.clientY - start.py) + Math.abs(e.clientX - start.px) > 6) {
      // Dragging a zoomed window pops it back to its own size, under the pointer.
      win.box.w = win.zoomedFrom.w; win.box.h = win.zoomedFrom.h;
      win.zoomedFrom = null;
      win.el.classList.remove("zoomed");
      start.x = e.clientX - win.box.w / 2;
      start.px = e.clientX;
    }
    win.box.x = start.x + e.clientX - start.px;
    win.box.y = Math.max(MENU_HEIGHT, start.y + e.clientY - start.py);
    applyBox(win);
  });
}

function startResize(win, dir, event) {
  const s = { px: event.clientX, py: event.clientY, ...win.box };
  win.zoomedFrom = null;
  win.el.classList.remove("zoomed");
  track(event, (e) => {
    const dx = e.clientX - s.px;
    const dy = e.clientY - s.py;
    const box = win.box;
    if (dir.includes("e")) box.w = Math.max(win.minW, s.w + dx);
    if (dir.includes("s")) box.h = Math.max(win.minH, s.h + dy);
    if (dir.includes("w")) { box.w = Math.max(win.minW, s.w - dx); box.x = s.x + s.w - box.w; }
    if (dir.includes("n")) { box.h = Math.max(win.minH, s.h - dy); box.y = Math.max(MENU_HEIGHT, s.y + s.h - box.h); }
    applyBox(win);
    emit("resize", win);
  });
}

/* ------------------------------------------------------------------ */
/* Launching                                                           */
/* ------------------------------------------------------------------ */

export function launch(id, options) {
  const app = apps[id];
  if (!app) return;
  if (app.activate) return app.activate(options);
  const own = windows.filter((w) => w.app === id && w.kind === "window");
  if (options || !own.length) {
    if (!own.length) bounce(id);
    return app.open(options);
  }
  const hidden = own.find((w) => w.minimized);
  if (hidden) return focusWindow(hidden);
  const sorted = own.sort((a, b) => b.el.style.zIndex - a.el.style.zIndex);
  // Clicking the icon of the app in front moves on to its next window.
  focusWindow(sorted[0] === activeWindow && sorted.length > 1 ? sorted[sorted.length - 1] : sorted[0]);
}

export function quit(id) {
  windows.filter((w) => w.app === id).forEach(closeWindow);
  emit("quit", id);
  running.delete(id);
  renderDock();
}

export const running = new Set();

/* ------------------------------------------------------------------ */
/* Dock                                                                */
/* ------------------------------------------------------------------ */

export function setBadge(id, count) {
  apps[id].badge = count;
  const cell = $(`#dock .cell[data-app="${id}"] s`);
  if (!cell) return renderDock();
  cell.textContent = count > 999 ? "999+" : count;
  cell.style.display = count ? "" : "none";
}
export const addBadge = (id, by = 1) => setBadge(id, apps[id].badge + by);

export function bounce(id) {
  const cell = $(`#dock .cell[data-app="${id}"] .lift`);
  if (!cell || cell.getAnimations().length) return;
  cell.animate(
    [0, 1, 0, 0.55, 0, 0.25, 0].map((v) => ({ transform: `translateY(${-30 * v}px)` })),
    { duration: 1100, easing: "cubic-bezier(.3, 0, .4, 1)" },
  );
}

let dockBuilt = "";

export function renderDock() {
  windows.forEach((w) => running.add(w.app));
  const dock = $("#dock");
  const main = dockOrder.filter((id) => !apps[id].dockEnd);
  const end = dockOrder.filter((id) => apps[id].dockEnd);
  const signature = dockOrder.join();
  const cell = (id) => `<div class="cell" data-app="${id}" role="button" tabindex="0" aria-label="${esc(apps[id].name)}">
      <span class="tip">${esc(apps[id].name)}</span><div class="lift">${iconHTML(id)}<s style="${apps[id].badge ? "" : "display:none"}">${apps[id].badge}</s></div></div>`;
  if (dockBuilt !== signature) {
    dock.innerHTML = main.map(cell).join("") + `<div class="sep"></div>` + end.map(cell).join("");
    dockBuilt = signature;
    sizeDock();
  }
  $$(".cell", dock).forEach((el) => {
    const id = el.dataset.app;
    el.classList.toggle("running", running.has(id) || apps[id].alwaysRunning === true);
    if (apps[id].drawIcon && apps[id].liveIcon) el.querySelector(".icon, .a-cal").outerHTML = apps[id].drawIcon();
  });
}

function dockBaseSize() {
  const count = dockOrder.length + 1;
  return Math.min(settings.dockSize, Math.floor((innerWidth - 40) / count) - 5);
}

export function sizeDock() {
  const base = dockBaseSize();
  const dock = $("#dock");
  dock.style.setProperty("--icon", base + "px");
  $$(".cell", dock).forEach((el) => { el.style.width = el.style.height = base + "px"; el.querySelector(".lift").style.transform = ""; });
}

function setUpDock() {
  const dock = $("#dock");

  // The real thing: icons swell toward the pointer on a smooth curve.
  if (!touch) {
    dock.addEventListener("pointermove", (event) => {
      if (!settings.magnify) return;
      const base = dockBaseSize();
      const peak = base * 0.55;
      $$(".cell", dock).forEach((el) => {
        const box = el.getBoundingClientRect();
        const distance = Math.abs(event.clientX - (box.left + box.width / 2));
        const size = base + peak * Math.max(0, Math.cos(Math.min(distance / (base * 3), 1) * (Math.PI / 2))) ** 2;
        el.querySelector(".lift").style.transform = `scale(${size / base})`;
      });
    });
    dock.addEventListener("pointerleave", () => {
      dock.classList.add("settling");
      sizeDock();
      setTimeout(() => dock.classList.remove("settling"), 180);
    });
  }

  dock.addEventListener("keydown", e => { if(e.key === "Enter" || e.key === " ") { e.preventDefault(); const cell=e.target.closest(".cell"); if(cell) launch(cell.dataset.app); } });
  dock.addEventListener("click", (event) => {
    const cell = event.target.closest(".cell");
    if (cell) launch(cell.dataset.app);
  });

  dock.addEventListener("contextmenu", (event) => {
    const cell = event.target.closest(".cell");
    if (!cell) return;
    event.preventDefault();
    event.stopPropagation();
    const id = cell.dataset.app;
    const open = windows.filter((w) => w.app === id && w.kind === "window");
    const items = open.map((w) => ({ label: w.title || apps[id].name, checked: w === activeWindow, action: () => focusWindow(w) }));
    if (items.length) items.push({ sep: true });
    if (apps[id].dockMenu) items.push(...apps[id].dockMenu(), { sep: true });
    items.push(running.has(id) ? { label: "Show All Windows", action: () => open.forEach(focusWindow) } : { label: "Open", action: () => launch(id) });
    if (running.has(id) && apps[id].dockEnd !== true) items.push({ label: "Quit", action: () => quit(id) });
    const box = cell.getBoundingClientRect();
    const menu = showMenu(items, box.left, box.top);
    menu.style.top = box.top - menu.offsetHeight - 8 + "px";
  });

  addEventListener("resize", sizeDock);
}

/* ------------------------------------------------------------------ */
/* Menus and popovers                                                  */
/* ------------------------------------------------------------------ */

let popup = null;

export function closePopup() {
  popup?.remove();
  popup = null;
  $$("#menubar .open").forEach((el) => el.classList.remove("open"));
}

function place(el, x, y) {
  const gap = 6;
  el.style.left = Math.max(gap, Math.min(x, innerWidth - el.offsetWidth - gap)) + "px";
  el.style.top = Math.max(MENU_HEIGHT, Math.min(y, innerHeight - el.offsetHeight - gap)) + "px";
}

export function showMenu(items, x, y) {
  closePopup();
  const el = document.createElement("div");
  el.className = "menu";
  el.innerHTML = items.map((item, i) => item.sep
    ? `<hr>`
    : `<button data-i="${i}" ${item.disabled ? "disabled" : ""}><i>${item.checked ? "✓" : ""}</i><span>${esc(item.label)}</span><kbd>${item.keys || ""}</kbd></button>`).join("");
  el.addEventListener("click", (event) => {
    const row = event.target.closest("button");
    if (!row) return;
    const item = items[row.dataset.i];
    closePopup();
    item.action?.();
  });
  $("#desktop").append(el);
  place(el, x, y);
  popup = el;
  return el;
}

export function showPanel(html, x, y, className = "") {
  closePopup();
  const el = document.createElement("div");
  el.className = `panel ${className}`;
  el.innerHTML = html;
  $("#desktop").append(el);
  place(el, x, y);
  popup = el;
  return el;
}

/* ------------------------------------------------------------------ */
/* Menu bar                                                            */
/* ------------------------------------------------------------------ */

let frontApp = "files";

function editItems() {
  const run = (command) => () => { document.execCommand(command); };
  return [
    { label: "Undo", keys: "⌘Z", action: run("undo") },
    { label: "Redo", keys: "⇧⌘Z", action: run("redo") },
    { sep: true },
    { label: "Cut", keys: "⌘X", action: run("cut") },
    { label: "Copy", keys: "⌘C", action: run("copy") },
    { label: "Paste", keys: "⌘V", action: () => navigator.clipboard?.readText().then((text) => document.execCommand("insertText", false, text)).catch(() => {}) },
    { label: "Select All", keys: "⌘A", action: run("selectAll") },
  ];
}

function menusFor(id) {
  const app = apps[id];
  const win = activeWindow;
  const own = windows.filter((w) => w.app === id && w.kind === "window");
  return [
    [app.name, [
      { label: `About ${app.name}`, action: () => aboutWindow(id) },
      { sep: true },
      { label: "Settings…", keys: "⌘,", action: () => launch("settings") },
      { sep: true },
      { label: `Hide ${app.name}`, keys: "⌘H", action: () => own.forEach(minimize), disabled: id === "files" },
      { label: `Quit ${app.name}`, keys: "⌘Q", action: () => quit(id), disabled: id === "files" },
    ]],
    ["File", [
      { label: "New Window", keys: "⌘N", action: () => launch(id, { fresh: true }) },
      ...(app.fileMenu ? app.fileMenu() : []),
      { sep: true },
      { label: "Close Window", keys: "⌘W", action: () => win && closeWindow(win), disabled: !win },
    ]],
    ["Edit", editItems()],
    ["View", [
      ...(app.viewMenu ? [...app.viewMenu(), { sep: true }] : []),
      { label: win?.zoomedFrom ? "Exit Full Screen" : "Enter Full Screen", keys: "⌃⌘F", action: () => win && zoom(win), disabled: !win },
    ]],
    ...(app.extraMenus ? app.extraMenus() : []),
    ["Window", [
      { label: "Minimize", keys: "⌘M", action: () => win && minimize(win), disabled: !win },
      { label: "Zoom", action: () => win && zoom(win), disabled: !win },
      { sep: true },
      { label: "Bring All to Front", action: () => own.forEach(focusWindow), disabled: !own.length },
      ...(own.length ? [{ sep: true }] : []),
      ...own.map((w) => ({ label: w.title || app.name, checked: w === win, action: () => focusWindow(w) })),
    ]],
    ["Help", [
      { label: `${app.name} Help`, action: () => launch("web", { url: `search?q=${encodeURIComponent(app.name + " help")}` }) },
    ]],
  ];
}

export function setFrontApp(id) {
  frontApp = id;
  renderMenus();
  if (apps[id]?.badge && apps[id].clearsBadge !== false) setBadge(id, 0);
}

function renderMenus() {
  const left = $("#menu-left");
  if (!apps[frontApp]) return;
  const menus = menusFor(frontApp);
  left.innerHTML = menus.map(([label], i) => `<button class="mb-item ${i === 0 ? "app-name" : ""}" data-i="${i}" tabindex="-1">${esc(label)}</button>`).join("");
}

function setUpMenuBar() {
  const left = $("#menu-left");
  const openMenu = (button) => {
    // Menus are rebuilt each time, so they always reflect the windows open now.
    const items = menusFor(frontApp)[button.dataset.i][1];
    const box = button.getBoundingClientRect();
    showMenu(items, box.left - 4, MENU_HEIGHT);
    button.classList.add("open");
  };
  left.addEventListener("pointerdown", (event) => {
    const button = event.target.closest(".mb-item");
    if (!button) return;
    if (button.classList.contains("open")) closePopup();
    else openMenu(button);
  });
  left.addEventListener("pointerover", (event) => {
    const button = event.target.closest(".mb-item");
    if (button && popup && !button.classList.contains("open") && $("#menubar .open")) openMenu(button);
  });

  document.addEventListener("pointerdown", (event) => {
    if (popup && !popup.contains(event.target) && !event.target.closest("#menubar")) closePopup();
  }, true);
  addEventListener("keydown", (event) => { if (event.key === "Escape") { closePopup(); hideSpotlight(); } });
}

function aboutWindow(id) {
  const app = apps[id];
  const win = openWindow({
    app: id, title: `About ${app.name}`, w: 280, h: 250, resizable: false, kind: "about", className: "about",
    html: `<div class="bar" data-drag>${LIGHTS}</div><div class="about-body" data-drag>${iconHTML(id)}<b>${esc(app.name)}</b><small>Version ${Math.floor(between(2, 26))}.${Math.floor(between(0, 9))}.${Math.floor(between(0, 9))}</small></div>`,
  });
  return win;
}

/* ------------------------------------------------------------------ */
/* Notifications                                                       */
/* ------------------------------------------------------------------ */

export const notifications = [];

export function notify({ app, title, text, open, quietIfFront = true }) {
  const entry = { app, title, text, open, at: new Date() };
  notifications.unshift(entry);
  notifications.length = Math.min(notifications.length, 40);
  if (settings.dnd) return;
  if (quietIfFront && activeWindow?.app === app) return;

  const toasts = $("#toasts");
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerHTML = `<button class="toast-x" aria-label="Dismiss" tabindex="-1">×</button>${iconHTML(app)}<div><b>${esc(title)}<time>now</time></b><span>${esc(text)}</span></div>`;
  const dismiss = () => {
    toast.classList.add("leaving");
    setTimeout(() => toast.remove(), 220);
  };
  let timer = setTimeout(dismiss, 6500);
  toast.addEventListener("pointerenter", () => clearTimeout(timer));
  toast.addEventListener("pointerleave", () => { timer = setTimeout(dismiss, 2500); });
  toast.addEventListener("click", (event) => {
    dismiss();
    if (event.target.closest(".toast-x")) return;
    open ? open() : launch(app);
  });
  toasts.prepend(toast);
  while (toasts.children.length > 4) toasts.lastChild.remove();
}

/* ------------------------------------------------------------------ */
/* Files                                                               */
/* ------------------------------------------------------------------ */

let nextFile = 1;
export const file = (name, kind, extra = {}) => ({ id: nextFile++, name, kind, ...extra });
const stamp = (daysAgo, h, m) => {
  const date = new Date(Date.now() - daysAgo * 864e5);
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} at ${h}.${pad(m)}.14 PM`;
};

export const fs = {
  Desktop: {
    name: "Desktop", kind: "folder", items: [
      file(`Screenshot ${stamp(3, 4, 12)}.png`, "image", { src: "assets/video-still.jpg" }),
      file("Untitled Folder", "folder", { items: [] }),
      file("Q4 plan FINAL v7.pdf", "doc", { text: "Q4 plan\n\nOwner: TBD\nStatus: Waiting on finance\n\n1. Ship the thing\n2. Decide who owns the thing\n3. Revisit in January" }),
      file(`Screenshot ${stamp(2, 11, 48)}.png`, "image", { src: "assets/wallpaper-coast.jpg" }),
      file("taxes 2025", "folder", { items: [file("1099-INT.pdf", "doc", { text: "Form 1099-INT\n\nInterest income: see attached." }), file("receipts.txt", "doc", { text: "uber 18.40\nlunch w/ dana 42.10\nmonitor arm 89.00\n???" })] }),
      file("Untitled Folder 2", "folder", { items: [] }),
      file(`Screenshot ${stamp(1, 2, 3)}.png`, "image", { src: "assets/wallpaper-glass.jpg" }),
      file("board deck draft.key", "doc", { text: "Board deck\n\nSlide 1: Where we are\nSlide 2: Where we said we'd be\nSlide 3: Why those are different" }),
      file("Old Downloads", "folder", { items: [file("installer (3).dmg", "doc", { text: "Disk image" }), file("invoice_0412.pdf", "doc", { text: "Invoice 0412\nAmount due: $1,240.00" })] }),
    ],
  },
  Documents: {
    name: "Documents", kind: "folder", items: [
      file("Meeting notes", "folder", { items: [file("Monday sync.txt", "doc", { text: "Attendees: everyone\nDecisions: none\nNext steps: another meeting" })] }),
      file("Resume 2026.pdf", "doc", { text: "Experience\n\nSenior Everything, Northwind\n2021 to present" }),
      file("Lease.pdf", "doc", { text: "Residential lease agreement\n\nTerm: 12 months" }),
      file("ideas.txt", "doc", { text: "- that app idea from the shower\n- learn piano\n- call the dentist" }),
    ],
  },
  Downloads: {
    name: "Downloads", kind: "folder", items: [
      file("brand-assets-v3.zip", "doc", { text: "Archive" }),
      file("IMG_4021.jpg", "image", { src: "assets/wallpaper-coast.jpg" }),
      file("flight-itinerary.pdf", "doc", { text: "SFO to JFK\nConfirmation: KX7T2Q\nSeat 22B" }),
    ],
  },
  Trash: { name: "Trash", kind: "folder", items: [] },
};

export function moveToTrash(item, from) {
  from.items.splice(from.items.indexOf(item), 1);
  fs.Trash.items.push(item);
  renderDesktop();
  emit("files");
}

export function openItem(item) {
  if (item.kind === "folder") return launch("files", { folder: item });
  if (item.kind === "image") return launch("preview", { item });
  return launch("textedit", { item });
}

export function fileIcon(item) {
  if (item.kind === "folder") return `<i class="ficon folder"><img src="assets/folder.png" alt="" draggable="false"></i>`;
  if (item.kind === "image") return `<i class="ficon shot" style="background-image:url('${item.src}')"></i>`;
  const ext = item.name.split(".").pop().toUpperCase().slice(0, 4);
  return `<i class="ficon page"><em>${esc(ext)}</em></i>`;
}

/* ------------------------------------------------------------------ */
/* Desktop                                                             */
/* ------------------------------------------------------------------ */

const CELL_W = 96;
const CELL_H = 96;

function layoutDesktopItem(item, index) {
  const perColumn = Math.max(1, Math.floor((innerHeight - MENU_HEIGHT - 110) / CELL_H));
  const column = Math.floor(index / perColumn);
  item.x = innerWidth - 104 - column * CELL_W;
  item.y = MENU_HEIGHT + 14 + (index % perColumn) * CELL_H;
}

export function renderDesktop() {
  const host = $("#files");
  host.innerHTML = fs.Desktop.items.map((item, i) => {
    if (item.x === undefined) layoutDesktopItem(item, i);
    return `<div class="file ${item.selected ? "on" : ""}" data-id="${item.id}" style="left:${item.x}px;top:${item.y}px">${fileIcon(item)}<label>${esc(item.name)}</label></div>`;
  }).join("");
}

function renameDesktopItem(item) {
  const label = $(`#files .file[data-id="${item.id}"] label`);
  if (!label) return;
  const input = document.createElement("input");
  input.value = item.name;
  input.className = "rename";
  label.replaceWith(input);
  input.focus();
  input.select();
  const done = () => { item.name = input.value.trim() || item.name; renderDesktop(); emit("files"); };
  input.addEventListener("blur", done);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") input.blur(); e.stopPropagation(); });
}

export function newFolder(parent) {
  let name = "Untitled Folder";
  let n = 2;
  while (parent.items.some((i) => i.name === name)) name = `Untitled Folder ${n++}`;
  const item = file(name, "folder", { items: [] });
  parent.items.push(item);
  renderDesktop();
  emit("files");
  return item;
}

function setUpDesktop() {
  const host = $("#files");
  const selected = () => fs.Desktop.items.filter((i) => i.selected);
  const clear = () => fs.Desktop.items.forEach((i) => { i.selected = false; });
  const findItem = (el) => fs.Desktop.items.find((i) => i.id === Number(el.dataset.id));

  // Files sit under the windows, so the background is what receives these.
  const background = $("#desktop");
  background.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    const tile = event.target.closest(".file");
    if (tile) {
      const item = findItem(tile);
      if (!item.selected && !event.shiftKey && !event.metaKey) clear();
      item.selected = true;
      renderDesktop();
      const moving = selected().map((i) => ({ i, x: i.x, y: i.y }));
      const start = { x: event.clientX, y: event.clientY };
      track(event, (e) => {
        const trash = $(`#dock .cell[data-app="trash"]`);
        moving.forEach((m) => {
          m.i.x = m.x + e.clientX - start.x;
          m.i.y = Math.max(MENU_HEIGHT, m.y + e.clientY - start.y);
          const el = $(`#files .file[data-id="${m.i.id}"]`);
          if (el) { el.style.left = m.i.x + "px"; el.style.top = m.i.y + "px"; }
        });
        if (trash) {
          const box = trash.getBoundingClientRect();
          trash.classList.toggle("drop", e.clientX > box.left && e.clientX < box.right && e.clientY > box.top - 10);
        }
      }, () => {
        const trash = $(`#dock .cell[data-app="trash"]`);
        if (trash?.classList.contains("drop")) {
          trash.classList.remove("drop");
          moving.forEach((m) => moveToTrash(m.i, fs.Desktop));
        }
      });
      return;
    }
    if (event.target !== background && event.target !== host && event.target.id !== "windows") return;
    if (document.activeElement?.blur) document.activeElement.blur();
    clear();
    renderDesktop();

    // Marquee selection
    const band = document.createElement("div");
    band.className = "marquee";
    background.append(band);
    const start = { x: event.clientX, y: event.clientY };
    track(event, (e) => {
      const box = { l: Math.min(start.x, e.clientX), t: Math.min(start.y, e.clientY), r: Math.max(start.x, e.clientX), b: Math.max(start.y, e.clientY) };
      Object.assign(band.style, { left: box.l + "px", top: box.t + "px", width: box.r - box.l + "px", height: box.b - box.t + "px" });
      $$(".file", host).forEach((el) => {
        const r = el.getBoundingClientRect();
        const hit = r.left < box.r && r.right > box.l && r.top < box.b && r.bottom > box.t;
        el.classList.toggle("on", hit);
        findItem(el).selected = hit;
      });
    }, () => band.remove());
  });

  host.addEventListener("dblclick", (event) => {
    const tile = event.target.closest(".file");
    if (tile) openItem(findItem(tile));
  });

  background.addEventListener("contextmenu", (event) => {
    if (event.target.closest("input, textarea, [contenteditable], .win, #hero")) return;
    event.preventDefault();
    const tile = event.target.closest(".file");
    if (tile) {
      const item = findItem(tile);
      clear();
      item.selected = true;
      renderDesktop();
      showMenu([
        { label: "Open", action: () => openItem(item) },
        { sep: true },
        { label: "Move to Trash", keys: "⌘⌫", action: () => moveToTrash(item, fs.Desktop) },
        { sep: true },
        { label: "Rename", action: () => renameDesktopItem(item) },
      ], event.clientX, event.clientY);
      return;
    }
    showMenu([
      { label: "New Folder", keys: "⇧⌘N", action: () => { const item = newFolder(fs.Desktop); renameDesktopItem(item); } },
      { sep: true },
      { label: "Change Wallpaper…", action: () => launch("settings", { section: "wallpaper" }) },
      { sep: true },
      { label: "Clean Up", action: () => { fs.Desktop.items.forEach((i, n) => layoutDesktopItem(i, n)); renderDesktop(); } },
      { label: "Sort By Name", action: () => { fs.Desktop.items.sort((a, b) => a.name.localeCompare(b.name)); fs.Desktop.items.forEach((i, n) => layoutDesktopItem(i, n)); renderDesktop(); } },
    ], event.clientX, event.clientY);
  });

  addEventListener("keydown", (event) => {
    if (event.target.closest("input, textarea, [contenteditable]")) return;
    if (event.key === "Backspace" && selected().length) selected().forEach((i) => moveToTrash(i, fs.Desktop));
    if (event.key === "Enter" && selected().length === 1) renameDesktopItem(selected()[0]);
  });

  addEventListener("resize", () => {
    fs.Desktop.items.forEach((i) => { i.x = Math.min(i.x, innerWidth - 90); i.y = Math.min(i.y, innerHeight - 90); });
    renderDesktop();
  });
}

/* ------------------------------------------------------------------ */
/* Status menus                                                        */
/* ------------------------------------------------------------------ */

function rightAligned(button, width) {
  const box = button.getBoundingClientRect();
  return Math.min(box.right - 40, innerWidth - width - 8);
}

function toggleStatus(button, build) {
  const wasOpen = button.classList.contains("open");
  closePopup();
  if (wasOpen) return;
  build();
  button.classList.add("open");
}

function setUpStatus() {
  const battery = $(".s-bat");
  battery.addEventListener("click", () => toggleStatus(battery, () => {
    showPanel(`<h5>Battery <span>18%</span></h5><p class="dim">Power Source: Battery</p><p class="dim">About 1 hr 10 min remaining</p><hr><button class="row" data-open>Battery Settings…</button>`, rightAligned(battery, 240), MENU_HEIGHT);
    $(".panel [data-open]").addEventListener("click", () => { closePopup(); launch("settings", { section: "general" }); });
  }));

  const wifi = $(".s-wifi");
  const NETWORKS = ["Northwind Guest", "Northwind-5G", "xfinitywifi", "Linksys00421", "Pretty Fly"];
  const buildWifi = () => {
    const panel = showPanel(`<h5>Wi-Fi <label class="sw"><input type="checkbox" ${settings.wifi ? "checked" : ""}><i></i></label></h5><hr>
      ${settings.wifi ? NETWORKS.map((n) => `<button class="row net" data-n="${esc(n)}"><i>${settings.network === n ? "✓" : ""}</i>${esc(n)}</button>`).join("") : `<p class="dim">Wi-Fi is off</p>`}
      <hr><button class="row" data-open>Wi-Fi Settings…</button>`, rightAligned(wifi, 240), MENU_HEIGHT);
    wifi.classList.add("open");
    $("input", panel).addEventListener("change", (e) => { settings.wifi = e.target.checked; wifi.classList.toggle("off", !settings.wifi); buildWifi(); });
    $$(".net", panel).forEach((b) => b.addEventListener("click", () => { settings.network = b.dataset.n; buildWifi(); }));
    $("[data-open]", panel).addEventListener("click", () => { closePopup(); launch("settings", { section: "wifi" }); });
  };
  wifi.addEventListener("click", () => toggleStatus(wifi, buildWifi));

  const cc = $(".s-cc");
  cc.addEventListener("click", () => toggleStatus(cc, () => {
    const panel = showPanel(`
      <div class="cc-grid">
        <div class="cc-box cc-net">
          <button data-key="wifi"><i></i><span>Wi-Fi<small></small></span></button>
          <button data-key="bluetooth"><i></i><span>Bluetooth<small></small></span></button>
          <button data-key="airdrop"><i></i><span>AirDrop<small></small></span></button>
        </div>
        <button class="cc-box cc-focus" data-key="dnd"><i></i><span>Do Not Disturb<small></small></span></button>
        <div class="cc-box cc-play"><b data-now></b><small data-artist></small><div><button data-prev aria-label="Previous">⏮</button><button data-play aria-label="Play"></button><button data-next aria-label="Next">⏭</button></div></div>
      </div>
      <div class="cc-box cc-slider"><b>Display</b><input type="range" min="30" max="100" value="${settings.brightness * 100}" data-bright></div>
      <div class="cc-box cc-slider"><b>Sound</b><input type="range" min="0" max="100" value="${settings.volume * 100}" data-vol></div>`,
      rightAligned(cc, 320), MENU_HEIGHT + 2, "cc");
    const refresh = () => {
      $$("[data-key]", panel).forEach((button) => {
        const value = settings[button.dataset.key];
        button.classList.toggle("lit", value);
        const note = button.querySelector("small");
        if (button.dataset.key === "wifi") note.textContent = value ? settings.network : "Off";
        else note.textContent = value ? "On" : "Off";
      });
      const music = apps.music?.state;
      if (music) {
        $("[data-now]", panel).textContent = music.track.title;
        $("[data-artist]", panel).textContent = music.track.artist;
        $("[data-play]", panel).textContent = music.playing ? "⏸" : "▶";
      }
    };
    refresh();
    $$("[data-key]", panel).forEach((button) => button.addEventListener("click", () => {
      const key = button.dataset.key;
      settings[key] = !settings[key];
      if (key === "wifi") $(".s-wifi").classList.toggle("off", !settings.wifi);
      emit("settings");
      refresh();
    }));
    $("[data-bright]", panel).addEventListener("input", (e) => setBrightness(e.target.value / 100));
    $("[data-vol]", panel).addEventListener("input", (e) => { settings.volume = e.target.value / 100; emit("volume"); });
    $("[data-play]", panel).addEventListener("click", () => { apps.music.toggle(); refresh(); });
    $("[data-prev]", panel).addEventListener("click", () => { apps.music.skip(-1); refresh(); });
    $("[data-next]", panel).addEventListener("click", () => { apps.music.skip(1); refresh(); });
  }));

  const clock = $("#clock");
  clock.addEventListener("click", () => {
    const center = $("#center");
    const open = center.classList.toggle("open");
    if (open) renderCenter();
  });
  $("#center").addEventListener("click", (event) => {
    if (event.target.closest("[data-clear]")) { notifications.length = 0; renderCenter(); return; }
    const row = event.target.closest("[data-n]");
    if (row) {
      const entry = notifications[row.dataset.n];
      $("#center").classList.remove("open");
      entry.open ? entry.open() : launch(entry.app);
    }
  });
  document.addEventListener("pointerdown", (event) => {
    if (!event.target.closest("#center, #clock")) $("#center").classList.remove("open");
  }, true);

  $(".s-search").addEventListener("click", showSpotlight);
}

function renderCenter() {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
  const count = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const blanks = Array.from({ length: first }, () => "<u></u>").join("");
  const days = Array.from({ length: count }, (_, i) => `<u class="${i + 1 === now.getDate() ? "today" : ""}">${i + 1}</u>`).join("");
  $("#center").innerHTML = `
    <div class="widget mini-cal"><b>${now.toLocaleDateString([], { month: "long" })}</b><div>${["S", "M", "T", "W", "T", "F", "S"].map((d) => `<em>${d}</em>`).join("")}${blanks}${days}</div></div>
    <div class="center-head"><b>Notifications</b>${notifications.length ? `<button data-clear>Clear All</button>` : ""}</div>
    ${notifications.length ? notifications.map((n, i) => `<button class="toast" data-n="${i}">${iconHTML(n.app)}<div><b>${esc(n.title)}<time>${clockTime(n.at)}</time></b><span>${esc(n.text)}</span></div></button>`).join("") : `<p class="none">No Notifications</p>`}`;
}

export function setBrightness(value) {
  settings.brightness = value;
  $("#dim").style.opacity = 1 - value;
}

export function setWallpaper(name) {
  settings.wallpaper = name;
  $("#desktop").style.backgroundImage = `url("assets/wallpaper-${name}.jpg")`;
}

export function setDark(value) {
  settings.dark = value;
  $("#desktop").classList.toggle("dark", value);
}

/* ------------------------------------------------------------------ */
/* Spotlight                                                           */
/* ------------------------------------------------------------------ */

function hideSpotlight() {
  $("#spotlight").classList.remove("open");
}

function allFiles() {
  const found = [];
  const walk = (folder) => folder.items.forEach((item) => { found.push(item); if (item.items) walk(item); });
  ["Desktop", "Documents", "Downloads"].forEach((root) => walk(fs[root]));
  return found;
}

function showSpotlight() {
  closePopup();
  const box = $("#spotlight");
  box.classList.add("open");
  box.innerHTML = `<div class="sl-field"><svg viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="6.300" cy="6.300" r="4.800"/><path d="m10 10 4 4"/></svg><input placeholder="Spotlight Search" aria-label="Spotlight Search" spellcheck="false" autocomplete="off"></div><div class="sl-list"></div>`;
  const input = $("input", box);
  const list = $(".sl-list", box);
  let results = [];
  let cursor = 0;
  const draw = () => {
    list.innerHTML = results.map((r, i) => `<button class="${i === cursor ? "on" : ""}" data-i="${i}">${r.icon}<span>${esc(r.label)}</span><small>${r.kind}</small></button>`).join("");
  };
  input.addEventListener("input", () => {
    const query = input.value.trim().toLowerCase();
    cursor = 0;
    if (!query) { results = []; return draw(); }
    const fromApps = Object.values(apps).filter((a) => a.dock !== false && a.name.toLowerCase().includes(query))
      .map((a) => ({ icon: iconHTML(a.id), label: a.name, kind: "Application", run: () => launch(a.id) }));
    const fromFiles = allFiles().filter((i) => i.name.toLowerCase().includes(query))
      .map((i) => ({ icon: fileIcon(i), label: i.name, kind: i.kind === "folder" ? "Folder" : "Document", run: () => openItem(i) }));
    results = [...fromApps, ...fromFiles, { icon: iconHTML("web"), label: `Search the web for "${input.value}"`, kind: "Browser", run: () => launch("web", { url: `search?q=${encodeURIComponent(input.value)}` }) }].slice(0, 7);
    draw();
  });
  input.addEventListener("keydown", (event) => {
    event.stopPropagation();
    if (event.key === "Escape") hideSpotlight();
    if (event.key === "ArrowDown") { cursor = Math.min(results.length - 1, cursor + 1); draw(); event.preventDefault(); }
    if (event.key === "ArrowUp") { cursor = Math.max(0, cursor - 1); draw(); event.preventDefault(); }
    if (event.key === "Enter" && results[cursor]) { hideSpotlight(); results[cursor].run(); }
  });
  list.addEventListener("click", (event) => {
    const row = event.target.closest("button");
    if (row) { hideSpotlight(); results[row.dataset.i].run(); }
  });
  input.focus();
}

/* ------------------------------------------------------------------ */
/* Chaos: everything that interrupts you, all stopped while focused     */
/* ------------------------------------------------------------------ */

const chaos = [];
export function every(minimum, maximum, run) {
  chaos.push({ minimum, maximum, run, timer: null });
}

export function startChaos() {
  emit("resume");
  for (const job of chaos) {
    clearTimeout(job.timer);
    const schedule = () => {
      job.timer = setTimeout(() => { job.run(); schedule(); }, between(job.minimum, job.maximum));
    };
    schedule();
  }
}

export function stopChaos() {
  emit("quiet");
  chaos.forEach((job) => clearTimeout(job.timer));
}

export const isTyping = () => !!document.activeElement?.closest?.("#desktop input, #desktop textarea, #desktop [contenteditable]");

/* ------------------------------------------------------------------ */

export function bootOS() {
  setUpWindowEvents();
  setUpDock();
  setUpMenuBar();
  setUpDesktop();
  setUpStatus();
  renderDesktop();
  renderDock();
  setWallpaper(settings.wallpaper);
  addEventListener('keydown', event => {
    if ($('#desktop').inert || !(event.metaKey || event.ctrlKey) || event.shiftKey || event.altKey) return;
    const key = event.key.toLowerCase();
    if (['w','m','n',','].includes(key)) {
      event.preventDefault();
      if(key==='w' && activeWindow) closeWindow(activeWindow);
      if(key==='m' && activeWindow) minimize(activeWindow);
      if(key==='n') launch(frontApp,{fresh:true});
      if(key===',') launch('settings');
    }
  });
}
