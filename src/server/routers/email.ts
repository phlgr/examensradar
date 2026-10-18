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
	removeEmailSubscription,
	subscriberStatus,
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
import {
	buildClearManageCookie,
	buildManageSessionCookie,
} from "@/lib/manage-auth";
import { manageProcedure, publicProcedure, router } from "../trpc";

const sendMailUnawaited = (mail: Mail) => void sendMail(mail);

const tokensFor = (subscriber: {
	manageToken: string;
	unsubscribeToken: string;
}): MailTokens => ({
	manage: subscriber.manageToken,
	unsubscribe: subscriber.unsubscribeToken,
});

const sendManageLinkUnawaited = (subscriber: {
	email: string;
	manageToken: string;
	unsubscribeToken: string;
}) =>
	sendMailUnawaited({
		...renderManageLinkMail(tokensFor(subscriber)),
		to: subscriber.email,
	});

const emailInput = z.email().max(254);
const tokenInput = z.string().min(16).max(64);

export const emailRouter = router({
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

			const ip = getClientIp(ctx.request);

			if (!allowMailTo(input.email, ip)) return { ok: true };

			const existing = await getSubscriberByEmail(input.email);

			if (existing && subscriberStatus(existing) === "active") {
				sendManageLinkUnawaited(existing);
				return { ok: true };
			}

			const subscriber = await upsertPendingSubscriber(input.email, ip);
			await addEmailSubscription(subscriber.id, jpa.id);

			sendMailUnawaited({
				...renderConfirmMail(subscriber.confirmToken),
				to: subscriber.email,
			});

			return { ok: true };
		}),

	/** Never returns the manage token: mail scanners replay confirm links. */
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

			sendMailUnawaited({
				...renderWelcomeMail(tokensFor(subscriber)),
				to: subscriber.email,
			});

			return {
				manageToken: subscriber.manageToken,
				jpaNames: (await getSubscriberJpas(subscriber.id)).map(
					(jpa) => jpa.jpaName,
				),
			};
		}),

	resendManageLink: publicProcedure
		.input(z.object({ email: emailInput }))
		.mutation(async ({ ctx, input }) => {
			if (!allowMailTo(input.email, getClientIp(ctx.request)))
				return { ok: true };

			const subscriber = await getSubscriberByEmail(input.email);

			if (subscriber && subscriberStatus(subscriber) === "active") {
				sendManageLinkUnawaited(subscriber);
			}

			return { ok: true };
		}),

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

			ctx.resHeaders.append(
				"Set-Cookie",
				buildManageSessionCookie(input.token),
			);
			return { ok: true };
		}),

	signOut: publicProcedure.mutation(({ ctx }) => {
		ctx.resHeaders.append("Set-Cookie", buildClearManageCookie());
		return { ok: true };
	}),

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
