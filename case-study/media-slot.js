// <media-slot> — drag-and-drop / click-to-upload slot for IMAGE or VIDEO, persisted in IndexedDB by element id.
(function () {
  if (customElements.get('media-slot')) return;
  const open = () => new Promise((res, rej) => { const r = indexedDB.open('novra-media-slots', 1); r.onupgradeneeded = () => r.result.createObjectStore('m'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const store = async (mode, fn) => { const d = await open(); return new Promise((res, rej) => { const t = d.transaction('m', mode); const q = fn(t.objectStore('m')); t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error); }); };
  class MediaSlot extends HTMLElement {
    connectedCallback() {
      if (this._i) return; this._i = 1;
      const quiet = this.hasAttribute('quiet');
      const sh = this.attachShadow({ mode: 'open' });
      sh.innerHTML = '<style>' +
        ':host{display:block;overflow:hidden}' +
        '.wrap{position:absolute;inset:0;cursor:pointer}' +
        '.wrap.filled{cursor:default}' +
        '.media{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:none}' +
        'img.media[data-svg]{object-fit:contain}' +
        ':host([fit="contain"]) .media{object-fit:contain;object-position:center}' +
        '.hint{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;transition:opacity .25s;opacity:' + (quiet ? '0' : '1') + '}' +
        '.wrap.filled .hint{display:none}' +
        '.chip{font:600 11px/1.4 ui-monospace,Menlo,monospace;letter-spacing:.06em;color:#fff;background:rgba(10,10,10,.45);border:1px dashed rgba(255,255,255,.65);border-radius:9999px;padding:10px 18px;backdrop-filter:blur(6px);text-align:center;max-width:80%}' +
        '.wrap:hover .hint{opacity:1}' +
        '.wrap.over{outline:2px dashed #fff;outline-offset:-6px}' +
        '.x{position:absolute;top:10px;right:10px;width:28px;height:28px;border-radius:50%;background:rgba(10,10,10,.6);color:#fff;border:0;font:600 14px/1 sans-serif;cursor:pointer;display:none;z-index:3}' +
        '.wrap.filled:hover .x{display:block}' +
        'input{display:none}' +
        '</style>' +
        '<div class="wrap"><img class="media" alt=""><video class="media" muted loop autoplay playsinline></video><div class="hint"><span class="chip"></span></div><button class="x" title="Remove media">&times;</button><input type="file" accept="image/*,image/svg+xml,.svg,video/*"></div>';
      const w = sh.querySelector('.wrap'), img = sh.querySelector('img'), vid = sh.querySelector('video'),
        chip = sh.querySelector('.chip'), x = sh.querySelector('.x'), inp = sh.querySelector('input');
      chip.textContent = this.getAttribute('placeholder') || 'drop svg / image / video';
      const key = 'ms:' + (this.id || 'anon');
      const kind = f => {
        const t = (f.type || '').toLowerCase(), n = (f.name || '').toLowerCase();
        if (t.startsWith('video') || /\.(mp4|webm|mov|m4v|ogv)$/.test(n)) return 'video';
        if (t.startsWith('image') || /\.(svg|png|jpe?g|gif|webp|avif|bmp)$/.test(n)) return 'image';
        if (/svg/.test(t) || /\.svg$/.test(n)) return 'image';
        return '';
      };
      const show = blob => {
        if (this._url) URL.revokeObjectURL(this._url);
        this._url = URL.createObjectURL(blob);
        const isV = kind(blob) === 'video';
        img.style.display = isV ? 'none' : 'block'; vid.style.display = isV ? 'block' : 'none';
        if (isV) { vid.src = this._url; vid.play().catch(() => {}); }
        else { /^image\/svg/i.test(blob.type || '') ? img.setAttribute('data-svg', '') : img.removeAttribute('data-svg'); img.src = this._url; }
        w.classList.add('filled');
      };
      const clear = () => {
        if (this._url) URL.revokeObjectURL(this._url); this._url = null;
        img.style.display = vid.style.display = 'none'; img.removeAttribute('src'); vid.removeAttribute('src');
        w.classList.remove('filled');
      };
      const save = f => {
        if (!f || !kind(f)) return;
        // some sources hand over SVG with a missing/odd MIME — normalise so it re-renders after reload
        const isSvg = /\.svg$/i.test(f.name || '') || /svg/i.test(f.type || '');
        const blob = isSvg && f.type !== 'image/svg+xml' ? new Blob([f], { type: 'image/svg+xml' }) : f;
        if (blob !== f) { try { Object.defineProperty(blob, 'name', { value: f.name }); } catch (e) {} }
        show(blob); store('readwrite', s => s.put(blob, key)).catch(() => {});
      };
      store('readonly', s => s.get(key)).then(b => { if (b) show(b); }).catch(() => {});
      w.onclick = e => { if (!w.classList.contains('filled') && e.target !== x) inp.click(); };
      inp.onchange = () => { save(inp.files[0]); inp.value = ''; };
      x.onclick = e => { e.stopPropagation(); clear(); store('readwrite', s => s.delete(key)).catch(() => {}); };
      ['dragenter', 'dragover'].forEach(ev => this.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); w.classList.add('over'); }));
      ['dragleave', 'drop'].forEach(ev => this.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); w.classList.remove('over'); }));
      this.addEventListener('drop', e => { const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; save(f); });
    }
    disconnectedCallback() { if (this._url) URL.revokeObjectURL(this._url); }
  }
  customElements.define('media-slot', MediaSlot);
})();
