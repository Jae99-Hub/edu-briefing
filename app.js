(function () {
  "use strict";
  var feed = document.getElementById("feed");
  var topR = document.getElementById("top-r");
  var topL = document.getElementById("top-l");
  var tabbar = document.getElementById("tabbar");
  var reels = document.getElementById("reels");
  var toastEl = document.getElementById("toast");

  var WEEK = ["일", "월", "화", "수", "목", "금", "토"];
  // 분야마다 카드 색 [바탕, 글자, 형광펜]
  var COLORS = {
    "교과서 · 교육과정": ["#cc4210", "#ffffff", "#ffe14d"],
    "중학 영어 · 내신": ["#1659e6", "#ffffff", "#ffe14d"],
    "학원가 소식": ["#d6336c", "#ffffff", "#ffe14d"],
    "학원 운영": ["#111111", "#ffffff", "#ffe14d"],
    "에듀테크 · AI": ["#0b7a6b", "#ffffff", "#ffe14d"],
    "정책 · 제도": ["#3d6b21", "#ffffff", "#ffe14d"],
    "입시 · 고입": ["#ffd23f", "#111111", "#ffffff"]
  };
  var DEFAULT = ["#444444", "#ffffff", "#ffe14d"];
  var ORDER = ["교과서 · 교육과정", "중학 영어 · 내신", "학원가 소식", "학원 운영", "에듀테크 · AI", "정책 · 제도", "입시 · 고입"];
  var SHORT = { "교과서 · 교육과정": "교과서", "중학 영어 · 내신": "내신", "학원가 소식": "학원가", "학원 운영": "운영", "에듀테크 · AI": "AI", "정책 · 제도": "정책", "입시 · 고입": "입시" };
  var LABEL = { "교과서 · 교육과정": "교과서", "중학 영어 · 내신": "중학 영어", "학원가 소식": "학원가", "학원 운영": "학원 운영", "에듀테크 · AI": "에듀테크", "정책 · 제도": "정책", "입시 · 고입": "입시" };
  var I = {
    open: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/></svg>',
    share: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 3L10 14M21 3l-7 18-4-7-7-4z"/></svg>',
    save: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18l-6-5-6 5z"/></svg>',
    cal: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
    back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>'
  };

  var dates = [];
  var current = -1;
  var data = null;
  var order = [];
  var view = "feed";
  var opener = null;
  var reelObs = null;

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function iconBtn(name, label, tag) {
    var b = el(tag || "button", "icon-btn");
    if (!tag) b.type = "button";
    b.innerHTML = I[name];
    b.setAttribute("aria-label", label);
    return b;
  }
  function paint(node, cat) {
    var c = COLORS[cat] || DEFAULT;
    node.style.setProperty("--c", c[0]);
    node.style.setProperty("--c-ink", c[1]);
    node.style.setProperty("--mk", c[2]);
    return node;
  }
  function parts(iso) {
    var p = iso.split("-");
    var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    return { m: +p[1], d: +p[2], w: WEEK[d.getUTCDay()], t: d.getTime() };
  }
  function fmtShort(iso) { var p = parts(iso); return p.m + "월 " + p.d + "일 (" + p.w + ")"; }
  function fmtMD(iso) { var p = parts(iso); return p.m + "월 " + p.d + "일"; }
  function when(pub, today) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(pub || "")) return "";
    var diff = Math.round((parts(today).t - parts(pub).t) / 86400000);
    if (diff === 0) return "오늘";
    if (diff === 1) return "어제";
    if (diff > 1 && diff < 7) return diff + "일 전";
    return fmtMD(pub);
  }
  function initial(s) { return ((s || "?").replace(/\s/g, "").charAt(0)) || "?"; }
  function safeUrl(u) { return /^https?:\/\//i.test(u || "") ? u : null; }
  function getJSON(url) {
    return fetch(url, { cache: "no-store" }).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); });
  }
  function toast(msg) {
    toastEl.textContent = msg; toastEl.classList.add("on");
    clearTimeout(toast.t); toast.t = setTimeout(function () { toastEl.classList.remove("on"); }, 1800);
  }
  function stored(k, fb) { try { return JSON.parse(localStorage.getItem(k) || "null") || fb; } catch (e) { return fb; } }
  function keep(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  // 카드 제목: 짧은 제목이 있으면 그것, 핵심어나 따옴표 안 낱말에 형광펜
  function cardTitle(it) { return (it.card_title || "").trim() || it.title || ""; }
  function sizeClass(t) { return t.length <= 24 ? "l" : t.length <= 38 ? "m" : "s"; }
  function marked(node, it) {
    var t = cardTitle(it);
    var key = (it.keyword || "").trim();
    if (!key || t.indexOf(key) < 0) {
      var q = /['‘"“]([^'’"”]{2,14})['’"”]/.exec(t);
      key = q ? q[0] : "";
    }
    if (!key || t.indexOf(key) < 0) { node.textContent = t; return node; }
    var at = t.indexOf(key);
    node.appendChild(document.createTextNode(t.slice(0, at)));
    node.appendChild(el("mark", null, key));
    node.appendChild(document.createTextNode(t.slice(at + key.length)));
    return node;
  }

  /* 본 소식 · 저장 (이 기기에만 남는다) */
  function seenKey() { return "eb.seen." + dates[current]; }
  function getSeen() { return stored(seenKey(), []); }
  function markSeen(id) { var s = getSeen(); if (s.indexOf(id) < 0) { s.push(id); keep(seenKey(), s); } }
  function itemKey(i) { return dates[current] + "#" + i; }
  function getSaved() { return stored("eb.saved", []); }
  function isSaved(key) { return getSaved().some(function (s) { return s.key === key; }); }
  function toggleSave(it, i) {
    var key = itemKey(i);
    var list = getSaved();
    var at = list.findIndex(function (s) { return s.key === key; });
    if (at >= 0) { list.splice(at, 1); toast("저장을 취소했습니다"); }
    else {
      list.unshift({ key: key, date: dates[current], category: it.category, title: it.title, card_title: it.card_title || "", source: it.source, url: it.url });
      toast("저장했습니다");
    }
    keep("eb.saved", list);
    document.querySelectorAll('[data-save="' + key + '"]').forEach(function (b) {
      var on = isSaved(key);
      b.setAttribute("aria-pressed", String(on));
      b.setAttribute("aria-label", on ? "저장 취소" : "저장");
    });
  }
  function saveBtn(it, i, withLabel) {
    var b = withLabel ? el("button") : iconBtn("save", "저장");
    if (withLabel) { b.type = "button"; b.innerHTML = I.save; b.appendChild(el("span", null, "저장")); }
    var key = itemKey(i);
    b.setAttribute("data-save", key);
    b.setAttribute("aria-pressed", String(isSaved(key)));
    b.setAttribute("aria-label", isSaved(key) ? "저장 취소" : "저장");
    b.addEventListener("click", function (e) { e.stopPropagation(); toggleSave(it, i); });
    return b;
  }
  function share(it) {
    var url = safeUrl(it.url);
    if (!url) return;
    if (navigator.share) { navigator.share({ title: it.title, url: url }).catch(function () {}); return; }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(it.title + "\n" + url).then(function () { toast("원문 링크를 복사했습니다"); }, function () { toast("복사하지 못했습니다"); });
    }
  }

  /* 화면 이동: 오늘(최신) · 지난 날 · 지난 소식 목록 · 저장
     화면을 옮길 때마다 기록을 남겨서 휴대폰의 뒤로 가기와 왼쪽 위 뒤로 버튼이 같은 곳으로 간다 */
  var LOGO = topL.innerHTML;
  function depth() { return (history.state && history.state.depth) || 0; }
  function renderTop() {
    topR.textContent = "";
    var home = view === "feed" && current === 0;
    if (home) topL.innerHTML = LOGO;
    else {
      topL.textContent = "";
      var b = iconBtn("back", "뒤로");
      b.addEventListener("click", goBack);
      topL.appendChild(b);
      topL.appendChild(el("span", "top-title", view === "days" ? "지난 소식" : view === "saved" ? "저장한 소식" : fmtShort(dates[current]) + " 소식"));
    }
    if (view === "feed" && dates.length) {
      if (home && data && data.date === todayKST()) topR.appendChild(el("span", "daylab", "오늘"));
      var c = iconBtn("cal", "지난 소식 고르기");
      c.addEventListener("click", function () { show("days", current, true); });
      topR.appendChild(c);
    }
  }
  function markTabs() {
    var tab = view === "saved" ? "saved" : (view === "days" || current > 0) ? "days" : "today";
    tabbar.querySelectorAll("[data-view]").forEach(function (b) { b.setAttribute("aria-current", b.dataset.view === tab ? "page" : "false"); });
  }
  function urlFor(v, d) { return v === "days" ? "?v=days" : v === "saved" ? "?v=saved" : (d > 0 ? "?d=" + dates[d] : location.pathname); }
  function show(v, d, push) {
    if (d < 0 || d >= dates.length) return;
    try {
      var st = { v: v, d: d, depth: push ? depth() + 1 : depth() };
      if (push) history.pushState(st, "", urlFor(v, d)); else history.replaceState(st, "", urlFor(v, d));
    } catch (e) {}
    function draw() {
      view = v;
      markTabs();
      renderTop();
      if (v === "feed") renderFeed(); else if (v === "days") renderDays(); else renderSaved();
      window.scrollTo(0, 0);
    }
    if (v === "feed" && (d !== current || !data)) load(d).then(draw, function () {});
    else draw();
  }
  function goBack() {
    if (depth() > 0) history.back();
    else show("feed", 0, false);
  }
  tabbar.addEventListener("click", function (e) {
    var b = e.target.closest("button[data-view]");
    if (!b) return;
    var v = b.dataset.view;
    if (v === "today") { if (view === "feed" && current === 0) window.scrollTo({ top: 0, behavior: "smooth" }); else show("feed", 0, true); }
    else if (v !== view) show(v, current, true);
  });
  window.addEventListener("popstate", function (e) {
    if (!reels.hidden) { closeReels(); return; }
    var st = e.state || { v: "feed", d: 0 };
    if (st.reels) { history.back(); return; }
    show(st.v || "feed", st.d || 0, false);
  });

  /* 오늘 화면 */
  function renderFeed() {
    if (!data) return;
    var items = Array.isArray(data.items) ? data.items : [];
    order = [];
    ORDER.concat(items.map(function (it) { return it.category; })).forEach(function (c) {
      items.forEach(function (it, i) { if (it.category === c && order.indexOf(i) < 0) order.push(i); });
    });
    var seen = getSeen();
    feed.textContent = "";
    feed.setAttribute("aria-busy", "false");
    document.title = "교육 브리핑 — " + fmtShort(data.date);

    var row = el("nav", "stories");
    row.setAttribute("aria-label", "분야별로 크게 보기");
    row.appendChild(story("요약", "오늘 요약", "today", seen.indexOf("today") >= 0, "학원 운영", 0));
    var cats = [];
    order.forEach(function (i) { if (cats.indexOf(items[i].category) < 0) cats.push(items[i].category); });
    cats.forEach(function (c) {
      var idx = order.filter(function (i) { return items[i].category === c; });
      var allSeen = idx.every(function (i) { return seen.indexOf("i" + i) >= 0; });
      row.appendChild(story(SHORT[c] || c.slice(0, 2), LABEL[c] || c, c, allSeen, c, 1 + order.indexOf(idx[0])));
    });
    feed.appendChild(row);
    feed.appendChild(digest(items));

    if (!items.length) {
      var e = el("div", "empty-note");
      e.appendChild(el("b", null, "오늘은 새 소식이 없습니다"));
      e.appendChild(document.createTextNode(data.note || ""));
      feed.appendChild(e);
    }
    if (items.length) feed.appendChild(el("h2", "sec-h", "카드로 보기"));
    order.forEach(function (i, n) { feed.appendChild(post(items[i], i, n)); });
    feed.appendChild(caught(items));
  }

  /* 한눈에 보기: 날짜, 건수, 소식마다 제목과 확인할 것. 한 화면에서 그날 브리핑을 다 훑는다 */
  function todayKST() { return new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10); }
  function digest(items) {
    var sec = el("section", "digest");
    var p = parts(data.date);
    var h = el("h1", "d-date", p.m + "월 " + p.d + "일 " + p.w + "요일");
    h.appendChild(el("span", "sr", " 교육 브리핑"));
    sec.appendChild(h);
    var todos = items.filter(function (it) { return (it.why || "").trim(); }).length;
    sec.appendChild(el("p", "d-count", items.length ? "소식 " + items.length + "건" + (todos ? " · 확인할 일 " + todos + "가지" : "") : "새 소식 없음"));
    if (current === 0 && data.date < todayKST()) {
      sec.appendChild(el("p", "d-stale", "오늘 브리핑은 아직 올라오지 않았습니다. 보통 아침 7시쯤 올라옵니다. 아래는 " + fmtMD(data.date) + " 소식입니다."));
    }
    if (!items.length) return sec;
    var ol = el("ol", "d-list");
    order.forEach(function (i, n) {
      var it = items[i];
      var li = el("li");
      var b = paint(el("button", "d-row"), it.category);
      b.type = "button";
      b.appendChild(el("span", "d-cat", SHORT[it.category] || (it.category || "소식").slice(0, 2)));
      var t = el("span", "d-txt");
      t.appendChild(el("b", null, cardTitle(it)));
      if ((it.why || "").trim()) {
        var w = el("span", "d-why");
        w.appendChild(el("i", null, "확인"));
        w.appendChild(document.createTextNode(it.why));
        t.appendChild(w);
      }
      b.appendChild(t);
      b.setAttribute("aria-label", (LABEL[it.category] || it.category || "소식") + ": " + it.title + ". 크게 보기");
      b.addEventListener("click", function () { openReels(1 + n, b); });
      li.appendChild(b);
      ol.appendChild(li);
    });
    sec.appendChild(ol);
    return sec;
  }

  function story(text, label, cat, seen, colorOf, at) {
    var b = el("button", "story" + (seen ? " seen" : ""));
    b.type = "button";
    b.setAttribute("data-cat", cat);
    b.setAttribute("aria-label", label + " 크게 보기");
    var ring = el("span", "ring"), inner = el("span", "in", text);
    ring.appendChild(inner);
    b.appendChild(ring);
    b.appendChild(el("span", "lab", label));
    if (cat === "today") { b.style.setProperty("--c", "#111111"); b.style.setProperty("--c-ink", "#ffffff"); }
    else paint(b, colorOf);
    b.addEventListener("click", function () { openReels(at, b); });
    return b;
  }

  function post(it, i, n) {
    var art = paint(el("article", "post"), it.category);
    art.setAttribute("aria-labelledby", "t" + i);
    var head = el("div", "p-head");
    head.appendChild(el("span", "av", initial(it.source)));
    var who = el("div", "who");
    who.appendChild(el("b", null, it.source || "출처 미상"));
    who.appendChild(el("span", null, (LABEL[it.category] || it.category || "소식") + (it.published ? " · " + when(it.published, data.date) : "")));
    head.appendChild(who);
    art.appendChild(head);

    var url = safeUrl(it.url);
    var hasTodo = !!(it.why || "").trim();
    var total = hasTodo ? 2 : 1;
    var car = el("div", "carousel");
    var track = el("div", "track");
    var cover = el("button", "slide");
    cover.type = "button";
    cover.setAttribute("aria-label", "크게 보기: " + it.title);
    cover.appendChild(el("span", "tag", it.category || "소식"));
    if (total > 1) cover.appendChild(el("span", "pg", "1/" + total));
    var h = marked(el("h2", sizeClass(cardTitle(it))), it);
    h.id = "t" + i;
    cover.appendChild(h);
    var foot = el("span", "foot");
    foot.appendChild(el("span", null, (it.source || "") + (it.published ? " · " + fmtMD(it.published) : "")));
    if (total > 1) foot.appendChild(el("span", null, "옆으로 넘겨 보기 →"));
    cover.appendChild(foot);
    cover.addEventListener("click", function () { openReels(1 + n, cover); });
    track.appendChild(cover);
    if (hasTodo) {
      var todo = el("div", "slide todo");
      todo.appendChild(el("span", "pg", "2/2"));
      todo.appendChild(el("span", "lab", "확인할 것"));
      todo.appendChild(el("p", null, it.why));
      if (url) { var go = el("a", "go", "원문 보기"); go.href = url; go.target = "_blank"; go.rel = "noopener noreferrer"; go.setAttribute("aria-label", "원문 보기 (새 창): " + it.title); todo.appendChild(go); }
      track.appendChild(todo);
    }
    car.appendChild(track);
    art.appendChild(car);

    var acts = el("div", "acts acts-wrap");
    if (url) {
      var a = iconBtn("open", "원문 보기 (새 창)", "a");
      a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer";
      acts.appendChild(a);
      var s = iconBtn("share", "원문 링크 보내기");
      s.addEventListener("click", function () { share(it); });
      acts.appendChild(s);
    }
    if (total > 1) {
      var dots = el("span", "dots");
      dots.setAttribute("aria-hidden", "true");
      for (var k = 0; k < total; k++) dots.appendChild(el("i", k === 0 ? "on" : ""));
      acts.appendChild(dots);
      track.addEventListener("scroll", function () {
        var at = Math.round(track.scrollLeft / track.clientWidth);
        dots.querySelectorAll("i").forEach(function (d, j) { d.className = j === at ? "on" : ""; });
      }, { passive: true });
    }
    var sb = saveBtn(it, i, false);
    sb.classList.add("end");
    acts.appendChild(sb);
    art.appendChild(acts);

    var cap = el("p", "cap");
    cap.appendChild(el("b", null, it.source || ""));
    cap.appendChild(el("span", "txt", it.summary || ""));
    art.appendChild(cap);
    if ((it.summary || "").length > 60) {
      cap.classList.add("clamp");
      var more = el("button", "more", "더 보기");
      more.type = "button";
      more.setAttribute("aria-expanded", "false");
      more.addEventListener("click", function () {
        var closed = cap.classList.toggle("clamp");
        more.textContent = closed ? "더 보기" : "접기";
        more.setAttribute("aria-expanded", String(!closed));
      });
      art.appendChild(more);
    }
    if (it.published) art.appendChild(el("span", "when", "보도 " + fmtShort(it.published)));
    return art;
  }

  function caught(items) {
    var sec = el("section", "caught");
    sec.setAttribute("aria-labelledby", "caught-h");
    var c = el("span", "check"); c.innerHTML = I.check; sec.appendChild(c);
    var h = el("h2", null, items.length ? "오늘 소식을 모두 봤습니다" : "오늘은 여기까지입니다");
    h.id = "caught-h"; sec.appendChild(h);
    var notes = [];
    if (data.note && items.length) notes.push(data.note);
    if (Array.isArray(data.sources_failed) && data.sources_failed.length) notes.push("이번에 읽지 못한 출처: " + data.sources_failed.join(", "));
    if (notes.length) sec.appendChild(el("p", null, notes.join(" ")));
    var prev = el("button", "btn", "전날 소식 보기");
    prev.type = "button";
    prev.disabled = current >= dates.length - 1;
    prev.addEventListener("click", function () { go(current + 1); });
    sec.appendChild(prev);
    sec.appendChild(el("p", "fine", "공개된 보도자료와 기사를 자동으로 모아 AI가 요약했습니다. 요약에 잘못이 있을 수 있으니 중요한 내용은 원문에서 확인하세요. \"학원가 소식\"은 개인 블로그 글을 바탕으로 하며 사실과 다를 수 있습니다. 기사와 자료의 저작권은 각 출처에 있습니다."));
    sec.appendChild(el("p", "fine", "방문자 정보와 쿠키를 쓰지 않습니다. 본 소식과 저장 목록은 이 기기에만 남습니다. 글꼴만 jsDelivr에서 불러옵니다."));
    return sec;
  }

  /* 지난 소식 */
  function renderDays() {
    feed.textContent = "";
    feed.appendChild(el("h1", "list-h", "지난 소식"));
    var rows = el("div", "rows");
    dates.forEach(function (d, k) {
      var b = el("button", "row");
      b.type = "button";
      if (k === current) b.setAttribute("aria-current", "true");
      var p = parts(d);
      b.appendChild(el("span", "thumb day", String(p.d)));
      var t = el("span", "t");
      t.appendChild(el("b", null, p.m + "월 " + p.d + "일 " + p.w + "요일"));
      t.appendChild(el("span", null, k === 0 ? "가장 최근 브리핑" : (k === current ? "지금 보는 날" : "")));
      b.appendChild(t);
      b.addEventListener("click", function () { go(k); });
      rows.appendChild(b);
    });
    feed.appendChild(rows);
  }

  /* 저장 */
  function renderSaved() {
    feed.textContent = "";
    feed.appendChild(el("h1", "list-h", "저장한 소식"));
    var list = getSaved();
    if (!list.length) {
      var e = el("div", "empty-note");
      e.appendChild(el("b", null, "저장한 소식이 없습니다"));
      e.appendChild(document.createTextNode("카드 아래 책갈피를 누르면 여기에 모입니다. 이 기기에만 저장됩니다."));
      feed.appendChild(e);
      return;
    }
    var rows = el("div", "rows");
    list.forEach(function (s) {
      var url = safeUrl(s.url);
      var a = el(url ? "a" : "div", "row");
      if (url) { a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer"; }
      paint(a, s.category);
      a.appendChild(el("span", "thumb", (s.card_title || s.title || "").slice(0, 22)));
      var t = el("span", "t");
      t.appendChild(el("b", null, s.title));
      t.appendChild(el("span", null, (s.source || "") + " · " + fmtMD(s.date)));
      a.appendChild(t);
      rows.appendChild(a);
    });
    feed.appendChild(rows);
  }

  /* 릴스: 요약 → 소식 → 끝 */
  function openReels(at, from) {
    if (!data) return;
    opener = from || null;
    var items = data.items || [];
    reels.textContent = "";
    var bar = el("div", "r-bar"), barIn = el("div", "r-bar-in");
    barIn.appendChild(el("span", "ttl", fmtMD(data.date) + " 소식"));
    var x = iconBtn("close", "닫기");
    x.addEventListener("click", requestClose);
    barIn.appendChild(x);
    bar.appendChild(barIn);
    var track = el("div", "r-track");
    var list = [];

    // 요약
    var sr = el("section", "reel sum-reel"); sr.dataset.id = "today";
    var si = el("div", "reel-in");
    var todos = order.filter(function (i) { return (items[i].why || "").trim(); });
    si.appendChild(el("h2", "bigt m", items.length ? "소식 " + items.length + "건" + (todos.length ? ", 확인할 일 " + todos.length + "가지" : "") : "오늘은 새 소식이 없습니다"));
    if (data.headline) si.appendChild(el("p", "head2", data.headline));
    if (todos.length) {
      var ul = el("ul");
      todos.forEach(function (i) {
        var li = paint(el("li"), items[i].category);
        li.appendChild(el("b", null, LABEL[items[i].category] || items[i].category));
        li.appendChild(document.createTextNode(items[i].why));
        ul.appendChild(li);
      });
      si.appendChild(ul);
    }
    sr.appendChild(si); track.appendChild(sr); list.push(sr);

    order.forEach(function (i, n) {
      var it = items[i];
      var r = paint(el("section", "reel"), it.category);
      r.dataset.id = "i" + i;
      r.setAttribute("aria-label", (n + 1) + "번째 소식: " + it.title);
      var inn = el("div", "reel-in");
      inn.appendChild(marked(el("h2", "bigt " + sizeClass(cardTitle(it))), it));
      var low = el("div", "low");
      var txt = el("div", "txt");
      var src = el("div", "src");
      src.appendChild(el("span", "av", initial(it.source)));
      src.appendChild(el("span", null, it.source || ""));
      src.appendChild(el("span", "chip", LABEL[it.category] || it.category));
      txt.appendChild(src);
      var sum = el("p", "sum", it.summary || "");
      txt.appendChild(sum);
      if ((it.summary || "").length > 90) {
        sum.classList.add("clamp");
        var mb = el("button", "sum-more", "더 보기");
        mb.type = "button";
        mb.addEventListener("click", function () { var c = sum.classList.toggle("clamp"); mb.textContent = c ? "더 보기" : "접기"; });
        txt.appendChild(mb);
      }
      if ((it.why || "").trim()) {
        var td = el("div", "todo");
        td.appendChild(el("b", null, "확인할 것"));
        td.appendChild(document.createTextNode(it.why));
        txt.appendChild(td);
      }
      low.appendChild(txt);
      var side = el("div", "side");
      var url = safeUrl(it.url);
      if (url) {
        var a = el("a"); a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer";
        a.innerHTML = I.open; a.appendChild(el("span", null, "원문"));
        a.setAttribute("aria-label", "원문 보기 (새 창)");
        side.appendChild(a);
        var s = el("button"); s.type = "button"; s.innerHTML = I.share; s.appendChild(el("span", null, "공유"));
        s.setAttribute("aria-label", "원문 링크 보내기");
        s.addEventListener("click", function () { share(it); });
        side.appendChild(s);
      }
      side.appendChild(saveBtn(it, i, true));
      side.appendChild(el("span", "n", (n + 1) + "/" + order.length));
      low.appendChild(side);
      inn.appendChild(low);
      r.appendChild(inn);
      track.appendChild(r); list.push(r);
    });

    var er = el("section", "reel end-reel"); er.dataset.id = "end";
    var ei = el("div", "reel-in");
    var ck = el("span", "check"); ck.innerHTML = I.check;
    ck.style.cssText = "width:72px;height:72px;border-radius:50%;border:2px solid #fff;display:grid;place-items:center";
    ck.querySelector("svg").style.cssText = "width:34px;height:34px;fill:none;stroke:#fff;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round";
    ei.appendChild(ck);
    ei.appendChild(el("h2", "bigt s", "오늘 소식을 모두 봤습니다"));
    var back = el("button", "btn", "닫기"); back.type = "button"; back.addEventListener("click", requestClose);
    ei.appendChild(back);
    er.appendChild(ei); track.appendChild(er); list.push(er);

    reels.appendChild(track);
    reels.appendChild(bar);
    reels.hidden = false;
    document.body.style.overflow = "hidden";
    var target = list[Math.max(0, Math.min(at, list.length - 1))];
    track.scrollTop = target.offsetTop;
    if (reelObs) reelObs.disconnect();
    if ("IntersectionObserver" in window) {
      reelObs = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting && e.target.dataset.id !== "end") markSeen(e.target.dataset.id); });
      }, { root: track, threshold: 0.6 });
      list.forEach(function (r) { reelObs.observe(r); });
    }
    reels.__track = track; reels.__list = list;
    reelsPushed = false;
    try { history.pushState({ v: view, d: current, depth: depth() + 1, reels: true }, "", location.href.split("#")[0]); reelsPushed = true; } catch (e) {}
    document.addEventListener("keydown", onKey);
    x.focus();
  }
  var reelsPushed = false;
  function requestClose() { if (reelsPushed) history.back(); else closeReels(); }
  function closeReels() {
    reelsPushed = false;
    if (reelObs) reelObs.disconnect();
    reels.hidden = true;
    reels.textContent = "";
    document.body.style.overflow = "";
    document.removeEventListener("keydown", onKey);
    refreshSeen();
    if (opener && opener.isConnected) opener.focus();
  }
  function onKey(e) {
    var tr = reels.__track, list = reels.__list;
    if (e.key === "Escape") { e.preventDefault(); requestClose(); return; }
    if (!tr) return;
    var at = Math.round(tr.scrollTop / tr.clientHeight);
    if (e.key === "ArrowDown" || e.key === "PageDown" || e.key === "j") { e.preventDefault(); if (list[at + 1]) tr.scrollTo({ top: list[at + 1].offsetTop, behavior: "smooth" }); }
    else if (e.key === "ArrowUp" || e.key === "PageUp" || e.key === "k") { e.preventDefault(); if (list[at - 1]) tr.scrollTo({ top: list[at - 1].offsetTop, behavior: "smooth" }); }
    else if (e.key === "Tab") {
      var f = reels.querySelectorAll("button, a[href]");
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  }
  function refreshSeen() {
    var items = (data && data.items) || [];
    var seen = getSeen();
    feed.querySelectorAll(".story").forEach(function (b) {
      var c = b.getAttribute("data-cat");
      var done = c === "today" ? seen.indexOf("today") >= 0
        : items.every(function (it, i) { return it.category !== c || seen.indexOf("i" + i) >= 0; });
      b.classList.toggle("seen", done);
    });
  }

  /* 불러오기 */
  function message(title, body) {
    feed.textContent = "";
    feed.setAttribute("aria-busy", "false");
    var e = el("div", "empty-note");
    var h = el("h1", null, title); h.style.fontSize = "18px"; e.appendChild(h);
    if (body) e.appendChild(document.createTextNode(body));
    feed.appendChild(e);
  }
  function load(i) {
    current = i;
    feed.setAttribute("aria-busy", "true");
    return getJSON("briefings/" + dates[i] + ".json").then(function (d) {
      if (current !== i) throw new Error("stale");
      data = d;
    }).catch(function (err) {
      if (current === i) message("이 날짜의 브리핑을 불러오지 못했습니다", "잠시 뒤 다시 열어 보세요.");
      throw err;
    });
  }
  function go(i) { show("feed", i, true); }

  getJSON("briefings/index.json").then(function (index) {
    dates = (index.dates || []).filter(function (d) { return /^\d{4}-\d{2}-\d{2}$/.test(d); });
    if (!dates.length) { message("아직 브리핑이 없습니다", "첫 브리핑은 다음 날 아침 7시쯤 올라옵니다."); return; }
    var q = new URLSearchParams(location.search);
    var start = Math.max(0, dates.indexOf(q.get("d")));
    var v = q.get("v") === "days" || q.get("v") === "saved" ? q.get("v") : "feed";
    var deep = location.hash === "#reels";
    load(start).then(function () {
      show(v, start, false);
      if (deep && v === "feed") openReels(1);
    }, function () {});
  }).catch(function () {
    message("브리핑 목록을 불러오지 못했습니다", "인터넷 연결을 확인하고 새로 고침해 주세요.");
  });
})();
