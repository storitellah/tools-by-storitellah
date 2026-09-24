// Storitellah archive: timeline, highlights and viewer.
// Data shape (data/posts.json): [{ i, t, c, m: [[id, w, h, color, isVideo]], s, k, g? }]

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

const state = { posts: [], sort: "time", filter: "all", q: "", view: [], lb: { post: 0, media: 0 } };

const src = (id, size) => `m/${id}-${size}.webp`;
const fmtDate = (t, opts = { year: "numeric", month: "long", day: "numeric" }) =>
  new Date(t).toLocaleDateString("en-GB", opts);
const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const linkify = (s) =>
  esc(s)
    .replace(/(^|[\s(])@([\w.]+[\w])/g, '$1<a href="https://www.instagram.com/$2/" target="_blank" rel="noopener">@$2</a>')
    .replace(/(^|[\s(])#(\w+)/g, '$1<a href="https://www.instagram.com/explore/tags/$2/" target="_blank" rel="noopener">#$2</a>');
const firstLine = (s, n = 110) => {
  const line = (s || "").split("\n").find((l) => l.trim()) || "";
  return line.length > n ? line.slice(0, n - 1).trimEnd() + "…" : line;
};

// ---------- Tiles ----------
function tile(post, { size = "s", rank } = {}) {
  const [id, w, h, color, isVideo] = post.m[0];
  const el = document.createElement("button");
  el.type = "button";
  el.className = "tile" + (post.k ? " star" : "");
  el.style.setProperty("--c", color);
  el.dataset.i = post.i;
  el.setAttribute("aria-label", `${fmtDate(post.t)}${post.c ? ": " + firstLine(post.c, 80) : ""}`);
  const tags = [];
  if (isVideo || post.m.some((m) => m[4])) tags.push("▶");
  if (post.m.length > 1) tags.push(`${post.m.length}`);
  el.innerHTML =
    (rank ? `<span class="rank">${rank}</span>` : "") +
    (tags.length ? `<span class="tag">${tags.join(" · ")}</span>` : "") +
    `<img alt="" loading="lazy" decoding="async" width="${w}" height="${h}" src="${src(id, size)}">` +
    (post.c ? `<span class="cap">${esc(firstLine(post.c))}</span>` : "");
  const img = el.querySelector("img");
  img.addEventListener("load", () => img.classList.add("in"), { once: true });
  if (img.complete) img.classList.add("in");
  return el;
}

// ---------- Stats + highlights ----------
function renderStats(posts) {
  const media = posts.reduce((n, p) => n + p.m.length, 0);
  const videos = posts.reduce((n, p) => n + p.m.filter((m) => m[4]).length, 0);
  const byYear = countBy(posts, (p) => p.t.slice(0, 4));
  const [peakYear, peak] = Object.entries(byYear).sort((a, b) => b[1] - a[1])[0];
  const years = +posts.at(-1).t.slice(0, 4) - +posts[0].t.slice(0, 4) + 1;
  const stats = [
    [posts.length, "posts"],
    [media, "photographs & films"],
    [years, "years"],
    [peak, `posts in ${peakYear}, the busiest year`],
    [videos, "videos"],
  ];
  $("#stats").innerHTML = stats.map(([n, l]) => `<div class="stat"><b data-n="${n}">0</b><span>${l}</span></div>`).join("");
  const io = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    io.disconnect();
    $$("#stats b").forEach((b) => countUp(b, +b.dataset.n));
  });
  io.observe($("#stats"));
}

function countUp(el, to) {
  if (reduceMotion) return (el.textContent = to.toLocaleString());
  const start = performance.now(), dur = 1200;
  const tick = (now) => {
    const p = Math.min(1, (now - start) / dur), e = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(to * e).toLocaleString();
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function renderHighlights(posts) {
  const top = [...posts].slice(1).sort((a, b) => b.s - a.s).slice(0, 12);
  const box = $("#bento");
  top.forEach((p, n) => box.append(tile(p, { size: n < 3 ? "l" : "s", rank: n + 1 })));
}

// ---------- Timeline ----------
function applyView() {
  const q = state.q.trim().toLowerCase();
  let view = state.posts.filter((p) => {
    if (state.filter === "multi" && p.m.length < 2) return false;
    if (state.filter === "video" && !p.m.some((m) => m[4])) return false;
    if (q && !(p.c || "").toLowerCase().includes(q) && !p.t.startsWith(q)) return false;
    return true;
  });
  if (state.sort === "score") view = [...view].sort((a, b) => b.s - a.s);
  state.view = view;
  renderTimeline();
}

let lazyObserver;
function renderTimeline() {
  const root = $("#timeline");
  root.textContent = "";
  lazyObserver?.disconnect();
  const view = state.view;
  if (!view.length) {
    root.innerHTML = `<p class="empty">Nothing matches that. Try another word or filter.</p>`;
    renderYears([]);
    return;
  }

  if (state.sort === "score") {
    const sec = document.createElement("section");
    sec.className = "year";
    sec.innerHTML = `<div class="year-head"><h3>By significance</h3><p><b>${view.length.toLocaleString()}</b> posts, highest first</p></div>`;
    const grid = document.createElement("div");
    grid.className = "grid ranked";
    sec.append(grid);
    root.append(sec);
    fillLazily(grid, view);
    renderYears([]);
    return;
  }

  const groups = groupBy(view, (p) => p.t.slice(0, 4));
  for (const [year, posts] of groups) {
    const sec = document.createElement("section");
    sec.className = "year";
    sec.id = `y${year}`;
    sec.dataset.year = year;
    const stars = posts.filter((p) => p.k).length;
    const isFirstYear = posts[0].i === 0;
    sec.innerHTML =
      `<div class="year-head"><h3>${year}</h3><p><b>${posts.length}</b> post${posts.length > 1 ? "s" : ""}` +
      (stars ? ` · <b>${stars}</b> standout${stars > 1 ? "s" : ""}` : "") + `</p></div>` +
      (isFirstYear ? `<p class="first-marker">● The first post, ${fmtDate(posts[0].t)}</p>` : "");
    const grid = document.createElement("div");
    grid.className = "grid";
    sec.append(grid);
    root.append(sec);
    fillLazily(grid, posts);
  }
  renderYears([...groups.keys()]);
}

// Render each grid's tiles in chunks as it approaches the viewport, so thousands of posts stay cheap.
function fillLazily(grid, posts) {
  const CHUNK = 60;
  let done = 0;
  const sentinel = document.createElement("div");
  sentinel.style.cssText = "grid-column:1/-1;height:1px";
  const est = Math.ceil(posts.length / Math.max(3, Math.floor(grid.clientWidth / 150))) * 150;
  grid.style.minHeight = `${Math.min(est, 4000)}px`;
  const more = () => {
    const frag = document.createDocumentFragment();
    posts.slice(done, done + CHUNK).forEach((p) => frag.append(tile(p)));
    done += CHUNK;
    grid.insertBefore(frag, sentinel);
    if (done >= posts.length) {
      lazyObserver.unobserve(sentinel);
      sentinel.remove();
      grid.style.minHeight = "";
    }
  };
  grid.append(sentinel);
  lazyObserver ??= new IntersectionObserver(
    (entries) => entries.forEach((e) => e.isIntersecting && e.target._more()),
    { rootMargin: "1200px 0px" },
  );
  sentinel._more = more;
  lazyObserver.observe(sentinel);
}

// ---------- Year rail ----------
let yearObserver;
function renderYears(years) {
  const rail = $("#years");
  const counts = countBy(state.view, (p) => p.t.slice(0, 4));
  rail.innerHTML = years
    .map((y) => `<button role="tab" aria-selected="false" data-year="${y}">${y}<small>${counts[y]}</small></button>`)
    .join("");
  rail.hidden = !years.length;
  yearObserver?.disconnect();
  yearObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        $$("button", rail).forEach((b) => {
          const on = b.dataset.year === e.target.dataset.year;
          b.setAttribute("aria-selected", on);
          if (on) b.scrollIntoView({ inline: "center", block: "nearest", behavior: reduceMotion ? "auto" : "smooth" });
        });
      });
    },
    { rootMargin: "-30% 0px -65% 0px" },
  );
  $$(".year[data-year]").forEach((s) => yearObserver.observe(s));
}

// ---------- Lightbox ----------
const lb = $("#lightbox");
function openPost(i, media = 0) {
  const idx = state.posts.findIndex((p) => p.i === i);
  if (idx < 0) return;
  state.lb = { post: idx, media };
  if (!lb.open) lb.showModal();
  drawLightbox();
  history.replaceState(null, "", `#p${state.posts[idx].i + 1}`);
}

function drawLightbox() {
  const post = state.posts[state.lb.post];
  const [id, w, h, color, isVideo] = post.m[state.lb.media];
  const stage = $("#lb-media");
  stage.style.setProperty("--c", color);
  if (isVideo) {
    stage.innerHTML = `<video src="m/${id}.mp4" poster="${src(id, "l")}" controls playsinline autoplay width="${w}" height="${h}"></video>`;
  } else {
    stage.innerHTML = `<img class="loading" src="${src(id, "s")}" alt="" width="${w}" height="${h}">`;
    const img = stage.firstChild;
    const full = new Image();
    full.onload = () => { if (img.isConnected) { img.src = full.src; img.classList.remove("loading"); } };
    full.src = src(id, "l");
  }
  $("#lb-dots").innerHTML = post.m.length > 1 ? post.m.map((_, n) => `<i class="${n === state.lb.media ? "on" : ""}"></i>`).join("") : "";

  $("#lb-date").textContent = fmtDate(post.t);
  const badges = [];
  if (post.i === 0) badges.push(`<span class="badge hot">The first post</span>`);
  if (post.k) badges.push(`<span class="badge hot">★ Standout</span>`);
  if (post.m.length > 1) badges.push(`<span class="badge">${state.lb.media + 1} / ${post.m.length}</span>`);
  if (post.m.some((m) => m[4])) badges.push(`<span class="badge">Video</span>`);
  $("#lb-badges").innerHTML = badges.join("");
  $("#lb-caption").innerHTML = post.c ? linkify(post.c) : `<span style="color:var(--faint)">No caption.</span>`;

  const pct = Math.round((post.s / state.maxScore) * 100);
  const time = new Date(post.t).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  $("#lb-meta").innerHTML =
    `<span>Post ${(post.i + 1).toLocaleString()} of ${state.posts.length.toLocaleString()} · ${time}</span>` +
    (post.g ? `<span>📍 <a href="https://www.openstreetmap.org/?mlat=${post.g[0]}&mlon=${post.g[1]}#map=16/${post.g[0]}/${post.g[1]}" target="_blank" rel="noopener">${post.g[0].toFixed(4)}, ${post.g[1].toFixed(4)}</a></span>` : "") +
    `<span>Significance ${pct}</span><div class="meter"><i style="width:${pct}%"></i></div>`;

  // Warm the cache for whatever comes next.
  const next = post.m[state.lb.media + 1] || state.posts[state.lb.post + 1]?.m[0];
  if (next && !next[4]) new Image().src = src(next[0], "l");
}

function step(dir) {
  const post = state.posts[state.lb.post];
  const m = state.lb.media + dir;
  if (m >= 0 && m < post.m.length) state.lb.media = m;
  else movePost(dir);
  drawLightbox();
}
function movePost(dir) {
  const p = state.lb.post + dir;
  if (p < 0 || p >= state.posts.length) return;
  state.lb = { post: p, media: dir < 0 ? state.posts[p].m.length - 1 : 0 };
  history.replaceState(null, "", `#p${state.posts[p].i + 1}`);
}

function wireLightbox() {
  lb.addEventListener("click", (e) => {
    const t = e.target.closest("[data-step],[data-post],[data-close]");
    if (t?.dataset.step) step(+t.dataset.step);
    else if (t?.dataset.post) { movePost(+t.dataset.post); drawLightbox(); }
    else if (t?.dataset.close !== undefined && t) lb.close();
    else if (e.target === $("#lb-media") || e.target === $("#lb-stage")) lb.close();
  });
  lb.addEventListener("close", () => {
    $("#lb-media").textContent = "";
    history.replaceState(null, "", location.pathname + location.search);
  });
  document.addEventListener("keydown", (e) => {
    if (!lb.open) return;
    if (e.key === "ArrowRight") step(1);
    else if (e.key === "ArrowLeft") step(-1);
    else if (e.key === "ArrowDown") { movePost(1); drawLightbox(); }
    else if (e.key === "ArrowUp") { movePost(-1); drawLightbox(); }
  });
  let x0 = null, y0 = 0;
  const stage = $("#lb-stage");
  stage.addEventListener("pointerdown", (e) => { x0 = e.clientX; y0 = e.clientY; });
  stage.addEventListener("pointerup", (e) => {
    if (x0 === null) return;
    const dx = e.clientX - x0, dy = e.clientY - y0;
    x0 = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) step(dx < 0 ? 1 : -1);
  });
}

// ---------- Controls ----------
function wireControls() {
  document.addEventListener("click", (e) => {
    const t = e.target.closest(".tile");
    if (t) openPost(+t.dataset.i);
    if (e.target.closest("[data-open-first]")) openPost(0);
    if (e.target.closest("[data-explain]")) $("#explain").showModal();
    const y = e.target.closest("[data-year]");
    if (y?.closest("#years")) $(`#y${y.dataset.year}`)?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
  });
  $$("[data-sort]").forEach((b) => b.addEventListener("click", () => setSeg("sort", b)));
  $$("[data-filter]").forEach((b) => b.addEventListener("click", () => setSeg("filter", b)));
  let timer;
  $("#q").addEventListener("input", (e) => {
    clearTimeout(timer);
    timer = setTimeout(() => { state.q = e.target.value; applyView(); }, 180);
  });
}
function setSeg(kind, btn) {
  $$(`[data-${kind}]`).forEach((b) => b.setAttribute("aria-checked", b === btn));
  state[kind] = btn.dataset[kind];
  applyView();
  const top = $("#controls").getBoundingClientRect().top + scrollY;
  if (scrollY > top) scrollTo({ top, behavior: reduceMotion ? "auto" : "smooth" });
}

// ---------- Hero parallax ----------
function wireHero() {
  if (reduceMotion) return;
  const photo = $(".hero-photo");
  let ticking = false;
  addEventListener("scroll", () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = Math.min(scrollY, innerHeight);
      photo.style.setProperty("--py", `${y * 0.18}px`);
      photo.style.setProperty("--ps", `${1 - y / innerHeight * 0.06}`);
      ticking = false;
    });
  }, { passive: true });
}

// ---------- utils ----------
function groupBy(arr, fn) {
  const m = new Map();
  for (const x of arr) { const k = fn(x); m.has(k) ? m.get(k).push(x) : m.set(k, [x]); }
  return m;
}
function countBy(arr, fn) {
  const o = {};
  for (const x of arr) { const k = fn(x); o[k] = (o[k] || 0) + 1; }
  return o;
}

// ---------- boot ----------
wireHero();
wireControls();
wireLightbox();
const res = await fetch("data/posts.json");
state.posts = await res.json();
state.maxScore = Math.max(...state.posts.map((p) => p.s));
renderStats(state.posts);
renderHighlights(state.posts);
applyView();
const deep = location.hash.match(/^#p(\d+)$/);
if (deep) openPost(+deep[1] - 1);
