// レベル13の問題データ生成: node gen13.js -> src/data.js
// 手書き10問（src/handmade.js）＋ 計算で作る問題。誤答は「よくあるまちがい」から作り、理由も一緒に付ける。
const fs = require('fs'), path = require('path');

let seed = 20261020;
function R() { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const MINUS = '−';
const lab = v => (v < 0 ? MINUS + (-v) : String(v));
const T = v => String(v);
const fr = (n, d) => '\\dfrac{' + n + '}{' + d + '}';
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
function lcmBrute(a, b) { for (let x = Math.max(a, b); ; x++) if (x % a === 0 && x % b === 0) return x; }
const key = v => (v == null ? 'null:' + Math.random() : Array.isArray(v) ? v.map(x => x.toFixed(9)).join(',') : v.toFixed(9));

/* 問題を組み立てる。truth={v,tex}, cands=[{v,tex,why}]（先のものほど優先） */
function build(o) {
  const unit = o.unit || '';
  const wrap = (tex, raw) => (raw ? tex : '$' + tex + '$' + unit);
  const seen = [o.truth.tex], seenV = [key(o.truth.v)], wrongs = [];
  for (const c of o.cands) {
    if (wrongs.length >= 3) break;
    if (seen.includes(c.tex)) continue;
    if (!c.same && seenV.includes(key(c.v))) continue;
    seen.push(c.tex); seenV.push(key(c.v)); wrongs.push(c);
  }
  if (wrongs.length < 3) throw new Error(o.id + ': 誤答の候補が足りない');
  const all = shuffle([{ t: wrap(o.truth.tex, o.truth.raw), v: o.truth.v, ok: true }].concat(wrongs.map(c => (c.same ? { t: wrap(c.tex, c.raw), v: c.v, why: c.why, same: true } : { t: wrap(c.tex, c.raw), v: c.v, why: c.why }))));
  const ans = all.findIndex(x => x.ok);
  all.forEach(x => delete x.ok);
  const q = { id: o.id, expr: o.expr, p: o.p, ch: all, ans, steps: o.steps, point: o.point };
  if (o.fig) q.fig = o.fig;
  if (o.figAfter) q.figAfter = o.figAfter;
  return q;
}

/* ---------- 共通の小物 ---------- */
const LT = a => a.join(',\\ ');                                  // 数のならび（TeX）
const dfmt = x => String(+x.toFixed(8));                         // 小数の表示
const divisors = n => { const r = []; for (let i = 1; i <= n; i++) if (n % i === 0) r.push(i); return r; };
const reduceF = (n, d) => { const g = gcd(n, d); return [n / g, d / g]; };
const frT = (n, d) => (d === 1 ? String(n) : fr(n, d));           // 分母1なら整数で表示
const Fv = (n, d) => { const [a, b] = reduceF(n, d); return { v: n / d, tex: frT(a, b) }; };
const C = (n, d, why, same) => { const o = { v: n / d, tex: (n * d < 0 ? '-' : '') + frT(Math.abs(n), Math.abs(d)), why }; if (same) o.same = true; return o; };
const mixT = (w, n, d) => String(w) + fr(n, d);
function fracOfDec(x) { const s = Math.round(x * 10000); const g = gcd(s, 10000); return [s / g, 10000 / g]; }
const RAWQ = (id, p, truth, wrongs, steps, point, extra) => build(Object.assign({
  id, expr: '1', p, raw: true, truth: { v: 1, tex: truth, raw: true },
  cands: wrongs.map(([t, why]) => ({ v: null, raw: true, tex: t, why })), steps, point
}, extra || {}));
const lcmOf = (a, b) => a / gcd(a, b) * b;

/* ---------- 共通の小物（レベル13） ---------- */
const fp = n => (n < 0 ? '(' + n + ')' : String(n));       // かっこつきで表示
const sgnWord = s => (s < 0 ? 'マイナス' : 'プラス');
const cnt = a => a.filter(x => x < 0).length;


/* ---------- 文字式の道具 ---------- */
const D = s => (String(s).includes('$') || /[ぁ-んァ-ヶ一-龥]/.test(String(s)) ? s : '$' + s + '$');
// RQ: 4択（式が選択肢）。texはそのまま渡すと $…$ で包む
const RQ = (id, p, t, ws, steps, point, extra) => RAWQ(id, p, D(t), ws.map(([w, why]) => [D(w), why]), steps, point, extra);
// 1次式 a x + b を TeX に
const xt = (a, v) => (a === 1 ? v : a === -1 ? '-' + v : a + v);
const lin = (a, b, v) => { v = v || 'x'; if (a === 0) return String(b); let s = xt(a, v); if (b > 0) s += '+' + b; else if (b < 0) s += '-' + (-b); return s; };
const sgn = n => (n < 0 ? '-' + (-n) : '+' + n);
const num = n => String(n);
// 数値問題（答えがひとつの数）
const NQ = (id, p, t, ws, steps, point, unit) => build({ id, expr: String(t), p, truth: { v: t, tex: dfmt(t) }, cands: ws.map(([v, why]) => ({ v, tex: dfmt(v), why })), steps, point, unit });


/* ---------- 座標グラフの図（SVG） ---------- */
const GR = 6, GS = 22, GC = 150;
const gx = x => GC + GS * x, gy = y => GC - GS * y;
function graph(o) {
  o = o || {};
  const st = (s) => ' style="' + s + '"';
  let s = '<svg viewBox="0 0 300 300" role="img" aria-label="座標平面"' + st('width:100%;max-width:340px;height:auto;display:block;margin:8px auto') + '>';
  for (let i = -GR; i <= GR; i++) {
    if (i === 0) continue;
    s += '<line x1="' + gx(i) + '" y1="' + gy(-GR) + '" x2="' + gx(i) + '" y2="' + gy(GR) + '"' + st('stroke:var(--line);stroke-width:1') + '/>';
    s += '<line x1="' + gx(-GR) + '" y1="' + gy(i) + '" x2="' + gx(GR) + '" y2="' + gy(i) + '"' + st('stroke:var(--line);stroke-width:1') + '/>';
  }
  s += '<line x1="' + gx(-GR - .4) + '" y1="' + GC + '" x2="' + gx(GR + .4) + '" y2="' + GC + '"' + st('stroke:var(--fg);stroke-width:2') + '/>';
  s += '<line x1="' + GC + '" y1="' + gy(-GR - .4) + '" x2="' + GC + '" y2="' + gy(GR + .4) + '"' + st('stroke:var(--fg);stroke-width:2') + '/>';
  const tx = 'font:700 10px sans-serif;fill:var(--muted);text-anchor:middle';
  for (let i = -GR; i <= GR; i++) {
    if (i === 0) continue;
    s += '<text x="' + gx(i) + '" y="' + (GC + 13) + '"' + st(tx) + '>' + i + '</text>';
    s += '<text x="' + (GC - 9) + '" y="' + (gy(i) + 3.5) + '"' + st(tx) + '>' + i + '</text>';
  }
  s += '<text x="' + (GC - 8) + '" y="' + (GC + 13) + '"' + st(tx) + '>O</text>';
  s += '<text x="' + gx(GR + .4) + '" y="' + (GC + 24) + '"' + st('font:700 12px sans-serif;fill:var(--fg);text-anchor:end') + '>x</text>';
  s += '<text x="' + (GC + 10) + '" y="' + (gy(GR + .4) + 8) + '"' + st('font:700 12px sans-serif;fill:var(--fg)') + '>y</text>';
  (o.lines || []).forEach(a => {                       // y = a x
    const xm = Math.min(GR, GR / Math.abs(a));
    s += '<line x1="' + gx(-xm) + '" y1="' + gy(-a * xm) + '" x2="' + gx(xm) + '" y2="' + gy(a * xm) + '"' + st('stroke:var(--neg);stroke-width:2.5;stroke-linecap:round') + '/>';
  });
  (o.hyper || []).forEach(a => {                       // y = a / x
    [1, -1].forEach(sg => {
      let pts = [];
      for (let x = Math.abs(a) / GR; x <= GR + 1e-9; x += 0.05) pts.push(gx(sg * x).toFixed(1) + ',' + gy(a / (sg * x)).toFixed(1));
      s += '<polyline points="' + pts.join(' ') + '" fill="none"' + st('stroke:var(--neg);stroke-width:2.5;stroke-linecap:round') + '/>';
    });
  });
  (o.pts || []).forEach(p => {
    s += '<circle cx="' + gx(p.x) + '" cy="' + gy(p.y) + '" r="4.5"' + st('fill:var(--pos);stroke:var(--card);stroke-width:1.5') + '/>';
    if (p.l) s += '<text x="' + (gx(p.x) + 7) + '" y="' + (gy(p.y) - 6) + '"' + st('font:700 13px sans-serif;fill:var(--pos)') + '>' + p.l + '</text>';
  });
  return { type: 'svg', html: s + '</svg>' };
}
const ct = (x, y) => '(' + x + ',' + y + ')';
const rdc = (n, d) => { const g = gcd(n, d); n /= g; d /= g; if (d < 0) { n = -n; d = -d; } return [n, d]; };
const slope = (n, d) => { [n, d] = rdc(n, d); return d === 1 ? (n === 1 ? '' : n === -1 ? '-' : String(n)) + 'x' : (n < 0 ? '-' : '') + '\\dfrac{' + Math.abs(n) + '}{' + d + '}x'; };
const yEq = (n, d) => 'y=' + slope(n, d);
const hyEq = a => 'y=' + (a < 0 ? '-' : '') + '\\dfrac{' + Math.abs(a) + '}{x}';
const QN = ['第1象限', '第2象限', '第3象限', '第4象限'];

const PI = n => (n === 1 ? '\\pi' : n + '\\pi');

const PU = (n, u) => '$' + PI(n) + '$ ' + u;
const S_ = s => ' style="' + s + '"';
const svgW = (h, inner) => '<svg viewBox="0 0 260 ' + h + '" role="img" aria-label="図"' + S_('width:100%;max-width:320px;height:auto;display:block;margin:8px auto') + '>' + inner + '</svg>';
const ln = (x1, y1, x2, y2, c, w, dash) => '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '"' + S_('stroke:var(' + c + ');stroke-width:' + (w || 2) + ';stroke-linecap:round' + (dash ? ';stroke-dasharray:5 4' : '')) + '/>';
const tx = (x, y, t, a) => '<text x="' + x + '" y="' + y + '"' + S_('font:700 13px sans-serif;fill:var(--fg);text-anchor:' + (a || 'middle')) + '>' + t + '</text>';
const circ = (cx, cy, r) => '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="var(--card)"' + S_('stroke:var(--fg);stroke-width:2.5') + '/>';
const TT = s => '$' + s + '$';
const RT = rows => '<table class="rtab">' + rows.map(r => '<tr>' + r.map(c => '<td>' + c + '</td>').join('') + '</tr>').join('') + '</table>';
const txc = (x, y, t, c, a) => '<text x="' + x + '" y="' + y + '"' + S_('font:700 14px sans-serif;fill:var(' + (c || '--fg') + ');text-anchor:' + (a || 'middle')) + '>' + t + '</text>';
const isU = t => /[x?]/.test(String(t));
const RA = (a, b) => TT(a + ':' + b);
function figTri(L) {
  L = L || {};
  const A = [130, 20], B = [40, 150], C = [220, 150], D = [94, 72], E = [166, 72];
  let s = ln(B[0], B[1], C[0], C[1], '--fg', 2.4) + ln(A[0], A[1], B[0], B[1], '--fg', 2.4) + ln(A[0], A[1], C[0], C[1], '--fg', 2.4) + ln(D[0], D[1], E[0], E[1], '--neg', 2.6);
  s += txc(130, 12, 'A') + txc(28, 162, 'B') + txc(232, 162, 'C') + txc(80, 78, 'D') + txc(182, 78, 'E');
  const put = (k, x, y, a) => { if (L[k] != null) s += txc(x, y, L[k], isU(L[k]) ? '--pos' : '--muted', a); };
  put('AD', 100, 44, 'end'); put('DB', 56, 114, 'end'); put('AE', 162, 44, 'start'); put('EC', 206, 114, 'start'); put('DE', 130, 64); put('BC', 130, 172);
  return { type: 'svg', html: svgW(185, s) };
}
function figEn(o) {
  const cx = 130, cy = 100, r = 70, rad = d => d * Math.PI / 180;
  const pt = a => [cx + r * Math.cos(rad(a)), cy - r * Math.sin(rad(a))];
  const A = pt(o.A), B = pt(o.B), P = pt(o.P);
  let s = '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none"' + S_('stroke:var(--fg);stroke-width:2.4') + '/>';
  if (o.dia) s += ln(A[0], A[1], B[0], B[1], '--pos', 2.6); else s += ln(cx, cy, A[0], A[1], '--pos', 2.6) + ln(cx, cy, B[0], B[1], '--pos', 2.6);
  s += ln(P[0], P[1], A[0], A[1], '--neg', 2.6) + ln(P[0], P[1], B[0], B[1], '--neg', 2.6);
  s += txc(A[0] - (o.A > 90 && o.A < 270 ? 12 : -12), A[1] + 5, 'A') + txc(B[0] + (o.B > 90 && o.B < 270 ? -12 : 12), B[1] + 5, 'B') + txc(P[0], P[1] - 8, 'P') + txc(cx + 12, cy - 6, 'O', '--muted');
  if (o.labC) s += txc(cx, cy + 32, o.labC, isU(o.labC) ? '--pos' : '--pos');
  if (o.labP) s += txc(P[0] + 16, P[1] + 20, o.labP, '--neg', 'start');
  return { type: 'svg', html: svgW(200, s) };
}
function figRt(a, b, c) {
  const R = [60, 150], H = [210, 150], V = [60, 50];
  let s = ln(R[0], R[1], H[0], H[1], '--fg', 2.6) + ln(R[0], R[1], V[0], V[1], '--fg', 2.6) + ln(V[0], V[1], H[0], H[1], '--fg', 2.6);
  s += '<rect x="60" y="136" width="14" height="14" fill="none"' + S_('stroke:var(--fg);stroke-width:2') + '/>';
  const col = t => (isU(t) ? '--pos' : '--muted');
  s += txc(135, 172, a, col(a)) + txc(46, 105, b, col(b), 'end') + txc(150, 92, c, col(c), 'start');
  return { type: 'svg', html: svgW(185, s) };
}
function figTwo(o) {
  o = o || {};
  const sd = o.sides || {}, an = o.angs || {};
  const P = { B: [15, 140], C: [95, 140], A: [55, 70], E: [130, 140], F: [250, 140], D: [190, 35] };
  let s = '';
  [['A', 'B', 'C'], ['D', 'E', 'F']].forEach(t => { s += ln(P[t[0]][0], P[t[0]][1], P[t[1]][0], P[t[1]][1], '--fg', 2.4) + ln(P[t[1]][0], P[t[1]][1], P[t[2]][0], P[t[2]][1], '--fg', 2.4) + ln(P[t[2]][0], P[t[2]][1], P[t[0]][0], P[t[0]][1], '--fg', 2.4); });
  s += txc(55, 62, 'A') + txc(6, 152, 'B') + txc(104, 152, 'C') + txc(190, 27, 'D') + txc(121, 152, 'E') + txc(253, 154, 'F');
  const sp = { AB: [24, 102, 'end'], AC: [88, 102, 'start'], BC: [55, 164, 'middle'], DE: [150, 82, 'end'], DF: [232, 82, 'start'], EF: [190, 164, 'middle'] };
  Object.keys(sd).forEach(k => { s += txc(sp[k][0], sp[k][1], sd[k], isU(sd[k]) ? '--pos' : '--neg', sp[k][2]); });
  const ap = { A: [55, 98], B: [34, 134], C: [78, 134], D: [190, 66], E: [152, 134], F: [228, 134] };
  Object.keys(an).forEach(k => { s += '<text x="' + ap[k][0] + '" y="' + ap[k][1] + '"' + S_('font:700 11px sans-serif;fill:var(--pos);text-anchor:middle') + '>' + an[k] + '</text>'; });
  return { type: 'svg', html: svgW(175, s) };
}
function figShadow() {
  let s = ln(10, 150, 250, 150, '--muted', 1.5);
  s += ln(20, 150, 20, 132.4, '--fg', 3) + ln(20, 132.4, 42, 150, '--pos', 2) + ln(20, 150, 42, 150, '--neg', 3);
  s += ln(130, 150, 130, 62, '--fg', 3) + ln(130, 62, 240, 150, '--pos', 2) + ln(130, 150, 240, 150, '--neg', 3);
  s += txc(8, 126, '1.6 m', '--fg', 'start') + txc(31, 168, '2 m') + txc(118, 108, 'x', '--pos', 'end') + txc(185, 168, '10 m') + txc(20, 100, '人', '--muted', 'middle') + txc(130, 50, '木', '--muted', 'middle');
  return { type: 'svg', html: svgW(180, s) };
}
const BS = '\\backsim';
/* ===== パートA: 相似 ===== */
function genSouji() {
  const qs = [
    RQ('sj-1', '$\\triangle ABC' + BS + '\\triangle DEF$ で、$AB=4$、$DE=6$。相似比 $AB:DE$ は？', '$2:3$', [['$3:2$', '$AB:DE$ の順。$4:6=2:3$。'], ['$1:2$', '$4:6$ を、$2$ でわって $2:3$。'], ['$2:5$', '$4:6$ の比。$4+6$ ではない。']], ['$AB:DE=4:6$。', '$2$ でわって $2:3$。'], '相似比 ＝ 対応する辺の長さの比。'),
    NQ('sj-2', '相似比が $2:3$ の2つの三角形で、小さいほうの辺 $BC=6$。対応する大きいほうの辺 $EF$ は？', 9, [[4, '$6\\times\\dfrac{2}{3}$ をしてしまった。大きいほうは、$6\\times\\dfrac{3}{2}$。'], [8, '足し算ではなく、比を使う。'], [12, '$6\\times2$ ではなく、$6:EF=2:3$。']], ['$6:EF=2:3$。', '$EF=6\\times3\\div2=9$。'], '比例式：内側の積 ＝ 外側の積。'),
    RQ('sj-3', '$\\triangle ABC$ と $\\triangle DEF$ で、$\\angle A=\\angle D=50^\\circ$、$\\angle B=\\angle E=60^\\circ$。相似といえる理由は？', '2組の角が、それぞれ等しい', [['3組の辺の比が、すべて等しい', '辺の長さは、わかっていない。'], ['2組の辺の比と、その間の角が等しい', '辺の長さは、わかっていない。'], ['1組の辺とその両端の角が等しい（合同）', '辺の長さがわからないので、合同とは言えない。']], ['2組の角が等しい。', '相似条件：2組の角がそれぞれ等しい。'], '相似条件：①3組の辺の比 ②2組の辺の比と間の角 ③2組の角。'),
    RQ('sj-4', '$\\angle A=\\angle D$、$AB:DE=AC:DF$ のとき、相似といえる理由は？', '2組の辺の比と、その間の角が等しい', [['2組の角が、それぞれ等しい', '角は、$\\angle A=\\angle D$ の1組だけ。'], ['3組の辺の比が、すべて等しい', '辺の比は、2組だけわかっている。'], ['3組の辺が、それぞれ等しい（合同）', '辺の長さが等しいとは、わかっていない。']], ['$AB$ と $AC$ の間の角が $\\angle A$。', '2組の辺の比とその間の角が等しい。'], '「間の角」であることを、たしかめる。'),
    RQ('sj-5', '相似な図形で、対応する角の大きさは？', 'それぞれ等しい', [['相似比の分だけ、ちがう', '角の大きさは、拡大しても変わらない。'], ['2倍になる', '角の大きさは、拡大しても変わらない。'], ['足して $180^\\circ$', '対応する角は、等しい。']], ['拡大・縮小しても、形は同じ。', '対応する角は、等しい。'], '相似：形が同じで、大きさがちがう。'),
    NQ('sj-6', '縮尺 $\\dfrac{1}{50000}$ の地図で、$3$ cm の長さは、実際は何 km？', 1.5, [[15, '$150000$ cm ＝ $1500$ m ＝ $1.5$ km。単位に注意。'], [0.15, '$150000$ cm ＝ $1.5$ km。'], [150, '$150000$ cm ＝ $1500$ m。km にすると $1.5$。']], ['$3\\times50000=150000$ cm。', '$150000$ cm ＝ $1500$ m ＝ $1.5$ km。'], '縮尺 ＝ 地図上の長さ ÷ 実際の長さ。', 'km'),
    NQ('sj-7', '身長 $1.6$ m の人の影が $2$ m のとき、影が $10$ m の木の高さは？', 8, [[12.5, '比が逆。木のほうが大きい。$1.6:2=x:10$。'], [16, '$1.6\\times10$ ではない。$1.6:2=x:10$。'], [3.2, '$2\\times1.6$ ではない。$1.6:2=x:10$。']], ['$1.6:2=x:10$。', '$x=1.6\\times10\\div2=8$。'], '影と高さの比は、同じ（相似な直角三角形）。', 'm')
  ];
  const FG = [figTwo({ sides: { AB: '4', DE: '6' } }), figTwo({ sides: { BC: '6', EF: 'x' } }), figTwo({ angs: { A: '50°', B: '60°', D: '50°', E: '60°' } }), figTwo({ sides: { AB: 'AB', AC: 'AC', DE: 'DE', DF: 'DF' }, angs: { A: '∠A', D: '∠D' } })];
  FG.forEach((f, i) => { qs[i].fig = f; });
  qs[4].fig = figTwo({ angs: { B: '●', E: '●' } });
  qs[6].fig = figShadow();
  return qs;
}
function genHeikou() {
  const F = o => ({ fig: figTri(o) });
  return [
    Object.assign(NQ('hr-1', '$DE\\parallel BC$ で、$AD=3$、$DB=2$、$AE=6$。$EC$ の長さは？', 4, [[9, '比が逆。$3:2=6:EC$。'], [3, '$AD$ と同じ長さではない。$3:2=6:EC$。'], [2, '$DB$ と同じ長さではない。$3:2=6:EC$。']], ['$AD:DB=AE:EC$。', '$3:2=6:EC$。$EC=4$。'], '$DE\\parallel BC$ ならば、$AD:DB=AE:EC$。', 'cm'), F({ AD: '3', DB: '2', AE: '6', EC: 'x' })),
    Object.assign(NQ('hr-2', '$DE\\parallel BC$ で、$AD=4$、$AB=10$、$BC=15$。$DE$ の長さは？', 6, [[9, '$DB=6$ を使ってしまった。$AD:AB=DE:BC$。'], [37.5, '比が逆。$4:10=DE:15$。'], [10, '$AB$ と同じ長さではない。$4:10=DE:15$。']], ['$AD:AB=DE:BC$。', '$4:10=DE:15$。$DE=6$。'], '$DE\\parallel BC$ ならば、$AD:AB=DE:BC$。', 'cm'), F({ AD: '4', DB: '6', DE: 'x', BC: '15' })),
    Object.assign(NQ('hr-3', '$DE\\parallel BC$ で、$AD=2$、$DB=3$、$DE=4$。$BC$ の長さは？', 10, [[6, '$AD:DB$ を使ってしまった。$AD:AB=DE:BC$、$AB=5$。'], [8, '$4\\times2$ ではない。$2:5=4:BC$。'], [7, '$4+3$ ではない。$2:5=4:BC$。']], ['$AB=2+3=5$。', '$2:5=4:BC$。$BC=10$。'], '$AD:DB$ ではなく、$AD:AB$ を使うことに注意。', 'cm'), F({ AD: '2', DB: '3', DE: '4', BC: 'x' })),
    Object.assign(RQ('hr-4', '$DE\\parallel BC$ のとき、正しい比例式は？', 'AD:AB=DE:BC', [['AD:DB=DE:BC', '$AD:DB$ は、$AE:EC$ と等しい。$DE:BC$ とは、等しくない。'], ['AD:AB=AE:EC', '$AD:AB=AE:AC$。$EC$ ではなく、$AC$。'], ['DB:AB=DE:BC', '$DB:AB=EC:AC$。$DE:BC$ とは、等しくない。']], ['$\\triangle ADE\\backsim\\triangle ABC$。', '$AD:AB=AE:AC=DE:BC$。'], '三角形全体（$AB$、$AC$、$BC$）と比べる。'), F({ AD: 'AD', DB: 'DB', DE: 'DE', BC: 'BC' }).fig ? { fig: figTri({}) } : {}),
    NQ('hr-5', '$M$、$N$ が、$AB$、$AC$ の中点のとき、$BC=12$ ならば、$MN$ は？', 6, [[12, '$MN$ は、$BC$ の半分。'], [24, '$MN$ は、$BC$ の半分。2倍ではない。'], [3, '$BC$ の $\\dfrac{1}{4}$ ではない。半分。']], ['中点連結定理：$MN\\parallel BC$、$MN=\\dfrac{1}{2}BC$。', '$12\\div2=6$。'], '中点連結定理：2つの中点を結ぶ線分は、底辺の半分で、平行。', 'cm'),
    NQ('hr-6', '平行な3直線に、2直線がまじわる。一方で $3$ cm と $6$ cm、他方で $4$ cm と $x$ cm。$x$ は？', 8, [[2, '比が逆。$3:6=4:x$。'], [7, '$4+3$ ではない。$3:6=4:x$。'], [12, '$6\\times2$ ではない。$3:6=4:x$。']], ['$3:6=4:x$。', '$x=8$。'], '平行線で区切られる線分の比は、等しい。', 'cm'),
    RQ('hr-7', '$DE\\parallel BC$ で、$AD:DB=2:1$。$\\triangle ADE$ と $\\triangle ABC$ の相似比は？', '$2:3$', [['$2:1$', '$AD:AB=2:3$。$DB$ ではなく $AB$。'], ['$1:3$', '$AD:AB=2:3$。'], ['$3:2$', '小さいほうを先に書く。$2:3$。']], ['$AD:AB=2:(2+1)=2:3$。'], '相似比は、三角形全体と比べる。')
  ].map(q => q);
}
function genMenseki() {
  return [
    RQ('mb-1', '相似比が $2:3$ の2つの図形の、面積比は？', '$4:9$', [['$2:3$', '面積比は、相似比の2乗。'], ['$8:27$', '$8:27$ は、体積比。'], ['$2:9$', '$3$ だけを2乗してはいけない。両方を2乗。']], ['面積比は、相似比の2乗。', '$2^2:3^2=4:9$。'], '面積比 ＝ 相似比の2乗。'),
    RQ('mb-2', '相似比が $2:3$ の2つの立体の、体積比は？', '$8:27$', [['$4:9$', '$4:9$ は、面積比。'], ['$2:3$', '体積比は、相似比の3乗。'], ['$6:9$', '$2\\times3$ ではない。3乗。']], ['体積比は、相似比の3乗。', '$2^3:3^3=8:27$。'], '体積比 ＝ 相似比の3乗。'),
    NQ('mb-3', '相似比が $1:2$ の2つの三角形で、小さいほうの面積が $5$ cm²。大きいほうの面積は？', 20, [[10, '面積比は、相似比の2乗。$1:4$。'], [40, '$8$ 倍は、体積比。面積は $4$ 倍。'], [7, '足し算ではない。面積比 $1:4$。']], ['面積比は $1^2:2^2=1:4$。', '$5\\times4=20$。'], '面積は、相似比の2乗でふえる。', 'cm²'),
    RQ('mb-4', '2つの相似な図形の面積比が $9:16$。相似比は？', '$3:4$', [['$9:16$', '面積比の、平方根が相似比。'], ['$81:256$', '2乗してはいけない。平方根をとる。'], ['$3:2$', '$\\sqrt{9}:\\sqrt{16}=3:4$。']], ['相似比 ＝ 面積比の平方根。', '$\\sqrt{9}:\\sqrt{16}=3:4$。'], '面積比から、相似比を求めるには、平方根。'),
    NQ('mb-5', '相似な2つの円柱で、相似比が $1:3$。小さいほうの体積が $10$ cm³ のとき、大きいほうは？', 270, [[30, '体積比は、相似比の3乗。$1:27$。'], [90, '$9$ 倍は、面積比。体積は $27$ 倍。'], [13, '足し算ではない。体積比 $1:27$。']], ['体積比は $1^3:3^3=1:27$。', '$10\\times27=270$。'], '体積は、相似比の3乗でふえる。', 'cm³'),
    Object.assign(NQ('mb-6', '$DE\\parallel BC$ で、$AD:DB=2:1$。$\\triangle ADE$ の面積が $8$ cm² のとき、$\\triangle ABC$ の面積は？', 18, [[12, '相似比は $2:3$。面積比は $4:9$。'], [16, '$8\\times2$ ではない。面積比 $4:9$。'], [24, '$8\\times3$ ではない。面積比 $4:9$。']], ['相似比 $AD:AB=2:3$。', '面積比 $4:9$。$8\\times\\dfrac{9}{4}=18$。'], '相似比 → 面積比（2乗）の順に求める。', 'cm²'), { fig: figTri({ AD: '2', DB: '1' }) }),
    NQ('mb-7', '長さが $\\dfrac{1}{100}$ の模型の体積が $2$ cm³。実物の体積は何 m³？', 2, [[200, '$100^3=1000000$。cm³ を m³ にすると、$\\div1000000$。'], [0.02, '体積比は $100^3$。$2\\times1000000$ cm³。'], [20, '体積比は、$100$ 倍ではなく、$100^3$ 倍。']], ['体積比は $1:100^3=1:1000000$。', '$2\\times1000000=2000000$ cm³ ＝ $2$ m³。'], '$1$ m³ ＝ $1000000$ cm³。', 'm³')
  ];
}
/* ===== パートB: 円周角と三平方 ===== */
function genEnshu() {
  const E = (o, l) => ({ fig: figEn(o) });
  return [
    Object.assign(NQ('en-1', '図で、中心角 $\\angle AOB=120^\\circ$ のとき、円周角 $x$ は？', 60, [[120, '円周角は、中心角の半分。'], [240, '円周角は、中心角の半分。2倍ではない。'], [30, '$120\\div4$ ではない。半分。']], ['円周角 ＝ 中心角の半分。', '$120\\div2=60$。'], '円周角の定理：円周角は、同じ弧の中心角の $\\dfrac{1}{2}$。', '°'), E({ A: 210, B: 330, P: 90, labC: '120°', labP: 'x' })),
    Object.assign(NQ('en-2', '図で、円周角 $\\angle APB=40^\\circ$ のとき、中心角 $x=\\angle AOB$ は？', 80, [[20, '中心角は、円周角の2倍。'], [40, '中心角は、円周角の2倍。'], [160, '中心角は、円周角の2倍。$\\times4$ ではない。']], ['中心角 ＝ 円周角の2倍。', '$40\\times2=80$。'], '中心角は、円周角の2倍。', '°'), E({ A: 230, B: 310, P: 90, labC: 'x', labP: '40°' })),
    Object.assign(NQ('en-3', '図で、$AB$ が直径のとき、$\\angle APB$ は？', 90, [[180, '$180^\\circ$ は、直径の中心角。円周角は、その半分。'], [45, '$180\\div4$ ではない。半分で $90$。'], [60, '直径に対する円周角は、いつも $90^\\circ$。']], ['直径は、中心角が $180^\\circ$。', '円周角は、その半分で $90^\\circ$。'], '直径に対する円周角は、$90^\\circ$。', '°'), E({ A: 180, B: 0, P: 60, dia: true, labP: 'x' })),
    RQ('en-4', '同じ弧に対する円周角は？', 'すべて等しい', [['中心角の2倍', '中心角が、円周角の2倍。'], ['足して $180^\\circ$', '同じ弧に対する円周角は、等しい。'], ['場所によって変わる', '円周上のどこでも、同じ大きさ。']], ['同じ弧に対する円周角は、円周上のどこにあっても、等しい。'], '同じ弧に対する円周角は等しい。'),
    NQ('en-5', '円周角が $35^\\circ$ のとき、同じ弧に対する別の円周角は？', 35, [[70, '70° は、中心角。円周角どうしは、等しい。'], [145, '$180-35$ ではない。円周角どうしは、等しい。'], [55, '$90-35$ ではない。円周角どうしは、等しい。']], ['同じ弧に対する円周角は等しい。'], '円周角の定理①：同じ弧 → 円周角は等しい。', '°'),
    Object.assign(NQ('en-6', '図で、中心角が $150^\\circ$ のとき、円周角 $x$ は？', 75, [[150, '円周角は、中心角の半分。'], [300, '円周角は、中心角の半分。'], [30, '$150\\div5$ ではない。半分。']], ['円周角 ＝ 中心角の半分。', '$150\\div2=75$。'], '中心角が 180° をこえても、同じ。', '°'), E({ A: 195, B: 345, P: 90, labC: '150°', labP: 'x' })),
    Object.assign(NQ('en-7', '図で、円周角 $\\angle APB=70^\\circ$ のとき、中心角 $x$ は？', 140, [[35, '中心角は、円周角の2倍。'], [70, '中心角は、円周角の2倍。'], [110, '$180-70$ ではない。2倍。']], ['中心角 ＝ 円周角の2倍。', '$70\\times2=140$。'], '円周角と中心角の関係は、いつも2倍・半分。', '°'), E({ A: 200, B: 340, P: 90, labC: 'x', labP: '70°' }))
  ];
}
function genSanpei() {
  const F = (a, b, c) => ({ fig: figRt(a, b, c) });
  return [
    Object.assign(NQ('sp-1', '直角をはさむ2辺が $3$ cm と $4$ cm の直角三角形の、斜辺は？', 5, [[7, '足し算ではない。$3^2+4^2=c^2$。'], [25, '$25$ は、$c^2$。$c=\\sqrt{25}=5$。'], [3.5, '$7\\div2$ ではない。$c^2=25$。']], ['$3^2+4^2=9+16=25$。', '$c=\\sqrt{25}=5$。'], '三平方の定理：$a^2+b^2=c^2$（$c$ は斜辺）。', 'cm'), F('3', '4', 'x')),
    Object.assign(NQ('sp-2', '斜辺が $13$、1辺が $5$ の直角三角形の、もう1辺は？', 12, [[8, '$13-5$ ではない。$x^2+5^2=13^2$。'], [18, '$13+5$ ではない。斜辺が一番長い。'], [144, '$144$ は、$x^2$。$x=\\sqrt{144}=12$。']], ['$x^2+5^2=13^2$。', '$x^2=169-25=144$。$x=12$。'], '斜辺が分かっているときは、引き算。', 'cm'), F('5', 'x', '13')),
    RQ('sp-3', '3辺の長さが次のとき、直角三角形になるのは？', '$5,\\ 12,\\ 13$', [['$4,\\ 5,\\ 6$', '$4^2+5^2=41$、$6^2=36$。等しくない。'], ['$6,\\ 7,\\ 8$', '$6^2+7^2=85$、$8^2=64$。等しくない。'], ['$3,\\ 4,\\ 6$', '$3^2+4^2=25$、$6^2=36$。等しくない。']], ['$5^2+12^2=25+144=169=13^2$。'], '$a^2+b^2=c^2$ が成り立てば、直角三角形（逆）。'),
    Object.assign(RQ('sp-4', '直角二等辺三角形で、等しい辺が $4$ cm。斜辺は？', '$4\\sqrt{2}$ cm', [['$8$ cm', '$4+4$ ではない。$c^2=16+16=32$。'], ['$16$ cm', '$16$ は、$4^2$。$c^2=32$、$c=4\\sqrt{2}$。'], ['$2\\sqrt{2}$ cm', '$\\sqrt{32}=4\\sqrt{2}$。$2\\sqrt{2}$ ではない。']], ['$c^2=4^2+4^2=32$。', '$c=\\sqrt{32}=4\\sqrt{2}$。'], '直角二等辺三角形：辺の比は $1:1:\\sqrt{2}$。'), F('4', '4', 'x')),
    NQ('sp-5', '縦 $6$ cm、横 $8$ cm の長方形の、対角線の長さは？', 10, [[14, '足し算ではない。$6^2+8^2=c^2$。'], [100, '$100$ は、$c^2$。$c=10$。'], [2, '$8-6$ ではない。$c^2=100$。']], ['$6^2+8^2=36+64=100$。', '$c=\\sqrt{100}=10$。'], '長方形の対角線は、直角三角形の斜辺。', 'cm'),
    RQ('sp-6', '対角線が $6$ cm の正方形の、1辺は？', '$3\\sqrt{2}$ cm', [['$3$ cm', '$3$ cm なら、対角線は $3\\sqrt{2}$。'], ['$6\\sqrt{2}$ cm', '$6\\sqrt{2}$ は、1辺ではなく、対角線を求める式。'], ['$12$ cm', '1辺が $12$ cm なら、対角線は $12\\sqrt{2}$。']], ['1辺を $x$ とすると、$x^2+x^2=6^2$。', '$x^2=18$、$x=3\\sqrt{2}$。'], '正方形の対角線 ＝ 1辺 $\\times\\sqrt{2}$。'),
    NQ('sp-7', '座標平面で、2点 $(1,\\ 2)$ と $(4,\\ 6)$ の間の距離は？', 5, [[7, '$3+4$ ではない。$3^2+4^2=c^2$。'], [25, '$25$ は、$c^2$。$c=5$。'], [1, '距離は、$x$ の差 3 と $y$ の差 4 から。']], ['$x$ の差 $3$、$y$ の差 $4$。', '$3^2+4^2=25$。距離は $5$。'], '2点間の距離は、三平方の定理で求める。')
  ];
}
/* ===== パートC: 標本調査 ===== */
function genHyou1() {
  return [
    RQ('hy-1', '学校の健康診断のように、対象をすべて調べる調査を、何という？', '全数調査', [['標本調査', '標本調査は、一部だけを調べる。'], ['無作為抽出', 'これは、標本の選び方。'], ['推定', 'これは、調べた結果から、全体を予想すること。']], ['集団の全員を調べる。', '全数調査。'], '全数調査 ＝ すべてを調べる。標本調査 ＝ 一部だけを調べる。'),
    RQ('hy-2', 'ある工場で、製品の品質検査（こわして調べる）をする。ふさわしい調査は？', '標本調査', [['全数調査', 'すべてをこわしたら、売る製品がなくなってしまう。'], ['どちらでもよい', 'こわして調べるときは、一部だけ調べる。'], ['調査できない', '一部を調べる、標本調査ができる。']], ['全部調べると、製品がなくなる。', '一部を調べる標本調査。'], '全数調査がむずかしいときは、標本調査。'),
    RQ('hy-3', '調べたい集団全体を、何という？', '母集団', [['標本', '標本は、母集団から取り出して調べたもの。'], ['無作為', '無作為は、かたよりなく選ぶこと。'], ['平均', '平均は、データの代表値。']], ['調べたい全体 ＝ 母集団。'], '母集団 → 標本 → 推定。'),
    RQ('hy-4', '母集団から取り出して、実際に調べたものを、何という？', '標本', [['母集団', '母集団は、調べたい全体。'], ['全数', '全数は、すべて。'], ['推定', '推定は、予想すること。']], ['取り出したもの ＝ 標本。'], '標本は、母集団の一部。'),
    RQ('hy-5', '標本の選び方で、正しいのは？', 'かたよりが出ないように、無作為に選ぶ', [['仲のよい友達だけを選ぶ', 'かたよりが出る。'], ['成績のよい人だけを選ぶ', 'かたよりが出る。'], ['最初に来た人だけを選ぶ', 'かたよりが出る。']], ['かたよりのないように、くじや乱数などで選ぶ。'], '無作為に選ぶ（無作為抽出）。'),
    NQ('hy-6', '全校生徒 $600$ 人から $50$ 人を無作為に選んで調べた。標本の大きさは？', 50, [[600, '$600$ は、母集団の大きさ。'], [550, '$600-50$ ではない。調べた数が、標本の大きさ。'], [12, '$600\\div50$ ではない。']], ['標本の大きさ ＝ 取り出して調べた数。'], '標本の大きさ ＝ 標本にふくまれる数。', '人'),
    RQ('hy-7', '標本調査について、正しいのは？', '標本の傾向から、母集団の傾向を推定する', [['標本の結果は、母集団と必ず一致する', '標本調査は、全体を調べていないので、少しずれることがある。'], ['標本は、少ないほうが正確', '標本が大きいほうが、母集団に近づきやすい。'], ['標本は、1人でよい', '1人では、かたよりが出やすい。']], ['標本から、母集団を推定する。', 'ずれることもある。'], '標本調査では、結果は推定。')
  ];
}
function genHyou2() {
  return [
    NQ('hs-1', '袋に赤玉と白玉が、たくさん入っている。無作為に $50$ 個取り出すと、赤玉が $20$ 個。全体が $1000$ 個なら、赤玉はおよそ何個？', 400, [[500, '$50$ 個のうち、赤は $20$ 個（$\\dfrac{2}{5}$）。半分ではない。'], [200, '$1000\\times\\dfrac{1}{5}$ ではない。$\\dfrac{20}{50}=\\dfrac{2}{5}$。'], [20, '$20$ は、標本の中の赤玉の数。']], ['標本の割合：$\\dfrac{20}{50}=\\dfrac{2}{5}$。', '$1000\\times\\dfrac{2}{5}=400$。'], '標本の割合を、母集団にあてはめる。', '個'),
    NQ('hs-2', '池の魚に印をつけたい。$30$ 匹に印をつけて放した。後で $40$ 匹とると、印つきが $5$ 匹。池の魚は、およそ何匹？', 240, [[1200, '$30\\times40$ ではない。$30:N=5:40$。'], [150, '$30\\times5$ ではない。$30:N=5:40$。'], [8, '$40\\div5$ は、割合の逆数。$N=30\\times8$。']], ['$30:N=5:40$。', '$N=30\\times40\\div5=240$。'], '印つきの割合は、標本も母集団も、ほぼ同じ。', '匹'),
    NQ('hs-3', '全校 $800$ 人から $50$ 人を選んだら、$30$ 人が「朝食をとる」。全校では、およそ何人？', 480, [[30, '$30$ は、標本の人数。'], [160, '「とらない」$20$ 人の割合を使ってしまった。'], [600, '$50$ ではなく $40$ でわった。$\\dfrac{30}{50}=\\dfrac{3}{5}$。']], ['標本の割合：$\\dfrac{30}{50}=\\dfrac{3}{5}$。', '$800\\times\\dfrac{3}{5}=480$。'], '標本の割合 × 母集団の数。', '人'),
    RQ('hs-4', '標本の大きさを大きくすると、どうなる？', '母集団の傾向に、近づきやすくなる', [['必ず母集団と一致する', '一致するとは、限らない。'], ['何も変わらない', '大きいほうが、かたよりが小さくなる。'], ['かえって精度が悪くなる', '大きいほうが、よい推定になる。']], ['標本が大きいほど、母集団を、よく表す。'], '標本が大きいほど、推定がよくなる。'),
    NQ('hs-5', '袋の中の豆に、$100$ 個に色をつけて戻した。よくまぜて $50$ 個とると、色つきが $4$ 個。袋の豆は、およそ何個？', 1250, [[400, '$100\\times4$ ではない。$100:N=4:50$。'], [25, '$100\\div4$ ではない。$100:N=4:50$。'], [200, '$50\\times4$ ではない。$100:N=4:50$。']], ['$100:N=4:50$。', '$N=100\\times50\\div4=1250$。'], '内側の積 ＝ 外側の積。', '個'),
    NQ('hs-6', 'クラスから無作為に選んだ $5$ 人の通学時間は、$10,\\ 15,\\ 20,\\ 25,\\ 30$ 分。標本の平均は？', 20, [[100, '$100$ は、合計。人数 $5$ でわる。'], [25, '$25$ は、4番目の値。平均は、合計 ÷ 人数。'], [15, '$15$ は、2番目の値。平均は、合計 ÷ 人数。']], ['合計：$10+15+20+25+30=100$。', '$100\\div5=20$ 分。'], '標本の平均で、母集団の平均を推定する。', '分'),
    NQ('hs-7', '全校 $600$ 人から $40$ 人を選ぶと、$6$ 人が「部活に入っている」。全校では、およそ何人？', 90, [[15, '$\\dfrac{6}{40}$ に $600$ をかける。$15$ ではない。'], [3600, '$600\\times6$ ではない。$\\dfrac{6}{40}$ をかける。'], [100, '$\\dfrac{6}{40}=\\dfrac{3}{20}$。$600\\times\\dfrac{3}{20}=90$。']], ['標本の割合：$\\dfrac{6}{40}=\\dfrac{3}{20}$。', '$600\\times\\dfrac{3}{20}=90$。'], '割合を、母集団全体にあてはめる。', '人')
  ];
}
const I = {
  sj: '形が同じで、大きさがちがう図形が<b>相似</b>（記号 ∽）。<br><b>相似比</b>：対応する辺の長さの比。対応する角は、等しい。<br>三角形の<b>相似条件</b>：<br>① 3組の辺の比が、すべて等しい<br>② 2組の辺の比と、その間の角が等しい<br>③ 2組の角が、それぞれ等しい',
  hr: '$DE\\parallel BC$ ならば、<br>$AD:AB=AE:AC=DE:BC$、$AD:DB=AE:EC$。<br><b>中点連結定理</b>：2つの中点を結ぶ線は、底辺に平行で、長さは半分。' + figTri({ AD: 'AD', DB: 'DB', AE: 'AE', EC: 'EC' }).html,
  mb: '相似比が $m:n$ のとき、<br><b>面積比</b>は $m^2:n^2$、<b>体積比</b>は $m^3:n^3$。<br>面積比から相似比：平方根。',
  en: '<b>円周角の定理</b><br>① 円周角は、同じ弧の<b>中心角の半分</b>。<br>② 同じ弧に対する円周角は、すべて等しい。<br>③ <b>直径</b>に対する円周角は、$90^\\circ$。' + figEn({ A: 210, B: 330, P: 90, labC: '中心角', labP: '円周角' }).html,
  sp: '<b>三平方の定理</b>：直角三角形で、<br>$a^2+b^2=c^2$（$c$ は斜辺）。<br>直角二等辺三角形：$1:1:\\sqrt{2}$。<br>3辺が $a^2+b^2=c^2$ を満たせば、直角三角形。' + figRt('a', 'b', 'c').html,
  hy1: '<b>全数調査</b>：すべてを調べる。<b>標本調査</b>：一部だけ調べて、全体を推定する。<br>調べたい全体 ＝ <b>母集団</b>。取り出して調べたもの ＝ <b>標本</b>。<br>標本は、かたよらないように<b>無作為</b>に選ぶ。',
  hy2: '標本の割合を、母集団にあてはめて、全体を<b>推定</b>する。<br>標本が大きいほど、推定がよくなる。<br>例：標本で、$\\dfrac{20}{50}$ が赤 → 全体 $1000$ なら、$1000\\times\\dfrac{20}{50}=400$。'
};
const ABOUT = {
  sou: [
    { p: '<b>相似</b>は、形が同じで、大きさがちがう。' },
    { p: RT([['相似比', '→', '$m:n$'], ['面積比', '→', '$m^2:n^2$'], ['体積比', '→', '$m^3:n^3$']]) },
    { cap: '相似比を、まず見つけよう。' }
  ],
  en: [
    { p: '<b>円周角</b>と<b>三平方の定理</b>。' },
    { p: RT([['円周角', '→', '中心角の半分'], ['直径の円周角', '→', '$90^\\circ$'], ['三平方', '→', '$a^2+b^2=c^2$']]) },
    { cap: '図に、わかっている数を書きこもう。' }
  ],
  hyo: [
    { p: '<b>標本調査</b>は、一部を調べて全体を<b>推定</b>する。' },
    { p: RT([['母集団', '→', '調べたい全体'], ['標本', '→', '取り出したもの'], ['推定', '→', '割合をあてはめる']]) },
    { cap: 'かたよらずに選ぶ（無作為）。' }
  ]
};
const PARTS = [
  {
    id: 'sou', title: '相似と平行線', sub: '相似・平行線と比・面積比', about: ABOUT.sou, aboutTitle: 'まず見てみよう：相似', aboutSub: '形が同じで、大きさがちがう',
    steps: [
      { id: 'sou-1', title: '相似な図形', sub: '相似比・相似条件', intro: I.sj, qs: genSouji() },
      { id: 'sou-2', title: '平行線と比', sub: '中点連結定理', intro: I.hr, qs: genHeikou() },
      { id: 'sou-3', title: '面積比と体積比', sub: '2乗・3乗', intro: I.mb, qs: genMenseki() }
    ]
  },
  {
    id: 'en', title: '円周角と三平方', sub: '円周角の定理・三平方の定理', about: ABOUT.en, aboutTitle: 'まず見てみよう：円周角・三平方', aboutSub: '半分と、a²＋b²＝c²',
    steps: [
      { id: 'en-1', title: '円周角の定理', sub: '中心角・直径', intro: I.en, qs: genEnshu() },
      { id: 'en-2', title: '三平方の定理', sub: '直角三角形・距離', intro: I.sp, qs: genSanpei() }
    ]
  },
  {
    id: 'hyo', title: '標本調査', sub: '標本・母集団・推定', about: ABOUT.hyo, aboutTitle: 'まず見てみよう：標本調査', aboutSub: '一部から全体を推定',
    steps: [
      { id: 'hyo-1', title: '標本調査とは', sub: '母集団・標本・無作為', intro: I.hy1, qs: genHyou1() },
      { id: 'hyo-2', title: '全体を推定する', sub: '割合・比', intro: I.hy2, qs: genHyou2() }
    ]
  }
];
const RBM = { '中点連結定理': 'ちゅうてんれんけつていり', '三平方の定理': 'さんへいほうのていり', '相似条件': 'そうじじょうけん', '相似比': 'そうじひ', '相似': 'そうじ', '円周角': 'えんしゅうかく', '中心角': 'ちゅうしんかく', '面積比': 'めんせきひ', '体積比': 'たいせきひ', '斜辺': 'しゃへん', '直径': 'ちょっけい', '縮尺': 'しゅくしゃく', '全数調査': 'ぜんすうちょうさ', '標本調査': 'ひょうほんちょうさ', '母集団': 'ぼしゅうだん', '標本': 'ひょうほん', '無作為': 'むさくい', '推定': 'すいてい', '対応': 'たいおう', '平方根': 'へいほうこん', '対角線': 'たいかくせん' };
const RBR = new RegExp(Object.keys(RBM).sort((a, b) => b.length - a.length).join('|'), 'g');
const RB = s => s.replace(RBR, w => '<ruby>' + w + '<rt>' + RBM[w] + '</rt></ruby>');
const ruby = o => typeof o === 'string' ? o.split(/(<svg[\s\S]*?<\/svg>)/).map((t, k) => k % 2 ? t : RB(t)).join('')
  : Array.isArray(o) ? o.map(ruby) : (o && typeof o === 'object') ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, (k === 'expr' || k === 'id' || k === 'html') ? v : ruby(v)])) : o;
const out = '// 自動生成（node gen13.js）。手で直すときは gen13.js を直す。\nconst PARTS = ' + JSON.stringify(ruby(PARTS)) + ';\nif (typeof module !== \'undefined\') module.exports = PARTS;\n';
fs.writeFileSync(path.join(__dirname, 'src/data.js'), out);
let n = 0; PARTS.forEach(P => P.steps.forEach(s => { n += s.qs.length; }));
console.log('src/data.js を作成：' + n + '問、' + (out.length / 1024).toFixed(0) + 'KB');
