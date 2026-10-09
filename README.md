# Walkbound

A pixel-art walking RPG for your phone. Every real step moves your hero forward through the world. Walk to explore 38 worlds that open as you level up, earn Walk Coins, fight turn-based battles against aggressive creatures and world guardians, collect weapons, potions, pets and artifacts, and listen to your own music while you walk.

It is a Progressive Web App (PWA): plain HTML, CSS and JavaScript with no build step and no server. Host it anywhere that serves static files over HTTPS, then install it from the phone's browser. The same code also builds into a real iPhone and Android app (see **Automatic step sync**) that reads steps from Apple Health and Health Connect.

## Launch on GitHub Pages

1. Create a new repository on GitHub (for example `walkbound`).
2. Upload everything in this folder to the repository root, including the hidden `.github` folder and `.nojekyll`.
   - On the website: **Add file → Upload files**, then drag in the folder contents. Hidden files may be skipped when you drag, so check that `.github/workflows/pages.yml` is there. If it isn't, use step 3b.
   - Or from a terminal:
     ```bash
     cd walkbound
     git init && git add . && git commit -m "Walkbound 2.2"
     git branch -M main
     git remote add origin https://github.com/<you>/walkbound.git
     git push -u origin main
     ```
3. Turn on Pages: **Settings → Pages**.
   - a. **Source: GitHub Actions**. The included workflow publishes the site on every push to `main`.
   - b. If the workflow file didn't upload: choose **Deploy from a branch**, branch `main`, folder `/ (root)`.
4. After a minute the site is live at `https://<you>.github.io/walkbound/`.

## Install it on a phone

- **iPhone (Safari):** open the site → Share → **Add to Home Screen**. When you tap **Start walking**, allow Motion & Orientation access.
- **Android (Chrome):** open the site → menu → **Install app** (or **Add to Home screen**).

The app works offline after the first visit.

## How steps are counted

| Where Walkbound runs | Step source |
| --- | --- |
| **Installed app** (iPhone / Android, built from `native/`) | **Automatic sync** from Apple Health (HealthKit) or Health Connect. Walks taken with the app closed count too: they move your hero, pay out and keep your streak, credited to the day they happened. |
| **Browser / home-screen PWA** | **Motion sensor**: a pedometer on the phone's accelerometer that counts automatically whenever the app is open: on Android it starts by itself; on iPhone, Safari only allows motion access after a tap, so the first touch anywhere in the app starts it (the permission prompt appears only the first time). Players can Pause it. 4 rhythmic steps in a row are needed before counting starts, so bumps are ignored. **Log steps**: type today's total from your Health app and the difference is added. |

Browsers have no API for health data, which is why automatic sync needs the installed app. Both paths feed the same function, so the game never changes: see `js/04-steps.js` and `js/04b-health.js`.

## Automatic step sync (installed app)

`native/` turns Walkbound into an iPhone and Android app with [Capacitor](https://capacitorjs.com) and one cross-platform health plugin, [`@capgo/capacitor-health`](https://capgo.app/docs/plugins/health/), which talks to HealthKit on iOS and Health Connect on Android.

How the sync works (`js/04b-health.js`):

- The health store's daily totals are the source of truth. On launch, whenever the app returns to the foreground, and every minute while it's open, Walkbound asks for per-day step sums since the day you connected (up to the last 7 days).
- Only the difference from what the game already counted is added, so nothing is ever counted twice. While sync is on, the in-app pedometer is switched off.
- Only step counts are read. Nothing is written.

Requirements (Capacitor 8): Node 22+, Xcode 26+ on a Mac for iPhone, Android Studio (Otter 2025.2 or newer) with JDK 21 for Android.

```bash
cd native
npm install
npm run add            # copies the web app into native/www, creates ios/ and android/, adds the health settings
npm run ios            # opens Xcode
npm run android        # opens Android Studio
```

After changing the game, run `npm run sync` again (or `npm run ios` / `npm run android`).

**iPhone:** in Xcode select the **App** target → **Signing & Capabilities**, pick your team, and check that **HealthKit** is listed (`npm run add` writes the entitlement and the Health permission texts to `Info.plist`; add the capability with **+ Capability → HealthKit** if Xcode doesn't show it). Run on a real iPhone: the simulator has no step data. Change `appId` in `capacitor.config.json` to your own bundle ID first.

**Android:** Health Connect is built into Android 14+. On Android 8–13 players install **Health Connect by Android** from the Play Store; Walkbound tells them if it's missing. `npm run add` sets the minimum SDK to 26 and ships the privacy policy page Health Connect requires (`privacypolicy.html`; put your contact email in `native/scripts/copy-web.mjs` before publishing). To publish on Google Play you must also complete the Health Connect permissions declaration in the Play Console.

**No Mac or Android Studio?** Run the **Android app** workflow from the repository's Actions tab: it builds a debug APK you can install on an Android phone for testing.

App icons: put a 1024×1024 `icon.png` in `native/assets/` and run `npm run icons`.

## Battles

Some creatures are aggressive. When one blocks the path you can fight or avoid it; fighting opens a 1v1 turn-based battle:

- **Strike** uses your **melee** weapon (swords, daggers, axes, maces, spears, staves). Your walker holds it in hand during the attack. Daggers stab twice, axes sunder (+25% damage taken), maces stun, spears pierce guards and hit harder on the first turn, staves heal or curse, some blades steal life.
- **Throw / Shoot / Cast** uses your **ranged** weapon: throwing weapons arc, knives spin, arrows and the 12 spells (orb, wave and javelin in sun, frost, void and fire) fly straight at the creature. It hits hardest, may poison, burn, bleed, freeze, weaken, drain or volley, then recharges.
- **Defend** uses your **shield**: it blocks 60–85%, and some shields reverse part of the hit back, counter with spikes or heal. Every shield also soaks a little of every hit (armor). Guardians glow red and "charge up" before a heavy attack: defend then.
- Creatures fight back with more than attacks: they **brace** (your next hit does half) and guardians raise **reversing wards** (30% of your next hit bounces back). Piercing weapons ignore both.
- **Pets** fight with you: your pet soaks 20–60% of every hit until its own HP runs out, then it's knocked out until walking heals it. Every HP change floats over whoever took it as "-N HP" / "+N HP".
- **Items** drinks a potion. **Run away** may fail.
- Losing never costs coins. HP drops to 25% and comes back as you walk (1 HP every 5 steps) and fully each morning.
- Exploring a world to 100% wakes its **guardian**. Challenge it from the world map. Defeating guardians unlocks the legendary weapons.

Weapons, potions, pets, artifacts and achievements live on the **Supplies** tab. Avatars and trails are in the **Shop**.

There are 48 potions, one for every flask in the potion pack. Four everyday potions are sold from the start; the other 44 are hidden as artifacts in the newer worlds. Finding one gives you a bottle and adds it to the shop. Potions heal, cut damage, boost damage, recharge your weapon instantly or explode on the enemy.

## Worlds and levels

There are 38 worlds. Each one opens at a level, from Rust Hollow at level 1 to the Fort of Illusion at level 50, so the map grows as you level up from walking, battles, tasks and achievements. The world screen and the map show the next world and roughly how many steps away it is. Creatures get stronger in later worlds, and every world has a guardian and a few artifacts to find.

## Walkers and pets

At sign-up a player picks one of three classic walkers (Scavenger, Wandering Mage, Kunoichi) and a skin tone. The other two starters, and every other walker, are unlocked later with coins, levels, streaks or exploration.

Equipped pets walk beside your walker in every world: dogs, cats, rats, birds, desert creatures, woodland animals (fox, hare, deer, boar, black grouse) and pet rocks that hop along behind you.

## Music while you walk

Profile → **Music** (or the music button on the world screen) takes a Spotify or Apple Music share link for a playlist, album or song. Walkbound plays it in the official embedded player docked above the tab bar, so it keeps playing on every tab. Players signed in to Spotify or Apple Music in that browser hear full tracks; otherwise the services play 30-second previews. Game sounds are set to mix with music, so you can also start music in the Spotify or Apple Music app first and then open Walkbound.

## Developer mode

Open the site with `#dev` at the end of the URL, or tap the version number at the bottom of the Profile screen 5 times. A **DEV** button appears with tools to add simulated steps and coins, level up, complete tasks, unlock worlds and avatars, trigger an encounter or battle, fight the guardian, heal, add potions, unlock weapons and simulate the next day. Players never see it unless they turn it on.

## Project layout

```
index.html               app shell
manifest.webmanifest     PWA manifest (name, icons, colors)
sw.js                    service worker (offline cache)
css/style.css            all styles
js/assets.js             sprite sheet sizes and frame counts (generated)
js/00-util.js            helpers, storage, event bus
js/01-icons.js           hand-drawn pixel icons
js/02-data.js            ALL game content: worlds, avatars, items, tasks, achievements, encounters
js/03-state.js           save data and persistence
js/04-steps.js           step tracking sources, wake lock, sound hooks
js/04b-health.js         automatic step sync (Apple Health / Health Connect) in the installed app
js/05-game.js            game rules: rewards, leveling, streaks, tasks, encounters, shop, HP
js/05b-battle.js         battle rules (pure logic: moves, weapons, status effects, guardians)
js/06-engine.js          canvas renderer: parallax worlds, avatar, pets, particles
js/07-ui.js              screens, HUD, sheets, toasts
js/07b-battle-ui.js      battle screen
js/07c-music.js          Spotify / Apple Music player
js/08-main.js            startup, onboarding, developer panel
assets/bg/               world layers (each scene at most 300 px tall)
assets/av/               avatar sprite atlases (one row per animation)
assets/cr/               creature sprite atlases
assets/pet/              pet sprite atlases
assets/npc/              trader sprite atlases
assets/wp/               weapon projectiles and explosions
assets/pot/              potion icons
assets/art/              artifact icons (r = creature relics, m = minerals, c = charms)
assets/ach/              achievement badges
assets/wi/               weapon icons (melee, ranged, shields)
assets/sfx/              weapon sounds
assets/icons/            app icons
assets/fonts/            Jersey 10, Pixelify Sans, Silkscreen (bundled for offline use, SIL OFL)
tools/prep_assets.py     rebuilds /assets from the original downloads:
                         python3 prep_assets.py <pack1_dir> <pack2_dir> <pack3_dir> <pack4_dir> <pack5_dir> assets
                         (Parallax Cave ships as a .rar: extract it with unrar into "New Worlds/Parallax Cave" first)
native/                  Capacitor project for the iPhone / Android app (step sync)
.github/workflows/       pages.yml publishes the site; android.yml builds a test APK on demand
```

## Adding content

Everything lives in `js/02-data.js`:

- **New world:** add an entry to `D.WORLDS` with its layers (back to front, each with a parallax multiplier), ground line, length in steps and `unlock` level. Then add its finds to `D.FINDS`.
- **New avatar, pet, trail or weapon:** add an entry with a `req`, such as `{ level: 5 }`, `{ cost: 400 }`, `{ streak: 7 }`, `{ steps: 20000 }` or `{ explored: 'rust' }`.
- **Skin tones:** `D.SKIN_TONES` holds the swatches (each a 3-color ramp). `D.SKIN_MAP` lists the exact skin colors each sprite sheet uses; Skin tone editing covers the original walkers; the newer walkers keep their drawn skin.
- **Creatures:** `D.CREATURES` sets HP, attack and whether each one is aggressive. Each world has a `pool` and a `boss`.
- **Weapons and potions:** `D.WEAPONS` (power, recharge turns, effect) and `D.POTIONS`.
- **Balance:** `COINS_PER_STEP`, `XP_PER_STEP`, `xpToNext`, `heroMaxHp`, `heroAtk`, `creatureStats`, world `length` and `unlock` level.

## Shipping updates

The service worker caches every file. When you change anything, edit the `CACHE` name at the top of `sw.js` (for example `walkbound-2.2.1`) so installed phones pick up the new version on their next launch.

Saves from earlier versions upgrade automatically. Auras and dyes were retired in 2.0; players who bought them get their coins back. Since 2.2 worlds open by level; worlds a player already unlocked stay open.

## Saves

Progress is stored on the phone (browser local storage, or the installed app's storage). Clearing site data or uninstalling erases it. There are no accounts and no server.

## Credits and licenses

See `CREDITS.md`. The art comes from CraftPix.net free packs. Check their license before you redistribute the assets or ship commercially.
