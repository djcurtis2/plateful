/** Hides posts from cooks the viewer has blocked. Display-only: votes, points and winners are never changed. */
export function withoutBlocked<T>(rows: T[], blocked: Set<string>, userIdOf: (row: T) => string | null): T[] {
  if (blocked.size === 0) return rows;
  return rows.filter((row) => {
    const id = userIdOf(row);
    return id === null || !blocked.has(id);
  });
}
