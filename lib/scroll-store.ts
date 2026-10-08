export interface ScrollStore {
  velocity: number;
  direction: 1 | -1 | 0;
  heroProgress: number;
  sculptureProgress: number;
  mouseX: number;
  mouseY: number;
}

export const scrollStore: ScrollStore = {
  velocity: 0,
  direction: 0,
  heroProgress: 0,
  sculptureProgress: 0,
  mouseX: 0,
  mouseY: 0,
};
