import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render } from "ink-testing-library";
import { ResultTable } from "../src/tui/result-table.js";

afterEach(cleanup);

describe("ResultTable", () => {
	it("renders every border line at the same width (columns stay aligned)", () => {
		const { lastFrame } = render(
			<ResultTable
				columns={["id", "full_name", "revenue_cents"]}
				rows={[
					{ id: 4, full_name: "Diana Costa", revenue_cents: 226800 },
					{ id: 1, full_name: "Alice Martins", revenue_cents: 45700 },
				]}
			/>,
		);
		const lines = (lastFrame() ?? "").split("\n").filter((l) => l.includes("│") || l.includes("─"));
		const widths = new Set(lines.map((l) => l.length));
		expect(widths.size).toBe(1);
		expect(lastFrame()).toContain("Diana Costa");
		expect(lastFrame()).toContain("full_name");
	});

	it("handles an empty column set", () => {
		const { lastFrame } = render(<ResultTable columns={[]} rows={[]} />);
		expect(lastFrame()).toContain("empty result set");
	});
});
