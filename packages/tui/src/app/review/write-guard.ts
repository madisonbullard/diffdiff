/** A synchronous claim: React state cannot guard two keys in one stdin chunk. */
export function createWriteGuard() {
  const pending = new Set<string>();
  return {
    isPending: (key: string) => pending.has(key),
    hasPending: () => pending.size > 0,
    acquire(key: string): (() => void) | undefined {
      if (pending.has(key)) return undefined;
      pending.add(key);
      return () => {
        pending.delete(key);
      };
    },
  };
}
