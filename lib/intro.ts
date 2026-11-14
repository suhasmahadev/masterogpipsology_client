let done = false;
const subs = new Set<() => void>();

export function onIntroDone(cb: () => void): () => void {
  if (done) {
    cb();
    return () => {};
  }
  subs.add(cb);
  return () => {
    subs.delete(cb);
  };
}

export function markIntroDone(): void {
  if (done) return;
  done = true;
  subs.forEach((f) => f());
  subs.clear();
}
