// Jonas's personal portfolio page at /jonashanke — a fully self-contained
// page (own layout, fonts, cursor, canvas background) deliberately served
// outside the Eleventy build so it never inherits the main site's header,
// footer, or global CSS. Not linked from nav/footer/sitemap/search index;
// reachable only via the direct URL.
//
// Gated behind HTTP Basic Auth (username/password: Trump/Trump), requested
// and hardcoded as-is rather than pulled from a Pages secret — unlike the
// ugobongo admin gate, this credential is meant to just BE "Trump"/"Trump"
// in the open, not to guard anything sensitive.

const BASIC_AUTH_USER = 'Trump';
const BASIC_AUTH_PASS = 'Trump';

export async function onRequestGet({ request }) {
  const auth = request.headers.get('Authorization') || '';
  const expected = 'Basic ' + btoa(`${BASIC_AUTH_USER}:${BASIC_AUTH_PASS}`);
  if (auth !== expected) {
    return new Response('Authentication required.', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Jonas Hanke"' },
    });
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Jonas Hanke — Field Notes</title>
<meta name="description" content="Jonas Hanke — co-founder of Elysium+ Network, radio host, and youth-work organiser building democratic networks across Europe.">
<style>
  :root{
    --bg: #07090c;
    --bg-soft: #0d1117;
    --ink: #eef1f5;
    --ink-dim: #8a93a1;
    --line: #1c2430;
    --gold: #e8b34d;
    --gold-dim: #7a5f2c;
    --red: #d1553d;
    --mono: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
    --serif: Georgia, 'Times New Roman', serif;
  }

  *{ margin:0; padding:0; box-sizing:border-box; }

  html{ scroll-behavior:smooth; }

  body{
    background:var(--bg);
    color:var(--ink);
    font-family:var(--serif);
    overflow-x:hidden;
    cursor:none;
  }

  ::selection{ background:var(--gold); color:#111; }

  a{ color:inherit; text-decoration:none; }

  #network-canvas{
    position:fixed;
    inset:0;
    z-index:0;
    opacity:0.55;
  }

  /* custom cursor */
  .cursor-dot, .cursor-ring{
    position:fixed;
    top:0; left:0;
    pointer-events:none;
    z-index:9999;
    border-radius:50%;
    transform:translate(-50%,-50%);
    transition:opacity .2s;
  }
  .cursor-dot{
    width:6px; height:6px;
    background:var(--gold);
  }
  .cursor-ring{
    width:32px; height:32px;
    border:1px solid var(--gold-dim);
    transition:transform .15s ease-out, opacity .2s;
  }
  body.hovering .cursor-ring{
    transform:translate(-50%,-50%) scale(1.6);
    border-color:var(--gold);
  }
  @media (hover:none), (pointer:coarse){
    .cursor-dot, .cursor-ring{ display:none; }
    body{ cursor:auto; }
  }

  main{ position:relative; z-index:1; }

  /* ---- side nav ---- */
  nav.rail{
    position:fixed;
    right:2.2rem;
    top:50%;
    transform:translateY(-50%);
    z-index:50;
    display:flex;
    flex-direction:column;
    gap:1.1rem;
  }
  nav.rail a{
    display:flex;
    align-items:center;
    justify-content:flex-end;
    gap:.6rem;
    font-family:var(--mono);
    font-size:.65rem;
    letter-spacing:.12em;
    text-transform:uppercase;
    color:var(--ink-dim);
  }
  nav.rail a .dot{
    width:6px; height:6px;
    border-radius:50%;
    background:var(--ink-dim);
    transition:all .3s;
  }
  nav.rail a .label{
    opacity:0;
    transform:translateX(6px);
    transition:all .25s;
    white-space:nowrap;
  }
  nav.rail a:hover .label{ opacity:1; transform:translateX(0); }
  nav.rail a:hover .dot, nav.rail a.active .dot{
    background:var(--gold);
    box-shadow:0 0 8px var(--gold);
    transform:scale(1.4);
  }
  nav.rail a.active{ color:var(--gold); }

  @media (max-width: 860px){
    nav.rail{ display:none; }
  }

  /* ---- hero ---- */
  section.hero{
    min-height:100svh;
    display:flex;
    flex-direction:column;
    justify-content:center;
    padding:6rem 8vw;
    position:relative;
  }
  .eyebrow{
    font-family:var(--mono);
    font-size:.72rem;
    letter-spacing:.25em;
    text-transform:uppercase;
    color:var(--gold);
    margin-bottom:1.6rem;
    display:flex;
    align-items:center;
    gap:.6rem;
  }
  .eyebrow::before{
    content:'';
    width:22px; height:1px;
    background:var(--gold);
    display:inline-block;
  }
  h1.name{
    font-size:clamp(3rem, 10vw, 8rem);
    line-height:.95;
    font-weight:400;
    letter-spacing:-.02em;
  }
  h1.name .accent{ color:var(--gold); font-style:italic; }
  .tagline{
    margin-top:2rem;
    max-width:640px;
    font-size:clamp(1rem, 1.6vw, 1.25rem);
    color:var(--ink-dim);
    line-height:1.7;
    font-family:var(--serif);
  }
  .hero-meta{
    margin-top:3rem;
    display:flex;
    gap:2.4rem;
    flex-wrap:wrap;
    font-family:var(--mono);
    font-size:.75rem;
    color:var(--ink-dim);
    letter-spacing:.05em;
  }
  .hero-meta strong{ color:var(--ink); display:block; font-size:.7rem; text-transform:uppercase; letter-spacing:.15em; color:var(--gold); margin-bottom:.3rem;}

  .scroll-cue{
    position:absolute;
    bottom:2.5rem;
    left:8vw;
    font-family:var(--mono);
    font-size:.65rem;
    letter-spacing:.2em;
    text-transform:uppercase;
    color:var(--ink-dim);
    display:flex;
    align-items:center;
    gap:.8rem;
  }
  .scroll-cue .bar{
    width:1px; height:34px;
    background:linear-gradient(var(--gold), transparent);
    animation:scrollpulse 2s ease-in-out infinite;
  }
  @keyframes scrollpulse{
    0%,100%{ transform:scaleY(1); opacity:.4; }
    50%{ transform:scaleY(1.3); opacity:1; }
  }

  /* ---- section shell ---- */
  section{
    padding:8rem 8vw;
    position:relative;
    border-top:1px solid var(--line);
  }
  .section-head{
    display:flex;
    justify-content:space-between;
    align-items:flex-end;
    gap:2rem;
    margin-bottom:4rem;
    flex-wrap:wrap;
  }
  .section-num{
    font-family:var(--mono);
    font-size:.7rem;
    color:var(--gold-dim);
    letter-spacing:.2em;
  }
  h2.section-title{
    font-size:clamp(2rem, 4vw, 3.2rem);
    font-weight:400;
    letter-spacing:-.01em;
  }
  .section-sub{
    max-width:360px;
    color:var(--ink-dim);
    font-size:.95rem;
    line-height:1.6;
    text-align:right;
  }
  @media (max-width:700px){
    .section-sub{ text-align:left; }
  }

  .reveal{
    opacity:0;
    transform:translateY(28px);
    transition:opacity .8s ease, transform .8s ease;
  }
  .reveal.in{ opacity:1; transform:none; }

  /* ---- about ---- */
  .about-grid{
    display:grid;
    grid-template-columns:1.3fr 1fr;
    gap:5rem;
  }
  .about-grid p{
    font-size:1.15rem;
    line-height:1.85;
    color:#c7cdd6;
    margin-bottom:1.4rem;
  }
  .about-grid p .hl{ color:var(--gold); font-style:italic; }
  .fact-list{ display:flex; flex-direction:column; gap:1.6rem; }
  .fact{
    border-left:2px solid var(--line);
    padding-left:1.2rem;
    transition:border-color .3s;
  }
  .fact:hover{ border-color:var(--gold); }
  .fact .k{
    font-family:var(--mono);
    font-size:.68rem;
    text-transform:uppercase;
    letter-spacing:.15em;
    color:var(--ink-dim);
    margin-bottom:.35rem;
  }
  .fact .v{ font-size:1rem; color:var(--ink); }
  @media (max-width:860px){ .about-grid{ grid-template-columns:1fr; gap:3rem; } }

  /* ---- timeline ---- */
  .timeline{ position:relative; }
  .timeline::before{
    content:'';
    position:absolute;
    left:10px;
    top:0; bottom:0;
    width:1px;
    background:linear-gradient(var(--line), var(--gold-dim), var(--line));
  }
  .t-item{
    position:relative;
    padding-left:3.4rem;
    padding-bottom:3.4rem;
  }
  .t-item:last-child{ padding-bottom:0; }
  .t-item::before{
    content:'';
    position:absolute;
    left:5px; top:6px;
    width:11px; height:11px;
    border-radius:50%;
    background:var(--bg);
    border:2px solid var(--gold-dim);
    transition:all .3s;
  }
  .t-item.in::before{
    border-color:var(--gold);
    box-shadow:0 0 12px rgba(232,179,77,.5);
  }
  .t-when{
    font-family:var(--mono);
    font-size:.7rem;
    letter-spacing:.1em;
    color:var(--gold);
    text-transform:uppercase;
    margin-bottom:.5rem;
  }
  .t-role{ font-size:1.5rem; margin-bottom:.3rem; }
  .t-org{ color:var(--ink-dim); font-family:var(--mono); font-size:.85rem; margin-bottom:.9rem; }
  .t-desc{ color:#b7bfca; line-height:1.75; max-width:640px; }

  /* ---- network map ---- */
  .map-grid{
    display:grid;
    grid-template-columns:repeat(auto-fill, minmax(230px, 1fr));
    gap:1px;
    background:var(--line);
    border:1px solid var(--line);
  }
  .node{
    background:var(--bg);
    padding:2rem 1.6rem;
    position:relative;
    transition:background .3s;
    min-height:190px;
    display:flex;
    flex-direction:column;
    justify-content:space-between;
  }
  .node:hover{ background:var(--bg-soft); }
  .node .city{
    font-family:var(--mono);
    font-size:.7rem;
    letter-spacing:.15em;
    text-transform:uppercase;
    color:var(--gold);
  }
  .node .proj{
    font-size:1.05rem;
    line-height:1.4;
    margin-top:1.2rem;
  }
  .node .when{
    margin-top:1rem;
    font-family:var(--mono);
    font-size:.68rem;
    color:var(--ink-dim);
  }
  .node::after{
    content:'';
    position:absolute;
    top:0; left:0;
    width:0%; height:2px;
    background:var(--gold);
    transition:width .4s;
  }
  .node:hover::after{ width:100%; }

  /* ---- skills ---- */
  .skills-wrap{
    display:grid;
    grid-template-columns:1fr 1fr;
    gap:4rem;
  }
  @media (max-width:860px){ .skills-wrap{ grid-template-columns:1fr; gap:3rem; } }
  .lang-row{ margin-bottom:1.3rem; }
  .lang-row .top{
    display:flex;
    justify-content:space-between;
    font-family:var(--mono);
    font-size:.78rem;
    margin-bottom:.5rem;
  }
  .lang-row .top span:last-child{ color:var(--gold-dim); }
  .bar-track{ height:3px; background:var(--line); }
  .bar-fill{ height:100%; background:var(--gold); width:0; transition:width 1.2s ease; }
  .tag-cloud{ display:flex; flex-wrap:wrap; gap:.6rem; }
  .tag{
    font-family:var(--mono);
    font-size:.75rem;
    padding:.5rem .9rem;
    border:1px solid var(--line);
    color:var(--ink-dim);
    transition:all .25s;
  }
  .tag:hover{ border-color:var(--gold); color:var(--gold); }

  /* ---- contact ---- */
  section.contact{
    padding-bottom:10rem;
  }
  .contact-inner{
    display:flex;
    flex-direction:column;
    align-items:flex-start;
    gap:2.4rem;
  }
  h2.big-cta{
    font-size:clamp(2.4rem, 6vw, 5rem);
    line-height:1.05;
    font-weight:400;
    max-width:900px;
  }
  h2.big-cta .accent{ color:var(--gold); font-style:italic; }
  .contact-links{
    display:flex;
    gap:1.2rem;
    flex-wrap:wrap;
  }
  .contact-links a{
    font-family:var(--mono);
    font-size:.85rem;
    letter-spacing:.05em;
    padding:1rem 1.8rem;
    border:1px solid var(--line);
    display:flex;
    align-items:center;
    gap:.7rem;
    transition:all .3s;
  }
  .contact-links a:hover{
    border-color:var(--gold);
    color:var(--gold);
    transform:translateY(-2px);
  }
  .contact-links a .arrow{ transition:transform .3s; }
  .contact-links a:hover .arrow{ transform:translate(3px,-3px); }

  footer{
    padding:2.5rem 8vw;
    border-top:1px solid var(--line);
    display:flex;
    justify-content:space-between;
    font-family:var(--mono);
    font-size:.7rem;
    color:var(--ink-dim);
    letter-spacing:.08em;
    flex-wrap:wrap;
    gap:1rem;
  }
</style>
</head>
<body>

<canvas id="network-canvas"></canvas>
<div class="cursor-dot"></div>
<div class="cursor-ring"></div>

<nav class="rail" id="rail">
  <a href="#hero" class="active"><span class="label">Signal</span><span class="dot"></span></a>
  <a href="#about"><span class="label">Dispatch</span><span class="dot"></span></a>
  <a href="#experience"><span class="label">Fieldwork</span><span class="dot"></span></a>
  <a href="#network"><span class="label">Network</span><span class="dot"></span></a>
  <a href="#skills"><span class="label">Frequencies</span><span class="dot"></span></a>
  <a href="#contact"><span class="label">Reach</span><span class="dot"></span></a>
</nav>

<main>

  <section class="hero" id="hero">
    <div class="eyebrow">Leipzig / Chernihiv — broadcasting since 2022</div>
    <h1 class="name">Jonas<br><span class="accent">Hanke</span></h1>
    <p class="tagline">
      I build the networks that democracy runs on — organising cross-border youth
      exchanges, chasing EU grants across time zones, and hosting late-night radio
      when the paperwork's finally done.
    </p>
    <div class="hero-meta">
      <div><strong>Based</strong>Leipzig, Germany</div>
      <div><strong>Role</strong>Co-founder, Elysium+ Network</div>
      <div><strong>Also</strong>Radio Host · Mephisto 97.6</div>
      <div><strong>Studying</strong>History, Universität Leipzig</div>
    </div>
    <div class="scroll-cue"><span class="bar"></span>Scroll</div>
  </section>

  <section id="about">
    <div class="section-head">
      <div>
        <div class="section-num reveal">01 — Dispatch</div>
        <h2 class="section-title reveal">What I actually do</h2>
      </div>
      <p class="section-sub reveal">The short version of a résumé that reads like a border crossing.</p>
    </div>
    <div class="about-grid">
      <div class="reveal">
        <p>Since April 2025 I've co-founded and helped run <span class="hl">Elysium+ Network</span>,
        a registered NGO connecting young people across Chernihiv, Leipzig, Turin and Warsaw. Most of
        the job is unglamorous: partner communication, EU grant management, and reporting that has to
        survive an audit. Some of it isn't — we got <span class="hl">"Democracy On Tracks"</span> and
        <span class="hl">"RVoice: Media against Discrimination"</span> approved by the European Commission,
        and I've managed volunteer teams through logistics that don't always cooperate, including under
        crisis conditions in Ukraine.</p>
        <p>Alongside that I host and edit programmes on international affairs for
        <span class="hl">Mephisto 97.6</span>, the University of Leipzig's campus radio, and cut my teeth
        writing socio-political pieces during an editorial internship at <span class="hl">die tageszeitung
        (taz)</span> in Berlin. Before all that, I led a 76&nbsp;km youth education trip on historical-political
        and anti-racist work, and picked up a Hebraicum along the way — long story.</p>
      </div>
      <div class="fact-list reveal">
        <div class="fact"><div class="k">Accreditation</div><div class="v">European Solidarity Corps Quality Label, valid to 12/2027</div></div>
        <div class="fact"><div class="k">Grants secured</div><div class="v">KA155 "Democracy On Tracks" · KA152 "RVoice"</div></div>
        <div class="fact"><div class="k">Languages</div><div class="v">German & Polish (native) · English (C1)</div></div>
        <div class="fact"><div class="k">Education</div><div class="v">B.A. History, Universität Leipzig — 4th semester</div></div>
      </div>
    </div>
  </section>

  <section id="experience">
    <div class="section-head">
      <div>
        <div class="section-num reveal">02 — Fieldwork</div>
        <h2 class="section-title reveal">Where the time went</h2>
      </div>
      <p class="section-sub reveal">Professional experience and voluntary work, roughly in order.</p>
    </div>
    <div class="timeline">
      <div class="t-item reveal">
        <div class="t-when">Since 04/2025 — Leipzig &amp; Chernihiv</div>
        <div class="t-role">Co-founder &amp; Project Manager</div>
        <div class="t-org">Elysium+ Network</div>
        <div class="t-desc">Coordination of multilateral Erasmus+ projects (KA1/KA2) — planning, partner
        communication, reporting and EU grant management. Management of international volunteer teams:
        logistics, stakeholder communication and budget compliance under crisis conditions.</div>
      </div>
      <div class="t-item reveal">
        <div class="t-when">Since 01/2025 — Leipzig</div>
        <div class="t-role">Radio Host &amp; Editor</div>
        <div class="t-org">Mephisto 97.6, campus radio, University of Leipzig</div>
        <div class="t-desc">Production, scripting and live hosting of programmes on international topics —
        editorial work and clear communication under time pressure.</div>
      </div>
      <div class="t-item reveal">
        <div class="t-when">04/2023 — Berlin</div>
        <div class="t-role">Editorial Internship</div>
        <div class="t-org">die tageszeitung (taz), national daily newspaper</div>
        <div class="t-desc">Independent research and publication of socio-political articles.</div>
      </div>
      <div class="t-item reveal">
        <div class="t-when">10/2022 — Monschau</div>
        <div class="t-role">Team Leader &amp; Multiplier</div>
        <div class="t-org">Youth Education Trip "Stadt Land Fluss"</div>
        <div class="t-desc">Led an experiential 76&nbsp;km education trip with young people — historical-political
        education and anti-racist values work.</div>
      </div>
    </div>
  </section>

  <section id="network">
    <div class="section-head">
      <div>
        <div class="section-num reveal">03 — Network</div>
        <h2 class="section-title reveal">Twenty-plus projects, several borders</h2>
      </div>
      <p class="section-sub reveal">A selection as speaker and participant. Full references available on request.</p>
    </div>
    <div class="map-grid reveal">
      <div class="node">
        <div class="city">Lviv, UA</div>
        <div class="proj">Invited Speaker — Conference on Ukrainian Studies, "Ukraine in the World." Paper: <em>Outside-In — Youth Networks, Democratic Engagement and Europe's New Perspective on Ukraine.</em> 250+ researchers from 38 countries.</div>
        <div class="when">08–10 / 07 / 2026</div>
      </div>
      <div class="node">
        <div class="city">Budapest, HU</div>
        <div class="proj">Training Seminar — Building Resilience in Young People. Council of Europe, European Youth Centre Budapest, with the Ukrainian Ministry of Youth &amp; Sports.</div>
        <div class="when">04 / 2026</div>
      </div>
      <div class="node">
        <div class="city">Kars, TR</div>
        <div class="proj">Study Visit — Youth Work in Rural Areas. Erasmus+ / Turkish National Agency.</div>
        <div class="when">03 / 2026</div>
      </div>
      <div class="node">
        <div class="city">Morocco</div>
        <div class="proj">Training Course — Social Hackathons for Community-based Problem Solving. Erasmus+ KA2, Euro-Mediterranean region.</div>
        <div class="when">11 / 2025</div>
      </div>
      <div class="node">
        <div class="city">Birštonas, LT</div>
        <div class="proj">Training Course — Project Management in Youth Work. Erasmus+ / Beyond Borders.</div>
        <div class="when">Summer 2023</div>
      </div>
      <div class="node">
        <div class="city">Montenegro</div>
        <div class="proj">Travel Scholarship &amp; Research Report, zis Foundation for Study Travel. Four-week independent research on young people's anxieties around climate change.</div>
        <div class="when">Since 10 / 2024</div>
      </div>
    </div>
  </section>

  <section id="skills">
    <div class="section-head">
      <div>
        <div class="section-num reveal">04 — Frequencies</div>
        <h2 class="section-title reveal">Tools of the trade</h2>
      </div>
      <p class="section-sub reveal">Languages, software, and the certificates that let me take groups outdoors.</p>
    </div>
    <div class="skills-wrap">
      <div class="reveal">
        <div class="lang-row" data-level="100"><div class="top"><span>German</span><span>Native</span></div><div class="bar-track"><div class="bar-fill"></div></div></div>
        <div class="lang-row" data-level="100"><div class="top"><span>Polish</span><span>Native</span></div><div class="bar-track"><div class="bar-fill"></div></div></div>
        <div class="lang-row" data-level="80"><div class="top"><span>English</span><span>C1, professional</span></div><div class="bar-track"><div class="bar-fill"></div></div></div>
        <div class="lang-row" data-level="55"><div class="top"><span>Hebrew</span><span>Hebraicum</span></div><div class="bar-track"><div class="bar-fill"></div></div></div>
        <div class="lang-row" data-level="25"><div class="top"><span>French</span><span>A1</span></div><div class="bar-track"><div class="bar-fill"></div></div></div>
      </div>
      <div class="reveal">
        <div class="tag-cloud">
          <span class="tag">MS Office</span>
          <span class="tag">Google Workspace</span>
          <span class="tag">Canva</span>
          <span class="tag">Basecamp</span>
          <span class="tag">Erasmus+ ORS / Mobility Tool</span>
          <span class="tag">Juleica Youth Leader Licence</span>
          <span class="tag">First Aid — Children &amp; Young People</span>
          <span class="tag">First Responder (DRK, 60h)</span>
          <span class="tag">Prevention of Sexual Violence</span>
        </div>
      </div>
    </div>
  </section>

  <section class="contact" id="contact">
    <div class="contact-inner">
      <div>
        <div class="section-num reveal">05 — Reach</div>
        <h2 class="big-cta reveal">Working on something across <span class="accent">borders</span>?<br>Let's talk.</h2>
      </div>
      <div class="contact-links reveal">
        <a href="https://www.linkedin.com/in/jonas-hanke" target="_blank" rel="noopener noreferrer">LinkedIn <span class="arrow">↗</span></a>
        <a href="mailto:hanke@elysium.ngo">hanke@elysium.ngo <span class="arrow">↗</span></a>
      </div>
    </div>
  </section>

</main>

<footer>
  <span>© 2026 Jonas Hanke — Leipzig, Germany</span>
  <span>Co-founder, Elysium+ Network</span>
</footer>

<script>
// ---------- custom cursor ----------
const dot = document.querySelector('.cursor-dot');
const ring = document.querySelector('.cursor-ring');
let mx = window.innerWidth/2, my = window.innerHeight/2;
let rx = mx, ry = my;
window.addEventListener('mousemove', e=>{
  mx = e.clientX; my = e.clientY;
  dot.style.left = mx+'px'; dot.style.top = my+'px';
});
(function loop(){
  rx += (mx-rx)*0.18; ry += (my-ry)*0.18;
  ring.style.left = rx+'px'; ring.style.top = ry+'px';
  requestAnimationFrame(loop);
})();
document.querySelectorAll('a, .node, .tag').forEach(el=>{
  el.addEventListener('mouseenter', ()=>document.body.classList.add('hovering'));
  el.addEventListener('mouseleave', ()=>document.body.classList.remove('hovering'));
});

// ---------- reveal on scroll ----------
const io = new IntersectionObserver((entries)=>{
  entries.forEach(e=>{
    if(e.isIntersecting){
      e.target.classList.add('in');
      if(e.target.classList.contains('t-item')) e.target.classList.add('in');
      const bars = e.target.querySelectorAll ? e.target.querySelectorAll('.lang-row') : [];
      bars.forEach(row=>{
        const fill = row.querySelector('.bar-fill');
        fill.style.width = row.dataset.level + '%';
      });
      io.unobserve(e.target);
    }
  });
},{threshold:0.15});
document.querySelectorAll('.reveal, .t-item').forEach(el=>io.observe(el));

// safety net: IntersectionObserver can be throttled or miss fast/instant scrolls,
// so also sweep on scroll/resize and reveal anything already within the viewport.
function revealVisible(){
  document.querySelectorAll('.reveal:not(.in), .t-item:not(.in)').forEach(el=>{
    const r = el.getBoundingClientRect();
    if(r.top < window.innerHeight * 0.95 && r.bottom > 0){
      el.classList.add('in');
      el.querySelectorAll ? el.querySelectorAll('.lang-row').forEach(row=>{
        const fill = row.querySelector('.bar-fill');
        if(fill) fill.style.width = row.dataset.level + '%';
      }) : null;
      io.unobserve(el);
    }
  });
}
let sweepQueued = false;
function queueSweep(){
  if(sweepQueued) return;
  sweepQueued = true;
  requestAnimationFrame(()=>{ revealVisible(); sweepQueued = false; });
}
window.addEventListener('scroll', queueSweep, {passive:true});
window.addEventListener('resize', queueSweep);
window.addEventListener('load', revealVisible);
revealVisible();
setTimeout(revealVisible, 400);

// ---------- active nav link ----------
const railLinks = document.querySelectorAll('nav.rail a');
const sections = [...railLinks].map(a=>document.querySelector(a.getAttribute('href')));
const navIo = new IntersectionObserver((entries)=>{
  entries.forEach(e=>{
    if(e.isIntersecting){
      const id = '#'+e.target.id;
      railLinks.forEach(a=>a.classList.toggle('active', a.getAttribute('href')===id));
    }
  });
},{threshold:0.5});
sections.forEach(s=> s && navIo.observe(s));

// ---------- network canvas background ----------
const canvas = document.getElementById('network-canvas');
const ctx = canvas.getContext('2d');
let w,h,nodes;
const CITIES = ['LEIPZIG','CHERNIHIV','TURIN','WARSAW','AACHEN','BERLIN','LVIV','BUDAPEST','KARS','MONTENEGRO'];

function resize(){
  w = canvas.width = window.innerWidth;
  h = canvas.height = window.innerHeight;
  const count = Math.max(14, Math.min(26, Math.floor(w/90)));
  nodes = Array.from({length:count}, (_,i)=>({
    x: Math.random()*w,
    y: Math.random()*h,
    vx: (Math.random()-0.5)*0.25,
    vy: (Math.random()-0.5)*0.25,
    label: Math.random()<0.4 ? CITIES[i % CITIES.length] : null,
    r: Math.random()*1.4 + 1.2
  }));
}
window.addEventListener('resize', resize);
resize();

let mouseX = -9999, mouseY = -9999;
window.addEventListener('mousemove', e=>{ mouseX = e.clientX; mouseY = e.clientY; });
window.addEventListener('mouseleave', ()=>{ mouseX=-9999; mouseY=-9999; });

function tick(){
  ctx.clearRect(0,0,w,h);
  for(const n of nodes){
    n.x += n.vx; n.y += n.vy;
    if(n.x<0||n.x>w) n.vx*=-1;
    if(n.y<0||n.y>h) n.vy*=-1;
  }
  for(let i=0;i<nodes.length;i++){
    for(let j=i+1;j<nodes.length;j++){
      const a=nodes[i], b=nodes[j];
      const dx=a.x-b.x, dy=a.y-b.y;
      const dist = Math.sqrt(dx*dx+dy*dy);
      const maxDist = 190;
      if(dist < maxDist){
        const op = (1 - dist/maxDist) * 0.35;
        ctx.strokeStyle = 'rgba(232,179,77,' + op + ')';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y);
        ctx.stroke();
      }
    }
    const dmx = n.x-mouseX, dmy = n.y-mouseY;
    const mdist = Math.sqrt(dmx*dmx+dmy*dmy);
    if(mdist < 220){
      const op = (1-mdist/220)*0.6;
      ctx.strokeStyle = 'rgba(232,179,77,' + op + ')';
      ctx.beginPath();
      ctx.moveTo(n.x,n.y); ctx.lineTo(mouseX,mouseY);
      ctx.stroke();
    }
  }
  for(const n of nodes){
    ctx.beginPath();
    ctx.arc(n.x,n.y,n.r,0,Math.PI*2);
    ctx.fillStyle = 'rgba(232,179,77,0.85)';
    ctx.fill();
    if(n.label){
      ctx.font = "9px monospace";
      ctx.fillStyle = "rgba(138,147,161,0.55)";
      ctx.fillText(n.label, n.x+8, n.y+3);
    }
  }
  requestAnimationFrame(tick);
}
tick();
</script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=600',
    },
  });
}
