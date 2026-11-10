#!/usr/bin/env python3
"""출처에서 최근 소식 후보를 모아 JSON으로 출력한다. 표준 라이브러리만 쓴다.

사용법: python routine/fetch_sources.py [--days 2] [--out candidates.json]

- 네이버 검색: 환경 변수 NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 이 있으면 헤더로 보낸다.
  없으면 헤더 없이 호출한다 (Claude 클라우드에서는 네트워크 시크릿이 자동으로 붙는다).
- 지난 7일 브리핑에 이미 실린 주소는 후보에서 뺀다.
"""
import argparse
import datetime as dt
import email.utils
import html
import json
import os
import re
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KST = dt.timezone(dt.timedelta(hours=9))
UA = "Mozilla/5.0 (compatible; edu-briefing/1.0)"

RSS_SOURCES = [
    # (묶음, 출처 이름, 주소, 최대 건수)
    ("교육 전문 언론", "한국교육신문", "https://www.hangyo.com/data/rss/news.xml", 15),
    ("교육 전문 언론", "베리타스알파", "https://www.veritas-a.com/rss/allArticle.xml", 15),
    ("교육 전문 언론", "에듀프레스", "https://www.edupress.kr/rss/allArticle.xml", 15),
    ("교육 전문 언론", "에듀인뉴스", "https://www.eduinnews.co.kr/rss/allArticle.xml", 15),
    ("일반 언론", "연합뉴스 사회", "https://www.yna.co.kr/rss/society.xml", 12),
]
NAVER_NEWS_QUERIES = [
    "교육부 중학교",
    "중학교 내신 평가",
    "고입 전형 중학교",
    "학원 교습비",
    "사교육비 대책",
    "서울시교육청 중학교",
    "경기도교육청 중학교",
    "중학교 영어 교육",
]
NAVER_QUERIES = [
    "중학교 영어 내신 기말고사 분석",
    "중등 영어 수행평가",
    "중학교 영어 교과서 2022 개정",
    "고입 영어 내신 경기",
]
EDU_WORDS = re.compile(r"교육|학교|학생|교사|교원|수능|입시|고입|내신|학원|교과|수업|대입|학년|교실|급식|돌봄")


def http_get(url, headers=None, timeout=20):
    h = {"User-Agent": UA}
    if headers:
        h.update(headers)
    req = urllib.request.Request(url, headers=h)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        raw = r.read()
    for enc in ("utf-8", "cp949"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", "replace")


def clean(s):
    s = re.sub(r"<[^>]+>", " ", s or "")
    return re.sub(r"\s+", " ", html.unescape(s)).strip()


def parse_date(s):
    """여러 형식의 날짜를 KST 날짜(YYYY-MM-DD)로 바꾼다. 못 읽으면 None."""
    if not s:
        return None
    s = s.strip()
    m = re.search(r"(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})", s)
    try:
        d = email.utils.parsedate_to_datetime(s)
        if d.tzinfo is None:
            d = d.replace(tzinfo=KST)
        return d.astimezone(KST).date().isoformat()
    except Exception:
        pass
    if m:
        return "%04d-%02d-%02d" % (int(m.group(1)), int(m.group(2)), int(m.group(3)))
    m = re.fullmatch(r"(\d{4})(\d{2})(\d{2})", s)
    if m:
        return "-".join(m.groups())
    return None


def from_rss(group, name, url, limit):
    out = []
    root = ET.fromstring(http_get(url).lstrip("﻿").encode("utf-8"))
    for it in root.iter("item"):
        title = clean(it.findtext("title"))
        link = (it.findtext("link") or "").strip()
        if not title or not link:
            continue
        out.append({
            "group": group, "source": name, "title": title, "url": link,
            "date": parse_date(it.findtext("pubDate") or it.findtext("{http://purl.org/dc/elements/1.1/}date")),
            "snippet": clean(it.findtext("description"))[:300],
        })
        if len(out) >= limit * 4:
            break
    return out


def naver_headers():
    cid, sec = os.environ.get("NAVER_CLIENT_ID"), os.environ.get("NAVER_CLIENT_SECRET")
    if cid and sec:
        return {"X-NCP-APIGW-API-KEY-ID": cid, "X-NCP-APIGW-API-KEY": sec}
    return {}


def from_naver_news(query, limit=30):
    """네이버 뉴스 검색. originallink 가 언론사 원문 주소다."""
    url = ("https://naverapihub.apigw.ntruss.com/search/v1/news?query=%s&display=%d&sort=sim&format=json"
           % (urllib.parse.quote(query), limit))
    data = json.loads(http_get(url, naver_headers()))
    out = []
    for it in data.get("items", []):
        link = it.get("originallink") or it.get("link") or ""
        host = urllib.parse.urlparse(link).netloc.replace("www.", "")
        out.append({
            "group": "일반 언론", "source": "뉴스 검색(%s): %s" % (query, host),
            "title": clean(it.get("title")), "url": link,
            "date": parse_date(it.get("pubDate")), "snippet": clean(it.get("description"))[:300],
        })
    return out


def from_moe():
    url = "https://www.moe.go.kr/boardCnts/listRenew.do?boardID=294&m=020402&s=moe"
    page = http_get(url)
    out = []
    for m in re.finditer(r"goView\('294',\s*'(\d+)'[^)]*\);\"\s*title=\"([^\"]+)\"(.*?)</tr>", page, re.S):
        d = re.search(r"<td>\s*(\d{4}-\d{2}-\d{2})\s*</td>", m.group(3))
        out.append({
            "group": "정부 · 교육청", "source": "교육부 보도자료", "title": clean(m.group(2)),
            "url": "https://www.moe.go.kr/boardCnts/viewRenew.do?boardID=294&boardSeq=%s&lev=0&m=020402&s=moe" % m.group(1),
            "date": d.group(1) if d else None, "snippet": "",
        })
    return out


def from_sen():
    base = "https://enews.sen.go.kr"
    page = http_get(base + "/news/list.do?step1=3&step2=1")
    out = []
    for m in re.finditer(r'<a href="(/news/view\.do\?bbsSn=\d+[^"]*)"[^>]*>(.*?)</a>', page, re.S):
        body = m.group(2)
        t = re.search(r'class="tit"[^>]*>(.*?)</strong>', body, re.S)
        d = re.search(r"(\d{4})[.\-](\d{2})[.\-](\d{2})", clean(body))
        if not t:
            continue
        out.append({
            "group": "정부 · 교육청", "source": "서울시교육청 보도자료", "title": clean(t.group(1)),
            "url": base + html.unescape(m.group(1)),
            "date": "-".join(d.groups()) if d else None, "snippet": "",
        })
    return out


def from_goe():
    base = "https://www.goe.go.kr/goe/na/ntt/"
    page = http_get(base + "selectNttList.do?mi=10102&bbsId=1922")
    out = []
    for m in re.finditer(r'data-id="(\d+)"\s+title="([^"]*)"\s+class="nttInfoBtn[^"]*">(.*?)</a>', page, re.S):
        t = re.search(r'class="lst_tit">(.*?)</dt>', m.group(3), re.S)
        d = re.search(r"(\d{4})\.(\d{2})\.(\d{2})", m.group(3))
        out.append({
            "group": "정부 · 교육청", "source": "경기도교육청 보도자료",
            "title": clean(t.group(1)) if t else clean(m.group(2)),
            "url": base + "selectNttInfo.do?mi=10102&bbsId=1922&nttSn=" + m.group(1),
            "date": "-".join(d.groups()) if d else None, "snippet": "",
        })
    return out


def from_naver(query, limit=10):
    headers = naver_headers()
    url = ("https://naverapihub.apigw.ntruss.com/search/v1/blog?query=%s&display=%d&sort=date&format=json"
           % (urllib.parse.quote(query), limit))
    data = json.loads(http_get(url, headers))
    out = []
    for it in data.get("items", []):
        out.append({
            "group": "학원 현장", "source": "네이버 블로그: " + clean(it.get("bloggername", "")),
            "title": clean(it.get("title")), "url": it.get("link", ""),
            "date": parse_date(it.get("postdate")), "snippet": clean(it.get("description"))[:300],
            "note": "개인 블로그 글이다. 본문은 읽을 수 없고 검색 요약뿐이다. '학원가 소식'으로만 쓴다.",
        })
    return out


def already_published(days=7):
    seen = set()
    folder = os.path.join(ROOT, "briefings")
    today = dt.datetime.now(KST).date()
    for i in range(1, days + 1):
        p = os.path.join(folder, (today - dt.timedelta(days=i)).isoformat() + ".json")
        if os.path.exists(p):
            try:
                with open(p, encoding="utf-8") as f:
                    for it in json.load(f).get("items", []):
                        seen.add(it.get("url", ""))
                        seen.add(it.get("title", ""))
            except Exception:
                pass
    return seen


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=2, help="며칠 전 소식까지 볼지")
    ap.add_argument("--out", default="")
    a = ap.parse_args()

    today = dt.datetime.now(KST).date()
    oldest = (today - dt.timedelta(days=a.days)).isoformat()
    seen = already_published()
    jobs = []
    jobs += [("교육부 보도자료", from_moe, (), 15), ("서울시교육청 보도자료", from_sen, (), 12),
             ("경기도교육청 보도자료", from_goe, (), 15)]
    jobs += [(n, from_rss, (g, n, u, lim), lim) for g, n, u, lim in RSS_SOURCES]
    jobs += [("뉴스 검색: " + q, from_naver_news, (q,), 8) for q in NAVER_NEWS_QUERIES]
    jobs += [("네이버 블로그: " + q, from_naver, (q,), 8) for q in NAVER_QUERIES]

    candidates, report, urls = [], [], set()
    for name, fn, args, limit in jobs:
        try:
            items = fn(*args)
        except Exception as e:  # 한 출처가 실패해도 나머지는 계속한다
            report.append({"source": name, "ok": False, "error": "%s: %s" % (type(e).__name__, e)})
            continue
        kept = []
        for it in items:
            if it["url"] in urls or it["url"] in seen or it["title"] in seen:
                continue
            if it.get("date") and it["date"] < oldest:
                continue
            if name == "연합뉴스 사회" and not EDU_WORDS.search(it["title"]):
                continue
            urls.add(it["url"])
            kept.append(it)
            if len(kept) >= limit:
                break
        report.append({"source": name, "ok": True, "fetched": len(items), "kept": len(kept)})
        candidates += kept

    result = {"generated_at": dt.datetime.now(KST).isoformat(timespec="seconds"),
              "today": today.isoformat(), "oldest": oldest, "report": report, "candidates": candidates}
    text = json.dumps(result, ensure_ascii=False, indent=1)
    if a.out:
        with open(a.out, "w", encoding="utf-8") as f:
            f.write(text)
        ok = sum(1 for r in report if r["ok"])
        print("sources ok %d/%d, candidates %d -> %s" % (ok, len(report), len(candidates), a.out))
        for r in report:
            if not r["ok"]:
                print("FAILED", r["source"], r["error"])
    else:
        sys.stdout.reconfigure(encoding="utf-8")
        print(text)


if __name__ == "__main__":
    main()
