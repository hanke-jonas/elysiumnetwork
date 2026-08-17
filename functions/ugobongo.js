// Hidden joke/test page at /ugobongo — deliberately slow and deliberately
// terrible, on purpose, per explicit request. Not linked from any nav,
// footer, sitemap, or search index (this file lives entirely outside the
// Eleventy build, so none of the site's generators ever see it) — the only
// way to reach it is to already know the URL. noindex/nofollow so it can
// never end up in a search engine either.
//
// "Slow" happens on three independent layers, stacked:
//   1. Real server-side delay before the response even starts (TTFB).
//   2. A large, deliberately junk-padded HTML payload.
//   3. A fake client-side loading screen with its own fake, non-linear
//      progress bar before the "real" (junk) page is even revealed.

function junkParagraphs(n) {
  const lines = [
    "Ugobongo Industries™ regrets to inform you that nothing here is real, load-bearing, or a good idea.",
    "This page intentionally contains a large amount of nothing, rendered slowly, on purpose.",
    "97% of statistics about this page are made up on the spot, including this one.",
    "If you are reading this, you have already wasted more time than the page intended, and it intends a lot.",
    "Ugobongo: not a word, not a product, not a place. Just vibes.",
    "Please enjoy this filler text as if it were meaningful. It is not.",
    "Loading is a state of mind. So is patience. Neither will help you here.",
  ];
  let out = "";
  for (let i = 0; i < n; i++) {
    out += `<p class="junk">${lines[i % lines.length]} <span class="tiny">(junk paragraph #${i + 1} of ${n}, generated at request time for maximum pointlessness)</span></p>\n`;
  }
  return out;
}

function junkDivs(n) {
  let out = "";
  for (let i = 0; i < n; i++) {
    const hue = (i * 37) % 360;
    out += `<div class="blob" style="background:hsl(${hue},70%,60%)">#${i}</div>`;
  }
  return out;
}

export async function onRequestGet() {
  // Layer 1: real, blocking server-side delay before anything is sent.
  await new Promise((resolve) => setTimeout(resolve, 6000));

  // Layer 2: a big, deliberately junk-padded body.
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow, noarchive">
<title>Ugobongo — please wait forever</title>
<style>
  * { box-sizing: border-box; }
  body { margin:0; font-family: "Comic Sans MS", cursive, sans-serif; background: repeating-linear-gradient(45deg, #ff00ff, #ff00ff 10px, #00ffff 10px, #00ffff 20px); color:#111; }
  marquee { background:#000; color:#0f0; font-size:1.4rem; padding:.5rem; }
  #loader { position:fixed; inset:0; z-index:999; background:#000; color:#0f0; display:flex; flex-direction:column; align-items:center; justify-content:center; font-family: monospace; }
  #loader .spinner { width:64px; height:64px; border:8px solid #0f0; border-top-color:transparent; border-radius:50%; animation:spin 1s linear infinite; margin-bottom:1.5rem; }
  @keyframes spin { to { transform: rotate(360deg); } }
  #loader .pct { font-size:2rem; }
  #loader .msg { margin-top:1rem; opacity:.7; min-height:1.5em; }
  #content { display:none; padding:2rem; }
  .junk { background:#fff; border:3px dashed magenta; padding:.75rem; margin:.75rem 0; }
  .tiny { font-size:.7rem; opacity:.6; }
  .blobs { display:flex; flex-wrap:wrap; gap:4px; margin:1.5rem 0; }
  .blob { width:40px; height:40px; display:flex; align-items:center; justify-content:center; font-size:.6rem; color:#fff; border-radius:50%; animation:pulse 2s ease-in-out infinite; }
  @keyframes pulse { 0%,100%{ transform:scale(1);} 50%{ transform:scale(1.15);} }
  h1 { font-size:3rem; text-shadow:4px 4px 0 magenta, 8px 8px 0 cyan; color:#fff; }
</style>
</head>
<body>

<div id="loader">
  <div class="spinner"></div>
  <div class="pct" id="pct">0%</div>
  <div class="msg" id="msg">Initializing Ugobongo Experience™…</div>
</div>

<div id="content">
  <marquee behavior="alternate" scrollamount="8">★彡 WELCOME TO UGOBONGO — YOU ARE VISITOR #4,839,201,004 彡★</marquee>
  <h1>UGOBONGO</h1>
  <p><strong>This page is a deliberate test page.</strong> It is supposed to be slow and full of junk. It is doing a great job.</p>
  <div class="blobs">${junkDivs(120)}</div>
  ${junkParagraphs(40)}
  <marquee>THANK YOU FOR YOUR PATIENCE. THERE WAS NEVER ANYTHING HERE. GOODBYE.</marquee>
</div>

<script>
  // Layer 3: a fake, non-linear, occasionally-stalling loading bar that
  // has nothing to do with real load progress — it exists purely to make
  // the page feel even slower than it already is.
  (function () {
    var pct = document.getElementById('pct');
    var msg = document.getElementById('msg');
    var loader = document.getElementById('loader');
    var content = document.getElementById('content');
    var messages = [
      'Reticulating splines…',
      'Ugobonging the bongo…',
      'Downloading more RAM…',
      'Asking nicely…',
      'Definitely almost done…',
      'Recalculating pointlessness…',
      'Please continue to wait…',
    ];
    var p = 0;
    function tick() {
      var jump = p < 80 ? Math.random() * 6 : Math.random() * 0.5;
      p = Math.min(100, p + jump);
      pct.textContent = Math.floor(p) + '%';
      msg.textContent = messages[Math.floor(Math.random() * messages.length)];
      if (p < 100) {
        setTimeout(tick, 250 + Math.random() * 400);
      } else {
        setTimeout(function () {
          loader.style.display = 'none';
          content.style.display = 'block';
        }, 600);
      }
    }
    setTimeout(tick, 500);
  })();
</script>

</body>
</html>`;

  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex, nofollow',
    },
  });
}
