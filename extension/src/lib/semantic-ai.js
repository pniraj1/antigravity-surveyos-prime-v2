// @ts-check
/**
 * SurveyOS Portal Fill - Semantic AI Engine (Phase 3)
 * Provides coded dropdown normalization, surveyor loss observation drafting with
 * strict insurer-specific punctuation sanitization (UIIC/NIA/OIC), and zero-shot
 * DOM field prediction.
 *
 * Runs 100% locally in the browser runtime — zero PII exfiltration, zero network LLM dependency.
 */
(() => {
  const NS = 'SxSemanticAI';

  /**
   * Domain Synonym & Coding Taxonomy for Indian Motor Insurance Portals.
   * Maps canonical concepts to known portal codes, acronyms, and variations.
   */
  const SYNONYM_TAXONOMY = {
    // Fuel types
    fuel: {
      petrol: ['petrol', 'motor spirit', 'ms', 'gasoline', '01'],
      diesel: ['diesel', 'high speed diesel', 'hsd', '02'],
      cng: ['cng', 'compressed natural gas', '03'],
      electric: ['electric', 'ev', 'battery', 'battery operated', '04'],
      lpg: ['lpg', 'liquefied petroleum gas', '05'],
      hybrid: ['hybrid', 'petrol hybrid', 'diesel hybrid', '06']
    },
    // Policy types
    policyType: {
      comprehensive: ['comprehensive', 'package', 'package policy', 'standard package', 'pkg', 'comp', 'b policy'],
      thirdParty: ['third party', 'tp', 'liability', 'liability only', 'act only', 'act', 'a policy'],
      ownDamage: ['own damage', 'standalone od', 'sod', 'od only']
    },
    // Vehicle class / category
    vehicleClass: {
      privateCar: ['private car', 'pvt', 'private', 'motor car', '4 wheeler', 'four wheeler', 'lmv - private', 'lmv'],
      twoWheeler: ['two wheeler', '2w', 'motorcycle', 'scooter', 'moped', 'motor cycle'],
      goodsVehicle: ['goods carrying', 'goods vehicle', 'gcv', 'commercial goods', 'truck', 'lorry', 'trailer'],
      passengerVehicle: ['passenger carrying', 'passenger vehicle', 'pcv', 'bus', 'taxi', 'maxi cab', 'auto rickshaw']
    },
    // Cause of loss / accident
    lossCause: {
      collision: ['collision', 'impact', 'accidental external means', 'hit', 'dash', 'collision with object', 'col'],
      overturning: ['overturning', 'turn turtle', 'rollover', 'skidding', 'overturn', 'tov'],
      fire: ['fire', 'spontaneous combustion', 'lightning', 'self ignition', 'explosion', 'fir'],
      theft: ['theft', 'burglary', 'stolen', 'total loss by theft', 'housebreaking', 'the'],
      flood: ['flood', 'inundation', 'submersion', 'water logging', 'cyclone', 'storm', 'act of god', 'aog']
    },
    // Settlement type
    settlementType: {
      repair: ['repair', 'repair basis', 'reimbursement', 'cashless', 'standard repair', 'rep'],
      totalLoss: ['total loss', 'constructive total loss', 'ctl', 'tl', 'salvage loss', 'cash loss']
    },
    // Garage relationship
    garageType: {
      network: ['network', 'tie up', 'cashless', 'preferred garage', 'authorized dealer', 'net'],
      nonNetwork: ['non network', 'non tie up', 'reimbursement', 'general garage', 'local workshop', 'non']
    }
  };

  /**
   * Cleans text for comparison: lowercases, trims, collapses whitespace, strips non-alphanumeric.
   * @param {unknown} s
   * @returns {string}
   */
  function clean(s) {
    return String(s ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Tokenizes string into unique words.
   * @param {string} s
   * @returns {string[]}
   */
  function tokenize(s) {
    return clean(s).split(' ').filter(Boolean);
  }

  /**
   * Computes Jaccard token similarity between two strings (0.0 to 1.0).
   * @param {string} a
   * @param {string} b
   * @returns {number}
   */
  function tokenSimilarity(a, b) {
    const tokensA = new Set(tokenize(a));
    const tokensB = new Set(tokenize(b));
    if (!tokensA.size || !tokensB.size) return 0;
    let intersection = 0;
    for (const t of tokensA) {
      if (tokensB.has(t)) intersection++;
    }
    const union = new Set([...tokensA, ...tokensB]).size;
    return union === 0 ? 0 : intersection / union;
  }

  /**
   * Strips standard Indian portal dropdown code prefixes like "01 - ", "PKG - ", "COL : "
   * @param {string} text
   * @returns {string}
   */
  function stripOptionCode(text) {
    return text.replace(/^[A-Z0-9_]{1,6}\s*[-:]\s*/i, '').trim();
  }

  /**
   * Normalizes an options list into a uniform [{ text, value }] structure.
   * @param {any[]} optionsList
   * @returns {{ text: string, value: string }[]}
   */
  function parseOptionList(optionsList) {
    if (!Array.isArray(optionsList)) return [];
    return optionsList.map((opt) => {
      if (typeof opt === 'string') return { text: opt, value: opt };
      if (opt && typeof opt === 'object') {
        const text = String(opt.text ?? opt.label ?? opt.innerText ?? opt.value ?? '');
        const value = String(opt.value ?? opt.text ?? '');
        return { text, value };
      }
      return { text: String(opt ?? ''), value: String(opt ?? '') };
    });
  }

  /**
   * Matches a canonical SurveyOS value to the most appropriate portal dropdown option.
   * Uses multi-stage matching: exact value/text, code stripping, substring containment,
   * domain taxonomy synonyms, and token similarity.
   *
   * @param {string} canonicalValue
   * @param {any[]} optionsList
   * @returns {{ match: { text: string, value: string }, score: number, method: string } | null}
   */
  function normalizeDropdownOption(canonicalValue, optionsList) {
    const opts = parseOptionList(optionsList);
    if (!opts.length || !canonicalValue) return null;

    const target = String(canonicalValue).trim();
    const cleanTarget = clean(target);
    if (!cleanTarget) return null;

    // Stage 1: Exact value or text match (case-insensitive)
    for (const opt of opts) {
      if (clean(opt.value) === cleanTarget || clean(opt.text) === cleanTarget) {
        return { match: opt, score: 1.0, method: 'exact' };
      }
    }

    // Stage 2: Code prefix stripping match
    // E.g., "01 - MOTOR SPIRIT (PETROL)" -> "MOTOR SPIRIT (PETROL)"
    for (const opt of opts) {
      const strippedText = stripOptionCode(opt.text);
      if (clean(strippedText) === cleanTarget) {
        return { match: opt, score: 0.98, method: 'code-stripped' };
      }
    }

    // Stage 3: Substring containment
    // E.g. target "Petrol" in "01 - MOTOR SPIRIT (PETROL)" or vice versa
    for (const opt of opts) {
      const cleanOptText = clean(opt.text);
      const cleanOptVal = clean(opt.value);
      if (cleanOptText.includes(cleanTarget) || (cleanOptVal && cleanOptVal.includes(cleanTarget))) {
        return { match: opt, score: 0.92, method: 'substring' };
      }
      if (cleanTarget.includes(cleanOptText) && cleanOptText.length >= 3) {
        return { match: opt, score: 0.88, method: 'substring' };
      }
    }

    // Stage 4: Domain Taxonomy & Synonyms match
    // Check if canonical target matches any domain group
    for (const category of Object.values(SYNONYM_TAXONOMY)) {
      for (const [conceptKey, synonyms] of Object.entries(category)) {
        const matchesConcept = cleanTarget === conceptKey || synonyms.some((syn) => cleanTarget === clean(syn) || cleanTarget.includes(clean(syn)));
        if (matchesConcept) {
          // Check if any option matches this concept's synonyms
          for (const opt of opts) {
            const cleanOptText = clean(opt.text);
            const cleanOptVal = clean(opt.value);
            for (const syn of synonyms) {
              const cleanSyn = clean(syn);
              if (
                cleanOptText === cleanSyn ||
                cleanOptVal === cleanSyn ||
                cleanOptText.includes(` ${cleanSyn} `) ||
                cleanOptText.startsWith(`${cleanSyn} `) ||
                cleanOptText.endsWith(` ${cleanSyn}`) ||
                cleanOptText.includes(`(${cleanSyn})`)
              ) {
                return { match: opt, score: 0.85, method: 'synonym' };
              }
            }
          }
        }
      }
    }

    // Stage 5: Token similarity / Jaccard fallback
    let bestMatch = null;
    let highestScore = 0;
    for (const opt of opts) {
      const score = Math.max(
        tokenSimilarity(target, opt.text),
        tokenSimilarity(target, stripOptionCode(opt.text)),
        tokenSimilarity(target, opt.value)
      );
      if (score > highestScore && score >= 0.5) {
        highestScore = score;
        bestMatch = opt;
      }
    }

    if (bestMatch && highestScore >= 0.5) {
      return { match: bestMatch, score: Number(highestScore.toFixed(2)), method: 'token-jaccard' };
    }

    return null;
  }

  /**
   * Sanitizes free text specifically for United India Insurance Company (UIIC) portal.
   * UIIC ASP.NET throws hard unhandled exceptions (ERR_INVALID_CHARACTER / Request.Form validation)
   * on characters like quotes, commas, ampersands, semicolons, brackets, or angle brackets.
   *
   * Allowed characters: strictly `[a-zA-Z0-9. \n]`
   *
   * @param {string} text
   * @param {number} [maxLen=500]
   * @returns {string}
   */
  function sanitizeUiicRemarks(text, maxLen = 500) {
    if (!text) return '';
    const sanitized = String(text)
      // Remove commas between numbers so "15,000" becomes "15000" rather than "15 000"
      .replace(/(\d),(\d)/g, '$1$2')
      // Strip common slash-hyphen suffix from Indian currency like "/-"
      .replace(/\s*\/-/, '')
      // Replace punctuation like commas, semicolons, hyphens with spaces or dots
      .replace(/[,;:/\\|&+=~`!@#$%^*()\[\]{}'"><_?-]/g, ' ')
      // Keep only allowed characters
      .replace(/[^a-zA-Z0-9.\s]/g, '')
      // Collapse multiple whitespace
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s*\n/g, '\n')
      .trim();

    return truncateClean(sanitized, maxLen);
  }

  /**
   * Truncates text cleanly at a word boundary without breaking words in half.
   * @param {string} text
   * @param {number} maxLen
   * @returns {string}
   */
  function truncateClean(text, maxLen) {
    if (text.length <= maxLen) return text;
    const truncated = text.slice(0, maxLen);
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > maxLen * 0.75) {
      return truncated.slice(0, lastSpace).trim() + '.';
    }
    return truncated.trim();
  }

  /**
   * Drafts portal-safe, professional surveyor observations / remarks from a finished claim packet.
   * Adapts character limits and sanitization per insurer portal rules.
   *
   * @param {Record<string, any>} claim
   * @param {{ portal?: string, maxChars?: number, includeBreakdown?: boolean }} [options]
   * @returns {{ text: string, charCount: number, maxChars: number, sanitized: boolean, portal: string }}
   */
  function draftPortalObservations(claim, options = {}) {
    const portal = (options.portal || claim.portal || 'generic').toLowerCase();
    const isUiic = portal === 'uiic';
    const isNia = portal === 'nia';
    const isOic = portal === 'oic';

    const maxChars = options.maxChars || (isUiic ? 500 : isNia ? 1000 : isOic ? 2000 : 800);

    const fields = claim.fields || claim;
    const cause = String(fields.accidentCause || fields.causeOfAccident || fields.surveyRemarks || 'Vehicle met with accidental damage due to impact').trim();
    const partsTotal = Number(fields.totalPartsAssessed || fields.partsAssessed || 0);
    const labourTotal = Number(fields.totalLabourAssessed || fields.labourAssessed || 0);
    const netTotal = Number(fields.netAssessment || fields.netAssessed || partsTotal + labourTotal);
    const excess = Number(fields.compulsoryExcess || fields.deductible || 0);

    let narrative = '';

    if (isUiic) {
      // UIIC format: concise, zero special punctuation, clean uppercase
      narrative = [
        `ACCIDENT CAUSE. ${cause}.`,
        `INSPECTION. SURVEY CONDUCTED AT REPAIRER WORKSHOP. DAMAGES CORRELATE WITH ACCIDENT.`,
        partsTotal > 0 || labourTotal > 0
          ? `ASSESSMENT. PARTS RS ${partsTotal.toFixed(0)} LABOUR RS ${labourTotal.toFixed(0)} LESS EXCESS RS ${excess.toFixed(0)}.`
          : '',
        netTotal > 0 ? `NET RECOMMENDED SETTLEMENT RS ${netTotal.toFixed(0)}.` : '',
        `RECOMMENDATION. CLAIM FOUND ADMISSIBLE UNDER POLICY TERMS.`
      ].filter(Boolean).join(' ');

      const safeText = sanitizeUiicRemarks(narrative, maxChars);
      return {
        text: safeText,
        charCount: safeText.length,
        maxChars,
        sanitized: true,
        portal: 'uiic'
      };
    }

    // NIA / OIC / Standard format
    const lines = [
      `CAUSE OF ACCIDENT: ${cause}`,
      `INSPECTION FINDINGS: Vehicle inspected thoroughly at workshop. Damage sustained is consistent with the narrated mode of accident.`,
      (partsTotal > 0 || labourTotal > 0)
        ? `ASSESSMENT SUMMARY: Parts Assessed: Rs. ${partsTotal.toFixed(2)}, Labour Assessed: Rs. ${labourTotal.toFixed(2)}, Less Excess: Rs. ${excess.toFixed(2)}.`
        : '',
      netTotal > 0 ? `NET RECOMMENDED AMOUNT: Rs. ${netTotal.toFixed(2)}.` : '',
      `CONCLUSION: Loss is assessed in accordance with policy terms and conditions. Recommended for settlement.`
    ].filter(Boolean);

    let fullText = lines.join('\n');
    // Sanitize any dangerous HTML/script injection sequences
    fullText = fullText.replace(/[<>]/g, '').trim();

    if (fullText.length > maxChars) {
      fullText = truncateClean(fullText, maxChars);
    }

    return {
      text: fullText,
      charCount: fullText.length,
      maxChars,
      sanitized: true,
      portal: portal
    };
  }

  /**
   * Field semantic keywords mapping for Zero-Shot DOM matching.
   */
  const CANONICAL_FIELD_PATTERNS = {
    regNumber: [/reg(?:n|istration)?\s*(?:no|num|number)?/i, /veh(?:icle)?\s*no/i, /plate/i],
    chassisNumber: [/chassis\s*(?:no|num|number)?/i, /vin/i],
    engineNumber: [/engine\s*(?:no|num|number)?/i],
    policyNumber: [/pol(?:icy)?\s*(?:no|num|number)?/i, /covernote/i],
    driverLicenceNo: [/d\/?l\s*(?:no|num|number)?/i, /licen[sc]e\s*(?:no|num|number)?/i, /driver\s*lic/i],
    driverName: [/driver\s*(?:name)?/i, /name\s*of\s*driver/i],
    dateOfAccident: [/date\s*of\s*loss/i, /date\s*of\s*accident/i, /accident\s*date/i, /loss\s*date/i],
    timeOfAccident: [/time\s*of\s*loss/i, /time\s*of\s*accident/i, /accident\s*time/i, /loss\s*time/i],
    placeOfAccident: [/place\s*of\s*loss/i, /place\s*of\s*accident/i, /accident\s*place/i, /spot/i, /location/i],
    totalPartsAssessed: [/parts?\s*(?:total|assessed|cost|amount)/i, /cost\s*of\s*parts?/i, /spare\s*parts?/i],
    totalLabourAssessed: [/labour\s*(?:total|assessed|charges?|amount)/i, /labor/i, /workmanship/i],
    netAssessment: [/net\s*(?:assessed|assessment|amount|payable|claim)/i, /recommended\s*amount/i, /total\s*loss/i],
    surveyRemarks: [/remark/i, /observation/i, /surveyor\s*remark/i, /cause\s*of\s*loss/i, /description/i],
    insuredName: [/insured\s*(?:name)?/i, /name\s*of\s*insured/i, /policy\s*holder/i]
  };

  /**
   * Predicts the canonical SurveyOS claim field for an unmapped DOM element.
   *
   * @param {{ label?: string, placeholder?: string, name?: string, id?: string, nearbyText?: string }} domContext
   * @param {string[]} [candidateFields]
   * @returns {{ bestMatch: string, confidence: number, allScores: Record<string, number> } | null}
   */
  function predictFieldMapping(domContext, candidateFields) {
    if (!domContext) return null;

    const textToMatch = [
      domContext.label,
      domContext.placeholder,
      domContext.name,
      domContext.id,
      domContext.nearbyText
    ].filter(Boolean).join(' ');

    if (!textToMatch.trim()) return null;

    const fieldsToTest = Array.isArray(candidateFields) && candidateFields.length
      ? candidateFields
      : Object.keys(CANONICAL_FIELD_PATTERNS);

    /** @type {Record<string, number>} */
    const scores = {};
    let bestField = '';
    let highestScore = 0;

    for (const field of fieldsToTest) {
      let score = 0;
      const patterns = CANONICAL_FIELD_PATTERNS[field] || [];

      // Check regex patterns
      for (const regex of patterns) {
        if (regex.test(textToMatch)) {
          score = Math.max(score, 0.85);
          break;
        }
      }

      // Check field name token similarity
      const tokenScore = tokenSimilarity(textToMatch, field.replace(/([A-Z])/g, ' $1'));
      score = Math.max(score, tokenScore);

      scores[field] = Number(score.toFixed(2));
      if (score > highestScore) {
        highestScore = score;
        bestField = field;
      }
    }

    if (highestScore >= 0.6 && bestField) {
      return {
        bestMatch: bestField,
        confidence: Number(highestScore.toFixed(2)),
        allScores: scores
      };
    }

    return null;
  }

  const API = {
    SYNONYM_TAXONOMY,
    clean,
    tokenize,
    tokenSimilarity,
    stripOptionCode,
    parseOptionList,
    normalizeDropdownOption,
    sanitizeUiicRemarks,
    truncateClean,
    draftPortalObservations,
    predictFieldMapping
  };

  // UMD export: browser classic script vs Vitest / Node
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else globalThis[NS] = API;
})();
