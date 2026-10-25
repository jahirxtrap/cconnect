(report) => {
  const mark = Symbol.for('cconnect.pageIcon');
  if (window.top !== window || window[mark]) return;
  window[mark] = true;
  const TOUCH = ['apple-touch-icon', 'apple-touch-icon-precomposed'];
  const SVG = /\.svg([?#]|$)/i;
  const NONE = 'data:,';
  const relsOf = (link) => link.rel.toLowerCase().split(/\s+/);
  const sizeOf = (link) => {
    const sizes = (link.getAttribute('sizes') || '').toLowerCase().split(/\s+/).filter(Boolean);
    if (sizes.includes('any') || link.type === 'image/svg+xml' || SVG.test(link.href)) return Infinity;
    return Math.max(0, ...sizes.map((size) => parseInt(size, 10) || 0));
  };
  const iconOf = () => {
    let best = null;
    let declined = false;
    for (const link of document.querySelectorAll('link[rel][href]')) {
      const rels = relsOf(link);
      const plain = rels.includes('icon');
      if (!plain && !rels.some((rel) => TOUCH.includes(rel))) continue;
      if (link.href === NONE) {
        declined = true;
        continue;
      }
      const rank = [sizeOf(link), plain ? 1 : 0];
      if (!best || rank[0] > best.rank[0] || (rank[0] === best.rank[0] && rank[1] > best.rank[1])) best = { href: link.href, rank };
    }
    if (best) return best.href;
    return !declined && /^https?:$/.test(location.protocol) ? location.origin + '/favicon.ico' : '';
  };
  let shown = null;
  const share = () => {
    const icon = iconOf();
    if (icon === shown) return;
    shown = icon;
    report(icon);
  };
  const follow = () => {
    share();
    if (!document.head) return;
    new MutationObserver(share).observe(document.head, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['href', 'rel', 'sizes', 'type'],
    });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', follow, { once: true });
  else follow();
}
