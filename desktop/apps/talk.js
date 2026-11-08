// The apps that talk at you: team chat, Messages and Mail.
import { $, $$, LIGHTS, addBadge, apps, bounce, clockTime, closeWindow, esc, every, frontWindow, launch, notify, openWindow, pick, registerApp, windows } from "../os.js";

const PEOPLE = {
  "Dana Reyes": 1, "Marcus Lee": 2, "Priya Shah": 3, "Tom Becker": 4, "Jess Park": 5, "Omar Haddad": 6,
};
const NAMES = Object.keys(PEOPLE);
const avatar = (name) => `assets/avatar-${PEOPLE[name] || 1}.jpg`;
const isOpen = (app) => windows.some((w) => w.app === app && !w.minimized);
const isFront = (app) => frontWindow()?.app === app;

/* ---------- Team chat ---------- */

const CHANNELS = {
  general: { topic: "Company-wide announcements", members: 284, seed: [["Jess Park", "Reminder that benefits enrollment closes Friday"], ["Omar Haddad", "Is that this Friday or next Friday?"], ["Jess Park", "This Friday"], ["Tom Becker", "Who has the link"]] },
  incidents: { topic: "Active: checkout latency in us-east", members: 96, seed: [["Marcus Lee", "p95 on checkout just jumped to 4s"], ["Priya Shah", "Looking. Did anyone deploy in the last hour?"], ["Tom Becker", "I did but it was only copy changes"], ["Marcus Lee", "Rolling it back anyway"], ["Dana Reyes", "Can someone post an update for support?"], ["Priya Shah", "Looks like the cache node restarted, not the deploy"]] },
  random: { topic: "Non-work banter", members: 251, seed: [["Omar Haddad", "The coffee machine on 3 is making a new sound"], ["Jess Park", "It has been doing that since Tuesday"], ["Tom Becker", "Anyone want the last of the bagels"]] },
  "design-crit": { topic: "Share early, share often", members: 42, seed: [["Dana Reyes", "New checkout flow is in Figma, comments welcome"], ["Priya Shah", "Left a few notes on the empty state"]] },
  "all-hands": { topic: "Thursday, 10am", members: 284, seed: [["Jess Park", "Please send questions by Wednesday"]] },
  "launch-q4": { topic: "Launch tracking. Dates are real now", members: 37, seed: [["Marcus Lee", "Are we still on for the 14th?"], ["Dana Reyes", "Pending legal"], ["Marcus Lee", "Who is talking to legal?"]] },
};
const TEAM_CHATTER = [
  "Quick question when you get a sec", "Can you take a look at this?", "Did you see the thread in #launch-q4?", "Got 5 minutes?", "Moving this to a call", "Who owns this now?",
  "Following up on this", "I don't think that's the right doc", "The link in the invite is broken", "Fixed it, try now", "Still seeing it on my end", "Can we push to 3?",
  "Sorry, was in back-to-backs", "Adding Marcus", "Is this blocking?", "Not blocking but kind of urgent", "+1", "Thanks!", "Let's take this offline", "Anyone know who approved that?",
  "Ticket's up, will share in a bit", "Looks good to me", "Wait, which environment?", "Can everyone see my screen?", "You're on mute", "Happy birthday Priya!!",
];
const REACTIONS = ["👍", "👀", "🔥", "😂", "🙏", "✅"];

const team = { active: "incidents", channels: {} };
const stamp = (minutes) => clockTime(new Date(Date.now() - minutes * 6e4));

for (const [name, channel] of Object.entries(CHANNELS)) {
  team.channels[name] = {
    ...channel, kind: "channel", unread: 0,
    messages: channel.seed.map(([who, text], i) => ({ who, text, time: stamp((channel.seed.length - i) * 7), reactions: i % 3 === 1 ? { [pick(REACTIONS)]: { n: 1 + i, mine: false } } : {} })),
  };
}
for (const name of NAMES.slice(0, 4)) {
  team.channels[name] = { kind: "dm", topic: "", unread: 0, messages: [{ who: name, text: pick(["Hey, are you free this afternoon?", "Did you get my last message?", "Can you review my PR today?", "One more thing on the doc"]), time: stamp(38), reactions: {} }] };
}
team.channels.general.unread = 12;
team.channels.random.unread = 48;
team.channels["launch-q4"].unread = 7;
team.channels["Dana Reyes"].unread = 2;
team.channels["Marcus Lee"].unread = 1;

function teamWindow(win) {
  return win && $(".team-msgs", win.el) ? win : null;
}

function drawTeamSide(el) {
  const rows = (kind) => Object.entries(team.channels).filter(([, c]) => c.kind === kind).map(([name, c]) => `
    <button class="${name === team.active ? "on" : c.unread ? "unread" : ""}" data-c="${esc(name)}">${kind === "dm" ? `<img src="${avatar(name)}" alt="">` : `<span>#</span>`}<u>${esc(name)}</u>${c.unread ? `<s>${c.unread}</s>` : ""}</button>`).join("");
  $(".team-list", el).innerHTML = `<h6>Channels</h6>${rows("channel")}<h6>Direct messages</h6>${rows("dm")}`;
}

function messageHTML(m, i, list) {
  const continued = i > 0 && list[i - 1].who === m.who;
  const reactions = Object.entries(m.reactions).map(([emoji, r]) => `<button class="react ${r.mine ? "mine" : ""}" data-e="${emoji}">${emoji} ${r.n}</button>`).join("");
  return `<div class="msg ${continued ? "cont" : ""}" data-m="${i}">
    ${continued ? `<time>${m.time.replace(/ .*/, "")}</time>` : `<img src="${m.who === "You" ? "assets/avatar-1.jpg" : avatar(m.who)}" alt="">`}
    <div class="msg-body">${continued ? "" : `<b>${esc(m.who)}</b> <small>${m.time}</small><br>`}<span>${esc(m.text)}</span>${reactions ? `<div class="reacts">${reactions}</div>` : ""}</div>
    <div class="msg-tools">${REACTIONS.slice(0, 4).map((e) => `<button data-add="${e}">${e}</button>`).join("")}</div></div>`;
}

function drawTeamMain(el, { keepScroll = false } = {}) {
  const channel = team.channels[team.active];
  const list = $(".team-msgs", el);
  const atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 40;
  const isDm = channel.kind === "dm";
  $(".team-head", el).innerHTML = `<b>${isDm ? "" : "# "}${esc(team.active)}</b>${channel.topic ? `<small>${esc(channel.topic)}</small>` : ""}${isDm ? "" : `<em>👥 ${channel.members}</em>`}`;
  list.innerHTML = channel.messages.map(messageHTML).join("") + (team.typing ? `<div class="typing">${esc(team.typing)} is typing…</div>` : "");
  $(".team-input input", el).placeholder = `Message ${isDm ? "" : "#"}${team.active}`;
  if (!keepScroll || atBottom) list.scrollTop = list.scrollHeight;
}

function refreshTeam() {
  windows.filter((w) => w.kind === "window" && w.app === "team").forEach((w) => { drawTeamSide(w.el); drawTeamMain(w.el, { keepScroll: true }); });
}

function teamReceive(channelName, who, text) {
  const channel = team.channels[channelName];
  channel.messages.push({ who, text, time: clockTime(), reactions: Math.random() < 0.2 ? { [pick(REACTIONS)]: { n: 1 + Math.floor(Math.random() * 6), mine: false } } : {} });
  if (channel.messages.length > 120) channel.messages.shift();
  const visible = channelName === team.active && isOpen("team");
  if (!visible) channel.unread += 1;
  refreshTeam();
  if (!isFront("team")) {
    addBadge("team");
    if (channel.kind === "dm" || Math.random() < 0.3) {
      notify({ app: "team", title: channel.kind === "dm" ? who : `#${channelName}`, text: channel.kind === "dm" ? text : `${who}: ${text}`, open: () => { team.active = channelName; channel.unread = 0; launch("team"); refreshTeam(); } });
    }
  }
}

registerApp({
  id: "team", name: "Team Chat", icon: "assets/dock-team.svg", badge: 70,
  open(options = {}) {
    const win = openWindow({
      app: "team", title: "Northwind", x: options.x, y: options.y, w: options.w || 620, h: options.h || 420, minW: 420, minH: 260, className: "team",
      html: `<div class="split">
        <div class="team-side"><div class="team-top" data-drag>${LIGHTS}</div><h5 data-drag>Northwind <span>⌄</span></h5><div class="team-list"></div></div>
        <div class="main"><div class="team-head" data-drag></div><div class="team-msgs"></div>
          <form class="team-input"><input aria-label="Message" autocomplete="off"><button aria-label="Send" type="submit">➤</button></form></div></div>`,
    });
    const el = win.el;
    drawTeamSide(el);
    drawTeamMain(el);

    $(".team-list", el).addEventListener("click", (event) => {
      const row = event.target.closest("[data-c]");
      if (!row) return;
      team.active = row.dataset.c;
      team.channels[team.active].unread = 0;
      refreshTeam();
      $$(".team-msgs", el).forEach((list) => { list.scrollTop = list.scrollHeight; });
      $(".team-input input", el).focus();
    });

    $(".team-msgs", el).addEventListener("click", (event) => {
      const button = event.target.closest("[data-e], [data-add]");
      if (!button) return;
      const message = team.channels[team.active].messages[button.closest(".msg").dataset.m];
      const emoji = button.dataset.e || button.dataset.add;
      const reaction = message.reactions[emoji] ||= { n: 0, mine: false };
      reaction.mine = !reaction.mine;
      reaction.n += reaction.mine ? 1 : -1;
      if (reaction.n <= 0) delete message.reactions[emoji];
      refreshTeam();
    });

    $(".team-input", el).addEventListener("submit", (event) => {
      event.preventDefault();
      const input = $("input", event.currentTarget);
      const text = input.value.trim();
      if (!text) return;
      input.value = "";
      const channelName = team.active;
      const channel = team.channels[channelName];
      channel.messages.push({ who: "You", text, time: clockTime(), reactions: {} });
      refreshTeam();
      // Someone always has something to say about it.
      const who = channel.kind === "dm" ? channelName : pick(NAMES);
      setTimeout(() => { if (team.active === channelName) { team.typing = who; refreshTeam(); } }, 700);
      setTimeout(() => { team.typing = null; teamReceive(channelName, who, pick(TEAM_CHATTER)); }, 2600);
    });
    return win;
  },
});

every(550, 1100, () => {
  const names = Object.keys(team.channels);
  // Mostly the channel you're looking at, so it visibly never stops.
  const channelName = Math.random() < 0.55 ? team.active : pick(names);
  const channel = team.channels[channelName];
  const who = channel.kind === "dm" ? channelName : pick(NAMES);
  teamReceive(channelName, who, pick(TEAM_CHATTER));
});

/* ---------- Messages ---------- */

const THREADS = [
  { name: "Mom", color: "#7b8cff", msgs: [["them", "Are you coming for Thanksgiving"], ["them", "Your father wants to know"], ["me", "Probably! Let me check flights"], ["them", "Call me"]], replies: ["Ok call me when you can", "Did you eat", "Your cousin is getting married", "Are you there", "👍"] },
  { name: "Dana Reyes", avatar: 1, msgs: [["them", "Are you in the office today?"], ["me", "Working from home, what's up"], ["them", "Nothing urgent, just need a sec"]], replies: ["Actually it's a bit urgent", "Nvm figured it out", "Sent you a doc", "Lol ok"] },
  { name: "Landlord", color: "#34a853", msgs: [["them", "Plumber is coming between 10 and 4 on Tuesday"], ["me", "Thanks for letting me know"]], replies: ["He may be early", "Can you leave the key", "Rent went through, thank you"] },
  { name: "Tom Becker", avatar: 4, msgs: [["them", "Basketball Thursday?"], ["me", "Can't this week"], ["them", "You said that last week"]], replies: ["Next week then", "We need one more", "Come onnnn"] },
  { name: "Delivery", color: "#8e8e93", msgs: [["them", "Your package is arriving today between 2pm and 7pm. Reply STOP to opt out."]], replies: ["Your package is 5 stops away.", "We missed you! Reschedule delivery in the app."] },
];
THREADS.forEach((t) => { t.unread = 0; });
THREADS[0].unread = 3;
let activeThread = 0;

const threadFace = (t) => t.avatar ? `<img src="assets/avatar-${t.avatar}.jpg" alt="">` : `<i class="face" style="background:${t.color}">${esc(t.name[0])}</i>`;

function drawMessages() {
  windows.filter((w) => w.kind === "window" && w.app === "chat").forEach(({ el }) => {
    $(".msgs-list", el).innerHTML = THREADS.map((t, i) => `<button class="${i === activeThread ? "on" : ""}" data-t="${i}">${t.unread ? "<u></u>" : ""}${threadFace(t)}<span><b>${esc(t.name)}</b><small>${esc(t.msgs[t.msgs.length - 1][1])}</small></span></button>`).join("");
    const thread = THREADS[activeThread];
    $(".msgs-head", el).innerHTML = `${threadFace(thread)}<b>${esc(thread.name)}</b>`;
    const list = $(".bubbles", el);
    list.innerHTML = thread.msgs.map(([from, text]) => `<div class="bubble ${from}">${esc(text)}</div>`).join("") + (thread.typing ? `<div class="bubble them dots"><i></i><i></i><i></i></div>` : "");
    list.scrollTop = list.scrollHeight;
  });
}

function messageArrives(index, text) {
  const thread = THREADS[index];
  thread.typing = false;
  thread.msgs.push(["them", text]);
  if (!(isFront("chat") && index === activeThread)) {
    thread.unread += 1;
    addBadge("chat");
    bounce("chat");
    notify({ app: "chat", title: thread.name, text, open: () => { activeThread = index; thread.unread = 0; launch("chat"); drawMessages(); } });
  }
  drawMessages();
}

registerApp({
  id: "chat", name: "Messages", icon: "assets/dock-chat.png", badge: 6,
  open(options = {}) {
    const win = openWindow({
      app: "chat", title: "Messages", x: options.x, y: options.y, w: options.w || 560, h: options.h || 420, minW: 380, minH: 260, className: "messages",
      html: `<div class="split"><div class="side" style="width:210px"><div class="side-top" data-drag>${LIGHTS}</div><div class="msgs-list"></div></div>
        <div class="main"><div class="msgs-head bar" data-drag></div><div class="bubbles"></div>
        <form class="msgs-input"><input placeholder="iMessage" aria-label="Message" autocomplete="off"></form></div></div>`,
    });
    const el = win.el;
    drawMessages();
    $(".msgs-list", el).addEventListener("click", (event) => {
      const row = event.target.closest("[data-t]");
      if (!row) return;
      activeThread = Number(row.dataset.t);
      THREADS[activeThread].unread = 0;
      drawMessages();
    });
    $(".msgs-input", el).addEventListener("submit", (event) => {
      event.preventDefault();
      const input = $("input", event.currentTarget);
      const text = input.value.trim();
      if (!text) return;
      input.value = "";
      const index = activeThread;
      const thread = THREADS[index];
      thread.msgs.push(["me", text]);
      drawMessages();
      setTimeout(() => { thread.typing = true; drawMessages(); }, 900);
      setTimeout(() => messageArrives(index, pick(thread.replies)), 2800);
    });
    return win;
  },
});

every(9000, 17000, () => {
  const index = Math.floor(Math.random() * THREADS.length);
  messageArrives(index, pick(THREADS[index].replies));
});

/* ---------- Mail ---------- */

let nextMail = 1;
const mailItem = (from, subject, body, extra = {}) => ({ id: nextMail++, from, subject, body, unread: true, flagged: false, box: "inbox", time: clockTime(new Date(Date.now() - nextMail * 11 * 6e4)), ...extra });

const mail = [
  mailItem("Dana Reyes", "Re: Re: Fwd: Quick sync", "Hi,\n\nFollowing up on this. Do you have time tomorrow? I can do anytime after 2.\n\nLooping in Marcus since he has context.\n\nDana"),
  mailItem("Accounts Payable", "Invoice 0412 is overdue", "Our records show that invoice 0412 for $1,240.00 is now 14 days past due.\n\nPlease remit payment or let us know if this has already been handled."),
  mailItem("Marcus Lee", "Who approved this?", "Sorry to reply-all, but does anyone know who signed off on the new vendor? Finance is asking.\n\nM"),
  mailItem("Jess Park", "Benefits enrollment closes Friday", "A reminder that open enrollment ends this Friday at 5pm PT. If you take no action your current plan rolls over.", { flagged: true }),
  mailItem("Tom Becker", "Notes from Monday", "Attached the notes. Main takeaway is that we need another meeting.\n\nTom"),
  mailItem("Calendar", "Invitation: Pre-read for the pre-meeting", "Priya Shah has invited you to Pre-read for the pre-meeting.\nThursday at 9:30am. Join with the link in the event.", { unread: false }),
  mailItem("Priya Shah", "One thing on the doc", "Left a comment on section 3, should be quick. Can you take a look before end of day?\n\nThanks,\nPriya"),
  mailItem("Omar Haddad", "Can you cover Thursday?", "I'm out Thursday afternoon. Would you be able to run the 3pm in my place? Agenda is in the invite.", { unread: false }),
  mailItem("Parcel Tracking", "Your package is out for delivery", "Your order is arriving today. Track your package for the latest updates.", { unread: false }),
  mailItem("Northwind IT", "Action required: Your password expires in 3 days", "To avoid losing access, update your password from the IT portal before it expires.", { unread: false }),
  mailItem("Weekly Digest", "32 things you missed this week", "Here's what happened in your workspaces while you were away.", { unread: false }),
  mailItem("You", "Re: Thursday", "Works for me, thanks.", { box: "sent", unread: false }),
  mailItem("You", "Quick question about", "Hi,\n\n", { box: "drafts", unread: false }),
];
const INCOMING = [
  ["Dana Reyes", "Re: Re: Re: Fwd: Quick sync", "Bumping this."],
  ["Marcus Lee", "Re: Who approved this?", "Adding legal."],
  ["Priya Shah", "Re: One thing on the doc", "Any update on this?"],
  ["Jess Park", "Last chance: benefits enrollment", "Closes in 2 days."],
  ["Tom Becker", "Fwd: Notes from Monday", "See below, thoughts?"],
  ["Accounts Payable", "Second notice: Invoice 0412", "This invoice remains outstanding."],
  ["Northwind IT", "Scheduled maintenance tonight", "Email may be unavailable from 11pm to 1am."],
  ["Omar Haddad", "Re: Can you cover Thursday?", "Just checking you saw this."],
];
const BOXES = [["inbox", "Inbox"], ["flagged", "Flagged"], ["drafts", "Drafts"], ["sent", "Sent"], ["trash", "Trash"]];
const inboxBase = 312;

const unreadInbox = () => inboxBase + mail.filter((m) => m.box === "inbox" && m.unread).length;

function drawMail(win) {
  const el = win.el;
  const state = win.mail;
  const query = state.query.toLowerCase();
  const inBox = (m) => state.box === "flagged" ? (m.flagged && m.box !== "trash") : m.box === state.box;
  const list = mail.filter((m) => inBox(m) && (!query || `${m.from} ${m.subject} ${m.body}`.toLowerCase().includes(query)));
  const selected = list.find((m) => m.id === state.selected) || list[0];
  state.selected = selected?.id;
  if (selected?.unread) { selected.unread = false; }

  $(".mail-boxes", el).innerHTML = `<h6>Favorites</h6>` + BOXES.map(([id, name]) => {
    const count = id === "inbox" ? unreadInbox() : id === "drafts" ? mail.filter((m) => m.box === "drafts").length : id === "flagged" ? mail.filter((m) => m.flagged).length : 0;
    return `<button class="${state.box === id ? "on" : ""}" data-box="${id}">${name}${count ? `<em>${count}</em>` : ""}</button>`;
  }).join("");
  $(".mail-count", el).textContent = state.box === "inbox" ? `${unreadInbox()} unread` : `${list.length} messages`;
  $(".mail-title", el).textContent = BOXES.find(([id]) => id === state.box)[1];
  $(".mail-list", el).innerHTML = list.map((m) => `<button class="${m.id === state.selected ? "on" : ""}" data-id="${m.id}">${m.unread ? "<u></u>" : ""}<b>${esc(m.from)}<time>${m.time}</time></b><span>${m.flagged ? "⚑ " : ""}${esc(m.subject)}</span><small>${esc(m.body.replace(/\n+/g, " "))}</small></button>`).join("") || `<p class="none">No Messages</p>`;
  $(".mail-body", el).innerHTML = selected ? `<h4>${esc(selected.subject)}</h4><div class="mail-from"><b>${esc(selected.from)}</b><time>${selected.time}</time></div><div class="mail-text selectable">${esc(selected.body).replace(/\n/g, "<br>")}</div>` : `<p class="none">No Message Selected</p>`;
  $(".mail-tools [data-flag]", el).classList.toggle("lit", !!selected?.flagged);
}

function refreshMail() {
  windows.filter((w) => w.kind === "window" && w.app === "mail" && w.mail).forEach(drawMail);
}

function compose({ to = "", subject = "", body = "" } = {}) {
  const win = openWindow({
    app: "mail", title: subject || "New Message", w: 460, h: 360, minW: 320, minH: 240, kind: "compose", className: "compose",
    html: `<div class="bar" data-drag>${LIGHTS}<b>New Message</b><button class="send" aria-label="Send">➤</button></div>
      <label>To: <input data-to value="${esc(to)}" autocomplete="off"></label><label>Subject: <input data-subject value="${esc(subject)}" autocomplete="off"></label>
      <textarea aria-label="Message" spellcheck="false">${esc(body)}</textarea>`,
  });
  const send = () => {
    mail.push(mailItem("You", $("[data-subject]", win.el).value || "(No Subject)", $("textarea", win.el).value, { box: "sent", unread: false, time: clockTime() }));
    closeWindow(win);
    refreshMail();
  };
  $(".send", win.el).addEventListener("click", send);
  ($("[data-to]", win.el).value ? $("textarea", win.el) : $("[data-to]", win.el)).focus();
  return win;
}

registerApp({
  id: "mail", name: "Mail", icon: "assets/dock-mail.png", badge: 312,
  fileMenu: () => [{ label: "New Message", keys: "⌘N", action: () => compose() }],
  dockMenu: () => [{ label: "New Message", action: () => compose() }],
  open(options = {}) {
    const win = openWindow({
      app: "mail", title: "Inbox", x: options.x, y: options.y, w: options.w || 740, h: options.h || 420, minW: 480, minH: 240, className: "mailapp",
      html: `<div class="split"><div class="side" style="width:150px"><div class="side-top" data-drag>${LIGHTS}</div><div class="mail-boxes"></div></div>
        <div class="main"><div class="bar mail-bar" data-drag><div class="mail-heading"><b class="mail-title"></b><small class="mail-count"></small></div>
          <div class="mail-tools"><button data-new aria-label="New Message" title="New Message">✎</button><button data-reply aria-label="Reply" title="Reply">↩</button><button data-flag aria-label="Flag" title="Flag">⚑</button><button data-delete aria-label="Delete" title="Delete">🗑</button></div>
          <input class="mail-search" placeholder="Search" aria-label="Search mail" autocomplete="off"></div>
        <div class="split mail-panes"><div class="mail-list"></div><div class="mail-body"></div></div></div></div>`,
    });
    win.mail = { box: "inbox", selected: mail[0].id, query: "" };
    const el = win.el;
    drawMail(win);
    el.addEventListener("click", (event) => {
      const box = event.target.closest("[data-box]");
      const row = event.target.closest(".mail-list [data-id]");
      const current = mail.find((m) => m.id === win.mail.selected);
      if (box) { win.mail.box = box.dataset.box; win.mail.selected = null; }
      else if (row) { win.mail.selected = Number(row.dataset.id); }
      else if (event.target.closest("[data-new]")) return void compose();
      else if (event.target.closest("[data-reply]") && current) return void compose({ to: current.from, subject: `Re: ${current.subject.replace(/^(Re: )+/, "")}` });
      else if (event.target.closest("[data-flag]") && current) current.flagged = !current.flagged;
      else if (event.target.closest("[data-delete]") && current) { current.box = current.box === "trash" ? "gone" : "trash"; win.mail.selected = null; }
      else return;
      refreshMail();
    });
    $(".mail-search", el).addEventListener("input", (event) => { win.mail.query = event.target.value; drawMail(win); });
    return win;
  },
});

every(1300, 2500, () => {
  const [from, subject, body] = pick(INCOMING);
  mail.unshift(mailItem(from, subject, body, { time: clockTime() }));
  if (mail.length > 60) mail.pop();
  refreshMail();
  if (!isFront("mail")) {
    addBadge("mail");
    notify({ app: "mail", title: from, text: subject });
  }
});

export const talk = { apps };
