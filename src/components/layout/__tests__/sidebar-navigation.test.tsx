import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NAV_ITEMS, Sidebar } from '../sidebar';

describe('Sidebar Navigation Items', () => {
  it('defines tooltip and subtitle for cloud-vault and recovered-claims', () => {
    expect(NAV_ITEMS).toBeDefined();

    const cloudVault = NAV_ITEMS.find((item) => item.id === 'cloud-vault');
    const recovered = NAV_ITEMS.find((item) => item.id === 'recovered-claims');

    expect(cloudVault).toBeDefined();
    expect(cloudVault?.label).toBe('Cloud Vault');
    expect(cloudVault?.subtitle).toBe('Cloud Text Sync');
    expect(cloudVault?.tooltip).toBe(
      'View, download, or restore claim text synced to your SurveyOS cloud account'
    );
    expect(cloudVault?.tooltip).toContain('SurveyOS cloud account');

    expect(recovered).toBeDefined();
    expect(recovered?.label).toBe('Recovered');
    expect(recovered?.subtitle).toBe('Emergency Cache');
    expect(recovered?.tooltip).toBe(
      'Local emergency cache — find autosaved claims if browser closed unexpectedly'
    );
    expect(recovered?.tooltip?.toLowerCase()).toContain('emergency cache');
  });

  it('renders subtitles and tooltips in Sidebar navigation', () => {
    const html = renderToStaticMarkup(<Sidebar />);

    // Renders subtitle badges/text for both items
    expect(html).toContain('Cloud Text Sync');
    expect(html).toContain('Emergency Cache');

    // Renders helper tooltips in button title attributes for immediate hover help
    expect(html).toContain('title="View, download, or restore claim text synced to your SurveyOS cloud account"');
    expect(html).toContain('title="Local emergency cache — find autosaved claims if browser closed unexpectedly"');
  });
});
