const END_SLACK = 1;

export function keepEnd(node: HTMLElement) {
  let height = node.clientHeight;
  const sized = new ResizeObserver(() => {
    const next = node.clientHeight;
    const overflowed = node.scrollHeight > height;
    if (next < height && overflowed && node.scrollTop + height >= node.scrollHeight - END_SLACK) {
      node.scrollTop = node.scrollHeight - next;
    }
    height = next;
  });
  sized.observe(node);
  return { destroy: () => sized.disconnect() };
}
