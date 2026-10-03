import { describe, it, expect } from 'vitest';
import { buildSiteNotesPrompt } from '../prompts';

describe('buildSiteNotesPrompt', () => {
  const fields = [
    { path: 'vehicle.odometer', label: 'Odometer' },
    { path: 'spotDetails.airbags', label: 'Airbags', enum: ['no', 'yes', 'na'] as const },
  ];

  it('lists allowed paths with their fixed values and embeds the notes', () => {
    const p = buildSiteNotesPrompt('odometer 45320 airbags nahi khule', fields, true);
    expect(p).toContain('- vehicle.odometer (Odometer)');
    expect(p).toContain('- spotDetails.airbags (Airbags) — one of: no, yes, na');
    expect(p).toContain('odometer 45320 airbags nahi khule');
    expect(p).toContain('damageRows');
  });

  it('prints a field hint when present', () => {
    const p = buildSiteNotesPrompt(
      'x',
      [{ path: 'accident.dateAndTime', label: 'Accident date and time', hint: 'format YYYY-MM-DDTHH:mm' }],
      true,
    );
    expect(p).toContain('- accident.dateAndTime (Accident date and time) — format YYYY-MM-DDTHH:mm');
  });

  it('asks for an empty damageRows array when rows are not allowed', () => {
    expect(buildSiteNotesPrompt('x', fields, false)).toContain('Return damageRows as an empty array.');
  });
});
