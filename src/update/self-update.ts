/**
 * Self-update — queries the GitHub Releases API for the latest easysql-cli
 * release, downloads the matching platform binary, and atomically replaces
 * the running executable.
 *
 * Feed: https://api.github.com/repos/Clearsoft-net/easysql-cli/releases/latest
 * Asset naming convention: easysql-<platform>-<arch>
 *   - linux-x64, linux-arm64, darwin-x64, darwin-arm64, windows-x64
 */

import { chmodSync, existsSync, renameSync, writeFileSync } from "node:fs";
import { arch, platform } from "node:os";
import { join } from "node:path";
import { CliError } from "../cli/errors.js";
import { NAME, REPO, VERSION } from "../version.js";

const FEED = `https://api.github.com/repos/${REPO}/releases/latest`;

export interface ReleaseInfo {
	tag: string;
	version: string;
	assets: { name: string; url: string; size: number }[];
}

interface AssetMeta {
	name: string;
	browser_download_url: string;
	size: number;
}

interface GhRelease {
	tag_name: string;
	assets: AssetMeta[];
}

export function currentPlatform(): string {
	const p = platform();
	const a = arch();
	const archPart = a === "arm64" ? "arm64" : "x64";
	switch (p) {
		case "linux":
			return `linux-${archPart}`;
		case "darwin":
			return `darwin-${archPart}`;
		case "win32":
			return `windows-${archPart}`;
		default:
			return `${p}-${archPart}`;
	}
}

export async function fetchLatestRelease(feedUrl: string = FEED): Promise<ReleaseInfo> {
	const res = await fetch(feedUrl, {
		headers: { Accept: "application/vnd.github+json", "User-Agent": NAME },
	});
	if (!res.ok) {
		throw new CliError(`Could not fetch releases feed (${res.status} ${res.statusText})`, 3);
	}
	const payload = (await res.json()) as GhRelease;
	const version = payload.tag_name.replace(/^v/, "");
	return {
		tag: payload.tag_name,
		version,
		assets: payload.assets.map((a) => ({
			name: a.name,
			url: a.browser_download_url,
			size: a.size,
		})),
	};
}

export function findAsset(
	release: ReleaseInfo,
	targetPlatform: string,
): { name: string; url: string; size: number } {
	const expectedPrefix = `easysql-${targetPlatform}`;
	const asset = release.assets.find((a) => a.name.startsWith(expectedPrefix));
	if (!asset) {
		throw new CliError(`No release asset matches your platform (${targetPlatform}).`, 1);
	}
	return asset;
}

export function compareSemver(a: string, b: string): number {
	const parse = (s: string) =>
		s
			.replace(/^v/, "")
			.split(".")
			.map((n) => Number.parseInt(n, 10) || 0);
	const [a1 = 0, a2 = 0, a3 = 0] = parse(a);
	const [b1 = 0, b2 = 0, b3 = 0] = parse(b);
	if (a1 !== b1) return a1 - b1;
	if (a2 !== b2) return a2 - b2;
	return a3 - b3;
}

export async function downloadAsset(url: string, dest: string): Promise<void> {
	const res = await fetch(url, { redirect: "follow" });
	if (!res.ok) {
		throw new CliError(`Download failed (${res.status} ${res.statusText})`, 3);
	}
	const buf = new Uint8Array(await res.arrayBuffer());
	writeFileSync(dest, buf);
	chmodSync(dest, 0o755);
}

export function atomicReplace(source: string, target: string): void {
	if (!existsSync(source)) {
		throw new CliError(`Downloaded binary missing at ${source}.`, 1);
	}
	// On POSIX, rename is atomic when both paths are on the same filesystem.
	// Cross-filesystem renames fall back to copy + delete.
	try {
		renameSync(source, target);
	} catch (err) {
		throw new CliError(
			`Could not replace binary at ${target}: ${err instanceof Error ? err.message : String(err)}`,
			1,
		);
	}
}

export async function selfUpdate(opts: {
	target: string;
	checkOnly: boolean;
}): Promise<{ current: string; latest: string; updated: boolean }> {
	const release = await fetchLatestRelease();
	const current = VERSION;
	const latest = release.version;
	if (compareSemver(latest, current) <= 0) {
		return { current, latest, updated: false };
	}
	if (opts.checkOnly) {
		return { current, latest, updated: false };
	}
	const asset = findAsset(release, currentPlatform());
	const tmp = join(opts.target, ".easysql-update.tmp");
	await downloadAsset(asset.url, tmp);
	atomicReplace(tmp, opts.target);
	return { current, latest, updated: true };
}
