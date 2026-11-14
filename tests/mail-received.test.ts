import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeReceivedHtml, receivedDocument, referencedCids, safeMailImage, validMailImage } from '../src/lib/mail/received-html';
const png = 'data:image/png;base64,iVBORw0KGgo=';
test('received HTML keeps image layouts and maps CID resources without active content', () => {
  const html = sanitizeReceivedHtml('<table><tr><td style="background-color:#fff">Hello<img src="cid:LOGO%40mail" onerror="alert(1)" alt="Logo"></td></tr></table><script>evil()</script><form action="https://evil.test"><input></form><iframe src="https://evil.test"></iframe><svg onload="evil()"></svg><style>body{background:url(https://evil.test)}</style>', {'logo@mail':png});
  assert.match(html, /<table>/); assert.match(html,/background-color:#fff/); assert.ok(html.includes(png));
  assert.ok(!/script|onerror|onload|<form|<input|<iframe|<svg|<style|evil\(/.test(html));
  assert.deepEqual(referencedCids('<img src="cid:logo%40mail"><IMG SRC="CID:logo@mail">'), ['logo@mail']);
});
test('received images reject script, vector, local and app URLs; strip tracking pixels', () => {
  for (const url of ['javascript:alert(1)','data:image/svg+xml;base64,PHN2Zz4=','https://127.0.0.1/a','https://localhost/a','https://example.local/a','https://app.ema-enterprise.de/api/mail/connect','https://user:pass@example.com/a','/api/mail/connect']) assert.equal(safeMailImage(url,{}), '');
  assert.equal(safeMailImage('//cdn.example.com/logo.png',{}), 'https://cdn.example.com/logo.png');
  assert.equal(safeMailImage('cid:bad',{bad:'data:text/html;base64,YQ=='}), '');
  assert.ok(!sanitizeReceivedHtml('<img src="https://cdn.example.com/pixel" width="1" height="1">').includes('<img'));
  assert.ok(!sanitizeReceivedHtml('<img srcset="https://evil.test/x 2x" src="javascript:x">').includes('srcset'));
});
test('mail document blocks scripts, forms and connections and validates raster attachments', () => {
  const doc = receivedDocument('<a href="https://example.com">Website</a><img src="https://cdn.example.com/photo.jpg">');
  assert.match(doc, /script-src 'none'/); assert.match(doc,/form-action 'none'/); assert.match(doc,/connect-src 'none'/);
  assert.match(doc,/referrerpolicy="no-referrer"/); assert.match(doc,/rel="noopener noreferrer"/);
  assert.ok(validMailImage(new Uint8Array([255,216,255,1]),'image/jpeg'));
  assert.ok(!validMailImage(new TextEncoder().encode('<svg>'),'image/jpeg'));
  assert.ok(!validMailImage(new TextEncoder().encode('<svg>'),'image/svg+xml'));
});
