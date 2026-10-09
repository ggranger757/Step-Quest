// Adds the settings Apple Health and Health Connect need to the generated native projects.
// Safe to run again: every change is skipped if it is already there.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const native = join(dirname(fileURLToPath(import.meta.url)), '..');
const edit = (file, fn) => { if (!existsSync(file)) return false; const a = readFileSync(file, 'utf8'), b = fn(a); if (a !== b) { writeFileSync(file, b); console.log('patched', file.replace(native + '/', '')); } return true; };

// ---- iOS: usage descriptions + HealthKit entitlement
const plistKeys = {
  NSHealthShareUsageDescription: 'Stepquest reads your step count so your steps move your hero.',
  NSHealthUpdateUsageDescription: 'Stepquest does not write health data.',
  NSMotionUsageDescription: 'Stepquest counts your steps while the game is open.',
};
const iosApp = join(native, 'ios', 'App', 'App');
edit(join(iosApp, 'Info.plist'), (s) => {
  for (const [k, v] of Object.entries(plistKeys)) if (!s.includes(`<key>${k}</key>`)) s = s.replace(/<dict>/, `<dict>\n\t<key>${k}</key>\n\t<string>${v}</string>`);
  return s;
});
const ent = join(iosApp, 'App.entitlements');
if (existsSync(iosApp) && !existsSync(ent)) {
  writeFileSync(ent, `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0">\n<dict>\n\t<key>com.apple.developer.healthkit</key>\n\t<true/>\n</dict>\n</plist>\n`);
  console.log('created ios/App/App/App.entitlements');
}
edit(join(native, 'ios', 'App', 'App.xcodeproj', 'project.pbxproj'), (s) =>
  s.includes('CODE_SIGN_ENTITLEMENTS') ? s : s.replace(/(PRODUCT_BUNDLE_IDENTIFIER = [^;]+;)/g, '$1\n\t\t\t\tCODE_SIGN_ENTITLEMENTS = App/App.entitlements;'));

// ---- Android: Health Connect needs minSdk 26
edit(join(native, 'android', 'variables.gradle'), (s) => s.replace(/minSdkVersion\s*=\s*(\d+)/, (m, n) => (Number(n) < 26 ? 'minSdkVersion = 26' : m)));

console.log('Native projects are ready for step sync.');
