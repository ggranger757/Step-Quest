/* Step Quest — taking a quest photo (3.5.2).
   Installed app (iPhone / Android, Capacitor): the native camera (@capacitor/camera), straight to the camera, never
     the photo library. It asks for camera access once; a "no" tells you where to turn it back on.
   Browser / home-screen web app: <input type="file" accept="image/*" capture="environment">, which opens the rear camera
     on iPhone Safari and Android Chrome (Samsung Internet and Firefox may offer a chooser instead).
   Photos are not saved in the app: once the photo is taken, the quest is done.
   saveToGallery is off so quest photos don't clutter the camera roll either. */
(() => {
  const P = (WB.Photo = {});
  const cap = () => window.Capacitor;
  const camera = () => {
    const c = cap();
    if (!c) return null;
    try { return c.registerPlugin ? c.registerPlugin('Camera') : c.Plugins && c.Plugins.Camera; } catch (e) { return null; }
  };
  P.native = () => {
    const c = cap();
    if (!c || !(c.isNativePlatform ? c.isNativePlatform() : c.platform && c.platform !== 'web')) return false;
    const cam = camera();
    return !!(cam && (cam.takePhoto || cam.getPhoto) && (!c.isPluginAvailable || c.isPluginAvailable('Camera')));
  };
  P.platform = () => { const c = cap(); return c && c.getPlatform ? c.getPlatform() : /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ? 'ios' : /Android/.test(navigator.userAgent) ? 'android' : 'web'; };

  // ---------- the web camera / file input ----------
  // → { ok: true } or { error: 'none' }
  P.fromFile = async (file) => {
    if (!file) return { error: 'none' };
    return { ok: true, source: 'file' };
  };

  // ---------- the native camera (installed app) ----------
  // → { ok: true } or { cancelled } or { denied } or { error }
  P.take = async () => {
    if (!P.native()) return { error: 'unavailable' };
    const cam = camera();
    if (!cam) return { error: 'unavailable' };
    try {
      if (cam.checkPermissions) {
        let p = await cam.checkPermissions();
        if (p.camera !== 'granted' && p.camera !== 'limited') {
          if (p.camera === 'denied') return { denied: true };
          p = await cam.requestPermissions({ permissions: ['camera'] });
        }
        if (p.camera === 'denied') return { denied: true };
      }
      if (cam.takePhoto) {
        await cam.takePhoto({ quality: 50, cameraDirection: 'rear', targetWidth: 640, targetHeight: 640, saveToGallery: false });
      } else {
        await cam.getPhoto({ source: 'CAMERA', resultType: 'uri', quality: 50, correctOrientation: true, saveToGallery: false, allowEditing: false, direction: 'REAR' });
      }
      return { ok: true, source: 'camera' };
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
    if (r.error === 'camera') return 'The camera didn’t open. Close other camera apps and try again.';
    return 'The photo didn’t come through. Try again.';
  };
})();
