// Weighted load-progress tracker. Pure TS (no DOM) so it is unit-testable.

export interface LoadProgress {
  register(id: string, weight: number): void;
  update(id: string, fraction: number): void;
  complete(id: string): void;
  progress(): number;
  allDone(): boolean;
  isDone(id: string): boolean;
  subscribe(fn: (p: number) => void): () => void;
}

export function createLoadProgress(): LoadProgress {
  const tasks = new Map<string, { weight: number; done: number }>();
  const subs = new Set<(p: number) => void>();

  const progress = (): number => {
    let sw = 0;
    let sd = 0;
    tasks.forEach((t) => {
      sw += t.weight;
      sd += t.weight * t.done;
    });
    return sw <= 0 ? 1 : Math.min(1, Math.max(0, sd / sw));
  };
  const emit = (): void => {
    const p = progress();
    subs.forEach((f) => f(p));
  };

  return {
    register(id, weight) {
      if (tasks.has(id) || !(weight > 0)) return;
      tasks.set(id, { weight, done: 0 });
      emit();
    },
    update(id, fraction) {
      const t = tasks.get(id);
      if (!t) return;
      const f = Math.min(1, Math.max(0, Number.isFinite(fraction) ? fraction : 0));
      if (f === t.done) return;
      t.done = f;
      emit();
    },
    complete(id) {
      this.update(id, 1);
    },
    progress,
    allDone() {
      for (const t of tasks.values()) if (t.done < 1) return false;
      return true;
    },
    isDone(id) {
      const t = tasks.get(id);
      return !t || t.done >= 1;
    },
    subscribe(fn) {
      subs.add(fn);
      return () => {
        subs.delete(fn);
      };
    },
  };
}

export const loadProgress = createLoadProgress();
