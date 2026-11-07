import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  TeamManagementSection,
  addTeamMember,
  toggleHideEarnings,
  validateAndAddTeamEmail,
} from '../TeamManagementSection';

describe('TeamManagementSection Component', () => {
  it('1. When maxTeamSeats is 0, shows "Solo Account (0 Seats)" and disables adding assistants', () => {
    const onUpdateTeamEmails = vi.fn();
    const html = renderToStaticMarkup(
      <TeamManagementSection
        maxSeats={0}
        teamEmails={[]}
        hideEarnings={true}
        onUpdateTeamEmails={onUpdateTeamEmails}
      />
    );

    // Shows Solo Account badge & description
    expect(html).toContain('Solo Account (0 Seats)');
    expect(html).toContain('disabled');

    // Attempting to add an assistant when quota is 0 fails
    const result = addTeamMember('assistant@gmail.com', [], 0, onUpdateTeamEmails);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Seat limit reached|Solo account/i);
    expect(onUpdateTeamEmails).not.toHaveBeenCalled();
  });

  it('2. When seats are available (e.g. maxSeats = 2, used = 1), user can enter an email and click "Add Member" which calls onUpdateTeamEmails with the lowercase email appended', () => {
    const onUpdateTeamEmails = vi.fn();
    const html = renderToStaticMarkup(
      <TeamManagementSection
        maxSeats={2}
        teamEmails={['assistant1@gmail.com']}
        hideEarnings={false}
        onUpdateTeamEmails={onUpdateTeamEmails}
      />
    );

    expect(html).toMatch(/1\s*\/\s*2 seats used/i);
    expect(html).toContain('assistant1@gmail.com');
    expect(html).toContain('Add Member');

    const result = addTeamMember(
      'Assistant2@GMAIL.com',
      ['assistant1@gmail.com'],
      2,
      onUpdateTeamEmails
    );

    expect(result.success).toBe(true);
    expect(result.updatedEmails).toEqual(['assistant1@gmail.com', 'assistant2@gmail.com']);
    expect(onUpdateTeamEmails).toHaveBeenCalledWith([
      'assistant1@gmail.com',
      'assistant2@gmail.com',
    ]);
  });

  it('3. Prevents adding when seat limit is reached (e.g. 2/2 used)', () => {
    const onUpdateTeamEmails = vi.fn();
    const html = renderToStaticMarkup(
      <TeamManagementSection
        maxSeats={2}
        teamEmails={['assistant1@gmail.com', 'assistant2@gmail.com']}
        hideEarnings={true}
        onUpdateTeamEmails={onUpdateTeamEmails}
      />
    );

    expect(html).toMatch(/Seat limit reached \(2\/2\)/i);
    expect(html).toContain('disabled');

    const result = addTeamMember(
      'extra@gmail.com',
      ['assistant1@gmail.com', 'assistant2@gmail.com'],
      2,
      onUpdateTeamEmails
    );

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Seat limit reached/i);
    expect(onUpdateTeamEmails).not.toHaveBeenCalled();
  });

  it('4. Prevents duplicate emails (case-insensitive) and owner email', () => {
    const onUpdateTeamEmails = vi.fn();

    // Duplicate check
    const dupResult = validateAndAddTeamEmail({
      email: 'ASSISTANT1@gmail.com',
      teamEmails: ['assistant1@gmail.com'],
      maxSeats: 3,
    });
    expect(dupResult.success).toBe(false);
    expect(dupResult.error).toMatch(/already in your team/i);

    // Owner email check
    const ownerResult = validateAndAddTeamEmail({
      email: 'lead@surveyor.com',
      teamEmails: [],
      maxSeats: 3,
      ownerEmail: 'lead@surveyor.com',
    });
    expect(ownerResult.success).toBe(false);
    expect(ownerResult.error).toMatch(/owner email/i);
  });

  it('5. Toggling "Hide Fee Bills & Professional Earnings" calls onToggleHideEarnings', () => {
    const onToggleHideEarnings = vi.fn();
    const html = renderToStaticMarkup(
      <TeamManagementSection
        maxSeats={2}
        teamEmails={[]}
        hideEarnings={true}
        onToggleHideEarnings={onToggleHideEarnings}
      />
    );

    expect(html).toContain('Hide Fee Bills &amp; Professional Earnings');

    // Toggle from true to false
    const nextVal1 = toggleHideEarnings(true, onToggleHideEarnings);
    expect(nextVal1).toBe(false);
    expect(onToggleHideEarnings).toHaveBeenCalledWith(false);

    // Toggle from false to true
    const nextVal2 = toggleHideEarnings(false, onToggleHideEarnings);
    expect(nextVal2).toBe(true);
    expect(onToggleHideEarnings).toHaveBeenCalledWith(true);
  });
});
