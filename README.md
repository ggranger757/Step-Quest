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

- **Walkers.** At sign-up you pick one of three starters; it's the only walker you have at level 1. The other two open at level 5 for 1,500 coins. The rest unlock with levels, streaks, steps and exploring, and are always bought with coins.
- **Worlds (50).** Each opens with a level and the world before it 100% explored, and then through your **Worldkey**.
- **On the road** (`D.ENCOUNTER_WEIGHTS`): creatures (half want a fight, from level 3), supply crates, artifacts, **merchants** (cheap tonics), **travelers** (deliveries: walk N steps), **Merlin** with an egg, an **egg** by the road, the **Druid** (from level 3) and, from level 20, rare **roaming bosses**. **Redhood Rival** can appear in any fight once battles open. Each world's **guardian** wakes at 100% explored and guards a Crystal Egg.
- **The Druid** (`js/05f-druid.js`), the quick NPC: one trivia question. Right pays XP and coins; wrong means a battle. Your eggs are always safe.
- **Roaming bosses** (6) and **Redhood Rival**: scaled to your level, each with its own magic, ability and dialogue. Beating a boss pays big and drops an egg; losing costs 2 levels.
- **Battles** (from level 3): Strike, Throw/Shoot/Cast, Defend, Items, **Gear & Magic** (swap weapons and cast battle magic in one menu), Special attack (level 10), Run. Gear never runs out or wears down. On phones the menu is capped at about 38% of the screen and scrolls, so the stage stays big.
- **Missions:** three tabs.
  - **Today:** daily reward, three daily missions, **deliveries**, two **milestones** at a time (long-term goals, `D.MILESTONES`, from level 3) and the walking streak with Streak Shields.
  - **My missions:** your own to-dos plus one-tap quick missions. Finishing one (or a daily mission) can stir up a battle (`G.missionBattle`: at most 3 a day, never when HP is under 25%). Reminders every 45 min in the last 3 hours, then 20/10/5/2 min, at the due time, and every 45 min while overdue.
  - **Merlin** (level 3): Merlin's Eggs, below.
- **Mood check-ins** (`js/05l-mood.js`): now and then while you walk, up to 3 a day; moods show on Profile. Switch off in Settings.
- **Themes:** Night (violet and orange) and Lime (black, lime and yellow), in Profile → Settings.
- **Shop:** Avatars, Weapons (melee and defense), **Ranged & Magic**, Potions / Food, Pets. **Inventory:** Worldkey, Weapons, Ranged & Magic, Potions, Pets, Avatars, Artifacts.
- **Ranged & Magic** (one family: everything you throw, shoot or cast): ranged weapons; **battle magic** (32, instant, doesn't use your turn, once per battle each); **charms** (24, wear up to 3, passive perks such as +8% crit, more loot or +10% max HP). Bought once and kept forever; nothing runs out.

### Merlin's Eggs: walk to hatch (`js/02d-merlin.js`, `js/05e-merlin.js`, `js/07h-merlin-ui.js`)

- **Get an egg:** one a day from Missions → Merlin, when Merlin finds you on the road, eggs by the road, a quarter of the creatures you beat, every guardian (Crystal) and every roaming boss. The nest holds 3 (`D.NEST_MAX`).
- **Walk to hatch:** every live step warms every egg in the nest. Frost 3,000 steps, Ember 6,000, Crystal 12,000. Eggs never expire, never break and are never lost in battle.
- **Knowledge Check:** hatching asks one question from the 945-question bank. Right pays ×1.5 coins and XP, and a Crystal Egg adds a weapon you don't own. Wrong still hatches and shows the answer.
- **History Note:** every hatch ends with a short history fact (`D.HISTORY`, about 150, no repeats until all are read).

### The Worldkey (`js/02g-worldkey.js`, `js/05g-worldkey.js`, `js/07j-worldkey-ui.js`)

Wakes when you finish Rust Hollow, with a full charge. Opening a new world needs:

- **Destination:** the world is discovered (level + previous world explored).
- **Tuning:** every Worldkey tunes with its own mini-game (see below). Its tuning gauge drains from full to empty over 2 hours (`K.TUNE_HOURS`); the Worldkey page shows the gauge, never a countdown. A newly discovered world also needs its own tuning, played after you discover it. An in-tune key finds artifacts 25% more often.
- **Energy:** 25% / 50% / 80% by world tier. **Charge it directly with artifacts** (Inventory → Worldkey → Charge): each copy gives +10%, +20% or +30% by the tier of its world. Energy never fades.
- **18 Worldkeys:** the Rookie, plus 17 more to buy from level 3 (800 coins) to level 52 (15,000), each with its own look and personality (Inventory → Worldkey → Worldkeys).

## Changes in 3.7.2
- No shield or belt equipped: you can't block. Defend is greyed out ("No shield or belt"), there's no shield gauge, and every hit takes your full HP. The first-battle tip points new walkers to the Leather Belt in the Shop.
- A broken shield or belt (its gauge ran out) does nothing until it's back: no block and no armor, so hits take your full HP ("You take 15 damage (your shield is broken)").
- Duels: a walker with no shield or belt blocks 0% too.

## Changes in 3.7.1
- Defending always lets some damage through to your HP: your share is what your shield or belt doesn't block (1 − Block %, at least 1 HP). Better shields let less through. The Defend button shows both ("Block 80% · you take 20%").
- Tempered Ward is now a hard block (95%, and it still doesn't drain the shield gauge) instead of a perfect block. A Mirror or a guardian pet can't take the last point either.

## Changes in 3.7.0
- **Shield gauge.** Your shield (or belt, or bare guard) has its own HP bar on your battle plate. While you Defend, your Block % of every hit comes out of the gauge instead of your HP, and the bar lights up. If the gauge runs out your guard breaks: no Defend for 2 turns, then it comes back at half. Rounds you don't defend refill 12% of it.
  - Gauge size: your max HP × the shield's block × its condition × 0.9 (no shield: 25% of max HP). Better shields and repaired shields last longer; the Gear menu shows each shield's gauge.
  - Shield Polish and Bulwark Brew also refill 10% / 20% of the gauge. Smith's Oil refills 60% and fixes a broken guard. Tempered Ward's perfect block doesn't drain it.
  - Rules: `B.guardMax`, `guardRound`, `enemyHit` in `js/05b-battle.js`; constants `D.SG_*` in `js/02-data.js`.
- **Redhood Rival keeps pace with you.** Her attack follows your weapon (about 80% of your Strike, never weaker than before) and her HP follows yours. About a third of her attacks copy your last attack for exactly the damage you just dealt ("Redhood copies your Rusty Sword!"). Constants `D.RIVAL_PACE`, `D.RIVAL_HP`, `D.RIVAL_MIRROR`.
- **Choose your target in a mob.** Tap a creature on the stage, or one of the mob rows on its plate, and it steps up to the front so your attacks hit it. Choosing is free (it doesn't use your turn). A gold arrow marks your target. `B.target(i)`.

## Changes in 3.6.2
- Battle: the pet special meter under your pet (for example "Rally") is gone. Pet specials still go off on their own.
- Worldkey page: the "Tunes with …" line under the gauge and on each key is gone.

## Changes in 3.6.1
- The Duel nearby sheet no longer explains who shows as the boss on which phone.

## Changes in 3.6.0

### Duels nearby: battle another walker (`js/04d-link.js`, `js/05q-duel.js`, `js/07p-duel-ui.js`)
- **World page → Duel nearby** (from level 3, when battles open). One phone hosts and shows an invitation QR; the other joins, scans it and shows a reply QR; the host scans the reply and the phones are linked. Each code can also be copied and pasted if scanning fails.
- **The phones talk directly** over a WebRTC data channel: no account, no server, no Firebase. The two phones need to be on the same Wi-Fi, or one shares a hotspot. A public STUN server is used only to discover addresses.
- **On each phone, the other walker is the boss**: they stand on the enemy side, drawn bigger with a red glow, in their own avatar, skin tone and outfit colours, with a boss plate ("Lv X · Boss"), a "Boss Duel" intro and epic boss music.
- **Simultaneous turns**: both pick Strike, Shoot, Defend, or their class Special (when charged) within 20 seconds (no pick means Defend). The host's phone resolves the turn and both screens play the same result. Defend blocks your Block %, Specials punch through half of a block, Arcane Nova stuns for a turn, Life Drain heals, pets help by their role. After 25 turns, the higher HP % wins.
- Full HP for both, and nothing is used up: no ammo, potions, magic or gear wear.
- **Rewards**: your first 5 duels a day pay coins and XP (win 80 + 60 XP, draw 40 + 30, loss 25 + 20). Your won/lost/drawn record shows on the versus card.
- Rematch (both tap it), Give up (tap twice), Leave. A lost connection calls the duel off with no result.
- Everything the other phone sends is checked and clamped (`G.duelClean`), so a bad message cannot break or rig a duel.
- **Native app**: the Android manifest gets the CAMERA permission for scanning inside the app (`npm run sync` adds it); iOS already has the camera description. The privacy page mentions duels.
- QR libraries (`js/vendor/`) load only when a duel starts. Credits are in CREDITS.md.

## Changes in 3.5.6

- **Redhood Rival redrawn in the walkers' art style** (`tools/make_redhood.py` → `assets/cr/redhood.png`). She was a small, blocky sprite scaled up 1.75×; she's now built from the hooded starter's 128 px sheet (same crisp outlines, shading and animation: idle, walk, run, attack, hurt) with a scarlet hood and cloak, a cream robe and a cherry-wood staff, drawn at the same size as your walker.

## Changes in 3.5.5

- On the Worldkey card the tune link (Tune to…, Retune…) now sits right under the Tuning gauge, aligned to its right edge, instead of floating alone between the details and the buttons. The Worldkeys button takes the full bottom row; Charge and Open still appear there when they're the next step.

## Changes in 3.5.4

- Battle menu: **Gear & Magic** is back at the top (full width) and the **special attack** sits where Gear & Magic was, below Defend and Items, still full width with its charge bar.
- **Tertiary links (Tune now, Tune to…, Retune…) are underlined line by line.** The underline is drawn under the label itself, so it's centered and, if a label ever wraps, every line gets its own aligned underline instead of one mismatched line.

## Changes in 3.5.3

- **Defend works like most RPGs.** Defend, and until your next turn every hit is cut by your **Block %**, shown right on the Defend button. Block comes from your shield or belt (Round Buckler 65% up to 90% for the legendary aegises; no shield 35%), drops as the shield wears (down to half), and is capped at 90% (`D.BLOCK_MAX`). Quakes are harder to block (half as well). Shields still shave their armor off every hit. There's no Defend gauge any more: nothing to refill, nothing breaks, you can always defend, and defending never heals.
- Shield items now make Defend stronger: **Shield Polish** +10% block and **Bulwark Brew** +20% block for the rest of the battle, **Smith's Oil** repairs the shield (so it blocks like new), **Tempered Ward** perfect block for 3 turns, **Guard Rune** keeps you on guard for 3 turns even while you attack, **Thorned Bulwark** throws back 60% of what you block. Charms: **Tower Sigil** +10% block, **Bulwark Sigil** makes your next attack after a Defend hit 30% harder.
- **Shield Wall is gone.** Guardian pets' special is now **Rally** (rock pets: **Stone Skin**): you take 30% less damage for 3 turns.
- **Redhood Rival turns up more:** 22% of fights on the road (was 8%), and always after 7 fights without her (`D.RIVAL_CHANCE`, `D.RIVAL_PITY`). World map Rematches are her a quarter of the time (`D.RIVAL_REMATCH`).

## Changes in 3.5.2

- **Quest photos work the same on iPhone and Android** (`js/04c-photo.js`):
  - **Installed app:** the native camera (`@capacitor/camera`, added to `native/package.json`) opens straight to the rear camera, never the photo library. It asks for camera access once; if you said no, the quest tells you where to turn it back on (iPhone: Settings → Step Quest → Camera; Android: Settings → Apps → Step Quest → Permissions). `npm run add` / `npm run sync` now writes the iPhone camera permission text to `Info.plist` (without it iOS closes the app when the camera opens) and the Android 11+ camera-app `<queries>` entry to `AndroidManifest.xml`. Run `npm install` in `native/` once to get the camera plugin.
  - **Browser / home-screen app:** the camera file input opens the rear camera in iPhone Safari and Android Chrome.
  - Every photo is shrunk on the phone to a 240 px JPEG thumbnail (a 12-megapixel photo takes about 0.1 s), turned upright from its EXIF rotation, and kept only on the quest. HEIC photos the browser can't open, non-images and unreadable files each get a plain message instead of failing silently. Cancelling the camera does nothing.
  - **Old photos don't count:** a picked file's time is the earlier of its file date and its EXIF "taken" date, so a gallery photo can't pass as new even on phones that re-date picked files.
  - The privacy page in the installed app now says what happens to quest photos.
- Quest cards and the state bird screen label both pictures: "Your photo" and the bird's name.

## Changes in 3.5.1

- **Pets are bought, never handed out.** Every pet that used to arrive free (streaks, step counts, guardians beaten, the day-7 daily reward, a Crystal Egg's prize) now only unlocks and is bought in Shop → Pets. The daily rare day pays 600 coins and an Elixir instead, and a Crystal Egg's right answer adds a weapon. Pets you already have keep.
- **51 state birds** (`tools/make_state_birds.py` → `assets/pet/sb_<state>.png`, `js/02m-birds-art.js`, `js/02m-birds.js`): one pixel-art pet for every state and DC, with idle and hop animations like the other pets. 29 species are drawn from four body plans with their own marks (crests, masks, caps, bibs, breast colors, spots, wing bars, tails, bills); states that share a species get their own pose and a two-color leg band. Each has a battle role by species: game birds and the Nēnē guard, the Roadrunner, Yellowhammer, Thrasher and Cardinal attack, thrushes, bluebirds, the Chickadee and the Robin heal, water birds splash, the rest flick feathers. They can't be bought: Shop → Pets lists them under **State birds** (silhouettes until you have one).
- **State bird Quests need a photo of the bird.** "I spotted it" is gone. Walk, tap **Photograph the bird**, then say which state you're in: that state's bird joins your pets (or, if you have it, the quest pays coins only). The quest card shows your photo next to the bird you got. "I'm not in the US" turns it into a nature photo instead. State flower quests are retired.

## Changes in 3.5.0

- **Walkers are never handed out.** A level, streak, step count or explored world only unlocks a walker; you always buy it in Shop → Avatars. The 16 walkers that used to be free on a level-up now have prices (level × 160, streak 1,200 + 260 a day, steps ÷ 40, explored worlds 4,500; `js/02-data.js`). Walkers you already got keep.
- **The Worldkey no longer lives on the world page.** Its lines still pop up there, and every bubble now shows the key in use beside what it says (`js/07n-wkchat-ui.js`).
- **Defend never heals you, and the shield takes every hit.** While you defend, the whole hit comes off the shield's Defend gauge and you take nothing, even if the hit breaks the guard. A worn shield or bare hands lose more of the gauge per hit, and a quake costs it 1.5×. The 6% HP you used to get from Defend is gone; the Aegis of the Last Road refills its gauge instead of your HP. Shield Polish, Smith's Oil, Bulwark Brew, Tempered Ward and the Guard Rune only ever restore the shield, and now say so.
- **Pets do one job each, and every pet has a special** (`D.petSpecial`, charged by 3 of your moves, fired on its own; the battle plate shows the charge):
  - Attackers and shooters **only attack** (they no longer take hits for you). Specials: Frenzy (3 hits) or a 3-shot volley that pierces guards (Feather Storm, Venom Spray, Firestorm, Rockslide, Arcane Barrage, Chain Spark, Tidal Burst).
  - Healers **only heal**, you and themselves. Special: Renewal (you +20%, itself +40%, clears poison and burns).
  - Guardians **only defend**: they're the only pets that take part of your hits. Special: Shield Wall / Stone Wall (takes the next 2 hits for you completely).
  - Since attackers and healers don't hide behind you, creatures sometimes go for them directly (`D.PET_TARGET` 18%).
- **Quests are back** on Missions → Today (`js/02l-quests.js`, `js/05p-quests.js`, `js/07o-quests-ui.js`): 3 at a time, a fresh set every 24 hours, coins only, and every one is done on foot: a walk, exploring more of the world you're in, a walk that ends with a nature photo (a tree, water, moss, an insect…), or a walk where you look for your state bird (all 50 states and DC; "I'm not in the US" swaps it for another nature photo). Photos are taken with the phone's camera, must be taken during the quest (older gallery photos don't count), and are kept only as a small thumbnail on the quest. Quests count in Claim all, the Missions badge and the Mission complete note.

## Changes in 3.4.0

- **Every Worldkey has its own tuning game** (`js/02j-wkgames.js` data, `js/05o-wkgames.js` rules, `js/07m-wkgames-ui.js` screens). The rules engine runs each attempt as a session and judges every tap, flip and dial turn with its own clock; the screen only shows it. Only a session it judged a win can tune the key, once, for the key that played it.
  - **Echo** (repeat the pattern): the Rookie (classic symbols), Classic (circuit glyphs), Marmalade (memory shards), Parchment (case clues). The three new sets have their own shapes, a color per symbol and their own notes.
  - **Mirror Pairs** (peek, then match every pair before you run out of misses): Bluebell (constellations), Blossom (blossoms), Fernlight (field specimens), Sugarplum (the silver service). 6 / 8 / 10 pairs by level.
  - **Pulse** (tap as the ring meets the target): Twilight (random swing), Patriot (LEFT / RIGHT drill), Starshine (speeds up), Regalia (long-short fanfare). Too-early taps count as misses, so mashing never wins.
  - **Waveform** (turn the dials until your signal lies on the world's, then hold it): Static, Alarm Bell (a nervous shiver), Coral Reef (a slow swell). Height dial from level 12.
  - **Ring Lock** (stop each spinning ring with its notch on the mark): Night Ember, Tidepool (calmer), Dune.
- **Tuning is per key and drifts over 2 hours.** The Worldkey page, the new-world gate and the Worldkeys list show a tuning gauge (In tune / Drifting / Out of tune) instead of a time. Switching keys switches gauges. **Every new world needs a tuning played after you discover it** before it opens. Old saves keep their latest tuning.
- **The Worldkeys talk** (`js/02k-wkchat.js`, `js/07n-wkchat-ui.js`): a small key sits at the top right of the world page (with its gauge); tap it to talk. It greets you by time of day, chats while you walk and at every 1,000 steps, fills long silences, reacts to battles, artifacts, crates, level-ups, milestones and your daily goal, and when it's out of tune its screen fills with static and it asks to be tuned. About 27 new lines per personality. Never over a battle, sheet, card or the tour; Profile → Settings → **Worldkey chatter** turns it off.
- **Worlds must be 100% explored** before the next one is discovered (`D.WORLD_GATE_PCT`, was 75%). Worlds already opened stay open; a discovered-but-unopened world whose previous world isn't finished waits until it is.
- **Rematch is a random fight** from that world (World map → Rematch): one of its creatures, a mob of them (from `D.MOB_LEVEL`), or the guardian about 1 time in 5 (`G.makeRematch`).
- **Egg collection counts the classic eggs.** Frost, Ember and Crystal now have their own row (53 in all). Before, only elemental colors were recorded, so classic eggs you hatched never showed. Saves whose hatch count is higher than their recorded colors get the Frost Egg back (every walker's first egg); which other classic eggs were hatched before wasn't saved.

## Changes in 3.3.14

- **Shield items.** New things that work on the Defend gauge (your shield's or belt's HP in battle):
  - Potions, in a new Shop → Potions → **For your shield** section (battle only): **Shield Polish** (level 3, 90 coins) refills half the gauge and mends a broken guard; **Smith's Oil** (level 6, 150) repairs your shield or belt by 30% condition mid-fight, so a worn shield catches more of each hit, and refills 20% of the gauge; **Bulwark Brew** (level 12, 240) makes the gauge 50% bigger for the rest of the battle, with the extra full.
  - Battle magic: **Tempered Ward** (level 9) for 3 turns your shield catches every hit in full, even worn, and the gauge loses only half of it; **Thorned Bulwark** (level 13) for 3 turns 60% of what your shield absorbs is thrown back at the creature.
  - Charm: **Tower Sigil** (level 11) makes your Defend gauge 30% bigger in every battle.
  - The battle plate shows "Hard shield" and "Spiked shield" while they last; potions show "Shield +N", Thorned Bulwark shows "Thorns!". Icons are recolors of existing art (`/assets/pot/polish|smithoil|bulwarkbrew.png`, `/assets/mg/tempered|thornwall|tower.png`).
- **No more 10 cap** on ranged weapons and battle magic: buy as many as you like. The first buy still comes with 10 (`D.FIRST_PACK`); `D.STACK_MAX` is now 999, only a sanity limit. Cards show a count (×45) and a **Buy more** button; the buy-more sheet has −/+, **+10**, **+25** and **Max you can afford**, and starts at 10. A shot never costs more than 90 coins (`D.UNIT_MAX`), a cast never more than 50 (`D.MAGIC_UNIT_MAX`).
- **Magic is cheaper:** every battle magic item and charm costs 40% less (`D.MAGIC_PRICE` 0.6, e.g. Guard Rune 950 → 400, Book of Magic 2,500 → 1,050), and a refilled cast is the price / 12 instead of / 10.
- **Merlin's egg thumbnails are all the same size.** The two egg art packs use different frame sizes and padding (a shadow egg filled 70% of its frame, a sprout egg 94%, classic eggs 100%). `tools/egg_boxes.py` measures each egg's body (ignoring sparkles) into `js/02i-eggbox.js`, and `WB.eggImg` scales every egg so its body fills 86% of the thumbnail. This applies everywhere eggs show (nest, collection, hatching, toasts).
- Fixed: a brand-new save could start with 999 Throwing Stars (an old upgrade step filled ranged weapons "to the cap").

## Changes in 3.3.13

- **Fixed: the Druid's Knowledge Challenge buttons did nothing.** Answering him never took him off the road's waiting list. If the walker passed him while you read the question (the road only holds for 10 seconds), or you answered wrong and didn't fight, he stayed on the list already answered, and reopening him gave a card whose buttons were dead. Now an answered Druid leaves the list (`G.answerDruid`); a wrong answer you didn't fight comes back as a Battle the Druid card; an encounter card always clears its old "already resolved" flag when shown; if an answer can't count, the card says so and closes instead of sitting there. Saves with a stuck Druid are cleaned up on load. Merlin's Knowledge Check was checked too and works.
- **Out-of-tune pop-up shows reliably.** While the Worldkey is out of tune (or the next world is discovered and untuned), the Tune now pop-up appears about 4 seconds after you open the app, every time you open it, and every 30 minutes while it stays open, walking or not. Before, after the first pop-up it only reminded you while walking.

## Changes in 3.3.12

- **Tuning pop-up:** when the Worldkey needs tuning (the next world is discovered but not tuned, or its tuning faded after `K.TUNE_HOURS`), a pop-up with **Tune now** appears right away, whether or not you are walking or the key has energy. Before, it only showed while walking and only once the key was fully charged, so most players never saw it. After the first pop-up it still reminds you every 30 minutes while you walk. It waits for battles, sheets and the tour to finish, and skips the moment a new world's gate already asks you to tune (`WK.tuneTick` in `js/07j-worldkey-ui.js`).
- In the background the pop-up also goes out as a phone notification (when notifications are on) and waits in the app for your return. The installed app now schedules an "out of tune" system notification for the exact moment the tuning fades, so it arrives even when Step Quest is closed, and Worldkey notifications now work on the installed app too (`js/05h-remind.js`).
- **Defend is now its own gauge: your shield's (or belt's) HP.** Every battle starts with a full gauge sized by the shield's old block stat, as a share of your max HP (Round Buckler 65%, Aegis of the Last Road 88%, no shield 40%). While you defend, hits land on the gauge instead of your HP. A fresh shield catches the whole hit; a worn one catches less (its condition, down to 50%) and the rest reaches you, and so does anything past an empty gauge. A quake is still too strong to catch fully (half). Each Defend also costs 8% of the gauge; it refills 15% a turn you don't defend (25% with the Bulwark Sigil), and the Guard Rune fills it. When it hits 0 it breaks: no Defend until it is back to 40%. Shields and belts still wear down with use and still shave their armor off every hit. Reverse now bounces back a share of what the shield absorbed; counter is unchanged.
- The gauge shows on your battle plate (Shield / Belt / Guard, cyan, red when broken) and on the Defend button ("Shield 85/111"). Hits on it show "Shield −17", or "No damage" when it caught everything. Shop and Gear show "Defend gauge 65% HP" instead of "Block 65%", and shield descriptions say the same. Constants: `D.GUARD_BARE`, `D.DEFEND_UPKEEP`, `D.DEFEND_REGEN`, `D.GUARD_RECOVER` in `js/02-data.js`; rules in `enemyHit` in `js/05b-battle.js`.
- **Tertiary buttons:** new `.btn.tertiary` style (no fill or frame, accent text with an underline, full 48px touch target). Every tuning button uses it: Tune to / Retune to / Tune ahead on the Worldkey card and the new-world gate, and Tune now in pop-ups. Toast actions accept `action.cls`.

## Changes in 3.3.11 (includes 3.3.10 and 3.3.9)

- Worldkey memory game: the pad now lights up each shape as the pattern plays, at every level (before, the pad stayed dark from level 6, so nothing showed which shapes to memorize). The lit shape is brighter and larger, and the message reads "Memorize the lit shapes…".
- The memory game is offered while you walk: when a discovered world has enough energy but the Worldkey is out of tune, a "Tune now" card pops up (at most every 30 minutes per world, never during a battle, sheet, card or the tour). It opens the game directly. See `WK.tuneTick` in `js/07j-worldkey-ui.js`.

## Changes in 3.3.10 (includes 3.3.9)

- Shop and Inventory simplified. Ranged weapons and battle magic are now used up: you hold at most 10 of each (`D.STACK_MAX`). One throw, shot or cast uses one.
- First buy unlocks the item with a full 10. After that, one **Refill** button opens a sheet with a − / + stepper, a **Fill to 10** shortcut, the price per shot or cast, and a live total. The old "[number] each - buy in bulk" and pack text is gone.
- Every ranged weapon and battle magic card shows a count badge (for example 7/10). Full items say **Full**; empty ones are marked in red.
- Only melee weapons and shields wear and need repair. Ranged weapons no longer wear. In battle, an empty ranged weapon can't be used (Throw is disabled and the Gear list says Refill it in the Shop).
- Removed the pictures of the currently equipped weapon and magic from the Shop and Inventory pages. Melee and Shields now switch with plain text tabs.
- Mission reminders: every 45 minutes through the last 3 hours before a mission is due (3 h, 1.5 h, 45 min), then 20, 10, 5 and 2 minutes, at the due time, and every 45 minutes while it is overdue (up to 3 hours). A mission you just made doesn't announce windows it starts inside.
- Ranged weapons and magic cost 30% less (`D.GEAR_PRICE` 0.7, rounded to 10 coins). A full refill of 10 never costs more than 900 (`D.REFILL_FULL_MAX`).
- The Worldkey drifts out of tune 6 hours after you tune it (`K.TUNE_HOURS` in `js/05g-worldkey.js`). The Worldkey screen shows time left, "Out of tune" and a Retune button.
- Profile → Overview has a Mission types card again: finished missions by type (Body, Mind, Learning, Home, Work & money, Creative, Social, Outdoors, Other) for 7 days, 30 days or all time.
- The missions page no longer lists Recently completed (finished missions are tracked in Profile → Mission types).
- Merlin's eggs: "How it works" is now three short steps inside a collapsible section (closed by default; it remembers if you open it).
- Battle turn timer: hidden for the first 8 seconds of each turn (`D.TURN_GRACE`), then the usual countdown appears and runs.
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

- Removed in 3.0 and still gone: field missions, Merlin's walking quests, egg trades, the Darkmatter Forge (artifacts charge the Worldkey directly), Worldkey energy fading, field missions' wear and repairs, and the Field theme. (Tuning fade, ranged shots / magic counts and the mission types card came back in 3.3.9.)
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
js/02j-wkgames.js        Worldkey tuning games: symbol art, sets, which key plays which game
js/02k-wkchat.js         more Worldkey dialogue (walks, world page, fights, finds, tuning)
js/02l-quests.js         Quests: nature photo subjects, state birds and flowers, coin rewards
js/02m-birds-art.js      the 51 state-bird sprites' boxes and looks (generated by tools/make_state_birds.py)
js/02m-birds.js          the 51 state-bird pets
js/02h-quick.js          quick missions and mission types
js/03-state.js           save data, migration of older saves
js/04-steps.js           step tracking, sound and music
js/04b-health.js         Apple Health / Health Connect sync (installed app)
js/04c-photo.js          quest photos: native camera in the installed app, camera input in browsers, thumbnails
js/05-game.js            core rules: rewards, levels, streaks, daily missions, encounters, shop
js/05b-battle.js         battle rules
js/05d-custom.js         your own missions
js/05e-merlin.js         Merlin's eggs: nest, hatching, Knowledge Check, History Notes
js/05f-druid.js          the Druid's Knowledge Challenge
js/05g-worldkey.js       Worldkey: tuning gauge, charging with artifacts, opening worlds
js/05o-wkgames.js        Worldkey tuning games: the rules (sessions that judge every move)
js/05p-quests.js         Quests: the rules (24-hour sets, walking, photos, claiming)
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
js/07m-wkgames-ui.js     Worldkey tuning game screens
js/07n-wkchat-ui.js      the Worldkey's speech bubbles on the world page
js/07o-quests-ui.js      Quests on Missions → Today
js/07k-quick-ui.js       quick missions card
js/07l-mood-ui.js        mood check-in card and Profile moods
js/08-main.js            startup, onboarding, developer panel
assets/                  art, sound, music, fonts, icons
native/                  Capacitor project for the iPhone / Android app (step sync)
tools/                   asset and release scripts (make_state_birds.py, make_redhood.py draw sprites)
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
