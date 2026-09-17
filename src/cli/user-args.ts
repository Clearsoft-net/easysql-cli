/**
 * Strips the runtime/script prefix from `process.argv` so commander only
 * sees the real user arguments. Handles four shapes:
 *   - bun-compiled binary: ["bun", "/$bunfs/root/<entry>", ...user]
 *   - interpreter + script: ["bun"|"node", "<script>.{js,ts,mjs,cjs}", ...user]
 *   - package-manager shim: ["node", ".../node_modules/.bin/easysql", ...user]
 *     (a symlink with no extension — cannot be keyed off the extension)
 *   - installed binary:     [".../easysql", ...user]
 */
export function userArgs(argv: string[]): string[] {
	const a0 = argv[0] ?? "";
	const a1 = argv[1] ?? "";
	const isInterpreter =
		a0 === "bun" || a0 === "node" || a0.endsWith("/bun") || a0.endsWith("/node");
	if (isInterpreter && a1.length > 0) {
		return argv.slice(2);
	}
	if (a0.endsWith("easysql") || a0.endsWith("easysql-cli")) {
		return argv.slice(1);
	}
	return argv;
}
