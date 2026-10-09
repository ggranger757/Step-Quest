// Copies the Step Quest web app (the repo root) into native/www, which Capacitor bundles into the apps.
import { cpSync, rmSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');          // repo root
const www = join(here, '..', 'www');
rmSync(www, { recursive: true, force: true });
mkdirSync(www, { recursive: true });
for (const p of ['index.html', 'manifest.webmanifest', 'css', 'js', 'assets']) {
  if (!existsSync(join(root, p))) throw new Error('Missing ' + p + ' in the repo root. Run this from the Step Quest repo.');
  cpSync(join(root, p), join(www, p), { recursive: true });
}
// Health Connect (Android) requires a privacy policy page inside the app: assets/public/privacypolicy.html
writeFileSync(join(www, 'privacypolicy.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Step Quest privacy policy</title>
<style>body{font:16px/1.5 system-ui,sans-serif;max-width:640px;margin:0 auto;padding:24px;background:#0b0a1a;color:#ece9ff}h1{font-size:24px}</style></head><body>
<h1>Step Quest privacy policy</h1>
<p>Step Quest reads your daily <b>step count</b> from Apple Health (iPhone) or Health Connect (Android) so your steps move your character in the game. It reads nothing else and writes nothing to your health data.</p>
<p>Step counts and your game progress are stored on your device. Step Quest has no accounts, no ads and no analytics, and it does not send your health data to anyone.</p>
<p>You can stop step access at any time in Step Quest (Profile) or in your phone's health settings. Uninstalling the app deletes its data from your device.</p>
<p>Questions: replace this line with your contact email before publishing.</p>
</body></html>`);
console.log('Copied the web app into', www);
