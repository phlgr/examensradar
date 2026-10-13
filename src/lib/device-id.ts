const STORAGE_KEY = "examensradar_device_id";

/**
 * Get the device ID from localStorage, or create a new one if it doesn't exist.
 * This should only be called on the client side.
 */
export function getOrCreateDeviceId(): string {
	if (typeof window === "undefined") {
		throw new Error("Device ID can only be accessed on client");
	}

	let deviceId = localStorage.getItem(STORAGE_KEY);

	if (!deviceId) {
		deviceId = crypto.randomUUID();
		localStorage.setItem(STORAGE_KEY, deviceId);
	}

	return deviceId;
}
