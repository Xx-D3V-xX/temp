(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage may be blocked */ } },
  };

  const panels = $$('.panel');
  const ids = panels.map(p => p.id);
  const nav = JSON.parse($('#nav-data').textContent);

  /* ---------- theme ---------- */
  const root = document.documentElement;
  function applyTheme(t) {
    root.dataset.theme = t;
    const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
    $('#hl-light').disabled = dark; $('#hl-dark').disabled = !dark;
  }
  applyTheme(store.get('theme', 'auto'));
  $('#theme').onclick = () => {
    const dark = root.dataset.theme === 'dark' || (root.dataset.theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
    const t = dark ? 'light' : 'dark'; store.set('theme', t); applyTheme(t);
  };

  /* ---------- wrap tables, add copy buttons ---------- */
  $$('.panel table').forEach(t => {
    const w = document.createElement('div'); w.className = 'table-wrap';
    t.replaceWith(w); w.appendChild(t);
  });
  $$('pre').forEach(pre => {
    const b = document.createElement('button');
    b.className = 'copy'; b.type = 'button'; b.textContent = 'Copy';
    b.onclick = async () => {
      const text = $('code', pre).innerText;
      try { await navigator.clipboard.writeText(text); }
      catch (e) { const r = document.createRange(); r.selectNodeContents($('code', pre)); const s = getSelection(); s.removeAllRanges(); s.addRange(r); document.execCommand('copy'); s.removeAllRanges(); }
      b.textContent = 'Copied'; b.classList.add('ok');
      setTimeout(() => { b.textContent = 'Copy'; b.classList.remove('ok'); }, 1400);
    };
    pre.appendChild(b);
  });

  /* ---------- syntax highlighting (CDN script is deferred, so wait for it) ---------- */
  window.addEventListener('load', () => {
    if (!window.hljs) return;
    hljs.registerAliases(['solidity'], { languageName: 'java' });
    $$('pre code').forEach(c => { try { hljs.highlightElement(c); } catch (e) { /* unknown language */ } });
  });

  /* ---------- progress ---------- */
  let done = store.get('done', {});
  const boxes = $$('input[data-sub]');
  function paintProgress() {
    boxes.forEach(b => {
      b.checked = !!done[b.dataset.sub];
      b.closest('details').classList.toggle('is-done', b.checked);
    });
    panels.forEach(p => {
      const total = +p.dataset.total; if (!total || p.dataset.kind === 'viva') return;
      const n = $$('input[data-sub]', p).filter(b => b.checked).length;
      const pct = Math.round(100 * n / total);
      const bar = $('.progress i', p); if (bar) bar.style.width = pct + '%';
      const lab = $('.progress-label', p); if (lab) lab.textContent = `${n} of ${total} parts done`;
      const link = $(`[data-nav="${p.id}"]`);
      if (link) { $('.pct', link).textContent = n ? (pct === 100 ? '✓' : pct + '%') : ''; link.classList.toggle('complete', pct === 100); }
    });
  }
  boxes.forEach(b => {
    b.addEventListener('click', e => e.stopPropagation());
    b.closest('label').addEventListener('click', e => e.stopPropagation());
    b.addEventListener('change', () => { done[b.dataset.sub] = b.checked; if (!b.checked) delete done[b.dataset.sub]; store.set('done', done); paintProgress(); });
  });
  $('#reset').onclick = () => { if (confirm('Clear all your progress ticks?')) { done = {}; store.set('done', done); paintProgress(); } };
  paintProgress();

  /* ---------- routing ---------- */
  function show(id, jump) {
    if (!ids.includes(id)) id = 'overview';
    panels.forEach(p => p.classList.toggle('show', p.id === id));
    $$('#sidebar a').forEach(a => a.classList.toggle('active', a.dataset.nav === id));
    $('#results').hidden = true;
    document.body.classList.remove('menu-open'); $('#menu').setAttribute('aria-expanded', 'false');
    store.set('last', id);
    const target = jump && document.getElementById(jump);
    if (target) {
      target.open = true; target.classList.add('flash');
      target.scrollIntoView({ block: 'start' });
      setTimeout(() => target.classList.remove('flash'), 1600);
    } else { scrollTo(0, 0); }
    document.title = (nav.find(n => n.id === id) || { short: 'Viva flashcards' }).short + ' · CS413 Lab Exam Guide';
  }
  function route() {
    const h = decodeURIComponent(location.hash.slice(1));
    if (!h) { show(store.get('last', 'overview'), null); return; }
    const jump = h.includes('--') ? h : null;
    show(jump ? h.split('--')[0] : h, jump);
  }
  addEventListener('hashchange', route);
  $$('.chips a').forEach(a => a.addEventListener('click', e => {
    e.preventDefault();
    const sub = document.getElementById(a.dataset.jump); if (!sub) return;
    sub.open = true; sub.scrollIntoView({ block: 'start' });
    sub.classList.add('flash'); setTimeout(() => sub.classList.remove('flash'), 1600);
  }));
  $('#menu').onclick = () => { const o = document.body.classList.toggle('menu-open'); $('#menu').setAttribute('aria-expanded', o); };
  $('#expand').onclick = () => $$('.panel.show details.sub').forEach(d => d.open = true);
  $('#collapse').onclick = () => $$('.panel.show details.sub').forEach(d => d.open = false);

  /* ---------- search ---------- */
  const index = $$('details.sub').map(d => ({
    id: d.id, panel: d.closest('.panel').id,
    lab: (nav.find(n => n.id === d.closest('.panel').id) || {}).short || '',
    title: $('h3', d).textContent, text: $('.sub-body', d).textContent.replace(/\s+/g, ' '),
  }));
  const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  function snippet(text, terms) {
    const low = text.toLowerCase(); let at = -1;
    for (const t of terms) { const i = low.indexOf(t); if (i >= 0 && (at < 0 || i < at)) at = i; }
    const start = Math.max(0, at - 50), piece = text.slice(start, start + 170);
    let out = esc((start ? '…' : '') + piece + '…');
    terms.forEach(t => { out = out.replace(new RegExp(reEsc(esc(t)), 'gi'), m => `<mark>${m}</mark>`); });
    return out;
  }
  let timer;
  $('#q').addEventListener('input', e => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const q = e.target.value.trim().toLowerCase(), box = $('#results');
      if (q.length < 2) { box.hidden = true; if (!document.querySelector('.panel.show')) route(); return; }
      const terms = q.split(/\s+/).filter(Boolean);
      const hits = index.map(r => {
        const hay = (r.title + ' ' + r.text).toLowerCase();
        if (!terms.every(t => hay.includes(t))) return null;
        const score = terms.reduce((s, t) => s + (r.title.toLowerCase().includes(t) ? 5 : 0) + Math.min(hay.split(t).length - 1, 5), 0);
        return { r, score };
      }).filter(Boolean).sort((a, b) => b.score - a.score).slice(0, 25);
      box.innerHTML = `<h2>${hits.length ? hits.length + ' result' + (hits.length > 1 ? 's' : '') : 'No results'} for “${esc(q)}”</h2>` +
        hits.map(({ r }) => `<a href="#${r.id}"><small>${esc(r.lab)}</small> ${esc(r.title)}<p>${snippet(r.text, terms)}</p></a>`).join('');
      box.hidden = false;
      panels.forEach(p => p.classList.remove('show'));
      box.scrollIntoView({ block: 'start' });
    }, 120);
  });
  $('#results').addEventListener('click', e => {
    const a = e.target.closest('a'); if (!a) return;
    e.preventDefault(); $('#q').value = '';
    const id = a.getAttribute('href').slice(1);
    if (location.hash.slice(1) === id) { show(id.split('--')[0], id); } else { location.hash = id; }
  });
  $('#q').addEventListener('keydown', e => { if (e.key === 'Escape') { e.target.value = ''; $('#results').hidden = true; route(); e.target.blur(); } });
  addEventListener('keydown', e => {
    if (e.key === '/' && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); $('#q').focus(); }
  });

  /* ---------- flashcards ---------- */
  const cards = JSON.parse($('#flash-data').textContent);
  const labSel = $('#fc-lab');
  [...new Set(cards.map(c => c.lab))].sort((a, b) => a - b).forEach(n => labSel.add(new Option('Lab ' + n, n)));
  let deck = [], pos = 0, flipped = false;
  function buildDeck(shuffle) {
    const l = +labSel.value; deck = cards.filter(c => !l || c.lab === l);
    if (shuffle) for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
    pos = 0; paintCard();
  }
  function paintCard() {
    flipped = false; const c = deck[pos], el = $('#fc-card');
    el.classList.remove('back');
    $('#fc-side').textContent = c ? `Question · Lab ${c.lab}` : 'No cards';
    $('#fc-text').textContent = c ? c.q : '';
    $('#fc-count').textContent = deck.length ? `${pos + 1} / ${deck.length}` : '';
  }
  function flip() {
    const c = deck[pos]; if (!c) return; flipped = !flipped;
    $('#fc-card').classList.toggle('back', flipped);
    $('#fc-side').textContent = flipped ? `Answer · Lab ${c.lab}` : `Question · Lab ${c.lab}`;
    $('#fc-text').textContent = flipped ? c.a : c.q;
  }
  const step = d => { if (!deck.length) return; pos = (pos + d + deck.length) % deck.length; paintCard(); };
  $('#fc-card').onclick = flip; $('#fc-next').onclick = () => step(1); $('#fc-prev').onclick = () => step(-1);
  $('#fc-shuffle').onclick = () => buildDeck(true); labSel.onchange = () => buildDeck(false);
  addEventListener('keydown', e => {
    if ($('#flashcards').classList.contains('show') && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) {
      if (e.key === ' ') { e.preventDefault(); flip(); }
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft') step(-1);
    }
  });
  buildDeck(false);

  route();
})();
