/**
 * Strips the runtime/script prefix from `process.argv` so commander only
 * sees the real user arguments. Handles three shapes:
 *   - bun-compiled binary: ["bun", "/$bunfs/root/<entry>", ...user]
 *   - interpreter + script: ["bun"|"node", "<script>.{js,ts,mjs,cjs}", ...user]
 *   - installed binary:     [".../easysql", ...user]
 */
export function userArgs(argv: string[]): string[] {
	const a0 = argv[0] ?? "";
	const a1 = argv[1] ?? "";
	if ((a0 === "bun" || a0.endsWith("/bun")) && a1.includes("$bunfs/")) {
		return argv.slice(2);
	}
	const isInterpreter =
		a0 === "bun" || a0 === "node" || a0.endsWith("/bun") || a0.endsWith("/node");
	if (isInterpreter && /\.(c|m)?(js|ts)$/.test(a1)) {
		return argv.slice(2);
	}
	if (a0.endsWith("easysql") || a0.endsWith("easysql-cli")) {
		return argv.slice(1);
	}
	return argv;
}
