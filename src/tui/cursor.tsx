/**
 * Blinking block cursor shown at the end of a focused text input, so the
 * user can tell which field is selected.
 */

import { Text } from "ink";
import { useEffect, useState } from "react";

export function Cursor({ color = "green" }: { color?: string }) {
	const [visible, setVisible] = useState(true);
	useEffect(() => {
		const timer = setInterval(() => setVisible((v) => !v), 530);
		return () => clearInterval(timer);
	}, []);
	return <Text color={color}>{visible ? "▏" : " "}</Text>;
}
