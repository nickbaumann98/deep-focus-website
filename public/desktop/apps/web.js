// The apps you look at instead: the browser, a social feed and the news.
import { $, $$, LIGHTS, addBadge, clockTime, esc, every, frontWindow, notify, on, openWindow, pick, registerApp, windows } from "../os.js";

/* ---------- Browser ---------- */

const VIDEOS = [
  { title: "He taught his dog to skateboard. Then this happened", channel: "Good Boys Daily", views: "4.2M views", src: "assets/video-still.jpg", seconds: 428 },
  { title: "Sunset drive up the coast in 4K, no talking", channel: "Slow Roads", views: "812K views", src: "assets/wallpaper-coast.jpg", seconds: 3612 },
  { title: "Why glass is actually a liquid (it isn't)", channel: "Half Explained", views: "2.1M views", src: "assets/wallpaper-glass.jpg", seconds: 941 },
  { title: "I tried waking up at 4am for 30 days", channel: "Morning Stack", views: "9.7M views", src: "assets/wallpaper-swirl.jpg", seconds: 1104 },
  { title: "Every paint color ranked, a 3 hour video", channel: "Room Tone", views: "390K views", src: "assets/wallpaper-bloom.jpg", seconds: 10847 },
];
const FLIGHTS = [
  ["Northern", "6:05a", "2:32p", "5h 27m", "Nonstop", 248], ["Skyline", "7:40a", "6:15p", "7h 35m", "1 stop", 189], ["Pacific Air", "10:15a", "6:50p", "5h 35m", "Nonstop", 312],
  ["Northern", "1:20p", "9:55p", "5h 35m", "Nonstop", 276], ["Skyline", "4:45p", "1:05a", "5h 20m", "Nonstop", 301], ["Atlas", "10:30p", "6:58a", "5h 28m", "Nonstop", 164],
];
const FAVORITES = [["▶", "Streamly", "streamly.tv", "#e5352b"], ["✈", "FlyFinder", "flyfinder.co/sfo-jfk", "#0a84ff"], ["?", "Ask", "search?q=why%20am%20i%20always%20tired", "#7c5cff"], ["N", "Morning Post", "search?q=morning%20news", "#111"], ["★", "Reviews", "search?q=best%20ergonomic%20chair", "#1f9d55"], ["✉", "Webmail", "search?q=webmail", "#d44638"]];
const fmt = (seconds) => { const m = Math.floor(seconds / 60); const h = Math.floor(m / 60); return (h ? `${h}:${String(m % 60).padStart(2, "0")}` : m) + ":" + String(Math.floor(seconds % 60)).padStart(2, "0"); };

function resultsFor(query) {
  const q = query || "";
  const base = q.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim().split(" ")[0] || "answers";
  return [
    [`${q}: what you need to know`, `www.${base}guide.com`, `A complete guide to ${q}, updated this month. Here's everything we found, what experts say and what to do next.`],
    [`r/${base}: anyone else dealing with this?`, "forum.threadly.com", `412 comments. "So I've been looking into ${q} for weeks and honestly the top answer changed everything for me…"`],
    [`The 11 best options for ${q} in ${new Date().getFullYear()}`, "www.bestpicks.co", "We tested dozens so you don't have to. Our top pick might surprise you."],
    [`${q} explained in 8 minutes`, "streamly.tv", "Video · 1.2M views · Half Explained"],
    [`Is ${q} normal? When to worry`, "www.healthline-answers.org", "Most of the time it's nothing. Here are the signs that it's something."],
    [`Stop what you're doing and read this about ${q}`, "www.thenewsletter.io", "A longer read. 24 min. Subscribe to continue."],
  ];
}

function browserPage(tab, win) {
  const url = tab.url;
  if (!url) {
    return `<div class="start"><h3>Favorites</h3><div class="favs">${FAVORITES.map(([g, name, target, color]) => `<button data-go="${esc(target)}"><i style="background:${color}">${g}</i>${esc(name)}</button>`).join("")}</div>
      <h3>Reading List</h3><div class="reads">${["The case for fewer meetings", "How to actually read more", "47 tabs is a cry for help"].map((t) => `<button data-go="search?q=${encodeURIComponent(t)}">${esc(t)}</button>`).join("")}</div></div>`;
  }
  if (url.startsWith("streamly.tv")) {
    const index = Math.max(0, Math.min(VIDEOS.length-1, Number(new URLSearchParams(url.split("?")[1] || "").get("v")) || 0));
    const video = VIDEOS[index];
    tab.video = tab.video?.index === index ? tab.video : { index, time: 12, playing: true, muted: true };
    return `<div class="watch"><div class="player" data-video>
        <div class="picture" style="background-image:url('${video.src}')"></div>
        <button class="big-play" aria-label="Play or pause"></button>
        <div class="controls"><button data-toggle aria-label="Play or pause"></button><div class="scrub" data-scrub><i></i></div><span class="vt"></span><button data-mute aria-label="Mute"></button></div></div>
      <div class="watch-info"><b>${esc(video.title)}</b><small>${esc(video.channel)} · ${video.views}</small>
        <div class="watch-actions"><button data-like>👍 Like</button><button data-sub>Subscribe</button></div></div>
      <div class="up-next">${VIDEOS.map((v, i) => i === index ? "" : `<button data-go="streamly.tv/watch?v=${i}"><i style="background-image:url('${v.src}')"></i><span><b>${esc(v.title)}</b><small>${esc(v.channel)} · ${v.views}</small></span></button>`).join("")}</div></div>`;
  }
  if (url.startsWith("flyfinder.co")) {
    return `<div class="fly"><form class="fly-form"><input value="SFO" aria-label="From" autocomplete="off"><span>→</span><input value="JFK" aria-label="To" autocomplete="off"><button>Search</button></form>
      <small class="dim fly-note">Prices rose 12% since your last visit · 3 people are looking at this now</small>
      <div class="fly-list">${FLIGHTS.map(([air, dep, arr, dur, stops, price], i) => `<button data-fly="${i}"><span><b>${dep} – ${arr}</b><small>${air}</small></span><span>${dur}<small>${stops}</small></span><strong data-price="${price}">$${price}</strong></button>`).join("")}</div></div>`;
  }
  if (url.startsWith("article")) {
    const params = new URLSearchParams(url.split("?")[1]);
    return `<article class="doc selectable"><small class="dim">${esc(params.get("s") || "")}</small><h2>${esc(params.get("t") || "")}</h2><p>${esc(params.get("d") || "")}</p><p>It starts the way these things usually do, with a small question you meant to look up for one minute. The answer led to a better question, and that one led to a forum from 2011 where someone named Greg had solved it, or at least thought so.</p><p>Which is how it got to be four in the afternoon.</p><div class="paywall"><b>You've read 1 of 1 free articles</b><small>Subscribe for $1 a week, billed never quite how you expect</small></div></article>`;
  }
  const q = url.startsWith("search") ? new URLSearchParams(url.split("?")[1] || "").get("q") : url;
  return `<div class="serp"><form class="serp-box"><input value="${esc(q)}" aria-label="Search" autocomplete="off"></form><small class="dim">About 48,200,000 results (0.41 seconds)</small>
    ${resultsFor(q).map(([title, site, text]) => `<div class="hit"><small>${esc(site)}</small><button data-go="${site.startsWith("streamly") ? "streamly.tv/watch?v=2" : `article?t=${encodeURIComponent(title)}&s=${encodeURIComponent(site)}&d=${encodeURIComponent(text)}`}">${esc(title)}</button><p>${esc(text)}</p></div>`).join("")}</div>`;
}

const hostOf = (url) => !url ? "" : url.startsWith("search") ? "search.com" : url.startsWith("article") ? new URLSearchParams(url.split("?")[1]).get("s") : url.split("/")[0];
const titleOf = (url) => {
  if (!url) return "Start Page";
  if (url.startsWith("streamly.tv")) return (VIDEOS[Number(new URLSearchParams(url.split("?")[1] || "").get("v") || 0)] || VIDEOS[0]).title;
  if (url.startsWith("flyfinder")) return "SFO to JFK · FlyFinder";
  if (url.startsWith("article")) return new URLSearchParams(url.split("?")[1]).get("t");
  if (url.startsWith("search")) return `${new URLSearchParams(url.split("?")[1] || "").get("q")} - Search`;
  return url;
};

function makeTab(url = "") {
  return { url, back: [], forward: [], video: null };
}

function drawBrowser(win, { full = true } = {}) {
  const { el, browser } = win;
  const tab = browser.tabs[browser.active];
  $(".b-tabs", el).innerHTML = browser.tabs.map((t, i) => `<div class="b-tab ${i === browser.active ? "on" : ""}" data-tab="${i}"><span>${esc(titleOf(t.url))}</span><button data-close-tab="${i}" aria-label="Close tab">×</button></div>`).join("") + `<button class="b-new" aria-label="New tab">+</button>`;
  const address = $(".url", el);
  if (document.activeElement !== address) address.value = hostOf(tab.url);
  address.placeholder = "Search or enter website name";
  $("[data-back]", el).disabled = !tab.back.length;
  $("[data-forward]", el).disabled = !tab.forward.length;
  win.title = titleOf(tab.url);
  if (full) {
    $(".b-page", el).innerHTML = browserPage(tab, win);
    $(".b-page", el).scrollTop = 0;
    drawVideo(win);
  }
}

function drawVideo(win) {
  const tab = win.browser.tabs[win.browser.active];
  const player = $("[data-video]", win.el);
  if (!player || !tab.video) return;
  const video = VIDEOS[tab.video.index];
  player.classList.toggle("playing", tab.video.playing);
  $("[data-toggle]", player).textContent = tab.video.playing ? "⏸" : "▶";
  $("[data-mute]", player).textContent = tab.video.muted ? "🔇" : "🔊";
  $(".scrub i", player).style.width = (tab.video.time / video.seconds) * 100 + "%";
  $(".vt", player).textContent = `${fmt(tab.video.time)} / ${fmt(video.seconds)}`;
}

function go(win, url) {
  const tab = win.browser.tabs[win.browser.active];
  tab.back.push(tab.url);
  tab.forward = [];
  tab.url = url;
  const bar = $(".b-load", win.el);
  bar.getAnimations().forEach((a) => a.cancel());
  bar.animate([{ transform: "scaleX(0)", opacity: 1 }, { transform: "scaleX(.8)", opacity: 1, offset: .7 }, { transform: "scaleX(1)", opacity: 0 }], { duration: 480, easing: "ease-out" });
  drawBrowser(win);
}

function normalize(text) {
  const value = text.trim();
  if (!value) return "";
  if (value.includes("streamly")) return "streamly.tv/watch?v=0";
  if (value.includes("flyfinder")) return "flyfinder.co/sfo-jfk";
  return `search?q=${encodeURIComponent(value)}`;
}

registerApp({
  id: "web", name: "Browser", icon: "assets/dock-web.png",
  fileMenu: () => [{ label: "New Tab", keys: "⌘T", action: () => { const win = frontWindow(); if (win?.browser) { win.browser.tabs.push(makeTab()); win.browser.active = win.browser.tabs.length - 1; drawBrowser(win); } } }],
  open(options = {}) {
    const existing = !options.fresh && options.url && windows.find((w) => w.browser);
    if (existing) {
      existing.browser.tabs.push(makeTab(options.url));
      existing.browser.active = existing.browser.tabs.length - 1;
      drawBrowser(existing);
      return existing;
    }
    const win = openWindow({
      app: "web", title: "Browser", x: options.x, y: options.y, w: options.w || 640, h: options.h || 460, minW: 380, minH: 260, className: "browser",
      html: `<div class="bar browser-bar" data-drag>${LIGHTS}<div class="b-nav"><button data-back aria-label="Back">‹</button><button data-forward aria-label="Forward">›</button></div>
        <form class="b-address"><input class="url" aria-label="Address" spellcheck="false" autocomplete="off"><button type="button" data-reload aria-label="Reload">↻</button></form></div>
        <div class="b-tabs" data-drag></div><i class="b-load"></i><div class="b-page"></div>`,
    });
    const tabs = options.tabs || [options.url || ""];
    win.browser = { tabs: tabs.map(makeTab), active: 0 };
    const el = win.el;
    drawBrowser(win);

    el.addEventListener("click", (event) => {
      const { target } = event;
      const close = target.closest("[data-close-tab]");
      const tabEl = target.closest("[data-tab]");
      const link = target.closest("[data-go]");
      const browser = win.browser;
      if (close) {
        browser.tabs.splice(Number(close.dataset.closeTab), 1);
        if (!browser.tabs.length) browser.tabs.push(makeTab());
        browser.active = Math.min(browser.active, browser.tabs.length - 1);
        drawBrowser(win);
      } else if (tabEl) {
        browser.active = Number(tabEl.dataset.tab);
        drawBrowser(win);
      } else if (target.closest(".b-new")) {
        browser.tabs.push(makeTab());
        browser.active = browser.tabs.length - 1;
        drawBrowser(win);
        $(".url", el).focus();
      } else if (link) {
        go(win, link.dataset.go);
      } else if (target.closest("[data-back]")) {
        const tab = browser.tabs[browser.active];
        if (tab.back.length) { tab.forward.push(tab.url); tab.url = tab.back.pop(); drawBrowser(win); }
      } else if (target.closest("[data-forward]")) {
        const tab = browser.tabs[browser.active];
        if (tab.forward.length) { tab.back.push(tab.url); tab.url = tab.forward.pop(); drawBrowser(win); }
      } else if (target.closest("[data-reload]")) {
        const tab = browser.tabs[browser.active];
        tab.back.push(tab.url); tab.back.pop();
        go(win, tab.url);
        tab.back.pop();
      } else if (target.closest("[data-toggle], .big-play")) {
        const tab = browser.tabs[browser.active];
        tab.video.playing = !tab.video.playing;
        drawVideo(win);
      } else if (target.closest("[data-mute]")) {
        const tab = browser.tabs[browser.active];
        tab.video.muted = !tab.video.muted;
        drawVideo(win);
      } else if (target.closest("[data-scrub]")) {
        const tab = browser.tabs[browser.active];
        const box = target.closest("[data-scrub]").getBoundingClientRect();
        tab.video.time = ((event.clientX - box.left) / box.width) * VIDEOS[tab.video.index].seconds;
        drawVideo(win);
      } else if (target.closest("[data-like]")) {
        target.closest("[data-like]").classList.toggle("lit");
      } else if (target.closest("[data-sub]")) {
        const button = target.closest("[data-sub]");
        button.textContent = button.classList.toggle("lit") ? "Subscribed" : "Subscribe";
      } else if (target.closest("[data-fly]")) {
        $$("[data-fly]", el).forEach((b) => b.classList.toggle("on", b === target.closest("[data-fly]")));
      }
    });

    el.addEventListener("submit", (event) => {
      event.preventDefault();
      const form = event.target;
      if (form.matches(".b-address")) { go(win, normalize($(".url", el).value)); $(".url", el).blur(); }
      if (form.matches(".serp-box")) go(win, normalize($("input", form).value));
      if (form.matches(".fly-form")) { go(win, "flyfinder.co/sfo-jfk"); }
    });
    $(".url", el).addEventListener("focus", (event) => event.target.select());
    return win;
  },
});

let lastTick = performance.now();
every(1000, 1000, () => {
  const now = performance.now();
  const passed = Math.min((now - lastTick) / 1000, 2);
  lastTick = now;
  windows.filter((w) => w.browser).forEach((win) => {
    win.browser.tabs.forEach((tab) => {
      if (tab.video?.playing) {
        tab.video.time = (tab.video.time + passed) % VIDEOS[tab.video.index].seconds;
      }
    });
    drawVideo(win);
    // The price really does go up while you think about it.
    $$("[data-price]", win.el).forEach((price) => {
      if (Math.random() < 0.08) {
        price.dataset.price = Number(price.dataset.price) + Math.ceil(Math.random() * 6);
        price.textContent = "$" + price.dataset.price;
      }
    });
  });
});

on("quiet", () => { lastTick = performance.now(); });

/* ---------- Social feed ---------- */

const AUTHORS = [["Dana Reyes", "danareyes", 1], ["Marcus Lee", "mlee", 2], ["Priya Shah", "priyabuilds", 3], ["Tom Becker", "tombecker", 4], ["Jess Park", "jesspark", 5], ["Omar Haddad", "omarh", 6]];
const POST_TEXT = [
  "Most meetings could be a two line email. Most emails could be nothing.", "Hot take: the best productivity system is the one you abandon last.", "We just crossed 10,000 users. Here's everything I got wrong along the way (a thread) 🧵",
  "My dog has a better morning routine than I do.", "Nobody talks about how hard it is to find a good lunch near the office.", "If your startup needs a 40 page deck, it doesn't need a deck.",
  "Finally switched to a standing desk. I now sit on a stool at my standing desk.", "Reminder to drink water and close some tabs.", "Three books that changed how I think about work. The third will surprise you.",
  "Spent 4 hours automating a 10 minute task. No regrets.", "The new update moved one button and I've lost the will to continue.", "Why does every app need to be a social network now",
  "Just saw the most incredible sunset from the freeway.", "Unpopular opinion: breakfast is fine.", "Quitting my job to do this full time. Details soon.", "What's a tool you use every day that nobody knows about?",
];
let nextPost = 1;
const makePost = () => {
  const author = pick(AUTHORS);
  return { id: nextPost++, author, text: pick(POST_TEXT), time: `${Math.floor(Math.random() * 50) + 1}m`, likes: Math.floor(Math.random() * 4000), reposts: Math.floor(Math.random() * 500), replies: Math.floor(Math.random() * 200), liked: false, reposted: false, media: Math.random() < 0.18 ? pick(["assets/video-still.jpg", "assets/wallpaper-coast.jpg"]) : null };
};
const feed = Array.from({ length: 18 }, makePost);
let pending = [];

const postHTML = (p) => `<article class="post" data-p="${p.id}"><img src="assets/avatar-${p.author[2]}.jpg" alt=""><div><b>${esc(p.author[0])}</b> <small>@${esc(p.author[1])} · ${p.time}</small>
  <p class="selectable">${esc(p.text)}</p>${p.media ? `<div class="post-media" style="background-image:url('${p.media}')"></div>` : ""}
  <div class="post-actions"><button data-a="reply">💬 ${p.replies}</button><button data-a="repost" class="${p.reposted ? "green" : ""}">↻ ${p.reposts}</button><button data-a="like" class="${p.liked ? "pink" : ""}">${p.liked ? "♥" : "♡"} ${p.likes}</button></div></div></article>`;

function drawFeed(win) {
  const list = win.feedTab === "Following" ? feed.filter((p) => p.author[2] % 2 === 1 || p.author[0] === "You") : feed;
  $(".feed", win.el).innerHTML = (pending.length ? `<button class="new-posts">Show ${pending.length} new post${pending.length > 1 ? "s" : ""}</button>` : "") + list.map(postHTML).join("");
  $$(".feed-tabs button", win.el).forEach((b) => b.classList.toggle("on", b.textContent === win.feedTab));
}

const refreshFeeds = () => windows.filter((w) => w.kind === "window" && w.app === "social").forEach(drawFeed);

registerApp({
  id: "social", name: "Social", dock: false, icon: "assets/dock-chat.png",
  open(options = {}) {
    const win = openWindow({
      app: "social", title: "Home", x: options.x, y: options.y, w: options.w || 360, h: options.h || 440, minW: 300, minH: 240, className: "social",
      html: `<div class="bar" data-drag>${LIGHTS}<b>Home</b></div><div class="feed-tabs" data-drag><button>For You</button><button>Following</button></div>
        <div class="social-scroll"><form class="composer"><img src="assets/avatar-1.jpg" alt=""><input placeholder="What's happening?" aria-label="New post" autocomplete="off"><button>Post</button></form><div class="feed"></div></div>`,
    });
    win.feedTab = "For You";
    drawFeed(win);
    const el = win.el;
    el.addEventListener("click", (event) => {
      const tab = event.target.closest(".feed-tabs button");
      if (tab) { win.feedTab = tab.textContent; return drawFeed(win); }
      if (event.target.closest(".new-posts")) {
        feed.unshift(...pending);
        pending = [];
        refreshFeeds();
        $(".social-scroll", el).scrollTop = 0;
        return;
      }
      const action = event.target.closest("[data-a]");
      if (!action) return;
      const post = feed.find((p) => p.id === Number(action.closest("[data-p]").dataset.p));
      if (action.dataset.a === "like") { post.liked = !post.liked; post.likes += post.liked ? 1 : -1; }
      if (action.dataset.a === "repost") { post.reposted = !post.reposted; post.reposts += post.reposted ? 1 : -1; }
      if (action.dataset.a === "reply") { post.replies += 1; const input = $(".composer input", el); input.value = `@${post.author[1]} `; input.focus(); }
      refreshFeeds();
    });
    $(".composer", el).addEventListener("submit", (event) => {
      event.preventDefault();
      const input = $("input", event.currentTarget);
      if (!input.value.trim()) return;
      feed.unshift({ id: nextPost++, author: ["You", "you", 1], text: input.value.trim(), time: "now", likes: 0, reposts: 0, replies: 0, liked: false, reposted: false, media: null });
      input.value = "";
      refreshFeeds();
      $(".social-scroll", el).scrollTop = 0;
    });
    return win;
  },
});

every(1200, 2400, () => {
  pending.unshift(makePost());
  if (pending.length > 30) pending.pop();
  refreshFeeds();
});

/* ---------- News ---------- */

const STORIES = [
  ["Business", "Markets slide as investors weigh rate outlook", "Stocks fell for a third straight session on Tuesday as traders parsed mixed signals on inflation and what they could mean for rates next year."],
  ["Technology", "The office is back, and so is the commute", "A growing number of large employers are asking staff to return four days a week. Workers, and the transit systems they rely on, are adjusting."],
  ["World", "Talks resume after weekend of delays", "Negotiators returned to the table on Monday with both sides saying progress is possible, though neither would say when."],
  ["Science", "Why you can't stop checking your phone", "Researchers say the average person now picks up their phone more than 140 times a day, and that most can't say why they did."],
  ["Sports", "Late goal sends the home side through", "A stoppage-time winner capped a wild night that featured two red cards and a 20 minute weather delay."],
  ["Local", "Bay Area rents tick up for sixth straight month", "The median one-bedroom now costs more than it did at the previous peak, according to new listings data."],
  ["Health", "The 3pm slump, explained", "It's probably not your lunch. Sleep scientists explain the dip most people feel in the afternoon, and what actually helps."],
  ["Travel", "Airlines add fees for one more thing", "Carriers say the change simplifies pricing. Passengers have other words for it."],
];
const newsSource = STORIES.map((s, i) => ({ id: i, section: s[0], title: s[1], body: s[2], read: false, src: ["assets/wallpaper-glass.jpg", "assets/wallpaper-coast.jpg", "assets/video-still.jpg", "assets/wallpaper-bloom.jpg"][i % 4] }));
const BREAKING = ["Breaking: Officials to give update at 3pm", "Developing: Outage hits major cloud provider", "Just in: Earnings beat expectations", "Alert: Storm warning for the coast this weekend"];

registerApp({
  id: "news", name: "News", icon: "assets/dock-news.png", badge: 6,
  open(options = {}) {
    const win = openWindow({
      app: "news", title: "Today", x: options.x, y: options.y, w: 620, h: 440, minW: 420, minH: 260, className: "news",
      html: `<div class="split"><div class="side" style="width:220px"><div class="side-top" data-drag>${LIGHTS}</div><h5 class="news-brand">News</h5><div class="news-list"></div></div><div class="main news-story selectable"></div></div>`,
    });
    let current = 0;
    const draw = () => {
      $(".news-list", win.el).innerHTML = newsSource.map((s, i) => `<button class="${i === current ? "on" : ""}" data-s="${i}"><small>${esc(s.section)}</small>${esc(s.title)}</button>`).join("");
      const story = newsSource[current];
      $(".news-story", win.el).innerHTML = `<div class="news-hero" style="background-image:url('${story.src}')" data-drag></div><article class="doc"><small class="dim">${esc(story.section)} · ${clockTime()}</small><h2>${esc(story.title)}</h2><p>${esc(story.body)}</p><p>More details are expected later today. This is a developing story and will be updated as information comes in.</p></article>`;
    };
    draw();
    $(".news-list", win.el).addEventListener("click", (event) => {
      const row = event.target.closest("[data-s]");
      if (row) { current = Number(row.dataset.s); draw(); }
    });
    return win;
  },
});

every(3500, 6000, () => {
  if (frontWindow()?.app !== "news") addBadge("news");
  notify({ app: "news", title: "News", text: pick(BREAKING) });
});
