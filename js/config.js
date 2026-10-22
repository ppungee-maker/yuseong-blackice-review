window.APP_CONFIG = {
  center: [36.376, 127.338],
  zoom: 12,
  dataFiles: {
    summary: "data/summary.json",
    roads: "data/roads.geojson",
    registry: "data/registry.geojson",
    dong: "data/dong_boundary.geojson",
    gu: "data/gu_boundary.geojson"
  },
  // 결빙 주의 단계(5단계) + 상습 결빙구간: key → 이름, 색, 굵기, 처음 켜짐 여부
  layers: {
    g5:       { label: "5단계 매우 주의", color: "#b2182b", weight: 5, on: true },
    g4:       { label: "4단계 주의", color: "#ef6548", weight: 4, on: true },
    g3:       { label: "3단계 관심", color: "#f2a93b", weight: 3, on: true },
    g2:       { label: "2단계 보통", color: "#8fb3cf", weight: 1.6, on: true },
    g1:       { label: "1단계 일반", color: "#a9b3b8", weight: 1, on: true },
    registry: { label: "행정안전부 상습 결빙구간", color: "#5b2a86", weight: 6, on: true }
  },
  // 위험 요인: 비트(자료의 r 값) → 이름, 점수 설명, 지도 사유 문구
  factors: [
    { bit: 1, key: "bridge", icon: "🌉", name: "교량·고가도로", pts: "4점", why: "교량·고가도로 위로, 위아래로 찬 공기를 받아 다른 도로보다 먼저 얼고 늦게 녹습니다." },
    { bit: 2, key: "portal", icon: "🚇", name: "터널·지하차도 출입구", pts: "100 m 안 4점 · 200 m 안 3점", why: "터널·지하차도 출입구 가까운 도로로, 안팎 온도 차 때문에 얼기 쉽습니다." },
    { bit: 4, key: "shade", icon: "🏢", name: "산·건물 그늘", pts: "낮의 75% 이상 3점 · 50% 이상 2점", why: "한겨울(동지) 낮 동안 그늘이 지는 시간이 긴 것으로 계산된 곳이라, 언 노면이 잘 녹지 않을 수 있습니다." },
    { bit: 8, key: "water", icon: "🌊", name: "하천·저수지 옆", pts: "2점", why: "하천·저수지 바로 옆이라 습기가 많아 서리가 잘 낍니다." },
    { bit: 16, key: "slope", icon: "📈", name: "경사로", pts: "2점", why: "경사가 있는 길로, 얼면 미끄러지거나 멈추기 어렵습니다." },
    { bit: 32, key: "high", icon: "⛰️", name: "높은 곳(해발 150 m 이상)", pts: "1점", why: "해발 150 m 이상 높은 곳이라 시내보다 기온이 낮습니다." }
  ],
  // 단계 기준(지도 메뉴 ‘단계는 어떻게 정했나요?’): 위험 요인 점수 합계 → 단계, 대표 사례
  gradeInfo: [
    { g: 5, pts: "6점 이상", text: "교량·터널 출입구에 하천·그늘·높은 곳 등이 겹친 곳 (예: 하천 위 교량)" },
    { g: 4, pts: "4~5점", text: "교량·고가도로 위, 터널 출입구 100 m 안, 또는 그늘과 하천처럼 두 가지 요인이 겹친 곳" },
    { g: 3, pts: "3점", text: "한겨울 낮의 75% 이상이 그늘로 계산된 곳, 터널 출입구 200 m 안 등" },
    { g: 2, pts: "1~2점", text: "그늘·하천 옆·경사·높은 곳 중 한 가지만 해당하는 곳" },
    { g: 1, pts: "0점", text: "주요 위험 요인이 없는 곳 — 얼지 않는다는 뜻은 아닙니다. 터널·지하차도 안도 1단계로 표시" }
  ],
  // 그늘 계산 방법(추정값임을 밝힘)
  shadeNote: "그늘은 현장에서 잰 값이 아니라 계산한 추정값입니다. 동지(12월 22일) 낮 동안 30분마다 해의 위치를 계산하고, 수치지도의 건물(층수×3 m)·옹벽·지형이 햇빛을 가리는지 따졌습니다. 나무·방음벽 등은 반영되지 않아 실제와 다를 수 있습니다.",
  gradeNames: { 1: "고속도로", 2: "간선도로(4차로 이상)", 3: "보조간선도로(2~3차로)", 4: "소로·이면도로" },
  structNames: { 0: "일반 도로", 1: "교량·고가도로", 2: "터널", 3: "지하차도" },
  contact: ""   // 결빙 신고·문의처 확정 후 입력 (예: "유성구청 ○○과 042-000-0000")
};
