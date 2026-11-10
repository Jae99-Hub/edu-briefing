# 교육 브리핑

수도권(서울 · 경기) 중학교 영어와 교육 정책 소식을 매일 아침 한 화면으로 정리하는 사이트입니다.

- 사이트: https://jae99-hub.github.io/edu-briefing/
- 공개된 보도자료와 기사를 자동으로 모아 AI가 요약합니다. 모든 항목에 원문 링크가 있습니다.
- 요약에 잘못이 있을 수 있습니다. 중요한 내용은 원문에서 확인하세요.

## 구성
| 위치 | 내용 |
|---|---|
| `index.html`, `style.css`, `app.js` | 사이트 화면 (빌드 과정 없음) |
| `briefings/YYYY-MM-DD.json` | 하루 치 브리핑 |
| `briefings/index.json` | 브리핑 날짜 목록 |
| `routine/instructions.md` | 브리핑을 만드는 지시문 |
| `routine/fetch_sources.py` | 출처에서 후보를 모으는 스크립트 |
| `routine/publish.py` | 브리핑 파일 검사 + 목록 갱신 |

기사와 자료의 저작권은 각 출처에 있습니다.
