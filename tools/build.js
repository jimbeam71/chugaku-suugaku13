// usage: node build.js  -> out/preview.html (単一ファイル。KaTeXのCSS・フォント・JSを全部埋め込む)
const fs = require('fs'), path = require('path');
const src = p => fs.readFileSync(path.join(__dirname, 'src', p), 'utf8');
let css = src('katex.min.css');
// woff2だけ残し、フォントはdata URIに
css = css.replace(/src:url\(fonts\/([A-Za-z0-9_-]+)\.woff2\) format\("woff2"\)[^;}]*/g, (_, name) => {
  const b64 = fs.readFileSync(path.join(__dirname, 'src/fonts', name + '.woff2')).toString('base64');
  return 'src:url(data:font/woff2;base64,' + b64 + ') format("woff2")';
});
if (/fonts\//.test(css)) throw new Error('未置換のフォント参照が残っています');
let html = src('index.template.html')
  .replace('{{KATEX_CSS}}', () => '<style>' + css + '</style>')
  .replace('{{KATEX_JS}}', () => '<script>' + src('katex.min.js') + '</script>')
  .replace('{{DATA_JS}}', () => src('data.js'));
// 公開用: 完全なHTML文書にして public/index.html に書く（--repo のとき）
if (process.argv.includes('--repo')) {
  const cut = html.indexOf('<main id="app">');
  const doc = '<!doctype html>\n<html lang="ja">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n' +
    html.slice(0, cut) + '</head>\n<body>\n' + html.slice(cut) + '</body>\n</html>\n';
  fs.mkdirSync(path.join(__dirname, 'public'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, 'public/index.html'), doc);
  console.log('public/index.html', (doc.length / 1024).toFixed(0) + 'KB');
}
fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'out/preview.html'), html);
console.log('preview.html', (html.length / 1024).toFixed(0) + 'KB');
