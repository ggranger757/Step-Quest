"""Independent Web Push receiver for the tests: decrypts an aes128gcm message (RFC 8291 / RFC 8188) and verifies the
VAPID JWT (RFC 8292) with the `cryptography` library, so the Worker's WebCrypto code is checked against a second,
separate implementation. Reads JSON on stdin, prints JSON."""
import base64, json, sys, struct, time
from urllib.parse import urlparse
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec, utils
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

def b64d(s): return base64.urlsafe_b64decode(s + '=' * (-len(s) % 4))
def hkdf(salt, ikm, info, n): return HKDF(algorithm=hashes.SHA256(), length=n, salt=salt, info=info).derive(ikm)

def decrypt(body, ua_priv_d, ua_pub, auth):
    salt, rs, idlen = body[:16], struct.unpack('>I', body[16:20])[0], body[20]
    as_pub = body[21:21 + idlen]; ct = body[21 + idlen:]
    priv = ec.derive_private_key(int.from_bytes(ua_priv_d, 'big'), ec.SECP256R1())
    peer = ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256R1(), as_pub)
    ecdh = priv.exchange(ec.ECDH(), peer)
    ikm = hkdf(auth, ecdh, b'WebPush: info\x00' + ua_pub + as_pub, 32)
    cek = hkdf(salt, ikm, b'Content-Encoding: aes128gcm\x00', 16)
    nonce = hkdf(salt, ikm, b'Content-Encoding: nonce\x00', 12)
    assert len(ct) <= rs, 'record larger than rs'
    plain = AESGCM(cek).decrypt(nonce, ct, None).rstrip(b'\x00')
    assert plain.endswith(b'\x02'), 'missing last-record delimiter'
    return plain[:-1].decode()

def verify_vapid(header, endpoint, expect_key):
    assert header.startswith('vapid '), header
    parts = dict(p.strip().split('=', 1) for p in header[6:].split(','))
    t, k = parts['t'], parts['k']
    assert k == expect_key, 'k is not the server public key'
    h, p, s = t.split('.')
    assert json.loads(b64d(h)) == {'typ': 'JWT', 'alg': 'ES256'}
    claims = json.loads(b64d(p))
    u = urlparse(endpoint); assert claims['aud'] == f'{u.scheme}://{u.netloc}', claims
    assert claims['exp'] > time.time() and claims['exp'] <= time.time() + 24 * 3600, claims
    assert claims['sub'].startswith('mailto:') or claims['sub'].startswith('https:')
    sig = b64d(s); assert len(sig) == 64
    pub = ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256R1(), b64d(k))
    pub.verify(utils.encode_dss_signature(int.from_bytes(sig[:32], 'big'), int.from_bytes(sig[32:], 'big')), f'{h}.{p}'.encode(), ec.ECDSA(hashes.SHA256()))
    return claims

req = json.load(sys.stdin)
out = []
for m in req['messages']:
    claims = verify_vapid(m['authorization'], m['endpoint'], req['vapidPublicKey'])
    text = decrypt(b64d(m['body']), b64d(req['uaPrivD']), b64d(req['uaPub']), b64d(req['auth']))
    out.append({'payload': json.loads(text), 'aud': claims['aud'], 'ttl': m.get('ttl'), 'encoding': m.get('encoding')})
print(json.dumps(out))
