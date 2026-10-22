// 화면 전환·자료 불러오기·개요/시기/행정동 화면
(async () => {
  const C = window.APP_CONFIG;
  const esc = window.Charts.esc;
  const data = {};
  const loading = {
    root: document.getElementById("loading"), title: document.getElementById("loadingTitle"),
    detail: document.getElementById("loadingDetail"), retry: document.getElementById("loadingRetry")
  };

  function showError(msg) {
    loading.title.textContent = "자료를 불러오지 못했습니다.";
    loading.detail.textContent = msg || "네트워크 상태를 확인한 뒤 다시 시도해 주세요.";
    loading.retry.hidden = false;
    loading.retry.onclick = () => window.location.reload();
    loading.root.classList.add("is-error");
  }

  try {
    await Promise.all(Object.entries(C.dataFiles).map(async ([k, url]) => {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`${url} 응답 오류 (${r.status})`);
      data[k] = await r.json();
    }));
  } catch (e) {
    console.error(e);
    showError(e.message);
    return;
  }
  const S = data.summary, W = S.weather;

  // ---------- 화면 전환
  const tabs = [...document.querySelectorAll(".tab")];
  function go(view) {
    tabs.forEach((t) => {
      const on = t.dataset.view === view;
      t.classList.toggle("on", on);
      on ? t.setAttribute("aria-current", "page") : t.removeAttribute("aria-current");
    });
    document.querySelectorAll(".view").forEach((v) => v.classList.toggle("on", v.id === `v-${view}`));
    if (view === "map") setTimeout(() => window.IceMap.invalidate(), 0);
    history.replaceState(null, "", `#${view}`);
  }
  tabs.forEach((t) => (t.onclick = () => go(t.dataset.view)));
  document.querySelectorAll("[data-goto]").forEach((b) => (b.onclick = () => go(b.dataset.goto)));
  document.getElementById("openMap").onclick = () => go("map");

  // ---------- 지도 메뉴 접기 (휴대폰은 접힌 상태로 시작)
  const sidebar = document.getElementById("mapSidebar"), opener = document.getElementById("mobileFilter");
  function setSidebar(open) {
    sidebar.classList.toggle("open", open);
    opener.hidden = open;
    opener.setAttribute("aria-expanded", String(open));
    setTimeout(() => window.IceMap.invalidate(), 0);
  }
  opener.onclick = () => setSidebar(true);
  sidebar.querySelector(".sidebar-close").onclick = () => setSidebar(false);

  // ---------- 분석 개요
  document.getElementById("stageBadge").textContent = `${S.stage} · ${S.updated} 기준`;
  const riskShare = W.riskDays / W.days;
  const kpi = (v, unit, label) => `<div class="kpi"><b>${v}<small>${unit}</small></b><span>${label}</span></div>`;
  const gkm = (g) => S.grades.find((x) => x.grade === g).km;
  document.getElementById("kpis").innerHTML =
    kpi(Math.round(S.roads.km).toLocaleString(), "km", "분석한 유성구 도로 연장") +
    kpi(gkm(5), "km", "5단계 매우 주의 구간") +
    kpi(gkm(4), "km", "4단계 주의 구간") +
    kpi(S.registry.count, "곳", `행정안전부 상습 결빙구간 (${S.registry.km} km)`) +
    kpi(`${Math.round(1 / riskShare * 10) / 10}`, "일에 1일", `겨울철 결빙 조건 발생 (13년 평균)`);

  const fstat = { bridge: `${S.bridge.count}곳 · ${S.factors.bridge} km`, portal: `출입구 ${S.tunnel.portals}곳 · ${S.factors.portal} km` };
  const fc = document.getElementById("factorCards");
  fc.innerHTML = C.factors.map((f, i) => `<div class="card" tabindex="0" role="button" data-i="${i}">
      <div class="icon">${f.icon}</div><h3>${esc(f.name)}</h3><p>${esc(f.why)}</p>
      <div class="stat">${esc(fstat[f.key] || `${S.factors[f.key]} km`)} · ${esc(f.pts)}</div></div>`).join("");
  fc.querySelectorAll("[data-i]").forEach((el) => {
    const open = () => { go("map"); window.IceMap.showFactor(C.factors[+el.dataset.i].bit); };
    el.onclick = open;
    el.onkeydown = (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), open());
  });

  const hours = [...Array(24).keys()].map((h) => `${h}시`);
  const below = W.groundByHour.map((v, h) => [v, h]).filter(([v]) => v < 0).map(([, h]) => h);
  document.getElementById("hourNote").textContent =
    `겨울철 평균 땅 표면 온도는 ${below[0]}시~${below.at(-1)}시에 영하로 내려가고, ${W.groundByHour.indexOf(Math.min(...W.groundByHour))}시에 가장 낮습니다.`;
  Charts.line(document.getElementById("hourChartSmall"), [
    { name: "땅 표면", color: "#1f6fd1", values: W.groundByHour },
    { name: "기온", color: "#9aa6ab", values: W.airByHour, dash: true }
  ], { xLabels: hours, yLabel: "℃", height: 210 });
  document.getElementById("airGroundNumber").textContent = `${W.airAboveGroundBelow.toLocaleString()}시간`;
  const src = `자료: ${S.sources.join(" · ")}`;
  document.getElementById("sourcesOverview").textContent = src;
  document.getElementById("sourcesGuide").textContent = src;

  // ---------- 결빙 위험 시기
  document.getElementById("seasonSub").textContent = `기상청 대전 관측소 ${W.period} 시간별 관측값 ${W.hours.toLocaleString()}시간을 분석했습니다.`;
  const avgDays = (W.riskDays / W.seasons.length).toFixed(0);
  document.getElementById("seasonKpis").innerHTML =
    kpi(W.riskDays.toLocaleString(), "일", `결빙 조건이 있었던 날 (전체 ${W.days.toLocaleString()}일)`) +
    kpi(avgDays, "일", "겨울 한 철 평균 위험일") +
    kpi(W.riskHours.toLocaleString(), "시간", `결빙 조건 시간 (서리 ${W.frostHours.toLocaleString()} · 비·눈 뒤 ${W.refreezeHours.toLocaleString()})`) +
    kpi(W.airAboveGroundBelow.toLocaleString(), "시간", "기온 영상·땅 표면 영하") +
    kpi(W.minGround, "℃", `가장 낮았던 땅 표면 온도 (기온 ${W.minAir}℃)`);
  Charts.heatmap(document.getElementById("heatmap"), W.monthHour.months, W.monthHour.rate);
  Charts.line(document.getElementById("tempChart"), [
    { name: "땅 표면", color: "#1f6fd1", values: W.groundByHour },
    { name: "기온", color: "#9aa6ab", values: W.airByHour, dash: true }
  ], { xLabels: hours, yLabel: "℃" });
  Charts.bars(document.getElementById("seasonChart"), W.seasons.map((s) => s.season), W.seasons.map((s) => s.riskDays), { unit: "일" });

  // ---------- 행정동별 현황
  const rows = [...S.dongs].sort((a, b) => b.g5Km + b.g4Km - (a.g5Km + a.g4Km));
  const r1 = (v) => Math.round(v * 10) / 10;
  const max45 = Math.max(...rows.map((r) => r.g5Km + r.g4Km)), max3 = Math.max(...rows.map((r) => r.g3Km));
  const bar = (v, m, c) => `${v}<span class="cellbar" style="width:${m ? Math.round((v / m) * 60) : 0}px;background:${c}"></span>`;
  const tot = (k) => r1(rows.reduce((s, r) => s + r[k], 0));
  document.getElementById("dongTable").innerHTML =
    `<thead><tr><th>행정동</th><th>도로 연장(km)</th><th>4~5단계(km)</th><th>그중 5단계(km)</th><th>3단계(km)</th><th>4~5단계 비율</th><th>교량 수</th><th>상습 결빙구간</th></tr></thead><tbody>` +
    rows.map((r) => `<tr data-dong="${esc(r.dong)}"><td>${esc(r.dong)}</td><td>${r.roadKm}</td><td>${bar(r1(r.g5Km + r.g4Km), max45, C.layers.g4.color)}</td><td>${r.g5Km}</td><td>${bar(r.g3Km, max3, C.layers.g3.color)}</td><td>${r.roadKm ? ((r.g5Km + r.g4Km) / r.roadKm * 100).toFixed(1) : 0}%</td><td>${r.bridgeCount}</td><td>${r.registry}</td></tr>`).join("") +
    `</tbody><tfoot><tr><td>합계</td><td>${tot("roadKm")}</td><td>${r1(tot("g5Km") + tot("g4Km"))}</td><td>${tot("g5Km")}</td><td>${tot("g3Km")}</td><td>${((tot("g5Km") + tot("g4Km")) / tot("roadKm") * 100).toFixed(1)}%</td><td>${S.bridge.count}</td><td>${S.registry.count}</td></tr></tfoot>`;
  document.querySelectorAll("#dongTable tbody tr").forEach((tr) => (tr.onclick = () => { go("map"); window.IceMap.focusDong(tr.dataset.dong); }));

  // ---------- 주민 안내
  if (C.contact) document.getElementById("contactText").textContent = C.contact;

  // ---------- 지도 시작
  window.IceMap.init(data);
  window.IceCast.init();
  if (window.matchMedia("(max-width:760px)").matches) { setSidebar(false); window.IceMap.fitGu(); }
  const start = (location.hash || "#map").slice(1);
  go(document.getElementById(`v-${start}`) ? start : "map");
  loading.root.hidden = true;
})();
