import { requireUgobongoAdmin } from './_lib/ugobongoAuth.js';

// Visual block editor for the hidden /ugobongo joke page — a live canvas,
// a widget palette, drag-and-drop add/reorder, and click-to-select
// property editing, all persisting to the same ugobongo_config row and
// the same /api/ugobongo-admin/config endpoint the earlier form-based
// panel used. The widget type registry (WIDGETS, below) is the "reusable
// architecture" contract: adding a new widget type means adding one entry
// here (with a matching case in functions/ugobongo.js's renderBlock) —
// nothing else about the canvas, drag-and-drop, or persistence changes.
export async function onRequestGet({ request, env }) {
  const denied = requireUgobongoAdmin(request, env);
  if (denied) return denied;

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>Ugobongo Visual Editor</title>
<style>
  * { box-sizing:border-box; }
  html, body { height:100%; }
  body { margin:0; font-family:-apple-system, Arial, sans-serif; background:#eef0f3; color:#1a1a2e; display:flex; flex-direction:column; }

  header.topbar { background:#0a1e42; color:#fff; padding:.75rem 1.25rem; display:flex; align-items:center; justify-content:space-between; }
  header.topbar h1 { font-size:1rem; margin:0; font-weight:700; }
  header.topbar .actions { display:flex; gap:.5rem; align-items:center; }
  .btn { background:#fff; color:#0a1e42; border:none; padding:.5rem 1rem; border-radius:.4rem; font-weight:700; cursor:pointer; font-size:.85rem; }
  .btn.primary { background:#2e7d32; color:#fff; }
  .btn.danger { background:#c0392b; color:#fff; }
  .btn:disabled { opacity:.5; cursor:not-allowed; }
  #status { color:#cfd8e8; font-size:.8rem; }

  .layout { flex:1; display:grid; grid-template-columns:220px 1fr 300px; min-height:0; }

  .palette, .props { background:#fff; border-right:1px solid #ddd; overflow-y:auto; padding:1rem; }
  .props { border-right:none; border-left:1px solid #ddd; }
  .palette h2, .props h2 { font-size:.75rem; text-transform:uppercase; letter-spacing:.05em; color:#888; margin:0 0 .75rem; }
  .widget-btn { display:flex; align-items:center; gap:.5rem; width:100%; text-align:left; padding:.6rem .75rem; margin-bottom:.5rem; border:1px solid #ddd; border-radius:.5rem; background:#fafafa; cursor:grab; font-size:.85rem; }
  .widget-btn:hover { background:#eef1f8; border-color:#0a1e42; }

  .canvas-wrap { overflow-y:auto; background:#ccc; padding:2rem 1rem; }
  #canvas { max-width:820px; margin:0 auto; background:#fff; min-height:400px; box-shadow:0 4px 20px rgba(0,0,0,.15); }
  .block { position:relative; border:2px solid transparent; padding:.5rem 2rem; cursor:pointer; }
  .block:hover { border-color:#8ba3d1; }
  .block.selected { border-color:#0a1e42; }
  .block .block-label { position:absolute; top:-1px; left:-2px; background:#0a1e42; color:#fff; font-size:.65rem; padding:.15rem .5rem; border-radius:0 0 .35rem 0; display:none; font-family:-apple-system, Arial, sans-serif; }
  .block.selected .block-label, .block:hover .block-label { display:block; }
  .block-drop-line { height:6px; margin:0 2rem; }
  .block-drop-line.over { background:#0a1e42; border-radius:3px; }
  .cols { display:grid; grid-template-columns:1fr 1fr; gap:1rem; }
  .cols .col { border:1px dashed #ccc; min-height:60px; padding:.5rem; }
  .empty-canvas { padding:4rem 2rem; text-align:center; color:#999; font-size:.9rem; }

  /* Rendered widget look — a simplified mirror of the public page's CSS
     (Georgia serif, navy sections) so the canvas is a faithful preview,
     not just a wireframe. */
  .w-heading { font-family:-apple-system, Arial, sans-serif; font-size:1.1rem; font-weight:800; text-transform:uppercase; letter-spacing:.05em; color:#0a1e42; border-bottom:3px solid #0a1e42; padding-bottom:.5rem; margin:1.5rem 0 .75rem; }
  .w-paragraph { font-family:Georgia, serif; line-height:1.6; margin:.5rem 0; }
  .w-image { text-align:center; margin:1rem 0; }
  .w-image img { max-width:100%; max-height:260px; }
  .w-gallery { display:flex; flex-wrap:wrap; gap:1rem; justify-content:center; margin:1rem 0; }
  .w-gallery img { max-width:150px; max-height:150px; object-fit:cover; border:3px solid #0a1e42; }
  .w-button a { display:inline-block; background:#0a1e42; color:#fff; padding:.6rem 1.25rem; border-radius:.4rem; text-decoration:none; font-family:-apple-system, Arial, sans-serif; font-weight:700; }
  .w-spacer { }
  .w-role { font-family:-apple-system, Arial, sans-serif; }
  .w-role h3 { font-size:1.05rem; margin:0 0 .15rem; }
  .w-role .meta { font-style:italic; color:#555; font-size:.85rem; margin-bottom:.4rem; }
  .w-role ul { margin:0; padding-left:1.1rem; font-family:Georgia, serif; }
  .w-role li { margin-bottom:.4rem; line-height:1.5; }

  .props label { display:block; font-weight:600; font-size:.8rem; margin:.85rem 0 .3rem; }
  .props input[type=text], .props input[type=number], .props textarea { width:100%; padding:.5rem; border:1px solid #ccc; border-radius:.4rem; font:inherit; font-size:.85rem; }
  .props textarea { min-height:80px; font-family:monospace; }
  .props .item-row { display:flex; gap:.4rem; margin-bottom:.4rem; }
  .props .item-row textarea { flex:1; min-height:44px; }
  .props .item-row button { border:none; background:#c0392b; color:#fff; border-radius:.3rem; width:26px; cursor:pointer; }
  .props .dropzone { border:2px dashed #aaa; border-radius:.5rem; padding:1rem; text-align:center; font-size:.8rem; color:#666; cursor:pointer; margin-top:.4rem; }
  .props .dropzone.drag { border-color:#0a1e42; background:#eef1f8; }
  .props .no-selection { color:#999; font-size:.85rem; }
  .props .thumbs { display:flex; flex-wrap:wrap; gap:.4rem; margin-top:.5rem; }
  .props .thumbs img { width:50px; height:50px; object-fit:cover; border-radius:.3rem; border:1px solid #ccc; }

  #settingsPanel { position:fixed; inset:0; background:rgba(0,0,0,.4); display:none; align-items:center; justify-content:center; z-index:50; }
  #settingsPanel.open { display:flex; }
  #settingsPanel .box { background:#fff; border-radius:.75rem; padding:1.5rem; max-width:500px; width:90%; max-height:85vh; overflow-y:auto; }
  #settingsPanel label { display:block; font-weight:600; font-size:.85rem; margin:.75rem 0 .3rem; }
  #settingsPanel input, #settingsPanel textarea { width:100%; padding:.5rem; border:1px solid #ccc; border-radius:.4rem; font:inherit; }
</style>
</head>
<body>

<header class="topbar">
  <h1>🦅 Ugobongo Visual Editor</h1>
  <div class="actions">
    <span id="status"></span>
    <button type="button" class="btn" id="settingsBtn">Site settings</button>
    <a href="/ugobongo?preview=1" target="_blank" class="btn">Preview (no loading screen)</a>
    <button type="button" class="btn primary" id="saveBtn">Save &amp; publish</button>
  </div>
</header>

<div class="layout">
  <div class="palette">
    <h2>Widgets — drag onto canvas</h2>
    <div id="widgetList"></div>
  </div>

  <div class="canvas-wrap">
    <div id="canvas"></div>
  </div>

  <div class="props" id="propsPanel">
    <h2>Properties</h2>
    <div class="no-selection">Select a block on the canvas to edit it.</div>
  </div>
</div>

<div id="settingsPanel">
  <div class="box">
    <h2 style="margin-top:0">Site settings</h2>
    <label for="stTitle">Page title</label>
    <input type="text" id="stTitle">
    <label for="stSubtitle">Subtitle</label>
    <input type="text" id="stSubtitle">
    <label for="stLoadingMs">Loading duration (ms)</label>
    <input type="number" id="stLoadingMs" min="0" max="60000" step="500">
    <label for="stMessages">Loading messages (one per line)</label>
    <textarea id="stMessages"></textarea>
    <label>Spinner overlay image</label>
    <div id="spinnerDrop" class="dropzone">Drag a picture here, or click to upload</div>
    <input type="file" id="spinnerFile" style="display:none">
    <div id="spinnerThumb" class="thumbs"></div>
    <label for="stSpinnerSpeed">Spin speed (ms per rotation — lower is faster)</label>
    <input type="number" id="stSpinnerSpeed" min="200" max="10000" step="100">
    <div style="margin-top:1.25rem; display:flex; gap:.5rem; justify-content:flex-end;">
      <button type="button" class="btn" id="settingsCloseBtn">Done</button>
    </div>
  </div>
</div>

<script>
(function () {
  // --- Widget type registry -------------------------------------------
  // Each entry: label (palette button text), defaultData (new-block
  // shape), render(data) -> canvas preview HTML, fields (property-panel
  // field descriptors). This is the single source of truth the palette,
  // canvas, and property panel all read from — adding a widget type here
  // is the entire "extend the editor" story.
  var WIDGETS = {
    heading: {
      label: 'Heading',
      defaultData: function () { return { text: 'New Section' }; },
      render: function (d) { return '<div class="w-heading">' + esc(d.text) + '</div>'; },
    },
    paragraph: {
      label: 'Paragraph',
      defaultData: function () { return { html: 'New paragraph text.' }; },
      render: function (d) { return '<div class="w-paragraph">' + (d.html || '') + '</div>'; },
    },
    image: {
      label: 'Image',
      defaultData: function () { return { url: '', caption: '' }; },
      render: function (d) { return '<div class="w-image">' + (d.url ? '<img src="' + esc(d.url) + '">' : '<span style="color:#999">No image set</span>') + (d.caption ? '<div style="font-size:.8rem;color:#666;margin-top:.4rem">' + esc(d.caption) + '</div>' : '') + '</div>'; },
    },
    gallery: {
      label: 'Gallery',
      defaultData: function () { return { images: [] }; },
      render: function (d) { return '<div class="w-gallery">' + (d.images || []).map(function (u) { return '<img src="' + esc(u) + '">'; }).join('') + (!d.images || !d.images.length ? '<span style="color:#999">No images yet</span>' : '') + '</div>'; },
    },
    button: {
      label: 'Button',
      defaultData: function () { return { label: 'Click me', href: '#' }; },
      render: function (d) { return '<div class="w-button"><a href="' + esc(d.href) + '">' + esc(d.label) + '</a></div>'; },
    },
    spacer: {
      label: 'Spacer',
      defaultData: function () { return { height: 40 }; },
      render: function (d) { return '<div class="w-spacer" style="height:' + (d.height || 40) + 'px"></div>'; },
    },
    role: {
      label: 'Role Section',
      defaultData: function () { return { title: 'Role Title', meta: 'Organization, dates', items: ['First point.'] }; },
      render: function (d) {
        return '<div class="w-role"><h3>' + esc(d.title) + '</h3><div class="meta">' + esc(d.meta) + '</div><ul>' +
          (d.items || []).map(function (i) { return '<li>' + i + '</li>'; }).join('') + '</ul></div>';
      },
    },
    columns: {
      label: 'Columns (2)',
      defaultData: function () { return { left: [], right: [] }; },
      render: function (d) {
        function side(list) { return (list || []).map(function (b) { return WIDGETS[b.type] ? WIDGETS[b.type].render(b) : ''; }).join(''); }
        return '<div class="cols"><div class="col">' + (side(d.left) || '<span style="color:#bbb;font-size:.75rem">Empty column</span>') + '</div><div class="col">' + (side(d.right) || '<span style="color:#bbb;font-size:.75rem">Empty column</span>') + '</div></div>';
      },
    },
  };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function uid() { return 'b' + Math.random().toString(36).slice(2, 10); }

  // --- State -------------------------------------------------------------
  var state = {
    title: '', subtitle: '', loading_ms: 12000, loading_messages: [], spinner_image_url: null, spinner_speed_ms: 2000,
    images: [], bio_html: '',
    blocks: [],
  };
  var selectedId = null;

  function apiFetch(url, opts) {
    opts = opts || {};
    return fetch(url, opts).then(function (r) { return r.json().then(function (data) { return { ok: r.ok, status: r.status, data: data }; }); });
  }

  function uploadFile(file, onDone) {
    var fd = new FormData();
    fd.append('file', file);
    apiFetch('/api/ugobongo-admin/upload', { method: 'POST', body: fd }).then(function (r) {
      if (r.ok) onDone(r.data.url);
    });
  }

  // --- Palette -------------------------------------------------------------
  var paletteEl = document.getElementById('widgetList');
  Object.keys(WIDGETS).forEach(function (type) {
    var btn = document.createElement('div');
    btn.className = 'widget-btn';
    btn.draggable = true;
    btn.textContent = '+ ' + WIDGETS[type].label;
    btn.addEventListener('dragstart', function (e) { e.dataTransfer.setData('text/new-widget', type); });
    paletteEl.appendChild(btn);
  });

  // --- Canvas rendering ------------------------------------------------
  var canvasEl = document.getElementById('canvas');

  function renderCanvas() {
    canvasEl.innerHTML = '';
    if (!state.blocks.length) {
      var empty = document.createElement('div');
      empty.className = 'empty-canvas';
      empty.textContent = 'Drag a widget from the left to start building the page.';
      canvasEl.appendChild(dropLine(0));
      canvasEl.appendChild(empty);
      return;
    }
    state.blocks.forEach(function (block, i) {
      canvasEl.appendChild(dropLine(i));
      canvasEl.appendChild(blockEl(block, i));
    });
    canvasEl.appendChild(dropLine(state.blocks.length));
  }

  function dropLine(index) {
    var line = document.createElement('div');
    line.className = 'block-drop-line';
    line.addEventListener('dragover', function (e) { e.preventDefault(); line.classList.add('over'); });
    line.addEventListener('dragleave', function () { line.classList.remove('over'); });
    line.addEventListener('drop', function (e) {
      e.preventDefault();
      line.classList.remove('over');
      var newType = e.dataTransfer.getData('text/new-widget');
      var fromIndex = e.dataTransfer.getData('text/reorder-index');
      if (newType && WIDGETS[newType]) {
        var block = Object.assign({ id: uid(), type: newType }, WIDGETS[newType].defaultData());
        state.blocks.splice(index, 0, block);
        selectedId = block.id;
        renderCanvas();
        renderProps();
      } else if (fromIndex !== '') {
        var from = parseInt(fromIndex, 10);
        var moved = state.blocks.splice(from, 1)[0];
        var to = index > from ? index - 1 : index;
        state.blocks.splice(to, 0, moved);
        renderCanvas();
      }
    });
    return line;
  }

  function blockEl(block, index) {
    var wrap = document.createElement('div');
    wrap.className = 'block' + (block.id === selectedId ? ' selected' : '');
    wrap.draggable = true;
    wrap.innerHTML = '<span class="block-label">' + WIDGETS[block.type].label + '</span>' + WIDGETS[block.type].render(block);
    wrap.addEventListener('click', function (e) { e.stopPropagation(); selectedId = block.id; renderCanvas(); renderProps(); });
    wrap.addEventListener('dragstart', function (e) { e.dataTransfer.setData('text/reorder-index', String(index)); });
    return wrap;
  }

  // --- Property panel ----------------------------------------------------
  var propsEl = document.getElementById('propsPanel');

  function renderProps() {
    var block = state.blocks.find(function (b) { return b.id === selectedId; });
    if (!block) {
      propsEl.innerHTML = '<h2>Properties</h2><div class="no-selection">Select a block on the canvas to edit it.</div>';
      return;
    }
    var html = '<h2>' + WIDGETS[block.type].label + '</h2>';
    if (block.type === 'heading') {
      html += '<label>Text</label><input type="text" data-f="text" value="' + esc(block.text) + '">';
    } else if (block.type === 'paragraph') {
      html += '<label>HTML</label><textarea data-f="html">' + esc(block.html) + '</textarea>';
    } else if (block.type === 'image') {
      html += '<label>Image</label><div class="dropzone" id="imgDrop">Drag a file here, or click to upload</div><input type="file" id="imgFile" style="display:none">' +
        (block.url ? '<div class="thumbs"><img src="' + esc(block.url) + '"></div>' : '') +
        '<label>Caption</label><input type="text" data-f="caption" value="' + esc(block.caption || '') + '">';
    } else if (block.type === 'gallery') {
      html += '<label>Images</label><div class="dropzone" id="galDrop">Drag files here, or click to upload</div><input type="file" id="galFile" multiple style="display:none">' +
        '<div class="thumbs" id="galThumbs">' + (block.images || []).map(function (u, i) { return '<img src="' + esc(u) + '" data-i="' + i + '">'; }).join('') + '</div>';
    } else if (block.type === 'button') {
      html += '<label>Label</label><input type="text" data-f="label" value="' + esc(block.label) + '">' +
        '<label>Link (href)</label><input type="text" data-f="href" value="' + esc(block.href) + '">';
    } else if (block.type === 'spacer') {
      html += '<label>Height (px)</label><input type="number" data-f="height" value="' + (block.height || 40) + '">';
    } else if (block.type === 'role') {
      html += '<label>Title</label><input type="text" data-f="title" value="' + esc(block.title) + '">' +
        '<label>Meta line</label><input type="text" data-f="meta" value="' + esc(block.meta) + '">' +
        '<label>List items</label><div id="roleItems">' +
        (block.items || []).map(function (it, i) { return '<div class="item-row"><textarea data-item="' + i + '">' + esc(it) + '</textarea><button type="button" data-del="' + i + '">×</button></div>'; }).join('') +
        '</div><button type="button" class="btn" id="addItemBtn" style="margin-top:.4rem">+ Add item</button>';
    }
    html += '<button type="button" class="btn danger" id="deleteBlockBtn" style="margin-top:1.5rem;width:100%">Delete block</button>';
    propsEl.innerHTML = html;

    propsEl.querySelectorAll('[data-f]').forEach(function (input) {
      input.addEventListener('input', function () {
        block[input.getAttribute('data-f')] = input.type === 'number' ? Number(input.value) : input.value;
        renderCanvas();
      });
    });
    if (block.type === 'image') {
      wireImageDrop(document.getElementById('imgDrop'), document.getElementById('imgFile'), function (url) { block.url = url; renderCanvas(); renderProps(); });
    }
    if (block.type === 'gallery') {
      wireImageDrop(document.getElementById('galDrop'), document.getElementById('galFile'), function (url) {
        block.images = (block.images || []).concat([url]);
        renderCanvas(); renderProps();
      }, true);
      propsEl.querySelectorAll('#galThumbs img').forEach(function (img) {
        img.style.cursor = 'pointer';
        img.title = 'Click to remove';
        img.addEventListener('click', function () {
          block.images.splice(Number(img.getAttribute('data-i')), 1);
          renderCanvas(); renderProps();
        });
      });
    }
    if (block.type === 'role') {
      propsEl.querySelectorAll('[data-item]').forEach(function (ta) {
        ta.addEventListener('input', function () { block.items[Number(ta.getAttribute('data-item'))] = ta.value; renderCanvas(); });
      });
      propsEl.querySelectorAll('[data-del]').forEach(function (btn) {
        btn.addEventListener('click', function () { block.items.splice(Number(btn.getAttribute('data-del')), 1); renderCanvas(); renderProps(); });
      });
      document.getElementById('addItemBtn').addEventListener('click', function () { block.items.push('New point.'); renderCanvas(); renderProps(); });
    }
    document.getElementById('deleteBlockBtn').addEventListener('click', function () {
      state.blocks = state.blocks.filter(function (b) { return b.id !== block.id; });
      selectedId = null;
      renderCanvas(); renderProps();
    });
  }

  function wireImageDrop(el, input, onUrl, multiple) {
    el.addEventListener('click', function () { input.click(); });
    input.addEventListener('change', function () {
      Array.prototype.slice.call(input.files).forEach(function (f) { uploadFile(f, onUrl); });
      input.value = '';
    });
    el.addEventListener('dragover', function (e) { e.preventDefault(); el.classList.add('drag'); });
    el.addEventListener('dragleave', function () { el.classList.remove('drag'); });
    el.addEventListener('drop', function (e) {
      e.preventDefault();
      el.classList.remove('drag');
      var files = multiple ? e.dataTransfer.files : [e.dataTransfer.files[0]];
      Array.prototype.slice.call(files).forEach(function (f) { if (f) uploadFile(f, onUrl); });
    });
  }

  document.getElementById('canvas').parentElement.addEventListener('click', function () { selectedId = null; renderCanvas(); renderProps(); });

  // --- Site settings modal ------------------------------------------------
  var settingsPanel = document.getElementById('settingsPanel');
  document.getElementById('settingsBtn').addEventListener('click', function () {
    document.getElementById('stTitle').value = state.title;
    document.getElementById('stSubtitle').value = state.subtitle;
    document.getElementById('stLoadingMs').value = state.loading_ms;
    document.getElementById('stMessages').value = (state.loading_messages || []).join('\\n');
    document.getElementById('stSpinnerSpeed').value = state.spinner_speed_ms;
    renderSpinnerThumb();
    settingsPanel.classList.add('open');
  });
  document.getElementById('settingsCloseBtn').addEventListener('click', function () {
    state.title = document.getElementById('stTitle').value;
    state.subtitle = document.getElementById('stSubtitle').value;
    state.loading_ms = Number(document.getElementById('stLoadingMs').value) || 0;
    state.loading_messages = document.getElementById('stMessages').value.split('\\n').map(function (s) { return s.trim(); }).filter(Boolean);
    state.spinner_speed_ms = Number(document.getElementById('stSpinnerSpeed').value) || 2000;
    settingsPanel.classList.remove('open');
  });
  function renderSpinnerThumb() {
    var el = document.getElementById('spinnerThumb');
    el.innerHTML = state.spinner_image_url ? '<img src="' + esc(state.spinner_image_url) + '">' : '';
  }
  wireImageDrop(document.getElementById('spinnerDrop'), document.getElementById('spinnerFile'), function (url) { state.spinner_image_url = url; renderSpinnerThumb(); });

  // --- Load / Save ---------------------------------------------------------
  apiFetch('/api/ugobongo-admin/config').then(function (r) {
    if (!r.ok) return;
    state.title = r.data.title || '';
    state.subtitle = r.data.subtitle || '';
    state.loading_ms = r.data.loading_ms;
    state.loading_messages = r.data.loading_messages || [];
    state.spinner_image_url = r.data.spinner_image_url || null;
    state.spinner_speed_ms = r.data.spinner_speed_ms || 2000;
    state.images = r.data.images || [];
    state.bio_html = r.data.bio_html || '';
    state.blocks = r.data.blocks || [];
    renderCanvas();
    renderProps();
  });

  document.getElementById('saveBtn').addEventListener('click', function () {
    var btn = this;
    var status = document.getElementById('status');
    btn.disabled = true;
    status.textContent = 'Saving…';
    apiFetch('/api/ugobongo-admin/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: state.title,
        subtitle: state.subtitle,
        bio_html: state.bio_html,
        images: state.images,
        loading_ms: state.loading_ms,
        loading_messages: state.loading_messages,
        spinner_image_url: state.spinner_image_url,
        spinner_speed_ms: state.spinner_speed_ms,
        blocks: state.blocks,
      }),
    }).then(function (r) {
      btn.disabled = false;
      status.textContent = r.ok ? 'Saved & live.' : (r.data.error || 'Failed to save.');
    });
  });
})();
</script>
</body>
</html>`;

  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'x-robots-tag': 'noindex, nofollow' },
  });
}
