const LINKS_ATTRIBUTE = "data-links";

export const OWN_LINKS = { [LINKS_ATTRIBUTE]: "" };

export const linkOwner = (target: Element) => target.closest(`[${LINKS_ATTRIBUTE}]`);
