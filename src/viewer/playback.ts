/** Automatic ticks loop; manual navigation clamps. Keep the final result for
 * one interval before wrapping, including any trailing hidden replay events. */
export function nextReplayCursor(
  cursors: readonly number[], cursor: number, end: number,
  direction: number, loop = false,
): number {
  if (!cursors.length) return cursor;
  if (direction < 0) return [...cursors].reverse().find(c => c < cursor) ?? cursor;
  const next = cursors.find(c => c > cursor);
  if (next === undefined) return loop && cursor >= end ? cursors[0]! : end;
  return next === cursors[cursors.length - 1] ? end : next;
}
