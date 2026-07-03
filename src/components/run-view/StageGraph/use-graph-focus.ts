import { useState } from "react";

/** Toggles a graph canvas between its normal compact height and a much taller "focused" height, for pipelines with many stages/jobs that don't fit comfortably in the default view. */
export function useGraphFocus(compactHeight: number, focusedHeight: number) {
  const [focused, setFocused] = useState(false);
  return { height: focused ? focusedHeight : compactHeight, focused, toggle: () => setFocused((f) => !f) };
}
