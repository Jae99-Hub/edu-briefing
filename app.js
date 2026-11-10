(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var elDate = $("date"), elHead = $("headline"), elList = $("list"), elNote = $("note");
  var elPrev = $("prev"), elNext = $("next"), elDates = $("dates");
  var dates = [];
  var current = -1;
  var WEEK = ["일", "월", "화", "수", "목", "금", "토"];

  function fmt(iso) {
    var p = iso.split("-");
    var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    return p[0] + "년 " + (+p[1]) + "월 " + (+p[2]) + "일 " + WEEK[d.getUTCDay()] + "요일";
  }
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
  function safeUrl(u) {
    return /^https?:\/\//i.test(u || "") ? u : null;
  }

  function showMessage(title, body) {
    elHead.textContent = title;
    elList.textContent = "";
    elList.setAttribute("aria-busy", "false");
    if (body) elList.appendChild(el("p", "empty", body));
    elNote.hidden = true;
  }

  function render(data) {
    elDate.textContent = fmt(data.date);
    var items = Array.isArray(data.items) ? data.items : [];
    elHead.textContent = data.headline || (items.length ? "오늘의 교육 소식 " + items.length + "건" : "오늘은 새 소식이 없습니다");
    document.title = "교육 브리핑 — " + data.date;
    elList.textContent = "";
    elList.setAttribute("aria-busy", "false");

    items.forEach(function (it) {
      var art = el("article", "item");
      var meta = el("div", "meta");
      var tag = el("span", "tag" + (it.category === "학원가 소식" ? " blog" : ""), it.category || "소식");
      meta.appendChild(tag);
      if (it.source) meta.appendChild(el("span", null, it.source));
      if (it.published) meta.appendChild(el("span", null, it.published));
      art.appendChild(meta);
      art.appendChild(el("h2", null, it.title || ""));
      art.appendChild(el("p", null, it.summary || ""));
      if (it.why) art.appendChild(el("p", "why", it.why));
      var url = safeUrl(it.url);
      if (url) {
        var src = el("p", "src");
        var a = el("a", null, "원문 보기");
        a.href = url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.setAttribute("aria-label", "원문 보기: " + (it.title || "") + " (새 창)");
        src.appendChild(a);
        art.appendChild(src);
      }
      elList.appendChild(art);
    });

    var notes = [];
    if (data.note) notes.push(data.note);
    if (Array.isArray(data.sources_failed) && data.sources_failed.length) {
      notes.push("이번에 읽지 못한 출처: " + data.sources_failed.join(", "));
    }
    elNote.textContent = notes.join(" ");
    elNote.hidden = notes.length === 0;
  }

  function load(i) {
    if (i < 0 || i >= dates.length) return;
    current = i;
    elDates.value = dates[i];
    elPrev.disabled = i >= dates.length - 1;
    elNext.disabled = i <= 0;
    elList.setAttribute("aria-busy", "true");
    getJSON("briefings/" + dates[i] + ".json").then(function (data) {
      if (current !== i) return;
      render(data);
      try { history.replaceState(null, "", i === 0 ? location.pathname : "?d=" + dates[i]); } catch (e) {}
    }).catch(function () {
      if (current !== i) return;
      elDate.textContent = fmt(dates[i]);
      showMessage("이 날짜의 브리핑을 불러오지 못했습니다", "잠시 뒤 다시 열어 보세요.");
    });
  }

  elPrev.addEventListener("click", function () { load(current + 1); });
  elNext.addEventListener("click", function () { load(current - 1); });
  elDates.addEventListener("change", function () { load(dates.indexOf(elDates.value)); });

  getJSON("briefings/index.json").then(function (index) {
    dates = (index.dates || []).filter(function (d) { return /^\d{4}-\d{2}-\d{2}$/.test(d); });
    if (!dates.length) {
      elDate.textContent = "";
      showMessage("아직 브리핑이 없습니다", "첫 브리핑은 다음 날 아침 7시쯤 올라옵니다.");
      return;
    }
    dates.forEach(function (d) {
      var o = el("option", null, fmt(d));
      o.value = d;
      elDates.appendChild(o);
    });
    elDates.disabled = false;
    var want = new URLSearchParams(location.search).get("d");
    var start = dates.indexOf(want);
    load(start >= 0 ? start : 0);
  }).catch(function () {
    elDate.textContent = "";
    showMessage("브리핑 목록을 불러오지 못했습니다", "인터넷 연결을 확인하고 새로 고침해 주세요.");
  });
})();
