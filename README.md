# Step Quest

A pixel-art walking RPG for your phone. Every real step moves your hero forward through the world. Walk to explore 50 worlds that open as you level up, earn Walk Coins, fight turn-based battles against aggressive creatures and world guardians, collect weapons, potions, food, magic items, pets and artifacts and face rare roaming bosses.

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

## Quick missions, mission types and mission battles

- **Quick missions** (Missions → My missions → the *Quick missions* card, right under *New mission*): 74 pre-made one-tap missions in 8 categories (Body, Mind, Learning, Home, Work & money, Creative, Social, Outdoors). Players can't add their own. *+ Add* opens a picker (one tap adds it); on the card, ✓ finishes and × drops it. A finished one stays on the card and can be removed the same day (two taps): that takes back exactly the XP and coins it paid (`G.quickUndo`; XP loss can drop a level via `G.loseXp`, and a level won back pays no coins again). Each can be done once a day; together they pay up to `D.QUICK_CAP` (80 coins, 120 XP) a day. Data: `js/02h-quick.js`, rules: `js/05k-quick.js`, UI: `js/07k-quick-ui.js`.
- **After a mission: maybe battle mode, maybe the Worldkey tuning game** (`js/05m-aftermission.js`, screens `js/07m-aftermission-ui.js`). Finishing any mission (your own, quick, daily, field or Merlin's) makes two independent rolls, and whatever comes up plays after the mission's own toast, each waiting until the screen is free (no sheet, level-up card, tour or battle open):
  1. **Battle mode** (`D.AFTER.BATTLE_CHANCE`, 45%): a hostile creature attacks right away (35% of the time a mob, `D.MOB.MISSION_CHANCE`). From level `D.BATTLE_LEVEL`; skipped when HP is under 25% ("Too hurt to fight").
  2. **Worldkey signal** (`D.AFTER.TUNE_CHANCE`, 45%, once the Worldkey is awake): the memory game, using the real symbol pattern of the world the Worldkey points at. Match it and the Worldkey is **tuned to that world** on the spot (the same 3-day tuning as Inventory → Worldkey), plus +5% energy (never past 100%, `D.AFTER.BONUS`) and `8 + level/2` XP; if it's also charged enough, the sheet offers **Open** right there. Wrong taps cost nothing (Try again, or Not now). With every world open it's a shorter random pattern for the bonus.
  If three missions in a row roll nothing (`D.AFTER.PITY`), the next one always brings one of the two. Finishing missions no longer drains Worldkey energy.
  Missions finished together (Claim all) make one event with one roll each. Each mission counts once (a quick mission removed and finished again doesn't roll twice; `state.after`).
- **Field and Merlin open at level 3** (`D.FIELD_LEVEL`, `js/05-game.js`). Before that both tabs show a lock and "Lv 3", and the tab explains what's inside with a bar to level 3. Merlin's quests (`D.MERLIN_MIN_LEVEL`) and egg trades (`G.tradesOpen`) open at the same level, and travelers don't hand out deliveries before it. Reaching level 3 lists it on the level-up card, then a "Field missions & Adventure" card plays a 3-step mini tutorial (feature `field` in `js/05j-unlocks.js`). Saves already at level 3 or above keep everything; a save with a field mission running keeps the tab open until it's done.
- **Mission mix** (Profile → Overview): most, in-between and least completed mission types, for a day, week, month or all time, with arrows to step back through past periods. Quick missions, your own missions (by template, see `D.TPL_CAT`) and field missions all count. Counting starts with this version.
- **36 mission achievements** (totals, quick missions, your own missions, time of day, days in a row, types). Badge art comes from `python3 tools/make_mission_badges.py`.

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

## The Worldkey

Every walker carries a **Worldkey**, a semi-sentient device that opens the way between worlds. A world still opens the usual way (its level, plus the world before it explored to 75%), but now that only **discovers** it: to enter, the Worldkey needs three things.

- **Destination:** the world is discovered. The world map lists what each locked world needs, one line each with a ✓ when done ("Reach level 17", "Explore 75% of Teal Tundra"), how far along you are and roughly how many steps are left. A popup offers it once ("New world discovered"); after that it waits on the World screen, the world map and Inventory → Worldkey.
- **Resonance:** tune to the world's **frequency** by repeating its symbol pattern once (a Simon-style memory game with six original pixel glyphs, each with its own shape, color and tone). The game grows with your walker: 4 symbols at the start, one more every 8 levels (up to 9 at level 41+), and the symbols play a little faster each level (760 ms apart at level 1, 380 ms at the fastest). Each world's pattern is fixed (seeded by its id) and a wrong tap costs nothing: just try again. A tuning holds for **3 days**, then the key drifts out of tune and needs tuning again (the screens show "Tuned · 2 days left" or "Out of tune"). You can also "tune ahead" to the next world before it's discovered.
- **Energy:** opening a world costs 25% (worlds up to level 15), 60% (up to level 40) or 110% (beyond). Energy is only spent when the world actually opens. Worlds you've already opened stay free to travel to.
- **Fading:** being out in the world messes with Worldkey tech. It loses about 6% energy a day plus 1% per 1,000 steps walked (never below 0), and every 1,000 steps also use up 2 hours of a tuning (so a 7,000-step walker retunes about every 2 days). The Worldkey page says so under the energy bar, and a "?" tooltip next to "Out of tune" explains it; the intro and the tutorial mention it too. A new walker's Worldkey wakes up at **10%**, out of tune.

**Charging: artifacts are the fuel** (top of Inventory → Artifacts, and the Worldkey page). There is no crafting step and no HP cost: every artifact copy you hold goes straight into the Worldkey. Artifacts from later worlds hold more (`D.ART_CHARGE`):

| Artifacts from | Charge each |
|---|---|
| Worlds that open before level 10 | +15% |
| Worlds that open at level 10–24 | +20% |
| Worlds that open at level 25+ | +25% |

Any artifact can charge the Worldkey up to **150%** (the far worlds need an overcharge past 100%). **Charge** opens one sheet that starts on just enough artifacts to reach 100% (or what a discovered world needs, if more) and shows which ones it will use; − / + / **Fill** adjust it, and one more tap charges. The copies you hold the most of go first, so rare finds stay in your collection longest. The Artifacts page shows the energy bar, the three charge values with how many of each you hold, and one **Charge Worldkey** button. The Worldkey page has a *Fuel · your artifacts* card (how many you hold, what they're worth) with its own Charge button, and when energy is low the warning carries a **Charge now** button. The Collection rows show what each world's artifacts are worth. Charging counts toward the *First Spark / Powder Keg / Demolitionist* achievements (1, 25, 60 artifacts used; these were the Darkmatter-crafting badges).

**Older saves (the Darkmatter Forge is retired):** Darkmatter you were holding is poured straight into the Worldkey (Void +20%, Nebula +45%, Eclipse +70%, up to 150%); whatever doesn't fit comes back as the artifact copies it was made from (1 / 2 / 3), or as coins if you had none discovered. A one-time toast says what happened (`migrateDm` in `js/05g-worldkey.js`).

**Artifacts are collected again and again.** The collection log keeps every artifact you've discovered (6 per world). Each find also adds a **copy** to your hand (fuel for the Worldkey), and once a world's six are all discovered, walking it again keeps turning up new copies (instead of "just old coins"). Inventory → Artifacts → Collection shows each one with ×N in hand. Older saves get one copy of every artifact they had found.

**Worldkeys (18).** Every walker starts with the **Rookie**, a freshly awakened key. The other 17 are earned: reach the level, then buy them in Inventory → Worldkey → Worldkeys (from Classic at level 3 for 800 coins to Regalia at level 52 for 15,000). Locked keys show as dark purple silhouettes; buying never switches keys automatically. Each key has its **own personality** (it can't be chosen separately): the Rookie, Logic Engine, Sarcastic Navigator, Ancient Oracle, Chaotic Companion, Wounded Relic, Glitch, the Poet, Sergeant Volt, Still Water, Professor Fern, Inspector Dusk, Fret, Captain Brine, Sparkle, Jeeves Mk. II, Old Ember and Lord Clarion, each with its own lines for discoveries, arrivals, returns, low energy, charging, tuning, low HP, long walks and idle moments. The screen loops its charging animation and pulses magenta below 25% energy. Opening a world plays a blue portal, then the new world loads and the Worldkey greets you. New players meet their Worldkey on the first launch in **three swipeable pages** (scroll-snap, with dots and a Next button): *The broken road* with a screenshot of a forest world (Pine Hills, Teal Wood or Moonlit Forest, picked at random; `assets/shots/`), *Your Worldkey*, and *How it works*. The same pages open from the "i" on Inventory → Worldkey, and the tutorial covers it too. Until it wakes up, the Worldkey page reads "Unlocks after your first world".

**Tuning symbols** are square-pixel formations like the ones on the Worldkey screens (four corners, diamond, twin bars, plus, zigzag, diagonal), lit in the current key's color. On the device they fly in wide and settle into shape; every formation has its own shape and tone.

**Personality and remarks.** Lines come from real game state (world, exploration, steps, energy, HP, artifacts in hand) and avoid repeating. On the road the Worldkey speaks in a small dismissible bubble at most every 4 minutes (arrivals always get through), never during a battle, encounter card or sheet; "Messages on the road" (explained right under its heading) can be **Normal** (a remark every few minutes at most, plus arrivals and low energy), **Important only** (arrivals and low energy) or **Off** (nothing on the road; it still speaks when you tune, charge or open a world). Lines held back during a battle or an open card appear once it closes.


Data: `js/02g-worldkey.js` (costs, artifact charge values, symbols, designs, dialogue). Rules: `js/05g-worldkey.js`. Screens: `js/07j-worldkey-ui.js`. Art: `assets/wk/` (prep: `tools/prep_worldkey.py`; the old Darkmatter icons, `wk/dm_*.png`, now decorate charge toasts by artifact tier). Saves: `state.wk` is created and repaired on load, so older saves keep every world they had open and saves made before the Worldkey start like a new walker (10%); saves that already had one keep their energy (it fades from the update on), and resonances they had learned count as freshly tuned.

## Themes

**Profile → Settings → Theme** switches the whole app between three dark themes: **Night** (violet and orange, the original), **Lime** (black with yellow and green) and **Field** (black and orange). Every theme uses the same color roles (CSS custom properties on `:root`, overridden by `:root[data-theme="lime"|"field"]` in `css/style.css`), and every text/background pair meets WCAG 2.1 AA (4.5:1) with borders and focus at 3:1, as Section 508 requires. The choice is remembered (`settings.theme`, plus `localStorage['stepquest.theme']` so the theme applies before the first paint), and the picker is a keyboard-operable radio group. Locked items show as dark purple silhouettes in every theme.

## Battles

Battles unlock at **level 3** (`D.BATTLE_LEVEL`). Weapons and magic (Shop and Inventory) open with them. Every fight goes through `WB.BattleUI.open`, which refuses below that level (only the developer panel can force one), and fights left waiting on the road by an older save are dropped. Before that no creatures appear on the road at all, battle milestones stay hidden on the Field tab (their encounter slot becomes a crate, find, egg or traveler), guardians and bosses don't show up, the Druid doesn't appear yet and no daily battle goals are given. The level-up card announces when battles open.

**Feel.** Battles play like a classic handheld RPG: "BATTLE MODE" pops up for a moment as the fight starts, in the same yellow-and-orange pixel style as the Step Quest logo (it shows without the pop and fade under Reduce motion) (with a short sting, then the battle music fades in); you and the creature slide onto the stage; you step forward to act and back again; creatures flash white just before they strike; HP numbers roll and bars drain smoothly with a pale trail that catches up a beat later; critical hits flash the screen and freeze the frame for an instant; damage numbers pop and bounce; the message window types its text out (tap it to finish); a ▶ cursor marks the selected command. Your plate and the creature's (name, HP bar, level, HP and status) sit side by side under the characters, right above the message window, always the same size. A beaten creature sinks away in white, the battle music cuts and a short victory fanfare plays. Drinking a potion in battle plays a bubble that swells and bursts over your head (`assets/pot/use_bubble.png`), followed by small cyan pops for healing (`use_pop.png`) or an orange flare for boosts (`use_burst.png`). Battle magic that strikes the creature crackles with a lightning burst (`assets/mg/fx_magic_hit.png`). Creature hits pick from five recordings (`creature_attack_1`–`5`), and completed missions play `sfx/quest_complete.mp3` (Merlin's quests keep the bigger fanfare). Every battle sound is decoded when the battle opens, so the first hit is never late, and music always fades in and out. Reduce motion turns off the wipe, typing, flashes and freezes. Your HP bar is green (orange when low); a creature's is red and segmented, so they're never confused.

Some creatures are aggressive. When one blocks the path you can fight or avoid it; fighting opens a turn-based battle (1v1, or a mob):

- **Mob attacks** (`D.MOB` in `js/05b-battle.js`): from level 5 (and after your first three battles), 18% of hostile road creatures come as a **mob of 2**, or **3** from level 15 (45% of the time), picked from the world's fighters. After-mission battles are mobs 35% of the time. Each member has 62% (pair) or 50% (trio) of a lone creature's HP and 60% / 47% of its attack, and same-kind members get a letter (Orc Scout A, B). **You choose who you hit:** tap a creature on the stage or its row on the enemy plate (a gold ▶ and a bouncing arrow mark the target; the panel says "Target: …"). Strike, Throw, Special, bombs, battle magic and your pet all hit the target; when it falls the next one standing is targeted. Every creature still standing takes its turn each round (they stagger their specials so they don't all charge at once), and poison, burns and Life Drain tick on each of them. Arcane Nova also blasts the rest of the mob for half its damage and stuns them a turn; freeze-all weapons freeze the whole mob. Running from a mob is harder (55%, 85% with Fleet Boots); the turn timer gets 3 extra seconds. A creature that flees leaves the fight and the rest fight on. A win pays 75% of a lone creature's reward per creature beaten (half XP for any that ran) and logs each new kind. Developer mode has **Mob battle (3)**. Guardians, bosses, the Rival and the Druid always fight alone.

- **Initiative:** some creatures strike first, before your opening move: 30% of creatures, 40% of guardians, 50% of bosses and Redhood Rival, and the Druid always (`D.AMBUSH`). The opening strike is a plain attack or its spell, never a brace, charge or flee. Never in your very first battle.
- **Turn timer:** you get a short clock to pick each move: 10 seconds against creatures, 8 against guardians, 7 against bosses (`D.TURN_TIME`). The bar sits at the top of the stage and turns red with a tick in the last 3 seconds. When it runs out you hesitate and the creature takes its turn (a stunned turn is spent too). It only counts while you can act: animations and a backgrounded app don't use it up, Items and Magic don't pause it, and an instant magic item keeps the time you had left. Off in your very first battle; switch it off in Settings → Appearance & sound → Battle turn timer.

- **Strike** uses your **melee** weapon (swords, daggers, axes, maces, spears, staves). As your walker swings, the equipped melee weapon pops up above their head (like Defend's "Guard up"); it isn't drawn in the hand, because many walkers already hold a weapon of their own in the art. Daggers stab twice, axes sunder (+25% damage taken), maces stun, spears pierce guards and hit harder on the first turn, staves heal or curse, some blades steal life.
- **Throw / Shoot / Cast** uses your **ranged** weapon: throwing weapons arc, knives spin, arrows and the 12 spells (orb, wave and javelin in sun, frost, void and fire) fly straight at the creature. It hits hardest, may poison, burn, bleed, freeze, weaken, drain or volley, then recharges.
- **Defend** has a **guard gauge**: each Defend uses 35% of it and every turn you don't defend restores 15% (`D.DEFEND_COST`, `D.DEFEND_REGEN`), so you can't hide behind your shield forever. The Shop calls the shield slot **Defense**.
- **Defend** uses your **shield**: it blocks 60–85%, and some shields reverse part of the hit back, counter with spikes or heal. Every shield also blocks a little of every hit (armor). The Defense slot also holds **48 belts** (CraftPix icons, `bt_*`): they are shields you wear at the waist, with more armor and a slightly weaker Defend block (60–74%); 3 are legendary guardian rewards. Guardians glow red and "charge up" before a heavy attack: defend then.
- **Every creature has five moves** (`D.CREATURE_MOVES` in `js/02-data.js`):
  - **Attack:** a plain hit.
  - **Magic:** its own named spell with its own projectile and impact (Medusa's Stone Throw, the Overthinker's What-If Flame…). 40% of the time it adds an effect (20% if you defended): poison or burn (damage each turn, never below 1 HP), weaken (your hits do 30% less for 2 turns), slow (your ranged weapon takes 2 more turns to recharge) or drain (it heals from the damage).
  - **Defend:** it braces (your next hit does half) and recovers 6% HP; guardians raise a reversing ward instead (30% of your next hit bounces back). Piercing weapons ignore both.
  - **Flee:** below 25% HP (20% for guardians) it may try to run, at most twice. If it gets away you keep half the battle XP but no coins or loot, and a guardian goes back to waiting on the world map. Creatures never flee your very first battle.
  - **Special:** a signature move it charges a turn ahead ("Charging!": defend!), every 4th turn (every 3rd for guardians): a big hit with a stun (you lose a turn; defending stops it), poison, burn, weaken, slow or drain, three quick hits, or a quake that's hard to block.
- **Each world has its own creatures** (`pool` in `D.WORLDS`), three per world picked to suit the place: frost worlds get Medusa, the Orc Raider and the Bog Slime, city streets get the Sentry Drone and the Flying Procrastinator, forests get the Treant and the Bulb Spitter, and so on. The world map shows them on each world's card, under "Creatures here".
- **37 road creatures** (Naughty Nova was retired), including 16 from the enemies pack: the Mushroom Guard (replaced 2Face; the id is still `twoface`, art from `tools/add_mushroom_guard.py`), Energy Vampire Bat, Flying Procrastinator, Land Alien, Lazy Bat, Little Cthulhu, Medusa, Orc Raider, Self-Doubt Drone, Sentry Drone, Bog Slime and Treant roam the worlds, and four are new guardians: the Distraction Dragon, the Ice Bully, the Overthinker and the Slothful Ogre. Animations a GIF set doesn't include (a lunge for attack, a flash for hurt, sinking for death) are generated from its idle frames by `tools/prep_assets.py`.
- **Redhood Rival** (`tools/prep_redhood.py`, from the itch.io red hood sheet; she faces right and is mirrored to face you): a walker who has been everywhere. She can turn up in **any world** once battles are open (8% of fighting encounters, after your first three battles) and is always **your level**: her HP and attack follow `D.rivalStats(level)`. She talks during the fight in a speech bubble and the log: an opening line, taunts about her travels and how little you walk (half the rounds), a line when she drops below half HP, before her special, and when she wins or loses. Her lines use your real numbers: today's steps, lifetime steps, your streak, the world you're in and a world she's "just come from" (`D.RIVAL`). Moves: Long-Road Arrow (a bow shot that can weaken you) and Ten-Thousand-Step Strike (a leaping multi-hit slash). Animations: walk, bow shot, slash combo, leaping slash and a flash-and-recoil hurt; the sheet has no idle loop, so her idle is a gentle breathing bob.
- **Redhood Rival** (`tools/prep_redhood.py`, from the itch.io red hood sheet; she stands in profile facing the walker): a walker who has been everywhere. She can turn up in **any world** once battles are open (8% of fighting encounters, after your first three battles) and is always **your level** (`D.rivalStats(level)`). She talks during the fight in a speech bubble and the log: an opening line, taunts about her travels and how little you walk (half the rounds), a line below half HP, before her special, and when she wins or loses. Her lines use your real numbers: today's steps, lifetime steps, your streak, the world you're in and a world she's "just come from" (`D.RIVAL`). Moves: Long-Road Arrow (a bow shot that can weaken you) and Ten-Thousand-Step Strike (an overhead multi-hit sweep).
- **Orc warband and predator plants** (two CraftPix top-down packs, prepared by `tools/prep_orcs_plants.py`; only the left-facing rows are used in battle and on the road, and the front-facing idle is each one's portrait on encounter cards and the world map):
  - **Orc Scout** (spear): Green Downs, Pine Hills. **Orc Cutthroat** (knife, its Ambush stuns): Cairn Peaks, Kiln Canyon, Ashen Peaks. **Orc Reaver** (two blades): Frozen Siege, Grey Pines, Dragon Hall, Fort of Illusion.
  - **Fang Lily**: Green Downs, Canopy Vale, Jungle Shrine. **Pitcher Maw**: Violet Wood, Abandoned Valley, Specimen Lab. **Nightshade**: Misty Hollow, Ember Moor, Moonlit Forest, Jungle Shrine.
  - The plants' attacks carry **venom**, a slow poison: 3% of your max HP every turn for 6 turns (never below 1 HP). Their special always envenoms; their magic does 60% of the time (30% if you defended). A new dose restarts the 6 turns; Cleanse items remove it. Your plate shows "Venom · N turns".
- **Pets** fight with you: your pet takes 20–60% of every hit until its own HP runs out. Five pets also attack on their own after each of your moves, each for a different share of your attack: Rex the Doberman (12%, minor), Rusty the fox (20%), Pup Hyena (25%), Glass Scorp (30%) and Tusk the boar (38%). A knocked-out pet sits out until its HP refills over time. Every HP change floats over whoever took it as "-N HP" / "+N HP".
- **Items** drinks a potion or eats food. **Magic** uses a magic item (see below). **Run away** may fail.
- Losing costs some coins (about 5–10% of what you carry, capped by the world), costs half of each kind of egg you carry (at least one) and drops your HP to 25%.
- **Walking does not heal.** HP refills on its own, from empty to full in 15 minutes (`D.HEAL_MINUTES`), even while the app is closed, or instantly with a healing potion. Pets recover the same way. A level-up raises your max HP but only tops you up if you were unhurt.
- **Special attacks** (from level 10): the walker picked at sign-up decides which one you get. A gauge on the Special button fills as you attack (Strike +25%, Throw/Cast +30%); when it's full, tap it.
  - **Scavenger – Scavenger's Raid:** a raiding strike (damage grows with level) that snatches a potion from the creature, usable straight away from Items (better loot in later worlds; coins if your bag is full).
  - **Wandering Mage – Arcane Nova:** a blast (damage grows with level) that stuns the creature for 3 turns.
  - **Healer – Life Drain:** drains the creature for 3 turns and heals you with it; 50% more healing while your HP is under half.
- Magic attacks gather energy at the caster's hand, trail sparks, and burst by element on impact (fire and sun explode, frost shatters, void pulses). Every weapon kind has its own impact sound.
- Exploring a world to 100% wakes its **guardian**. Challenge it from the world map. Defeating guardians unlocks the legendary weapons.

The bottom bar has five tabs: World, Missions, Shop, Inventory and Profile. **Shop** is for buying (Walkers, Weapons, Potions / Food, Pets and Magic). **Inventory** holds everything you own, in seven sections: Worldkey, Weapons, Magic, Potions, Pets, Avatars (where you equip, drink, refill and repair) and Artifacts (charging the Worldkey, and the Collection). Achievements live in Profile → Achievements. (Trails were retired; coins spent on them were refunded.)

**Features unlock step by step** (`js/05j-unlocks.js`), so a new walker learns one thing at a time:
- **From the start:** walking, worlds, encounters, battles (from the battle level), missions, the Shop and Inventory, artifacts and eggs.
- **The Worldkey** wakes up when you **finish your first world**: Rust Hollow explored to 100% (`D.FIRST_WORLD_PCT`, `G.firstWorldDone` in `js/05j-unlocks.js`). Until it wakes you can't travel anywhere (only Rust Hollow is open). Neon City is a normal Worldkey world now, opening at about level 35. The code still supports always-open worlds (`open: true`), which never count. Until then Inventory → Worldkey shows a locked card with your Rust Hollow progress, no world is discovered or opened, and it makes no road remarks. A save that woke it too early goes back to sleep unless it has already discovered or opened a later world. It wakes up with a full starter charge.
- **Low charge:** when the Worldkey's energy is low (or empty), the Worldkey page shows a **Charge now** button that feeds your artifacts in (or says where to find them if you have none).
- **Artifacts** (the Collection and charging) unlock at **level 3** (`D.FORGE_LEVEL`, `feats.art`, `js/05j-unlocks.js`). Before that they show a locked card with a level bar. Unlocking plays a 2-step mini tutorial. Saves already at level 3 or above (or that already had it) keep it quietly.
- **Worldkey energy** (`feats.dm`) still starts the moment you finish your first world: the Worldkey wakes with a full starter charge, opening worlds now costs energy, and it fades with time and walking. Until then opening worlds is free and nothing fades. Artifacts found before then simply wait in your collection. Gear care (ranged shots, battle-magic uses, melee wear) is always on.
- Each unlock shows a congratulations card, then plays its own short tutorial (4 steps each), even if the card is closed another way. The world-gate popup waits until the Worldkey tutorial is done. The first-run tour leaves out features you haven't unlocked yet.
- Saves from before this rule unlock whatever they've already reached, without the cards.

**What runs out, what wears down** (`js/05i-gear.js`), from **level 7** (before that, gear never runs out or wears down):
- **Ranged weapons** come with **20 shots** per purchase; each Throw, Shoot or Cast uses one. At 0 the ranged button says "out of shots". Buy 20 more (at the weapon's price) in the Shop or Inventory; you can hold up to 99. **Your first refill each day is free** (shots or battle-magic uses).
- **Battle magic** comes with **3 uses** per purchase (hold up to 9); each use in battle spends one. Worn **charms** never run out.
- **Potions and food** are used up when you drink, eat or use them.
- **Melee weapons** never run out, but every Strike wears them by 1%. Damage scales from 100% at full condition down to 60% at 0%. Below 30% the battle log warns you once. **Repair** in Inventory brings a weapon back to 100% for **a quarter of its price** (at least 15 coins).
- **Pets don't die.** A pet knocked out in battle rests and recovers over time, like you. (Pets lost under the short-lived old rule were given back.)
- Older saves: every ranged weapon you own gets 20 shots and every battle magic item 3 uses.

The World screen never scrolls as a whole: the top bar, the walking area and the bottom bar stay put, and only the panel under the stage (Today, health, objectives) scrolls. The **World map** button (frosted glass, outlined in the theme's highlight color: orange in Night and Field, yellow-green in Lime) sits right under the HP bar on the World screen. The About section at the bottom of Profile is collapsed by default.

**Potions / Food.** Nine everyday potions are sold from the start or unlock by level (Small Tonic, Iron Brew, Fury Draught, Grand Elixir, plus Storm in a Bottle, Ward Cell, Shadow Eye, Sundrop and Fire Crystal from the item pack). 44 more, one for every other flask in the potion pack, are hidden as artifacts in the newer worlds; finding one gives you a bottle and adds it to the shop. Potions heal, cut damage, boost damage, recharge your weapon instantly or explode on the enemy. **Food** is the cheap way to heal: Garden Radish (20%), Orchard Fruit (30%), Smoked Fish (45%), Hearty Steak (60%) and the Candy Jar (a sugar rush that recharges your weapon). Eat it in battle from Items or straight from the Shop. You can carry 9 of each.

**Ranged gear from the item pack** sits in Weapons → Ranged: the Lasso (may rope the creature so it loses a turn), Cherry Bomb (burn), Throwing Axe (curse), Cannonball (heavy, breaks guard) and Web Snare (weakens) spin through the air like the knives; the Flintlock Pistol is the first **Firearm** and fires a bullet straight through guards.

**Magic items** (Shop → Magic): 55 of them, bought once and kept, in two kinds (`D.MAGIC`, icons in `assets/mg/`: 16 px pixel icons scaled 3×; the Ring, Spellbook, Clover and Backpack are redrawn by `tools/redraw_magic4.py`):
- **Charms (23)** are worn: up to 3 at a time (`D.CHARM_SLOTS`), each with a passive perk. Examples: Lucky Horseshoe (+8% crit), Explorer's Backpack (more loot), Merchant's Purse (+20% battle coins), Amulet of Vitality (+10% max HP), Ring of Might (+8% damage), Ring of Warding (−8% damage taken), Bulwark Sigil (guard gauge refills faster), Arcane Hat (special charges faster), Soul Gem (first hit halved), Thornweave Necklace (hit back 10%), Scholar's Codex (+15% battle XP), Pendant of Renewal (heal 3% a turn), Void Ring (30% of hits pierce), Circlet of Focus (ranged recharges a turn faster), Hunter's Ring (+15% vs guardians and bosses), Ember Heart (survive one knockout per battle).
- **Battle magic (32)** is used from the **Magic** button: each item once per battle, at most one per turn, and it doesn’t use your turn. Each purchase is 3 uses. Heals (Chalice, Heartstone, Phoenix Feather), shields (Stoneskin, Aegis), damage boosts (Ember Gauntlet, Rune of Fury), blasts (Storm Orb, Starfall, Sun Orb), statuses on the creature (poison, burn, bleed, freeze, stun, weaken, guard break), utility (recharge your weapon, refill the guard gauge or special gauge, cancel a charging special, reflect, dodge, Golden Key to escape any battle) and the original Book of Magic, Illusion Ring and Lucky Clover.
Levels and prices run from level 4 (700 coins) to level 60 (20,000 coins).

**Sub-missions.** A mission can be broken into sub-missions (one per line in the form; the templates come with some). Checking one off pays **1 coin**, once per sub-mission (unchecking and checking again pays nothing more), counted toward the same daily cap as your own missions.

### Mission reminders (linked to the phone's notifications)

**Profile → Settings → Notifications → Mission reminders** (on by default). In the app you're reminded **20, 15, 10, 5 and 2 minutes** before any mission is due (your own missions, field missions and Merlin's quests) with a toast and the **alert bell** in the HUD: it appears with the first reminder, rings and shows a badge until you open it, and stays (also after a restart, `state.alerts`) until the mission is finished, deleted or failed, or you tap **Clear all**. If the app was closed through several of those moments, only the latest one is shown, never a burst.

**Phone alerts.** The first time you have a mission with a due time, a card offers phone alerts (**Allow alerts** → the phone's own permission prompt). If you say "Not now" it asks once more a week later, at most; after that, Settings has an **Allow** button.
- **Installed app (iPhone / Android):** every upcoming mission is handed to the phone's notification system (`@capacitor/local-notifications`) at **15 and 5 minutes before, and when it's due** ("Mission due now"). They arrive with Step Quest closed, sit in Notification Center / the notification shade, and **tapping one opens that mission**. Rescheduled whenever missions change and whenever the app goes to the background; up to 60 pending (iOS keeps 64), soonest first. Android gets its own **"Mission reminders" channel** (high importance: heads-up, sound, vibration; players can tune it in Android settings), a white bell status-bar icon and the Step Quest orange. **Exact timing (Android 12+):** without the exact-alarm setting Android can deliver a few minutes late, so after you allow alerts Step Quest offers **Allow exact timing** (also in Settings as **Exact timing**). Until then reminders are scheduled as inexact on purpose, because the plugin would otherwise open the system setting every time it reschedules. iOS shows them in Notification Center with sound while the app is open (the in-app toast covers the banner).
- **Web app:** notifications through the service worker while Step Quest is open or in the background (there is no push server, so nothing arrives with the tab closed). Tapping one brings the app forward on that mission (`notificationclick` in `sw.js`; `?mission=` opens it on a fresh launch).

Native setup is automatic: `npm run add` / `npm run sync` (`native/scripts/patch-native.mjs`) adds `POST_NOTIFICATIONS`, `SCHEDULE_EXACT_ALARM` and `RECEIVE_BOOT_COMPLETED` to the Android manifest and writes the status-bar icon (`res/drawable/ic_stat_stepquest.xml`); `native/capacitor.config.json` sets the icon, color and iOS presentation. Code: `js/05h-remind.js`.

## Profile

Profile has two tabs. **Overview**: your walker, special attack, stats, the step chart (switch between **7, 14 and 30 days**; the bars grow in when you switch, and the choice is remembered) and your loadout. **Settings**: steps & goals, notifications, appearance & sound, privacy & data, and About.

## Profile stats

Lifetime totals: steps, distance, coins, streak, battles won, missions completed (all kinds), **field missions**, **milestones**, **quick missions**, **my missions**, **world guardians beaten** (each world's guardian wakes at 100% explored and is challenged from the map), **bosses beaten** (the rare roaming bosses), **Merlin's quests done**, **Knowledge Challenges** (Druid questions answered right, of those taken), worlds, avatars, artifacts and best day. Every stat explains itself when tapped. Distances follow **Profile → Distance units** (miles or kilometers; US English devices start on miles).

## Bosses

From level 20 (`D.BOSS_LEVEL`) six roaming bosses can turn up on the road. They're rare: a small share of encounters, at most one every 90 minutes, and ones you haven't beaten yet show up more often. Each is scaled to your level (about 11 good hits to beat, hits that take roughly 12% of your HP, a special every 3rd turn), has its own magic and a unique ability, and talks during the fight in speech bubbles: an intro, taunts, a line when it's hurt, one for its special, and its last words or a gloat.

| Boss | Magic / special | Ability |
| --- | --- | --- |
| Magmor the Demon Lord | Hellfire Rain (burn) / Infernal Cleave | **Hellborn Rage:** below half HP his hits do 35% more |
| The Hollow King | Soul Siphon (drain) / Night Terror | **Shadow Form:** 25% of your non-piercing hits pass through him |
| Morwen the Dark Fairy | Thorn Hex (poison) / Bramble Bind (stun) | **True Wings:** at half HP she transforms, heals 25%, hits 20% harder and switches to Spirit Swarm / Summon Spirits |
| Ironhide the Golem | Rivet Volley (slow) / Overcharge (quake) | **Iron Plating:** non-piercing hits do 30% less |
| The Bringer of Doom | Grasp of the Grave (drain) / Doom Bell (stun) | **Reaper's Patience:** +40% damage while you're under 35% HP |
| Vesper the Crimson Sorceress | Crimson Bolt (burn) / Crimson Moon Barrage | **Crimson Mirror:** raises a ward often, reversing 45% of a hit |

Bosses never flee, and running from one only works 35% of the time (slipping away from the encounter card is a 50/50; fail and it cuts you off). **Win:** XP worth 8% of a level, 150 + 12 × level coins (+250 the first time), a Sundrop or Grand Elixir and a guaranteed egg. **Lose:** you drop 2 levels (`D.BOSS_LEVEL_LOSS`) and some eggs break; worlds, gear and items stay, and levels you win back don't pay level-up coins a second time (`s.peakLevel`). Boss art is in `assets/cr/` (prep: pack 17 in `tools/prep_assets.py`; the Sorceress is mirrored to face you). The Boss_3 upload contained only tutorial videos, so it isn't used.

## The Last Road set (level 79)

Six pieces open at **level 79** in the Shop, one step past the best gear before them (most of which comes from beating guardians). Their icons are a starlight recolor of the top gear in each slot (`assets/wi/sw_dawn.png`, `bw_star`, `sh_last`, `mg/worldbreaker`, `mg/longwalk`, `pot/ambrosia`).

| Item | Slot | Cost | What it does |
| --- | --- | --- | --- |
| Dawnbreaker | Melee (sword) | 30,000 | Power 2.3×, pierces guards, 35% crits that hit 2× |
| Starfall Bow | Ranged (bow) | 32,000 | Power 2.5×, ready every other turn, pierces, 45% chance of a critical double hit |
| Aegis of the Last Road | Defense | 30,000 | 24% armor, blocks 88%, reverses 40%, hits back, heals when you defend |
| Worldbreaker Rune | Battle magic | 26,000 | Two blasts of 18% of the creature's max HP and a 1-turn stun |
| Crown of the Long Walk | Charm | 28,000 | +12% damage dealt and −12% damage taken (perk `apex`) |
| Ambrosia | Potion | 900 | Full heal; in battle it also halves damage taken for 3 turns |

## Levels and pacing

Levels cap at **80** (`D.LEVEL_CAP`; it was 100 until 2.11.1, and saves above 80 are set to 80). Everything that unlocks by level opens by 70, so the last 10 levels are for the challenge. XP needed per level is `120 + 40 × level^1.35` (160 XP for level 2). Level-ups pay 10 × level coins. Walking earns 1 coin every 40 steps and 1 XP every 50 steps (`COINS_PER_STEP`, `XP_PER_STEP`), so most XP now comes from battles, quests and missions. At around 1,250 XP a day (7,000 steps plus battles and quests) that's about 2 weeks to level 20, 4 months to 50, 8 months to the last world (level 70; each world also needs the one before it explored) and about 13 months to the cap. Each level-up opens a celebration card listing everything the new level unlocks (worlds, walkers, weapons, pets, magic, potions) and how far the next level is.

## The Druid

From level 3 (when battles unlock) a druid sometimes steps onto the road with a **Knowledge Challenge**: one multiple-choice question from a bank of **945 questions in 20 topics** (history, geography, science, space, the human body, nature, animals, food, sports, language, pop culture, movies & TV, music, video games, books & myths, general knowledge, art, inventions & tech, math, world cultures), in `js/02e-quiz.js`. Questions don't repeat until you've seen them all. Answer right and he pays XP and coins (more at higher levels and in later worlds) and runs off into the trees. Answer wrong and the right answer is shown, then you must battle him: beat him and he flees, lose and he takes **every egg you carry**. You can also walk away from him for no reward. Logic in `js/05f-druid.js`.

## Eggs

Three eggs (`js/05e-eggs.js`): **Frost** (common), **Ember** (uncommon) and **Crystal** (rare; rarer eggs get likelier in later worlds). They turn up on the road as an encounter of their own, a quarter of the creatures you beat were guarding one, and guardians always drop one. You can carry 12 of each. Your egg counts sit on **Missions → Merlin**, right above the egg trades: three small chips with the count, rarity and a few words about each egg (tap one for its full note). Trading with **Merlin** opens at **level 6**; then trade from Missions → Merlin at any time, or when he finds you on the road. (The old Inventory → Artifacts → Eggs page is gone; links to it open Missions → Field.)

| Trade | Eggs | Loot |
| --- | --- | --- |
| Basket of Frost Eggs | 5 Frost | 60 coins, 50 XP, 2 Small Tonics |
| Ember Clutch | 3 Ember | 100 coins, 90 XP, an Iron Brew |
| Crystal Pair | 2 Crystal | 160 coins, 150 XP, a Grand Elixir |
| Merlin's Hoard | 3 Frost, 2 Ember, 1 Crystal | 250 coins, 220 XP and a weapon or pet you don't own yet |

Losing a battle costs you half of each kind of egg you carry (losing to the Druid costs all of them), so trade before a risky fight.

## Missions

The **Missions** tab has four sub-tabs, each showing how many rewards are ready: **Today** (daily reward, daily missions, streak), **My missions**, **Field** (the **395 field missions**, **milestones** and **deliveries**, from level 3) and **Merlin** (Merlin's quests, your eggs and his egg trades, from level 3). **Milestones** are long-term goals shown as cards inside Field missions (`D.MILESTONES`): win battles, beat guardians, find artifacts, own weapons, walk far. Two show at a time, they have no clock or penalty and they don't take a mission slot. They replaced the old Adventure tab: its "Reach <world>" goals were dropped (the World tab's Next world card and the Worldkey cover them), and milestones keep the old adventure ids so ones you already claimed stay claimed. **Deliveries** (messages travelers ask you to carry) sit just above them. Every field mission needs real walking. You pick missions from the board, and from the moment you pick one you have **24 hours** to finish it; only steps walked after that count. If the time runs out, or you drop the mission, you lose coins (half the mission's coin reward) and 15% of your max HP (never below 1 HP), and the mission goes to the back of the board to try again later. A finished mission never fails, even before you claim it.

**Walking streak** (Missions → Today). Walk at least your streak minimum (1,000 steps by default; Profile → Settings) in a day to add a day. The card shows one plain status line ("Walk 1,000 steps today to make it 6 days", "Today counts. Come back tomorrow…", "You missed yesterday. Walk 1,000 steps today and a Streak Shield will save your 5-day streak.", or "Your 5-day streak ended…"), a bar of today's steps toward the minimum, and the next reward ("Next reward: day 14, +350 coins (5 days to go)"). Rewards pay coins at 3, 7, 14, 30, 60 and 100 days.

**Streak Shields** (they replaced the Rest Day Token, the moon). Miss a day and your streak starts over, unless you hold a shield: each missed day uses one, automatically, the next time your steps count, so two shields cover two missed days in a row. You get a free shield every 7 streak days and can hold 2; buy one for 300 coins right on the streak card (or in Shop → Potions / Food). The card shows your shields as icons with one sentence on how they work, and the rules sit in a collapsed "How streaks work" section. A toast says "Streak saved" when a shield is used.

**Mood check-ins.** While you're walking, now and then (at most 3 a day, `D.MOOD`) a small card asks how you feel: Great, Good, Okay, Low or Rough. Pick one and the card turns over to a short word of encouragement matched to it (`D.MOOD_CHEER`, four lines per mood, never the same twice in a row): good moods get celebrated, low ones get acknowledged gently with no pressure to cheer up. It stays about 6 seconds with an Undo. Your moods show on Profile → Overview; Settings → Mood check-ins turns them off.

**Achievements** (Profile → Achievements, 73 in all): in-progress ones first, closest to done at the top, then the earned ones, newest first. On top of the original 26, a 47-badge **treasure-hunter set** (pirate icons; the rum bottle isn't used; `tools/prep_ach_pirate.py`) covers discovery (crates opened: chests; coins held at once: doubloon and coin stack; artifacts found including copies: chalice and treasure map; different artifacts discovered: map scrolls), exploring (worlds opened and fully explored: maps; distance walked: dividers, compass, sextant and pocket compass at 10, 42, 100 and 1,000 km; encounters: spyglasses; 1,000,000 steps: ship's wheel), streaks (anchor, flags at 7, 14 and 100 days), the Worldkey (keys for worlds opened with it and Worldkeys owned, a torch for tunings, gunpowder for artifacts used to charge the Worldkey), battle (cutlasses, rapier, daggers, cannons and cannonballs for battles won, kinds beaten, guardians, roaming bosses, five wins in a day and ranged shots fired; the hook for the Druid), and gear (crossbow and blunderbuss for weapons owned, pistols for repairs, hats for walkers owned). New running counts (`state.tally`) track artifacts found, artifacts used to charge, tunings, worlds opened with the Worldkey, shots fired and repairs.

- **Photo hunts were removed in 2.13**, along with the camera, the photo journal and the home-state setting (it only chose the state bird and flower photos). Their slots in the list are skipped, so every other mission keeps its id. A photo hunt that was running in an older save is retired quietly with no penalty, and the photos the journal kept on the device are cleared once.
- **Gathering runs (180):** items such as hawk feathers, brass gears or lucky coins turn up along the way as you walk.
- **Timed walks (60):** steps only count inside a window (sunrise, before 10 am, lunch, afternoon, golden hour, evening).
- **Multi-walk missions (60):** take 2–4 separate walks of a set length (a 20-minute break starts a new walk).
- **Distance runs (60):** cover a distance (it uses your stride setting).
- **New in 2.11 (35, ids `m601`–`m675`):** 20 **good deeds** (compliment someone, give $5 to someone who could use it, pick up litter, thank a worker by name…) and 15 **trail treks** (walk to the library, loop a lake, hike a nearby trail for 10,000 steps…). Deeds and treks are a new kind, `deed`: walk the steps, then tap **I did it** (honor system). Good deeds pay 30% more XP. They are woven into the board order across the first ~400 missions, so they turn up early.

The board offers the next four in order ("4 to pick from") and shows your three mission slots as boxes ("0 / 3 in use"). You can run three at a time, and you can skip or drop missions (they go to the back of the line). They get longer as you go, from about 650 steps to roughly 12,000, and every 25th pays a potion too. Missions live in `js/02c-missions.js`: edit the content lists there to change subjects, items or pacing.

### Merlin's quests

Merlin, a wandering owl-mage, now and then swoops down on the road (from level 3, at most once every couple of hours) and offers one of **210 harder quests**. They use the same kinds as field missions but ask for far more walking: gathering 10–26 arcane items, timed walks of 2,700–9,000 steps, 3–5 separate walks of 2,000–4,500 steps, and distance runs of 5–16 km. You get **48 hours**, and they pay **about 150–600 coins and 200–900 XP** (every 10th adds an Elixir). One Merlin quest runs at a time, on its own tab, Missions → Merlin, and it doesn't take a field-mission slot. Turning him down, handing a quest back or running out of time costs nothing; he offers it again another day. All quests stay on public sidewalks, parks and trails. Merlin's own music plays only while he is on screen. Quests live in `js/02d-merlin.js`.

### My missions

Players can turn real-life goals into missions. **New mission** offers 15 templates (daily workout, book outline, reading, study session, clean & tidy, meal prep, language or instrument practice, meditate & stretch, budget check-in, journal, job application, creative or coding project, call someone) or **Create your own**. Every mission has a name, optional notes, an optional checklist, a **due date and time** (with Tonight / Tomorrow / In 3 days / Next week shortcuts), a **difficulty** and a **priority**.

Completing one pays coins and XP: the difficulty sets the base (Easy 15 coins / 25 XP, Medium 30 / 45, Hard 55 / 80, Epic 90 / 130), the priority multiplies it (Low ×1, Medium ×1.15, High ×1.3, Urgent ×1.5), and the timing adjusts it: finishing early earns up to +25% (more the earlier you finish), on time pays in full, and late pays half. The form previews the reward. Difficulty and priority are locked when the mission is created, and rewards always use the original due time. Because Step Quest is a walking game, your own missions together pay at most **300 coins and 450 XP a day** (about what 3,000 steps earn; 10,000 steps earn 1,000 coins); past that they can still be completed, without a reward. A mission can be completed once it's 15 minutes old. Overdue missions get a one-time reminder; there is no penalty beyond the halved reward. Templates and numbers live in `js/05d-custom.js`.

## Sound and music

**Playing with your own music:** Settings has two switches, **Game music** and **Sound effects**. With Game music on, the browser asks iOS for the `playback` audio session (older iPhones: a silent looping audio track started on the first tap), so sounds play on the speaker even with the Ring/Silent switch on silent. With Game music off, the player is listening to their own music: no game music plays and `WB.Sfx.applySession()` (`js/04-steps.js`) switches to the `ambient` session, so sound effects layer on top of their music instead of pausing it. The installed iOS app sets `AVAudioSession` to `.playback` with `.mixWithOthers` (`native/scripts/patch-native.mjs`), so there both work at once. Old saves start Game music where their Sound & music switch was.

**Sound that stays on.** Phones stop Web Audio behind the game's back (iOS "interrupted" after a call, Siri, an alarm or the lock screen; a suspended context in the background; a context that runs silently after switching speakers or headphones). Every tap now resumes any context that isn't running, one that won't come back is replaced with a fresh one, coming back to the app wakes it, and a new audio device starts a new context. The music player also picks itself back up on the next tap when the phone paused it.

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
| Weapon impacts by kind, bow and spell launches, spell impacts by element, Wind Blade, shield blocks, poison/burn/curse/stun ticks, the three special attacks | synthesized by `tools/synth_sounds.py` (`sfx/hit_*`, `spell_*`, `status_*`, `special_*`, `bow_release`, `wind_blade`, `shield_block`) |
| First open (and after a reset), from the loading screen until the tutorial ends | `music/app_theme.mp3` |
| Worldkey tuned (the symbol game locks in) | `sfx/wk_tuned.mp3` |
| Charging the Worldkey | by the strongest artifact used: `sfx/dm_void.mp3` (early worlds), `sfx/dm_nebula.mp3` (level 10+), `sfx/dm_eclipse.mp3` (level 25+) |
| The Worldkey's first road remark each visit | `sfx/wk_comms.mp3` (a short wrist-comms crackle and two beeps, `tools/synth_sounds.py`); later remarks use the soft chirp |
| Battles | a random track from 12, never the same one twice in a row. The four defaults come up 3x as often: the app theme (`app_theme`), Battle Music 1 (`battle_default_1`, the previous app song), the 2nd default (`battle_default_2`) and Video Game Music (`battle_default_3`). The others: `battle_2/4/6/8`, Valhalla (`battle_valhalla`), The Minstrel's Return (`battle_minstrel`), Under the Elven Star (`battle_elven`) and Unworthy (`battle_unworthy`) |
| Battles from level 40 (`D.EPIC_MUSIC_LEVEL`) | the same rotation plus Redemption (`battle_epic_1`) and Cold Fire (`battle_epic_2`), 2x each |
| While Merlin is on screen | `music/merlin.mp3` |

The app song is the theme: on a first open (or after a reset) it starts on the loading screen and plays until the tutorial ends or is skipped. Browsers only allow sound after a tap, so when autoplay is blocked the loading screen waits with a **Tap to start** button (the native app lets its web view autoplay; see `native/scripts/patch-native.mjs`). Music streams (it isn't part of the offline download). Profile → Settings → Appearance & sound has a **Game music** switch (and a separate **Sound effects** switch). Browsers only allow audio after a tap, so the welcome song starts on the first tap if autoplay is blocked.

## Celebrations

Level-ups, achievements and every completed mission (daily, milestone, delivery, field, Merlin's or your own) fire a short burst of pixel confetti and a warm message that changes each time: it uses your name, the time of day, today's steps, your streak and what you just did. Confetti waits until a battle is over and is skipped with Reduce motion.

## Tutorial and tips

New players get a guided tour right after sign-up (existing players see it once after updating). It visits every page and highlights each feature: the HUD, the world, today's steps, health, the step counter, objectives, the map, all mission types, the Shop and Inventory pages, battles and the Profile. A **Skip tutorial** button sits at the top of every step (Back on the phone ends it too), and it can be replayed from **Profile → Settings → Help → Watch tutorial**. While any sheet, battle, the tutorial or onboarding is open, the page behind it can't scroll. A discovery on the road stays on screen for 40 seconds, with a × to close it sooner. The first time a player's HP drops to 35% or below, a one-time note at the top of the screen explains how to heal (wait about 15 minutes, or drink a potion; walking doesn't heal), with a Potions button. It never covers the screen, and if it happens in a fight it waits until the battle is over.

## Worlds and levels

There are 50 worlds, and they open **one at a time**: each needs a level (spread from Rust Hollow at level 1 to the Fort of Illusion at level 70, `D.LAST_WORLD_LEVEL`) **and** the world before it explored to 75% (`D.WORLD_GATE_PCT`; the world after Rust Hollow needs Rust Hollow at 100%, `D.FIRST_WORLD_PCT`). The world screen and the map show both requirements, ticking each one off, and roughly how many steps away the next world is. Worlds are 2.5× longer than at launch (`D.WORLD_LENGTH_MULT`) and encounters come every 600–1,000 steps. Creatures and guardians **fight at your level** (`D.worldTier`, `js/02-data.js`): a world's creatures use the tier of a world that opens at your level, or the world's own tier when that's higher. Going back to an old world to farm artifacts is still a real fight, and walkers past the last world (level 70) keep meeting even fights up to 80. At every level a creature takes about 2 good hits and hits for 8–11% of your HP; a guardian takes about 10 and hits for 16–20%. Battle XP and coins, and the coins a loss costs you, use the same tier. Roaming bosses and the Rival already followed your level. Every world has a guardian and a few artifacts to find.

## Walkers and pets

Pets cost 400–5,000 coins and unlock between levels 2 and 20 (some come from streaks, steps, the daily reward or guardians instead). In battle a pet jumps in and takes 20–60% of each hit until its own HP runs out; Rex, Rusty, Pup Hyena, Glass Scorp and Tusk also attack automatically, each for different damage. Every Shop section is sorted by what it takes to unlock (starters, then level, then cost). Buying or unlocking a walker never equips it: the unlock note's **See it** button opens it in Shop → Walkers. Walkers cost 1,500–12,000 coins and level-unlocked ones open between levels 9 and 40.

At sign-up a player picks one of three classic walkers (Scavenger, Wandering Mage, Healer) and a skin tone. Only the one you pick is yours: the other two starters are locked until **level 5**, then cost 1,500 coins each (the sign-up screen says so). Every other walker (47 in all, including the Knight, the Ranger, Warrior, Shadow Archer, Ronin, Leaf Ranger, Executioner, Blaze, Huntress, Crimson Duelist and Shadow Knight) is unlocked later with coins, levels, streaks or exploration. The newest seven (`tools/prep_avatars2.py`): **Adventurer** (level 4, 1,800 coins; the pack only has a run cycle, so its idle is a breathing bob and its attack a lunge), **Goblin Pathfinder** (level 9, 2,600), **Spore Walker** (the mushroom, level 11, 3,400), **Skeleton Squire** (level 15, 4,600), **Watcher** (the flying eye, hovers a little off the ground; level 21, 6,500), **Iron Knight** (Tank Knight colour 1; level 27, 8,500) and **Steel Knight** (colour 2; a 30-day streak).


The **Ranger** (level 15, 4,200 coins) uses the newer human_ranger sprites: sword and shield, green tunic and a magenta scarf (Outfit dyes the tunic, Trim the scarf and blade). It is the first walker with its own death animation, which plays when you fall in battle (other walkers still slump with their hurt frame). Rebuild it with `python3 -I tools/replace_ranger.py <human_ranger_dir>`.

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
js/02c-missions.js       the 395 field missions
js/02d-merlin.js         Merlin's 210 harder quests
js/03-state.js           save data and persistence
js/04-steps.js           step tracking sources, wake lock, sound hooks
js/04b-health.js         automatic step sync (Apple Health / Health Connect) in the installed app
js/05-game.js            game rules: rewards, leveling, streaks, missions, encounters, shop, HP
js/05b-battle.js         battle rules (pure logic: moves, weapons, status effects, guardians)
js/05c-missions.js       field mission rules (progress, board, deeds)
js/05d-custom.js         your own missions: templates, due dates, difficulty, priority, rewards
js/05e-eggs.js           eggs: finding, breaking, Merlin's trades
js/02e-quiz.js           the Druid's 945 Knowledge Challenge questions
js/05f-druid.js          the Druid: questions, rewards, taking your eggs
js/05i-gear.js           shots, magic uses, melee wear and repair, pet deaths, artifact copies
js/06-engine.js          canvas renderer: parallax worlds, avatar, pets, particles
js/07-ui.js              screens (incl. Shop, Inventory), HUD, sheets, toasts
js/07b-battle-ui.js      battle screen
js/07d-missions-ui.js    Missions → Field and Merlin (missions, milestones, deliveries)
js/07e-custom-ui.js      "My missions": create, edit, check off and complete your own missions
js/07f-tour.js           the guided tutorial and the one-time low-health tip
js/07h-eggs.js           egg counts and Merlin's trade cards (Missions → Merlin)
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
assets/wi/               weapon icons (melee, ranged, shields, belts)
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
- **Colors (skin tone + outfit dyes):** one **Colors** slot in Profile → Loadout opens a single sheet with up to three rows: **Skin tone** (shared by every walker that shows skin), **Outfit** (main clothing or armor) and **Trim** (a second garment, cape, scarf or accents), each with Original plus the swatches. It is available from the start (no level gate). The skin tone picked at sign-up stays. Outfit dyes (11 in `D.DYES`) are saved per walker in `state.outfit[walkerId] = { o, t }`. `D.OUTFIT_MAP` lists the exact sheet colors each slot recolors (picked by hand per walker; a leading `^` limits a color to below the head when it is shared with hair or a skull). `WB.recolor` (`js/06-engine.js`) applies skin tone and dyes in one pass, keeping the art's shading. 52 of 53 walkers have outfit colors; the Shadow Knight shows only the Skin tone row.
- **Creatures:** `D.CREATURES` sets HP, attack and whether each one is aggressive. Each world has a `pool` and a `boss`.
- **Weapons and potions:** `D.WEAPONS` (power, recharge turns, effect) and `D.POTIONS`.
- **Balance:** `COINS_PER_STEP`, `XP_PER_STEP`, `xpToNext`, `heroMaxHp`, `heroAtk`, `creatureStats`, world `length` and `unlock` level.

## Shipping updates

Before every deploy, stamp a new version:

```bash
python3 -I tools/stamp_version.py 2.12.2
```

It writes the version into `index.html` (`WB.VERSION`, and `?v=` on the stylesheet and every script) and into `sw.js` (the `CACHE` name and the matching precache URLs). Versioned URLs mean a phone can never run old cached scripts with a new page. The page itself is revalidated with the server on every launch, the app checks for a new version each time it's reopened, and when one has installed it reloads once at a safe moment (never mid-battle, in a sheet, the tutorial or sign-up) and shows an "Updated · Step Quest 2.12.2" note. The running version is at the bottom of Profile → Settings.

**The installed iPhone/Android app** (built from `native/`) carries its own copy of the web files: after changing the game, run `npm run sync` in `native/` and rebuild it in Xcode or Android Studio (or re-run the Android workflow). Deploying to GitHub Pages doesn't update it.

Saves from earlier versions upgrade automatically. Auras and dyes were retired in 2.0; players who bought them get their coins back. Since 2.2 worlds open by level; worlds a player already unlocked stay open.

## Saves

Progress is stored on the phone (browser local storage, or the installed app's storage). Clearing site data or uninstalling erases it. There are no accounts and no server.

## Credits and licenses

See `CREDITS.md`. The art comes from CraftPix.net free packs. Check their license before you redistribute the assets or ship commercially.
