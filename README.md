# Step Quest

A pixel-art walking RPG for your phone. Every real step moves your hero forward through the world. Walk to explore 49 worlds that open as you level up, earn Walk Coins, fight turn-based battles against aggressive creatures and world guardians, collect weapons, potions, food, magic items, pets and artifacts, face rare roaming bosses, and listen to your own music while you walk.

It is a Progressive Web App (PWA): plain HTML, CSS and JavaScript with no build step and no server. Host it anywhere that serves static files over HTTPS, then install it from the phone's browser. The same code also builds into a real iPhone and Android app (see **Automatic step sync**) that reads steps from Apple Health and Health Connect.

## Launch on GitHub Pages

1. Create a new repository on GitHub (for example `stepquest`).
2. Upload everything in this folder to the repository root, including the hidden `.github` folder and `.nojekyll`.
   - On the website: **Add file → Upload files**, then drag in the folder contents. Hidden files may be skipped when you drag, so check that `.github/workflows/pages.yml` is there. If it isn't, use step 3b.
   - Or from a terminal:
     ```bash
     cd stepquest
     git init && git add . && git commit -m "Step Quest 2.4"
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

## Battles

Battles unlock at **level 7** (`D.BATTLE_LEVEL`). Before that, fighting creatures can only be shooed off or snuck past, guardians wait on the map, the Druid doesn't appear yet and no daily battle goals are given. The level-up card announces when battles open.

Some creatures are aggressive. When one blocks the path you can fight or avoid it; fighting opens a 1v1 turn-based battle:

- **Strike** uses your **melee** weapon (swords, daggers, axes, maces, spears, staves). Your walker holds it in hand during the attack. Daggers stab twice, axes sunder (+25% damage taken), maces stun, spears pierce guards and hit harder on the first turn, staves heal or curse, some blades steal life.
- **Throw / Shoot / Cast** uses your **ranged** weapon: throwing weapons arc, knives spin, arrows and the 12 spells (orb, wave and javelin in sun, frost, void and fire) fly straight at the creature. It hits hardest, may poison, burn, bleed, freeze, weaken, drain or volley, then recharges.
- **Defend** has a **guard gauge**: each Defend uses 35% of it and every turn you don't defend restores 15% (`D.DEFEND_COST`, `D.DEFEND_REGEN`), so you can't hide behind your shield forever. The Shop calls the shield slot **Defense**.
- **Defend** uses your **shield**: it blocks 60–85%, and some shields reverse part of the hit back, counter with spikes or heal. Every shield also blocks a little of every hit (armor). Guardians glow red and "charge up" before a heavy attack: defend then.
- **Every creature has five moves** (`D.CREATURE_MOVES` in `js/02-data.js`):
  - **Attack:** a plain hit.
  - **Magic:** its own named spell with its own projectile and impact (Medusa's Stone Throw, the Overthinker's What-If Flame…). 40% of the time it adds an effect (20% if you defended): poison or burn (damage each turn, never below 1 HP), weaken (your hits do 30% less for 2 turns), slow (your ranged weapon takes 2 more turns to recharge) or drain (it heals from the damage).
  - **Defend:** it braces (your next hit does half) and recovers 6% HP; guardians raise a reversing ward instead (30% of your next hit bounces back). Piercing weapons ignore both.
  - **Flee:** below 25% HP (20% for guardians) it may try to run, at most twice. If it gets away you keep half the battle XP but no coins or loot, and a guardian goes back to waiting on the world map. Creatures never flee your very first battle.
  - **Special:** a signature move it charges a turn ahead ("Charging!": defend!), every 4th turn (every 3rd for guardians): a big hit with a stun (you lose a turn; defending stops it), poison, burn, weaken, slow or drain, three quick hits, or a quake that's hard to block.
- **Each world has its own creatures** (`pool` in `D.WORLDS`), three per world picked to suit the place: frost worlds get Medusa, the Orc Raider and the Bog Slime, city streets get the Sentry Drone and the Flying Procrastinator, forests get the Treant and the Bulb Spitter, and so on. The world map shows them on each world's card, under "Creatures here".
- **31 road creatures** (the Mushroom Guard and Naughty Nova were retired), including 16 from the enemies pack: 2Face, Energy Vampire Bat, Flying Procrastinator, Land Alien, Lazy Bat, Little Cthulhu, Medusa, Orc Raider, Self-Doubt Drone, Sentry Drone, Bog Slime and Treant roam the worlds, and four are new guardians: the Distraction Dragon, the Ice Bully, the Overthinker and the Slothful Ogre. Animations a GIF set doesn't include (a lunge for attack, a flash for hurt, sinking for death) are generated from its idle frames by `tools/prep_assets.py`.
- **Pets** fight with you: your pet takes 20–60% of every hit until its own HP runs out, then it's knocked out until its HP refills over time. Every HP change floats over whoever took it as "-N HP" / "+N HP".
- **Items** drinks a potion or eats food. **Magic** uses a magic item (see below). **Run away** may fail.
- Losing costs some coins (about 5–10% of what you carry, capped by the world), costs half of each kind of egg you carry (at least one) and drops your HP to 25%.
- **Walking does not heal.** HP refills on its own, from empty to full in 15 minutes (`D.HEAL_MINUTES`), even while the app is closed, or instantly with a healing potion. Pets recover the same way. A level-up raises your max HP but only tops you up if you were unhurt.
- **Special attacks** (from level 10): the walker picked at sign-up decides which one you get. A gauge on the Special button fills as you attack (Strike +25%, Throw/Cast +30%); when it's full, tap it.
  - **Scavenger – Scavenger's Raid:** a raiding strike (damage grows with level) that snatches a potion from the creature, usable straight away from Items (better loot in later worlds; coins if your bag is full).
  - **Wandering Mage – Arcane Nova:** a blast (damage grows with level) that stuns the creature for 3 turns.
  - **Healer – Life Drain:** drains the creature for 3 turns and heals you with it; 50% more healing while your HP is under half.
- Magic attacks gather energy at the caster's hand, trail sparks, and burst by element on impact (fire and sun explode, frost shatters, void pulses). Every weapon kind has its own impact sound.
- Exploring a world to 100% wakes its **guardian**. Challenge it from the world map. Defeating guardians unlocks the legendary weapons.

Everything you can buy is in the **Shop**, in five sections: Walkers, Weapons, Potions & Food, Pets and Magic. (Trails were retired; coins spent on them were refunded.) Artifacts and achievements live on the **Inventory** tab. The **World map** button sits on the World screen (and in Profile).

**Potions & Food.** Nine everyday potions are sold from the start or unlock by level (Small Tonic, Iron Brew, Fury Draught, Grand Elixir, plus Storm in a Bottle, Ward Cell, Shadow Eye, Sundrop and Fire Crystal from the item pack). 44 more, one for every other flask in the potion pack, are hidden as artifacts in the newer worlds; finding one gives you a bottle and adds it to the shop. Potions heal, cut damage, boost damage, recharge your weapon instantly or explode on the enemy. **Food** is the cheap way to heal: Garden Radish (20%), Orchard Fruit (30%), Smoked Fish (45%), Hearty Steak (60%) and the Candy Jar (a sugar rush that recharges your weapon). Eat it in battle from Items or straight from the Shop. You can carry 9 of each.

**Ranged gear from the item pack** sits in Weapons → Ranged: the Lasso (may rope the creature so it loses a turn), Cherry Bomb (burn), Throwing Axe (bleed), Cannonball (heavy, breaks guard) and Web Snare (weakens) spin through the air like the knives; the Flintlock Pistol is the first **Firearm** and fires a bullet straight through guards.

**Magic items** (Shop → Magic): 55 of them, bought once and kept, in two kinds (`D.MAGIC`, icons from the Magic_items pack in `assets/mg/`):
- **Charms (23)** are worn: up to 3 at a time (`D.CHARM_SLOTS`), each with a passive perk. Examples: Lucky Horseshoe (+8% crit), Explorer's Backpack (more loot), Merchant's Purse (+20% battle coins), Amulet of Vitality (+10% max HP), Ring of Might (+8% damage), Ring of Warding (−8% damage taken), Bulwark Sigil (guard gauge refills faster), Arcane Hat (special charges faster), Soul Gem (first hit halved), Thornweave Necklace (hit back 10%), Scholar's Codex (+15% battle XP), Pendant of Renewal (heal 3% a turn), Void Ring (30% of hits pierce), Circlet of Focus (ranged recharges a turn faster), Hunter's Ring (+15% vs guardians and bosses), Ember Heart (survive one knockout per battle).
- **Battle magic (32)** is used from the **Magic** button: each item once per battle, at most one per turn, and it doesn't use your turn. Heals (Chalice, Heartstone, Phoenix Feather), shields (Stoneskin, Aegis), damage boosts (Ember Gauntlet, Rune of Fury), blasts (Storm Orb, Starfall, Sun Orb), statuses on the creature (poison, burn, bleed, freeze, stun, weaken, guard break), utility (recharge your weapon, refill the guard gauge or special gauge, cancel a charging special, reflect, dodge, Golden Key to escape any battle) and the original Book of Magic, Illusion Ring and Lucky Clover.
Levels and prices run from level 4 (700 coins) to level 60 (20,000 coins).

## Profile stats

Lifetime totals: steps, distance, coins, streak, battles won, **world guardians beaten** (each world's guardian wakes at 100% explored and is challenged from the map), **bosses beaten** (the rare roaming bosses), **Merlin's quests done**, **Knowledge Challenges** (Druid questions answered right, of those taken), worlds, avatars, artifacts and best day. Stats with a dashed border explain themselves when tapped. Distances follow **Profile → Distance units** (miles or kilometers; US English devices start on miles).

## Bosses

From level 20 (`D.BOSS_LEVEL`) six roaming bosses can turn up on the road. They're rare: a small share of encounters, at most one every 90 minutes, and ones you haven't beaten yet show up more often. Each is scaled to your level (about 11 good hits to beat, hits that take roughly 12% of your HP, a special every 3rd turn), has its own magic and a unique ability, and talks during the fight in speech bubbles: an intro, taunts, a line when it's hurt, one for its special, and its last words or a gloat.

| Boss | Magic / special | Ability |
| --- | --- | --- |
| Magmor the Demon Lord | Hellfire Rain (burn) / Infernal Cleave | **Hellborn Rage:** below half HP his hits do 35% more |
| The Hollow King | Soul Siphon (drain) / Night Terror | **Shadow Form:** 25% of your non-piercing hits pass through him |
| Morwen the Dark Fairy | Thorn Hex (poison) / Bramble Bind (stun) | **True Wings:** at half HP she transforms, heals 25%, hits 20% harder and switches to Spirit Swarm / Summon Spirits |
| Ironhide the Golem | Rivet Volley (slow) / Overcharge (quake) | **Iron Plating:** non-piercing hits do 30% less |
| The Bringer of Doom | Grasp of the Grave (drain) / Doom Bell (stun) | **Reaper's Patience:** +40% damage while you're under 35% HP |
| Vesper the Crimson Sorceress | Crimson Bolt (burn) / Blood Moon Barrage | **Crimson Mirror:** raises a ward often, reversing 45% of a hit |

Bosses never flee, and running from one only works 35% of the time (slipping away from the encounter card is a 50/50; fail and it cuts you off). **Win:** XP worth 8% of a level, 150 + 12 × level coins (+250 the first time), a Sundrop or Grand Elixir and a guaranteed egg. **Lose:** you drop 2 levels (`D.BOSS_LEVEL_LOSS`) and some eggs break; worlds, gear and items stay, and levels you win back don't pay level-up coins a second time (`s.peakLevel`). Boss art is in `assets/cr/` (prep: pack 17 in `tools/prep_assets.py`; the Sorceress is mirrored to face you). The Boss_3 upload contained only tutorial videos, so it isn't used.

## Levels and pacing

Levels cap at **100** (`D.LEVEL_CAP`). XP needed per level is `100 × level^1.5`, plus 1.5% per level past 50. Walking earns 1 coin every 40 steps and 1 XP every 50 steps (`COINS_PER_STEP`, `XP_PER_STEP`), so most XP now comes from battles, quests and missions. At around 1,250 XP a day (7,000 steps plus battles and quests) that's about 2 months to level 20, 1.5 years to 50, about 4 years to the last world (level 70) and well over a decade to the cap. Each level-up opens a celebration card listing everything the new level unlocks (worlds, walkers, weapons, pets, magic, potions) and how far the next level is.

## The Druid

From level 7 (when battles unlock) a druid sometimes steps onto the road with a **Knowledge Challenge**: one multiple-choice question from a bank of **945 questions in 20 topics** (history, geography, science, space, the human body, nature, animals, food, sports, language, pop culture, movies & TV, music, video games, books & myths, general knowledge, art, inventions & tech, math, world cultures), in `js/02e-quiz.js`. Questions don't repeat until you've seen them all. Answer right and he pays XP and coins (more at higher levels and in later worlds) and runs off into the trees. Answer wrong and the right answer is shown, then you must battle him: beat him and he flees, lose and he takes **every egg you carry**. You can also walk away from him for no reward. Logic in `js/05f-druid.js`.

## Eggs

Three eggs (`js/05e-eggs.js`): **Frost** (common), **Ember** (uncommon) and **Crystal** (rare; rarer eggs get likelier in later worlds). They turn up on the road as an encounter of their own, a quarter of the creatures you beat were guarding one, and guardians always drop one. You can carry 12 of each. Trade sets to **Merlin** once you've met him on the road (trading stays locked until then); after that, trade from Inventory → Eggs or Missions → Field at any time, or when he finds you again:

| Trade | Eggs | Loot |
| --- | --- | --- |
| Basket of Frost Eggs | 5 Frost | 60 coins, 50 XP, 2 Small Tonics |
| Ember Clutch | 3 Ember | 100 coins, 90 XP, an Iron Brew |
| Crystal Pair | 2 Crystal | 160 coins, 150 XP, a Grand Elixir |
| Merlin's Hoard | 3 Frost, 2 Ember, 1 Crystal | 250 coins, 220 XP and a weapon or pet you don't own yet |

Losing a battle costs you half of each kind of egg you carry (losing to the Druid costs all of them), so trade before a risky fight.

## Missions

The **Missions** tab has four sub-tabs, each showing how many rewards are ready: **Today** (daily reward, daily missions, streak), **My missions**, **Field** (the **600 field missions**) and **Adventure** (the adventure chain and deliveries). Every field mission needs real walking. You pick missions from the board, and from the moment you pick one you have **24 hours** to finish it; only steps walked after that count. If the time runs out, or you drop the mission, you lose coins (half the mission's coin reward) and 15% of your max HP (never below 1 HP), and the mission goes to the back of the board to try again later. A finished mission never fails, even before you claim it.

- **Photo hunts (240):** walk a set number of steps, then the camera opens to photograph something out in the world: an oak leaf, a red door, the letter Q on a sign, your state bird or state flower… Photos are shrunk and kept on the phone in the **photo journal** (IndexedDB). They are never uploaded, and the game can't check what's in them, so photo hunts run on the honor system.
- **Gathering runs (180):** items such as hawk feathers, brass gears or lucky coins turn up along the way as you walk.
- **Timed walks (60):** steps only count inside a window (sunrise, before 10 am, lunch, afternoon, golden hour, evening).
- **Multi-walk missions (60):** take 2–4 separate walks of a set length (a 20-minute break starts a new walk).
- **Distance runs (60):** cover a distance (it uses your stride setting).

The board offers the next four in order. You can run three at a time, and you can skip or drop missions (they go to the back of the line). They get longer as you go, from about 650 steps to roughly 12,000, and every 25th pays a potion too. Set your **home state** (link on the Missions tab) to see your official state bird and flower. Missions live in `js/02c-missions.js`: edit the content lists there to change subjects, items or pacing.

### Merlin's quests

Merlin, a wandering owl-mage, now and then swoops down on the road (from level 2, at most once every couple of hours) and offers one of **300 harder quests**. They use the same five kinds as field missions but ask for far more walking: photo quests after 4,500–15,000 steps (the highest lookout, a bridge you've never crossed, the oldest tree in a park…), gathering 10–26 arcane items, timed walks of 2,700–9,000 steps, 3–5 separate walks of 2,000–4,500 steps, and distance runs of 5–16 km. You get **48 hours**, and they pay **about 150–600 coins and 200–900 XP** (every 10th adds an Elixir). One Merlin quest runs at a time, at the top of Missions → Field, and it doesn't take a field-mission slot. Turning him down, handing a quest back or running out of time costs nothing; he offers it again another day. All quests stay on public sidewalks, parks and trails. Merlin's own music plays only while he is on screen. Quests live in `js/02d-merlin.js`.

### My missions

Players can turn real-life goals into missions. **New mission** offers 15 templates (daily workout, book outline, reading, study session, clean & tidy, meal prep, language or instrument practice, meditate & stretch, budget check-in, journal, job application, creative or coding project, call someone) or **Create your own**. Every mission has a name, optional notes, an optional checklist, a **due date and time** (with Tonight / Tomorrow / In 3 days / Next week shortcuts), a **difficulty** and a **priority**.

Completing one pays coins and XP: the difficulty sets the base (Easy 15 coins / 25 XP, Medium 30 / 45, Hard 55 / 80, Epic 90 / 130), the priority multiplies it (Low ×1, Medium ×1.15, High ×1.3, Urgent ×1.5), and the timing adjusts it: finishing early earns up to +25% (more the earlier you finish), on time pays in full, and late pays half. The form previews the reward. Difficulty and priority are locked when the mission is created, and rewards always use the original due time. Because Step Quest is a walking game, your own missions together pay at most **300 coins and 450 XP a day** (about what 3,000 steps earn; 10,000 steps earn 1,000 coins); past that they can still be completed, without a reward. A mission can be completed once it's 15 minutes old. Overdue missions get a one-time reminder; there is no penalty beyond the halved reward. Templates and numbers live in `js/05d-custom.js`.

## Sound and music

Recorded sounds live in `assets/sfx/` and music in `assets/music/`; `tools/prep_sounds.py <uploads_folder> assets` rebuilds them from the original uploads (it finds each file by its label, trims silence and compresses):

| Moment | Sound |
| --- | --- |
| Drinking a potion or power boost (in battle or from the Shop) | `sfx/potion.mp3` |
| Any purchase (Shop, potions, supplies, merchants) | `sfx/buy.mp3` |
| Equipping an item | `sfx/equip.mp3` |
| An artifact discovery on the road | `sfx/discovery.mp3` |
| Strike (melee) | `sfx/walker_attack.mp3` |
| Throw / Shoot / Cast launch | one of `sfx/projectile_1, _2, _5.mp3` (the weapon's own impact sound plays when it lands; Frost Lash uses `sfx/freeze.mp3`) |
| A creature hits you | one of `sfx/creature_attack_1..3.mp3` |
| Defend | `sfx/defend.mp3` |
| Losing a battle | `sfx/battle_loss.mp3` |
| Level-up, achievement or a finished Merlin quest | `sfx/level_up.mp3` |
| Weapon impacts by kind, bow and spell launches, spell impacts by element, Wind Blade, shield blocks, poison/burn/bleed/stun ticks, the three special attacks | synthesized by `tools/synth_sounds.py` (`sfx/hit_*`, `spell_*`, `status_*`, `special_*`, `bow_release`, `wind_blade`, `shield_block`) |
| First open, from the loading screen until the tutorial ends | `music/app_song.mp3` |
| Battles below level 40 | a random battle track from `music/` (`battle_2/4/6/8`, app song) |
| Battles from level 40 (`D.EPIC_MUSIC_LEVEL`) | `music/battle_epic_1.mp3` (Redemption) or `music/battle_epic_2.mp3` (Cold Fire) |
| While Merlin is on screen | `music/merlin.mp3` |

The app song is the theme: on a first open (or after a reset) it starts on the loading screen and plays until the tutorial ends or is skipped. Browsers only allow sound after a tap, so when autoplay is blocked the loading screen waits with a **Tap to start** button (the native app lets its web view autoplay; see `native/scripts/patch-native.mjs`). Music streams (it isn't part of the offline download). Profile → Settings has one **Sound & music** switch. Browsers only allow audio after a tap, so the welcome song starts on the first tap if autoplay is blocked.

## Celebrations

Level-ups, achievements and every completed mission (daily, adventure, delivery, field, Merlin's or your own) fire a short burst of pixel confetti and a warm message that changes each time: it uses your name, the time of day, today's steps, your streak and what you just did. Confetti waits until a battle is over and is skipped with Reduce motion.

## Tutorial and tips

New players get a guided tour right after sign-up (existing players see it once after updating). It visits every page and highlights each feature: the HUD, the world, today's steps, health, the step counter, objectives, the map, all mission types, every Shop section, the Inventory, battles and the Profile. A **Skip tutorial** button sits at the top of every step (Back on the phone ends it too), and it can be replayed from the **Tutorial** button at the top of Profile (or Settings → Tutorial). While any sheet, battle, the tutorial or onboarding is open, the page behind it can't scroll. A discovery on the road stays on screen for 40 seconds, with a × to close it sooner. The first time a player's HP drops to 35% or below, a one-time tip explains how to heal (wait about 15 minutes, or drink a potion; walking doesn't heal).

## Worlds and levels

There are 49 worlds, and they open **one at a time**: each needs a level (spread from Rust Hollow at level 1 to the Fort of Illusion at level 70, `D.LAST_WORLD_LEVEL`) **and** the world before it explored to 75% (`D.WORLD_GATE_PCT`). The world screen and the map show both requirements, ticking each one off, and roughly how many steps away the next world is. Creatures get stronger in later worlds, and every world has a guardian and a few artifacts to find.

## Walkers and pets

Pets cost 400–5,000 coins and unlock between levels 2 and 20 (some come from streaks, steps, the daily reward or guardians instead). In battle a pet jumps in and takes 20–60% of each hit until its own HP runs out.

At sign-up a player picks one of three classic walkers (Scavenger, Wandering Mage, Healer) and a skin tone. The other two starters, and every other walker (40 in all, including the Knight, the Ranger, and the nine newest: Warrior, Shadow Archer, Ronin, Leaf Ranger, Executioner, Blaze, Huntress, Crimson Duelist and Shadow Knight), are unlocked later with coins, levels, streaks or exploration.


Anything you can't buy or equip yet tells you why when you tap it: how many more coins you need, or the level, streak or world that unlocks it.

Equipped pets walk beside your walker in every world: dogs, cats, rats, birds, desert creatures, woodland animals (fox, hare, deer, boar, black grouse) and pet rocks that hop along behind you.

## Music while you walk

Play music from your own music app (Spotify, Apple Music, anything) while Step Quest is open. Game sounds mix in without pausing it (`navigator.audioSession` is set to ambient where supported).

## Developer mode

The developer panel exists only in **dev builds**: `python3 -I tools/build.py . --dev` (or `STEPQUEST_DEV=1`). In a dev build, open the site with `#dev` at the end of the URL, or tap the version number at the bottom of the Profile screen 5 times, and a **DEV** button appears with tools to add simulated steps and coins, level up, complete missions, unlock worlds and avatars, trigger an encounter or battle, fight the guardian, heal, add potions, unlock weapons and simulate the next day. Release builds (the default, and this repository's `index.html`) can't open it.

## Project layout

```
index.html               app shell
manifest.webmanifest     PWA manifest (name, icons, colors)
sw.js                    service worker (offline cache)
css/style.css            all styles
js/assets.js             sprite sheet sizes and frame counts (generated)
js/00-util.js            helpers, storage, event bus
js/01-icons.js           hand-drawn pixel icons
js/02-data.js            ALL game content: worlds, avatars, items, daily missions, achievements, encounters
js/02c-missions.js       the 600 field missions, state birds and flowers
js/02d-merlin.js         Merlin's 300 harder quests
js/03-state.js           save data and persistence
js/04-steps.js           step tracking sources, wake lock, sound hooks
js/04b-health.js         automatic step sync (Apple Health / Health Connect) in the installed app
js/05-game.js            game rules: rewards, leveling, streaks, missions, encounters, shop, HP
js/05b-battle.js         battle rules (pure logic: moves, weapons, status effects, guardians)
js/05c-missions.js       field mission rules (progress, board, photo proof)
js/05d-custom.js         your own missions: templates, due dates, difficulty, priority, rewards
js/05e-eggs.js           eggs: finding, breaking, Merlin's trades
js/02e-quiz.js           the Druid's 945 Knowledge Challenge questions
js/05f-druid.js          the Druid: questions, rewards, taking your eggs
js/06-engine.js          canvas renderer: parallax worlds, avatar, pets, particles
js/07-ui.js              screens, HUD, sheets, toasts
js/07b-battle-ui.js      battle screen
js/07d-missions-ui.js    field missions on the Missions tab, camera flow, photo journal
js/07e-custom-ui.js      "My missions": create, edit, check off and complete your own missions
js/07f-tour.js           the guided tutorial and the one-time low-health tip
js/07h-eggs.js           Inventory → Eggs and the trade cards
js/08-main.js            startup, onboarding, developer panel
assets/bg/               world layers (each scene at most 300 px tall)
assets/av/               avatar sprite atlases (one row per animation)
assets/cr/               creature sprite atlases
assets/pet/              pet sprite atlases
assets/npc/              trader sprite atlases
assets/wp/               weapon projectiles and explosions
assets/pot/              potion icons
assets/art/              artifact icons (r = creature relics, m = minerals, c = charms, x = shields, i = item-pack finds)
assets/ach/              achievement badges
assets/wi/               weapon icons (melee, ranged, shields)
assets/mg/               magic item icons
assets/sfx/              weapon sounds
assets/icons/            app icons from the Step Quest logo: favicon (.ico, 16, 32), 192/512, Android maskable, apple-touch-icon, og-image (link previews)
assets/fonts/            Jersey 10, Pixelify Sans, Silkscreen (bundled for offline use, SIL OFL)
tools/prep_assets.py     rebuilds /assets from the original downloads:
                         python3 prep_assets.py <pack1_dir> <pack2_dir> <pack3_dir> <pack4_dir> <pack5_dir> assets [<pack6_dir>]
                         (pack6 = the Knight & Ranger GIFs; their walk cycles are generated from the idle frames)
                         (Parallax Cave ships as a .rar: extract it with unrar into "New Worlds/Parallax Cave" first)
native/                  Capacitor project for the iPhone / Android app (step sync)
.github/workflows/       pages.yml publishes the site; android.yml builds a test APK on demand
```

## Adding content

Everything lives in `js/02-data.js`:

- **New world:** add an entry to `D.WORLDS` with its layers (back to front, each with a parallax multiplier), ground line, length in steps and `unlock` level. Then add its finds to `D.FINDS`.
- **New avatar, pet, trail or weapon:** add an entry with a `req`, such as `{ level: 5 }`, `{ cost: 400 }`, `{ streak: 7 }`, `{ steps: 20000 }` or `{ explored: 'rust' }`.
- **Skin tones:** `D.SKIN_TONES` holds the swatches (each a 3-color ramp). `D.SKIN_MAP` lists the exact skin colors each sprite sheet uses; Skin tone editing covers the original walkers and the nine newest (the Shadow Archer, the Executioner and the Shadow Knight show no skin, so their tone recolors the cloak, the robe and the shadow body); the other packs keep their drawn skin.
- **Creatures:** `D.CREATURES` sets HP, attack and whether each one is aggressive. Each world has a `pool` and a `boss`.
- **Weapons and potions:** `D.WEAPONS` (power, recharge turns, effect) and `D.POTIONS`.
- **Balance:** `COINS_PER_STEP`, `XP_PER_STEP`, `xpToNext`, `heroMaxHp`, `heroAtk`, `creatureStats`, world `length` and `unlock` level.

## Shipping updates

The service worker caches every file. When you change anything, edit the `CACHE` name at the top of `sw.js` (for example `stepquest-2.3.1`) so installed phones pick up the new version on their next launch.

Saves from earlier versions upgrade automatically. Auras and dyes were retired in 2.0; players who bought them get their coins back. Since 2.2 worlds open by level; worlds a player already unlocked stay open.

## Saves

Progress is stored on the phone (browser local storage, or the installed app's storage). Clearing site data or uninstalling erases it. There are no accounts and no server.

## Credits and licenses

See `CREDITS.md`. The art comes from CraftPix.net free packs. Check their license before you redistribute the assets or ship commercially.
