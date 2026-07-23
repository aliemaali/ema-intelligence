import type { InvestorFocus, InvestorSearchProfile } from '@/types/investors'

type ParsedToken = { value: string; end: number }

function decodePdfBytes(bytes: Uint8Array) {
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    const swapped = Buffer.alloc(Math.max(0, bytes.length - 2))
    for (let index = 2; index + 1 < bytes.length; index += 2) {
      swapped[index - 2] = bytes[index + 1]
      swapped[index - 1] = bytes[index]
    }
    return swapped.toString('utf16le').replace(/\u0000/g, '')
  }
  return Buffer.from(bytes).toString('latin1')
}

function parseLiteralString(source: string, start: number): ParsedToken | null {
  if (source[start] !== '(') return null
  const bytes: number[] = []
  let depth = 1
  let index = start + 1

  while (index < source.length && depth > 0) {
    const character = source[index]
    const code = source.charCodeAt(index) & 0xff

    if (character === '\\') {
      index += 1
      if (index >= source.length) break
      const escaped = source[index]
      const escapedCode = source.charCodeAt(index) & 0xff
      const escapedValues: Record<string, number> = { n: 10, r: 13, t: 9, b: 8, f: 12 }

      if (escaped in escapedValues) bytes.push(escapedValues[escaped])
      else if (escaped === '\n') {
        // PDF line continuation: no byte is emitted.
      } else if (escaped === '\r') {
        if (source[index + 1] === '\n') index += 1
      } else if (/[0-7]/.test(escaped)) {
        let octal = escaped
        for (let count = 0; count < 2 && /[0-7]/.test(source[index + 1] || ''); count += 1) {
          index += 1
          octal += source[index]
        }
        bytes.push(Number.parseInt(octal, 8))
      } else {
        bytes.push(escapedCode)
      }
    } else if (character === '(') {
      depth += 1
      bytes.push(code)
    } else if (character === ')') {
      depth -= 1
      if (depth > 0) bytes.push(code)
    } else {
      bytes.push(code)
    }
    index += 1
  }

  return { value: decodePdfBytes(Uint8Array.from(bytes)).trim(), end: index }
}

function parseHexString(source: string, start: number): ParsedToken | null {
  if (source[start] !== '<' || source[start + 1] === '<') return null
  const end = source.indexOf('>', start + 1)
  if (end < 0) return null
  let hex = source.slice(start + 1, end).replace(/\s/g, '')
  if (hex.length % 2) hex += '0'
  const parts = hex.match(/.{2}/g) ?? []
  return {
    value: decodePdfBytes(Uint8Array.from(parts.map((part) => Number.parseInt(part, 16)))).trim(),
    end: end + 1,
  }
}

function readToken(source: string, start: number): ParsedToken | null {
  let index = start
  while (/\s/.test(source[index] || '')) index += 1

  if (source[index] === '(') return parseLiteralString(source, index)
  if (source[index] === '<' && source[index + 1] !== '<') return parseHexString(source, index)
  if (source[index] === '/') {
    const match = source.slice(index + 1).match(/^[^\s<>\[\]()/%]+/)
    if (!match) return null
    return { value: match[0], end: index + 1 + match[0].length }
  }
  return null
}

export function extractInvestorProfileFields(buffer: Uint8Array) {
  const source = Buffer.from(buffer).toString('latin1')
  const fields: Record<string, string> = {}
  const objectPattern = /\d+\s+\d+\s+obj\b([\s\S]*?)endobj/g

  for (const objectMatch of source.matchAll(objectPattern)) {
    const body = objectMatch[1]
    const titleIndex = body.search(/\/T(?=[\s(<])\s*/)
    if (titleIndex < 0) continue
    const titlePrefix = body.slice(titleIndex).match(/^\/T(?=[\s(<])\s*/)?.[0]
    if (!titlePrefix) continue
    const title = readToken(body, titleIndex + titlePrefix.length)
    if (!title?.value) continue

    let latestValue: string | null = null
    const valuePattern = /\/V(?=[\s(<\/])\s*/g
    let valueMatch: RegExpExecArray | null
    while ((valueMatch = valuePattern.exec(body))) {
      const parsed = readToken(body, valueMatch.index + valueMatch[0].length)
      if (parsed) latestValue = parsed.value
    }

    if (latestValue !== null) fields[title.value] = latestValue === 'Off' ? '' : latestValue
  }

  return fields
}

function checked(fields: Record<string, string>, name: string) {
  const value = fields[name]?.trim().toLowerCase()
  return !!value && value !== 'off' && value !== 'false' && value !== '0'
}

function selectedLabels(fields: Record<string, string>, mapping: Record<string, string>) {
  return Object.entries(mapping).filter(([field]) => checked(fields, field)).map(([, label]) => label)
}

function ticketRange(fields: Record<string, string>) {
  const bands = [
    { field: 'vol_1', label: '< 5 Mio. €', min: 0, max: 5_000_000 },
    { field: 'vol_2', label: '5–20 Mio. €', min: 5_000_000, max: 20_000_000 },
    { field: 'vol_3', label: '20–50 Mio. €', min: 20_000_000, max: 50_000_000 },
    { field: 'vol_4', label: '> 50 Mio. €', min: 50_000_000, max: null },
  ].filter((band) => checked(fields, band.field))

  if (!bands.length) return { labels: [] as string[], min: null as number | null, max: null as number | null }
  const finiteMaximums = bands.map((band) => band.max).filter((value): value is number => value !== null)
  return {
    labels: bands.map((band) => band.label),
    min: Math.min(...bands.map((band) => band.min)),
    max: bands.some((band) => band.max === null) ? null : Math.max(...finiteMaximums),
  }
}

function deriveFocus(profile: InvestorSearchProfile): InvestorFocus {
  const hasPv = profile.technologies.pv_ground || profile.technologies.pv_rooftop
  const hasBess = profile.technologies.bess
  const hasWind = profile.technologies.wind
  const selectedGroups = [hasPv, hasBess, hasWind].filter(Boolean).length
  if (selectedGroups > 1) return hasPv && hasBess && !hasWind ? 'PV_BESS' : 'MIXED'
  if (hasWind) return 'WIND'
  if (hasBess) return 'BESS'
  return 'PV'
}

export function buildInvestorProfile(fields: Record<string, string>) {
  const stages = selectedLabels(fields, {
    stage_fruehphase: 'Frühphase',
    stage_genehmigt: 'Genehmigt',
    stage_baureif: 'Baureif (RTB)',
    stage_bau: 'Im Bau',
    stage_betrieb: 'In Betrieb',
  })
  const investmentModels = selectedLabels(fields, {
    inv_asset: 'Asset-Kauf',
    inv_dev: 'Projektentwicklung',
    inv_jv: 'Joint Venture',
    inv_minority: 'Minderheitsbeteiligung',
    inv_debt: 'Fremdfinanzierung',
  })
  const volume = ticketRange(fields)

  const profile: InvestorSearchProfile = {
    version: 1,
    source_form: 'EMA Investoren-Suchprofil',
    position_title: fields.position_3 || '',
    headquarters: fields.sitz_6 || '',
    technologies: {
      pv_ground: checked(fields, 'tech_pv_freiflaeche'),
      pv_rooftop: checked(fields, 'tech_pv_dach'),
      bess: checked(fields, 'tech_bess'),
      wind: checked(fields, 'tech_wind'),
      other: fields.tech_sonstige_7 || '',
    },
    project_sizes: {
      pv_from_mwp: fields.pv_von_8 || '',
      pv_to_mwp: fields.pv_bis_9 || '',
      bess_from_mwh: fields.bess_von_10 || '',
      bess_to_mwh: fields.bess_bis_11 || '',
    },
    project_stages: stages,
    investment_models: investmentModels,
    regions: {
      germany: checked(fields, 'region_de'),
      dach: checked(fields, 'region_dach'),
      eu: checked(fields, 'region_eu'),
      international: checked(fields, 'region_intl'),
      details: fields.region_detail_12 || '',
    },
    investment_volume_bands: volume.labels,
    criteria: {
      esg_compliant: checked(fields, 'crit_esg'),
      grid_connection_secured: checked(fields, 'crit_grid'),
      long_term_ppa_required: checked(fields, 'crit_ppa'),
      exclusivity_required: checked(fields, 'crit_excl'),
      minimum_irr: fields.crit_irr_13 || '',
    },
    comments: fields.bemerkungen_14 || '',
    consents: {
      gdpr: checked(fields, 'consent_dsgvo'),
      confidentiality: checked(fields, 'consent_nda'),
      place_date: fields.ort_datum_15 || '',
      signature_present: !!fields.unterschrift_16?.trim(),
    },
    raw_fields: fields,
  }

  return {
    profile,
    focus: deriveFocus(profile),
    ticketMin: volume.min,
    ticketMax: volume.max,
  }
}

export function splitHeadquarters(value: string) {
  const parts = value.split(',').map((part) => part.trim()).filter(Boolean)
  if (parts.length < 2) return { city: '', country: value.trim() || 'Deutschland' }
  return { city: parts.slice(0, -1).join(', '), country: parts.at(-1) || 'Deutschland' }
}

export function profileNotes(profile: InvestorSearchProfile) {
  return [
    profile.technologies.other ? `Weitere Technologie: ${profile.technologies.other}` : '',
    profile.regions.details ? `Regionen: ${profile.regions.details}` : '',
    profile.criteria.minimum_irr ? `Mindest-IRR: ${profile.criteria.minimum_irr}` : '',
    profile.comments ? `Bemerkungen: ${profile.comments}` : '',
  ].filter(Boolean).join('\n\n') || null
}
