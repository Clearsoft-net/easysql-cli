/**
 * Inline login runner (`/login` in the Question screen). Prompts for an
 * EasySQL API key, validates it against `/v1/auth/me`, and persists it to the
 * local config (0600). Lets the user switch accounts without leaving the TUI.
 */

import { Box, Text, useInput } from "ink";
import { useState } from "react";
import { ApiError } from "../../cli/errors.js";
import { saveConfig } from "../../config/store.js";
import { t } from "../../i18n/messages.js";
import { getAuthenticatedClient, resolveApiUrl } from "../../sdk/client.js";

export interface LoggedInUser {
	email?: string;
	plan?: string;
}

interface Props {
	onExit: () => void;
	onSuccess?: (user: LoggedInUser) => void;
}

export function LoginScreen({ onExit, onSuccess }: Props) {
	const apiUrl = resolveApiUrl();
	const [key, setKey] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [done, setDone] = useState<LoggedInUser | null>(null);

	async function submit(): Promise<void> {
		const trimmed = key.trim();
		if (trimmed.length === 0) {
			setError("API key required.");
			return;
		}
		setBusy(true);
		setError(null);
		try {
			const client = getAuthenticatedClient(trimmed, apiUrl);
			const me = await client.me();
			saveConfig({
				api_url: apiUrl,
				api_key: trimmed,
				last_login_at: new Date().toISOString(),
				user_email: me.email,
				user_name: me.name,
				plan_name: me.active_plan?.name,
			});
			const user = { email: me.email, plan: me.active_plan?.name };
			setDone(user);
			onSuccess?.(user);
		} catch (e) {
			if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
				setError(t().errors.invalidApiKey);
			} else {
				setError(e instanceof Error ? e.message : String(e));
			}
		} finally {
			setBusy(false);
		}
	}

	useInput((input, k) => {
		if (busy) return;
		if (done) {
			if (k.return || k.escape) onExit();
			return;
		}
		if (k.escape) {
			onExit();
			return;
		}
		if (k.return) {
			void submit();
			return;
		}
		if (k.backspace || k.delete) {
			setKey((p) => p.slice(0, -1));
			return;
		}
		if (k.ctrl || k.meta || k.tab) return;
		if (input) setKey((p) => p + input);
	});

	return (
		<Box flexDirection="column" paddingX={1}>
			<Text bold color="cyan">
				Log in to EasySQL
			</Text>
			<Text dimColor>API: {apiUrl}</Text>
			{done ? (
				<Text color="green">
					Logged in as {done.email ?? "unknown"}
					{done.plan ? ` (${done.plan})` : ""}.
				</Text>
			) : (
				<Text>
					API key:{" "}
					{key.length === 0 ? (
						<>
							{!busy && <Text color="cyan">▏</Text>}
							<Text dimColor>paste or type your key…</Text>
						</>
					) : (
						<>
							{"*".repeat(key.length)}
							{!busy && <Text color="cyan">▏</Text>}
						</>
					)}
				</Text>
			)}
			{busy && <Text color="cyan">Validating…</Text>}
			{error && <Text color="red">Error: {error}</Text>}
			<Text dimColor>{done ? "Enter/Esc to return" : "Enter log in · Esc cancel"}</Text>
		</Box>
	);
}
