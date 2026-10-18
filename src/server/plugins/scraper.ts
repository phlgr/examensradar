import { definePlugin } from "nitro";
import { startScraper } from "../scraper";

export default definePlugin(() => {
	startScraper();
});
