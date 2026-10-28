// 결빙 주의 지도 (Leaflet)
window.IceMap = (() => {
  const C = window.APP_CONFIG;
  const esc = (s) => window.Charts.esc(s ?? "");
  let map, base, roadsLayer, dongLayer, highlight, data;
  const groups = {};   // key → L.layerGroup
  const visible = {};
  let searchIndex = new Map();   // 도로명 → [layers]

  const roadKey = (p) => (p.c ? "city" : `g${p.gr}`);   // c: 0 구 관리, 1 대전시, 2 고속도로
  let factorBit = 0;   // 0 = 모든 요인, 그 외 = 해당 요인이 있는 구간만 진하게

  function styleFor(key, p) {
    const cfg = C.layers[key];
    let st;
    if (key === "city") return { color: cfg.color, weight: cfg.weight * (p.g <= 2 ? 1.5 : 1), opacity: 0.9 };
    if (key === "g1" || key === "g2") {
      const w = ({ 1: 2.2, 2: 1.8, 3: 1.3, 4: 0.8 }[p.g] || 0.8) * (key === "g2" ? 1.2 : 1);
      st = { color: cfg.color, weight: w, opacity: p.g <= 2 ? 0.8 : 0.6 };
    } else {
      st = { color: cfg.color, weight: cfg.weight + (p.g <= 2 ? 1 : 0), opacity: 0.95, lineCap: "round" };
    }
    if (factorBit && !(p.r & factorBit)) st = { ...st, opacity: 0.12 };
    return st;
  }

  function reasons(p) {
    if (p.s === 2 || p.s === 3) return ["터널·지하차도 안은 바깥보다 덜 얼어 1단계로 표시했습니다. 출입구 부근은 주의하세요."];
    const r = C.factors.filter((f) => p.r & f.bit).map((f) => f.why);
    if (!r.length) r.push("주요 위험 요인에 해당하지 않는 구간입니다. 그래도 겨울철 새벽에는 얼 수 있으니 서행해 주세요.");
    return r;
  }

  function showDetail(html) {
    const el = document.getElementById("detail");
    el.innerHTML = `<button class="detail-close" type="button" aria-label="닫기">×</button>${html}`;
    el.classList.add("on");
    el.querySelector(".detail-close").onclick = () => { el.classList.remove("on"); clearHighlight(); };
  }

  function roadviewButtons(latlng) {
    const ll = `${latlng.lat.toFixed(6)},${latlng.lng.toFixed(6)}`;
    return `<div class="detail-actions">
      <a class="btn" href="https://map.kakao.com/link/roadview/${ll}" target="_blank" rel="noopener">로드뷰 보기</a>
      <a class="btn" href="https://map.kakao.com/link/map/선택 위치,${ll}" target="_blank" rel="noopener">지도에서 보기</a></div>`;
  }

  function roadDetail(p, latlng) {
    const cfg = C.layers[roadKey(p)];
    const inside = p.s === 2 || p.s === 3;
    const slope = p.sl == null ? "-" : `${p.sl}%${p.ss === 2 ? " (지형으로 추정)" : ""}`;
    showDetail(`<h3>${esc(p.n)}</h3><span class="detail-tag" style="background:${cfg.color}">결빙 ${esc(cfg.label)}</span>
      <div class="metricrow"><span>행정동</span><b>${esc(p.d || "-")}</b></div>
      <div class="metricrow"><span>도로 구분</span><b>${esc(C.gradeNames[p.g])}</b></div>
      <div class="metricrow"><span>구간 형태</span><b>${esc(C.structNames[p.s])}${p.sn ? ` (${esc(p.sn)})` : ""}</b></div>
      <div class="metricrow"><span>한겨울 낮 그늘(계산값)</span><b>${inside || p.s === 1 ? "-" : `${p.sh}%`}</b></div>
      <div class="metricrow"><span>경사</span><b>${esc(slope)}</b></div>
      <div class="metricrow"><span>해발 높이</span><b>약 ${p.e} m</b></div>
      ${p.wn ? `<div class="metricrow"><span>가까운 물</span><b>${esc(p.wn)}</b></div>` : ""}
      <div class="metricrow"><span>구간 길이</span><b>${p.L.toLocaleString()} m</b></div>
      <ul class="reason-list">${reasons(p).map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
      ${roadviewButtons(latlng)}`);
  }

  function cityDetail(p, latlng) {
    showDetail(`<h3>${esc(p.n)}</h3><span class="detail-tag" style="background:#5d6a74">${esc(C.managerNames[p.c])} 관리 도로</span>
      <div class="metricrow"><span>행정동</span><b>${esc(p.d || "-")}</b></div>
      <div class="metricrow"><span>도로 구분</span><b>${esc(C.gradeNames[p.g])}</b></div>
      <p class="note">${esc(C.managerNames[p.c])}이(가) 관리하는 도로라 이 지도의 결빙 주의 단계에서 뺐습니다. 다리 위·그늘진 곳은 마찬가지로 얼 수 있으니 겨울철 새벽에는 서행해 주세요.</p>
      ${roadviewButtons(latlng)}`);
  }

  function snowDetail(p, latlng) {
    showDetail(`<h3>${esc(p.id)} 노선</h3><span class="detail-tag" style="background:${C.layers.snow.color}">구 제설 노선 (2026~2027)</span>
      ${p.a ? `<div class="metricrow"><span>지역</span><b>${esc(p.a)}</b></div>` : ""}
      <div class="metricrow"><span>장비</span><b>${esc(p.t)}</b></div>
      <p class="note">건설과 제설 노선도(PDF)에서 선을 따 온 것이라 실제 도로와 수 m 어긋날 수 있습니다.</p>
      ${roadviewButtons(latlng)}`);
  }

  function registryDetail(p, latlng) {
    showDetail(`<h3>${esc(p.n)}</h3><span class="detail-tag" style="background:${C.layers.registry.color}">행정안전부 상습 결빙구간</span>
      <div class="metricrow"><span>관리기관</span><b>${esc(p.org)}</b></div>
      <div class="metricrow"><span>지정 길이</span><b>${p.km} km</b></div>
      <p class="note">관리기관이 겨울철 결빙이 잦다고 지정해 관리하는 구간입니다. 지도에는 시작점과 끝점을 이은 선으로 표시했습니다.</p>
      ${roadviewButtons(latlng)}`);
  }

  function clearHighlight() { if (highlight) { map.removeLayer(highlight); highlight = null; } }
  function setHighlight(layers) {
    clearHighlight();
    highlight = L.featureGroup(layers.map((l) => L.polyline(l.getLatLngs(), { color: "#ffd400", weight: 10, opacity: 0.55, interactive: false }))).addTo(map);
    highlight.eachLayer((l) => l.bringToBack && l.bringToBack());
    return highlight.getBounds();
  }

  function legend() {
    const el = document.getElementById("legend");
    el.innerHTML = "<b>범례</b>" + Object.entries(C.layers).filter(([k]) => visible[k]).map(([k, c]) =>
      `<div class="legend-row"><span class="swatch-line" style="background:${c.color};height:${Math.max(2, Math.min(5, c.weight))}px"></span>${esc(c.label)}</div>`).join("")
      + (factorBit ? `<div class="legend-row">진한 선 = ${esc(C.factors.find((f) => f.bit === factorBit).name)} 요인 구간</div>` : "");
  }

  const DRAW_ORDER = ["snow", "city", "g1", "g2", "g3", "g4", "g5", "registry"];   // 아래 → 위
  function setLayer(key, on) {
    visible[key] = on;
    // 캔버스는 추가한 순서대로 그리므로, 켜진 항목을 정해진 순서로 다시 올린다
    DRAW_ORDER.forEach((k) => groups[k] && map.removeLayer(groups[k]));
    DRAW_ORDER.forEach((k) => visible[k] && groups[k].addTo(map));
    legend();
  }

  const DONG_STYLE = { color: "#8fb4cf", weight: 1.1, opacity: 0.4, fill: false, dashArray: "4 4" };
  let guBounds, applyBase = () => {};
  // 유성구 전체가 보이게 맞추고, 그보다 한 단계 넘게 축소하지 못하게 함 (휴대폰에서 메뉴를 접은 뒤 다시 호출)
  function fitGu() {
    map.invalidateSize();
    if (map.getSize().x === 0) return;                    // 숨은 탭에서 시작한 경우
    map.setMinZoom(10);
    const wide = map.getSize().x > 760;                    // PC는 왼쪽 도구 상자·위 검색창 자리를 비움
    map.fitBounds(guBounds, wide ? { paddingTopLeft: [310, 70], paddingBottomRight: [20, 20] } : { padding: [10, 10] });
    map.setMinZoom(Math.max(10, map.getZoom() - 1));
  }

  // 점이 다각형 안에 있는지 (반직선 교차 수 세기)
  function inRing(ll, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [ay, ax] = ring[i], [by, bx] = ring[j];
      if ((ay > ll.lat) !== (by > ll.lat) && ll.lng < ((bx - ax) * (ll.lat - ay)) / (by - ay) + ax) inside = !inside;
    }
    return inside;
  }

  // 내 위치: 브라우저가 알려 준 위치로 지도만 옮기고, 어디에도 저장·전송하지 않음
  let meLayer, guRingLL;
  const NEAR_M = 500;
  function locateMe(btn) {
    const status = document.getElementById("mapStatus");
    if (!navigator.geolocation) { status.textContent = "이 브라우저는 위치 확인을 지원하지 않습니다."; return; }
    btn.classList.add("busy");
    status.textContent = "현재 위치를 확인하는 중입니다…";
    navigator.geolocation.getCurrentPosition((pos) => {
      btn.classList.remove("busy");
      const ll = L.latLng(pos.coords.latitude, pos.coords.longitude);
      if (meLayer) map.removeLayer(meLayer);
      if (!inRing(ll, guRingLL)) { status.textContent = "현재 위치가 유성구 밖입니다. 이 지도는 유성구 도로만 보여 줍니다."; return; }
      const acc = Math.min(pos.coords.accuracy || 0, 1000);
      meLayer = L.layerGroup([
        L.circle(ll, { radius: acc, color: "#7cc8ff", weight: 1, fillOpacity: 0.1, interactive: false }),
        L.circleMarker(ll, { radius: 7, color: "#fff", weight: 3, fillColor: "#3aa0ff", fillOpacity: 1, interactive: false })
      ]).addTo(map);
      map.setView(ll, 16);
      // 반경 안 4~5단계 구간 수 (꼭짓점 하나라도 반경 안이면 셈)
      let n = 0;
      ["g4", "g5"].forEach((k) => groups[k].eachLayer((l) => { if (l.getLatLngs().some((p) => ll.distanceTo(p) <= NEAR_M)) n++; }));
      status.textContent = n
        ? `내 주변 ${NEAR_M} m 안에 결빙 주의(4~5단계) 구간이 ${n}곳 있습니다. 선을 누르면 이유를 볼 수 있습니다.`
        : `내 주변 ${NEAR_M} m 안에는 4~5단계 구간이 없습니다. 그래도 새벽에는 서행해 주세요.`;
    }, (err) => {
      btn.classList.remove("busy");
      status.textContent = err.code === 1
        ? "위치 권한이 꺼져 있습니다. 브라우저 설정에서 위치 허용 후 다시 눌러 주세요."
        : "현재 위치를 확인하지 못했습니다. 잠시 뒤 다시 시도해 주세요.";
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
  }

  function init(appData) {
    data = appData;
    map = L.map("map", { preferCanvas: true, zoomControl: true, minZoom: 10, zoomSnap: 0.25, zoomDelta: 0.5 }).setView(C.center, C.zoom);
    // 키 없이 쓸 수 있는 OpenStreetMap 타일. 공개 배포 시 브이월드(국토교통부) 배경지도 키 발급 후 추가 권장
    const osm = (cls) => L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, className: cls, attribution: "&copy; OpenStreetMap contributors" });
    const tiles = { night: osm("night-tiles"), soft: osm("soft-tiles"), osm: osm("") };
    let baseChoice = "auto";                                // auto = 화면 테마(밤·낮)에 맞춤
    const renderer = L.canvas({ tolerance: 6 });

    // 분석 범위는 유성구뿐이므로 구 밖은 흐리게 가리고, 구 주변(약 3 km)까지만 움직이게 한다
    map.createPane("mask").style.zIndex = 350;              // 배경지도(200) 위, 도로(400) 아래
    const guRing = data.gu.features[0].geometry.coordinates[0].map(([x, y]) => [y, x]);
    const world = [[-89, -179], [-89, 179], [89, 179], [89, -179]];
    const mask = L.polygon([world, guRing], { pane: "mask", renderer: L.svg({ pane: "mask" }), stroke: false, interactive: false }).addTo(map);
    const edge = L.polyline(guRing, { pane: "mask", renderer: L.svg({ pane: "mask" }), weight: 2.5, interactive: false }).addTo(map);
    // 밤 지도는 구 밖을 더 어둡게, 낮 지도는 회색으로 가림
    const paint = (night) => {
      mask.setStyle(night ? { fillColor: "#03080c", fillOpacity: 0.6 } : { fillColor: "#5f6b73", fillOpacity: 0.45 });
      edge.setStyle(night ? { color: "#7cc8ff", opacity: 0.7 } : { color: "#193b4c", opacity: 0.85 });
    };
    applyBase = () => {
      const k = baseChoice === "auto" ? (document.documentElement.dataset.theme === "light" ? "soft" : "night") : baseChoice;
      if (base) map.removeLayer(base);
      base = tiles[k].addTo(map);
      paint(k === "night");
    };
    applyBase();
    document.getElementById("baseSelect").onchange = (e) => { baseChoice = e.target.value; applyBase(); };
    guBounds = L.latLngBounds(guRing);
    guRingLL = guRing;
    const Locate = L.Control.extend({
      options: { position: "topleft" },
      onAdd() {
        const div = L.DomUtil.create("div", "leaflet-bar locate-control");
        div.innerHTML = `<a href="#" role="button" title="내 위치" aria-label="내 위치로 이동">◎</a>`;
        const a = div.firstChild;
        L.DomEvent.disableClickPropagation(div);
        L.DomEvent.on(a, "click", (e) => { L.DomEvent.preventDefault(e); locateMe(a); });
        return div;
      }
    });
    new Locate().addTo(map);
    map.setMaxBounds(guBounds.pad(0.15));
    map.options.maxBoundsViscosity = 1.0;

    // 행정동 경계
    dongLayer = L.geoJSON(data.dong, { style: DONG_STYLE, interactive: false }).addTo(map);
    fitGu();

    // 도로 조각을 표시 항목별로 나눔
    Object.keys(C.layers).forEach((k) => (groups[k] = L.layerGroup()));
    const named = new Map();
    for (const f of data.roads.features) {
      const p = f.properties, key = roadKey(p);
      const latlngs = f.geometry.coordinates.map(([x, y]) => [y, x]);
      const line = L.polyline(latlngs, { ...styleFor(key, p), renderer });
      line.props = p;
      line.on("click", (e) => { setHighlight([line]); (p.c ? cityDetail : roadDetail)(p, e.latlng); });
      groups[key].addLayer(line);
      if (!p.n.endsWith("이면도로") && p.n !== "이름 없는 도로") {
        if (!named.has(p.n)) named.set(p.n, []);
        named.get(p.n).push(line);
      }
    }
    searchIndex = named;
    for (const f of data.registry.features) {
      const latlngs = f.geometry.coordinates.map(([x, y]) => [y, x]);
      const line = L.polyline(latlngs, { color: C.layers.registry.color, opacity: 0.95, lineCap: "round", dashArray: "1 9", weight: 7, renderer });
      line.on("click", (e) => { setHighlight([line]); registryDetail(f.properties, e.latlng); });
      groups.registry.addLayer(line);
    }

    // 구 제설 노선: 도로 아래에 넓고 옅은 띠로 깔아 단계 색이 보이게 함 (톤급이 클수록 굵게)
    const SNOW_W = { "15톤": 9, "5톤": 7, "2.5톤": 6, "1톤": 5 };
    for (const f of data.snow?.features || []) {
      const latlngs = f.geometry.coordinates.map(([x, y]) => [y, x]);
      const line = L.polyline(latlngs, { color: C.layers.snow.color, opacity: 0.35, weight: SNOW_W[f.properties.t] || 6, lineCap: "round", renderer });
      line.on("click", (e) => { setHighlight([line]); snowDetail(f.properties, e.latlng); });
      groups.snow.addLayer(line);
    }
    if (!data.snow) delete C.layers.snow;

    // 표시 항목 체크박스
    const sn = data.summary.snow;
    const counts = { snow: sn ? `${sn.routes}개 노선` : "", registry: `${data.summary.registry.count}곳`, city: `${Math.round(data.summary.scope.cityKm + data.summary.scope.highwayKm)} km` };
    data.summary.grades.forEach((g) => (counts[`g${g.grade}`] = `${Math.round(g.km).toLocaleString()} km`));
    const box = document.getElementById("layerChecks");
    box.innerHTML = Object.entries(C.layers).map(([k, c]) =>
      `<label><input type="checkbox" data-layer="${k}" ${c.on ? "checked" : ""}><span class="swatch-line" style="background:${c.color};height:${Math.max(2, Math.min(5, c.weight))}px"></span>${esc(c.label)}<small>${counts[k]}</small></label>`).join("");
    box.querySelectorAll("input").forEach((i) => (i.onchange = () => setLayer(i.dataset.layer, i.checked)));
    DRAW_ORDER.forEach((k) => C.layers[k]?.on && setLayer(k, true));

    // 도로명 검색
    const names = [...named.keys()].sort((a, b) => a.localeCompare(b, "ko"));
    document.getElementById("roadNames").innerHTML = names.map((n) => `<option value="${esc(n)}">`).join("");
    const doSearch = () => {
      const q = document.getElementById("roadSearch").value.trim();
      const hit = named.get(q) || [...named.entries()].find(([n]) => n.includes(q))?.[1];
      const status = document.getElementById("mapStatus");
      if (!q || !hit) { status.textContent = q ? `‘${q}’ 도로를 찾지 못했습니다.` : ""; return; }
      const name = named.has(q) ? q : [...named.keys()].find((n) => n.includes(q));
      map.fitBounds(setHighlight(hit), { padding: [40, 40], maxZoom: 16 });
      status.textContent = `${name}: 노란색으로 표시했습니다.`;
    };
    document.getElementById("roadSearchBtn").onclick = doSearch;
    document.getElementById("roadSearch").onkeydown = (e) => e.key === "Enter" && doSearch();

    // 행정동 선택
    const sel = document.getElementById("dongSelect");
    const dongs = data.dong.features.map((f) => f.properties.dong).sort((a, b) => a.localeCompare(b, "ko"));
    sel.innerHTML = `<option value="">유성구 전체</option>` + dongs.map((d) => `<option>${esc(d)}</option>`).join("");
    sel.onchange = () => focusDong(sel.value);

    // 위험 요인 선택: 해당 요인이 있는 구간만 진하게
    const fsel = document.getElementById("factorSelect");
    fsel.innerHTML = `<option value="0">모든 요인</option>` + C.factors.map((f) => `<option value="${f.bit}">${f.icon} ${esc(f.name)}</option>`).join("");
    fsel.onchange = () => setFactor(+fsel.value);
    // 단계 기준 설명: 단계별 점수·사례 + 요인별 점수
    document.getElementById("gradeInfo").innerHTML =
      `<p class="note">도로의 위험 요인마다 점수를 매겨 더한 값으로 단계를 정했습니다.</p>` +
      C.gradeInfo.map((x) => `<div class="gi-row"><span class="swatch-line" style="background:${C.layers["g" + x.g].color}"></span><div><b>${esc(C.layers["g" + x.g].label)}</b> <small>${esc(x.pts)}</small><p>${esc(x.text)}</p></div></div>`).join("") +
      `<div class="gi-pts"><b>요인별 점수</b>` +
      C.factors.map((f) => `<div>${f.icon} ${esc(f.name)} <span>${esc(f.pts)}</span></div>`).join("") + `</div>` +
      `<p class="note">※ ${esc(C.shadeNote)}</p>`;

    // 주의 구간(4~5단계)이 긴 도로 목록: 같은 도로명으로 묶어 길이 합산
    const agg = new Map();
    data.roads.features.filter((f) => !f.properties.c && f.properties.gr >= 4 && named.has(f.properties.n)).forEach((f) => {
      const p = f.properties;
      const a = agg.get(p.n) || { name: p.n, dongs: new Set(), len: 0, g5: 0, coords: [] };
      a.len += p.L; if (p.gr === 5) a.g5 += p.L; if (p.d) a.dongs.add(p.d);
      a.coords.push(f.geometry.coordinates.map(([x, y]) => [y, x]));
      agg.set(p.n, a);
    });
    const top = [...agg.values()].sort((a, b) => b.len - a.len).slice(0, 30);
    document.getElementById("topList").innerHTML = top.map((a, i) =>
      `<button class="top-item" type="button" data-i="${i}"><span class="rank">${i + 1}</span><span><b>${esc(a.name)}</b><small>${esc([...a.dongs].slice(0, 3).join("·"))}${a.g5 ? ` · 5단계 ${a.g5.toLocaleString()} m` : ""}</small></span><strong>${a.len.toLocaleString()} m</strong></button>`).join("");
    document.querySelectorAll("#topList .top-item").forEach((b) => (b.onclick = () => {
      const a = top[+b.dataset.i];
      map.fitBounds(setHighlight(a.coords.map((c) => L.polyline(c))), { padding: [60, 60], maxZoom: 16 });
      document.getElementById("mapStatus").textContent = `${a.name}: 4~5단계 구간을 노란색으로 표시했습니다.`;
    }));
  }

  function setFactor(bit) {
    factorBit = bit;
    document.getElementById("factorSelect").value = String(bit);
    DRAW_ORDER.filter((k) => !["registry", "city", "snow"].includes(k)).forEach((k) => groups[k].eachLayer((l) => l.setStyle(styleFor(k, l.props))));
    legend();
  }

  function focusDong(name) {
    if (!name) { map.fitBounds(dongLayer.getBounds()); clearHighlight(); return; }
    dongLayer.eachLayer((l) => {
      const on = l.feature.properties.dong === name;
      l.setStyle(on ? { color: "#7cc8ff", weight: 3, opacity: 0.95, dashArray: null } : DONG_STYLE);
      if (on) map.fitBounds(l.getBounds(), { padding: [20, 20] });
    });
    document.getElementById("dongSelect").value = name;
  }

  // 개요 화면의 요인 카드: 모든 단계를 켜고 해당 요인 구간만 진하게
  function showFactor(bit) {
    Object.keys(C.layers).filter((k) => k !== "snow").forEach((k) => {
      document.querySelector(`#layerChecks input[data-layer="${k}"]`).checked = true;
      visible[k] = true;
    });
    setLayer("g1", true);
    setFactor(bit);
  }

  return { init, fitGu, focusDong, showFactor, setTheme: () => applyBase(), invalidate: () => map && map.invalidateSize() };
})();
