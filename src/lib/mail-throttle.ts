/**
 * Throttles the mails a stranger can cause us to send.
 *
 * The signup form takes any address without proving anything, so it is a lever
 * for mailing someone who never asked. Double opt-in stops them being
 * *subscribed*, but not from being sent confirmation mail repeatedly, and a
 * flood of that lands us in spam folders as well as annoying the victim.
 *
 * State is in memory. It empties on redeploy, which for a rate limiter means
 * it fails open — acceptable for a throttle. If the app is ever run
 * multi-instance this needs to move to the DB.
 */

interface Window {
	count: number;
	resetAt: number;
}

const WINDOW_MS = 60 * 60 * 1000;
/** Per address: enough for a genuine "it didn't arrive" retry, not a flood. */
const MAX_PER_EMAIL = 3;
/** Per IP: one person legitimately signing up several addresses is plausible. */
const MAX_PER_IP = 10;

const windows = new Map<string, Window>();

function cleanup(now: number): void {
	for (const [key, window] of windows) {
		if (window.resetAt < now) windows.delete(key);
	}
}

function hit(key: string, max: number, now: number): boolean {
	const window = windows.get(key);

	if (!window || window.resetAt < now) {
		windows.set(key, { count: 1, resetAt: now + WINDOW_MS });
		return true;
	}

	if (window.count >= max) return false;

	window.count++;
	return true;
}

/**
 * Records an attempt and says whether to go ahead. Callers must treat `false`
 * as "silently do nothing" — telling the caller they were throttled would leak
 * whether the address is known.
 */
export function allowMailTo(email: string, ip: string | null): boolean {
	const now = Date.now();
	cleanup(now);

	// Check the address first so a throttled IP cannot consume its budget.
	if (!hit(`email:${email}`, MAX_PER_EMAIL, now)) return false;
	if (ip && !hit(`ip:${ip}`, MAX_PER_IP, now)) return false;

	return true;
}
