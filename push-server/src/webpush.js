/* Web Push without libraries: payload encryption (RFC 8291, "aes128gcm" content coding, RFC 8188) and VAPID
   sender authentication (RFC 8292), built on WebCrypto so it runs unchanged in a Cloudflare Worker or Node 22+. */

const te = new TextEncoder();

export const b64u = {
  enc(buf) {
    const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    let s = ''; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  },
  dec(str) {
    const s = String(str).replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(s + '==='.slice((s.length + 3) % 4));
    const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  },
};

export const concat = (...parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
};

async function hmac(key, data) {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, data));
}

/* Encrypts `payload` for one browser subscription.
   p256dh, auth: the subscription's keys (base64url). opts.salt / opts.asKeys exist only for the RFC test vector. */
export async function encrypt(payload, p256dh, auth, opts = {}) {
  const uaPub = b64u.dec(p256dh), secret = b64u.dec(auth);
  if (uaPub.length !== 65 || uaPub[0] !== 4) throw new Error('bad p256dh key');
  if (secret.length !== 16) throw new Error('bad auth secret');
  const plain = typeof payload === 'string' ? te.encode(payload) : payload;
  const asKeys = opts.asKeys || (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']));
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', asKeys.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, asKeys.privateKey, 256));
  // RFC 8291 §3.3-3.4: combine the shared secret with the auth secret, then derive the content key and nonce
  const prkKey = await hmac(secret, ecdh);
  const ikm = await hmac(prkKey, concat(te.encode('WebPush: info\0'), uaPub, asPub, Uint8Array.of(1)));
  const salt = opts.salt || crypto.getRandomValues(new Uint8Array(16));
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, concat(te.encode('Content-Encoding: aes128gcm\0'), Uint8Array.of(1)))).slice(0, 16);
  const nonce = (await hmac(prk, concat(te.encode('Content-Encoding: nonce\0'), Uint8Array.of(1)))).slice(0, 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  // a single record: the payload, then the 0x02 delimiter that marks the last record (no padding)
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, concat(plain, Uint8Array.of(2))));
  // RFC 8188 header: salt (16) | record size (uint32) | key id length (1) | key id = our public key (65)
  const rs = 4096, head = new Uint8Array(21);
  head.set(salt, 0); new DataView(head.buffer).setUint32(16, rs); head[20] = asPub.length;
  return concat(head, asPub, ct);
}

// the VAPID signing key, imported once per process
let keyCache = null;
async function signingKey(pubB64, privB64) {
  if (keyCache && keyCache.pub === pubB64 && keyCache.priv === privB64) return keyCache.key;
  const pub = b64u.dec(pubB64);
  if (pub.length !== 65) throw new Error('VAPID_PUBLIC_KEY must be the 65-byte uncompressed key, base64url');
  const jwk = { kty: 'EC', crv: 'P-256', d: privB64, x: b64u.enc(pub.slice(1, 33)), y: b64u.enc(pub.slice(33, 65)), ext: true };
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  keyCache = { pub: pubB64, priv: privB64, key };
  return key;
}

// RFC 8292: "vapid t=<JWT>, k=<public key>", the JWT signed with ES256 for the push service's origin
export async function vapidHeader(endpoint, { publicKey, privateKey, subject }, now = Date.now()) {
  const aud = new URL(endpoint).origin;
  const enc = (o) => b64u.enc(te.encode(JSON.stringify(o)));
  const unsigned = enc({ typ: 'JWT', alg: 'ES256' }) + '.' + enc({ aud, exp: Math.floor(now / 1000) + 12 * 3600, sub: subject });
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, await signingKey(publicKey, privateKey), te.encode(unsigned)));
  return `vapid t=${unsigned}.${b64u.enc(sig)}, k=${publicKey}`;   // WebCrypto signs in the raw r||s form JWS needs
}

/* Sends one notification. Returns the push service's HTTP status (201 = accepted; 404 / 410 = the subscription
   is gone and should be deleted). */
export async function sendPush(sub, message, vapid, { ttl = 3600, urgency = 'high', topic, fetchImpl = fetch } = {}) {
  const body = await encrypt(JSON.stringify(message), sub.p256dh, sub.auth);
  const headers = {
    'Content-Type': 'application/octet-stream',
    'Content-Encoding': 'aes128gcm',
    TTL: String(Math.max(0, Math.round(ttl))),
    Urgency: urgency,
    Authorization: await vapidHeader(sub.endpoint, vapid),
  };
  if (topic) headers.Topic = topic;   // a newer message with the same topic replaces one still waiting on the push service
  const r = await fetchImpl(sub.endpoint, { method: 'POST', headers, body });
  return r.status;
}
