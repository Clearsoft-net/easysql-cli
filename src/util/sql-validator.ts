/**
 * Defense-in-depth SQL validator — mirrors apps/api/src/core/sql-validator.ts
 *
 * The EasySQL API already enforces SELECT-only + LIMIT<=100 server-side.
 * This client-side check is a safety belt: if the user has been given a
 * malicious API key that bypasses the server check, the CLI still won't
 * execute a mutation locally.
 *
 * Strategy: lightweight tokenizer that strips comments + string literals,
 * then a regex over the remaining code for forbidden keywords. Not as
 * rigorous as a full AST — but the server is the source of truth.
 */

const FORBIDDEN_KEYWORDS = [
	"INSERT",
	"UPDATE",
	"DELETE",
	"DROP",
	"TRUNCATE",
	"ALTER",
	"CREATE",
	"GRANT",
	"REVOKE",
	"EXEC",
	"EXECUTE",
	"CALL",
	"COPY",
	"VACUUM",
	"REINDEX",
	"LOCK",
	"UNLOCK",
	"RENAME",
	"SET\\s+ROLE",
	"SET\\s+SESSION",
	"RESET",
	"COPY",
	"\\bINTO\\b",
	"\\bOUTFILE\\b",
	"\\bLOAD_FILE\\b",
];

export interface ValidationResult {
	ok: boolean;
	reason?: string;
}

function neutralizeLiterals(sql: string): string {
	// Remove line comments
	let out = sql.replace(/--[^\n]*/g, " ");
	// Remove block comments
	out = out.replace(/\/\*[\s\S]*?\*\//g, " ");
	// Remove single-quoted strings (handle escaped quotes)
	out = out.replace(/'(?:''|[^'])*'/g, "''");
	// Remove double-quoted identifiers (Postgres-style)
	out = out.replace(/"(?:""|[^"])*"/g, '""');
	// Remove backtick-quoted identifiers (MySQL)
	out = out.replace(/`(?:``|[^`])*`/g, "``");
	// Remove dollar-quoted strings (Postgres)
	out = out.replace(/\$([A-Za-z]*)\$[\s\S]*?\$\1\$/g, " ");
	return out;
}

export function validateSelectOnly(sql: string): ValidationResult {
	const cleaned = neutralizeLiterals(sql).trim();

	// Reject empty input.
	if (cleaned.length === 0) {
		return { ok: false, reason: "Empty SQL" };
	}

	// Reject stacked statements (semicolons other than at the very end).
	const semicolons = cleaned.match(/;/g) ?? [];
	if (semicolons.length > 1 || (semicolons.length === 1 && !cleaned.endsWith(";"))) {
		return { ok: false, reason: "Multiple statements are not allowed" };
	}

	// First non-whitespace token must be WITH or SELECT.
	const headMatch = cleaned.match(/^\s*(WITH|SELECT|EXPLAIN|SHOW)\b/i);
	if (!headMatch) {
		return {
			ok: false,
			reason: "Statement must start with SELECT, WITH, EXPLAIN, or SHOW",
		};
	}

	for (const kw of FORBIDDEN_KEYWORDS) {
		const re = new RegExp(`\\b${kw}\\b`, "i");
		if (re.test(cleaned)) {
			return { ok: false, reason: `Forbidden keyword detected: ${kw.replace(/\\b/g, "")}` };
		}
	}

	return { ok: true };
}
