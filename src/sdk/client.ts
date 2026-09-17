/**
 * Thin wrapper around @easysql/client. Centralizes:
 *   - base URL resolution (CLI flag > env var > saved config > default)
 *   - error translation (openapi-fetch surfaces 4xx/5xx via {error} not throws)
 *   - lazy client construction (no SDK call before login)
 */

import { createEasySQLClient } from "@easysql/client";
import { ApiError, NetworkError, NotLoggedInError } from "../cli/errors.js";
import { DEFAULT_API_URL } from "../cli/global-options.js";
import { loadConfig } from "../config/store.js";

type SdkResult<T> = { data?: T; error?: unknown; response?: Response };
type SdkMethod<T> = (...args: never[]) => Promise<SdkResult<T>>;

interface RawSdk {
	me: SdkMethod<unknown>;
	listApiKeys: SdkMethod<unknown>;
	createApiKey: SdkMethod<unknown>;
	deleteApiKey: SdkMethod<unknown>;
	listConnectors: SdkMethod<unknown>;
	createConnector: SdkMethod<unknown>;
	updateConnector: SdkMethod<unknown>;
	deleteConnector: SdkMethod<unknown>;
	getConnectorSchema: SdkMethod<unknown>;
	syncConnector: SdkMethod<unknown>;
	createQuery: SdkMethod<unknown>;
	getQuery: SdkMethod<unknown>;
	answerQuery: SdkMethod<unknown>;
	listQueries: SdkMethod<unknown>;
	dashboardStats: SdkMethod<unknown>;
}

function isHttpErrorLike(e: unknown): { status?: number; message?: string } | null {
	if (!e || typeof e !== "object") return null;
	const obj = e as { status?: unknown; message?: unknown };
	const out: { status?: number; message?: string } = {};
	if (typeof obj.status === "number") out.status = obj.status;
	if (typeof obj.message === "string") out.message = obj.message;
	return out;
}

async function call<T>(fn: () => Promise<SdkResult<T>>): Promise<T> {
	let result: SdkResult<T>;
	try {
		result = await fn();
	} catch (err) {
		const e = isHttpErrorLike(err);
		if (e?.status !== undefined) {
			throw new ApiError(e.status, e.message ?? "request failed");
		}
		const msg = err instanceof Error ? err.message : String(err);
		if (msg.includes("fetch") || msg.includes("network") || msg.includes("connect")) {
			throw new NetworkError(msg);
		}
		throw new ApiError(0, msg);
	}
	if (result.error) {
		const e = isHttpErrorLike(result.error);
		if (e?.status !== undefined) {
			throw new ApiError(e.status, e.message ?? "request failed");
		}
		throw new ApiError(0, e?.message ?? "unknown error");
	}
	if (result.data === undefined) {
		throw new ApiError(0, "empty response");
	}
	return result.data;
}

/** Like `call`, but for endpoints that return no content (e.g. 204). */
async function callVoid(fn: () => Promise<SdkResult<unknown>>): Promise<void> {
	let result: SdkResult<unknown>;
	try {
		result = await fn();
	} catch (err) {
		const e = isHttpErrorLike(err);
		if (e?.status !== undefined) {
			throw new ApiError(e.status, e.message ?? "request failed");
		}
		const msg = err instanceof Error ? err.message : String(err);
		if (msg.includes("fetch") || msg.includes("network") || msg.includes("connect")) {
			throw new NetworkError(msg);
		}
		throw new ApiError(0, msg);
	}
	if (result.error) {
		const e = isHttpErrorLike(result.error);
		if (e?.status !== undefined) {
			throw new ApiError(e.status, e.message ?? "request failed");
		}
		throw new ApiError(0, e?.message ?? "unknown error");
	}
}

export function resolveApiUrl(override?: string): string {
	if (override && override.length > 0) return override;
	if (process.env.EASYSQL_API_URL && process.env.EASYSQL_API_URL.length > 0) {
		return process.env.EASYSQL_API_URL;
	}
	const cfg = loadConfig();
	if (cfg.api_url) return cfg.api_url;
	return DEFAULT_API_URL;
}

export interface ActivePlan {
	id: string;
	name: string;
	max_queries_daily: number;
	max_queries_weekly: number;
	max_queries_monthly: number;
}

export interface UserMe {
	id: string;
	email: string;
	name: string;
	locale: string;
	email_verified: boolean;
	email_verified_at?: string | null;
	created_at: string;
	active_plan: ActivePlan | null;
}

export interface AuthenticatedClient {
	me: () => Promise<UserMe>;
	listApiKeys: () => Promise<unknown>;
	createApiKey: (body: unknown) => Promise<unknown>;
	deleteApiKey: (id: string) => Promise<unknown>;
	listConnectors: () => Promise<unknown>;
	createConnector: (body: unknown) => Promise<unknown>;
	updateConnector: (body: unknown, id: string) => Promise<unknown>;
	deleteConnector: (id: string) => Promise<void>;
	getConnectorSchema: (id: string) => Promise<unknown>;
	syncConnector: (body: unknown, id: string) => Promise<unknown>;
	createQuery: (body: unknown) => Promise<unknown>;
	getQuery: (id: string) => Promise<unknown>;
	answerQuery: (body: unknown, id: string) => Promise<unknown>;
	listQueries: (params: { page?: number; per_page?: number }) => Promise<unknown>;
	dashboardStats: () => Promise<unknown>;
}

export function getAuthenticatedClient(apiKey: string, apiUrl: string): AuthenticatedClient {
	const sdk = createEasySQLClient({ baseUrl: apiUrl, accessToken: apiKey }) as RawSdk;
	return {
		me: () => call(() => sdk.me()) as Promise<UserMe>,
		listApiKeys: () => call(() => sdk.listApiKeys()),
		createApiKey: (body) => call(() => sdk.createApiKey(body as never)),
		deleteApiKey: (id) => call(() => sdk.deleteApiKey({ key_id: id } as never)),
		listConnectors: () => call(() => sdk.listConnectors()),
		createConnector: (body) => call(() => sdk.createConnector(body as never)),
		updateConnector: (body, id) =>
			call(() => sdk.updateConnector(body as never, { path: { connector_id: id } } as never)),
		deleteConnector: (id) => callVoid(() => sdk.deleteConnector({ connector_id: id } as never)),
		getConnectorSchema: (id) =>
			call(() => sdk.getConnectorSchema({ connector_id: id } as never)),
		syncConnector: (body, id) =>
			call(() => sdk.syncConnector(body as never, { path: { connector_id: id } } as never)),
		createQuery: (body) => call(() => sdk.createQuery(body as never)),
		getQuery: (id) => call(() => sdk.getQuery({ query_id: id } as never)),
		answerQuery: (body, id) =>
			call(() => sdk.answerQuery(body as never, { path: { query_id: id } } as never)),
		listQueries: (params) =>
			call(() => sdk.listQueries({ page: params.page, per_page: params.per_page } as never)),
		dashboardStats: () => call(() => sdk.dashboardStats()),
	};
}

/**
 * Loads the saved API key + URL and returns a ready-to-use client.
 * Throws NotLoggedInError when no credentials are stored.
 */
export function getSavedClient(): { client: AuthenticatedClient; apiUrl: string } {
	const cfg = loadConfig();
	if (!cfg.api_key || !cfg.api_url) throw new NotLoggedInError();
	return { client: getAuthenticatedClient(cfg.api_key, cfg.api_url), apiUrl: cfg.api_url };
}
