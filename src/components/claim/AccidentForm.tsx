'use client';

import { useClaimStore } from '@/stores/claim-store';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const r = (v: any) => !v ? 'border-red-400' : '';

export function AccidentDetailsForm() {
  const { currentClaim, updateAccident } = useClaimStore();

  if (!currentClaim) return null;
  const a = currentClaim?.accident || {} as any;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg text-danger">Accident & Survey Details</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 @md:grid-cols-2 @2xl:grid-cols-3 @4xl:grid-cols-4 gap-4">
          <div className="space-y-1">
            <Label htmlFor="a-date">Date & Time of Accident</Label>
            <Input
              id="a-date"
              type="datetime-local"
              value={a?.dateAndTime || ''}
              onChange={(e) => updateAccident({ dateAndTime: e.target.value })}
              className={r(a?.dateAndTime)}
            />
          </div>

          <div className="space-y-1 lg:col-span-2 xl:col-span-3">
            <Label htmlFor="a-place">Place of Accident</Label>
            <Input
              id="a-place"
              value={a?.placeOfAccident || ''}
              onChange={(e) => updateAccident({ placeOfAccident: e.target.value })}
              className={r(a?.placeOfAccident)}
            />
          </div>

          <div className="space-y-1 lg:col-span-2 xl:col-span-4">
            <Label htmlFor="a-cause">Cause and Nature of Accident</Label>
            <Input
              id="a-cause"
              value={a?.causeOfAccident || ''}
              onChange={(e) => updateAccident({ causeOfAccident: e.target.value })}
              className={r(a?.causeOfAccident)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="a-sdate">Date of Survey</Label>
            <Input
              id="a-sdate"
              type="date"
              value={a?.dateOfSurvey || ''}
              onChange={(e) => updateAccident({ dateOfSurvey: e.target.value })}
              className={r(a?.dateOfSurvey)}
            />
          </div>

          <div className="space-y-1 lg:col-span-2 xl:col-span-3">
            <Label htmlFor="a-splace">Place of Survey (Workshop Name)</Label>
            <Input
              id="a-splace"
              value={a?.placeOfSurvey || ''}
              onChange={(e) => updateAccident({ placeOfSurvey: e.target.value })}
              className={r(a?.placeOfSurvey)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="a-police">Police Station</Label>
            <Input
              id="a-police"
              value={a?.policeStation || ''}
              onChange={(e) => updateAccident({ policeStation: e.target.value })}
              className={r(a?.policeStation)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="a-fir">FIR / Diary No.</Label>
            <Input
              id="a-fir"
              value={a?.firNumber || ''}
              onChange={(e) => updateAccident({ firNumber: e.target.value })}
              className={r(a?.firNumber)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="a-fir-date">FIR Date</Label>
            <Input
              id="a-fir-date"
              type="date"
              value={a?.firDate || ''}
              onChange={(e) => updateAccident({ firDate: e.target.value })}
              className={r(a?.firDate)}
            />
          </div>

          {currentClaim.surveyType !== 'spot' && (
            <div className="space-y-1">
              <Label htmlFor="a-app-date">Survey Appointment Date</Label>
              <Input
                id="a-app-date"
                type="date"
                value={a?.appointmentDate || ''}
                onChange={(e) => updateAccident({ appointmentDate: e.target.value })}
                className={r(a?.appointmentDate)}
              />
            </div>
          )}
        </div>

        {currentClaim.surveyType !== 'spot' && (
          <div className="mt-8 pt-6 border-t">
            <Label className="text-md font-bold mb-4 block">Workshop Details</Label>
            <div className="grid grid-cols-1 @md:grid-cols-2 @2xl:grid-cols-3 gap-4">
              <div className="space-y-1 @2xl:col-span-2">
                <Label htmlFor="w-name">Workshop Name</Label>
                <Input
                  id="w-name"
                  value={a?.workshopName || ''}
                  onChange={(e) => updateAccident({ workshopName: e.target.value })}
                  className={r(a?.workshopName)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="w-phone">Workshop Phone</Label>
                <Input
                  id="w-phone"
                  value={a?.workshopPhone || ''}
                  onChange={(e) => updateAccident({ workshopPhone: e.target.value })}
                  className={r(a?.workshopPhone)}
                />
              </div>
              <div className="space-y-1 lg:col-span-3">
                <Label htmlFor="w-addr">Workshop Address</Label>
                <Input
                  id="w-addr"
                  value={a?.workshopAddress || ''}
                  onChange={(e) => updateAccident({ workshopAddress: e.target.value })}
                  className={r(a?.workshopAddress)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="w-fax">Workshop Fax</Label>
                <Input
                  id="w-fax"
                  value={a?.workshopFax || ''}
                  onChange={(e) => updateAccident({ workshopFax: e.target.value })}
                  className={r(a?.workshopFax)}
                />
              </div>
              <div className="space-y-1 lg:col-span-2">
                <Label htmlFor="w-email">Workshop Email</Label>
                <Input
                  id="w-email"
                  type="email"
                  value={a?.workshopEmail || ''}
                  onChange={(e) => updateAccident({ workshopEmail: e.target.value })}
                  className={r(a?.workshopEmail)}
                />
              </div>
            </div>
          </div>
        )}

        {(() => {
          const dvFlags: any = currentClaim.documentVerification || {};
          const DV_DOCS = [
            { id: 'rc', label: 'RC' },
            { id: 'dl', label: 'DL' },
            { id: 'permit', label: 'Permit' },
            { id: 'fitness', label: 'Fitness' },
            { id: 'loadChallan', label: 'Load Challan' },
            { id: 'fireReport', label: 'Fire Report' },
            { id: 'fir', label: 'FIR' },
          ];
          const STATUSES = [
            { value: 'YES', color: 'var(--color-status-success)' },
            { value: 'NO', color: 'var(--color-status-danger)' },
            { value: 'N.A.', color: 'var(--color-neutral-500)' },
          ];
          const obtained = DV_DOCS.filter((d) => dvFlags[d.id]?.status === 'YES').length;
          const setDoc = (id: string, patch: Record<string, string>) => {
            const cur = dvFlags[id] || { status: 'NO', detail: '' };
            useClaimStore.getState().updateClaim({
              documentVerification: { ...dvFlags, [id]: { ...cur, ...patch } },
            });
          };

          return (
            <div className="mt-8 pt-6 border-t">
              <div className="flex items-center justify-between mb-1 gap-3">
                <Label className="text-md font-bold">Document Verification Checklist</Label>
                <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-muted text-muted-foreground shrink-0">
                  {obtained} / {DV_DOCS.length} obtained
                </span>
              </div>
              <p className="text-xs text-muted-foreground mb-4">Mark whether a photocopy of each document was obtained.</p>

              <div className="grid grid-cols-1 @md:grid-cols-2 @4xl:grid-cols-3 gap-3">
                {DV_DOCS.map((doc) => {
                  const status: string | undefined = dvFlags[doc.id]?.status;
                  return (
                    <div key={doc.id} className="flex items-center gap-3 p-2.5 rounded-lg border bg-muted/20">
                      <span className="text-xs font-bold uppercase w-20 shrink-0 truncate" title={doc.label}>{doc.label}</span>
                      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                        <div className="inline-flex rounded-md border border-input overflow-hidden self-start">
                          {STATUSES.map((s) => {
                            const active = status === s.value;
                            return (
                              <button
                                key={s.value}
                                type="button"
                                onClick={() => setDoc(doc.id, { status: s.value })}
                                className="px-2.5 py-1 text-[10px] font-semibold transition-colors border-r border-input last:border-r-0"
                                style={active
                                  ? { background: s.color, color: '#fff' }
                                  : { background: 'transparent', color: 'var(--color-neutral-500)' }}
                              >
                                {s.value}
                              </button>
                            );
                          })}
                        </div>
                        {status === 'YES' && (
                          <Input
                            placeholder="e.g. Original seen"
                            className="h-7 text-[11px] px-2"
                            value={dvFlags[doc.id]?.detail || ''}
                            onChange={(e) => setDoc(doc.id, { detail: e.target.value })}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </CardContent>
    </Card>
  );
}
