/**
 * Minimal SQL syntax highlighter for ink. Tokenizes keywords, strings,
 * numbers and comments into colored <Text> spans (no external parser).
 */

import { Text } from "ink";
import type { ReactNode } from "react";

const KEYWORDS = new Set([
	"select",
	"from",
	"where",
	"join",
	"inner",
	"left",
	"right",
	"full",
	"outer",
	"cross",
	"on",
	"as",
	"and",
	"or",
	"not",
	"in",
	"is",
	"null",
	"like",
	"between",
	"exists",
	"group",
	"by",
	"having",
	"order",
	"asc",
	"desc",
	"limit",
	"offset",
	"distinct",
	"count",
	"sum",
	"avg",
	"min",
	"max",
	"case",
	"when",
	"then",
	"else",
	"end",
	"with",
	"union",
	"all",
	"insert",
	"into",
	"values",
	"update",
	"set",
	"delete",
	"create",
	"table",
	"view",
	"cast",
	"coalesce",
	"over",
	"partition",
	"using",
]);

const TOKEN = /(--[^\n]*)|('(?:[^']|'')*')|(\b\d+(?:\.\d+)?\b)|([A-Za-z_][A-Za-z0-9_]*)|([\s\S])/g;

export function SqlText({ sql }: { sql: string }) {
	const nodes: ReactNode[] = [];
	const re = new RegExp(TOKEN);
	let m: RegExpExecArray | null;
	let key = 0;
	while ((m = re.exec(sql)) !== null) {
		const [, comment, str, num, word, other] = m;
		if (comment !== undefined) {
			nodes.push(
				<Text key={key++} dimColor>
					{comment}
				</Text>,
			);
		} else if (str !== undefined) {
			nodes.push(
				<Text key={key++} color="yellow">
					{str}
				</Text>,
			);
		} else if (num !== undefined) {
			nodes.push(
				<Text key={key++} color="yellow">
					{num}
				</Text>,
			);
		} else if (word !== undefined) {
			if (KEYWORDS.has(word.toLowerCase())) {
				nodes.push(
					<Text key={key++} color="magenta" bold>
						{word}
					</Text>,
				);
			} else {
				nodes.push(
					<Text key={key++} color="cyan">
						{word}
					</Text>,
				);
			}
		} else if (other !== undefined) {
			nodes.push(other);
		}
	}
	return <Text>{nodes}</Text>;
}
