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

// ---- Android: mission reminders on time. Android 12+ only fires scheduled notifications exactly with the
// "Alarms & reminders" permission (Settings → Notifications → Exact reminder times asks for it); without it they
// can arrive a few minutes late. Remove this line if Google Play asks you not to use it.
edit(join(native, 'android', 'app', 'src', 'main', 'AndroidManifest.xml'), (s) => s.includes('SCHEDULE_EXACT_ALARM') ? s
  : s.replace(/(<manifest[^>]*>)/, '$1\n    <uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />'));

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
import AVFoundation
import Capacitor

// The theme song plays from the loading screen: allow audio without a tap.
class MainViewController: CAPBridgeViewController {
    // Game sounds and music play on the speaker even with the Ring/Silent switch on silent,
    // and mix with music from other apps instead of stopping it.
    override func viewDidLoad() {
        super.viewDidLoad()
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .default, options: [.mixWithOthers])
        try? AVAudioSession.sharedInstance().setActive(true)
    }

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
// projects made before the speaker fix: add the audio session setup to the existing view controller
edit(vc, (s) => s.includes('AVAudioSession') ? s : s
  .replace('import WebKit\n', 'import WebKit\nimport AVFoundation\n')
  .replace(/(class MainViewController: CAPBridgeViewController \{\n)/, `$1    // Game sounds and music play on the speaker even with the Ring/Silent switch on silent,
    // and mix with music from other apps instead of stopping it.
    override func viewDidLoad() {
        super.viewDidLoad()
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .default, options: [.mixWithOthers])
        try? AVAudioSession.sharedInstance().setActive(true)
    }

`));
// ---- The player's own music: a tiny AudioFocus plugin answers "is another app playing music right now?", so
// game music waits instead of playing over (or, on Android, stopping) the player's Spotify / Apple Music.
// iOS: lives in MainViewController.swift (no new file to add to the Xcode target) and is registered there.
edit(vc, (s) => s.includes('AudioFocusPlugin') ? s : s
  .replace(/(class MainViewController: CAPBridgeViewController \{\n)/, `$1    // register the app's own plugins
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(AudioFocusPlugin())
    }

`) + `
// "Is another app playing music?" Our own session mixes with others, so this never counts Step Quest itself.
@objc(AudioFocusPlugin)
public class AudioFocusPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AudioFocusPlugin"
    public let jsName = "AudioFocus"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "otherAudio", returnType: CAPPluginReturnPromise)
    ]

    @objc func otherAudio(_ call: CAPPluginCall) {
        let session = AVAudioSession.sharedInstance()
        call.resolve(["playing": session.secondaryAudioShouldBeSilencedHint || session.isOtherAudioPlaying])
    }
}
`);
// Android: its own small class, registered in MainActivity before the bridge starts
const afp = join(javaDir, 'AudioFocusPlugin.java');
if (existsSync(javaDir) && !existsSync(afp)) {
  writeFileSync(afp, `package com.stepquest.app;

import android.content.Context;
import android.media.AudioManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// "Is any music playing right now?" Android counts every app here, Step Quest included, so the game only asks
// while its own sound is quiet (at launch and when it comes back to the front).
@CapacitorPlugin(name = "AudioFocus")
public class AudioFocusPlugin extends Plugin {
    @PluginMethod
    public void otherAudio(PluginCall call) {
        AudioManager am = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
        JSObject r = new JSObject();
        r.put("playing", am != null && am.isMusicActive());
        call.resolve(r);
    }
}
`);
  console.log('created android/app/src/main/java/com/stepquest/app/AudioFocusPlugin.java');
}
edit(join(javaDir, 'MainActivity.java'), (s) => s.includes('registerPlugin(AudioFocusPlugin.class)') ? s
  : s.includes('void onCreate') ? s.replace(/(\n(\s*)super\.onCreate\()/, '\n$2registerPlugin(AudioFocusPlugin.class);   // the player\'s own music$1')
  : s.replace(/(public class MainActivity extends BridgeActivity \{\n)/, `$1    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(AudioFocusPlugin.class);   // the player's own music: is another app playing?
        super.onCreate(savedInstanceState);
    }

`));
edit(join(iosApp, 'Base.lproj', 'Main.storyboard'), (s) => s.replace(/customClass="CAPBridgeViewController" customModule="Capacitor"/, 'customClass="MainViewController" customModule="App" customModuleProvider="target"'));

console.log('Native projects are ready for step sync.');
