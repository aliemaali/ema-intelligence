import sanitize from "@apostrophecms/sanitize-html-stable";
export const escapeText = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export const textHtml = (value: string) =>
  escapeText(value).replace(/\r?\n/g, "<br>");
export function sanitizeRichHtml(value: string): string {
  return sanitize(value, {
    allowedTags: [
      "p",
      "div",
      "br",
      "b",
      "strong",
      "i",
      "em",
      "u",
      "s",
      "span",
      "font",
      "a",
      "ul",
      "ol",
      "li",
      "blockquote",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
    ],
    allowedAttributes: {
      "*": ["style"],
      a: ["href", "title"],
      font: ["color", "size", "face"],
      table: ["border", "cellpadding", "cellspacing"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan"],
    },
    allowedSchemes: ["https", "http", "mailto", "tel"],
    allowProtocolRelative: false,
    allowedStyles: {
      "*": {
        color: [
          /^#[0-9a-f]{3,8}$/i,
          /^(?:black|white|red|green|blue)$/i,
          /^rgb\(\s*\d{1,3},\s*\d{1,3},\s*\d{1,3}\)$/,
        ],
        "font-size": [/^(?:10|11|12|14|16|18|20|24|32)px$/],
        "font-family": [
          /^(?:Arial|Calibri|Georgia|Verdana|sans-serif|serif)$/i,
        ],
        "font-weight": [/^(?:bold|normal|[4-7]00)$/],
        "font-style": [/^(?:italic|normal)$/],
        "text-decoration": [/^(?:underline|line-through|none)$/],
        "text-align": [/^(?:left|center|right)$/],
      },
    },
    allowedClasses: {},
    nestingLimit: 25,
    transformTags: {
      font: (tagName, attrs) => ({
        tagName,
        attribs: {
          ...(attrs.color && /^#[a-f0-9]{6}$/i.test(attrs.color)
            ? { color: attrs.color }
            : {}),
          ...(attrs.size && /^[1-7]$/.test(attrs.size)
            ? { size: attrs.size }
            : {}),
          ...(attrs.face && /^(Arial|Calibri|Georgia|Verdana)$/.test(attrs.face)
            ? { face: attrs.face }
            : {}),
        },
      }),
      td: (tagName, attrs) => ({
        tagName,
        attribs: {
          ...(attrs.colspan && /^[1-9]$/.test(attrs.colspan)
            ? { colspan: attrs.colspan }
            : {}),
          ...(attrs.rowspan && /^[1-9]$/.test(attrs.rowspan)
            ? { rowspan: attrs.rowspan }
            : {}),
        },
      }),
    },
  });
}
