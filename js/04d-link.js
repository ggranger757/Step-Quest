/* Step Quest — linking two phones that are next to each other (3.6.0), with no server.
   A direct WebRTC data channel between the two phones. To set it up they swap two codes, by scanning each other's
   screen (or copying the text, as a fallback): the host shows an invitation, the guest scans it and shows a reply,
   the host scans the reply, and they're connected. On the same Wi-Fi or a phone hotspot that works offline; on
   separate networks it may also get through using Google's public STUN servers (no account, nothing stored).
   Codes are the WebRTC session description, compressed and base64url-encoded, prefixed "SQD1.".
   The QR libraries (js/vendor/qrcode.js, js/vendor/jsqr.js) load only when a duel starts.
   Used by the duel screens (07p-duel-ui.js). */
(() => {
  const L = (WB.Link = {});
  const ICE = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
  const PREFIX = 'SQD1.';
  L.supported = () => !!(window.RTCPeerConnection && window.RTCSessionDescription);
  L.canScan = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

  // ---------- load a vendored script once ----------
  const loaded = {};
  L.lib = (name) => loaded[name] || (loaded[name] = new Promise((ok, no) => {
    if (name === 'qrcode' && window.qrcode) return ok();
    if (name === 'jsqr' && window.jsQR) return ok();
    const s = document.createElement('script');
    s.src = 'js/vendor/' + (name === 'qrcode' ? 'qrcode.js' : 'jsqr.js') + '?v=' + (WB.VERSION || '');
    s.onload = () => ok(); s.onerror = () => { delete loaded[name]; no(new Error('lib ' + name)); };
    document.head.appendChild(s);
  }));

  // ---------- codes: SDP <-> short text ----------
  const b64u = (bytes) => { let s = ''; bytes.forEach((b) => (s += String.fromCharCode(b))); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  const unb64u = (t) => { const s = atob(t.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((t.length + 3) % 4)); return Uint8Array.from(s, (c) => c.charCodeAt(0)); };
  const stream = async (bytes, Kind) => new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new Kind('deflate-raw'))).arrayBuffer());
  // only the lines a data channel needs (smaller codes = easier QR scans)
  const slim = (sdp) => sdp.split(/\r?\n/).filter((l) => l && !/^a=(extmap|rtcp-fb|ssrc|msid|rtpmap|fmtp|ice-options:trickle$)/.test(l)).join('\r\n') + '\r\n';
  L.pack = async (desc) => {
    const raw = new TextEncoder().encode(desc.type[0] + slim(desc.sdp));
    if (window.CompressionStream) { try { return PREFIX + 'z' + b64u(await stream(raw, CompressionStream)); } catch (e) { /* fall through */ } }
    return PREFIX + 'r' + b64u(raw);
  };
  L.unpack = async (code) => {
    code = String(code || '').trim().replace(/\s+/g, '');
    const i = code.indexOf(PREFIX); if (i < 0) throw new Error('not a duel code');
    const body = code.slice(i + PREFIX.length), mode = body[0];
    let bytes = unb64u(body.slice(1));
    if (mode === 'z') { if (!window.DecompressionStream) throw new Error('old browser'); bytes = await stream(bytes, DecompressionStream); }
    const txt = new TextDecoder().decode(bytes);
    return { type: txt[0] === 'o' ? 'offer' : 'answer', sdp: txt.slice(1) };
  };
  L.isCode = (t) => typeof t === 'string' && t.indexOf(PREFIX) >= 0;

  // wait until the phone has found its network addresses (or give up after a few seconds: local ones come first)
  const gathered = (pc, ms = 3500) => new Promise((ok) => {
    if (pc.iceGatheringState === 'complete') return ok();
    const t = setTimeout(ok, ms);
    pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') { clearTimeout(t); ok(); } });
  });

  // ---------- a channel: JSON messages, a heartbeat, and one "lost" signal ----------
  function wrap(pc, dc) {
    const ch = { pc, dc, handlers: {}, open: false, closed: false, lastIn: Date.now() };
    const fire = (type, data) => (ch.handlers[type] || []).forEach((f) => { try { f(data); } catch (e) { console.error(e); } });
    ch.on = (type, f) => { (ch.handlers[type] = ch.handlers[type] || []).push(f); return ch; };
    ch.send = (msg) => { if (dc.readyState !== 'open') return false; try { dc.send(JSON.stringify(msg)); return true; } catch (e) { return false; } };
    ch.close = () => { if (ch.closed) return; ch.closed = true; clearInterval(ch.beat); try { dc.close(); } catch (e) {} try { pc.close(); } catch (e) {} fire('close'); };
    const lost = () => { if (ch.closed) return; ch.closed = true; clearInterval(ch.beat); try { pc.close(); } catch (e) {} fire('lost'); };
    dc.onopen = () => { ch.open = true; ch.lastIn = Date.now(); fire('open');
      ch.beat = setInterval(() => { ch.send({ t: 'ping' }); if (Date.now() - ch.lastIn > 12000) lost(); }, 3000); };
    dc.onmessage = (e) => { ch.lastIn = Date.now(); let m; try { m = JSON.parse(e.data); } catch (x) { return; } if (m && m.t && m.t !== 'ping') fire('msg', m); };
    dc.onclose = () => (ch.open ? lost() : null);
    pc.addEventListener('connectionstatechange', () => { if (pc.connectionState === 'failed') lost(); });
    return ch;
  }

  // ---------- host: make an invitation; accept the reply ----------
  L.host = async () => {
    const pc = new RTCPeerConnection({ iceServers: ICE });
    const dc = pc.createDataChannel('duel', { ordered: true });
    const ch = wrap(pc, dc);
    await pc.setLocalDescription(await pc.createOffer());
    await gathered(pc);
    ch.code = await L.pack(pc.localDescription);
    ch.accept = async (reply) => {
      const d = await L.unpack(reply);
      if (d.type !== 'answer') throw new Error('That’s an invitation, not a reply. Scan the code your friend shows after they join.');
      await pc.setRemoteDescription(d);
    };
    return ch;
  };
  // ---------- guest: read the invitation, make the reply; the channel opens when the host scans it ----------
  L.join = async (invite) => {
    const d = await L.unpack(invite);
    if (d.type !== 'offer') throw new Error('That’s a reply, not an invitation. Scan the code on the host’s phone.');
    const pc = new RTCPeerConnection({ iceServers: ICE });
    let ch = null;
    const ready = new Promise((ok) => { pc.ondatachannel = (e) => { ch = wrap(pc, e.channel); ok(ch); }; });
    await pc.setRemoteDescription(d);
    await pc.setLocalDescription(await pc.createAnswer());
    await gathered(pc);
    const code = await L.pack(pc.localDescription);
    return { pc, code, ready, close: () => { try { pc.close(); } catch (e) {} if (ch) ch.close(); } };
  };

  // ---------- QR: draw a code; scan one with the camera ----------
  L.drawQR = async (canvas, text) => {
    await L.lib('qrcode');
    const q = window.qrcode(0, 'L'); q.addData(text, 'Byte'); q.make();
    const n = q.getModuleCount(), quiet = 4, px = Math.max(2, Math.floor(canvas.width / (n + quiet * 2)));
    const size = (n + quiet * 2) * px; canvas.width = canvas.height = size;
    const x = canvas.getContext('2d'); x.fillStyle = '#ffffff'; x.fillRect(0, 0, size, size); x.fillStyle = '#000000';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) x.fillRect((c + quiet) * px, (r + quiet) * px, px, px);
    return n;
  };
  // scan with the rear camera until a duel code shows up → resolves the text; .stop() cancels
  L.scan = (video, onStatus) => {
    let stream = null, stopped = false, raf = 0, timer = 0;
    const cv = document.createElement('canvas'), cx = cv.getContext('2d', { willReadFrequently: true });
    const done = new Promise(async (ok, no) => {
      try {
        const det = 'BarcodeDetector' in window ? await (async () => { try { const f = await window.BarcodeDetector.getSupportedFormats(); return f.includes('qr_code') ? new window.BarcodeDetector({ formats: ['qr_code'] }) : null; } catch (e) { return null; } })() : null;
        if (!det) await L.lib('jsqr');
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
        if (stopped) return stop();
        video.setAttribute('playsinline', ''); video.muted = true; video.srcObject = stream; await video.play().catch(() => {});
        if (onStatus) onStatus('scanning');
        const tick = async () => {
          if (stopped) return;
          if (video.readyState >= 2 && video.videoWidth) {
            let text = null;
            if (det) { try { const r = await det.detect(video); text = r && r[0] && r[0].rawValue; } catch (e) { /* next frame */ } }
            else {
              const w = Math.min(640, video.videoWidth), h = Math.round(video.videoHeight * w / video.videoWidth);
              cv.width = w; cv.height = h; cx.drawImage(video, 0, 0, w, h);
              const r = window.jsQR(cx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' });
              text = r && r.data;
            }
            if (text && L.isCode(text)) { stop(); return ok(text); }
          }
          timer = setTimeout(() => { raf = requestAnimationFrame(tick); }, det ? 120 : 60);
        };
        tick();
      } catch (e) { stop(); no(e); }
    });
    function stop() { stopped = true; cancelAnimationFrame(raf); clearTimeout(timer); if (stream) stream.getTracks().forEach((t) => t.stop()); stream = null; try { video.srcObject = null; } catch (e) {} }
    done.stop = stop;
    return done;
  };
  L.cameraWhy = (e) => {
    const n = (e && e.name) || '';
    if (n === 'NotAllowedError' || n === 'SecurityError') return /iPhone|iPad/.test(navigator.userAgent) ? 'Camera access is off. Turn it on in Settings → Step Quest (or Safari) → Camera, or paste the code instead.' : 'Camera access is off. Allow it in the site or app settings, or paste the code instead.';
    if (n === 'NotFoundError' || n === 'OverconstrainedError') return 'No camera found. Paste the code instead.';
    return 'The camera didn’t start. Paste the code instead.';
  };
})();
