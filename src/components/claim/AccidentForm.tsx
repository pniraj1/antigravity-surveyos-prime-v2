'use client';

import { useClaimStore } from '@/stores/claim-store';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <div className="space-y-1">
            <Label htmlFor="a-date">Date & Time of Accident</Label>
            <Input
              id="a-date"
              type="datetime-local"
              value={a?.dateAndTime || ''}
              onChange={(e) => updateAccident({ dateAndTime: e.target.value })}
            />
          </div>

          <div className="space-y-1 lg:col-span-2 xl:col-span-3">
            <Label htmlFor="a-place">Place of Accident</Label>
            <Input
              id="a-place"
              value={a?.placeOfAccident || ''}
              onChange={(e) => updateAccident({ placeOfAccident: e.target.value })}
            />
          </div>

          <div className="space-y-1 lg:col-span-2 xl:col-span-4">
            <Label htmlFor="a-cause">Cause of Loss</Label>
            <Input
              id="a-cause"
              value={a?.causeOfAccident || ''}
              onChange={(e) => updateAccident({ causeOfAccident: e.target.value })}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="a-sdate">Date of Survey</Label>
            <Input
              id="a-sdate"
              type="date"
              value={a?.dateOfSurvey || ''}
              onChange={(e) => updateAccident({ dateOfSurvey: e.target.value })}
            />
          </div>

          <div className="space-y-1 lg:col-span-2 xl:col-span-3">
            <Label htmlFor="a-splace">Place of Survey (Workshop Name)</Label>
            <Input
              id="a-splace"
              value={a?.placeOfSurvey || ''}
              onChange={(e) => updateAccident({ placeOfSurvey: e.target.value })}
            />
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
            <Label htmlFor="a-fir-date">FIR Date</Label>
            <Input
              id="a-fir-date"
              type="date"
              value={a?.firDate || ''}
              onChange={(e) => updateAccident({ firDate: e.target.value })}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="a-pincode">Pincode</Label>
            <Input
              id="a-pincode"
              value={a?.pincode || ''}
              onChange={(e) => updateAccident({ pincode: e.target.value })}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="a-location-code">Location Code</Label>
            <Input
              id="a-location-code"
              value={a?.locationCode || ''}
              onChange={(e) => updateAccident({ locationCode: e.target.value })}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="a-app-date">Survey Appointment Date</Label>
            <Input
              id="a-app-date"
              type="date"
              value={a?.appointmentDate || ''}
              onChange={(e) => updateAccident({ appointmentDate: e.target.value })}
            />
          </div>
        </div>

        {currentClaim.surveyType !== 'spot' && (
          <div className="mt-8 pt-6 border-t">
            <Label className="text-md font-bold mb-4 block">Workshop Details</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1 lg:col-span-2">
                <Label htmlFor="w-name">Workshop Name</Label>
                <Input
                  id="w-name"
                  value={a?.workshopName || ''}
                  onChange={(e) => updateAccident({ workshopName: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="w-phone">Workshop Phone</Label>
                <Input
                  id="w-phone"
                  value={a?.workshopPhone || ''}
                  onChange={(e) => updateAccident({ workshopPhone: e.target.value })}
                />
              </div>
              <div className="space-y-1 lg:col-span-3">
                <Label htmlFor="w-addr">Workshop Address</Label>
                <Input
                  id="w-addr"
                  value={a?.workshopAddress || ''}
                  onChange={(e) => updateAccident({ workshopAddress: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="w-fax">Workshop Fax</Label>
                <Input
                  id="w-fax"
                  value={a?.workshopFax || ''}
                  onChange={(e) => updateAccident({ workshopFax: e.target.value })}
                />
              </div>
              <div className="space-y-1 lg:col-span-2">
                <Label htmlFor="w-email">Workshop Email</Label>
                <Input
                  id="w-email"
                  type="email"
                  value={a?.workshopEmail || ''}
                  onChange={(e) => updateAccident({ workshopEmail: e.target.value })}
                />
              </div>
            </div>
          </div>
        )}

        <div className="mt-6">
          <Label htmlFor="a-remarks">Surveyor Remarks (General Status)</Label>
          <Input
            id="a-remarks"
            value={a?.remarks || ''}
            onChange={(e) => updateAccident({ remarks: e.target.value })}
            placeholder="e.g. Repairs completed as per assessment..."
          />
        </div>

        <div className="mt-8 pt-6 border-t">
          <Label className="text-md font-bold mb-4 block">Document Verification Checklist (Photocopies Obtained?)</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
            {[
              { id: 'rc', label: 'RC' },
              { id: 'dl', label: 'DL' },
              { id: 'permit', label: 'Permit' },
              { id: 'fitness', label: 'Fitness' },
              { id: 'loadChallan', label: 'Load Challan' },
              { id: 'fireReport', label: 'Fire Report' },
              { id: 'fir', label: 'FIR' },
            ].map((flag) => {
              const flags = currentClaim.documentVerification || {};
              const doc = (flags as any)[flag.id] || { status: 'NO', detail: '' };

              return (
                <div key={flag.id} className="p-3 border rounded-lg bg-muted/30 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-xs font-bold uppercase">{flag.label}</Label>
                    <select
                      className="h-8 w-16 rounded-md border border-input bg-background px-1 text-[10px]"
                      value={doc.status}
                      onChange={(e) => {
                        const newFlags = { 
                          ...flags, 
                          [flag.id]: { ...doc, status: e.target.value } 
                        };
                        useClaimStore.getState().updateClaim({ 
                          documentVerification: newFlags 
                        });
                      }}
                    >
                      <option value="YES">YES</option>
                      <option value="NO">NO</option>
                      <option value="N.A.">N.A.</option>
                    </select>
                  </div>
                  <Input
                    placeholder="e.g. Original"
                    className="h-7 text-[10px] px-2"
                    value={doc.detail || ''}
                    onChange={(e) => {
                      const newFlags = { 
                        ...flags, 
                        [flag.id]: { ...doc, detail: e.target.value } 
                      };
                      useClaimStore.getState().updateClaim({ 
                        documentVerification: newFlags 
                      });
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
