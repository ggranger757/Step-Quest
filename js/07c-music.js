/* Stepquest — music while you walk: a docked Spotify / Apple Music player that stays put across tabs.
   Uses each service's official embed player. Full tracks play when the listener is signed in to that
   service in this browser (Spotify) or in the player (Apple Music); otherwise the services play previews. */
(() => {
  const $ = WB.$, S = () => WB.state;
  const M = (WB.Music = {});
  const PROVIDERS = {
    spotify: { name: 'Spotify', height: 152, example: 'https://open.spotify.com/playlist/…', app: 'https://open.spotify.com/' },
    apple: { name: 'Apple Music', height: 175, example: 'https://music.apple.com/us/playlist/…', app: 'https://music.apple.com/' },
  };
  M.PROVIDERS = PROVIDERS;

  // turn a share link into an embed URL. Returns null for anything we don't recognize.
  M.parse = (raw) => {
    const url = String(raw || '').trim();
    let m = url.match(/^https?:\/\/open\.spotify\.com\/(?:intl-[a-z]{2}(?:-[a-z]{2})?\/)?(track|album|playlist|artist|episode|show)\/([A-Za-z0-9]{10,})/i) || url.match(/^spotify:(track|album|playlist|artist|episode|show):([A-Za-z0-9]{10,})/i);
    if (m) return { provider: 'spotify', kind: m[1].toLowerCase(), embed: `https://open.spotify.com/embed/${m[1].toLowerCase()}/${m[2]}?utm_source=generator&theme=0` };
    m = url.match(/^https?:\/\/(?:embed\.)?music\.apple\.com\/([a-z]{2})\/(album|playlist|song|station|artist|music-video)\/([^?#\s]+)(\?[^#\s]*)?/i);
    if (m) return { provider: 'apple', kind: m[2].toLowerCase(), embed: `https://embed.music.apple.com/${m[1]}/${m[2]}/${m[3]}${m[4] || ''}` };
    return null;
  };
  const blocked = () => WB.BUILD === 'artifact'; // the claude.ai preview can't embed other sites

  M.render = () => {
    const el = $('#music'), mu = S().music, p = mu.url && M.parse(mu.url);
    if (!p) { el.hidden = true; el.innerHTML = ''; el._embed = null; return; }
    el.hidden = false;
    const prov = PROVIDERS[p.provider], open = mu.open !== false;
    const bar = `<div class="mu-bar">
      <span class="mu-ic">${WB.icon('note', 2)}</span>
      <span class="mu-t"><span class="lbl">${prov.name}</span><span class="mu-k">${p.kind.charAt(0).toUpperCase() + p.kind.slice(1)}</span></span>
      <button class="linkbtn" type="button" data-mu="toggle" aria-expanded="${open}">${open ? 'Hide player' : 'Show player'}</button>
      <button class="linkbtn" type="button" data-mu="edit" aria-label="Change music">Change</button>
      <button class="mu-x" type="button" data-mu="stop" aria-label="Stop and remove the music player">×</button>
    </div>`;
    if (el._embed === p.embed) { // keep the iframe (and the music) alive; only update the bar
      el.querySelector('.mu-bar').outerHTML = bar;
      el.querySelector('.mu-frame').classList.toggle('closed', !open);
    } else {
      el._embed = p.embed;
      const frame = blocked()
        ? `<p class="mu-note">The music player works in the installed Stepquest app. This preview can’t embed other sites.</p>`
        : p.provider === 'spotify'
          ? `<iframe title="Spotify player" src="${p.embed}" height="${prov.height}" allow="autoplay; clipboard-write; encrypted-media *; fullscreen; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin"></iframe>`
          : `<iframe title="Apple Music player" src="${p.embed}" height="${prov.height}" allow="autoplay *; encrypted-media *; fullscreen *; clipboard-write" sandbox="allow-forms allow-popups allow-same-origin allow-scripts allow-storage-access-by-user-activation allow-top-navigation-by-user-activation"></iframe>`;
      // Phone browsers and home-screen apps often can't stream full songs inside an embedded player (no
      // DRM, or not signed in there), so the player can sit on a spinner or play 30-second clips. One tap
      // opens the same playlist in the real app, which keeps playing while Stepquest stays open.
      const app = `<p class="mu-app">Stuck loading or only hearing clips? <a href="${WB.esc(mu.url)}" target="_blank" rel="noopener">Open in ${prov.name}</a>: it keeps playing while you walk here.</p>`;
      el.innerHTML = bar + `<div class="mu-frame ${open ? '' : 'closed'}">${frame}${app}</div>`;
    }
    WB.UI.hydrateIcons(el);
  };

  M.sheet = () => {
    const mu = S().music;
    let prov = mu.provider || 'spotify';
    WB.UI.sheet(`<h3 id="sheet-title">Music</h3>
      <p>Paste a playlist, album or song link and it plays right here while you walk, on every tab.</p>
      <div class="seg" role="tablist" aria-label="Music service">${Object.entries(PROVIDERS).map(([id, p]) => `<button type="button" role="tab" data-prov="${id}" aria-selected="${id === prov}" aria-pressed="${id === prov}">${p.name}</button>`).join('')}</div>
      <div class="field"><label class="lbl" for="mu-url">Link from <span id="mu-pn">${PROVIDERS[prov].name}</span></label><input id="mu-url" type="text" inputmode="url" autocomplete="off" spellcheck="false" placeholder="${PROVIDERS[prov].example}" value="${WB.esc(mu.url || '')}"></div>
      <p class="hint" id="mu-hint">In the ${PROVIDERS[prov].name} app: open a playlist, tap Share, then Copy link.</p>
      <button class="btn block" type="button" id="mu-go">${WB.icon('note', 2)}Play in Stepquest</button>
      <div class="mu-help">
        <p><b>Full songs:</b> the built-in player streams full tracks only when you’re signed in to that service in this browser; otherwise it plays 30-second previews, and some phones can’t stream it at all. If it only loads, tap the <b>Open in Spotify / Apple Music</b> link under the player.</p>
        <p><b>Prefer your music app?</b> Start music in Spotify or Apple Music first, then open Stepquest. It keeps playing, and Stepquest’s sounds mix in without pausing it.</p>
      </div>`, (root) => {
      const setProv = (p) => {
        prov = p;
        WB.$$('[data-prov]', root).forEach((b) => { b.setAttribute('aria-pressed', b.dataset.prov === p); b.setAttribute('aria-selected', b.dataset.prov === p); });
        $('#mu-pn').textContent = PROVIDERS[p].name; $('#mu-url').placeholder = PROVIDERS[p].example;
        const h = $('#mu-hint'); h.classList.remove('err'); h.textContent = 'In the ' + PROVIDERS[p].name + ' app: open a playlist, tap Share, then Copy link.';
      };
      WB.$$('[data-prov]', root).forEach((b) => b.onclick = () => setProv(b.dataset.prov));
      const go = () => {
        const v = $('#mu-url').value, parsed = M.parse(v);
        if (!parsed) { const h = $('#mu-hint'); h.classList.add('err'); h.textContent = 'That doesn’t look like a Spotify or Apple Music link. Copy it from the app’s Share menu.'; return; }
        S().music = { provider: parsed.provider, url: v.trim(), open: true };
        WB.Save.queue(); WB.UI.closeSheet(); M.render(); WB.UI.render();
        WB.UI.toast({ kicker: 'Music', title: PROVIDERS[parsed.provider].name + ' player ready', icon: 'note', cls: 'cyan' });
      };
      $('#mu-go').onclick = go;
      $('#mu-url').addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
      $('#mu-url').addEventListener('input', () => { const p = M.parse($('#mu-url').value); if (p && p.provider !== prov) setProv(p.provider); });
    });
  };

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-mu]'); if (!b) return;
    const mu = S().music;
    if (b.dataset.mu === 'toggle') { mu.open = mu.open === false; WB.Save.queue(); M.render(); }
    if (b.dataset.mu === 'edit') M.sheet();
    if (b.dataset.mu === 'stop') { mu.url = ''; WB.Save.queue(); M.render(); WB.UI.render(); }
  });
})();
