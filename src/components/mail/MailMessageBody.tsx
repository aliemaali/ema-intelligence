'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Attachment, Message } from '@/lib/mail/model';
import { imageTypes, normalizeCid, receivedDocument, referencedCids, validMailImage } from '@/lib/mail/received-html';
import s from './mail.module.css';

export function MailMessageBody({ message, attachments, mailbox }: { message: Message; attachments: Attachment[]; mailbox: string }) {
  const html = message.body?.contentType.toLowerCase() === 'html';
  const content = message.body?.content || message.bodyPreview;
  const [inline, setInline] = useState<Record<string,string>>({});
  const [photos, setPhotos] = useState<{ id: string; src: string; name: string }[]>([]);
  const [failed, setFailed] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    setInline({}); setPhotos([]); setFailed(false);
    const references = html ? referencedCids(content) : [];
    let total = 0;
    const images = attachments.filter(a => {
      if (!imageTypes.has(a.contentType.toLowerCase()) || a.size > 5_000_000 || a.size < 0 || total + a.size > 20_000_000) return false;
      total += a.size; return true;
    }).slice(0,20);
    void Promise.allSettled(images.map(async file => {
      const response = await fetch(`/api/mail/attachment?${new URLSearchParams({ mailbox, id:message.id, attachmentId:file.id })}`, { cache:'no-store', signal:controller.signal });
      const data = await response.json();
      if (!response.ok) throw new Error('Bild konnte nicht geladen werden.');
      const a = data.attachment as Attachment;
      const mime = a.contentType.toLowerCase();
      if (!a.contentBytes || a.contentBytes.length > 7_000_000 || !imageTypes.has(mime)) throw new Error('Ungültiges Bild.');
      const bytes = Uint8Array.from(atob(a.contentBytes), c => c.charCodeAt(0));
      if (!validMailImage(bytes,mime)) throw new Error('Ungültiges Bildformat.');
      const cid = normalizeCid(a.contentId || a.name);
      return {cid,src:`data:${mime};base64,${a.contentBytes}`,id:file.id,name:file.name,isInline:a.isInline || file.isInline};
    })).then(results => {
      if (controller.signal.aborted) return;
      const sources: Record<string,string> = {};
      for (const result of results) if (result.status === 'fulfilled' && result.value.cid) sources[result.value.cid] = result.value.src;
      setInline(sources);
      setPhotos(results.flatMap(result => result.status === 'fulfilled' && !result.value.isInline && !references.includes(result.value.cid) ? [result.value] : []));
      setFailed(results.some(result => result.status === 'rejected'));
    });
    return () => controller.abort();
  }, [html, content, attachments, mailbox, message.id]);
  const document = useMemo(() => html ? receivedDocument(content,inline) : '', [html,content,inline]);
  useEffect(() => {
    const iframe = frame.current;
    if (!iframe || !html) return;
    let observer: ResizeObserver | undefined;
    let body: HTMLElement | undefined;
    const resize = () => {
      if (body) iframe.style.height = `${Math.min(20000,Math.max(120,body.scrollHeight + 20))}px`;
    };
    const loaded = () => {
      observer?.disconnect();
      body?.removeEventListener('load',resize,true);
      body = iframe.contentDocument?.body;
      if (!body) return;
      resize();
      observer = new ResizeObserver(resize); observer.observe(body);
      body.addEventListener('load',resize,true);
    };
    iframe.addEventListener('load',loaded);
    if (iframe.contentDocument?.readyState === 'complete') loaded();
    return () => { iframe.removeEventListener('load',loaded); body?.removeEventListener('load',resize,true); observer?.disconnect(); };
  }, [html,document]);
  return <div className={s.receivedMail}>
    {html ? <iframe ref={frame} title="E-Mail-Inhalt" srcDoc={document} sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox" referrerPolicy="no-referrer" className={s.receivedFrame} /> : <div className={s.mailBody}>{content}</div>}
    {photos.map(photo => <figure key={photo.id} className={s.receivedPhoto}><img src={photo.src} alt={photo.name} loading="lazy" /><figcaption>{photo.name}</figcaption></figure>)}
    {failed && <small>Einige eingebettete Bilder konnten nicht geladen werden.</small>}
  </div>;
}
