/* Step Quest push notifications for the web app: mission reminders and the daily reminder arrive even when Step
   Quest is closed. Fill these in after deploying push-server/ (README → "Push notifications"). Both values are
   public (the private key stays on the server). With `server` empty, the web app only notifies while it's open;
   the installed iPhone / Android app never needs this: the phone schedules its own reminders. */
self.SQ_PUSH = {
  server: '',           // e.g. 'https://stepquest-push.<your-subdomain>.workers.dev'
  vapidPublicKey: '',   // VAPID_PUBLIC_KEY from `node push-server/scripts/gen-vapid.mjs`
};
