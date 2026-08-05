/**
 * In-memory session state per Telegram user.
 * Holds transient values between messages/callback queries.
 */

export interface UserState {
  selectedService?: string; // e.g. "facebook"
  activeOrderId?: number;   // ongoing order the user can cancel
}

const store = new Map<number, UserState>();

export function getState(userId: number): UserState {
  let s = store.get(userId);
  if (!s) {
    s = {};
    store.set(userId, s);
  }
  return s;
}

export function setState(userId: number, patch: Partial<UserState>): void {
  const s = getState(userId);
  Object.assign(s, patch);
}

export function clearOrderState(userId: number): void {
  const s = getState(userId);
  delete s.activeOrderId;
  delete s.selectedService;
}
