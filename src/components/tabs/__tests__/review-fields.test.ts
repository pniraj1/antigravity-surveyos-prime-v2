import { describe, it, expect } from 'vitest';
import { isReviewField } from '../ReviewTab';

describe('isReviewField', () => {
  it('hides the internal model record', () => expect(isReviewField('_models')).toBe(false));
  it('hides context/page/file helpers', () => {
    expect(isReviewField('owner_name_context')).toBe(false);
    expect(isReviewField('owner_name_page')).toBe(false);
  });
  it('shows a real field', () => expect(isReviewField('owner_name')).toBe(true));
});
