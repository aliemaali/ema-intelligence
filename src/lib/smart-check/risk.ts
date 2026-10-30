/** Unknown equipment and missing evidence are not physical danger indications. */
export function isConcreteVisualRisk(risk:{kind?:string;hazardType?:string;evidenceFileId?:string;detail:string;evidence:string},attachmentIds:string[]):boolean {
  if(risk.kind!=='visible_damage'||!risk.evidenceFileId||!attachmentIds.includes(risk.evidenceFileId)||risk.evidence.trim().length<6)return false
  // Require a named physical finding in the image evidence, not merely a model category.
  const markers:Record<string,RegExp>={burn:/schmor|brandspur|verkohl|geschmolzen|angeschmolzen/i,exposed_conductor:/blank(?:e|er|en|es)? (?:leiter|ader|draht)|offen(?:e|er|en)? (?:leiter|ader)|freiliegend(?:e|er|en)? (?:leiter|ader|kontakt)/i,broken_cover:/(?:gebrochen|beschädigt|fehlend|gerissen).{0,30}(?:abdeckung|berührungsschutz)|(?:abdeckung|berührungsschutz).{0,30}(?:gebrochen|beschädigt|fehlt|gerissen)/i,water:/wassereintritt|wassertropfen|nass(?:e|er|en)? (?:bauteil|leiter|klemme)|feuchtigkeitsspur/i}
  const marker=markers[risk.hazardType||'']
  if(!marker||!marker.test(risk.evidence))return false
  if(/(?:schmor\w*|brandspur\w*|leiter|ader|abdeckung|berührungsschutz|wasser\w*).{0,35}(?:nicht (?:sichtbar|erkennbar|bestätigt)|nicht sicher|nicht zu erkennen)/i.test(risk.evidence))return false
  return !/(?:keine?|ohne|nicht (?:sichtbar|erkennbar|vorhanden)|nicht sicher|unklar|unbestätigt).{0,50}(?:schmor|brand|verkohl|geschmolzen|leiter|ader|abdeckung|berührungsschutz|wasser|feuchtigkeit)/i.test(risk.evidence)
}
