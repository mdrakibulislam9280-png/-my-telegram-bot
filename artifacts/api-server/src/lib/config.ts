/**
 * Central place for environment-driven configuration.
 * Add new env vars here so they're validated at startup.
 */

/**
 * Telegram user ID of the admin who receives withdrawal notifications.
 * Set the ADMIN_TELEGRAM_ID environment variable to enable notifications.
 */
export const ADMIN_TELEGRAM_ID: number | null = (() => {
  const raw = process.env["ADMIN_TELEGRAM_ID"];
  if (!raw) return null;
  const id = parseInt(raw, 10);
  return isNaN(id) ? null : id;
})();
