/* Step Quest — taking a quest photo, the same way on every phone (3.5.2).
   Installed app (iPhone / Android, Capacitor): the native camera (@capacitor/camera), straight to the camera, never
     the photo library. It asks for camera access once; a "no" tells you where to turn it back on.
   Browser / home-screen web app: <input type="file" accept="image/*" capture="environment">, which opens the rear camera
     on iPhone Safari and Android Chrome (Samsung Internet and Firefox may offer a chooser instead).
   Either way the photo is shrunk to a small JPEG thumbnail right here (EXIF rotation applied, HEIC handled where the
   browser can read it) and only the thumbnail is kept, with the time it was taken. Nothing is uploaded anywhere.
   When it was taken: the native camera = now. A picked file = the earlier of its file time and its EXIF "taken" time,
   so an old gallery photo can't pass for a new one (05p-quests.js checks it against the quest). */
(() => {
  const P = (WB.Photo = {});
  const THUMB = 240, QUALITY = 0.78;
  const cap = () => window.Capacitor;
  let camera = null;
  P.native = () => {
    const c = cap();
    if (!c || !(c.isNativePlatform ? c.isNativePlatform() : c.platform && c.platform !== 'web')) return false;
    if (!camera) { try { camera = c.registerPlugin ? c.registerPlugin('Camera') : c.Plugins && c.Plugins.Camera; } catch (e) { camera = null; } }
    return !!(camera && camera.getPhoto && (!c.isPluginAvailable || c.isPluginAvailable('Camera')));
  };
  P.platform = () => { const c = cap(); return c && c.getPlatform ? c.getPlatform() : /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ? 'ios' : /Android/.test(navigator.userAgent) ? 'android' : 'web'; };

  // ---------- shrink any image source to a JPEG thumbnail ----------
  const toThumb = (src, w, h) => {
    const k = Math.min(1, THUMB / Math.max(w, h)), c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
    const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(src, 0, 0, c.width, c.height);
    let data = c.toDataURL('image/jpeg', QUALITY);
    if (!/^data:image\/jpeg/.test(data)) data = c.toDataURL('image/png');   // very old WebViews
    return data;
  };
  const viaImg = (url) => new Promise((ok, no) => {
    const img = new Image(); img.decoding = 'async';
    img.onload = () => { try { ok(toThumb(img, img.naturalWidth, img.naturalHeight)); } catch (e) { no(e); } };
    img.onerror = () => no(new Error('decode'));
    img.src = url;
  });
  // a picked file: createImageBitmap (fast, rotates by EXIF) where it works, else an <img> (Safari, older WebViews)
  async function fileThumb(file) {
    if (window.createImageBitmap) {
      try { const bm = await createImageBitmap(file, { imageOrientation: 'from-image' }); const d = toThumb(bm, bm.width, bm.height); if (bm.close) bm.close(); return d; } catch (e) { /* fall through */ }
    }
    const url = URL.createObjectURL(file);
    try { return await viaImg(url); } finally { URL.revokeObjectURL(url); }
  }

  // ---------- when a JPEG says it was taken (EXIF DateTimeOriginal), as a local time; null if it doesn't say ----------
  P.exifTime = async (file) => {
    try {
      if (!/jpe?g/i.test(file.type || file.name || '')) return null;
      const buf = new DataView(await file.slice(0, 196608).arrayBuffer());
      if (buf.getUint16(0) !== 0xffd8) return null;
      let o = 2;
      while (o + 4 < buf.byteLength) {
        const marker = buf.getUint16(o), len = buf.getUint16(o + 2);
        if (marker === 0xffe1 && buf.getUint32(o + 4) === 0x45786966) {   // "Exif"
          const t = o + 10, le = buf.getUint16(t) === 0x4949, u16 = (p) => buf.getUint16(p, le), u32 = (p) => buf.getUint32(p, le);
          const readStr = (p, n) => { let s = ''; for (let i = 0; i < n - 1 && p + i < buf.byteLength; i++) s += String.fromCharCode(buf.getUint8(p + i)); return s; };
          const scan = (ifd, want) => { const n = u16(t + ifd); for (let i = 0; i < n; i++) { const e = t + ifd + 2 + i * 12, tag = u16(e); if (want[tag]) want[tag](e); } };
          let exifIfd = 0, when = null;
          const date = (e) => { when = readStr(t + u32(e + 8), u32(e + 4)); };
          scan(u32(t + 4), { 0x8769: (e) => { exifIfd = u32(e + 8); }, 0x0132: date });
          if (exifIfd) scan(exifIfd, { 0x9003: date, 0x9004: (e) => { if (!when) date(e); } });
          const m = when && when.match(/^(\d{4}):(\d\d):(\d\d) (\d\d):(\d\d):(\d\d)/);
          return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime() : null;
        }
        if ((marker & 0xff00) !== 0xff00 || marker === 0xffda) break;
        o += 2 + len;
      }
    } catch (e) { /* no EXIF */ }
    return null;
  };

  // ---------- a file from the web camera input ----------
  // → { data, takenAt } or { error: 'type' | 'decode' | 'heic' }
  P.fromFile = async (file) => {
    if (!file) return { error: 'none' };
    const heic = /heic|heif/i.test(file.type || '') || /\.(heic|heif)$/i.test(file.name || '');
    if (file.type && !/^image\//.test(file.type) && !heic) return { error: 'type' };
    let data;
    try { data = await fileThumb(file); } catch (e) { return { error: heic ? 'heic' : 'decode' }; }
    const fileT = file.lastModified || 0, exifT = await P.exifTime(file);
    const takenAt = [fileT, exifT].filter((t) => t > 0).reduce((a, b) => Math.min(a, b), Infinity);
    return { data, takenAt: isFinite(takenAt) ? takenAt : Date.now(), source: 'file' };
  };

  // ---------- the native camera (installed app) ----------
  // → { data, takenAt } or { cancelled } or { denied } or { error }
  P.take = async () => {
    if (!P.native()) return { error: 'unavailable' };
    try {
      if (camera.checkPermissions) {
        let p = await camera.checkPermissions();
        if (p.camera !== 'granted' && p.camera !== 'limited') { if (p.camera === 'denied') return { denied: true }; p = await camera.requestPermissions({ permissions: ['camera'] }); }
        if (p.camera === 'denied') return { denied: true };
      }
      const r = await camera.getPhoto({ source: 'CAMERA', resultType: 'dataUrl', quality: 80, width: 960, height: 960, correctOrientation: true, saveToGallery: false, allowEditing: false, direction: 'REAR', presentationStyle: 'fullscreen' });
      const url = r.dataUrl || (r.webPath ? r.webPath : null) || (r.base64String ? 'data:image/' + (r.format || 'jpeg') + ';base64,' + r.base64String : null);
      if (!url) return { error: 'decode' };
      const data = await viaImg(url);
      return { data, takenAt: Date.now(), source: 'camera' };
    } catch (e) {
      const m = String((e && (e.message || e.errorMessage || e.code)) || e);
      if (/cancel/i.test(m)) return { cancelled: true };
      if (/denied|permission|not authorized|access/i.test(m)) return { denied: true };
      return { error: 'camera', detail: m };
    }
  };

  // what to tell the player when a photo didn't work
  P.why = (r) => {
    const ios = P.platform() === 'ios';
    if (r.denied) return ios ? 'Step Quest can’t use the camera. Turn it on in Settings → Step Quest → Camera.' : 'Step Quest can’t use the camera. Turn it on in Settings → Apps → Step Quest → Permissions → Camera.';
    if (r.error === 'heic') return 'This phone saved the photo as HEIC, which this browser can’t open. Take it again from the quest’s camera button, or set Camera → Formats → Most Compatible.';
    if (r.error === 'type') return 'That isn’t a photo. Use the camera button to take one.';
    if (r.error === 'decode') return 'That photo couldn’t be read. Try taking it again.';
    if (r.error === 'camera') return 'The camera didn’t open. Close other camera apps and try again.';
    return 'The photo didn’t come through. Try again.';
  };
})();
