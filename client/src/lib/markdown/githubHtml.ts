import DOMPurify from "dompurify";

const TAGS = [
  "h1", "h2", "h3", "h4", "h5", "h6", "br", "b", "i", "strong", "em", "a", "pre", "code", "img", "tt", "div",
  "ins", "del", "sup", "sub", "p", "picture", "source", "ol", "ul", "table", "thead", "tbody", "tfoot",
  "blockquote", "dl", "dt", "dd", "kbd", "q", "samp", "var", "hr", "ruby", "rt", "rp", "li", "tr", "td", "th",
  "s", "strike", "summary", "details", "caption", "figure", "figcaption", "abbr", "bdo", "cite", "dfn", "mark",
  "small", "span", "time", "wbr",
];

const ATTRIBUTES = [
  "abbr", "accept", "accept-charset", "accesskey", "action", "align", "alt", "aria-describedby", "aria-hidden",
  "aria-label", "aria-labelledby", "axis", "border", "cellpadding", "cellspacing", "char", "charoff", "charset",
  "checked", "cite", "clear", "cols", "colspan", "color", "compact", "coords", "datetime", "dir", "disabled",
  "enctype", "for", "frame", "headers", "height", "href", "hreflang", "hspace", "ismap", "itemprop", "itemscope",
  "itemtype", "label", "lang", "longdesc", "maxlength", "media", "method", "multiple", "name", "nohref", "noshade",
  "nowrap", "open", "progress", "prompt", "readonly", "rel", "rev", "role", "rows", "rowspan", "rules", "scope",
  "selected", "shape", "size", "span", "src", "srcset", "start", "summary", "tabindex", "target", "title", "type",
  "usemap", "valign", "value", "vspace", "width", "class", "data-alert",
];

const OWN_CLASS = /^(task|task-done|li-marker|md-alert|md-alert-[a-z]+)$/;
const TEXT_ALIGN = /^text-align:\s*(left|right|center);?$/;
const ABSOLUTE = /^([a-z][a-z\d+.-]*:|\/\/)/i;

export const RELATIVE_SRC = "data-relative-src";

const purifier = DOMPurify(window);

purifier.addHook("uponSanitizeAttribute", (_node, data) => {
  if (data.attrName === "class") {
    const kept = data.attrValue.split(/\s+/).filter((name) => OWN_CLASS.test(name));
    data.attrValue = kept.join(" ");
    data.keepAttr = kept.length > 0;
  } else if (data.attrName === "style") {
    data.forceKeepAttr = TEXT_ALIGN.test(data.attrValue.trim());
  }
});

purifier.addHook("afterSanitizeAttributes", (node) => {
  const source = node.getAttribute("src");
  if (node.tagName === "IMG" && source && !ABSOLUTE.test(source)) {
    node.setAttribute(RELATIVE_SRC, source);
    node.removeAttribute("src");
  }
  const set = node.getAttribute("srcset");
  if (node.tagName === "SOURCE" && set && !ABSOLUTE.test(set)) node.removeAttribute("srcset");
});

export const githubHtml = (html: string): string =>
  purifier.sanitize(html, { ALLOWED_TAGS: TAGS, ALLOWED_ATTR: ATTRIBUTES, ALLOW_DATA_ATTR: false });
