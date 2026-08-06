import { crePage } from './crePage';
import { creStyles } from './creStyles';
import {
  renderProjektlisteHtml as renderBaseProjektlisteHtml,
  type RenderOptions,
} from './template';
import type { ProjektlisteInput } from './types';

/**
 * Additive CRE-Erweiterung des bestehenden Projektlisten-Templates.
 * Das unveränderte Basistemplate bleibt die Quelle für Cover, Tabellen,
 * Analyse und Abschluss. Die CRE-Seite wird direkt nach dem Cover eingefügt;
 * bestehende Seitenzahlen werden anschließend um genau eine Seite angepasst.
 */
export function renderProjektlisteHtml(
  input: ProjektlisteInput,
  opts: RenderOptions,
): string {
  const base = renderBaseProjektlisteHtml(input, opts);
  const totalMatch = base.match(/Seite\s*<span class="num">\d+<\/span>\s*\/\s*(\d+)/);
  if (!totalMatch) throw new Error('Seitenzählung im Projektlisten-Template nicht gefunden.');

  const baseTotalPages = Number(totalMatch[1]);
  const totalPages = baseTotalPages + 1;
  const pageHtml = crePage({
    documentId: input.meta.documentId,
    logoWhite: opts.logoWhiteDataUri
      ? `<img src="${opts.logoWhiteDataUri}" alt="EMA" style="width:100%;height:auto;display:block">`
      : '',
    projects: input.projects,
    regionsGeo: opts.regions,
    confidentialityNote: input.meta.confidentialityNote,
    heroImage: input.creHeroImage ?? input.heroImage,
    page: 2,
    totalPages,
  });

  const withStyles = base.replace('</style>', `${creStyles}</style>`);
  const coverEnd = withStyles.indexOf('</section>');
  if (coverEnd < 0) throw new Error('Cover-Ende im Projektlisten-Template nicht gefunden.');

  const inserted = `${withStyles.slice(0, coverEnd + 10)}\n${pageHtml}${withStyles.slice(coverEnd + 10)}`;
  let seenCover = false;
  return inserted.replace(
    /Seite\s*<span class="num">(\d+)<\/span>\s*\/\s*(\d+)/g,
    (_match, pageRaw: string) => {
      const page = Number(pageRaw);
      if (!seenCover && page === 1) {
        seenCover = true;
        return `Seite <span class="num">1</span> / ${totalPages}`;
      }
      if (page === 2 && seenCover) {
        // Die neu eingefügte CRE-Seite ist bereits korrekt nummeriert.
        seenCover = false;
        return `Seite <span class="num">2</span> / ${totalPages}`;
      }
      return `Seite <span class="num">${page + 1}</span> / ${totalPages}`;
    },
  );
}
