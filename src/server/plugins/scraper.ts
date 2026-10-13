import { definePlugin } from "nitro";
import { startScraper } from "../scraper";

/** Registered in vite.config.ts (nitro plugins) — runs once at server boot. */
export default definePlugin(() => {
	startScraper();
});
