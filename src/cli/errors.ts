/**
 * Errors raised by the CLI — caught in cli.ts and rendered uniformly.
 */

export class CliError extends Error {
	readonly exitCode: number;
	readonly hint?: string;

	constructor(message: string, exitCode = 1, hint?: string) {
		super(message);
		this.name = "CliError";
		this.exitCode = exitCode;
		if (hint !== undefined) this.hint = hint;
	}
}

export class NotLoggedInError extends CliError {
	constructor() {
		super("Not authenticated. Run 'easysql login' first.", 2);
		this.name = "NotLoggedInError";
	}
}

export class NetworkError extends CliError {
	constructor(message: string) {
		super(`Network error: ${message}`, 3);
		this.name = "NetworkError";
	}
}

export class ApiError extends CliError {
	readonly status: number;
	constructor(status: number, message: string) {
		super(`API error (${status}): ${message}`, 4);
		this.name = "ApiError";
		this.status = status;
	}
}
