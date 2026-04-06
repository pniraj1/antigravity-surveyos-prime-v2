'use client';

import { useClaimStore } from '@/stores/claim-store';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function AccidentDetailsForm() {
  const { currentClaim, updateAccident } = useClaimStore();

  if (!currentClaim) return null;
  const a = currentClaim.accident;

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
              value={a.dateAndTime}
              onChange={(e) => updateAccident({ dateAndTime: e.target.value })}
            />
          </div>

          <div className="space-y-1 lg:col-span-2 xl:col-span-3">
            <Label htmlFor="a-place">Place of Accident</Label>
            <Input
              id="a-place"
              value={a.placeOfAccident}
              onChange={(e) => updateAccident({ placeOfAccident: e.target.value })}
            />
          </div>

          <div className="space-y-1 lg:col-span-2 xl:col-span-4">
            <Label htmlFor="a-cause">Cause of Loss</Label>
            <Input
              id="a-cause"
              value={a.causeOfAccident}
              onChange={(e) => updateAccident({ causeOfAccident: e.target.value })}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="a-sdate">Date of Survey</Label>
            <Input
              id="a-sdate"
              type="date"
              value={a.dateOfSurvey}
              onChange={(e) => updateAccident({ dateOfSurvey: e.target.value })}
            />
          </div>

          <div className="space-y-1 lg:col-span-2 xl:col-span-3">
            <Label htmlFor="a-splace">Place of Survey (Workshop Name)</Label>
            <Input
              id="a-splace"
              value={a.placeOfSurvey}
              onChange={(e) => updateAccident({ placeOfSurvey: e.target.value })}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="a-police">Police Station</Label>
            <Input
              id="a-police"
              value={a.policeStation}
              onChange={(e) => updateAccident({ policeStation: e.target.value })}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="a-fir">FIR / Diary No.</Label>
            <Input
              id="a-fir"
              value={a.firNumber}
              onChange={(e) => updateAccident({ firNumber: e.target.value })}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
