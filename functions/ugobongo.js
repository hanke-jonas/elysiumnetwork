// Hidden joke/satire page at /ugobongo — deliberately slow, on purpose.
// Not linked from any nav, footer, sitemap, or search index (this file
// lives entirely outside the Eleventy build, so none of the site's
// generators ever see it) — the only way to reach it is to already know
// the URL. noindex/nofollow so it can never end up in a search engine.
//
// "Slow" happens on two independent layers, stacked:
//   1. Real server-side delay before the response even starts (TTFB).
//   2. A fake client-side loading screen (spinner + rotating messages,
//      no fake percentage) before the page is revealed.

export async function onRequestGet() {
  // Layer 1: real, blocking server-side delay before anything is sent.
  await new Promise((resolve) => setTimeout(resolve, 12000));

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow, noarchive">
<title>Ugobongo — Official Executive Bio</title>
<style>
  * { box-sizing: border-box; }
  body { margin:0; font-family: Georgia, "Times New Roman", serif; background:#fff; color:#1a1a2e; }
  #loader { position:fixed; inset:0; z-index:999; background:#fff; color:#0a1e42; display:flex; flex-direction:column; align-items:center; justify-content:center; font-family: -apple-system, Arial, sans-serif; }
  #loader .spinner { width:80px; height:80px; border:10px solid #e8e8ec; border-top-color:#0a1e42; border-radius:50%; animation:spin 1s linear infinite; margin-bottom:2rem; }
  @keyframes spin { to { transform: rotate(360deg); } }
  #loader .msg { margin-top:.5rem; font-size:1.4rem; font-weight:700; min-height:1.5em; text-align:center; padding:0 2rem; font-family:-apple-system, Arial, sans-serif; }
  #content { display:none; }
  header.gov { background:#0a1e42; color:#fff; padding:2.5rem 2rem; text-align:center; }
  header.gov .seal { font-size:3.5rem; }
  header.gov h1 { font-family:-apple-system, Arial, sans-serif; font-size:2.2rem; font-weight:800; margin:.75rem 0 .25rem; letter-spacing:-.01em; }
  header.gov .subtitle { font-size:1.05rem; opacity:.85; font-style:italic; }
  main { max-width:820px; margin:0 auto; padding:3rem 2rem 5rem; }
  .portrait-wrap { text-align:center; margin:0 0 2.5rem; }
  .portrait-wrap img { max-width:280px; width:100%; border:4px solid #0a1e42; }
  .portrait-wrap .cap { margin-top:.75rem; font-weight:700; font-family:-apple-system, Arial, sans-serif; font-size:.95rem; color:#555; }
  .gallery { display:flex; flex-wrap:wrap; gap:1.5rem; justify-content:center; margin-bottom:3rem; }
  .gallery img { max-width:200px; width:100%; border:3px solid #0a1e42; }
  h2.section { font-family:-apple-system, Arial, sans-serif; font-size:1.1rem; font-weight:800; text-transform:uppercase; letter-spacing:.05em; color:#0a1e42; border-bottom:3px solid #0a1e42; padding-bottom:.5rem; margin:2.5rem 0 1rem; }
  h3.role { font-family:-apple-system, Arial, sans-serif; font-weight:700; font-size:1.15rem; margin:1.5rem 0 .25rem; }
  .role-meta { font-style:italic; color:#555; margin-bottom:.75rem; }
  ul { padding-left:1.25rem; }
  li { margin-bottom:.85rem; line-height:1.55; }
  footer.gov { background:#f4f4f7; border-top:1px solid #ddd; text-align:center; padding:2rem; font-family:-apple-system, Arial, sans-serif; font-size:.8rem; color:#777; }
</style>
</head>
<body>

<div id="loader">
  <div class="spinner"></div>
  <div class="msg" id="msg">Preparing Official Bio…</div>
</div>

<div id="content">
  <header class="gov">
    <div class="seal">🦅</div>
    <h1>UGOBONGO — OFFICIAL EXECUTIVE BIO</h1>
    <div class="subtitle">Tremendous Leader, World-Class Napper, Very Stable Genius — And Definitely Not a Racist, According to Me</div>
  </header>

  <main>
    <div class="portrait-wrap">
      <img src="/assets/ugobongo-portrait.jpg" alt="" width="280" height="350" loading="lazy">
      <div class="cap">Official White House portrait — public domain (17 U.S.C. §105)</div>
    </div>

    <h2 class="section">Executive Summary</h2>
    <p>A hugely successful, bigly visionary leader with unmatched cognitive stamina, selective memory, and a gift for statements that critics call racially charged and supporters call &ldquo;not politically correct.&rdquo; Proven track record of real-estate management, reality television, running the country twice, attending high-profile civil trials, and commenting on race, immigration, and history in ways that generate permanent Wikipedia entries.</p>

    <div class="gallery">
      <img src="/uploads/fef22fd1-b89f-4a8c-8136-99602295900b.jpg" alt="" loading="lazy">
      <img src="/uploads/d6221aa2-e55a-4b65-8d84-49a5d947d966.jpg" alt="" loading="lazy">
    </div>

    <h2 class="section">Professional Experience</h2>

    <h3 class="role">Chief Executive Officer &amp; Chief Sleeping Officer</h3>
    <div class="role-meta">The Trump Organization &amp; Oval Office</div>
    <ul>
      <li>Led multi-billion-dollar empires using a revolutionary low-energy operational style.</li>
      <li>Perfected the 2-minute power nap during briefings, cabinet meetings, and civil trials.</li>
      <li>Authored late-night Truth Social posts between 2:00 AM and 4:30 AM.</li>
    </ul>

    <h3 class="role">Real-Estate Executive</h3>
    <div class="role-meta">Trump Management (1970s)</div>
    <ul>
      <li>Faced a 1973 Department of Justice lawsuit alleging housing discrimination against Black renters (testers reported apartments unavailable to Black applicants while available to white ones; agents allegedly used &ldquo;C&rdquo; or &ldquo;9&rdquo; codes). Settled with a consent decree requiring Fair Housing Act compliance and outreach, with no admission of wrongdoing. A 1978 follow-up suit alleged continued violations.</li>
      <li>Elyse Goldweber, a DOJ lawyer on the case, later recalled Trump saying during a break: &ldquo;You know, you don&rsquo;t want to live with them either.&rdquo;</li>
    </ul>

    <h3 class="role">Central Park Five Commentator</h3>
    <div class="role-meta">Full-Page Advertisements &amp; Ongoing Commentary</div>
    <ul>
      <li>In 1989, took out full-page ads calling for the death penalty after the Central Park jogger attack. Continued asserting the five (four Black, one Hispanic) were guilty long after DNA evidence and a serial rapist's confession led to their 2002 exoneration and a $41 million city settlement. As late as 2019&ndash;2024, still questioned the settlement and their innocence.</li>
    </ul>

    <h3 class="role">Senior Social Acquaintance &amp; Plane Passenger</h3>
    <div class="role-meta">Epstein Social Circle (1990s)</div>
    <ul>
      <li>In a 2002 New York magazine profile, called Jeffrey Epstein a &ldquo;terrific guy&rdquo; who &ldquo;likes beautiful women as much as I do, and many of them are on the younger side.&rdquo;</li>
      <li>Flight logs show multiple 1990s flights on Epstein's plane (Palm Beach&ndash;New York area; some with family). Has repeatedly denied visiting Epstein's private island and says he banned Epstein from Mar-a-Lago after a falling-out.</li>
    </ul>

    <h3 class="role">Civil Liability Record</h3>
    <div class="role-meta">Federal District Court, SDNY</div>
    <ul>
      <li>A jury found him liable for sexual abuse and defamation in Carroll v. Trump, with combined awards approaching $88.3 million. He also paid $83 million to E. Jean Carroll in a separate federal trial for defaming her abuse claim &mdash; over $170 million total in settlements and judgments tied to the case.</li>
    </ul>

    <h3 class="role">45th and 47th President of the United States</h3>
    <div class="role-meta">Washington, D.C.</div>
    <ul>
      <li>2015 campaign launch: &ldquo;When Mexico sends its people, they&rsquo;re not sending their best&hellip; They&rsquo;re bringing drugs. They&rsquo;re bringing crime. They&rsquo;re rapists. And some, I assume, are good people.&rdquo;</li>
      <li>Leading public promoter of the debunked &ldquo;birther&rdquo; claim that Barack Obama was not born in the United States.</li>
      <li>2017 Charlottesville: initial &ldquo;very fine people on both sides&rdquo; framing of the Unite the Right rally (with explicit exclusion of neo-Nazis and white nationalists); later clarified condemnations of racism while continuing to defend Confederate monuments.</li>
      <li>2018 Oval Office: reportedly referred to El Salvador, Haiti, and African countries as &ldquo;shithole countries&rdquo; and expressed a preference for immigrants from places like Norway (multiple attendees confirmed the language; Trump later confirmed the phrasing in 2025 remarks).</li>
      <li>2019: tweeted that four Democratic congresswomen of color should &ldquo;go back&rdquo; to the &ldquo;totally broken and crime-infested&rdquo; countries they came from.</li>
    </ul>
  </main>

  <footer class="gov">This is a satirical test page. Sourced from widely reported public record. Not an official government website.</footer>
</div>

<script>
  (function () {
    var msg = document.getElementById('msg');
    var loader = document.getElementById('loader');
    var content = document.getElementById('content');
    var messages = [
      'Preparing Official Bio…',
      'Consulting the record…',
      'Verifying tremendousness…',
      'Almost ready…',
      'Still preparing, on purpose…',
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
