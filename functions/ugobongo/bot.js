// "Unfiltered Bot" chat widget at /ugobongo/bot -- unrelated to that
// page's satirical content, just hosted at a nearby hidden URL. Gated by
// the same Basic Auth credentials as /ugobongo-admin (UGOBONGO_ADMIN_USER/
// UGOBONGO_ADMIN_PASS) -- this is real access control, not just an
// obscure URL, which is what allows the looser tone in
// functions/api/ugobongo-bot/chat.js's system prompt.
//
// No server-side persistence regardless of auth: the whole conversation
// lives in this page's own JS memory and is gone the instant the tab
// closes or reloads. It cannot edit the site (see
// functions/api/ugobongo-bot/chat.js for why that's still a hard
// boundary) -- it's chat, image generation, and file attachment only, all
// sharing the same site-wide daily Workers AI budget as everything else
// under /ugobongo. Attached files are read client-side via FileReader and
// never leave the browser (no upload endpoint is called) -- nothing about
// this feature touches R2 or any other storage, matching the "nothing
// saved, not even files" requirement.
import { requireUgobongoAdmin } from '../_lib/ugobongoAuth.js';

export async function onRequestGet({ request, env }) {
  const denied = requireUgobongoAdmin(request, env);
  if (denied) return denied;

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow, noarchive">
<title>Unfiltered Bot</title>
<style>
  * { box-sizing:border-box; }
  html, body { height:100%; margin:0; }
  body { font-family:-apple-system, Arial, sans-serif; background:#eef0f3; color:#1a1a2e; display:flex; flex-direction:column; }
  header { background:#0a1e42; color:#fff; padding:1rem 1.25rem; text-align:center; }
  header h1 { margin:0; font-size:1.3rem; }
  header .sub { font-size:.8rem; opacity:.8; margin-top:.25rem; }
  main { flex:1; display:flex; flex-direction:column; max-width:640px; width:100%; margin:0 auto; min-height:0; }
  #log { flex:1; overflow-y:auto; padding:1rem; }
  .msg { margin-bottom:.85rem; font-size:.9rem; line-height:1.45; max-width:85%; }
  .msg.user { margin-left:auto; text-align:right; }
  .msg .who { font-size:.65rem; text-transform:uppercase; font-weight:700; color:#888; margin-bottom:.15rem; }
  .msg .bubble { display:inline-block; padding:.55rem .75rem; border-radius:.6rem; white-space:pre-wrap; text-align:left; }
  .msg.user .bubble { background:#0a1e42; color:#fff; }
  .msg.assistant .bubble { background:#fff; border:1px solid #ddd; }
  .msg.status .bubble { background:none; border:none; color:#999; font-style:italic; padding:.1rem 0; }
  .msg.error .bubble { border-left:3px solid #c0392b; color:#a92a1a; background:#fff; }
  .msg img { max-width:100%; border-radius:.5rem; margin-top:.4rem; display:block; }
  #budget { text-align:center; font-size:.7rem; color:#999; padding:0 1rem .4rem; }
  #attachPreview:not(:empty) { padding:0 1rem .4rem; font-size:.75rem; }
  #attachPreview .chip { background:#eef1f8; border-radius:1rem; padding:.2rem .6rem; }
  #attachPreview .chip button { border:none; background:none; color:#c0392b; font-weight:700; cursor:pointer; margin-left:.3rem; }
  .input-row { border-top:1px solid #ddd; background:#fff; padding:.75rem; display:flex; gap:.4rem; }
  .input-row textarea { flex:1; resize:none; height:44px; padding:.5rem; border:1px solid #ccc; border-radius:.4rem; font:inherit; font-size:.9rem; }
  .input-row button { border:none; border-radius:.4rem; padding:0 .9rem; cursor:pointer; font-weight:700; }
  #attachBtn, #imageBtn { background:#eef1f8; color:#0a1e42; }
  #sendBtn { background:#0a1e42; color:#fff; }
  button:disabled { opacity:.5; cursor:not-allowed; }
  footer { text-align:center; font-size:.7rem; color:#999; padding:.5rem; }
</style>
</head>
<body>

<header>
  <h1>🔓 Unfiltered Bot</h1>
  <div class="sub">Nothing here is saved anywhere, not even attached files — it's gone when you close this tab.</div>
</header>

<main>
  <div id="log"></div>
  <div id="budget"></div>
  <div id="attachPreview"></div>
  <div class="input-row">
    <button type="button" id="attachBtn" title="Attach a file">📎</button>
    <button type="button" id="imageBtn" title="Generate an image">🎨</button>
    <input type="file" id="attachFile" style="display:none">
    <textarea id="input" placeholder="Ask anything…"></textarea>
    <button type="button" id="sendBtn">Send</button>
  </div>
</main>

<footer>Nothing here is stored, including attached files. Shared daily AI budget applies.</footer>

<script>
(function () {
  var history = [];
  var log = document.getElementById('log');
  var input = document.getElementById('input');
  var sendBtn = document.getElementById('sendBtn');
  var attachBtn = document.getElementById('attachBtn');
  var attachFile = document.getElementById('attachFile');
  var attachPreview = document.getElementById('attachPreview');
  var imageBtn = document.getElementById('imageBtn');
  var budgetEl = document.getElementById('budget');
  var pendingAttachment = null;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]; }); }

  function addMsg(role, text, imageUrl) {
    var row = document.createElement('div');
    row.className = 'msg ' + role;
    var html = '';
    if (role !== 'status') html += '<div class="who">' + (role === 'user' ? 'You' : role === 'error' ? 'Error' : 'Bot') + '</div>';
    html += '<div class="bubble">' + esc(text || '');
    if (imageUrl) html += '<img src="' + esc(imageUrl) + '" alt="">';
    html += '</div>';
    row.innerHTML = html;
    log.appendChild(row);
    log.scrollTop = log.scrollHeight;
    return row;
  }

  function updateBudget(b) {
    if (!b) return;
    var remaining = b.remaining != null ? b.remaining : Math.max(0, b.cap - b.used);
    if (remaining <= 0) budgetEl.textContent = 'Shared site AI budget used up for today — resets at midnight UTC.';
    else if (b.warning) budgetEl.textContent = 'Almost at today\\'s shared AI limit (' + remaining + ' left).';
    else budgetEl.textContent = '';
  }

  function renderAttachPreview() {
    if (!pendingAttachment) { attachPreview.innerHTML = ''; return; }
    attachPreview.innerHTML = '<span class="chip">' + esc(pendingAttachment.name) + ' (not sent to server) <button type="button" id="clearAttach">×</button></span>';
    document.getElementById('clearAttach').addEventListener('click', function () { pendingAttachment = null; renderAttachPreview(); });
  }

  attachBtn.addEventListener('click', function () { attachFile.click(); });
  attachFile.addEventListener('change', function () {
    var f = attachFile.files[0];
    attachFile.value = '';
    if (!f) return;
    // Read entirely client-side -- never sent to any server, never
    // touches R2. For images this becomes an inline preview only visible
    // in this browser tab; for other file types it's just a name chip.
    var reader = new FileReader();
    reader.onload = function () {
      pendingAttachment = { dataUrl: reader.result, name: f.name, isImage: f.type.indexOf('image/') === 0 };
      renderAttachPreview();
    };
    reader.onerror = function () { addMsg('error', 'Could not read ' + f.name + '.'); };
    reader.readAsDataURL(f);
  });

  imageBtn.addEventListener('click', function () {
    var prompt = window.prompt('Describe the image to generate:');
    if (!prompt) return;
    addMsg('user', 'Generate an image: ' + prompt);
    var thinking = addMsg('status', 'Generating image…');
    imageBtn.disabled = true;
    fetch('/api/ugobongo-bot/generate-image', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: prompt }),
    }).then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); }).then(function (r) {
      imageBtn.disabled = false;
      thinking.remove();
      updateBudget(r.data.budget);
      if (!r.ok) { addMsg('error', r.data.error || 'Image generation failed.'); return; }
      addMsg('assistant', '', r.data.image_url);
    });
  });

  function send() {
    var text = input.value.trim();
    if (!text && !pendingAttachment) return;
    input.value = '';
    var displayText = text + (pendingAttachment ? (text ? '\\n' : '') + '[attached: ' + pendingAttachment.name + ']' : '');
    // The attachment image (if any) is shown only in this browser's own
    // chat log via its data: URL -- it's never part of what's sent to the
    // server/model below.
    addMsg('user', displayText, pendingAttachment && pendingAttachment.isImage ? pendingAttachment.dataUrl : null);
    // The bot's underlying model is text-only and this bot never uploads
    // anywhere, so the model just gets told a file was attached by name --
    // it can't actually see file contents.
    var content = text + (pendingAttachment ? '\\n\\n[User attached a local file named "' + pendingAttachment.name + '" -- its contents were not sent to you.]' : '');
    history.push({ role: 'user', content: content });
    pendingAttachment = null;
    renderAttachPreview();
    sendBtn.disabled = true;
    var thinking = addMsg('status', 'Thinking…');

    fetch('/api/ugobongo-bot/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: history }),
    }).then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); }).then(function (r) {
      sendBtn.disabled = false;
      thinking.remove();
      updateBudget(r.data.budget);
      if (!r.ok) { addMsg('error', r.data.error || 'Something went wrong.'); return; }
      history.push({ role: 'assistant', content: r.data.reply || '' });
      addMsg('assistant', r.data.reply || '(no reply)');
    }).catch(function (err) {
      sendBtn.disabled = false;
      thinking.remove();
      addMsg('error', 'Connection error: ' + err.message);
    });
  }

  sendBtn.addEventListener('click', send);
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  });

  addMsg('assistant', "Ask me anything, or hit 🎨 to generate an image.");
})();
</script>
</body>
</html>`;

  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'x-robots-tag': 'noindex, nofollow' },
  });
}
