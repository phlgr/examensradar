// In-memory store for verification codes with TTL
// Note: This works for single-instance deployments. For multi-instance,
// consider using KV storage or a database table.

interface StoredCode {
	code: string;
	ntfyTopic: string;
	expiresAt: number;
}

const CODE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const verificationCodes = new Map<string, StoredCode>();

function generateCode(): string {
	return Math.floor(100000 + Math.random() * 900000).toString();
}

function cleanupExpired(): void {
	const now = Date.now();
	for (const [userId, stored] of verificationCodes) {
		if (stored.expiresAt < now) {
			verificationCodes.delete(userId);
		}
	}
}

export function createVerificationCode(
	userId: string,
	ntfyTopic: string,
): string {
	cleanupExpired();

	const code = generateCode();
	verificationCodes.set(userId, {
		code,
		ntfyTopic,
		expiresAt: Date.now() + CODE_TTL_MS,
	});

	return code;
}

export function verifyCode(
	userId: string,
	code: string,
): { valid: boolean; ntfyTopic?: string } {
	cleanupExpired();

	const stored = verificationCodes.get(userId);
	if (!stored) {
		return { valid: false };
	}

	if (stored.expiresAt < Date.now()) {
		verificationCodes.delete(userId);
		return { valid: false };
	}

	if (stored.code !== code) {
		return { valid: false };
	}

	// Code is valid - delete it so it can't be reused
	verificationCodes.delete(userId);
	return { valid: true, ntfyTopic: stored.ntfyTopic };
}

export function hasActiveCode(userId: string): boolean {
	cleanupExpired();
	const stored = verificationCodes.get(userId);
	return !!stored && stored.expiresAt > Date.now();
}
