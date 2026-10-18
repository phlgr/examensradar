import { normalizeEmail } from "./email";

interface Window {
	count: number;
	resetAt: number;
}

const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_EMAIL = 3;
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

export function allowMailTo(email: string, ip: string | null): boolean {
	const now = Date.now();
	cleanup(now);

	if (!hit(`email:${normalizeEmail(email)}`, MAX_PER_EMAIL, now)) return false;
	if (ip && !hit(`ip:${ip}`, MAX_PER_IP, now)) return false;

	return true;
}
