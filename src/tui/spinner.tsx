/**
 * Tiny braille spinner for in-flight states (generating SQL, executing…).
 */

import { Text } from "ink";
import { useEffect, useState } from "react";

const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export function Spinner({ label }: { label: string }) {
	const [frame, setFrame] = useState(0);
	useEffect(() => {
		const timer = setInterval(() => setFrame((f) => (f + 1) % FRAMES.length), 80);
		return () => clearInterval(timer);
	}, []);
	return (
		<Text color="cyan">
			{FRAMES[frame]} {label}
		</Text>
	);
}
