/* Step Quest — quick missions and mission types (data only; rules live in 05k-quick.js).
   Quick missions are pre-made, one-tap missions grouped by category. Players can't make their own.
   Each can be finished once a day. Mission types (D.MCATS) are shared: quick missions, the templates behind
   "My missions" and field missions all count toward one of them, which feeds the Profile "Mission mix" card and
   the mission achievements. */
(() => {
  const D = WB.DATA;

  // ---------- mission types ----------
  D.MCATS = [
    { id: 'body', name: 'Body', icon: 'bolt', blurb: 'Move, stretch and look after your body.' },
    { id: 'mind', name: 'Mind', icon: 'moon', blurb: 'Calm down, reflect and recharge.' },
    { id: 'learn', name: 'Learning', icon: 'cap', blurb: 'Read, practice and learn something new.' },
    { id: 'home', name: 'Home', icon: 'key', blurb: 'Tidy up, cook and keep your space running.' },
    { id: 'work', name: 'Work & money', icon: 'coin', blurb: 'Get ahead on work, errands and money.' },
    { id: 'create', name: 'Creative', icon: 'pencil', blurb: 'Make something, however small.' },
    { id: 'social', name: 'Social', icon: 'heart', blurb: 'Reach out and be kind to people.' },
    { id: 'outdoor', name: 'Outdoors', icon: 'map', blurb: 'Get out of the house and into the world.' },
  ];
  D.mcatById = Object.fromEntries(D.MCATS.map((c) => [c.id, c]));
  D.MCAT_OTHER = { id: 'other', name: 'Other', icon: 'flag', blurb: '' };   // your own missions made from scratch
  D.mcat = (id) => D.mcatById[id] || D.MCAT_OTHER;
  // which type each "My missions" template counts as (field and Merlin missions count as Outdoors)
  D.TPL_CAT = { workout: 'body', book: 'create', read: 'learn', study: 'learn', clean: 'home', meal: 'home', language: 'learn', music: 'create', mind: 'mind', budget: 'work', journal: 'mind', job: 'work', creative: 'create', call: 'social', code: 'work', blank: 'other' };

  // ---------- quick missions: [category, title, size] (size 1 = a minute or two, 2 = a few minutes) ----------
  const Q = (cat, list) => list.split('|').map((x) => { const [t, z] = x.split('~'); return [cat, t.trim(), +(z || 1)]; });
  const RAW = [
    ...Q('body', 'Drink a glass of water|Do 10 push-ups~2|Do 20 squats~2|Stretch for 2 minutes|Stand up and roll your shoulders|Hold a 30-second plank~2|Take the stairs once|Do 10 minutes of any exercise~2|Eat a piece of fruit|Stand tall and take 5 deep breaths'),
    ...Q('mind', 'Take 5 slow, deep breaths|Write down one thing you’re grateful for|Meditate for 2 minutes~2|Put your phone down for 10 minutes|Name three things you can see, hear and feel|Smile at yourself in the mirror|Write down how you feel right now|Listen to one calming song|Close your eyes for one minute'),
    ...Q('learn', 'Read 5 pages~2|Learn one new word|Watch one short educational video~2|Practice a language for 5 minutes~2|Review your notes for 5 minutes~2|Look up something you’ve wondered about|Read one article|Solve a puzzle or brain teaser|Teach someone one fact you learned'),
    ...Q('home', 'Make your bed|Wash a few dishes|Put away 5 things that are out of place|Wipe down one surface|Take out the trash|Start a load of laundry|Water a plant|Clear off your desk~2|Open a window and air out a room|Prep tomorrow’s outfit'),
    ...Q('work', 'Reply to one email you’ve been avoiding|Write tomorrow’s top 3 tasks|Clear 10 emails from your inbox~2|Check your budget for 2 minutes|Do one small task you’ve been putting off~2|Tidy your files or desktop~2|Set a 25-minute focus timer~2|Update your calendar for tomorrow|Pay a bill or check a due date'),
    ...Q('create', 'Doodle for 2 minutes|Write three sentences of anything|Take a photo of something interesting|Hum or play a short tune|Sketch an idea~2|Jot down a story idea|Rearrange something to look better|Write a line of a poem or a joke|Make something with your hands~2'),
    ...Q('social', 'Send a kind text to someone|Reply to a message you’ve been putting off|Give someone a genuine compliment|Call or video chat a friend or family member~2|Thank someone for something|Check in on someone you haven’t heard from|Share something that made you laugh|Hold the door or help a stranger|Write a note to someone you appreciate~2'),
    ...Q('outdoor', 'Step outside for fresh air|Look at the sky for one minute|Take a 5-minute walk around the block~2|Notice three things in nature|Watch the sunrise or sunset~2|Walk to the end of your street and back~2|Spot a bird, tree or flower you like|Sit outside for 5 minutes~2|Pick up one piece of litter'),
  ];
  // rewards stay small: they are a nudge, not a way to out-earn walking
  D.QUICK = RAW.map(([cat, title, size], i) => ({ id: 'q' + String(i + 1).padStart(3, '0'), cat, title, size, reward: size > 1 ? { coins: 8, xp: 12 } : { coins: 4, xp: 6 } }));
  D.quickById = Object.fromEntries(D.QUICK.map((q) => [q.id, q]));
  D.QUICK_CAP = { coins: 80, xp: 120 };   // everything quick, per day (about what 2,500 steps earn)
  D.QUICK_AMBUSH = 0.12;                   // chance a quick mission stirs up a battle (see G.missionBattle)

  // ---------- mission achievements ----------
  // art: tools/make_mission_badges.py tints existing badges into assets/ach/<id>.png
  const A = (id, title, desc, stat, target, reward) => ({ id, title, desc, stat, target, reward });
  const catAch = [
    ['body', 'cat_body', 'Iron Body', 'Complete 20 Body missions.', 20, { coins: 250 }],
    ['mind', 'cat_mind', 'Still Waters', 'Complete 20 Mind missions.', 20, { coins: 250 }],
    ['learn', 'cat_learn', 'Scholar', 'Complete 20 Learning missions.', 20, { coins: 250 }],
    ['home', 'cat_home', 'Homekeeper', 'Complete 20 Home missions.', 20, { coins: 250 }],
    ['work', 'cat_work', 'Professional', 'Complete 20 Work & money missions.', 20, { coins: 250 }],
    ['create', 'cat_create', 'Maker', 'Complete 20 Creative missions.', 20, { coins: 250 }],
    ['social', 'cat_social', 'Good Neighbor', 'Complete 20 Social missions.', 20, { coins: 250 }],
    ['outdoor', 'cat_outdoor', 'Trailblazer', 'Complete 20 Outdoors missions.', 20, { coins: 250 }],
  ].map(([c, id, t, d, n, r]) => A(id, t, d, 'cat_' + c, n, r));
  D.ACHIEVEMENTS.push(
    // how many
    A('m_first', 'Reporting for Duty', 'Complete your first mission of any kind.', 'missionsAll', 1, { xp: 60 }),
    A('m_10', 'Getting Things Done', 'Complete 10 missions.', 'missionsAll', 10, { coins: 100 }),
    A('m_50', 'Task Master', 'Complete 50 missions.', 'missionsAll', 50, { coins: 400 }),
    A('m_150', 'Relentless', 'Complete 150 missions.', 'missionsAll', 150, { coins: 1000 }),
    A('m_500', 'Mission Legend', 'Complete 500 missions.', 'missionsAll', 500, { coins: 3000 }),
    // quick missions
    A('q_10', 'Quick Draw', 'Complete 10 quick missions.', 'quickDone', 10, { coins: 80 }),
    A('q_50', 'Rapid Fire', 'Complete 50 quick missions.', 'quickDone', 50, { coins: 300 }),
    A('q_250', 'Lightning Hands', 'Complete 250 quick missions.', 'quickDone', 250, { coins: 1200 }),
    A('q_day', 'Flurry', 'Complete 8 quick missions in one day.', 'quickBestDay', 8, { coins: 150 }),
    // your own missions
    A('c_5', 'Promise Keeper', 'Complete 5 of your own missions.', 'customDone', 5, { coins: 120 }),
    A('c_25', 'Self-Starter', 'Complete 25 of your own missions.', 'customDone', 25, { coins: 500 }),
    A('c_100', 'Quest Giver', 'Complete 100 of your own missions.', 'customDone', 100, { coins: 1500 }),
    // when you finish
    A('t_dawn', 'Early Bird', 'Complete a mission before 8 am.', 'missionDawn', 1, { xp: 80 }),
    A('t_dawn10', 'Sunrise Regular', 'Complete 10 missions before 8 am.', 'missionDawn', 10, { coins: 300 }),
    A('t_night', 'Night Owl', 'Complete a mission after 10 pm.', 'missionNight', 1, { xp: 80 }),
    A('t_night10', 'Moonlit Grinder', 'Complete 10 missions after 10 pm.', 'missionNight', 10, { coins: 300 }),
    A('t_early', 'Ahead of Schedule', 'Finish one of your own missions with half its time still left.', 'missionEarly', 1, { xp: 80 }),
    A('t_early10', 'Always Early', 'Finish 10 of your own missions with half their time still left.', 'missionEarly', 10, { coins: 400 }),
    A('t_ontime', 'Punctual', 'Finish 25 of your own missions before they’re due.', 'missionOnTime', 25, { coins: 400 }),
    A('t_days7', 'A Mission a Day', 'Complete missions on 7 different days.', 'missionDays', 7, { coins: 250 }),
    A('t_days30', 'Habit Forged', 'Complete missions on 30 different days.', 'missionDays', 30, { coins: 900 }),
    A('t_run5', 'On a Mission', 'Complete a mission 5 days in a row.', 'missionRun', 5, { coins: 300 }),
    A('t_run14', 'Unbroken', 'Complete a mission 14 days in a row.', 'missionRun', 14, { coins: 1000 }),
    A('t_best', 'Marathon Day', 'Complete 10 missions in a single day.', 'missionBestDay', 10, { coins: 250 }),
    // what kind
    A('y_4', 'Jack of All Trades', 'Complete missions in 4 different types.', 'missionCats', 4, { coins: 150 }),
    A('y_all', 'Renaissance Walker', 'Complete missions in all ' + D.MCATS.length + ' types.', 'missionCats', D.MCATS.length, { coins: 1000 }),
    A('y_25', 'Specialist', 'Complete 25 missions of the same type.', 'missionTopCat', 25, { coins: 400 }),
    A('y_100', 'Master of One', 'Complete 100 missions of the same type.', 'missionTopCat', 100, { coins: 1500 }),
    ...catAch,
  );
})();
