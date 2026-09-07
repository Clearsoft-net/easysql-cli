/**
 * `easysql logout` — clears the stored API key.
 */

import type { Command } from "commander";
import { clearConfig } from "../config/store.js";
import { t } from "../i18n/messages.js";
import { printSuccess } from "../output/print.js";

export function registerLogout(program: Command): void {
	program
		.command("logout")
		.description("Clear stored credentials")
		.action(() => {
			const removed = clearConfig();
			if (removed) printSuccess(t().success.loggedOut);
			else printSuccess(t().success.loggedOut + " (nothing to clear)");
		});
}
