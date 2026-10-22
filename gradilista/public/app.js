'use strict';
/* ECOTERM Gradilišta – aplikacija u pregledniku (bez builda, čisti JavaScript) */
(() => {
  const app = document.getElementById('app');
  const dialog = document.getElementById('dialog');

  // ---------- Ikone ----------
  const svg = (d, fill) => `<svg viewBox="0 0 24 24" ${fill ? 'fill="currentColor"' : 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"'} aria-hidden="true">${d}</svg>`;
  const I = {
    dots: svg('<circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/>', true),
    plus: svg('<path d="M12 5v14M5 12h14"/>'),
    search: svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
    back: svg('<path d="M19 12H5M12 19l-7-7 7-7"/>'),
    info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>'),
    camera: svg('<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="4"/>'),
    image: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="m21 16-5-5-9 9"/>'),
    send: svg('<path d="M3.4 20.4 21 12 3.4 3.6v6.4l12.6 2-12.6 2z"/>', true),
    close: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
    pin: svg('<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>'),
    phone: svg('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>'),
    user: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
    note: svg('<path d="M6 3h12v18H6zM9 8h6M9 12h6M9 16h4"/>'),
    download: svg('<path d="M12 4v12M6 10l6 6 6-6M5 20h14"/>'),
    device: svg('<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>'),
    lock: svg('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
    left: svg('<path d="m15 18-6-6 6-6"/>'),
    right: svg('<path d="m9 18 6-6-6-6"/>'),
  };

  const STATUS = { priprema: 'U pripremi', u_tijeku: 'U tijeku', zavrseno: 'Završeno' };
  const ROLE = { admin: 'Voditelj', radnik: 'Radnik' };
  const COLORS = ['#2e8b3e', '#1f55b8', '#d9383b', '#d07a12', '#0e8080', '#7a4fc4', '#3f74d6', '#a8562b'];
  const touch = matchMedia('(pointer: coarse)').matches;

  const state = {
    me: null, sites: [], filter: 'aktivna', q: '',
    view: 'home', siteId: null, messages: [], lastId: 0, loaded: false,
    pending: [], sending: false, stick: true, panel: false,
  };

  // ---------- Pomoćne funkcije ----------
  const $ = (sel, el = document) => el.querySelector(sel);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fold = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
  const isAdmin = () => state.me?.role === 'admin';
  const currentSite = () => state.sites.find((s) => s.id === state.siteId);

  function colorFor(name) {
    let h = 0;
    for (const c of String(name)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return COLORS[h % COLORS.length];
  }
  function initials(name) {
    const w = String(name).replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/);
    return ((w[0]?.[0] || '?') + (w[1]?.[0] || '')).toUpperCase();
  }
  const avatar = (name, cls = '') => `<span class="avatar ${cls}" style="background:${colorFor(name)}" aria-hidden="true">${esc(initials(name))}</span>`;

  const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();
  const fmtTime = (t) => new Date(t).toLocaleTimeString('hr-HR', { hour: '2-digit', minute: '2-digit' });
  const fmtDate = (t) => new Date(t).toLocaleDateString('hr-HR', { day: 'numeric', month: 'numeric', year: 'numeric' });
  function fmtDay(t) {
    const d = new Date(t);
    const y = new Date(); y.setDate(y.getDate() - 1);
    if (sameDay(t, Date.now())) return 'Danas';
    if (sameDay(t, y)) return 'Jučer';
    return d.toLocaleDateString('hr-HR', { weekday: 'long', day: 'numeric', month: 'long', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
  }
  function fmtListTime(t) {
    const y = new Date(); y.setDate(y.getDate() - 1);
    if (sameDay(t, Date.now())) return fmtTime(t);
    if (sameDay(t, y)) return 'jučer';
    if (Date.now() - t < 6 * 864e5) return new Date(t).toLocaleDateString('hr-HR', { weekday: 'short' });
    return fmtDate(t);
  }
  function fmtAgo(t) {
    const min = Math.round((Date.now() - t) / 60000);
    if (min < 2) return 'upravo sada';
    if (min < 60) return `prije ${min} min`;
    if (min < 24 * 60) return `prije ${Math.round(min / 60)} h`;
    return fmtDate(t);
  }

  let toastTimer;
  function toast(text) {
    const el = $('#toast');
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
  }

  async function api(path, opts = {}) {
    const o = { credentials: 'same-origin', ...opts };
    if (opts.json !== undefined) {
      o.body = JSON.stringify(opts.json);
      o.headers = { 'Content-Type': 'application/json' };
      o.method = opts.method || 'POST';
      delete o.json;
    }
    let res;
    try {
      res = await fetch('/api' + path, o);
    } catch {
      throw new Error('Nema veze sa serverom. Provjerite internet.');
    }
    const data = (res.headers.get('content-type') || '').includes('json') ? await res.json() : null;
    if (!res.ok) {
      if (res.status === 401 && path !== '/me') { state.me = null; renderLocked(); }
      const err = new Error(data?.error || `Greška ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  // Smanji sliku u pregledniku prije slanja (štedi mobilne podatke i prostor na serveru)
  async function resize(file, max, quality) {
    let bmp;
    try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { return file; }
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close?.();
    return new Promise((r) => canvas.toBlob((b) => r(b || file), 'image/jpeg', quality));
  }

  // ---------- Ekrani za prijavu ----------
  function gate(html) {
    stopPolling();
    app.innerHTML = `<div class="gate"><div class="gate-card">
      <div class="brand"><img src="/logo-mark.svg" alt=""><span><span class="eco">ECO</span><span class="term">TERM</span> <small>Gradilišta</small></span></div>
      ${html}</div></div>`;
  }

  function renderLocked() {
    gate(`<div class="gate-icon">${I.lock}</div>
      <h1>Ovaj uređaj nije prijavljen</h1>
      <p>Zamolite voditelja da vam u aplikaciji otvori QR kod (<b>Ljudi i uređaji → Dodaj osobu</b>) i skenirajte ga kamerom mobitela.</p>
      <p class="hint">Nakon toga aplikacija pamti ovaj uređaj i više se ne trebate prijavljivati.</p>`);
  }

  function renderSetup() {
    gate(`<h1>Prvo postavljanje</h1>
      <p>Vi ste prvi voditelj. Upišite ime i kod za postavljanje – ispisan je u logu servera ili zadan u postavci <code>SETUP_CODE</code>.</p>
      <form id="setupForm">
        <label class="field"><span>Ime i prezime</span><input class="input" name="name" required maxlength="80" autocomplete="name"></label>
        <label class="field"><span>Kod za postavljanje</span><input class="input" name="code" required autocomplete="off"></label>
        <p class="error" hidden></p>
        <button class="btn btn-block">Započni</button>
      </form>`);
    const form = $('#setupForm');
    form.onsubmit = async (e) => {
      e.preventDefault();
      try {
        await api('/setup', { json: Object.fromEntries(new FormData(form)) });
        boot();
      } catch (err) { showError(form, err); }
    };
  }

  async function renderInvite(token) {
    let inv;
    try {
      inv = await api('/invites/' + encodeURIComponent(token));
    } catch (err) {
      return gate(`<div class="gate-icon">${I.lock}</div><h1>QR kod ne vrijedi</h1><p>${esc(err.message)}</p>`);
    }
    if (state.me) {
      return gate(`<h1>Uređaj je već prijavljen</h1>
        <p>Ovaj uređaj je prijavljen kao <b>${esc(state.me.name)}</b>. Pozivnica nije iskorištena – možete je skenirati na drugom uređaju.</p>
        <a class="btn btn-block" href="/">Otvori aplikaciju</a>`);
    }
    gate(`<h1>Dobrodošli!</h1>
      ${inv.existingUser
        ? `<p>Ovaj uređaj bit će prijavljen kao <b>${esc(inv.name)}</b>.</p>`
        : `<p>Pozvani ste u ECOTERM Gradilišta kao <b>${ROLE[inv.role]}</b>. Provjerite ime i prijavite uređaj.</p>`}
      <form id="inviteForm">
        ${inv.existingUser ? '' : '<label class="field"><span>Ime i prezime</span><input class="input" name="name" required maxlength="80" autocomplete="name"></label>'}
        <p class="error" hidden></p>
        <button class="btn btn-block">Prijavi ovaj uređaj</button>
      </form>
      <p class="hint" style="margin:14px 0 0">Uređaj ostaje zapamćen. Savjet: u izborniku preglednika odaberite „Dodaj na početni zaslon“.</p>`);
    const form = $('#inviteForm');
    if (form.elements.name) form.elements.name.value = inv.name;
    form.onsubmit = async (e) => {
      e.preventDefault();
      try {
        await api(`/invites/${encodeURIComponent(token)}/accept`, { json: Object.fromEntries(new FormData(form)) });
        history.replaceState(null, '', '/');
        boot();
      } catch (err) { showError(form, err); }
    };
  }

  function showError(form, err) {
    const p = $('.error', form);
    p.textContent = err.message;
    p.hidden = false;
  }

  // ---------- Glavni raspored ----------
  function renderShell() {
    app.innerHTML = `<div class="shell" id="shell">
      <aside class="side">
        <header class="topbar">
          <div class="brand"><img src="/logo-mark.svg" alt=""><span><span class="eco">ECO</span><span class="term">TERM</span> <small>Gradilišta</small></span></div>
          <button class="icon-btn" id="menuBtn" aria-label="Izbornik" aria-haspopup="true">${I.dots}</button>
        </header>
        <div class="search"><label class="search-box">${I.search}<input id="q" type="search" placeholder="Pretraži gradilišta" autocomplete="off" aria-label="Pretraži gradilišta"></label></div>
        <div class="chips" role="group" aria-label="Prikaži">
          <button class="chip" data-filter="aktivna">Aktivna</button>
          <button class="chip" data-filter="zavrsena">Završena</button>
          <button class="chip" data-filter="sva">Sva</button>
        </div>
        <ul class="site-list" id="list"></ul>
        ${isAdmin() ? `<button class="fab" id="newSite" aria-label="Novo gradilište" title="Novo gradilište">${I.plus}</button>` : ''}
        <div class="menu" id="menu" hidden></div>
      </aside>
      <main class="main" id="main"></main>
    </div>`;

    $('#q').oninput = (e) => { state.q = e.target.value; renderList(); };
    for (const chip of document.querySelectorAll('.chip')) {
      chip.onclick = () => { state.filter = chip.dataset.filter; renderList(); };
    }
    if (isAdmin()) $('#newSite').onclick = () => siteDialog(null);
    $('#menuBtn').onclick = (e) => { e.stopPropagation(); toggleMenu(); };
    $('#main').addEventListener('click', onMainClick);
  }

  function siteMatches(s) {
    if (state.filter === 'aktivna' && s.status === 'zavrseno') return false;
    if (state.filter === 'zavrsena' && s.status !== 'zavrseno') return false;
    if (!state.q) return true;
    const q = fold(state.q);
    return [s.name, s.address, s.clientName].some((v) => fold(v).includes(q));
  }

  function lastLine(s) {
    const l = s.last;
    if (!l) return esc(s.address || 'Nema poruka');
    if (l.kind === 'system') return `<i>${esc(l.body)}</i>`;
    const who = l.mine ? 'Vi: ' : l.user ? `${esc(l.user.split(' ')[0])}: ` : '';
    return l.kind === 'image' ? `${who}📷 ${esc(l.body || 'Fotografija')}` : who + esc(l.body);
  }

  function renderList() {
    const ul = $('#list');
    if (!ul) return;
    for (const chip of document.querySelectorAll('.chip')) chip.setAttribute('aria-pressed', String(chip.dataset.filter === state.filter));
    const sites = state.sites.filter(siteMatches);
    if (!sites.length) {
      ul.innerHTML = `<li class="empty-list">${state.sites.length ? 'Nema gradilišta za ovaj prikaz.'
        : isAdmin() ? 'Još nema gradilišta.<br>Dodajte prvo gumbom <b>+</b> dolje desno.' : 'Još nema gradilišta.'}</li>`;
      return;
    }
    ul.innerHTML = sites.map((s) => `<li>
      <a class="site-item ${s.unread ? 'unread' : ''}" href="#/g/${s.id}" aria-current="${s.id === state.siteId}">
        ${avatar(s.name)}
        <div class="body">
          <div class="row"><span class="grow site-name">${esc(s.name)}</span><span class="site-time">${s.last ? fmtListTime(s.last.at) : ''}</span></div>
          <div class="row"><span class="grow site-last">${lastLine(s)}</span>
            ${s.status !== 'u_tijeku' ? `<span class="tag ${s.status}">${STATUS[s.status]}</span>` : ''}
            ${s.unread ? `<span class="badge" aria-label="${s.unread} novih">${s.unread > 99 ? '99+' : s.unread}</span>` : ''}</div>
        </div>
      </a></li>`).join('');
  }

  async function refreshSites() {
    state.sites = await api('/sites');
    renderList();
    if (state.view === 'chat') {
      renderChatHeader();
      if (state.panel) renderPanel();
    }
  }

  // ---------- Izbornik ----------
  let installPrompt = null;
  addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installPrompt = e; });

  function toggleMenu(force) {
    const menu = $('#menu');
    const open = force ?? menu.hidden;
    menu.hidden = !open;
    if (!open) return;
    menu.innerHTML = `
      <div class="who"><b>${esc(state.me.name)}</b>${ROLE[state.me.role]}</div>
      ${isAdmin() ? '<button data-act="people">Ljudi i uređaji</button><button data-act="new">Novo gradilište</button>' : ''}
      ${installPrompt ? '<button data-act="install">Instaliraj na početni zaslon</button>' : ''}
      <button data-act="logout">Odjavi ovaj uređaj</button>`;
    menu.onclick = async (e) => {
      const act = e.target.closest('button')?.dataset.act;
      toggleMenu(false);
      if (act === 'people') location.hash = '#/ljudi';
      if (act === 'new') siteDialog(null);
      if (act === 'install') { installPrompt.prompt(); installPrompt = null; }
      if (act === 'logout' && confirm('Odjaviti ovaj uređaj? Za ponovnu prijavu trebat će novi QR kod od voditelja.')) {
        await api('/logout', { json: {} });
        location.href = '/';
      }
    };
  }
  document.addEventListener('click', (e) => {
    const menu = $('#menu');
    if (menu && !menu.hidden && !menu.contains(e.target)) toggleMenu(false);
  });

  // ---------- Usmjeravanje (#/g/12, #/ljudi) ----------
  async function route() {
    if (!state.me) return;
    const m = location.hash.match(/^#\/g\/(\d+)/);
    if (m) return openSite(Number(m[1]));
    if (location.hash === '#/ljudi' && isAdmin()) return openPeople();
    showHome();
  }
  addEventListener('hashchange', route);

  function setMain(inMain) {
    $('#shell').classList.toggle('in-main', inMain);
    renderList();
  }

  function showHome() {
    state.view = 'home';
    state.siteId = null;
    setMain(false);
    $('#main').innerHTML = `<div class="empty-chat">
      <div class="brand"><img src="/logo-mark.svg" alt=""><span><span class="eco">ECO</span><span class="term">TERM</span></span></div>
      <p><b>Gradilišta</b> – fotografije, komentari i status radova na jednom mjestu.</p>
      <p class="hint">Odaberite gradilište s popisa${isAdmin() ? ' ili dodajte novo gumbom +' : ''}.</p>
    </div>`;
  }

  // ---------- Razgovor gradilišta ----------
  async function openSite(id) {
    if (!state.sites.some((s) => s.id === id)) await refreshSites();
    if (!state.sites.some((s) => s.id === id)) { toast('Gradilište ne postoji.'); location.hash = '#/'; return; }
    if (state.view === 'chat' && state.siteId === id) return;
    for (const p of state.pending) URL.revokeObjectURL(p.url);
    Object.assign(state, { view: 'chat', siteId: id, messages: [], lastId: 0, loaded: false, pending: [], stick: true, panel: false });
    setMain(true);
    renderChat();
    try {
      const msgs = await api(`/sites/${id}/messages`);
      if (state.siteId !== id) return;
      state.loaded = true;
      addMessages(msgs);
    } catch (err) { toast(err.message); }
  }

  function renderChatHeader() {
    const s = currentSite();
    const head = $('#chatHead');
    if (!s || !head) return;
    head.innerHTML = `
      <a class="icon-btn back" href="#/" aria-label="Natrag na popis">${I.back}</a>
      ${avatar(s.name, 'sm')}
      <button class="title" data-act="panel"><b>${esc(s.name)}</b><small>${STATUS[s.status]}${s.address ? ' · ' + esc(s.address) : ''}</small></button>
      <button class="icon-btn" data-act="panel" aria-label="Podaci o gradilištu">${I.info}</button>`;
  }

  function renderChat() {
    $('#main').innerHTML = `
      <header class="topbar chat-top" id="chatHead"></header>
      <div class="msgs" id="msgs" aria-live="polite"></div>
      <div class="pending" id="pending" hidden></div>
      <div class="sending" id="sending" hidden></div>
      <form class="composer" id="composer">
        <button type="button" class="icon-btn" data-act="gallery" aria-label="Dodaj fotografije iz galerije" title="Galerija">${I.image}</button>
        <button type="button" class="icon-btn" data-act="camera" aria-label="Fotografiraj" title="Kamera">${I.camera}</button>
        <textarea id="text" rows="1" placeholder="Komentar ili opis radova" aria-label="Poruka" maxlength="4000"></textarea>
        <button class="icon-btn send" id="sendBtn" aria-label="Pošalji">${I.send}</button>
        <input type="file" id="pickGallery" accept="image/*" multiple hidden>
        <input type="file" id="pickCamera" accept="image/*" capture="environment" hidden>
      </form>
      <div id="panelHost"></div>`;
    renderChatHeader();

    const msgs = $('#msgs');
    msgs.addEventListener('scroll', () => { state.stick = msgs.scrollHeight - msgs.scrollTop - msgs.clientHeight < 80; });
    // Kad se slika učita, sadržaj naraste – ostani na dnu ako je korisnik bio na dnu
    msgs.addEventListener('load', () => { if (state.stick) msgs.scrollTop = msgs.scrollHeight; }, true);

    const ta = $('#text');
    ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; });
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !touch) { e.preventDefault(); send(); }
    });
    $('#composer').onsubmit = (e) => { e.preventDefault(); send(); };
    for (const id of ['pickGallery', 'pickCamera']) {
      $('#' + id).onchange = (e) => {
        for (const file of e.target.files) state.pending.push({ file, url: URL.createObjectURL(file) });
        e.target.value = '';
        renderPending();
        ta.focus();
      };
    }
  }

  function msgHtml(m, prev) {
    let html = '';
    if (!prev || !sameDay(prev.createdAt, m.createdAt)) html += `<div class="day"><span>${fmtDay(m.createdAt)}</span></div>`;
    if (m.kind === 'system') return html + `<div class="sys-wrap"><span class="sys">${esc(m.body)}</span></div>`;
    const me = m.userId === state.me.id;
    const cont = prev && prev.kind !== 'system' && prev.userId === m.userId
      && sameDay(prev.createdAt, m.createdAt) && m.createdAt - prev.createdAt < 5 * 60000;
    return html + `<div class="msg ${me ? 'me' : ''} ${cont ? 'cont' : ''}">
      <div class="bubble ${m.image ? 'has-photo' : ''}">
        ${!me && !cont ? `<div class="who-name" style="color:${colorFor(m.user)}">${esc(m.user)}</div>` : ''}
        ${m.image ? `<button class="photo" data-img="${m.id}" aria-label="Otvori fotografiju"><img src="${esc(m.thumb)}" alt="" loading="lazy"></button>` : ''}
        ${m.body ? `<span class="text">${esc(m.body)}</span>` : ''}
        <span class="time">${fmtTime(m.createdAt)}</span>
      </div></div>`;
  }

  function addMessages(list) {
    const fresh = list.filter((m) => m.id > state.lastId);
    const msgs = $('#msgs');
    if (msgs && !state.messages.length && !fresh.length && state.loaded) {
      msgs.innerHTML = '<div class="day"><span>Još nema poruka – pošaljite prvu fotografiju ili komentar.</span></div>';
    }
    if (!fresh.length) return;
    if (msgs && !state.messages.length) msgs.innerHTML = '';
    let html = '';
    for (const m of fresh) {
      html += msgHtml(m, state.messages[state.messages.length - 1]);
      state.messages.push(m);
    }
    state.lastId = state.messages[state.messages.length - 1].id;
    if (msgs) {
      msgs.insertAdjacentHTML('beforeend', html);
      if (state.stick || fresh.some((m) => m.userId === state.me.id)) msgs.scrollTop = msgs.scrollHeight;
    }
    if (state.panel) renderPanel();
    markRead();
  }

  let readTimer;
  function markRead() {
    clearTimeout(readTimer);
    readTimer = setTimeout(async () => {
      const s = currentSite();
      if (!s || document.hidden) return;
      await api(`/sites/${s.id}/read`, { json: { lastId: state.lastId } }).catch(() => {});
      s.unread = 0;
      renderList();
    }, 400);
  }

  function renderPending() {
    const box = $('#pending');
    box.hidden = !state.pending.length;
    box.innerHTML = state.pending.map((p, i) => `<figure><img src="${p.url}" alt=""><button type="button" data-rm="${i}" aria-label="Ukloni">×</button></figure>`).join('');
    box.onclick = (e) => {
      const i = e.target.dataset.rm;
      if (i === undefined) return;
      URL.revokeObjectURL(state.pending[i].url);
      state.pending.splice(i, 1);
      renderPending();
    };
  }

  function setSending(text) {
    const el = $('#sending');
    if (!el) return;
    el.hidden = !text;
    el.textContent = text || '';
    $('#sendBtn').disabled = !!text;
  }

  async function send() {
    const ta = $('#text');
    const siteId = state.siteId;
    let text = ta.value.trim();
    if (state.sending || (!text && !state.pending.length)) return;
    state.sending = true;
    try {
      if (!state.pending.length) {
        setSending('Šaljem…');
        addMessages([await api(`/sites/${siteId}/messages`, { json: { body: text } })]);
        ta.value = '';
      }
      const total = state.pending.length;
      for (let i = 1; state.pending.length && state.siteId === siteId; i++) {
        setSending(`Šaljem fotografiju ${i}/${total}…`);
        const p = state.pending[0];
        const [full, thumb] = await Promise.all([resize(p.file, 1600, 0.82), resize(p.file, 480, 0.7)]);
        const fd = new FormData();
        fd.append('image', full, 'foto.jpg');
        fd.append('thumb', thumb, 'mala.jpg');
        if (text) fd.append('body', text); // opis ide uz prvu fotografiju
        const m = await api(`/sites/${siteId}/messages`, { method: 'POST', body: fd });
        if (state.siteId === siteId) addMessages([m]);
        URL.revokeObjectURL(p.url);
        state.pending.shift();
        if (text) { text = ''; ta.value = ''; }
        renderPending();
      }
      ta.style.height = 'auto';
      refreshSites().catch(() => {});
    } catch (err) {
      toast(err.message);
    } finally {
      state.sending = false;
      setSending('');
    }
  }

  // ---------- Podaci o gradilištu ----------
  function photos() { return state.messages.filter((m) => m.image); }

  function renderPanel() {
    const s = currentSite();
    const host = $('#panelHost');
    if (!s || !host) return;
    if (!state.panel) { host.innerHTML = ''; return; }
    const list = photos();
    const scroll = $('.panel-body', host)?.scrollTop || 0;
    host.innerHTML = `<section class="panel" aria-label="Podaci o gradilištu">
      <header class="topbar">
        <button class="icon-btn" data-act="closePanel" aria-label="Zatvori">${I.close}</button>
        <div style="flex:1;font-weight:600">Podaci o gradilištu</div>
        ${isAdmin() ? '<button class="btn btn-sm" data-act="edit">Uredi</button>' : ''}
      </header>
      <div class="panel-body">
        <div class="card site-head">${avatar(s.name)}<h2>${esc(s.name)}</h2><span class="tag ${s.status}">${STATUS[s.status]}</span></div>
        ${isAdmin() ? `<div class="card"><h3>Status</h3><div class="status-pick">${Object.entries(STATUS).map(([k, v]) =>
          `<button class="btn btn-sm ${k === s.status ? '' : 'btn-ghost'}" data-status="${k}" aria-pressed="${k === s.status}">${v}</button>`).join('')}</div></div>` : ''}
        <div class="card"><h3>Podaci</h3>
          ${s.address ? `<div class="kv">${I.pin}<div><a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.address)}" target="_blank" rel="noopener">${esc(s.address)}</a><small>Otvori u kartama</small></div></div>` : ''}
          ${s.clientName ? `<div class="kv">${I.user}<div>${esc(s.clientName)}<small>Investitor</small></div></div>` : ''}
          ${s.clientPhone ? `<div class="kv">${I.phone}<div><a href="tel:${esc(s.clientPhone.replace(/[^\d+]/g, ''))}">${esc(s.clientPhone)}</a><small>Nazovi</small></div></div>` : ''}
          ${s.note ? `<div class="kv">${I.note}<div class="text">${esc(s.note)}</div></div>` : ''}
          ${!s.address && !s.clientName && !s.clientPhone && !s.note ? `<p class="hint" style="margin:0">Nema upisanih podataka.${isAdmin() ? ' Kliknite „Uredi“.' : ''}</p>` : ''}
        </div>
        <div class="card"><h3>Fotografije (${list.length})</h3>
          ${list.length ? `<div class="gallery">${list.slice().reverse().map((m) =>
            `<button data-img="${m.id}" aria-label="Otvori fotografiju"><img src="${esc(m.thumb)}" alt="" loading="lazy"></button>`).join('')}</div>`
            : '<p class="hint" style="margin:0">Još nema fotografija.</p>'}
        </div>
      </div></section>`;
    $('.panel-body', host).scrollTop = scroll;
  }

  async function setStatus(status) {
    const s = currentSite();
    try {
      await api(`/sites/${s.id}`, { method: 'PATCH', json: { status } });
      await refreshSites();
      poll();
    } catch (err) { toast(err.message); }
  }

  function onMainClick(e) {
    const el = e.target.closest('[data-act],[data-img],[data-status]');
    if (!el) return;
    if (el.dataset.img) return openViewer(Number(el.dataset.img));
    if (el.dataset.status) return setStatus(el.dataset.status);
    const act = el.dataset.act;
    if (act === 'panel') { state.panel = true; renderPanel(); }
    if (act === 'closePanel') { state.panel = false; renderPanel(); }
    if (act === 'edit') siteDialog(currentSite());
    if (act === 'gallery') $('#pickGallery').click();
    if (act === 'camera') $('#pickCamera').click();
  }

  // ---------- Novo gradilište / uređivanje ----------
  function siteDialog(site) {
    dialog.innerHTML = `<form class="dlg" id="siteForm">
      <h2>${site ? 'Uredi gradilište' : 'Novo gradilište'}</h2>
      <label class="field"><span>Naziv *</span><input class="input" name="name" required maxlength="120" placeholder="npr. Kuća Horvat – Samobor"></label>
      <label class="field"><span>Adresa</span><input class="input" name="address" maxlength="200" placeholder="Ulica i broj, mjesto"></label>
      <label class="field"><span>Investitor</span><input class="input" name="clientName" maxlength="120"></label>
      <label class="field"><span>Telefon investitora</span><input class="input" name="clientPhone" type="tel" maxlength="40"></label>
      <label class="field"><span>Bilješka</span><textarea class="input" name="note" maxlength="4000" placeholder="npr. dizalica topline 9 kW, podno grijanje, ključ kod susjeda"></textarea></label>
      <div class="field"><span>Status</span><div class="seg">${Object.entries(STATUS).map(([k, v]) =>
        `<label><input type="radio" name="status" value="${k}"><span>${v}</span></label>`).join('')}</div></div>
      <p class="error" hidden></p>
      <div class="dlg-actions"><button type="button" class="btn btn-ghost" data-cancel>Odustani</button><button class="btn">Spremi</button></div>
    </form>`;
    const form = $('#siteForm');
    const s = site || { status: 'u_tijeku' };
    for (const k of ['name', 'address', 'clientName', 'clientPhone', 'note']) form.elements[k].value = s[k] || '';
    form.elements.status.value = s.status;
    $('[data-cancel]', form).onclick = () => dialog.close();
    form.onsubmit = async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form));
      try {
        if (site) {
          await api(`/sites/${site.id}`, { method: 'PATCH', json: data });
          dialog.close();
          await refreshSites();
          poll();
        } else {
          const { id } = await api('/sites', { json: data });
          dialog.close();
          await refreshSites();
          location.hash = `#/g/${id}`;
        }
      } catch (err) { showError(form, err); }
    };
    dialog.showModal();
  }

  // ---------- Ljudi i uređaji (voditelj) ----------
  async function openPeople() {
    state.view = 'people';
    state.siteId = null;
    setMain(true);
    $('#main').innerHTML = `
      <header class="topbar"><a class="icon-btn back" href="#/" aria-label="Natrag">${I.back}</a>
        <div style="flex:1;font-weight:600">Ljudi i uređaji</div>
        <button class="btn btn-sm" id="addPerson">${I.plus.replace('<svg', '<svg width="16" height="16"')} Dodaj osobu</button></header>
      <div class="people"><div class="people-inner" id="people"><p class="hint">Učitavam…</p></div></div>`;
    $('#addPerson').onclick = () => inviteDialog(null);
    $('#people').onclick = onPeopleClick;
    await renderPeople();
  }

  async function renderPeople() {
    const box = $('#people');
    if (!box) return;
    const people = await api('/people');
    box.innerHTML = `<p class="hint">Osobu dodajete QR kodom: kliknite <b>Dodaj osobu</b>, a radnik skenira kod kamerom svog mobitela. Taj uređaj ostaje prijavljen dok ga ne uklonite.</p>`
      + people.map((p) => `<div class="person ${p.active ? '' : 'inactive'}">
        <div class="person-head">${avatar(p.name, 'sm')}
          <div class="grow"><b>${esc(p.name)}${p.id === state.me.id ? ' (vi)' : ''}</b><span class="hint">${ROLE[p.role]}${p.active ? '' : ' · deaktiviran'}</span></div>
        </div>
        ${p.active ? `<ul class="devices">${p.devices.map((d) => `<li>${I.device.replace('<svg', '<svg width="20" height="20"')}
            <div class="grow">${esc(d.label)}${d.current ? ' <b>(ovaj uređaj)</b>' : ''}<small>Dodan ${fmtDate(d.createdAt)} · aktivan ${fmtAgo(d.lastSeen)}</small></div>
            ${d.current ? '' : `<button class="btn btn-sm btn-danger" data-rm-device="${d.id}">Ukloni</button>`}</li>`).join('')
            || '<li class="hint">Nema prijavljenih uređaja</li>'}</ul>
          <div class="person-actions">
            <button class="btn btn-sm btn-ghost" data-add-device="${p.id}">+ Uređaj (QR)</button>
            ${p.id !== state.me.id ? `
              <button class="btn btn-sm btn-ghost" data-role="${p.id}" data-to="${p.role === 'admin' ? 'radnik' : 'admin'}">Postavi kao: ${p.role === 'admin' ? 'radnik' : 'voditelj'}</button>
              <button class="btn btn-sm btn-danger" data-active="${p.id}" data-to="0">Deaktiviraj</button>` : ''}
          </div>`
        : `<div class="person-actions"><button class="btn btn-sm btn-ghost" data-active="${p.id}" data-to="1">Ponovo aktiviraj</button></div>`}
      </div>`).join('');
    box.dataset.people = JSON.stringify(people.map((p) => ({ id: p.id, name: p.name })));
  }

  async function onPeopleClick(e) {
    const b = e.target.closest('button');
    if (!b) return;
    const d = b.dataset;
    const name = (id) => JSON.parse($('#people').dataset.people).find((p) => p.id === Number(id))?.name;
    try {
      if (d.rmDevice && confirm('Ukloniti ovaj uređaj? Na njemu se više neće moći otvoriti aplikacija.')) {
        await api(`/devices/${d.rmDevice}`, { method: 'DELETE' });
      } else if (d.addDevice) {
        return inviteDialog({ id: Number(d.addDevice), name: name(d.addDevice) });
      } else if (d.role) {
        await api(`/people/${d.role}`, { method: 'PATCH', json: { role: d.to } });
      } else if (d.active) {
        if (d.to === '0' && !confirm(`Deaktivirati osobu ${name(d.active)}? Svi uređaji te osobe bit će odjavljeni.`)) return;
        await api(`/people/${d.active}`, { method: 'PATCH', json: { active: d.to === '1' } });
      }
      await renderPeople();
    } catch (err) { toast(err.message); }
  }

  function inviteDialog(user) {
    const showQr = async (body) => {
      const inv = await api('/invites', { json: body });
      dialog.innerHTML = `<div class="dlg">
        <h2>${user ? `Novi uređaj: ${esc(user.name)}` : `Pozivnica${body.name ? ': ' + esc(body.name) : ''}`}</h2>
        <div class="qr">${inv.qr}</div>
        <p class="hint" style="text-align:center;margin-top:0">Neka osoba skenira kod kamerom mobitela.<br>Kod vrijedi 48 sati i može se iskoristiti <b>jednom</b>.</p>
        <div class="link-box"><input class="input" readonly value="${esc(inv.url)}" aria-label="Poveznica"><button class="btn btn-sm btn-ghost" data-copy>Kopiraj</button></div>
        <div class="dlg-actions">${navigator.share ? '<button class="btn btn-ghost" data-share>Pošalji…</button>' : ''}<button class="btn" data-done>Gotovo</button></div>
      </div>`;
      $('[data-copy]', dialog).onclick = async () => {
        try { await navigator.clipboard.writeText(inv.url); toast('Poveznica kopirana'); } catch { $('.link-box input', dialog).select(); }
      };
      const share = $('[data-share]', dialog);
      if (share) share.onclick = () => navigator.share({ title: 'ECOTERM Gradilišta', text: 'Prijava u ECOTERM Gradilišta:', url: inv.url }).catch(() => {});
      $('[data-done]', dialog).onclick = () => dialog.close();
      dialog.addEventListener('close', () => renderPeople().catch(() => {}), { once: true });
    };

    if (user) {
      showQr({ userId: user.id }).then(() => dialog.showModal()).catch((err) => toast(err.message));
      return;
    }
    dialog.innerHTML = `<form class="dlg" id="inviteForm">
      <h2>Dodaj osobu</h2>
      <label class="field"><span>Ime i prezime</span><input class="input" name="name" maxlength="80" placeholder="Osoba ga može i sama upisati"></label>
      <div class="field"><span>Uloga</span><div class="seg">
        <label><input type="radio" name="role" value="radnik" checked><span>Radnik</span></label>
        <label><input type="radio" name="role" value="admin"><span>Voditelj</span></label></div>
        <p class="hint" style="margin:6px 0 0">Voditelj može otvarati gradilišta, mijenjati status i dodavati ljude.</p></div>
      <p class="error" hidden></p>
      <div class="dlg-actions"><button type="button" class="btn btn-ghost" data-cancel>Odustani</button><button class="btn">Napravi QR kod</button></div>
    </form>`;
    const form = $('#inviteForm');
    $('[data-cancel]', form).onclick = () => dialog.close();
    form.onsubmit = async (e) => {
      e.preventDefault();
      try { await showQr(Object.fromEntries(new FormData(form))); } catch (err) { showError(form, err); }
    };
    dialog.showModal();
  }

  // ---------- Pregled fotografije ----------
  function openViewer(id) {
    const list = photos();
    let i = list.findIndex((m) => m.id === id);
    if (i < 0) return;
    const el = document.createElement('div');
    el.className = 'viewer';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Fotografija');
    const draw = () => {
      const m = list[i];
      el.innerHTML = `
        <div class="viewer-top">
          <button class="icon-btn" data-v="close" aria-label="Zatvori">${I.back}</button>
          <div class="grow">${esc(m.user)}<small>${fmtDay(m.createdAt)}, ${fmtTime(m.createdAt)} · ${i + 1}/${list.length}</small></div>
          ${i > 0 ? `<button class="icon-btn" data-v="prev" aria-label="Prethodna">${I.left}</button>` : ''}
          ${i < list.length - 1 ? `<button class="icon-btn" data-v="next" aria-label="Sljedeća">${I.right}</button>` : ''}
          <a class="icon-btn" href="${esc(m.image)}" download aria-label="Preuzmi">${I.download}</a>
        </div>
        <div class="viewer-img"><img src="${esc(m.image)}" alt=""></div>
        ${m.body ? `<div class="viewer-cap">${esc(m.body)}</div>` : ''}`;
    };
    const go = (d) => { if (list[i + d]) { i += d; draw(); } };
    const close = () => { el.remove(); removeEventListener('keydown', onKey); };
    const onKey = (e) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'ArrowRight') go(1);
    };
    el.onclick = (e) => {
      const v = e.target.closest('[data-v]')?.dataset.v;
      if (v === 'close') close();
      if (v === 'prev') go(-1);
      if (v === 'next') go(1);
    };
    let x0 = null;
    el.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    el.addEventListener('touchend', (e) => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
      x0 = null;
    });
    addEventListener('keydown', onKey);
    draw();
    document.body.appendChild(el);
  }

  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.panel && !document.querySelector('.viewer') && !dialog.open) {
      state.panel = false;
      renderPanel();
    }
  });

  // ---------- Osvježavanje (svakih nekoliko sekundi) ----------
  let pollTimer = null;
  let ticks = 0;
  async function poll() {
    if (!state.me || document.hidden) return;
    try {
      const id = state.siteId;
      if (state.view === 'chat' && state.loaded) {
        const msgs = await api(`/sites/${id}/messages?after=${state.lastId}`);
        if (id === state.siteId) addMessages(msgs);
      }
      if (ticks++ % 2 === 0) await refreshSites();
    } catch { /* idući put */ }
  }
  function startPolling() {
    stopPolling();
    pollTimer = setInterval(poll, 4000);
  }
  function stopPolling() {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });

  // ---------- Pokretanje ----------
  async function boot() {
    try {
      const me = await api('/me');
      state.me = me.user;
      const invite = location.pathname.match(/^\/pozivnica\/([\w-]+)/);
      if (invite) return renderInvite(invite[1]);
      if (me.setupNeeded) return renderSetup();
      if (!me.user) return renderLocked();
      renderShell();
      await refreshSites();
      await route();
      startPolling();
    } catch (err) {
      gate(`<h1>Greška</h1><p>${esc(err.message)}</p><button class="btn btn-block" onclick="location.reload()">Pokušaj ponovo</button>`);
    }
  }

  boot();
})();
