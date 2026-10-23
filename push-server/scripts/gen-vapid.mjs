// Makes the VAPID key pair the push server signs with (the same format as `npx web-push generate-vapid-keys`).
// Run once:  node scripts/gen-vapid.mjs
// Keep the private key secret: it goes only into the Worker (`npx wrangler secret put VAPID_PRIVATE_KEY`).
const { subtle } = globalThis.crypto;
const b64u = (buf) => Buffer.from(buf).toString('base64url');
const pair = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const jwk = await subtle.exportKey('jwk', pair.privateKey);
const pub = new Uint8Array(await subtle.exportKey('raw', pair.publicKey));
console.log('VAPID_PUBLIC_KEY  =', b64u(pub));
console.log('VAPID_PRIVATE_KEY =', jwk.d);
console.log('\nPut the public key in js/push-config.js too (it is safe to publish). Never publish the private key.');
