import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  NewDrivePhotosBanner,
  NewDrivePhotosBannerView,
} from '../NewDrivePhotosBanner';

describe('NewDrivePhotosBannerView', () => {
  it('renders null when pendingCount is 0', () => {
    const html = renderToStaticMarkup(
      <NewDrivePhotosBannerView
        pendingCount={0}
        busy={false}
        progress={null}
        onDownload={vi.fn()}
        onDismiss={vi.fn()}
      />
    );
    expect(html).toBe('');
  });

  it('renders notification banner with photo count and "Download to this Laptop" button', () => {
    const html = renderToStaticMarkup(
      <NewDrivePhotosBannerView
        pendingCount={5}
        busy={false}
        progress={null}
        onDownload={vi.fn()}
        onDismiss={vi.fn()}
      />
    );

    expect(html).toContain('☁️ 5 photo(s) found in Google Drive for this claim.');
    expect(html).toContain('Download to this Laptop');
    expect(html).toContain('Not now');
  });

  it('renders downloading state and progress count when busy', () => {
    const html = renderToStaticMarkup(
      <NewDrivePhotosBannerView
        pendingCount={5}
        busy={true}
        progress={{ completed: 2, total: 5 }}
        onDownload={vi.fn()}
        onDismiss={vi.fn()}
      />
    );

    expect(html).toContain('Downloading (2/5)...');
    expect(html).toContain('disabled=""');
  });

  it('renders general downloading text if progress object is not yet populated', () => {
    const html = renderToStaticMarkup(
      <NewDrivePhotosBannerView
        pendingCount={3}
        busy={true}
        progress={null}
        onDownload={vi.fn()}
        onDismiss={vi.fn()}
      />
    );

    expect(html).toContain('Downloading...');
  });
});
