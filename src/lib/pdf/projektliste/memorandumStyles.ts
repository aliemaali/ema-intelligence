export const memorandumStyles = `
.memo-hero{height:72mm;flex:0 0 72mm;}
.memo-hero .cover-title h1{font-size:27pt;}
.memo-hero .cover-eyebrow{margin-bottom:2mm;}
.memo-hero .cover-rule{margin:3.4mm 0 3mm;}
.memo-hero .cover-sub{font-size:9.6pt;gap:2.8mm;}
.memo-hero .cover-sub .flag{width:6mm;}
.memo-docid{margin-top:2.5mm;font-size:6.2pt;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.72);}

.memo-kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:3mm;padding:5mm var(--pad) 0;}
.memo-kpis .kpi{min-width:0;padding:3.4mm 3mm 3.2mm;}
.memo-kpis .kpi .k{font-size:5.5pt;white-space:nowrap;}
.memo-kpis .kpi .v{font-size:12.2pt;margin-top:1.2mm;white-space:nowrap;letter-spacing:-.02em;}
.memo-kpis .kpi .v.compact{font-size:9.6pt;letter-spacing:-.035em;}

.memo-body{padding:5mm var(--pad) 0;display:grid;grid-template-columns:1.22fr 1fr;gap:6mm;flex:1;min-height:0;}
.memo-col{display:flex;flex-direction:column;gap:3.3mm;min-height:0;}
.memo-head{display:flex;align-items:center;gap:2mm;margin-bottom:1.7mm;}
.memo-head .dot{width:2mm;height:2mm;border-radius:50%;background:var(--green);flex:0 0 auto;}
.memo-head h3{font-size:7.6pt;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--navy);}
.memo-summary{font-size:7.3pt;line-height:1.55;color:#333C52;}

.memo-photo{border:.3mm solid var(--line);border-radius:2.5mm;background:#fff;overflow:hidden;}
.memo-photo .frame{width:100%;height:73mm;background:var(--tint);overflow:hidden;}
.memo-photo .frame img{width:100%;height:100%;object-fit:cover;object-position:center;display:block;}
.memo-photo .cap{padding:2.1mm 3.2mm;font-size:6pt;font-weight:600;letter-spacing:.13em;color:var(--muted);border-top:.3mm solid var(--line);}

.memo-map-card{border:.3mm solid var(--line);border-radius:2.5mm;padding:3.4mm;background:#fff;display:flex;gap:4mm;align-items:center;min-height:31mm;}
.memo-map-card .map{width:22mm;flex:0 0 22mm;display:flex;justify-content:center;}
.memo-map-card .map svg{width:100%;max-height:25mm;display:block;}
.memo-map-card .loc{font-size:6.9pt;color:#2E3850;line-height:1.55;}
.memo-map-card .loc b{color:var(--navy);font-weight:700;}
.memo-map-card .loc .hint{font-size:6pt;color:var(--muted);margin-top:.8mm;}
.no-photo .memo-map-card{min-height:54mm;}
.no-photo .memo-map-card .map{width:38mm;flex-basis:38mm;}
.no-photo .memo-map-card .map svg{max-height:46mm;}

.memo-profile{display:flex;flex-direction:column;}
.memo-profile .row{display:flex;justify-content:space-between;gap:3mm;padding:1.55mm 0;border-bottom:.25mm solid var(--line);font-size:6.8pt;}
.memo-profile .row:last-child{border-bottom:none;}
.memo-profile .row .n{color:var(--muted);}
.memo-profile .row .v{font-weight:700;color:var(--navy);text-align:right;max-width:48mm;}

.memo-highlights{display:flex;flex-direction:column;gap:1.7mm;}
.memo-highlight{display:flex;align-items:center;gap:2.6mm;border:.3mm solid var(--line);border-radius:2mm;padding:1.7mm 2.8mm;background:var(--tint);}
.memo-highlight .check{width:4mm;height:4mm;border-radius:50%;background:var(--navy);display:flex;align-items:center;justify-content:center;flex:0 0 auto;}
.memo-highlight .check svg{width:2.3mm;height:2.3mm;display:block;}
.memo-highlight .t{font-size:6.7pt;color:#26314A;font-weight:600;line-height:1.3;}

.memo-figures{background:var(--navy);border-radius:2.5mm;padding:4mm 4.2mm;color:#fff;}
.memo-figures .fig-row{display:flex;justify-content:space-between;align-items:baseline;padding:1.75mm 0;border-bottom:.25mm solid rgba(255,255,255,.14);}
.memo-figures .fig-row:last-child{border-bottom:none;}
.memo-figures .fig-row .n{font-size:6.7pt;color:rgba(255,255,255,.78);}
.memo-figures .fig-row .v{font-size:8.6pt;font-weight:700;text-align:right;}
.memo-figures .fig-row .v small{font-size:6pt;font-weight:500;color:rgba(255,255,255,.7);margin-left:.6mm;}

.memo-detail-sheet .section-head{padding-top:7mm;padding-bottom:5mm;}
.memo-detail-sheet .section-head .sub{max-width:160mm;line-height:1.55;}
.memo-detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:4mm;align-items:start;}
.memo-detail-card{border:.3mm solid var(--line);border-radius:2.5mm;background:#fff;overflow:hidden;break-inside:avoid;}
.memo-detail-card.wide{grid-column:1 / -1;}
.memo-detail-card h3{display:flex;align-items:center;gap:2mm;padding:3mm 3.8mm;background:var(--navy);color:#fff;font-size:7.2pt;font-weight:700;letter-spacing:.07em;text-transform:uppercase;}
.memo-detail-card h3 span{width:1.8mm;height:1.8mm;border-radius:50%;background:var(--green);flex:0 0 auto;}
.memo-detail-rows{padding:0 3.8mm;}
.memo-detail-card.wide .memo-detail-rows{display:grid;grid-template-columns:1fr 1fr;column-gap:6mm;}
.memo-detail-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.25fr);gap:3mm;padding:2.15mm 0;border-bottom:.25mm solid var(--line);font-size:6.8pt;line-height:1.4;min-height:8mm;align-items:center;}
.memo-detail-row:last-child{border-bottom:none;}
.memo-detail-row .n{color:var(--muted);}
.memo-detail-row .v{font-weight:650;color:var(--navy);text-align:right;overflow-wrap:anywhere;}
.memo-detail-row .v.pending{color:#976000;}
.memo-detail-note{margin-top:5mm;border-radius:2.5mm;background:var(--navy);padding:4mm 4.5mm;color:rgba(255,255,255,.82);font-size:6.8pt;line-height:1.55;}

.memo-portfolio-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:3mm;margin-bottom:5mm;}
.memo-portfolio-kpis>div{border:.3mm solid var(--line);border-left:1.2mm solid var(--green);border-radius:2.2mm;padding:3.5mm;background:#fff;}
.memo-portfolio-kpis span{display:block;font-size:5.8pt;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);}
.memo-portfolio-kpis b{display:block;margin-top:1.3mm;font-size:12pt;color:var(--navy);}
.memo-portfolio-list{display:grid;grid-template-columns:1fr 1fr;gap:4mm;}
.memo-portfolio-site{border:.3mm solid var(--line);border-radius:2.5mm;background:#fff;overflow:hidden;break-inside:avoid;}
.memo-portfolio-site .site-title{display:flex;align-items:flex-start;justify-content:space-between;gap:4mm;padding:3.3mm 3.8mm;background:var(--navy);color:#fff;}
.memo-portfolio-site .site-title b{display:block;font-size:9pt;}
.memo-portfolio-site .site-title span{display:block;margin-top:.8mm;font-size:5.8pt;color:rgba(255,255,255,.68);}
.memo-portfolio-site .site-power{text-align:right;font-size:8pt;font-weight:700;white-space:nowrap;}
.memo-portfolio-site .site-power span{font-size:5.8pt;}
.memo-portfolio-site .site-dd{padding:1mm 3.8mm 2mm;}
.memo-portfolio-site .site-dd>div{display:grid;grid-template-columns:25mm 1fr;gap:3mm;padding:2mm 0;border-bottom:.25mm solid var(--line);font-size:6.2pt;line-height:1.35;}
.memo-portfolio-site .site-dd>div:last-child{border-bottom:none;}
.memo-portfolio-site .site-dd span{color:var(--muted);}
.memo-portfolio-site .site-dd b{text-align:right;color:var(--navy);font-weight:650;}
.memo-portfolio-site .site-dd b.pending{color:#976000;}
`;
