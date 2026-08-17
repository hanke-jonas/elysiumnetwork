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
    "This is, without question, the SLOWEST page ever built. Nobody has ever seen a page load this badly. TREMENDOUS badness. The best badness.",
    "Many people are saying — and I mean MANY people, very smart people — that Ugobongo is the number one worst website in the history of websites, maybe ever.",
    "97% of statistics about this page are made up on the spot, and honestly? Still more accurate than most polls.",
    "If you are reading this, you have already wasted more time than the page intended, and frankly, it intends A LOT. Nobody wastes time better than this page. Nobody.",
    "Ugobongo: not a word, not a product, not a place. Just vibes. Tremendous vibes. The most tremendous vibes anyone has ever vibed.",
    "This filler text is, in the opinion of many, the greatest filler text ever written. Some say the greatest text, period. We're not saying that. Other people are saying that.",
    "Loading is a state of mind. So is winning. This page is losing on purpose, which, if you think about it, is actually winning. Very smart.",
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
<title>Ugobongo — the most tremendous page ever built</title>
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
  h1 { font-size:3.5rem; text-shadow:4px 4px 0 magenta, 8px 8px 0 cyan; color:#fff; text-transform:uppercase; }
  .crown { font-size:5rem; text-align:center; }
  .banner { background:gold; border:4px solid #b8860b; color:#111; font-weight:bold; text-align:center; padding:1rem; font-size:1.3rem; margin:1.5rem 0; text-transform:uppercase; }
  .portrait-wrap { text-align:center; margin:2rem 0; }
  .portrait-wrap img { max-width:320px; width:100%; border:8px solid gold; box-shadow:0 0 0 4px #111, 12px 12px 0 magenta; }
  .portrait-wrap .cap { margin-top:.75rem; font-weight:bold; font-size:1.1rem; }
  .portrait-wrap .credit { font-size:.65rem; opacity:.6; margin-top:.25rem; }
</style>
</head>
<body>

<div id="loader">
  <div class="spinner"></div>
  <div class="pct" id="pct">0%</div>
  <div class="msg" id="msg">Building the Greatest Loading Screen in History…</div>
</div>

<div id="content">
  <marquee behavior="alternate" scrollamount="8">★彡 WELCOME TO UGOBONGO — THE MOST TREMENDOUS PAGE EVER BUILT — BELIEVE ME 彡★</marquee>
  <div class="crown">👑🍊</div>
  <h1>UGOBONGO: HUGE. TREMENDOUS. THE BEST.</h1>
  <div class="banner">Nobody has ever built a slower page. NOBODY. And that's a good thing, believe me.</div>
  <div class="portrait-wrap">
    <img src="/assets/ugobongo-portrait.jpg" alt="" width="320" height="400" loading="lazy">
    <div class="cap">TREMENDOUS. HUGE. THE BEST PORTRAIT.</div>
    <div class="credit">Official White House portrait — U.S. federal government work, public domain (17 U.S.C. §105).</div>
  </div>
  <div class="portrait-wrap">
    <img src="/uploads/fef22fd1-b89f-4a8c-8136-99602295900b.jpg" alt="" width="320" loading="lazy">
    <div class="cap">EVEN MORE TREMENDOUS.</div>
  </div>
  <p><strong>This page is a deliberate test page,</strong> and frankly, the best test page anyone has ever tested. It is supposed to be slow and full of junk, and it is doing that job better than any page in history. People are calling it a disaster. Other people — smarter people — are calling it a masterpiece. We report both.</p>
  <div class="blobs">${junkDivs(120)}</div>
  ${junkParagraphs(40)}
  <div class="banner">Sad!</div>
  <marquee>THANK YOU FOR YOUR PATIENCE. IT WAS TREMENDOUS PATIENCE. THERE WAS NEVER ANYTHING HERE. GOODBYE.</marquee>
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
