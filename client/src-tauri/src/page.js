(() => {
  if (window.__cconnect) return;
  const post = (kind, data) => {
    const kept = document.title;
    document.title = '⁣cconnect:' + JSON.stringify({ kind, data });
    setTimeout(() => { document.title = kept; });
  };
  const describe = (target) => {
    const parts = [];
    let node = target;
    while (node && node.nodeType === 1 && parts.length < 6) {
      if (node.id) { parts.unshift('#' + CSS.escape(node.id)); break; }
      let part = node.tagName.toLowerCase();
      part += [...node.classList].slice(0, 2).map((name) => '.' + CSS.escape(name)).join('');
      const parent = node.parentElement;
      if (parent) {
        const same = [...parent.children].filter((item) => item.tagName === node.tagName);
        if (same.length > 1) part += ':nth-of-type(' + (same.indexOf(node) + 1) + ')';
      }
      parts.unshift(part);
      node = node.parentElement;
    }
    const box = target.getBoundingClientRect();
    return {
      selector: parts.join(' > '),
      text: (target.innerText || '').trim().slice(0, 200),
      html: target.outerHTML.slice(0, 2000),
      width: Math.round(box.width),
      height: Math.round(box.height)
    };
  };
  const crosshair = new CSSStyleSheet();
  crosshair.replaceSync('*, *::before, *::after { cursor: crosshair !important; }');
  let host = null;
  let mark = null;
  const place = (event) => {
    if (!host || !(event.target instanceof Element)) return;
    const box = event.target.getBoundingClientRect();
    Object.assign(mark.style, { left: box.left + 'px', top: box.top + 'px', width: box.width + 'px', height: box.height + 'px' });
  };
  const block = (event) => { event.preventDefault(); event.stopPropagation(); };
  const choose = (event) => {
    block(event);
    const target = event.target;
    stop();
    if (target instanceof Element) post('picked', describe(target));
  };
  const cancel = (event) => { if (event.key === 'Escape') { block(event); stop(); } };
  const listeners = [['mousemove', place], ['mousedown', block], ['mouseup', block], ['click', choose], ['keydown', cancel]];
  const start = () => {
    if (host) return;
    host = document.createElement('cconnect-pick');
    host.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none';
    const root = host.attachShadow({ mode: 'closed' });
    mark = document.createElement('div');
    mark.style.cssText = 'position:fixed;pointer-events:none;background:rgba(111,168,220,0.45);outline:1px solid rgb(111,168,220);left:0;top:0;width:0;height:0';
    root.append(mark);
    document.documentElement.appendChild(host);
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, crosshair];
    for (const [name, handler] of listeners) addEventListener(name, handler, true);
    post('picking', true);
  };
  const stop = () => {
    if (!host) return;
    host.remove();
    host = mark = null;
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter((sheet) => sheet !== crosshair);
    for (const [name, handler] of listeners) removeEventListener(name, handler, true);
    post('picking', false);
  };
  window.addEventListener('focus', (event) => {
    if (event.target === window) post('focused');
  });
  const NOTCH = 100;
  let wheeled = 0;
  if (window.top === window) {
    window.addEventListener('wheel', (event) => {
      if (!event.ctrlKey || event.defaultPrevented) return;
      event.preventDefault();
      wheeled += event.deltaY;
      if (Math.abs(wheeled) < NOTCH) return;
      post('zoom', wheeled < 0 ? 1 : -1);
      wheeled = 0;
    }, { passive: false });
  }
  Object.defineProperty(window, '__cconnect', { value: { pick: (on) => (on ? start() : stop()), describe } });
})();
