/**
 * `easysql login` — authenticate with an EasySQL API key.
 *
 * The key is either provided via --api-key (or $EASYSQL_API_KEY) or read
 * interactively via promptSecret. The key is validated against the API by
 * calling /v1/auth/me. On success it is saved to the local config file
 * with 0600 permissions.
 *
 * By default the command is interactive: missing --api-key triggers a
 * secure prompt. Pass --non-interactive (alias -y) to disable prompts and
 * fail with a clear error when the key is missing.
 */

import type { Command } from "commander";
import { ApiError } from "../cli/errors.js";
import { saveConfig } from "../config/store.js";
import { t } from "../i18n/messages.js";
import { printError, printSuccess } from "../output/print.js";
import { getAuthenticatedClient, resolveApiUrl, type UserMe } from "../sdk/client.js";
import { promptSecret } from "../util/prompt.js";

interface LoginOptions {
	apiKey?: string;
	apiUrl?: string;
	nonInteractive?: boolean;
}

async function resolveApiKey(options: LoginOptions): Promise<string> {
	if (options.apiKey && options.apiKey.length > 0) return options.apiKey;
	const envKey = process.env.EASYSQL_API_KEY;
	if (envKey && envKey.length > 0) return envKey;

	if (options.nonInteractive) {
		throw new ApiError(
			0,
			"No API key provided. Pass --api-key, set $EASYSQL_API_KEY, or omit --non-interactive to be prompted.",
		);
	}

	const secret = await promptSecret(`${t().prompts.apiKeyPrompt}: `);
	if (!secret) {
		throw new ApiError(
			0,
			"No API key provided. Pass --api-key, set $EASYSQL_API_KEY, or run interactively.",
		);
	}
	return secret.trim();
}

export function registerLogin(program: Command): void {
	program
		.command("login")
		.description("Authenticate with an EasySQL API key")
		.option("--api-key <key>", "Provide the API key inline (otherwise prompted)")
		.option("--api-url <url>", "Override the API base URL for this login")
		.option("-y, --non-interactive", "Disable prompts; fail when required values are missing")
		.action(async (options: LoginOptions, cmd: Command) => {
			const apiKey = await resolveApiKey(options);
			const parentOpts = (cmd.parent?.opts() ?? {}) as { apiUrl?: string };
			const apiUrl = resolveApiUrl(options.apiUrl ?? parentOpts.apiUrl);

			let user: UserMe;
			try {
				const client = getAuthenticatedClient(apiKey, apiUrl);
				user = await client.me();
			} catch (err) {
				if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
					printError(t().errors.invalidApiKey);
					throw new ApiError(err.status, t().errors.invalidApiKey);
				}
				throw err;
			}

			saveConfig({
				api_url: apiUrl,
				api_key: apiKey,
				last_login_at: new Date().toISOString(),
				user_email: user.email,
				user_name: user.name,
				plan_name: user.active_plan?.name,
			});

			printSuccess(t().success.loggedIn);
		});
}
