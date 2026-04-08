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
        </div>

        <div className="mt-8 pt-6 border-t">
          <Label className="text-md font-bold mb-4 block">Document Verification Checklist (Photocopies Obtained?)</Label>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            {[
              { id: 'rc', label: 'RC' },
              { id: 'dl', label: 'DL' },
              { id: 'permit', label: 'Permit' },
              { id: 'fitness', label: 'Fitness' },
              { id: 'loadChallan', label: 'Load Challan' },
              { id: 'fireReport', label: 'Fire Report' },
              { id: 'fir', label: 'FIR' },
            ].map((flag) => {
              const flags = currentClaim.spotDetails?.verificationFlags || {};
              const value = (flags as any)[flag.id] || 'NO';

              return (
                <div key={flag.id} className="flex items-center space-x-2">
                  <select
                    className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                    value={value}
                    onChange={(e) => {
                      const currentFlags = currentClaim.spotDetails?.verificationFlags || {};
                      const newFlags = { ...currentFlags, [flag.id]: e.target.value };
                      
                      useClaimStore.getState().updateClaim({ 
                        spotDetails: { 
                          ...(currentClaim.spotDetails || {}), 
                          verificationFlags: newFlags 
                        } 
                      });
                    }}
                  >
                    <option value="YES">YES</option>
                    <option value="NO">NO</option>
                    <option value="N.A.">N.A.</option>
                  </select>
                  <Label className="text-xs">{flag.label}</Label>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
