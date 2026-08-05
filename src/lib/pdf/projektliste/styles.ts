export const styles = `
:root{
  --navy:#1F2A44;
  --navy-700:#2C3A5C;
  --navy-050:#F2F4F8;
  --green:#5CB800;
  --green-050:#F1F9E8;
  --ink:#111827;
  --muted:#6B7385;
  --line:#E3E7EE;
  --tint:#F8F9FB;
  --pad:16mm;
}
*{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
html,body{background:#5A6070;}
body{
  font-family:'Inter',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;
  color:var(--ink);
  font-size:9pt;
  line-height:1.45;
  font-feature-settings:'tnum' 1,'cv05' 1;
  -webkit-font-smoothing:antialiased;
}
@page{size:A4 portrait;margin:0;}

.sheet{
  position:relative;
  width:210mm;height:297mm;
  background:#fff;overflow:hidden;
  page-break-after:always;break-after:page;
  display:flex;flex-direction:column;
}
.sheet:last-child{page-break-after:auto;break-after:auto;}
@media screen{
  body{padding:12mm 0;display:flex;flex-direction:column;align-items:center;gap:10mm;}
  .sheet{box-shadow:0 10px 40px rgba(0,0,0,.35);}
}

/* ---------- Cover ---------- */
.cover-hero{position:relative;height:128mm;flex:0 0 128mm;overflow:hidden;}
.cover-hero svg,.cover-hero img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;}
.cover-hero .hero-scrim{
  position:absolute;inset:0;
  background:
    linear-gradient(180deg,rgba(16,24,40,.84) 0%,rgba(31,42,68,.26) 30%,rgba(31,42,68,.44) 60%,rgba(14,22,38,.95) 100%),
    linear-gradient(100deg,rgba(14,22,38,.86) 0%,rgba(14,22,38,.16) 54%,rgba(14,22,38,0) 100%);
}
.cover-hero .layer{position:absolute;inset:0;padding:var(--pad);display:flex;flex-direction:column;justify-content:space-between;}
.cover-top{display:flex;justify-content:space-between;align-items:flex-start;}
.cover-brand{display:flex;align-items:center;gap:3.6mm;}
.cover-brand .mk{width:15mm;}
.cover-brand .mk svg{position:static;width:100%;height:auto;display:block;}
.cover-brand .wd{color:#fff;font-size:12.5pt;font-weight:700;letter-spacing:.14em;line-height:1;}
.cover-brand .wd span{display:block;font-size:6.1pt;font-weight:500;letter-spacing:.24em;color:rgba(255,255,255,.76);margin-top:1.4mm;}
.chip{
  display:inline-flex;align-items:center;gap:1.6mm;
  padding:1.5mm 3.2mm;border-radius:999px;
  border:.3mm solid rgba(255,255,255,.34);
  background:rgba(255,255,255,.10);
  color:#fff;font-size:6.4pt;font-weight:600;letter-spacing:.09em;text-transform:uppercase;
}
.chip .dot{width:1.5mm;height:1.5mm;border-radius:50%;background:var(--green);}
.cover-title{color:#fff;}
.cover-eyebrow{font-size:7.2pt;font-weight:600;letter-spacing:.22em;text-transform:uppercase;color:rgba(255,255,255,.78);margin-bottom:3mm;}
.cover-title h1{font-size:38pt;font-weight:700;letter-spacing:-.02em;line-height:1.02;}
.cover-rule{width:22mm;height:1.1mm;background:var(--green);margin:5mm 0 4mm;border-radius:1mm;}
.cover-sub{display:flex;align-items:center;gap:3.5mm;font-size:12pt;font-weight:500;color:rgba(255,255,255,.94);}
.cover-sub .flag{width:7.5mm;display:block;}
.cover-sub .flag svg{position:static;width:100%;height:auto;}

.cover-body{flex:1;padding:9mm var(--pad) 0;display:flex;gap:10mm;}
.cover-meta{flex:1;display:flex;flex-direction:column;}
.cover-lead{font-size:9.2pt;line-height:1.6;color:#3A4256;max-width:88mm;}
.cover-facts{margin-top:7mm;border-top:.3mm solid var(--line);}
.cover-facts .fr{display:flex;justify-content:space-between;align-items:baseline;padding:2.4mm 0;border-bottom:.25mm solid var(--line);}
.cover-facts .fr .n{font-size:7.6pt;color:#4A5266;}
.cover-facts .fr .v{font-size:8.6pt;font-weight:700;color:var(--navy);font-variant-numeric:tabular-nums;}
.cover-facts .fr .v small{font-size:6.8pt;font-weight:500;color:var(--muted);margin-left:.8mm;}
.meta-grid{margin-top:auto;display:grid;grid-template-columns:1fr 1fr;gap:5mm 6mm;padding-top:6mm;border-top:.3mm solid var(--line);}
.meta-item .k{font-size:6.4pt;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);}
.meta-item .v{font-size:9.6pt;font-weight:600;color:var(--navy);margin-top:.8mm;}
.cover-map{width:74mm;flex:0 0 74mm;display:flex;flex-direction:column;}
.cover-map .map-frame{background:var(--tint);border:.3mm solid var(--line);border-radius:2.5mm;padding:3mm 2.5mm;}
.cover-map svg{width:100%;height:auto;display:block;}
.map-caption{margin-top:2.5mm;font-size:6.6pt;color:var(--muted);display:flex;align-items:center;gap:2mm;}
.map-caption .key{width:2.2mm;height:2.2mm;border-radius:50%;background:var(--green);flex:0 0 auto;}

.kpi-row{display:grid;grid-template-columns:repeat(3,1fr);gap:4mm;padding:8mm var(--pad) 0;}
.kpi{
  border:.3mm solid var(--line);border-radius:2.5mm;padding:5mm 5mm 4.5mm;
  background:linear-gradient(180deg,#fff 0%,var(--tint) 100%);
  position:relative;overflow:hidden;
}
.kpi::before{content:'';position:absolute;left:0;top:0;bottom:0;width:1.1mm;background:var(--green);}
.kpi .k{font-size:6.4pt;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);}
.kpi .v{font-size:23pt;font-weight:700;color:var(--navy);letter-spacing:-.02em;line-height:1.1;margin-top:1.5mm;}
.kpi .v small{font-size:11pt;font-weight:600;margin-left:1mm;color:var(--navy-700);}
.kpi .s{font-size:7pt;color:var(--muted);margin-top:1mm;}

/* ---------- Kopf- und Fußzeile ---------- */
.page-head{
  display:flex;align-items:center;justify-content:space-between;
  padding:11mm var(--pad) 0;
}
.page-head .brand{display:flex;align-items:center;gap:3.5mm;}
.page-head .mark{width:11mm;}
.page-head .mark svg{width:100%;height:auto;display:block;}
.page-head .t{font-size:7.4pt;font-weight:600;color:var(--navy);letter-spacing:.04em;}
.page-head .t span{display:block;font-size:6.4pt;font-weight:500;color:var(--muted);letter-spacing:.1em;text-transform:uppercase;margin-top:.6mm;}
.page-head .doc{font-size:6.6pt;color:var(--muted);letter-spacing:.1em;text-transform:uppercase;text-align:right;}

.page-body{flex:1;padding:0 var(--pad);display:flex;flex-direction:column;min-height:0;}
.section-head{padding-top:5mm;padding-bottom:3mm;}
.section-head h2{font-size:15.5pt;font-weight:700;color:var(--navy);letter-spacing:-.015em;}
.section-head .sub{font-size:8.2pt;color:var(--muted);margin-top:1.5mm;}
.section-head .accent{width:14mm;height:.9mm;background:var(--green);border-radius:1mm;margin-bottom:3.2mm;}

.page-foot{
  margin-top:auto;padding:3mm var(--pad) 8mm;
  display:flex;align-items:flex-end;justify-content:space-between;gap:6mm;
}
.page-foot .line{border-top:.3mm solid var(--line);padding-top:3mm;display:flex;justify-content:space-between;width:100%;align-items:flex-end;}
.page-foot .l{font-size:6.4pt;color:var(--muted);line-height:1.5;}
.page-foot .l b{color:var(--navy);font-weight:600;}
.page-foot .r{font-size:6.6pt;color:var(--muted);text-align:right;white-space:nowrap;}
.page-foot .r .num{font-size:9pt;font-weight:700;color:var(--navy);}

/* ---------- Tabelle ---------- */
table.projects{width:100%;border-collapse:collapse;table-layout:fixed;}
table.projects thead th{
  background:var(--navy);color:#fff;
  font-size:5.9pt;font-weight:600;letter-spacing:.08em;text-transform:uppercase;line-height:1.2;
  padding:2.6mm 1.6mm;text-align:left;vertical-align:bottom;
}
table.projects thead th .u{
  display:block;font-weight:500;font-size:5.3pt;letter-spacing:.05em;text-transform:none;
  color:rgba(255,255,255,.60);margin-top:.5mm;
}
table.projects thead th:first-child{padding-left:3mm;border-top-left-radius:1.6mm;}
table.projects thead th:last-child{padding-right:3mm;border-top-right-radius:1.6mm;}
table.projects tbody td{
  font-size:7.3pt;padding:1.35mm 1.6mm;line-height:1.18;vertical-align:middle;
  border-bottom:.25mm solid var(--line);color:#26314A;
}
table.projects tbody td:first-child{padding-left:3mm;}
table.projects tbody td:last-child{padding-right:3mm;}
table.projects tbody tr:nth-child(even) td{background:#F8F9FB;}
.t-no{color:var(--muted);font-size:7pt;font-weight:600;}
.t-name{font-weight:600;color:var(--navy);}
.t-region{line-height:1.15;}
.num{text-align:right;font-variant-numeric:tabular-nums;}
.num b{font-weight:600;color:var(--navy);}
.unit{color:var(--muted);font-size:6.6pt;margin-left:.6mm;}
.badge{
  display:inline-block;padding:.8mm 1.8mm;border-radius:1.2mm;
  font-size:6.1pt;font-weight:600;letter-spacing:.01em;white-space:nowrap;line-height:1.3;
}
.b-rtb{background:var(--green-050);color:#3F7D06;border:.25mm solid #CBE8AA;}
.b-permit{background:#EEF3FF;color:#2A4A9B;border:.25mm solid #CBD9F5;}
.b-filed{background:#FFF7E6;color:#8A6100;border:.25mm solid #F3E0AE;}
.b-prep{background:#F3F4F7;color:#5B6478;border:.25mm solid #E1E4EB;}
.b-share{background:var(--navy-050);color:var(--navy);border:.25mm solid #DDE2EC;}
.tfoot-strip{
  margin-top:3.2mm;display:flex;justify-content:space-between;align-items:center;
  background:var(--navy);color:#fff;border-radius:1.6mm;padding:3.2mm 3.5mm;
}
.tfoot-strip .l{font-size:7pt;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.72);font-weight:600;}
.tfoot-strip .r{font-size:10.5pt;font-weight:700;}
.legend-note{margin-top:3.5mm;font-size:6.5pt;color:var(--muted);line-height:1.55;}

/* ---------- Analyse ---------- */
.stat-row{display:grid;grid-template-columns:repeat(4,1fr);gap:3.5mm;}
.stat{border:.3mm solid var(--line);border-radius:2.2mm;padding:3.6mm;background:#fff;}
.stat .k{font-size:6.2pt;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);}
.stat .v{font-size:15pt;font-weight:700;color:var(--navy);letter-spacing:-.02em;margin-top:1.2mm;}
.stat .v small{font-size:8pt;font-weight:600;}
.stat .s{font-size:6.6pt;color:var(--muted);margin-top:.8mm;line-height:1.35;}

.grid-2{display:grid;grid-template-columns:1.35fr 1fr;gap:5mm;margin-top:5.5mm;}
.card{border:.3mm solid var(--line);border-radius:2.5mm;padding:4mm;background:#fff;}
.card h3{font-size:8.6pt;font-weight:700;color:var(--navy);letter-spacing:.01em;}
.card .hint{font-size:6.6pt;color:var(--muted);margin-top:.8mm;margin-bottom:3.6mm;}

.bars{display:flex;flex-direction:column;gap:2.3mm;}
.bar-row{display:grid;grid-template-columns:1fr auto;gap:2mm;align-items:baseline;}
.bar-label{font-size:7.2pt;color:#2E3850;font-weight:500;}
.bar-val{font-size:7.2pt;font-weight:700;color:var(--navy);font-variant-numeric:tabular-nums;}
.bar-track{grid-column:1/-1;height:2.6mm;background:#EEF0F4;border-radius:1.3mm;overflow:hidden;}
.bar-fill{height:100%;border-radius:1.3mm;background:linear-gradient(90deg,var(--navy) 0%,var(--navy-700) 100%);}
.bar-fill.g{background:linear-gradient(90deg,#4E9E00 0%,var(--green) 100%);}
.bar-meta{grid-column:1/-1;font-size:6.3pt;color:var(--muted);margin-top:-.6mm;}

.donut-wrap{display:flex;flex-direction:column;align-items:center;}
.donut{width:46mm;height:46mm;position:relative;}
.donut svg{width:100%;height:100%;display:block;}
.donut .center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;}
.donut .center .v{font-size:14pt;font-weight:700;color:var(--navy);line-height:1;}
.donut .center .k{font-size:6.4pt;color:var(--muted);letter-spacing:.08em;margin-top:1mm;}
.legend{width:100%;margin-top:5mm;display:flex;flex-direction:column;gap:2.4mm;}
.legend .li{display:flex;align-items:center;gap:2.5mm;font-size:7pt;}
.legend .sw{width:2.6mm;height:2.6mm;border-radius:.8mm;flex:0 0 auto;}
.legend .nm{flex:1;color:#2E3850;}
.legend .vl{font-weight:700;color:var(--navy);font-variant-numeric:tabular-nums;}
.legend .pc{color:var(--muted);width:11mm;text-align:right;font-variant-numeric:tabular-nums;}

.grid-3{display:grid;grid-template-columns:repeat(3,1fr);gap:5mm;margin-top:5mm;}
.mini-row{display:flex;justify-content:space-between;align-items:center;padding:1.9mm 0;border-bottom:.25mm solid var(--line);font-size:7.1pt;}
.mini-row:last-child{border-bottom:none;}
.mini-row .n{color:#2E3850;}
.mini-row .v{font-weight:700;color:var(--navy);font-variant-numeric:tabular-nums;}
.mini-row .v span{font-weight:500;color:var(--muted);font-size:6.5pt;margin-left:1.2mm;}

/* ---------- Abschluss ---------- */
.exec{display:grid;grid-template-columns:1.5fr 1fr;gap:7mm;}
.exec p{font-size:8.1pt;line-height:1.58;color:#333C52;margin-bottom:2.8mm;}
.exec p:last-child{margin-bottom:0;}
.exec .pull{
  border-left:1.1mm solid var(--green);padding:1mm 0 1mm 4mm;
  font-size:8.8pt;font-weight:600;color:var(--navy);line-height:1.5;margin:1mm 0 4mm;
}
.figures{background:var(--navy);border-radius:2.5mm;padding:5mm 5mm;color:#fff;}
.figures h3{font-size:7pt;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,.66);font-weight:600;margin-bottom:4mm;}
.fig-row{display:flex;justify-content:space-between;align-items:baseline;padding:2.2mm 0;border-bottom:.25mm solid rgba(255,255,255,.14);}
.fig-row:last-child{border-bottom:none;}
.fig-row .n{font-size:7.4pt;color:rgba(255,255,255,.78);}
.fig-row .v{font-size:10pt;font-weight:700;}
.fig-row .v small{font-size:7pt;font-weight:500;color:rgba(255,255,255,.7);margin-left:.8mm;}

.focus{margin-top:5.5mm;}
.focus-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:4mm;margin-top:4mm;}
.focus-card{border:.3mm solid var(--line);border-radius:2.2mm;padding:4.5mm;background:var(--tint);}
.focus-card .r{font-size:6.2pt;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--green);}
.focus-card .n{font-size:9.4pt;font-weight:700;color:var(--navy);margin-top:1.2mm;line-height:1.25;}
.focus-card .d{font-size:7pt;color:var(--muted);margin-top:2mm;line-height:1.5;}

.steps{margin-top:5.5mm;}
.steps-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:4mm 6mm;margin-top:4mm;}
.step{display:flex;gap:3.5mm;}
.step .i{
  flex:0 0 6.5mm;height:6.5mm;border-radius:50%;background:var(--navy);color:#fff;
  display:flex;align-items:center;justify-content:center;font-size:7.4pt;font-weight:700;
}
.step .c .t{font-size:8.2pt;font-weight:700;color:var(--navy);}
.step .c .d{font-size:7.2pt;color:#5A6377;line-height:1.5;margin-top:.8mm;}

.contact{
  margin-top:5.5mm;border-top:.3mm solid var(--line);padding-top:5mm;
  display:flex;justify-content:space-between;align-items:flex-end;gap:6mm;
}
.contact .who .n{font-size:9.2pt;font-weight:700;color:var(--navy);}
.contact .who .r{font-size:7.2pt;color:var(--muted);margin-top:.6mm;}
.contact .who .c{font-size:7.6pt;color:#333C52;margin-top:2.5mm;line-height:1.6;}
.contact .brand{display:flex;align-items:center;gap:3.2mm;}
.contact .brand .mk{width:15mm;}
.contact .brand .mk svg{width:100%;height:auto;display:block;}
.contact .brand .wd{color:var(--navy);font-size:12pt;font-weight:700;letter-spacing:.14em;line-height:1;}
.contact .brand .wd span{display:block;font-size:5.9pt;font-weight:500;letter-spacing:.22em;color:var(--muted);margin-top:1.3mm;}
.disclaimer{margin-top:4mm;font-size:6.2pt;line-height:1.55;color:#8A90A0;}
`;
