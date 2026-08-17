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
//   3. A fake client-side loading screen (no fake percentage — just a
//      spinner and rotating messages) before the junk page is revealed.

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
  // Slower than before, on purpose.
  await new Promise((resolve) => setTimeout(resolve, 12000));

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
  body { margin:0; font-family: -apple-system, "Helvetica Neue", Arial, sans-serif; background:#fff; color:#111; }
  marquee { background:#111; color:#fff; font-size:1.4rem; padding:.5rem; font-weight:800; letter-spacing:.02em; }
  #loader { position:fixed; inset:0; z-index:999; background:#fff; color:#111; display:flex; flex-direction:column; align-items:center; justify-content:center; }
  #loader .spinner { width:80px; height:80px; border:10px solid #eee; border-top-color:#111; border-radius:50%; animation:spin 1s linear infinite; margin-bottom:2rem; }
  @keyframes spin { to { transform: rotate(360deg); } }
  #loader .msg { margin-top:.5rem; font-size:1.4rem; font-weight:800; min-height:1.5em; text-align:center; padding:0 2rem; }
  #content { display:none; padding:3rem 2rem; max-width:1000px; margin:0 auto; }
  .junk { background:#fafafa; border:2px solid #eee; border-radius:.5rem; padding:1rem; margin:1rem 0; }
  .tiny { font-size:.7rem; opacity:.5; }
  .blobs { display:flex; flex-wrap:wrap; gap:6px; margin:2rem 0; }
  .blob { width:44px; height:44px; display:flex; align-items:center; justify-content:center; font-size:.6rem; color:#fff; border-radius:50%; animation:pulse 2s ease-in-out infinite; }
  @keyframes pulse { 0%,100%{ transform:scale(1);} 50%{ transform:scale(1.15);} }
  h1 { font-size:5rem; font-weight:900; color:#111; text-transform:uppercase; letter-spacing:-.02em; line-height:1; margin:1rem 0; }
  .crown { font-size:5rem; text-align:center; }
  .banner { background:#111; border-radius:.75rem; color:#fff; font-weight:800; text-align:center; padding:1.25rem; font-size:1.5rem; margin:2rem 0; text-transform:uppercase; }
  .portrait-wrap { text-align:center; margin:2.5rem 0; }
  .portrait-wrap img { max-width:340px; width:100%; border-radius:1rem; box-shadow:0 20px 60px rgba(0,0,0,.15); }
  .portrait-wrap .cap { margin-top:1rem; font-weight:800; font-size:1.2rem; }
  .portrait-wrap .credit { font-size:.65rem; opacity:.5; margin-top:.25rem; }
</style>
</head>
<body>

<div id="loader">
  <div class="spinner"></div>
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
  <div class="portrait-wrap">
    <img src="/uploads/d6221aa2-e55a-4b65-8d84-49a5d947d966.jpg" alt="" width="320" loading="lazy">
    <div class="cap">TREMENDOUS, PART THREE.</div>
  </div>
  <p><strong>This page is a deliberate test page,</strong> and frankly, the best test page anyone has ever tested. It is supposed to be slow and full of junk, and it is doing that job better than any page in history. People are calling it a disaster. Other people — smarter people — are calling it a masterpiece. We report both.</p>
  <div class="blobs">${junkDivs(120)}</div>
  ${junkParagraphs(40)}
  <div class="banner">Sad!</div>
  <marquee>THANK YOU FOR YOUR PATIENCE. IT WAS TREMENDOUS PATIENCE. THERE WAS NEVER ANYTHING HERE. GOODBYE.</marquee>
</div>

<script>
  // Layer 3: a fake client-side wait with no percentage at all — no fake
  // number to point at, just a spinner and rotating messages, for even
  // longer than before, on purpose.
  (function () {
    var msg = document.getElementById('msg');
    var loader = document.getElementById('loader');
    var content = document.getElementById('content');
    var messages = [
      'Reticulating splines…',
      'Ugobonging the bongo…',
      'Downloading more RAM…',
      'Asking nicely…',
      'This is taking a while, and that is intentional…',
      'Recalculating pointlessness…',
      'Please continue to wait…',
      'Still not done. Still on purpose.',
    ];
    var i = 0;
    var interval = setInterval(function () {
      msg.textContent = messages[i % messages.length];
      i++;
    }, 900);
    setTimeout(function () {
      clearInterval(interval);
      loader.style.display = 'none';
      content.style.display = 'block';
    }, 10000);
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
