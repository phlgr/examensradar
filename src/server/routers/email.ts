import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
	addEmailSubscription,
	confirmSubscriber,
	getJpaById,
	getSubscriberByEmail,
	getSubscriberByManageToken,
	getSubscriberJpas,
	normalizeEmail,
	removeEmailSubscription,
	retireSupersededNtfySubscriptions,
	unsubscribeSubscriber,
	upsertPendingSubscriber,
} from "@/db";
import { getClientIp } from "@/lib/client-ip";
import { sendMail } from "@/lib/mail";
import {
	type MailTokens,
	renderConfirmMail,
	renderManageLinkMail,
	renderWelcomeMail,
} from "@/lib/mail-templates";
import { allowMailTo } from "@/lib/mail-throttle";
import { publicProcedure, router } from "../trpc";

/**
 * Mail is dispatched in the background so the form does not wait on SMTP, and
 * so a slow or failing send cannot become a signal about whether the address
 * was already known.
 */
function dispatch(to: string, content: Parameters<typeof sendMail>[0] | null) {
	if (!content) return;
	void sendMail(content).catch((error) => {
		console.error(`[email] background send to ${to} crashed`, error);
	});
}

const tokensFor = (subscriber: {
	manageToken: string;
	unsubscribeToken: string;
}): MailTokens => ({
	manage: subscriber.manageToken,
	unsubscribe: subscriber.unsubscribeToken,
});

const emailInput = z.email().max(254);
const tokenInput = z.string().min(16).max(64);

async function requireSubscriber(token: string) {
	const subscriber = await getSubscriberByManageToken(token);

	if (!subscriber) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Dieser Link ist nicht mehr gültig.",
		});
	}

	return subscriber;
}

export const emailRouter = router({
	/**
	 * Always answers the same way. Whether an address is already subscribed is
	 * not ours to disclose — it would turn the form into a way of asking who is
	 * sitting an exam — so "already subscribed", "newly pending" and "throttled"
	 * are indistinguishable from outside. What differs is the mail, not the reply.
	 */
	subscribe: publicProcedure
		.input(z.object({ email: emailInput, jpaId: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			const jpa = await getJpaById(input.jpaId);

			if (!jpa) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Prüfungsamt nicht gefunden.",
				});
			}

			const email = normalizeEmail(input.email);
			const ip = getClientIp(ctx.request);

			if (!allowMailTo(email, ip)) return { ok: true };

			const existing = await getSubscriberByEmail(email);
			const isActive =
				existing?.confirmedAt &&
				!existing.unsubscribedAt &&
				!existing.bouncedAt;

			if (existing && isActive) {
				// The address is already proven; no second opt-in to run.
				await addEmailSubscription(existing.id, jpa.id, ctx.deviceId);
				await retireSupersededNtfySubscriptions(existing.id);
				dispatch(email, {
					...renderWelcomeMail(jpa.name, tokensFor(existing)),
					to: email,
				});

				return { ok: true };
			}

			const subscriber = await upsertPendingSubscriber(email, ip);
			await addEmailSubscription(subscriber.id, jpa.id, ctx.deviceId);

			dispatch(
				email,
				subscriber.confirmToken
					? {
							...renderConfirmMail(jpa.name, subscriber.confirmToken),
							to: email,
						}
					: null,
			);

			return { ok: true };
		}),

	confirm: publicProcedure
		.input(z.object({ token: tokenInput }))
		.mutation(async ({ input }) => {
			const subscriber = await confirmSubscriber(input.token);

			if (!subscriber) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Dieser Bestätigungslink ist ungültig oder abgelaufen.",
				});
			}

			const jpas = await getSubscriberJpas(subscriber.id);
			const first = jpas[0];

			// Delivers the manage link into the inbox, which is the only durable
			// way back in once the confirmation page is closed.
			if (first) {
				dispatch(subscriber.email, {
					...renderWelcomeMail(first.jpaName, tokensFor(subscriber)),
					to: subscriber.email,
				});
			}

			return {
				manageToken: subscriber.manageToken,
				jpaNames: jpas.map((jpa) => jpa.jpaName),
			};
		}),

	/** Same discretion as `subscribe`: the reply never reveals what we know. */
	resendManageLink: publicProcedure
		.input(z.object({ email: emailInput }))
		.mutation(async ({ ctx, input }) => {
			const email = normalizeEmail(input.email);

			if (!allowMailTo(email, getClientIp(ctx.request))) return { ok: true };

			const subscriber = await getSubscriberByEmail(email);

			if (subscriber?.confirmedAt && !subscriber.unsubscribedAt) {
				dispatch(email, {
					...renderManageLinkMail(tokensFor(subscriber)),
					to: email,
				});
			}

			return { ok: true };
		}),

	get: publicProcedure
		.input(z.object({ token: tokenInput }))
		.query(async ({ input }) => {
			const subscriber = await requireSubscriber(input.token);

			return {
				email: subscriber.email,
				confirmed: subscriber.confirmedAt !== null,
				unsubscribed: subscriber.unsubscribedAt !== null,
				jpas: await getSubscriberJpas(subscriber.id),
			};
		}),

	addJpa: publicProcedure
		.input(z.object({ token: tokenInput, jpaId: z.string().min(1) }))
		.mutation(async ({ input }) => {
			const subscriber = await requireSubscriber(input.token);
			await addEmailSubscription(subscriber.id, input.jpaId);
			return { ok: true };
		}),

	removeJpa: publicProcedure
		.input(z.object({ token: tokenInput, jpaId: z.string().min(1) }))
		.mutation(async ({ input }) => {
			const subscriber = await requireSubscriber(input.token);
			await removeEmailSubscription(subscriber.id, input.jpaId);
			return { ok: true };
		}),

	unsubscribe: publicProcedure
		.input(z.object({ token: tokenInput }))
		.mutation(async ({ input }) => {
			const subscriber = await requireSubscriber(input.token);
			await unsubscribeSubscriber(subscriber.id);
			return { ok: true };
		}),
});
