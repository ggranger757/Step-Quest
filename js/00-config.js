/* Step Quest — deployment settings. Fill these in to switch on online leaderboards (see README → Leaderboards and
   supabase/leaderboard.sql). Left empty, the game runs fully offline and the Ranks tab says leaderboards are off.
   The anon key is meant to be public: row-level security in the database decides what each player can write. */
window.WB = window.WB || {};
WB.CONFIG = Object.assign({
  leaderboard: {
    url: '',       // e.g. 'https://abcdefgh.supabase.co'
    anonKey: '',   // Project settings → API → anon public key
  },
}, WB.CONFIG || {});
