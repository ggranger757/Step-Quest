# Step Quest

A pixel-art walking RPG for your phone. Every real step moves your hero through 50 worlds. Walk to earn coins and XP, hatch Merlin’s eggs, fight creatures and guardians, turn your to-dos into missions, and charge your Worldkey with the artifacts you find to open the next world.

It is a Progressive Web App (PWA): plain HTML, CSS and JavaScript with no build step and no server. The same code also builds into an iPhone and Android app (see **Automatic step sync**) that reads steps from Apple Health and Health Connect.

## Launch on GitHub Pages

1. Create a new repository on GitHub (for example `stepquest`).
2. Upload everything in this folder to the repository root, including the hidden `.github` folder and `.nojekyll`.
   - On the website: **Add file → Upload files**, then drag in the folder contents. Hidden files may be skipped when you drag, so check that `.github/workflows/pages.yml` is there. If it isn't, use step 3b.
   - Or from a terminal:
     ```bash
     cd stepquest
     git init && git add . && git commit -m "Step Quest 3.0"
     git branch -M main
     git remote add origin https://github.com/<you>/stepquest.git
     git push -u origin main
     ```
3. Turn on Pages: **Settings → Pages**.
   - a. **Source: GitHub Actions**. The included workflow publishes the site on every push to `main`.
   - b. If the workflow file didn't upload: choose **Deploy from a branch**, branch `main`, folder `/ (root)`.
4. After a minute the site is live at `https://<you>.github.io/stepquest/`.

## Install it on a phone

- **iPhone (Safari):** open the site → Share → **Add to Home Screen**. When you tap **Start walking**, allow Motion & Orientation access.
- **Android (Chrome):** open the site → menu → **Install app** (or **Add to Home screen**).

The app works offline after the first visit.

## How steps are counted

| Where Step Quest runs | Step source |
| --- | --- |
| **Installed app** (iPhone / Android, built from `native/`) | **Automatic sync** from Apple Health (HealthKit) or Health Connect. Walks taken with the app closed count too: they move your hero, pay out and keep your streak, credited to the day they happened. |
| **Browser / home-screen PWA** | **Motion sensor**: a pedometer on the phone's accelerometer that counts automatically whenever the app is open: on Android it starts by itself; on iPhone, Safari only allows motion access after a tap, so the first touch anywhere in the app starts it (the permission prompt appears only the first time). Players can Pause it. 4 rhythmic steps in a row are needed before counting starts, so bumps are ignored. **Log steps**: type today's total from your Health app and the difference is added. Hand-logged steps are capped at 30,000 a day (`D.MANUAL_DAY_MAX`) so logging can't replace walking; the motion sensor and Health sync are not capped. |

Browsers have no API for health data, which is why automatic sync needs the installed app. Both paths feed the same function, so the game never changes: see `js/04-steps.js` and `js/04b-health.js`.

## Automatic step sync (installed app)

`native/` turns Step Quest into an iPhone and Android app with [Capacitor](https://capacitorjs.com) and one cross-platform health plugin, [`@capgo/capacitor-health`](https://capgo.app/docs/plugins/health/), which talks to HealthKit on iOS and Health Connect on Android.

How the sync works (`js/04b-health.js`):

- The health store's daily totals are the source of truth. On launch, whenever the app returns to the foreground, and every minute while it's open, Step Quest asks for per-day step sums since the day you connected (up to the last 7 days).
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

**Android:** Health Connect is built into Android 14+. On Android 8–13 players install **Health Connect by Android** from the Play Store; Step Quest tells them if it's missing. `npm run add` sets the minimum SDK to 26 and ships the privacy policy page Health Connect requires (`privacypolicy.html`; put your contact email in `native/scripts/copy-web.mjs` before publishing). To publish on Google Play you must also complete the Health Connect permissions declaration in the Play Console.

**No Mac or Android Studio?** Run the **Android app** workflow from the repository's Actions tab: it builds a debug APK you can install on an Android phone for testing.

App icons: the Step Quest logo is already in `native/assets/` (`icon.png` 1024×1024 and `splash.png`); run `npm run icons` to generate every iOS and Android size. Replace those two files to change the icon.

## What's in the game (3.2)

One loop: **walk → explore worlds → find things on the road → level up → open the next world.**

- **Walkers.** At sign-up you pick one of three starters; it's the only walker you have at level 1. The other two open at level 5 for 1,500 coins, and the rest unlock with levels, coins, streaks and exploring.
- **Worlds (50).** Each opens with a level and the world before it explored (Rust Hollow 100%, then 75%), and then through your **Worldkey**.
- **On the road** (`D.ENCOUNTER_WEIGHTS`): creatures (half want a fight, from level 3), supply crates, artifacts, **merchants** (cheap tonics), **travelers** (deliveries: walk N steps), **Merlin** with an egg, an **egg** by the road, the **Druid** (from level 3) and, from level 20, rare **roaming bosses**. **Redhood Rival** can appear in any fight once battles open. Each world's **guardian** wakes at 100% explored and guards a Crystal Egg.
- **The Druid** (`js/05f-druid.js`), the quick NPC: one trivia question. Right pays XP and coins; wrong means a battle. Your eggs are always safe.
- **Roaming bosses** (6) and **Redhood Rival**: scaled to your level, each with its own magic, ability and dialogue. Beating a boss pays big and drops an egg; losing costs 2 levels.
- **Battles** (from level 3): Strike, Throw/Shoot/Cast, Defend, Items, **Gear & Magic** (swap weapons and cast battle magic in one menu), Special attack (level 10), Run. Gear never runs out or wears down. On phones the menu is capped at about 38% of the screen and scrolls, so the stage stays big.
- **Missions:** three tabs.
  - **Today:** daily reward, three daily missions, **deliveries**, two **milestones** at a time (long-term goals, `D.MILESTONES`, from level 3) and the walking streak with Streak Shields.
  - **My missions:** your own to-dos plus one-tap quick missions. Finishing one (or a daily mission) can stir up a battle (`G.missionBattle`: at most 3 a day, never when HP is under 25%). Reminders 20/15/10/5/2 minutes before a due time.
  - **Merlin** (level 3): Merlin's Eggs, below.
- **Mood check-ins** (`js/05l-mood.js`): now and then while you walk, up to 3 a day; moods show on Profile. Switch off in Settings.
- **Themes:** Night (violet and orange) and Lime (black, lime and yellow), in Profile → Settings.
- **Shop:** Avatars, Weapons (melee and defense), **Ranged & Magic**, Potions / Food, Pets. **Inventory:** Worldkey, Weapons, Ranged & Magic, Potions, Pets, Avatars, Artifacts.
- **Ranged & Magic** (one family: everything you throw, shoot or cast): ranged weapons; **battle magic** (32, instant, doesn't use your turn, once per battle each); **charms** (24, wear up to 3, passive perks such as +8% crit, more loot or +10% max HP). Bought once and kept forever; nothing runs out.

### Merlin's Eggs: walk to hatch (`js/02d-merlin.js`, `js/05e-merlin.js`, `js/07h-merlin-ui.js`)

- **Get an egg:** one a day from Missions → Merlin, when Merlin finds you on the road, eggs by the road, a quarter of the creatures you beat, every guardian (Crystal) and every roaming boss. The nest holds 3 (`D.NEST_MAX`).
- **Walk to hatch:** every live step warms every egg in the nest. Frost 3,000 steps, Ember 6,000, Crystal 12,000. Eggs never expire, never break and are never lost in battle.
- **Knowledge Check:** hatching asks one question from the 945-question bank. Right pays ×1.5 coins and XP, and a Crystal Egg adds a weapon or pet you don't own. Wrong still hatches and shows the answer.
- **History Note:** every hatch ends with a short history fact (`D.HISTORY`, about 150, no repeats until all are read).

### The Worldkey (`js/02g-worldkey.js`, `js/05g-worldkey.js`, `js/07j-worldkey-ui.js`)

Wakes when you finish Rust Hollow, with a full charge. Opening a new world needs:

- **Destination:** the world is discovered (level + previous world explored).
- **Resonance:** repeat the world's symbol pattern once (gets longer and faster with your level; unlimited tries). It holds until that world is open.
- **Energy:** 25% / 50% / 80% by world tier. **Charge it directly with artifacts** (Inventory → Worldkey → Charge): each copy gives +10%, +20% or +30% by the tier of its world. Energy never fades.
- **18 Worldkeys:** the Rookie, plus 17 more to buy from level 3 (800 coins) to level 52 (15,000), each with its own look and personality (Inventory → Worldkey → Worldkeys).

## Changes in 3.3.9

- Shop and Inventory simplified. Ranged weapons and battle magic are now used up: you hold at most 10 of each (`D.STACK_MAX`). One throw, shot or cast uses one.
- First buy unlocks the item with a full 10. After that, one **Refill** button opens a sheet with a − / + stepper, a **Fill to 10** shortcut, the price per shot or cast, and a live total. The old "[number] each - buy in bulk" and pack text is gone.
- Every ranged weapon and battle magic card shows a count badge (for example 7/10). Full items say **Full**; empty ones are marked in red.
- Only melee weapons and shields wear and need repair. Ranged weapons no longer wear. In battle, an empty ranged weapon can't be used (Throw is disabled and the Gear list says Refill it in the Shop).
- Removed the pictures of the currently equipped weapon and magic from the Shop and Inventory pages. Melee and Shields now switch with plain text tabs.
- Tuning: refill price per shot is the weapon's price / `D.AMMO_DIV` (25), per cast the item's price / `D.MAGIC_DIV` (10), minimum 1 coin (`js/05n-gear.js`). Older saves are upgraded automatically: owned ranged weapons start full and any magic over 10 is trimmed to 10.

## Changes in 3.3.8

- Merlin's Eggs: rewrote "How it works" as five numbered steps (collect, walk, hatch and answer, prize, colors) that say plainly where eggs come from, that every step warms all eggs at once, the step goals, and what a right or wrong answer does.

## Changes in 3.3.7

- Battle menu buttons are taller (about 66-68px, up from 46px on phones) and size to their copy, so the move name and sub-label no longer touch or spill past the button edges. Defend and the special leave room for their gauge strip.
- The portrait battle menu may now use up to ~44% of the screen (was ~38%), so the taller buttons need less scrolling.

## Changes in 3.3.6

- **Fix: potions drunk in battle were never used up** (only potions given to a pet were counted). Every potion now comes out of your bag; the battle log says how many are left, and Items turns off at 0.
- Battle move buttons: the move name uses the same font as the fighters' names.

## Changes in 3.3.5

- **Light theme** replaces High contrast (saves that used it switch to Light). Lavender paper, deep violet, teal and amber accents; filled buttons carry white text. Checked with `tools/contrast_audit.js`, which opens every screen in a headless browser and measures each visible text against its real background: 0 failures at WCAG 2.1 AA (Section 508). Panels over the game art are nearly solid in this theme.

## Changes in 3.3.4

- **Green Downs:** the sky layer had five moons painted into every 384px tile, so a row of moons showed across the screen. They're painted out; the upper sky is rebuilt from a clean strip of the same dithered gradient, so it still tiles seamlessly.

## Changes in 3.3.3

- **Elemental eggs for Merlin:** five new egg families, each laid in one of 10 colors (50 in all, animated): Sprout (common, 4,000 steps), Tide (uncommon, 5,000), Flame (uncommon, 7,000), Prism (rare, 10,000) and Shadow (epic, 15,000; a right answer adds a weapon or pet, like the Crystal Egg). The original Frost, Ember and Crystal eggs stay.
- **Egg collection** on Missions → Merlin: every color, a silhouette until you hatch it. Hatching a new color says so.
- Art: `assets/egg/<family><1-10>.png`, 8-frame strips at full resolution, built by `tools/add_eggs.py`.

## Changes in 3.3.2

- **Pet roles in battle** (`D.PET_ROLES` in `js/02-data.js`). Every pet still takes its share of each hit, and each now has a role:
  - **Attackers** (26) dart in and hit the creature after your moves.
  - **Shooters** (24) fire pixel projectiles: feathers, venom, fire, stones, magic orbs (they pierce guards), sparks and water.
  - **Healers** (8) restore 5–9% of your HP each turn while you're hurt.
  - **Guardians** (20) only defend, with a 15–32% chance to jump in front of a hit and take most of it.
- Shop and Inventory pet cards say what each pet does.

## Changes in 3.3.1

- **New pet: Onyx**, a collared black cat (level 8, 1,600 coins). Swipes at the creature after each of your moves. Built by `tools/add_cat_pet.py`.
- **One pet per level:** no two Shop pets unlock at the same level any more. Pets keep their old order and prices; the ones that shared a level move to the next free one, so a new pet now arrives at every level from 2 to 65.

## Changes in 3.3.0

- **Items run out:** battle magic comes in packs of 10 casts (hold up to 30) and charms last 20 battles; restock either from the Shop or Inventory. Potions and food are still bought one at a time and used once. Older saves get one free pack of everything already owned.
- **Wear and repair:** melee weapons, ranged weapons, shields and belts lose condition as you use them; strength follows condition down to 50%. Repair one item or everything at once in Inventory (rules in `js/05n-gear.js`).
- **Mobs:** from level 6, about 1 in 6 fights is a mob of 2–3 creatures. You fight the front one; the ones behind are weaker and attack 60% of rounds. Rewards scale with the mob's size.
- **Guardian rematches:** beaten guardians show a Rematch button on the world map. Rematches pay half and a 25% chance of a Crystal Egg.
- **Themes:** Ocean, Ember and High contrast (every text pair at least 4.5:1, borders and focus at least 3:1).
- **Worlds:** Duskfall Range replaces Canopy Vale and Sunken Ruins replaces Leeward Shore (same ids, so progress carries over); Dusk Metropolis is new. Built by `tools/add_new_worlds.py`.
- Missions → Merlin no longer shows a stray "Answered right" tally.

## Changes in 3.2.3

- Worldkeys show in full color once you reach their level.
- Shorter instructional copy throughout.
- Leaderboards and the Profile → Ranks tab were removed.

## Changes in 3.2

- **Magic items are back:** 32 battle magic items and 24 charms, now in a merged **Ranged & Magic** section of the Shop and Inventory. In battle, **Gear & Magic** swaps weapons and casts magic from one menu. Nothing runs out.
- **Spark Bomb:** its sprite sheet was sliced as 9 frames of 35 px instead of 5 frames of 63 px, which cut it off in the Shop and in battle. Fixed in `js/assets.js`.
- Profile tabs show "Awards" on phones so four tabs fit.

## Changes in 3.1

- Removed in 3.0 and still gone: field missions, Merlin's walking quests, egg trades, the Darkmatter Forge (artifacts charge the Worldkey directly), Worldkey fading and tuning drift, shots / magic uses / weapon wear / repairs, the mission mix card and the Field theme.
- Brought back in 3.1: the 17 extra Worldkeys, the Druid, roaming bosses, Redhood Rival, merchants, travelers and deliveries, milestones (now on Missions → Today), battles after finishing missions, mood check-ins and the Lime theme.
- Battle screen: bigger stage, shorter scrollable menu.
- Profile step chart: streak days, today and other days now use three clearly different colors in every theme, and today's bar is striped.
- Old saves upgrade automatically: carried eggs move into Merlin's nest, and magic items are refunded in coins.

## Project layout

```
index.html               app shell
manifest.webmanifest     PWA manifest
sw.js                    service worker (offline cache)
css/style.css            all styles
js/assets.js             sprite sheet sizes and frame counts (generated)
js/00-util.js            helpers, storage, event bus
js/01-icons.js           hand-drawn pixel icons
js/02-data.js            worlds, creatures, avatars, pets, weapons, potions, daily missions, achievements, encounters
js/02d-merlin.js         Merlin's eggs, his lines and the History Notes
js/02e-quiz.js           the 945 Knowledge Check questions
js/02g-worldkey.js       Worldkey numbers, tuning symbols, the Rookie's dialogue
js/02h-quick.js          quick missions and mission types
js/03-state.js           save data, migration of older saves
js/04-steps.js           step tracking, sound and music
js/04b-health.js         Apple Health / Health Connect sync (installed app)
js/05-game.js            core rules: rewards, levels, streaks, daily missions, encounters, shop
js/05b-battle.js         battle rules
js/05d-custom.js         your own missions
js/05e-merlin.js         Merlin's eggs: nest, hatching, Knowledge Check, History Notes
js/05f-druid.js          the Druid's Knowledge Challenge
js/05g-worldkey.js       Worldkey: tuning, charging with artifacts, opening worlds
js/05h-remind.js         mission reminders and the alert bell
js/05i-artifacts.js      artifact collection and copies
js/05j-unlocks.js        feature unlocks
js/05k-quick.js          quick missions, the mission log, battles after missions
js/05l-mood.js           mood check-ins
js/06-engine.js          canvas renderer
js/07-ui.js              screens, HUD, sheets, toasts
js/07b-battle-ui.js      battle screen
js/07e-custom-ui.js      My missions screen
js/07f-tour.js           tutorial and unlock cards
js/07g-celebrate.js      confetti and celebration lines
js/07h-merlin-ui.js      Missions → Merlin and the hatching card
js/07i-loading.js        loading screen
js/07j-worldkey-ui.js    Worldkey screens
js/07k-quick-ui.js       quick missions card
js/07l-mood-ui.js        mood check-in card and Profile moods
js/08-main.js            startup, onboarding, developer panel
assets/                  art, sound, music, fonts, icons
native/                  Capacitor project for the iPhone / Android app (step sync)
tools/                   asset and release scripts
```

## Shipping updates

Before every deploy, stamp a new version:

```bash
python3 -I tools/stamp_version.py 3.0.1
```

It writes the version into `index.html` (`WB.VERSION`, and `?v=` on the stylesheet and every script) and into `sw.js` (the `CACHE` name and the matching precache URLs). Versioned URLs mean a phone can never run old cached scripts with a new page. The page itself is revalidated with the server on every launch, the app checks for a new version each time it's reopened, and when one has installed it reloads once at a safe moment (never mid-battle, in a sheet, the tutorial or sign-up) and shows an "Updated · Step Quest 3.0.1" note. The running version is at the bottom of Profile → Settings.

**The installed iPhone/Android app** (built from `native/`) carries its own copy of the web files: after changing the game, run `npm run sync` in `native/` and rebuild it in Xcode or Android Studio (or re-run the Android workflow). Deploying to GitHub Pages doesn't update it.

Saves from earlier versions upgrade automatically. Auras and dyes were retired in 2.0; players who bought them get their coins back. Since 2.2 worlds open by level; worlds a player already unlocked stay open.

## Saves

Progress is stored on the phone (browser local storage, or the installed app's storage). Clearing site data or uninstalling erases it. There are no accounts and no server.

## Credits and licenses

See `CREDITS.md`. The art comes from CraftPix.net free packs. Check their license before you redistribute the assets or ship commercially.
