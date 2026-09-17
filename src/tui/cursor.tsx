/**
 * Blinking block cursor for a focused text input. Render it before the
 * placeholder when the buffer is empty, after the text once the user
 * starts typing.
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
