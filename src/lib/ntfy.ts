interface NtfyNotification {
	topic: string;
	title: string;
	message: string;
	click?: string;
	priority?: "min" | "low" | "default" | "high" | "max";
}

export async function sendNtfyNotification(
	notification: NtfyNotification,
	baseUrl = "https://ntfy.sh",
): Promise<boolean> {
	try {
		const response = await fetch(`${baseUrl}/${notification.topic}`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				topic: notification.topic,
				title: notification.title,
				message: notification.message,
				click: notification.click,
				priority: notification.priority || "high",
			}),
		});

		return response.ok;
	} catch (error) {
		console.error("Failed to send ntfy notification:", error);
		return false;
	}
}

export async function sendBatchNotifications(
	notifications: NtfyNotification[],
	baseUrl = "https://ntfy.sh",
): Promise<{ sent: number; failed: number }> {
	const results = await Promise.allSettled(
		notifications.map((n) => sendNtfyNotification(n, baseUrl)),
	);

	const sent = results.filter(
		(r) => r.status === "fulfilled" && r.value === true,
	).length;
	const failed = results.length - sent;

	return { sent, failed };
}
