/**
 * Build release binaries for all supported platforms. Output goes to
 * bin/easysql-<platform>-<arch>, ready to be uploaded as GitHub Release
 * assets. Used by the release.yml workflow.
 *
 *   bun run scripts/release-binaries.ts
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const binDir = join(root, "bin");

interface Target {
	os: "linux" | "darwin" | "windows";
	arch: "x64" | "arm64";
	suffix: string;
}

const TARGETS: Target[] = [
	{ os: "linux", arch: "x64", suffix: "linux-x64" },
	{ os: "linux", arch: "arm64", suffix: "linux-arm64" },
	{ os: "darwin", arch: "x64", suffix: "darwin-x64" },
	{ os: "darwin", arch: "arm64", suffix: "darwin-arm64" },
	{ os: "windows", arch: "x64", suffix: "windows-x64" },
];

function run(cmd: string, args: string[]) {
	console.log(`→ ${cmd} ${args.join(" ")}`);
	const r = spawnSync(cmd, args, { cwd: root, stdio: "inherit" });
	if (r.status !== 0) process.exit(r.status ?? 1);
}

if (existsSync(binDir)) rmSync(binDir, { recursive: true, force: true });
mkdirSync(binDir, { recursive: true });

for (const t of TARGETS) {
	const ext = t.os === "windows" ? ".exe" : "";
	const out = join(binDir, `easysql-${t.suffix}${ext}`);
	run("bun", [
		"build",
		"--compile",
		`--target=bun-${t.os}-${t.arch}`,
		"--minify",
		"--outfile",
		out,
		join(root, "src/bin.ts"),
	]);
}

console.log("\n✓ Built assets:");
for (const t of TARGETS) {
	const ext = t.os === "windows" ? ".exe" : "";
	const out = join(binDir, `easysql-${t.suffix}${ext}`);
	const fs = await import("node:fs");
	const stat = fs.statSync(out);
	console.log(`  ${out.replace(`${root}/`, "")}  ${(stat.size / 1024 / 1024).toFixed(1)} MB`);
}
