// Adds the settings Apple Health and Health Connect need to the generated native projects.
// Safe to run again: every change is skipped if it is already there.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const native = join(dirname(fileURLToPath(import.meta.url)), '..');
const edit = (file, fn) => { if (!existsSync(file)) return false; const a = readFileSync(file, 'utf8'), b = fn(a); if (a !== b) { writeFileSync(file, b); console.log('patched', file.replace(native + '/', '')); } return true; };

// ---- iOS: usage descriptions + HealthKit entitlement
const plistKeys = {
  NSHealthShareUsageDescription: 'Step Quest reads your step count so your steps move your hero.',
  NSHealthUpdateUsageDescription: 'Step Quest does not write health data.',
  NSMotionUsageDescription: 'Step Quest counts your steps while the game is open.',
};
const iosApp = join(native, 'ios', 'App', 'App');
edit(join(iosApp, 'Info.plist'), (s) => {
  s = s.replace(/\s*<key>NSLocationWhenInUseUsageDescription<\/key>\s*<string>[^<]*<\/string>/, '');   // Location Awareness was removed: no location prompt
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

// ---- Android: Location Awareness was removed, so no location permission (older projects drop it here)
edit(join(native, 'android', 'app', 'src', 'main', 'AndroidManifest.xml'), (s) => s.replace(/\s*<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" \/>/, ''));

// ---- Android: Health Connect needs minSdk 26
edit(join(native, 'android', 'variables.gradle'), (s) => s.replace(/minSdkVersion\s*=\s*(\d+)/, (m, n) => (Number(n) < 26 ? 'minSdkVersion = 26' : m)));

// ---- Music from the loading screen: let the app's web view start audio without waiting for a tap
// Android: MainActivity turns off "media playback requires a user gesture"
const javaDir = join(native, 'android', 'app', 'src', 'main', 'java', 'com', 'stepquest', 'app');
edit(join(javaDir, 'MainActivity.java'), (s) => s.includes('setMediaPlaybackRequiresUserGesture') ? s
  : s.replace(/public class MainActivity extends BridgeActivity \{\s*\}/, `public class MainActivity extends BridgeActivity {
    @Override
    public void onStart() {
        super.onStart();
        // the theme song plays from the loading screen
        this.bridge.getWebView().getSettings().setMediaPlaybackRequiresUserGesture(false);
    }
}`));
// iOS: a bridge view controller whose web view may autoplay audio, used by the main storyboard
const vc = join(iosApp, 'MainViewController.swift');
if (existsSync(iosApp) && !existsSync(vc)) {
  writeFileSync(vc, `import UIKit
import WebKit
import Capacitor

// The theme song plays from the loading screen: allow audio without a tap.
class MainViewController: CAPBridgeViewController {
    override func webViewConfiguration(for instanceConfiguration: InstanceConfiguration) -> WKWebViewConfiguration {
        let config = super.webViewConfiguration(for: instanceConfiguration)
        config.mediaTypesRequiringUserActionForPlayback = []
        config.allowsInlineMediaPlayback = true
        return config
    }
}
`);
  console.log('created ios/App/App/MainViewController.swift (add it to the App target in Xcode if it is not picked up)');
}
edit(join(iosApp, 'Base.lproj', 'Main.storyboard'), (s) => s.replace(/customClass="CAPBridgeViewController" customModule="Capacitor"/, 'customClass="MainViewController" customModule="App" customModuleProvider="target"'));

console.log('Native projects are ready for step sync.');
