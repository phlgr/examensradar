import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
	addEmailSubscription,
	classifyConfirmToken,
	confirmSubscriber,
	getJpaById,
	getSubscriberByEmail,
	getSubscriberByManageToken,
	getSubscriberJpas,
	isActiveSubscriber,
	normalizeEmail,
	removeEmailSubscription,
	unsubscribeSubscriber,
	upsertPendingSubscriber,
} from "@/db";
import { getClientIp } from "@/lib/client-ip";
import { type Mail, sendMail } from "@/lib/mail";
import {
	type MailTokens,
	renderConfirmMail,
	renderManageLinkMail,
	renderWelcomeMail,
} from "@/lib/mail-templates";
import { allowMailTo } from "@/lib/mail-throttle";
import { buildClearManageCookie, buildManageCookie } from "@/lib/manage-auth";
import { manageProcedure, publicProcedure, router } from "../trpc";

/**
 * Fire-and-forget: the form must not wait on SMTP, so a slow or failing send
 * cannot become a signal about whether the address was already known.
 * `sendMail` handles its own failures and never rejects.
 */
const dispatch = (mail: Mail) => void sendMail(mail);

const tokensFor = (subscriber: {
	manageToken: string;
	unsubscribeToken: string;
}): MailTokens => ({
	manage: subscriber.manageToken,
	unsubscribe: subscriber.unsubscribeToken,
});

/** What `subscribe` and `resendManageLink` both do for an active address. */
const dispatchManageLink = (subscriber: {
	email: string;
	manageToken: string;
	unsubscribeToken: string;
}) =>
	dispatch({
		...renderManageLinkMail(tokensFor(subscriber)),
		to: subscriber.email,
	});

const emailInput = z.email().max(254);
const tokenInput = z.string().min(16).max(64);

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

			if (existing && isActiveSubscriber(existing)) {
				// The address is already proven, but the form is not: anyone can type
				// a stranger's address here. So nothing changes from this path — the
				// manage link goes into the inbox, and only its holder can alter what
				// this address receives.
				dispatchManageLink(existing);
				return { ok: true };
			}

			const subscriber = await upsertPendingSubscriber(email, ip);
			await addEmailSubscription(subscriber.id, jpa.id, ctx.deviceId);

			dispatch({
				...renderConfirmMail(subscriber.confirmToken),
				to: email,
			});

			return { ok: true };
		}),

	/**
	 * What /confirm/:token should show on load: `pending` renders the button,
	 * `confirmed` renders the done state (a re-opened link is not an error),
	 * `invalid` covers unknown, expired and superseded-by-unsubscribe links.
	 *
	 * Deliberately never returns the manage token: this query is replayable by
	 * mail scanners and anyone a confirm mail was forwarded to, for as long as
	 * the link lives. The manage credential leaves exactly once, through the
	 * confirm mutation's pending → active transition — afterwards the durable
	 * way in is the welcome mail in the owner's inbox.
	 */
	confirmState: publicProcedure
		.input(z.object({ token: tokenInput }))
		.query(async ({ input }) => {
			const { state, subscriber } = await classifyConfirmToken(input.token);

			if (state !== "confirmed") return { state };

			return {
				state,
				jpaNames: (await getSubscriberJpas(subscriber.id)).map(
					(jpa) => jpa.jpaName,
				),
			};
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

			// Delivers the manage link into the inbox, which is the only durable
			// way back in once the confirmation page is closed.
			dispatch({
				...renderWelcomeMail(tokensFor(subscriber)),
				to: subscriber.email,
			});

			// The consent just given was general; the names show what it activated.
			return {
				manageToken: subscriber.manageToken,
				jpaNames: (await getSubscriberJpas(subscriber.id)).map(
					(jpa) => jpa.jpaName,
				),
			};
		}),

	/** Same discretion as `subscribe`: the reply never reveals what we know. */
	resendManageLink: publicProcedure
		.input(z.object({ email: emailInput }))
		.mutation(async ({ ctx, input }) => {
			const email = normalizeEmail(input.email);

			if (!allowMailTo(email, getClientIp(ctx.request))) return { ok: true };

			const subscriber = await getSubscriberByEmail(email);

			if (subscriber && isActiveSubscriber(subscriber)) {
				dispatchManageLink(subscriber);
			}

			return { ok: true };
		}),

	/**
	 * Trades a manage token (from a `/subscriptions?manage=<token>` mail link)
	 * for the httpOnly cookie, so the credential leaves the URL after one use.
	 */
	signIn: publicProcedure
		.input(z.object({ token: tokenInput }))
		.mutation(async ({ ctx, input }) => {
			const subscriber = await getSubscriberByManageToken(input.token);

			if (!subscriber) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "Dieser Link ist nicht mehr gültig.",
				});
			}

			ctx.resHeaders.append("Set-Cookie", buildManageCookie(input.token));
			return { ok: true };
		}),

	/**
	 * Clears the cookie — nothing else. The subscription survives; any mail
	 * footer signs the device back in. Matters on shared machines.
	 */
	signOut: publicProcedure.mutation(({ ctx }) => {
		ctx.resHeaders.append("Set-Cookie", buildClearManageCookie());
		return { ok: true };
	}),

	/** The caller's identity is the manage cookie; nothing here takes a token. */
	me: manageProcedure.query(async ({ ctx }) => {
		return {
			email: ctx.subscriber.email,
			confirmed: ctx.subscriber.confirmedAt !== null,
			unsubscribed: ctx.subscriber.unsubscribedAt !== null,
			jpas: await getSubscriberJpas(ctx.subscriber.id),
		};
	}),

	addJpa: manageProcedure
		.input(z.object({ jpaId: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			const jpa = await getJpaById(input.jpaId);

			if (!jpa) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Prüfungsamt nicht gefunden.",
				});
			}

			await addEmailSubscription(ctx.subscriber.id, jpa.id);
			return { ok: true };
		}),

	removeJpa: manageProcedure
		.input(z.object({ jpaId: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			await removeEmailSubscription(ctx.subscriber.id, input.jpaId);
			return { ok: true };
		}),

	unsubscribe: manageProcedure.mutation(async ({ ctx }) => {
		await unsubscribeSubscriber(ctx.subscriber.id);
		return { ok: true };
	}),
});
