/**
 * Normalizes notes from either:
 * 1. A manifest `notes` object (from `_surveyos-scan.json` / export zip), OR
 * 2. A backup JSON object (from `_surveyos-backup.json` / Scan's Drive "Text only" sync).
 *
 * Produces the standardized shape consumed by `planNotes()`.
 */

export interface NormalizedNotesPayload {
  spot: Record<string, unknown>;
  spotDamageRows: Array<{ component: string; damage: string }>;
  valuation: Record<string, unknown>;
  valuationPartRows: Array<{ component: string; condition: string }>;
  feeBill: Record<string, unknown>;
  updatedAt: string;
  vehicle?: string;
  claimId?: string;
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Packs flattened documentVerification.<id>.status and .detail into { status, detail } objects. */
function packDocs(spot: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(spot)) {
    const m = k.match(/^documentVerification\.([^.]+)\.(status|detail)$/);
    if (m) {
      const [, docId, prop] = m;
      const baseKey = `documentVerification.${docId}`;
      const cur = isObj(out[baseKey]) ? (out[baseKey] as Record<string, unknown>) : {};
      cur[prop] = v;
      out[baseKey] = cur;
    } else {
      out[k] = v;
    }
  }
  return out;
}

/** Parses and normalizes raw text or object from Scan backup or manifest. */
export function normalizeScanNotes(raw: unknown): NormalizedNotesPayload | null {
  if (!raw) return null;
  let data: Record<string, unknown>;
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw);
    } catch {
      return null;
    }
  } else if (isObj(raw)) {
    data = raw;
  } else {
    return null;
  }

  // Case A: A full Scan backup JSON (_surveyos-backup.json)
  if (data.app === 'surveyos-scan-backup' || (data.notes && data.vehicleNo !== undefined)) {
    const notesObj = isObj(data.notes) ? data.notes : {};
    const rawSpot = isObj(notesObj.spot) ? (notesObj.spot as Record<string, unknown>) : {};
    const rawVal = isObj(notesObj.valuation) ? (notesObj.valuation as Record<string, unknown>) : {};
    const rawFee = isObj(notesObj.feeBill) ? (notesObj.feeBill as Record<string, unknown>) : {};
    const rows = Array.isArray(data.rows) ? (data.rows as Array<Record<string, unknown>>) : [];

    const spotDamageRows = rows
      .filter((r) => r.section === 'spotDamageRows')
      .map((r) => ({
        component: String(r.component ?? '').trim(),
        damage: String(r.damage ?? '').trim(),
      }))
      .filter((r) => r.component || r.damage);

    const valuationPartRows = rows
      .filter((r) => r.section === 'valuationPartRows')
      .map((r) => ({
        component: String(r.component ?? '').trim(),
        condition: String(r.condition ?? r.damage ?? '').trim(),
      }))
      .filter((r) => r.component || r.condition);

    let updatedAt = '';
    if (typeof data.updatedAt === 'number') {
      try {
        updatedAt = new Date(data.updatedAt).toISOString();
      } catch { /* fallback */ }
    } else if (typeof data.updatedAt === 'string') {
      updatedAt = data.updatedAt;
    }

    return {
      spot: packDocs(rawSpot),
      spotDamageRows,
      valuation: rawVal,
      valuationPartRows,
      feeBill: rawFee,
      updatedAt,
      vehicle: typeof data.vehicleNo === 'string' ? data.vehicleNo : undefined,
      claimId: typeof data.claimId === 'string' ? data.claimId : undefined,
    };
  }

  // Case B: A manifest `notes` object (_surveyos-scan.json)
  const spot = isObj(data.spot) ? packDocs(data.spot as Record<string, unknown>) : {};
  const valuation = isObj(data.valuation) ? (data.valuation as Record<string, unknown>) : {};
  const feeBill = isObj(data.feeBill) ? (data.feeBill as Record<string, unknown>) : {};

  const spotDamageRows = Array.isArray(data.spotDamageRows)
    ? (data.spotDamageRows as Array<Record<string, unknown>>)
        .map((r) => ({
          component: String(r.component ?? '').trim(),
          damage: String(r.damage ?? '').trim(),
        }))
        .filter((r) => r.component || r.damage)
    : [];

  const valuationPartRows = Array.isArray(data.valuationPartRows)
    ? (data.valuationPartRows as Array<Record<string, unknown>>)
        .map((r) => ({
          component: String(r.component ?? '').trim(),
          condition: String(r.condition ?? r.damage ?? '').trim(),
        }))
        .filter((r) => r.component || r.condition)
    : [];

  const updatedAt = typeof data.updatedAt === 'string' ? data.updatedAt : '';

  return {
    spot,
    spotDamageRows,
    valuation,
    valuationPartRows,
    feeBill,
    updatedAt,
    vehicle: typeof data.vehicle === 'string' ? data.vehicle : undefined,
    claimId: typeof data.claimId === 'string' ? data.claimId : undefined,
  };
}
