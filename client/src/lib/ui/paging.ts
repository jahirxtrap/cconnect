export const LOAD_MORE_PX = 200;

export const nearEdge = (node: HTMLElement) =>
  node.scrollHeight - node.scrollTop - node.clientHeight < LOAD_MORE_PX;
