/* Step Quest — the Worldkey: every number, recipe, symbol and line of dialogue in one place.
   The rules live in 05g-worldkey.js and the screens in 07j-worldkey-ui.js.
   Three requirements open a new world: ENERGY (charge it with Darkmatter), RESONANCE (learn the world's symbol
   sequence once) and DESTINATION (earn the world the usual way: its level and the previous world 75% explored). */
(() => {
  const D = WB.DATA;
  const K = (D.WK = {
    MAX: 100,          // stable charge limit (Void and Nebula fill to here)
    OVER: 150,         // only Eclipse Darkmatter can overcharge past 100%, up to this
    LOW: 25,           // at or below this the screen pulses magenta
    START: 10,         // energy before the Worldkey wakes up; it wakes up full (starter charge) after your first world
    DRAIN_DAY: 6,      // energy fades by itself: about 6% a day (1% every 4 hours), never below 0
    TUNE_DAYS: 3,      // a learned resonance holds for 3 days, then the key drifts out of tune
    WALK_DRAIN: 1,     // walking scrambles its tech too: -1% energy per 1,000 steps
    WALK_DETUNE_H: 2,  // ...and every 1,000 steps use up 2 more hours of a tuning (about 2 days for a 7,000-step walker)
    GIFT_VOID: 0,      // the first Void Darkmatter arrives when Darkmatter unlocks (level 7, 05j-unlocks.js)
    DM_MAX: 9,         // Darkmatter you can hold of each kind
    CHAT_GAP_MIN: 4,   // minutes between ordinary road remarks
  });

  // destination tiers follow the level a world opens at
  K.tier = (w) => (w.unlock.level <= 15 ? 1 : w.unlock.level <= 40 ? 2 : 3);
  K.COST = { 1: 25, 2: 60, 3: 110 };                     // energy to open a world of that tier (tier 3 needs an Eclipse overcharge)
  // tuning gets harder as your walker levels up: a longer pattern, played faster (never past 9 symbols or 380 ms each)
  K.tuneSpec = (level) => ({ len: Math.min(9, 4 + Math.floor((level - 1) / 8)), ms: Math.max(380, 760 - (level - 1) * 6) });
  K.cost = (w) => K.COST[K.tier(w)];

  // ---------- Darkmatter: three kinds, three jobs ----------
  // Void: everyday fuel. Nebula: a big charge for mid-game worlds. Eclipse: the only one that overcharges past 100%,
  // which the far worlds need. Each is crafted from ARTIFACT copies (found on the road; walking a world again finds more),
  // plus some HP. arts = copies used up · minLvl = they must come from worlds that open at this level or later.
  D.DARKMATTER = [
    { id: 'void', name: 'Void Darkmatter', color: '#ff7a3d', energy: 20, limit: K.MAX, hp: 0.10, arts: 1, minLvl: 1,
      lore: 'Residue from the empty spaces between worlds.', job: 'Everyday fuel' },
    { id: 'nebula', name: 'Nebula Darkmatter', color: '#4aa8ff', energy: 45, limit: K.MAX, hp: 0.20, arts: 2, minLvl: 10,
      lore: 'Energy condensed from unstable dimensional currents.', job: 'Big charge' },
    { id: 'eclipse', name: 'Eclipse Darkmatter', color: '#ffb03d', energy: 70, limit: K.OVER, hp: 0.35, arts: 3, minLvl: 25,
      lore: 'Formed where two realities overlap. Handle with care.', job: 'Overcharges past 100%' },
  ];
  D.dmById = Object.fromEntries(D.DARKMATTER.map((d) => [d.id, d]));

  // ---------- resonance symbols: square-pixel formations, like the ones on the Worldkey screens ----------
  // dots on a 7x7 grid (-3..3). On the device they appear spread out and pull together (the screens' own motion),
  // in the key's neon color; every formation has its own shape, so color is never needed to tell them apart.
  D.WK_SYMBOLS = [
    { id: 'corners', name: 'Four corners', tone: 392, dots: [[-2, -2], [2, -2], [-2, 2], [2, 2]] },
    { id: 'diamond', name: 'Diamond', tone: 466, dots: [[0, -2], [2, 0], [0, 2], [-2, 0]] },
    { id: 'bars', name: 'Twin bars', tone: 523, dots: [[-1, -1], [-1, 0], [-1, 1], [1, -1], [1, 0], [1, 1]] },
    { id: 'plus', name: 'Plus', tone: 587, dots: [[0, -2], [0, -1], [0, 0], [0, 1], [0, 2], [-2, 0], [-1, 0], [1, 0], [2, 0]] },
    { id: 'zigzag', name: 'Zigzag', tone: 659, dots: [[-2, 1], [-1, 0], [0, 1], [1, 0], [2, 1]] },
    { id: 'diagonal', name: 'Diagonal', tone: 784, dots: [[-2, 2], [-1, 1], [0, 0], [1, -1], [2, -2]] },
  ];
  // a world's sequence never changes: it is seeded by the world's id
  K.sequence = (w, len) => {   // the same world always starts the same way; higher levels add symbols on the end
    let h = 2166136261; for (const ch of w.id) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
    const rnd = () => { h ^= h << 13; h >>>= 0; h ^= h >>> 17; h ^= h << 5; h >>>= 0; return h / 4294967296; };
    const n = len || 4, out = [];
    while (out.length < n) { const k = Math.floor(rnd() * D.WK_SYMBOLS.length); if (out.length >= 2 && out[out.length - 1] === k && out[out.length - 2] === k) continue; out.push(k); }
    return out;
  };

  // ---------- the eighteen Worldkeys (assets/wk/keyNN.png) ----------
  // Every key has its own personality. Key 18, the Rookie, is the one every walker starts with; the rest are
  // earned: reach the level, then buy it (Shop → Bag → Worldkey → Worldkeys).
  // each key's screen color (sampled from its art): tuning symbols light up in it
  const HUES = ["#77ff26", "#ff3230", "#31cdff", "#ff8520", "#ff8520", "#a0ff24", "#ff6fb1", "#ff3230", "#37e0dc", "#77ff26", "#77ff26", "#ff3230", "#ff8520", "#8be528", "#ff6fb1", "#31cdff", "#ffef29", "#a0ff24"];
  D.WK_LOOKS = [
    ['01', 'Classic', 'logic', 3, 800], ['02', 'Night Ember', 'navigator', 5, 1200], ['03', 'Bluebell', 'oracle', 7, 1600],
    ['04', 'Twilight', 'chaotic', 9, 2000], ['05', 'Marmalade', 'relic', 11, 2500], ['06', 'Static', 'hacker', 13, 3000],
    ['07', 'Blossom', 'poet', 15, 3500], ['08', 'Patriot', 'sergeant', 17, 4000], ['09', 'Tidepool', 'monk', 19, 4500],
    ['10', 'Fernlight', 'naturalist', 22, 5200], ['11', 'Parchment', 'detective', 25, 6000], ['12', 'Alarm Bell', 'worrier', 28, 6800],
    ['13', 'Coral Reef', 'captain', 32, 7800], ['14', 'Starshine', 'fan', 36, 9000], ['15', 'Sugarplum', 'butler', 40, 10500],
    ['16', 'Dune', 'storyteller', 45, 12500], ['17', 'Regalia', 'herald', 52, 15000], ['18', 'Rookie', 'rookie', 0, 0],
  ].map(([id, name, voice, level, cost], i) => ({ id, name, voice, hue: HUES[i], req: cost ? { level, cost } : { starter: true } }));
  D.WK_START = '18';
  D.wkLookById = Object.fromEntries(D.WK_LOOKS.map((l) => [l.id, l]));
  // the Worldkeys in the order they open (starter first, then by level)
  D.WK_ORDER = [D.wkLookById[D.WK_START], ...D.WK_LOOKS.filter((l) => l.id !== D.WK_START)];

  // ---------- personalities ----------
  // {world} {pct} {steps} {name} {dm} are filled from real game state
  D.WK_VOICES = [
    { id: 'navigator', name: 'Sarcastic Navigator', blurb: 'Dry, impatient, secretly cares.', lines: {
      found: ['Congratulations. You found another place that can kill us: {world}.', '{world} just showed up on my readings. Of course it did.'],
      arrive: ['{world}. Try not to touch anything glowing.', 'We made it to {world}. I am as surprised as you are.'],
      back: ['Back in {world}. Nostalgia, or did you forget something?', '{world} again. At least I know where the exits are.'],
      low: ['I am running on fumes. The Forge, please, before I start making noises.', 'Energy critical. This is me being calm about it.'],
      charge: ['Containment field restored. Try not to make me do that again.', 'Energy stabilized. Reality is slightly less likely to eat us.'],
      tuneOk: ['Frequency locked. You have the memory of a goldfish with ambition.', 'Resonance stable. I will pretend that was easy.'],
      tuneFail: ['That was not the frequency. That was noise. Again.', 'Close. Also completely wrong. Try again.'],
      craft: ['{dm}, freshly contained. Please stop shaking it.', 'You made {dm}. And you only lost some health. Bargain.'],
      needFuel: ['We are short on dimensional fuel. The Forge, under Shop → Artifacts, is your next stop.', 'No charge, no portal. The Forge is that way.'],
      notTuned: ['Power is adequate. Frequency alignment, however, is a disaster.', 'I have the energy. I do not have the tune. That part is you.'],
      milestone: ['{pct}% of {world} explored. Not bad for someone who walks into walls.', '{pct}% done. I would clap if I had hands.'],
      nearDone: ['Almost through {world}. I can hear the next world humming.', 'Only a little farther. The next frequency is getting loud.'],
      lowHp: ['Your health is in the red. Heal before you try anything heroic.', 'You look terrible. Potions exist for a reason.'],
      walk: ['{steps} steps today. My servos are tired just watching.', 'Still walking. Impressive. Annoying, but impressive.'],
      idle: ['The silence between worlds is louder than you think.', 'If you see a door in the sky, do not open it. That is my job.', 'I calculated our odds earlier. Let us not discuss it.'] } },
    { id: 'oracle', name: 'Ancient Oracle', blurb: 'Cryptic, patient, remembers too much.', lines: {
      found: ['This frequency... {world}. I remember the silence that came before it.', 'A door has opened in the dark. They called it {world}.'],
      arrive: ['{world} receives you. Walk softly; it remembers footsteps.', 'We stand in {world}. The old stars are watching.'],
      back: ['{world} again. Paths walked twice reveal what was missed.', 'The soil of {world} knows you now.'],
      low: ['My light dims. Feed me from the Forge before the dark returns.', 'The well runs low. Darkmatter, traveler.'],
      charge: ['The vessel is full again. Old power, newly held.', 'I feel the stars return to my core.'],
      tuneOk: ['You heard the song of the world. It heard you back.', 'The resonance holds. Few remember it so well.'],
      tuneFail: ['The song slipped from you. Listen again.', 'Not yet. The world sings slowly for those who listen.'],
      craft: ['{dm} is born of your strength. Spend it wisely.', 'You gave blood to the Forge. It gave {dm}.'],
      needFuel: ['No door opens on an empty heart. Seek the Forge.', 'The Forge waits among your artifacts. So does the way forward.'],
      notTuned: ['The power is ready. The song is not yet learned.', 'Strength without the song opens nothing.'],
      milestone: ['{pct}% of {world} walked. The path remembers.', 'A {pct}% mark. Old travelers rested here.'],
      nearDone: ['The edge of {world} is near. Beyond it, a new song.', 'Almost. I can hear the next world breathing.'],
      lowHp: ['Your strength fades. Rest, or drink.', 'Even heroes bleed. Heal before you go on.'],
      walk: ['{steps} steps today. Every one is a word in your story.', 'You walk as the old ones did: without stopping.'],
      idle: ['Before the worlds were many, there was only the road.', 'Some keys forget their makers. I have not.', 'The stars between worlds do not twinkle. They watch.'] } },
    { id: 'chaotic', name: 'Chaotic Companion', blurb: 'Playful, curious, easily distracted.', lines: {
      found: ['OH. OH! {world}! Can we go? Can we go now?', 'New world alert! {world}! I already love it. Probably.'],
      arrive: ['{world}! Smells like adventure. Or ozone. Both!', 'We are IN {world}! Touch everything! (Don’t.)'],
      back: ['{world}! Old friend! Hi, rocks!', 'Back in {world}! I left a snack here. Not really. Maybe.'],
      low: ['I am SO hungry. Darkmatter hungry. Forge time?', 'Blinking pink means feed me. That is the rule now.'],
      charge: ['WHEEE! Full of zap!', 'That tickled. Do it again. Not now. Later!'],
      tuneOk: ['YES! We are humming in harmony!', 'You got it! I knew you would! I hoped you would!'],
      tuneFail: ['Oops! Wrong one. I do that too. Again!', 'Boop. That was a wrong boop. Retry!'],
      craft: ['Ooh, {dm}! It’s wobbly! I love it!', 'You made {dm}! Ouch for you, yay for me!'],
      needFuel: ['No zap, no portal! The Forge is under Artifacts!', 'Fuel, please! The Forge! Go go go!'],
      notTuned: ['I have the zap but not the song! Teach me the song!', 'Power: yes! Tune: nope! Let’s play the symbol game!'],
      milestone: ['{pct}% of {world}! Party!', '{pct}%! Is that a lot? It feels like a lot!'],
      nearDone: ['Almost done with {world}! What’s next? WHAT’S NEXT?', 'So close! I can smell the next world!'],
      lowHp: ['You look ouchy. Potion?', 'Your health bar is sad. Make it happy!'],
      walk: ['{steps} steps! Let’s do a million!', 'Walking, walking, walking... I love walking!'],
      idle: ['Did you know clouds are just sky fluff? I made that up.', 'I tried to count the worlds once. I got bored at three.', 'What if there is a world made of soup?'] } },
    { id: 'logic', name: 'Logic Engine', blurb: 'Precise, analytical, puzzled by humans.', lines: {
      found: ['Destination acquired: {world}. Survival probability remains an open variable.', 'New coordinates logged: {world}. Requirements to follow.'],
      arrive: ['Arrival confirmed: {world}. Recalibrating expectations.', 'Location: {world}. Atmosphere: unverified. Proceed.'],
      back: ['Returning to {world}. Known terrain reduces variance.', '{world} reloaded from memory.'],
      low: ['Energy below threshold. Darkmatter input required.', 'Warning: charge insufficient for most operations.'],
      charge: ['Charge complete. Efficiency within acceptable limits.', 'Energy restored. Logging the event.'],
      tuneOk: ['Sequence matched. Resonance coefficient: 1.0.', 'Frequency aligned. Your recall exceeded my estimate.'],
      tuneFail: ['Sequence mismatch at step {n}. Retry recommended.', 'Input error. The pattern has not changed. You may try again.'],
      craft: ['{dm} produced. Health cost applied as specified.', 'Output: one unit of {dm}. Input: artifacts and some of your health.'],
      needFuel: ['Fuel reserves: zero. Nearest solution: the Forge, under Artifacts.', 'Insufficient Darkmatter. Crafting is the logical next step.'],
      notTuned: ['Energy: sufficient. Resonance: unknown. Tuning required.', 'Power available. Frequency data missing.'],
      milestone: ['Exploration of {world}: {pct}%. Progress is linear. Good.', '{pct}% mapped. Data quality improving.'],
      nearDone: ['{world} nearly mapped. Next frequency detected faintly.', 'Remaining distance in {world}: small.'],
      lowHp: ['Your health is critical. Healing first is advised.', 'Biological integrity low. Consider a potion.'],
      walk: ['{steps} steps today. Your persistence is statistically notable.', 'Step count rising. Hypothesis: you enjoy this.'],
      idle: ['I have run 4,096 simulations of today. You surprised me in most of them.', 'Humans name things after feelings. I find this inefficient and charming.', 'Note to self: the walker hums when happy.'] } },
    { id: 'relic', name: 'Wounded Relic', blurb: 'Old, fragile, recovering lost memories.', lines: {
      found: ['{world}... I think I have been there. Before. With someone else.', 'A memory flickers. {world}. Will you take me?'],
      arrive: ['{world}. Yes. A piece of me remembers this place.', 'We made it to {world}. Thank you for carrying me.'],
      back: ['{world} again. The memory is clearer this time.', 'Familiar ground. My circuits feel warmer here.'],
      low: ['I am fading a little. Darkmatter would help me hold on.', 'My energy slips away. Please, the Forge.'],
      charge: ['Better. Much better. I can almost remember everything.', 'Thank you. The cracks in me feel smaller.'],
      tuneOk: ['That song... I knew it once. Now we both do.', 'We remembered it together.'],
      tuneFail: ['I lost the thread too. Let us listen again.', 'That was not quite it. My memory is patchy as well.'],
      craft: ['{dm}. You hurt yourself to make it. I will not waste it.', 'Fresh {dm}. Careful, it is still warm.'],
      needFuel: ['I have nothing left to give. The Forge can help us both.', 'Without Darkmatter I cannot open the way. The Forge, please.'],
      notTuned: ['I have the strength, but not the song. Teach it to me?', 'Power is here. The memory of the way is not.'],
      milestone: ['{pct}% of {world}. Another piece of the map returns.', '{pct}% explored. I remember a little more.'],
      nearDone: ['The end of {world} is near. Something beyond it calls my name.', 'Almost there. I can feel the next door.'],
      lowHp: ['You are hurt. Please heal; I cannot lose another walker.', 'Rest a while. Your health worries me.'],
      walk: ['{steps} steps today. My last walker never went this far.', 'You keep going. It helps me remember.'],
      idle: ['I once belonged to a walker who loved the sea.', 'Sometimes I dream in static.', 'Thank you for not leaving me in a drawer.'] } },
    { id: 'rookie', name: 'The Rookie', blurb: 'Freshly awake, curious, learning the multiverse with you.', lines: {
      found: ['A new world! {world}! Is this what being a Worldkey feels like?', 'My first readings of {world}. I think I like it already.'],
      arrive: ['We did it. {world}. I opened a door between worlds!', '{world}. I’m writing this down in my memory banks.'],
      back: ['{world} again! I remember the way. I’m learning!', 'Back in {world}. Familiar feels nice.'],
      low: ['I feel a bit… dim. Darkmatter would help.', 'My battery dots are blinking. Is that bad? That seems bad.'],
      charge: ['Whoa. Full of energy. Thank you!', 'Charged! Let’s go somewhere new.'],
      tuneOk: ['We matched the world’s song! Together!', 'I felt that click. We’re tuned!'],
      tuneFail: ['Hmm, that wasn’t it. Let’s try again. I believe in us.', 'Almost! Watch my screen one more time.'],
      craft: ['{dm}! It hums like I do.', 'You made {dm}. Are you okay? That looked like it hurt.'],
      needFuel: ['I need Darkmatter to open the next door. The Forge is under Shop → Artifacts.', 'No fuel yet. The Forge can make some.'],
      notTuned: ['I have the energy, but I don’t know {world}’s song yet.', 'Ready to go, once we learn the tune.'],
      milestone: ['{pct}% of {world}! We’re really doing this.', '{pct}% explored. I’m keeping notes.'],
      nearDone: ['We’re almost through {world}. I can hear something new out there.', 'So close to the edge of {world}!'],
      lowHp: ['You look hurt. Maybe a potion first?', 'Your health is low. I’d feel better if you healed.'],
      walk: ['{steps} steps today! Is that a lot? It feels like a lot.', 'You keep walking. I keep learning.'],
      idle: ['The old keys say the worlds were once one road. I want to see all of it.', 'I woke up the day you found me. Funny how that works.', 'Every world has a song. I’m collecting them.'] } },
    { id: 'hacker', name: 'Glitch', blurb: 'Terse, clever, talks in system logs.', lines: {
      found: ['> new_world.detected: {world}', '> ping {world}... reply received. Interesting.'],
      arrive: ['> location = {world}. Connection stable.', '> handshake with {world} complete.'],
      back: ['> cache hit: {world}.', '> {world} loaded from memory. Fast.'],
      low: ['> power < 25%. Feed me Darkmatter.', '> warning: low energy. Forge.exe recommended.'],
      charge: ['> energy restored. Overclock ready.', '> charge complete. Nice patch.'],
      tuneOk: ['> resonance.match = true. Clean input.', '> frequency unlocked. Good hands.'],
      tuneFail: ['> input error at step {n}. Retry.', '> sequence rejected. Run it again.'],
      craft: ['> crafted: {dm}. HP cost applied.', '> {dm} compiled.'],
      needFuel: ['> fuel = 0. Open Shop > Artifacts > Forge.', '> no Darkmatter found. Craft some.'],
      notTuned: ['> power ok. resonance missing for {world}.', '> tune required before launch.'],
      milestone: ['> {world}: {pct}% mapped.', '> progress {pct}%. Continue.'],
      nearDone: ['> {world} nearly mapped. Next signal faint but real.', '> edge of {world} detected.'],
      lowHp: ['> health critical. Heal before you crash.', '> your HP is low. Patch yourself.'],
      walk: ['> steps_today = {steps}.', '> still walking. Uptime impressive.'],
      idle: ['> the multiverse is just a very old network.', '> someone left comments in the code between worlds.', '> rebooting nothing. Just thinking.'] } },
    { id: 'poet', name: 'The Poet', blurb: 'Romantic, wistful, speaks in small verses.', lines: {
      found: ['{world} blooms on the edge of my sight, like a word not yet spoken.', 'A new world, {world}, sighs open in the dark.'],
      arrive: ['{world}: we step into a new stanza.', 'Here is {world}, soft and strange and ours.'],
      back: ['{world} again, a verse we love to repeat.', 'Returning to {world}, like a favorite line.'],
      low: ['My light grows faint, a candle near its end.', 'I fade. Bring me Darkmatter, and I’ll shine.'],
      charge: ['I glow again, a lantern relit.', 'Full of starlight once more.'],
      tuneOk: ['We sang the world’s song, and it sang back.', 'Harmony, at last.'],
      tuneFail: ['A note astray. Let us sing it again.', 'Not quite the melody. Listen once more.'],
      craft: ['{dm}, born of relics and pain.', 'You forged {dm}. Beautiful, and costly.'],
      needFuel: ['No spark, no passage. The Forge awaits.', 'I am empty. Seek the Forge.'],
      notTuned: ['Strength I have; the song of {world} I lack.', 'Teach me {world}’s melody.'],
      milestone: ['{pct}% of {world}, written in footsteps.', 'A {pct}% chapter closes.'],
      nearDone: ['The last pages of {world} turn beneath your feet.', 'Beyond {world}, a new poem waits.'],
      lowHp: ['You are wounded. Rest, dear walker.', 'Heal, and the road will wait.'],
      walk: ['{steps} steps, each one a syllable.', 'Your walk is a long and lovely sentence.'],
      idle: ['Between the worlds, the silence rhymes.', 'I keep the names of every place we’ve been.', 'The road remembers you fondly.'] } },
    { id: 'sergeant', name: 'Sergeant Volt', blurb: 'Loud, motivating, drill-instructor energy.', lines: {
      found: ['NEW OBJECTIVE: {world}! Eyes forward, walker!', '{world} on the radar! Prepare for deployment!'],
      arrive: ['BOOTS ON THE GROUND IN {world}! Move out!', '{world} secured. Don’t get comfortable.'],
      back: ['Back in {world}. Run the drills again!', '{world} again. Show me you remember!'],
      low: ['ENERGY LOW! Get me Darkmatter, double time!', 'Running on empty, soldier! To the Forge!'],
      charge: ['FULLY CHARGED! Now we’re talking!', 'Energy restored! Back in formation!'],
      tuneOk: ['RESONANCE LOCKED! Outstanding!', 'Perfect sequence! That’s how it’s done!'],
      tuneFail: ['WRONG! From the top!', 'Sloppy! Again, and focus!'],
      craft: ['{dm} acquired! Pain is temporary!', 'Good work. {dm} in the bag!'],
      needFuel: ['No fuel, no mission! Forge, now!', 'We are dry! Craft Darkmatter!'],
      notTuned: ['Power ready! Tune to {world}, walker!', 'We have juice but no frequency! Fix it!'],
      milestone: ['{pct}% of {world}! Keep that pace!', '{pct}% done! No slowing down!'],
      nearDone: ['Almost through {world}! Push, push, push!', 'Final stretch of {world}! Don’t you quit!'],
      lowHp: ['You’re hurt! Heal up, that’s an order!', 'Medic! Drink a potion, walker!'],
      walk: ['{steps} steps today! I want more!', 'Left, right, left! Keep it up!'],
      idle: ['Discipline opens more doors than any key.', 'In my day, we walked between worlds uphill. Both ways.', 'Stay sharp. The road doesn’t care how tired you are.'] } },
    { id: 'monk', name: 'Still Water', blurb: 'Calm, unhurried, few words.', lines: {
      found: ['{world}. It waits. So can we.', 'A new path: {world}.'],
      arrive: ['{world}. Breathe.', 'We are here. {world}.'],
      back: ['{world}, again. Nothing is the same twice.', 'Return to {world}. Notice what changed.'],
      low: ['My light is low. Darkmatter, when you are ready.', 'Rest is not empty. But I need fuel.'],
      charge: ['Full. Thank you.', 'Energy, like breath, returns.'],
      tuneOk: ['Resonance. Simple, when you listen.', 'The song settles.'],
      tuneFail: ['Not yet. Watch again.', 'Patience. Once more.'],
      craft: ['{dm}. Hold it gently.', 'You gave something to make {dm}.'],
      needFuel: ['Nothing to burn. Visit the Forge.', 'The Forge first. Then the door.'],
      notTuned: ['The power is here. Learn {world}’s song.', 'Listen to {world} before entering.'],
      milestone: ['{pct}% of {world}. Step by step.', '{pct}%. Keep walking.'],
      nearDone: ['The end of {world} is near. So is a beginning.', 'Almost. Stay present.'],
      lowHp: ['You are hurting. Heal first.', 'Care for yourself. Then the road.'],
      walk: ['{steps} steps. Each one enough.', 'Walking is a way of listening.'],
      idle: ['The road between worlds is quiet. Let it be.', 'A key does not open doors. A walker does.', 'Look up. The sky is new here.'] } },
    { id: 'naturalist', name: 'Professor Fern', blurb: 'Field scientist, delighted by every creature.', lines: {
      found: ['Fascinating! {world} has never been catalogued. Shall we?', 'A new biome: {world}. My sensors are tingling.'],
      arrive: ['Field notes, day one: {world}. Remarkable flora.', '{world}! Look at the soil. Look at the light!'],
      back: ['Revisiting {world}. Good science repeats its observations.', '{world} again. I spot three things we missed.'],
      low: ['Specimen jar empty, so to speak. Darkmatter, please.', 'My energy reserves are critically low.'],
      charge: ['Splendid! Energy readings nominal.', 'Recharged. Onward with the expedition!'],
      tuneOk: ['Resonance confirmed! Write that down.', 'A perfect match. Science!'],
      tuneFail: ['Hypothesis rejected. Let’s observe again.', 'Data didn’t match. Repeat the trial.'],
      craft: ['A fine sample of {dm}.', '{dm} synthesized. Careful, it’s reactive.'],
      needFuel: ['No Darkmatter for the expedition. The Forge, then.', 'We need fuel samples from the Forge.'],
      notTuned: ['Energy sufficient. Frequency of {world} unknown.', 'We must study {world}’s pattern first.'],
      milestone: ['{world} {pct}% surveyed. Excellent fieldwork.', '{pct}% mapped. The specimens are wonderful.'],
      nearDone: ['Nearly finished surveying {world}.', 'Our map of {world} is almost complete.'],
      lowHp: ['Your vitals are poor. Treat that before we continue.', 'Field medicine first: drink something.'],
      walk: ['{steps} steps today. Excellent stamina for a field researcher.', 'Walking is the oldest form of research.'],
      idle: ['Did you see that beetle? No? It had seven legs.', 'Every world has its own birdsong. Even the scary ones.', 'I’ve named a moss after you. It’s very sturdy.'] } },
    { id: 'detective', name: 'Inspector Dusk', blurb: 'Noir detective, rain-soaked narration.', lines: {
      found: ['A new lead walked in: {world}. Trouble usually does.', '{world}. The name came in on a cold wind.'],
      arrive: ['{world}. The city had secrets. They always do.', 'We stepped into {world}. Nobody was waiting. That bothered me.'],
      back: ['Back in {world}. Old cases never really close.', '{world} again. Same streets, new shadows.'],
      low: ['Running low, like coffee at 3 a.m. Darkmatter, please.', 'I’m fading. Even detectives need fuel.'],
      charge: ['Charged up. Time to work the case.', 'Energy’s back. So is my edge.'],
      tuneOk: ['The pattern fit like a key in a lock. Of course it did.', 'Case cracked. Resonance locked.'],
      tuneFail: ['Wrong suspect. Let’s look at the evidence again.', 'That lead went nowhere. Again.'],
      craft: ['{dm}. Smells like trouble.', 'You paid for that {dm} in blood. Typical.'],
      needFuel: ['No Darkmatter. No leads. Try the Forge.', 'The trail goes cold without fuel.'],
      notTuned: ['I’ve got the power. Don’t have {world}’s pattern.', 'Something about {world} doesn’t add up yet. Tune me.'],
      milestone: ['{pct}% of {world}. The picture’s coming together.', '{pct}% in. Every clue counts.'],
      nearDone: ['We’re near the edge of {world}. I can smell the next case.', 'Almost through {world}.'],
      lowHp: ['You’re bleeding, kid. Patch up.', 'You look like a bad night. Heal.'],
      walk: ['{steps} steps on the beat today.', 'Walking clears the head. Helps the case.'],
      idle: ['Every world has a back alley. Every alley has a story.', 'I don’t trust doors that open too easily.', 'The road between worlds never sleeps. Neither do I.'] } },
    { id: 'worrier', name: 'Fret', blurb: 'Anxious, cautious, means well.', lines: {
      found: ['Oh no. A new world. {world}. Are we sure about this?', '{world}? I mean, it’s probably fine. Probably.'],
      arrive: ['We’re in {world}. Nothing exploded. Great. Great!', '{world}. Okay. Stay close to me.'],
      back: ['{world} again. At least we know where the danger is.', 'Back in {world}. Phew, familiar.'],
      low: ['My energy is low and I’m worried about it.', 'Please charge me soon. I don’t like the dark.'],
      charge: ['Charged! I feel so much safer.', 'Okay, okay. Full energy. Breathing again.'],
      tuneOk: ['We got it! I was SO nervous.', 'Resonance locked. Oh, thank goodness.'],
      tuneFail: ['It’s okay! It’s okay. We try again.', 'Wrong one. Don’t panic. I’m panicking a little.'],
      craft: ['{dm}! Are you hurt? You look hurt.', 'You made {dm}. Please rest after that.'],
      needFuel: ['We have no Darkmatter. The Forge. Please.', 'No fuel. That’s fine. That’s fixable. Forge!'],
      notTuned: ['Energy’s okay. But I don’t know {world}’s song and that worries me.', 'Can we tune first? I like knowing things.'],
      milestone: ['{pct}% of {world}. So far so good. Knock on wood.', '{pct}% explored without disaster!'],
      nearDone: ['Almost through {world}. What’s next? Is it scary?', 'Nearly done here. I’m both relieved and nervous.'],
      lowHp: ['Your health is low! Please heal. Please.', 'You’re hurt and I’m worried.'],
      walk: ['{steps} steps! Remember to drink water.', 'Watch your step. Literally.'],
      idle: ['Did you lock the door? Not that kind of door. Your house door.', 'I counted the exits. There are three.', 'Is it just me, or is that tree looking at us?'] } },
    { id: 'captain', name: 'Captain Brine', blurb: 'Salty old sea captain, sails the dimensions.', lines: {
      found: ['Land ho! {world}, off the starboard bow!', 'A new shore: {world}. Ready the anchor!'],
      arrive: ['Dropped anchor in {world}. Mind the locals.', '{world}, at last. Smell that air!'],
      back: ['{world} again. Old harbor, friendly waters.', 'Back to port in {world}.'],
      low: ['We’re taking on water! Darkmatter, quick!', 'Sails slack, hold empty. To the Forge, matey.'],
      charge: ['Full sails! The wind is ours.', 'Hold’s full. Set course!'],
      tuneOk: ['Compass true! The current’s with us.', 'Heading locked. Fine navigating.'],
      tuneFail: ['Off course! Read the stars again.', 'Wrong heading. Back to the charts.'],
      craft: ['{dm}, fine cargo.', 'You hauled up some {dm}. Costly catch.'],
      needFuel: ['No fuel in the hold. The Forge, sailor.', 'Becalmed without Darkmatter.'],
      notTuned: ['Wind’s fine, but we lack the chart to {world}.', 'Learn {world}’s current and we sail.'],
      milestone: ['{pct}% of {world} charted!', '{pct}% of the map inked.'],
      nearDone: ['Edge of the map in {world}. Here be new worlds.', 'Nearly round the cape of {world}.'],
      lowHp: ['You’re listing badly. Patch the hull!', 'Drink something, sailor. You look green.'],
      walk: ['{steps} steps on deck today. Sea legs!', 'Steady as she goes.'],
      idle: ['The space between worlds is a sea with no water.', 'I lost a hat in the third dimension. Never found it.', 'Red sky at night, walker’s delight.'] } },
    { id: 'fan', name: 'Sparkle', blurb: 'Your biggest fan, endlessly encouraging.', lines: {
      found: ['OMG, {world}! You’re unstoppable!', 'You unlocked a whole world! {world}! Iconic!'],
      arrive: ['Welcome to {world}, superstar!', 'The crowd goes wild! {world}!'],
      back: ['{world} missed you! I can tell!', 'The legend returns to {world}!'],
      low: ['I’m low on sparkle! Darkmatter, pretty please?', 'Need a little charge to keep cheering!'],
      charge: ['Sparkle restored! Let’s gooo!', 'Fully charged and fully proud of you!'],
      tuneOk: ['PERFECT! You nailed it!', 'Flawless! Everybody clap!'],
      tuneFail: ['That’s okay! Champions retry!', 'So close! You’ve totally got this!'],
      craft: ['You crafted {dm}! Is there anything you can’t do?', '{dm}! Gorgeous!'],
      needFuel: ['We need Darkmatter! The Forge is calling your name!', 'No fuel, but you’ll fix it. You always do!'],
      notTuned: ['Power’s ready! Show {world} that song!', 'Tune us up, star!'],
      milestone: ['{pct}% of {world}! Proud of you!', '{pct}%! Look at you go!'],
      nearDone: ['Almost through {world}! Victory lap soon!', 'The finish line of {world} is right there!'],
      lowHp: ['Take care of yourself, superstar. Heal up!', 'Even heroes need potions!'],
      walk: ['{steps} steps! Record-breaking, probably!', 'Every step, a highlight reel!'],
      idle: ['Have I told you you’re amazing today? You are.', 'I’m making you a banner. It’s mostly glitter.', 'Number one walker in the multiverse. Facts.'] } },
    { id: 'butler', name: 'Jeeves Mk. II', blurb: 'Impeccably polite, quietly devoted.', lines: {
      found: ['Pardon me. {world} has become available, should you wish it.', 'A new world, {world}, awaits your pleasure.'],
      arrive: ['Welcome to {world}. Do mind the step.', 'We have arrived in {world}. Shall I take your coat?'],
      back: ['{world} once more. Very good.', 'Returning to {world}. I trust it suits.'],
      low: ['I regret to report my energy is rather low.', 'If it’s no trouble, some Darkmatter would be most appreciated.'],
      charge: ['Thank you. I feel entirely restored.', 'Fully charged, at your service.'],
      tuneOk: ['Resonance secured. Splendidly done.', 'A flawless performance, if I may say.'],
      tuneFail: ['A small misstep. Shall we attempt it again?', 'Not quite. Do take your time.'],
      craft: ['One {dm}, prepared as requested.', 'Your {dm}. Do look after yourself.'],
      needFuel: ['I’m afraid we’re out of Darkmatter. The Forge, perhaps?', 'The larder is empty of fuel.'],
      notTuned: ['Energy is in order. The resonance for {world} is not.', 'Might I suggest tuning to {world}?'],
      milestone: ['{pct}% of {world} explored. Most commendable.', '{pct}%. Very good progress.'],
      nearDone: ['The far end of {world} draws near.', 'We are nearly through {world}.'],
      lowHp: ['Forgive me, but you appear unwell. A potion?', 'Your health is concerning. Do rest.'],
      walk: ['{steps} steps today. A brisk constitutional.', 'A fine day for a walk.'],
      idle: ['Tea is unavailable between worlds. A tragedy.', 'I have polished my screen. Twice.', 'Do let me know if you require anything.'] } },
    { id: 'storyteller', name: 'Old Ember', blurb: 'Campfire storyteller, full of legends.', lines: {
      found: ['They tell a tale of {world}. Shall we find out if it’s true?', 'Gather close: {world} has appeared.'],
      arrive: ['And so the walker came to {world}…', 'Here begins the tale of {world}.'],
      back: ['We return to {world}, as heroes do in the old stories.', '{world} again. The story isn’t finished.'],
      low: ['My fire burns low. Feed it Darkmatter.', 'The embers are fading. To the Forge.'],
      charge: ['The fire roars again!', 'Fuel for a hundred more stories.'],
      tuneOk: ['The ancient song is yours now.', 'You remembered the old pattern. The legends were right about you.'],
      tuneFail: ['Even heroes forget the song. Try again.', 'Not that verse. Listen closer.'],
      craft: ['{dm}, the stuff of legends.', 'Old walkers bled for {dm} too.'],
      needFuel: ['No embers, no fire. The Forge holds the spark.', 'We need Darkmatter to continue the tale.'],
      notTuned: ['The fire is lit, but {world}’s song is unknown.', 'Learn {world}’s tune, and the tale goes on.'],
      milestone: ['{pct}% of {world}. A good chapter.', '{pct}% into the legend of {world}.'],
      nearDone: ['The end of this chapter nears. {world} is almost told.', 'A new tale waits beyond {world}.'],
      lowHp: ['You are wounded, like the heroes of old. Heal.', 'Rest by the fire. Drink something.'],
      walk: ['{steps} steps today. That’s a story in itself.', 'Walkers walk. That’s how stories travel.'],
      idle: ['Long ago, the worlds were one road. Then it broke.', 'The first walker carried a key like me. Nobody knows her name.', 'Every Worldkey remembers someone.'] } },
    { id: 'herald', name: 'Lord Clarion', blurb: 'Pompous royal herald, announces everything.', lines: {
      found: ['HEAR YE! A new realm is revealed: {world}!', 'By royal decree, {world} is discovered!'],
      arrive: ['Presenting the illustrious walker, arriving in {world}!', 'All hail! The walker enters {world}!'],
      back: ['The walker graces {world} once again!', 'Let it be known: our walker returns to {world}!'],
      low: ['The royal treasury of energy runs low!', 'Bring forth Darkmatter, by order of the crown!'],
      charge: ['The royal battery is restored! Huzzah!', 'Full power, as befits nobility!'],
      tuneOk: ['A triumph! Let the bells ring!', 'The realm’s song is mastered!'],
      tuneFail: ['A misstep! Let us pretend that never happened.', 'The court requests another attempt.'],
      craft: ['Behold: {dm}, crafted by noble hands!', 'A tribute of {dm}!'],
      needFuel: ['The coffers are empty! To the Forge!', 'We lack Darkmatter, which is beneath us.'],
      notTuned: ['The realm of {world} demands its song be learned!', 'We have power, but not {world}’s anthem.'],
      milestone: ['Proclaim it! {pct}% of {world} explored!', '{pct}%! Banners shall be sewn!'],
      nearDone: ['The borders of {world} approach!', 'Soon, a new realm for the crown!'],
      lowHp: ['The walker is injured! Physicians, potions!', 'Heal, noble walker, by royal order.'],
      walk: ['{steps} steps today, a royal march!', 'Make way! The walker walks!'],
      idle: ['I once announced a sandwich. It was a very fine sandwich.', 'All worlds shall know your name. I’ll see to it.', 'Ahem. That is all.'] } },
  ];
  D.wkVoiceById = Object.fromEntries(D.WK_VOICES.map((v) => [v.id, v]));
})();
