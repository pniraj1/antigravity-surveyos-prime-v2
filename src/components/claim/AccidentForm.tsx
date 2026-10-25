'use client';

import { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useClaimStore } from '@/stores/claim-store';
import { rephraseCause } from '@/lib/ai/rephrase-cause';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DocSection, req, selectCls } from '@/components/claim/form-bits';

/** The accident itself and its police/fire paperwork. Survey and workshop live in SurveyForm. */
export function AccidentDetailsForm() {
  const { currentClaim, updateAccident, updateSpotDetails } = useClaimStore();
  // Text before the last AI rephrase; any manual edit drops the Undo.
  const [beforeRephrase, setBeforeRephrase] = useState<string | null>(null);
  const [rephrasing, setRephrasing] = useState(false);

  if (!currentClaim) return null;
  const a = currentClaim?.accident || {} as any;

  const handleRephrase = async () => {
    const original = a?.causeOfAccident || '';
    setRephrasing(true);
    try {
      const out = await rephraseCause(original);
      updateAccident({ causeOfAccident: out });
      setBeforeRephrase(original);
    } catch (err: unknown) {
      toast.error(`Rephrase failed: ${err instanceof Error ? err.message : 'unknown error'}`);
    } finally {
      setRephrasing(false);
    }
  };
  const sd = currentClaim?.spotDetails || {} as any;

  const dates = (
    <>
      <div className="space-y-1">
        <Label htmlFor="a-date">Date & Time of Accident</Label>
        <Input
          id="a-date"
          type="datetime-local"
          value={a?.dateAndTime || ''}
          onChange={(e) => updateAccident({ dateAndTime: e.target.value })}
          className={req(a?.dateAndTime)}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="a-fir-date">FIR Date</Label>
        <Input
          id="a-fir-date"
          type="date"
          value={a?.firDate || ''}
          onChange={(e) => updateAccident({ firDate: e.target.value })}
        />
      </div>
    </>
  );

  return (
    <DocSection title="Accident" dates={dates}>
      <div className="space-y-1 @md:col-span-2">
        <Label htmlFor="a-place">Place of Accident</Label>
        <Input
          id="a-place"
          value={a?.placeOfAccident || ''}
          onChange={(e) => updateAccident({ placeOfAccident: e.target.value })}
          className={req(a?.placeOfAccident)}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="a-pincode">Accident Pincode</Label>
        <Input
          id="a-pincode"
          inputMode="numeric"
          maxLength={6}
          value={a?.pincode || ''}
          onChange={(e) => updateAccident({ pincode: e.target.value.replace(/\D/g, '') })}
        />
      </div>

      <div className="space-y-1 col-span-full">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="a-cause">Cause and Nature of Accident</Label>
          <div className="flex items-center gap-3 text-xs">
            {beforeRephrase !== null && (
              <button
                type="button"
                className="text-muted-foreground hover:underline"
                onClick={() => { updateAccident({ causeOfAccident: beforeRephrase }); setBeforeRephrase(null); }}
              >
                Undo
              </button>
            )}
            <button
              type="button"
              disabled={rephrasing || !a?.causeOfAccident?.trim()}
              onClick={handleRephrase}
              className="flex items-center gap-1 text-primary hover:underline disabled:opacity-40 disabled:no-underline"
            >
              {rephrasing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              Rephrase with AI
            </button>
          </div>
        </div>
        <Textarea
          id="a-cause"
          rows={3}
          value={a?.causeOfAccident || ''}
          onChange={(e) => { updateAccident({ causeOfAccident: e.target.value }); setBeforeRephrase(null); }}
          className={req(a?.causeOfAccident)}
        />
      </div>

      {/* Stored on spotDetails but asked here, because AccidentForm renders
          for every survey type and SpotTab renders only for spot claims. */}
      <div className="space-y-1">
        <Label htmlFor="a-police-reported">Police Reported?</Label>
        <select
          id="a-police-reported"
          className={selectCls}
          value={sd?.policeReported || ''}
          onChange={(e) => updateSpotDetails({ policeReported: e.target.value })}
        >
          <option value="">—</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="a-police">Police Station</Label>
        <Input
          id="a-police"
          value={a?.policeStation || ''}
          onChange={(e) => updateAccident({ policeStation: e.target.value })}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="a-fir">FIR / Diary No.</Label>
        <Input
          id="a-fir"
          value={a?.firNumber || ''}
          onChange={(e) => updateAccident({ firNumber: e.target.value })}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="a-panchanama">Panchanama?</Label>
        <select
          id="a-panchanama"
          className={selectCls}
          value={sd?.panchanama || ''}
          onChange={(e) => updateSpotDetails({ panchanama: e.target.value })}
        >
          <option value="">—</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      </div>

      {/* Fire losses only carry this, but the field is always offered — the
          surveyor fills it when a brigade report exists and leaves it blank
          otherwise. The UIIC final report has always printed it. */}
      <div className="space-y-1">
        <Label htmlFor="a-fire-report">Fire Brigade Report No.</Label>
        <Input
          id="a-fire-report"
          value={a?.fireBrigadeReportNo || ''}
          onChange={(e) => updateAccident({ fireBrigadeReportNo: e.target.value })}
        />
      </div>

      {/* Third party is free text, not a classification. The information is
          extensive — property damage, injuries, deaths, TP vehicle, hospital
          — and the surveyor writes as much as the claim needs. */}
      <div className="space-y-1 col-span-full">
        <Label htmlFor="a-tp">Third Party Details (TPPI / TPPD)</Label>
        <Textarea
          id="a-tp"
          rows={3}
          value={a?.thirdPartyDetails || ''}
          onChange={(e) => updateAccident({ thirdPartyDetails: e.target.value })}
          placeholder="Property damage, injuries, deaths, TP vehicle, hospital — as much detail as available"
        />
      </div>
    </DocSection>
  );
}
