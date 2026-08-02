'use client';
import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image } from '@react-pdf/renderer';
import type { ClaimData } from '@/types';
import {
  partitionPhotos,
  buildDocLayout,
  buildStripContent,
  resolveAnnexureOptions,
  DOC_FOOTER_H,
  DOC_STRIP_H,
  type AnnexureProfile,
} from '@/lib/photos/document-annexure';

const ACCENT = '#2563EB';
const DARK = '#111827';
const GREY = '#6B7280';

const S = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    borderBottom: `2px solid ${ACCENT}`,
    paddingBottom: 6,
  },
  title: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: DARK, letterSpacing: 0.5 },
  subtitle: {
    fontSize: 7.5, color: GREY, marginTop: 2,
    textTransform: 'uppercase', letterSpacing: 0.4,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  // Documents are never stretched: a distorted document under a signed
  // VERIFIED stamp is altered evidence.
  image: { objectFit: 'contain', width: '100%', height: '100%' },
  strip: {
    position: 'absolute',
    height: DOC_STRIP_H,
    borderTop: `1px solid ${GREY}`,
    paddingTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  verified: {
    fontSize: 14, fontFamily: 'Helvetica-Bold', color: ACCENT, letterSpacing: 1.5,
  },
  surveyorName: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: DARK, marginTop: 4 },
  stripLine: { fontSize: 7, color: GREY, marginTop: 2 },
  marks: { flexDirection: 'row', alignItems: 'flex-end', gap: 14 },
  markImage: { objectFit: 'contain' },
  blankBox: {
    border: `1px dashed ${GREY}`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blankLabel: { fontSize: 5.5, color: GREY, textTransform: 'uppercase', letterSpacing: 0.3 },
  footer: {
    position: 'absolute', bottom: 12,
    flexDirection: 'row', justifyContent: 'space-between',
    fontSize: 7, color: '#9CA3AF', fontFamily: 'Helvetica-Oblique',
  },
});

/** Signature and stamp render at these sizes, or as a labelled blank box. */
const SIGNATURE_W = 110;
const SIGNATURE_H = 46;
const STAMP_W = 76;
const STAMP_H = 62;

interface Props {
  claim: ClaimData;
  profile: AnnexureProfile;
}

interface MarkProps {
  src: string | null;
  label: string;
  w: number;
  h: number;
}

/**
 * A missing signature or stamp prints a labelled blank box rather than nothing.
 * A signed page silently missing its signature, with no explanation, is the
 * worst outcome — the surveyor can at least sign a visible box by hand.
 */
function Mark({ src, label, w, h }: MarkProps) {
  if (src) {
    return <Image src={src} style={[S.markImage, { width: w, height: h }]} />;
  }
  return (
    <View style={[S.blankBox, { width: w, height: h }]}>
      <Text style={S.blankLabel}>{label}</Text>
    </View>
  );
}

export function DocumentAnnexureDocument({ claim, profile }: Props) {
  const opts = resolveAnnexureOptions(claim.documentAnnexure);
  const documents = partitionPhotos(Array.isArray(claim?.photos) ? claim.photos : [])
    .documents.map(d => d.item);

  const pagePortrait = opts.pageOrientation !== 'landscape';
  const config = buildDocLayout(opts.layout, opts, pagePortrait);
  const pad = opts.pagePadding;
  const strip = buildStripContent(profile, opts);

  const pages: (typeof documents)[] = [];
  for (let i = 0; i < documents.length; i += config.perPage) {
    pages.push(documents.slice(i, i + config.perPage));
  }

  const regNum = claim?.vehicle?.registrationNumber || 'DRAFT';
  const insurer = claim?.policy?.insurerName || '';
  const reportNo = claim?.reportNo || '';
  const pageSize = pagePortrait ? 'A4' : ([842, 595] as [number, number]);
  const cellBorder = opts.showBorder ? `1px solid ${opts.borderColor}` : undefined;

  if (pages.length === 0) {
    return (
      <Document title={`Document Annexure – ${regNum}`}>
        <Page size="A4" style={{ padding: pad, fontFamily: 'Helvetica', fontSize: 10, color: DARK }}>
          <Text style={{ color: GREY, marginTop: 20 }}>
            No documents have been added to this claim.
          </Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document title={`Document Annexure – ${regNum}`}>
      {pages.map((pageDocs, pageIdx) => (
        <Page
          key={pageIdx}
          size={pageSize}
          style={{ padding: pad, fontFamily: 'Helvetica', fontSize: 9, color: DARK, backgroundColor: '#FFFFFF' }}
        >
          <View style={S.header}>
            <View>
              <Text style={S.title}>{profile.name || 'Surveyor'}{'  ·  '}{regNum}</Text>
              <Text style={S.subtitle}>
                {insurer ? `${insurer}  ·  ` : ''}
                {reportNo ? `Report No: ${reportNo}  ·  ` : ''}
                Document Annexure
              </Text>
            </View>
          </View>

          <View style={S.grid}>
            {pageDocs.map((doc, idx) => {
              const isLastInRow = idx % config.cols === config.cols - 1;
              return (
                <View
                  key={idx}
                  style={{
                    width: config.cellW,
                    height: config.cellH,
                    marginRight: isLastInRow ? 0 : config.gap,
                    marginBottom: config.gap,
                    border: cellBorder,
                    borderRadius: 2,
                    overflow: 'hidden',
                  }}
                >
                  <View style={[S.cell, { width: config.cellW, height: config.cellH }]}>
                    {doc?.dataUrl
                      ? <Image src={doc.dataUrl} style={S.image} />
                      : <Text style={{ color: GREY, fontSize: 7 }}>No image</Text>}
                  </View>
                </View>
              );
            })}
          </View>

          {opts.verified && (
            <View style={[S.strip, { left: pad, right: pad, bottom: pad + DOC_FOOTER_H }]} fixed>
              <View>
                <Text style={S.verified}>Verified with Original</Text>
                <Text style={S.surveyorName}>{strip.name}</Text>
                {strip.licence && <Text style={S.stripLine}>{strip.licence}</Text>}
                {strip.placeDate && <Text style={S.stripLine}>{strip.placeDate}</Text>}
              </View>
              <View style={S.marks}>
                <Mark src={profile.signatureDataUrl} label="Signature" w={SIGNATURE_W} h={SIGNATURE_H} />
                <Mark src={profile.stampDataUrl} label="Stamp" w={STAMP_W} h={STAMP_H} />
              </View>
            </View>
          )}

          <View style={[S.footer, { left: pad, right: pad }]} fixed>
            <Text>Motor SurveyOS</Text>
            <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
          </View>
        </Page>
      ))}
    </Document>
  );
}
