/**
 * Shared output helpers — JSON vs pretty printing, color toggling.
 */

import chalk from "chalk";

let colorsEnabled = true;
let jsonMode = false;

export function setJsonMode(enabled: boolean): void {
	jsonMode = enabled;
}

export function isJsonMode(): boolean {
	return jsonMode;
}

export function setColorsEnabled(enabled: boolean): void {
	colorsEnabled = enabled;
	chalk.level = enabled ? 1 : 0;
}

export function isColorsEnabled(): boolean {
	return colorsEnabled;
}

export function print(data: unknown): void {
	if (jsonMode) {
		console.log(JSON.stringify(data, null, 2));
		return;
	}
	if (typeof data === "string") {
		console.log(data);
		return;
	}
	console.log(data);
}

export function printError(message: string): void {
	if (jsonMode) {
		console.log(JSON.stringify({ error: message }, null, 2));
		return;
	}
	console.error(chalk.red("✗") + " " + message);
}

export function printSuccess(message: string): void {
	if (jsonMode) {
		console.log(JSON.stringify({ ok: true, message }, null, 2));
		return;
	}
	console.log(chalk.green("✓") + " " + message);
}

export function printInfo(message: string): void {
	if (jsonMode) return; // suppress chatter in JSON mode
	console.log(chalk.cyan("ℹ") + " " + message);
}
