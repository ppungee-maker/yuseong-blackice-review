// 오늘 밤 결빙 지수: 예보값(today.json) + 과거 13년 환산표(ice_index.json) → 5단계 얼굴 카드
// today.json은 공개 배포 시 GitHub Actions가 기상청 단기예보로 1~3시간마다 새로 만든다.
// 지금은 시안: 대전 관측소의 과거 실제 밤(단계별 1개)을 samples로 넣어 둠 (scripts/analysis/build_ice_index.py 참고).
window.IceCast = (() => {
  const esc = (s) => window.Charts.esc(s ?? "");
  const COLORS = { 5: "#b2182b", 4: "#ef6548", 3: "#f2a93b", 2: "#5d9bd1", 1: "#2e9d5b" };
  function judge(idx, w) {
    const t = idx.tminBins.filter((b) => w.tmin >= b).length;
    const hum = w.rhDawn >= idx.humid;
    const cell = idx.table.find((c) => c.tbin === t && c.wet === !!w.wet && c.hum === hum);
    const f = idx.faces[cell.level];
    return { ...cell, ...f, msg: cell.coldDry ? idx.coldDryMsg : f.msg };
  }

  function html(idx, w, r, big) {
    const cond = `최저 ${w.tmin}℃ · ${w.wet ? "비·눈 있음" : "비·눈 없음"} · 새벽 습도 ${w.rhDawn}%`;
    return `<div class="ic-face" aria-hidden="true">${r.face}</div>
      <div class="ic-body">
        <div class="ic-title">${esc(w.target || "오늘 밤 ~ 내일 아침")} 결빙 지수${w.sample ? ' <span class="ic-sample">시안 · 과거 실제 사례</span>' : ""}</div>
        <div class="ic-level" style="color:${COLORS[r.level]}">${r.level}단계 ${esc(r.name)}</div>
        <p class="ic-msg">${esc(r.msg)}</p>
        <div class="ic-cond">${esc(cond)}</div>
        ${big ? `<div class="ic-basis">지난 13년 겨울, 이런 날씨였던 밤 ${r.n}번 중 <b>${Math.round(r.p * 100)}%</b>에서 결빙 조건이 나타났습니다.</div>` : ""}
        ${w.sample && w.actual != null ? `<div class="ic-actual">그날 실제로는: <b>${w.actual ? "결빙 조건이 나타났습니다" : "결빙 조건이 나타나지 않았습니다"}</b></div>` : ""}
        <div class="ic-src">${esc(w.source || "기상청 단기예보")}${w.issued ? ` · ${esc(w.issued)} 발표` : ""} · 대전 관측소 기준 참고 정보로 실제 노면과 다를 수 있습니다.</div>
      </div>`;
  }

  function render(idx, w) {
    const r = judge(idx, w);
    const mapCard = document.getElementById("todayMap");
    const ovCard = document.getElementById("todayOverview");
    [mapCard, ovCard].forEach((el) => {
      el.style.setProperty("--ic", COLORS[r.level]);
      el.innerHTML = html(idx, w, r, el === ovCard) +
        (el === mapCard ? '<button class="ic-toggle" type="button" aria-label="결빙 지수 접기">–</button>' : "");
      el.hidden = false;
    });
    mapCard.querySelector(".ic-toggle").onclick = () => mapCard.classList.toggle("mini");
    if (w.sample && w.samples) {
      ovCard.insertAdjacentHTML("beforeend", `<div class="ic-demo">시안 확인(과거 실제 사례): ${w.samples.map((s, i) =>
        `<button class="btn${s.target === w.target ? " on" : ""}" type="button" data-s="${i}">${esc(s.label)}</button>`).join("")}</div>`);
      ovCard.querySelectorAll("[data-s]").forEach((b) => (b.onclick = () => render(idx, { ...w, ...w.samples[+b.dataset.s] })));
    }
  }

  async function init() {
    try {
      const [idx, w] = await Promise.all(["data/ice_index.json", "data/today.json"].map((u) => fetch(u).then((r) => {
        if (!r.ok) throw new Error(u); return r.json(); })));
      render(idx, w);
      if (window.matchMedia("(max-width:760px)").matches) document.getElementById("todayMap").classList.add("mini");
    } catch (e) {
      console.warn("결빙 지수를 표시하지 못했습니다:", e);   // 지수가 없어도 지도는 그대로 쓸 수 있게
    }
  }
  return { init, judge };
})();
