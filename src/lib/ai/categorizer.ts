import type { EstimateLineItem } from './parsers/types';
import { callAIGateway } from './service';

export interface CategorizationResult {
  categorized: EstimateLineItem[];
  uncategorizedCount: number;
}

/**
 * Classifies spare_parts items by material using a single Groq text call.
 * Items that cannot be classified are left with category = ''.
 * Never throws — returns items unchanged on any error.
 */
export async function categorizeItems(
  items: EstimateLineItem[],
): Promise<CategorizationResult> {
  // Early return for empty input
  if (items.length === 0) {
    return { categorized: [], uncategorizedCount: 0 };
  }

  try {
    // Extract unique descriptions (deduplicate)
    const uniqueDescriptions = Array.from(new Set(items.map(item => item.description)));

    // Build the prompt
    const prompt = `You are a motor vehicle parts expert. Classify each spare part by its primary material.

Parts to classify:
${uniqueDescriptions.map((d, i) => `${i + 1}. ${d}`).join('\n')}

Respond ONLY with a JSON object mapping each part description (exact text) to one of:
- "metal" (steel, aluminum, iron parts: engine components, frame parts, metal brackets)
- "plastic" (bumpers, grilles, covers, trims, plastic assemblies)
- "glass" (windshields, windows, mirrors with glass)
- "" (unknown or does not fit above categories)

Example response:
{
  "FRONT BUMPER ASSY": "plastic",
  "ENGINE OIL FILTER": "metal",
  "WINDSHIELD GLASS": "glass"
}`;

    // Call AI gateway (text-only, cheap)
    const responseText = await callAIGateway(prompt, [], 'json');

    // Parse the JSON response
    const categoriesMap = JSON.parse(responseText) as Record<string, string>;

    // Map categories back to items, handling case-insensitive lookup
    const categorized = items.map(item => {
      // Find matching category by looking up normalized description
      let category: 'metal' | 'plastic' | 'glass' | '' = '';

      // Try exact match first
      if (categoriesMap[item.description]) {
        const mapped = categoriesMap[item.description];
        if (['metal', 'plastic', 'glass', ''].includes(mapped)) {
          category = mapped as 'metal' | 'plastic' | 'glass' | '';
        }
      } else {
        // Try case-insensitive match
        const normalized = item.description.toUpperCase().trim();
        for (const [key, value] of Object.entries(categoriesMap)) {
          if (key.toUpperCase().trim() === normalized) {
            if (['metal', 'plastic', 'glass', ''].includes(value)) {
              category = value as 'metal' | 'plastic' | 'glass' | '';
            }
            break;
          }
        }
      }

      // Return new object (never mutate)
      return {
        ...item,
        category,
      };
    });

    // Count uncategorized items
    const uncategorizedCount = categorized.filter(i => !i.category).length;

    return { categorized, uncategorizedCount };
  } catch {
    // On any error, return items unchanged
    const uncategorizedCount = items.filter(i => !i.category).length;
    return { categorized: items, uncategorizedCount };
  }
}
