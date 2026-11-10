(function () {
  "use strict";
  var reel = document.getElementById("reel");
  var dots = document.getElementById("dots");
  var dates = [];
  var current = -1;
  var observer = null;
  var WEEK = ["일", "월", "화", "수", "목", "금", "토"];
  // 가장 먼저 챙기는 분야: 노란색으로 표시한다
  var PRIORITY = { "교과서 · 교육과정": 1, "중학 영어 · 내신": 1 };
  var CATEGORIES = ["교과서 · 교육과정", "중학 영어 · 내신", "학원가 소식", "학원 운영", "에듀테크 · AI", "정책 · 제도", "입시 · 고입"];
  var UP = '<svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 12.5 10 7l5.5 5.5"/></svg>';

  function parts(iso) {
    var p = iso.split("-");
    var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    return { m: +p[1], d: +p[2], w: WEEK[d.getUTCDay()] };
  }
  function fmtShort(iso) { var p = parts(iso); return p.m + "월 " + p.d + "일 (" + p.w + ")"; }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function getJSON(url) {
    return fetch(url, { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
  }
  function safeUrl(u) { return /^https?:\/\//i.test(u || "") ? u : null; }
  function goTo(node) {
    var smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    node.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
  }

  function dayNav() {
    var nav = el("div", "daynav");
    var prev = el("button", null, "‹");
    prev.type = "button";
    prev.setAttribute("aria-label", "전날 브리핑");
    prev.disabled = current >= dates.length - 1;
    prev.addEventListener("click", function () { load(current + 1); });
    var sel = el("select");
    sel.setAttribute("aria-label", "날짜 고르기");
    dates.forEach(function (d) {
      var o = el("option", null, fmtShort(d));
      o.value = d;
      sel.appendChild(o);
    });
    sel.value = dates[current];
    sel.addEventListener("change", function () { load(dates.indexOf(sel.value)); });
    var next = el("button", null, "›");
    next.type = "button";
    next.setAttribute("aria-label", "다음 날 브리핑");
    next.disabled = current <= 0;
    next.addEventListener("click", function () { load(current - 1); });
    nav.appendChild(prev); nav.appendChild(sel); nav.appendChild(next);
    return nav;
  }

  function overview(data, items, cards) {
    var sec = el("section", "page overview");
    var bar = el("div", "daybar");
    bar.appendChild(el("div", "brand", "교육 브리핑"));
    if (dates.length) bar.appendChild(dayNav());
    sec.appendChild(bar);

    var todos = items.filter(function (it) { return (it.why || "").trim(); });
    var big = items.length ? "오늘 " + items.length + "건" : "오늘은 새 소식이 없습니다";
    if (todos.length) big += ", 확인할 일 " + todos.length + "가지";
    sec.appendChild(el("h1", "big", big));
    if (data.headline) sec.appendChild(el("p", "headline", data.headline));

    var counts = {};
    items.forEach(function (it) { counts[it.category] = (counts[it.category] || 0) + 1; });
    var names = CATEGORIES.concat(Object.keys(counts).filter(function (c) { return CATEGORIES.indexOf(c) < 0; }));
    var tiles = el("div", "tiles");
    var empty = [];
    names.forEach(function (name) {
      if (!counts[name]) { if (CATEGORIES.indexOf(name) >= 0) empty.push(name); return; }
      var t = el("button", "tile" + (PRIORITY[name] ? " pri" : ""));
      t.type = "button";
      t.appendChild(el("span", "name", name));
      t.appendChild(el("span", "num", String(counts[name])));
      t.setAttribute("aria-label", name + " " + counts[name] + "건 보기");
      t.addEventListener("click", function () {
        for (var i = 0; i < items.length; i++) if (items[i].category === name) { goTo(cards[i]); break; }
      });
      tiles.appendChild(t);
    });
    if (tiles.children.length) sec.appendChild(tiles);
    if (empty.length && items.length) {
      var none = el("p", "none");
      none.appendChild(el("b", null, "오늘 소식 없음 "));
      none.appendChild(document.createTextNode(empty.join(", ")));
      sec.appendChild(none);
    }

    if (todos.length) {
      var box = el("div", "todo-list");
      box.appendChild(el("div", "label", "확인할 것"));
      var ol = el("ol");
      todos.slice(0, 3).forEach(function (it) { ol.appendChild(el("li", null, it.why)); });
      box.appendChild(ol);
      sec.appendChild(box);
    }
    if (!items.length && data.note) sec.appendChild(el("p", "headline", data.note));

    var hint = el("div", "hint");
    hint.innerHTML = UP;
    hint.appendChild(el("div", null, items.length ? "위로 밀어 첫 소식 보기" : "위로 밀면 지난 브리핑으로 갈 수 있습니다"));
    sec.appendChild(hint);
    return sec;
  }

  function card(it, i, n, date) {
    var pri = !!PRIORITY[it.category];
    var sec = el("section", "page card " + (pri ? "pri" : "plain"));
    var top = el("div", "cardtop");
    top.appendChild(el("div", null, fmtShort(date)));
    top.appendChild(el("div", null, (i + 1) + " / " + n));
    sec.appendChild(top);

    var mid = el("div", "cardmid");
    mid.appendChild(el("div", "chip", it.category || "소식"));
    mid.appendChild(el("h2", null, it.title || ""));
    mid.appendChild(el("p", "summary", it.summary || ""));
    if ((it.why || "").trim()) {
      var todo = el("div", "todo");
      todo.appendChild(el("div", "label", "확인할 것"));
      todo.appendChild(el("div", "text", it.why));
      mid.appendChild(todo);
    }
    sec.appendChild(mid);

    var bot = el("div", "cardbot");
    bot.appendChild(el("div", "src", [it.source, it.published].filter(Boolean).join(" · ")));
    var url = safeUrl(it.url);
    if (url) {
      var a = el("a", "btn", "원문 보기");
      a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer";
      a.setAttribute("aria-label", "원문 보기: " + (it.title || "") + " (새 창)");
      bot.appendChild(a);
    }
    sec.appendChild(bot);
    return sec;
  }

  function endPage(data) {
    var sec = el("section", "page end");
    sec.appendChild(el("h2", null, "오늘 브리핑은 여기까지"));
    var notes = [];
    if (data.note) notes.push(data.note);
    if (Array.isArray(data.sources_failed) && data.sources_failed.length) {
      notes.push("이번에 읽지 못한 출처: " + data.sources_failed.join(", "));
    }
    if (notes.length) sec.appendChild(el("p", null, notes.join(" ")));
    var prev = el("button", "btn ghost", "전날 브리핑 보기");
    prev.type = "button";
    prev.disabled = current >= dates.length - 1;
    prev.addEventListener("click", function () { load(current + 1); });
    sec.appendChild(prev);
    sec.appendChild(el("p", "fine", "공개된 보도자료와 기사를 자동으로 모아 AI가 요약했습니다. 요약에 잘못이 있을 수 있으니 중요한 내용은 원문에서 확인하세요. \"학원가 소식\"은 개인 블로그 글을 바탕으로 하며 사실과 다를 수 있습니다. 기사와 자료의 저작권은 각 출처에 있습니다."));
    sec.appendChild(el("p", "fine", "이 사이트는 방문자 정보를 수집하지 않고 쿠키와 분석 도구를 쓰지 않습니다. 제목 글꼴만 Google Fonts에서 불러옵니다."));
    return sec;
  }

  function watch(pages) {
    if (observer) observer.disconnect();
    dots.textContent = "";
    var marks = pages.map(function () { return dots.appendChild(el("i")); });
    if (!("IntersectionObserver" in window)) { marks[0].className = "on"; return; }
    observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var i = pages.indexOf(e.target);
        marks.forEach(function (m, k) { m.className = k === i ? "on" : ""; });
        dots.className = "dots" + (/\b(pri|plain)\b/.test(e.target.className) ? " dark" : "");
      });
    }, { root: reel, threshold: 0.6 });
    pages.forEach(function (p) { observer.observe(p); });
  }

  function render(data) {
    var items = Array.isArray(data.items) ? data.items : [];
    var cards = items.map(function (it, i) { return card(it, i, items.length, data.date); });
    var pages = [overview(data, items, cards)].concat(cards, [endPage(data)]);
    reel.textContent = "";
    pages.forEach(function (p) { reel.appendChild(p); });
    reel.scrollTop = 0;
    reel.setAttribute("aria-busy", "false");
    document.title = "교육 브리핑 — " + data.date;
    watch(pages);
  }

  function message(title, body) {
    reel.textContent = "";
    var sec = el("section", "page overview");
    var bar = el("div", "daybar");
    bar.appendChild(el("div", "brand", "교육 브리핑"));
    if (dates.length && current >= 0) bar.appendChild(dayNav());
    sec.appendChild(bar);
    sec.appendChild(el("h1", "big", title));
    if (body) sec.appendChild(el("p", "headline", body));
    reel.appendChild(sec);
    reel.setAttribute("aria-busy", "false");
    dots.textContent = "";
  }

  function load(i) {
    if (i < 0 || i >= dates.length) return;
    current = i;
    reel.setAttribute("aria-busy", "true");
    getJSON("briefings/" + dates[i] + ".json").then(function (data) {
      if (current !== i) return;
      render(data);
      try { history.replaceState(null, "", i === 0 ? location.pathname : "?d=" + dates[i]); } catch (e) {}
    }).catch(function () {
      if (current !== i) return;
      message("이 날짜의 브리핑을 불러오지 못했습니다", "잠시 뒤 다시 열어 보세요.");
    });
  }

  getJSON("briefings/index.json").then(function (index) {
    dates = (index.dates || []).filter(function (d) { return /^\d{4}-\d{2}-\d{2}$/.test(d); });
    if (!dates.length) { message("아직 브리핑이 없습니다", "첫 브리핑은 다음 날 아침 7시쯤 올라옵니다."); return; }
    var want = new URLSearchParams(location.search).get("d");
    var start = dates.indexOf(want);
    load(start >= 0 ? start : 0);
  }).catch(function () {
    message("브리핑 목록을 불러오지 못했습니다", "인터넷 연결을 확인하고 새로 고침해 주세요.");
  });
})();
