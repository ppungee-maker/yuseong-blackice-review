// 외부 라이브러리 없이 SVG·표로 그리는 간단한 차트
window.Charts = (() => {
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // 0~1 값을 연한 회색 → 얼음 파랑 → 남색으로
  function iceColor(v) {
    const stops = [[0, [243, 246, 248]], [0.33, [156, 194, 232]], [0.66, [31, 111, 209]], [1, [25, 59, 76]]];
    v = Math.max(0, Math.min(1, v));
    for (let i = 1; i < stops.length; i++) {
      if (v <= stops[i][0]) {
        const [a, ca] = stops[i - 1], [b, cb] = stops[i], t = (v - a) / (b - a);
        return `rgb(${ca.map((x, k) => Math.round(x + (cb[k] - x) * t)).join(",")})`;
      }
    }
    return "rgb(25,59,76)";
  }

  function heatmap(el, months, rate) {
    const max = Math.max(...rate.flat());
    const monthName = { 11: "11월(15일~)", 12: "12월", 1: "1월", 2: "2월", 3: "3월(~15일)" };
    let h = '<table class="heatmatrix"><thead><tr><th></th>';
    for (let hr = 0; hr < 24; hr++) h += `<th>${hr}시</th>`;
    h += "</tr></thead><tbody>";
    months.forEach((m, i) => {
      h += `<tr><th style="text-align:right;white-space:nowrap">${monthName[m]}</th>`;
      rate[i].forEach((v, hr) => {
        const pct = Math.round(v * 100);
        const dark = v / max > 0.55;
        h += `<td style="background:${iceColor(v / max)};color:${dark ? "#fff" : "#123"}" title="${monthName[m]} ${hr}시: ${pct}%">${pct || ""}</td>`;
      });
      h += "</tr>";
    });
    h += '</tbody></table><div class="heat-legend"><span>드묾</span><i></i><span>잦음</span><span>· 숫자 = 해당 월·시간 중 결빙 조건이 나타난 비율(%)</span></div>';
    el.innerHTML = h;
  }

  // series: [{name, color, values, dash}] — x는 0..n-1
  function line(el, series, { yLabel = "", xLabels = null, zero = true, height = 240 } = {}) {
    const W = 560, H = height, L = 40, R = 14, T = 14, B = 34;
    const all = series.flatMap((s) => s.values);
    let lo = Math.floor(Math.min(...all, zero ? 0 : Infinity)), hi = Math.ceil(Math.max(...all, zero ? 0 : -Infinity));
    if (hi === lo) hi = lo + 1;
    const n = series[0].values.length;
    const x = (i) => L + (i / (n - 1)) * (W - L - R), y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(series.map((d) => d.name).join(", "))}">`;
    const step = [1, 2, 5, 10, 20, 50].find((st) => (hi - lo) / st <= 6) || 100;   // 눈금은 1·2·5 단위
    lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;
    for (let v = lo; v <= hi; v += step) {
      s += `<line class="chart-grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="chart-label" x="${L - 6}" y="${y(v) + 3}" text-anchor="end">${v}</text>`;
    }
    if (zero && lo < 0 && hi > 0) s += `<line x1="${L}" x2="${W - R}" y1="${y(0)}" y2="${y(0)}" stroke="#d63b5b" stroke-dasharray="4 3"/><text class="chart-label" x="${W - R}" y="${y(0) - 4}" text-anchor="end" fill="#d63b5b">0℃</text>`;
    for (let i = 0; i < n; i += 3) s += `<text class="chart-label" x="${x(i)}" y="${H - 14}" text-anchor="middle">${xLabels ? xLabels[i] : i}</text>`;
    series.forEach((d) => {
      const pts = d.values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
      s += `<polyline fill="none" stroke="${d.color}" stroke-width="2.5" ${d.dash ? 'stroke-dasharray="6 4"' : ""} points="${pts}"/>`;
    });
    s += `<text class="chart-label" x="${L}" y="${H - 1}">${esc(yLabel)}</text>`;
    let lg = 0;
    series.forEach((d) => {
      s += `<line x1="${W - R - 150 + lg}" x2="${W - R - 132 + lg}" y1="${T + 6}" y2="${T + 6}" stroke="${d.color}" stroke-width="3" ${d.dash ? 'stroke-dasharray="5 3"' : ""}/><text class="chart-label" x="${W - R - 128 + lg}" y="${T + 9}">${esc(d.name)}</text>`;
      lg += 80;
    });
    el.innerHTML = s + "</svg>";
  }

  function bars(el, labels, values, { color = "#1f6fd1", unit = "", height = 240 } = {}) {
    const W = 560, H = height, L = 34, R = 10, T = 16, B = 40;
    const max = Math.max(...values) || 1, n = values.length, bw = (W - L - R) / n;
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img">`;
    for (let k = 0; k <= 4; k++) {
      const v = Math.round((max * k) / 4), yy = T + (1 - v / max) * (H - T - B);
      s += `<line class="chart-grid" x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}"/><text class="chart-label" x="${L - 5}" y="${yy + 3}" text-anchor="end">${v}</text>`;
    }
    values.forEach((v, i) => {
      const h = (v / max) * (H - T - B), xx = L + i * bw + bw * 0.18;
      s += `<rect x="${xx}" y="${H - B - h}" width="${bw * 0.64}" height="${h}" rx="3" fill="${color}"><title>${esc(labels[i])}: ${v}${unit}</title></rect>`;
      s += `<text class="chart-label" x="${xx + bw * 0.32}" y="${H - B - h - 4}" text-anchor="middle">${v}</text>`;
      s += `<text class="chart-label" x="${xx + bw * 0.32}" y="${H - B + 14}" text-anchor="middle" transform="rotate(-35 ${xx + bw * 0.32} ${H - B + 14})">${esc(labels[i])}</text>`;
    });
    el.innerHTML = s + "</svg>";
  }

  return { heatmap, line, bars, esc };
})();
