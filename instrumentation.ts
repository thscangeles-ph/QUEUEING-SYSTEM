// Runs once when the server starts. On the clinic server (QUEUE_STORE=sqlite or file) it starts the Telegram bot for patient
// reminders (System configuration → Patient reminders); the bot waits quietly while reminders are turned off.
// On Windows it also keeps the computer from sleeping while the queue server runs.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && (process.env.QUEUE_STORE === "sqlite" || process.env.QUEUE_STORE === "file")) {
    const { startTelegramReminders } = await import("./lib/queue/sms-sender");
    startTelegramReminders();
    // The clinic server must not sleep while the queue runs (Windows only).
    const { keepAwake } = await import("./lib/queue/keep-awake");
    keepAwake();
  }
}
