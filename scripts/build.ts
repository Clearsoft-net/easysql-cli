/**
 * Build script: bundles src/cli.ts into dist/cli.js (or a standalone binary
 * when invoked with --compile).
 *
 * Usage:
 *   bun run scripts/build.ts            → tsc → dist/
 *   bun run scripts/build.ts --compile  → bun build --compile → bin/easysql
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const args = process.argv.slice(2);
const shouldCompile = args.includes("--compile");

function run(cmd: string, args: string[], opts: { cwd?: string } = {}) {
	const r = spawnSync(cmd, args, {
		cwd: opts.cwd ?? root,
		stdio: "inherit",
		env: process.env,
	});
	if (r.status !== 0) process.exit(r.status ?? 1);
}

if (shouldCompile) {
	console.log("→ Building standalone binary via bun build --compile");
	const binDir = join(root, "bin");
	if (existsSync(binDir)) rmSync(binDir, { recursive: true, force: true });
	mkdirSync(binDir, { recursive: true });

	run(
		"bun",
		[
			"build",
			"--compile",
			"--minify",
			"--outfile",
			join(binDir, "easysql"),
			join(root, "src/bin.ts"),
		],
		{ cwd: root },
	);

	console.log("✓ Binary built at bin/easysql");
	console.log("  Test with: ./bin/easysql --help");
	process.exit(0);
}

console.log("→ Compiling TypeScript to dist/");
if (existsSync(join(root, "dist"))) rmSync(join(root, "dist"), { recursive: true, force: true });

run("tsc", ["-p", "scripts/tsconfig.json"], { cwd: root });

console.log("✓ Built dist/");
