import { describe, expect, it } from "bun:test";
import { ApiError } from "../src/cli/errors.js";
import { apiErrorFromResult, isConnectorNotFoundError } from "../src/sdk/client.js";

describe("apiErrorFromResult", () => {
	it("uses response.status and the FastAPI `detail` field", () => {
		const e = apiErrorFromResult({
			response: { status: 404 },
			error: { detail: "Connector not found" },
		});
		expect(e).toBeInstanceOf(ApiError);
		expect(e.status).toBe(404);
		expect(e.message).toBe("API error (404): Connector not found");
	});

	it("falls back to `message` / `error` keys", () => {
		expect(
			apiErrorFromResult({ response: { status: 401 }, error: { message: "nope" } }).message,
		).toBe("API error (401): nope");
		expect(
			apiErrorFromResult({ response: { status: 400 }, error: { error: "bad" } }).message,
		).toBe("API error (400): bad");
	});

	it("accepts a plain-string body", () => {
		const e = apiErrorFromResult({ response: { status: 500 }, error: "boom" });
		expect(e.status).toBe(500);
		expect(e.message).toBe("API error (500): boom");
	});

	it("defaults to status 0 and a generic message when nothing is available", () => {
		const e = apiErrorFromResult({});
		expect(e.status).toBe(0);
		expect(e.message).toBe("API error (0): request failed");
	});
});

describe("isConnectorNotFoundError", () => {
	it("matches a 404 whose message mentions the connector", () => {
		const e = apiErrorFromResult({
			response: { status: 404 },
			error: { detail: "Connector not found" },
		});
		expect(isConnectorNotFoundError(e)).toBe(true);
	});

	it("ignores a 404 about another resource", () => {
		const e = apiErrorFromResult({
			response: { status: 404 },
			error: { detail: "Query not found" },
		});
		expect(isConnectorNotFoundError(e)).toBe(false);
	});

	it("ignores non-404 connector errors", () => {
		const e = apiErrorFromResult({
			response: { status: 400 },
			error: { detail: "Connector invalid" },
		});
		expect(isConnectorNotFoundError(e)).toBe(false);
	});

	it("ignores non-ApiError values", () => {
		expect(isConnectorNotFoundError(new Error("Connector not found"))).toBe(false);
		expect(isConnectorNotFoundError(undefined)).toBe(false);
	});
});
