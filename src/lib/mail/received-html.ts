import sanitize from '@apostrophecms/sanitize-html-stable';

export const imageTypes = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);
export const normalizeCid = (id: string) => {
  try { return decodeURIComponent(id).replace(/^<|>$/g, '').toLowerCase(); } catch { return ''; }
};
export function referencedCids(html: string) {
  return [...new Set(Array.from(html.matchAll(/cid:([^\s"'<>]+)/gi), m => normalizeCid(m[1])).filter(Boolean))];
}
export function validMailImage(bytes: Uint8Array, mime: string) {
  const starts = (s: number[]) => s.every((v,i) => bytes[i] === v);
  return mime === 'image/png' ? starts([137,80,78,71,13,10,26,10])
    : mime === 'image/jpeg' ? starts([255,216,255])
    : mime === 'image/gif' ? starts([71,73,70,56])
    : mime === 'image/webp' ? starts([82,73,70,70]) && [87,69,66,80].every((v,i) => bytes[i+8] === v) : false;
}
export function safeMailImage(src: string, inline: Record<string,string>) {
  if (/^cid:/i.test(src)) src = inline[normalizeCid(src.slice(4))] || '';
  if (/^data:image\/(?:png|jpeg|gif|webp);base64,[a-z0-9+/=]+$/i.test(src) && src.length < 7_000_000) return src;
  try {
    const url = new URL(src.startsWith('//') ? `https:${src}` : src);
    if (url.protocol === 'http:') url.protocol = 'https:';
    const host = url.hostname.toLowerCase();
    // Raster images only; prevent mail HTML from addressing local resources or app routes.
    if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') || !host.includes('.') || host.includes(':') || /^[\d.]+$/.test(host) || host.endsWith('.local') || host.endsWith('.localhost') || host === 'localhost' || host === 'app.ema-enterprise.de') return '';
    return url.href;
  } catch { return ''; }
}
export function sanitizeReceivedHtml(html: string, inline: Record<string,string> = {}) {
  return sanitize(html.slice(0, 2_000_000), {
    allowedTags: ['p','div','br','b','strong','i','em','u','s','span','font','a','ul','ol','li','blockquote','table','thead','tbody','tfoot','tr','th','td','img','hr','h1','h2','h3','h4','center'],
    allowedAttributes: { '*':['style','dir'], a:['href','title','target','rel'], img:['src','alt','width','height','referrerpolicy'], table:['width','border','cellpadding','cellspacing'], td:['width','colspan','rowspan','align','valign'], th:['colspan','rowspan'], font:['color','face','size'] },
    allowedSchemes: ['https','http','mailto','tel','data'],
    allowedSchemesByTag: { img:['https','data'], a:['https','http','mailto','tel'] },
    allowProtocolRelative: false,
    exclusiveFilter: frame => frame.tag === 'img' && !frame.attribs.src,
    nestingLimit: 40,
    allowedStyles: { '*': {
      color:[/^#[0-9a-f]{3,8}$/i,/^[a-z]{3,20}$/i,/^rgba?\([\d\s,.%]+\)$/i],
      'background-color':[/^#[0-9a-f]{3,8}$/i,/^[a-z]{3,20}$/i,/^rgba?\([\d\s,.%]+\)$/i],
      'font-size':[/^\d{1,2}(?:px|pt)$/], 'font-family':[/^[a-z ,"'-]{1,100}$/i], 'font-weight':[/^(?:bold|normal|[1-9]00)$/], 'font-style':[/^(?:italic|normal)$/],
      'text-align':[/^(?:left|center|right)$/], 'text-decoration':[/^(?:underline|line-through|none)$/],
      width:[/^\d{1,4}px$/,/^\d{1,3}%$/], 'max-width':[/^\d{1,4}px$/,/^100%$/],
      padding:[/^[\d\s.px]{1,30}$/], margin:[/^[\d\s.px]{1,30}$/], 'border-collapse':[/^(?:collapse|separate)$/],
    } },
    transformTags: {
      img: (_tag, attrs) => {
        const tiny = ['width','height'].some(key => /^\d+$/.test(attrs[key] || '') && Number(attrs[key]) <= 1);
        const src = tiny ? '' : safeMailImage(attrs.src || '', inline);
        return { tagName:'img', attribs: { ...(src ? {src} : {}), alt:attrs.alt || '', referrerpolicy:'no-referrer', ...(attrs.width && /^\d{1,4}$/.test(attrs.width) ? {width:attrs.width} : {}) } };
      },
      a: (_tag, attrs) => ({ tagName:'a', attribs:{ href:attrs.href || '', title:attrs.title || '', target:'_blank', rel:'noopener noreferrer' } }),
    },
  });
}
export function receivedDocument(html: string, inline: Record<string,string> = {}) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; script-src 'none'; connect-src 'none'; form-action 'none'; base-uri 'none'"><style>html{color-scheme:light}body{display:flow-root;margin:0;padding:8px;color:#182c3b;background:#fff;font:14px/1.5 Arial,sans-serif;overflow-wrap:anywhere;box-sizing:border-box}img{max-width:100%!important;height:auto!important}table{max-width:100%!important}a{color:#008b76}pre{white-space:pre-wrap}</style></head><body>${sanitizeReceivedHtml(html,inline)}</body></html>`;
}
