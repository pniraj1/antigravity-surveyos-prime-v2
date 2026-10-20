import type { DocType } from '@/types/documents';

export interface RecipeBox {
  id: string;
  label: string;
  mandatory: boolean;
  accepts: DocType[];
  combine: 'single' | 'merge';
  /** Merge boxes: types that must be present for the box to count as filled. */
  mergeMandatory?: DocType[];
  formats: string[];
}

export interface Recipe {
  portal: 'nia' | 'uiic';
  flow: string;
  title: string;
  /** Box list not yet confirmed against the live portal. */
  provisional?: boolean;
  boxes: RecipeBox[];
}

export const DEFAULT_FORMATS = ['.pdf', '.jpg', '.jpeg', '.png'];

/** A one-file box whose label is the document type's own name unless given. */
export function single(id: string, label: string, mandatory: boolean, accepts: DocType = id as DocType, formats = DEFAULT_FORMATS): RecipeBox {
  return { id, label, mandatory, accepts: [accepts], combine: 'single', formats };
}

export function merge(id: string, label: string, mandatory: boolean, accepts: DocType[], mergeMandatory?: DocType[]): RecipeBox {
  return { id, label, mandatory, accepts, combine: 'merge', ...(mergeMandatory ? { mergeMandatory } : {}), formats: DEFAULT_FORMATS };
}
