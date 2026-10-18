// 検査: 正解が式と一致 / 誤答は正解と別の値 / 理由つき / 選択肢4つ / ID重複なし / 各ステップ6問
const PARTS = require('./src/data.js');
let ng = 0, n = 0; const ids = new Set();
const bad = m => { ng++; console.log('NG', m); };
const near = (a, b) => Array.isArray(a) ? a.length === b.length && a.every((x, i) => Math.abs(x - b[i]) < 1e-9) : Math.abs(a - b) < 1e-9;
const key = v => Array.isArray(v) ? v.map(x => x.toFixed(9)).join(',') : v.toFixed(9);
PARTS.forEach(P => P.steps.forEach(S => {
  if (S.qs.length < 6) bad(S.id + ' 問題数が6未満: ' + S.qs.length);
  if (!S.intro) bad(S.id + ' intro なし');
  S.qs.forEach(q => {
    n++;
    if (ids.has(q.id)) bad(q.id + ' ID重複'); ids.add(q.id);
    const truth = Function('return ' + q.expr)();
    const c = q.ch[q.ans];
    if (c.v == null || !near(c.v, truth)) bad(q.id + ' 正解の値が式と合わない ' + JSON.stringify(c.v) + ' vs ' + JSON.stringify(truth));
    q.ch.forEach((x, i) => {
      if (i !== q.ans && x.v != null && near(x.v, truth) && !x.same) bad(q.id + ' 誤答が正解と同じ値 ' + i);
      if (i !== q.ans && !x.why) bad(q.id + ' 誤答に理由がない ' + i);
    });
    const vs = q.ch.filter(x => !x.same).map(x => x.v).filter(v => v != null);
    if (new Set(vs.map(key)).size !== vs.length) bad(q.id + ' 選択肢の値がダブり');
    const ts = q.ch.map(x => x.t);
    if (new Set(ts).size !== ts.length) bad(q.id + ' 選択肢の表示がダブり');
    if (q.ch.length !== 4) bad(q.id + ' 選択肢が4つでない');
    if (!q.steps || !q.steps.length || !q.point) bad(q.id + ' steps/point 不足');
  });
}));
console.log(ng ? ng + '件NG' : 'ALL OK（' + n + '問）');
process.exit(ng ? 1 : 0);
