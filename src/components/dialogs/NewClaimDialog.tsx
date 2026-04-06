'use client';

import { useUIStore } from '@/stores/ui-store';
import { useClaimStore } from '@/stores/claim-store';
import { getOrCreateClaimFolder } from '@/lib/drive';
import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function NewClaimDialog() {
  const { isNewClaimDialogOpen, setNewClaimDialogOpen, setActiveTab } = useUIStore();
  const { newClaim, loadClaim } = useClaimStore();
  const [vehicleNo, setVehicleNo] = useState('');
  const [surveyType, setSurveyType] = useState<'spot' | 'final' | 'reinspection'>('final');

  if (!isNewClaimDialogOpen) return null;

  const handleCreate = () => {
    if (!vehicleNo.trim()) return;

    newClaim(surveyType, 'private');
    useClaimStore.getState().updateVehicle({ registrationNumber: vehicleNo.toUpperCase() });

    // Non-blocking Drive folder creation
    const { currentClaimId } = useClaimStore.getState();
    if (currentClaimId) {
      const label = vehicleNo.toUpperCase();
      getOrCreateClaimFolder(currentClaimId, label).catch(e =>
        console.warn('[Drive] Folder creation skipped (Drive not linked):', e.message)
      );
    }

    setVehicleNo('');
    setNewClaimDialogOpen(false);
    setActiveTab('details');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <Card className="w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
        <CardHeader>
          <CardTitle>Create New Claim</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Vehicle Registration No.</Label>
            <Input
              autoFocus
              className="uppercase text-lg font-bold"
              placeholder="e.g. MH01AB1234"
              value={vehicleNo}
              onChange={(e) => setVehicleNo(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
          </div>
          
          <div className="space-y-2">
            <Label>Survey Type</Label>
            <div className="flex gap-2">
              <button
                onClick={() => setSurveyType('spot')}
                className={`flex-1 py-2 text-sm font-semibold rounded-md border ${surveyType === 'spot' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}
              >
                Spot
              </button>
              <button
                onClick={() => setSurveyType('final')}
                className={`flex-1 py-2 text-sm font-semibold rounded-md border ${surveyType === 'final' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}
              >
                Final
              </button>
              <button
                onClick={() => setSurveyType('reinspection')}
                className={`flex-1 py-2 text-sm font-semibold rounded-md border ${surveyType === 'reinspection' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}
              >
                Re-inspection
              </button>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end gap-2">
          <button
            onClick={() => setNewClaimDialogOpen(false)}
            className="px-4 py-2 rounded-md text-sm font-semibold text-muted-foreground hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!vehicleNo.trim()}
            className="px-4 py-2 rounded-md text-sm font-semibold bg-primary text-primary-foreground disabled:opacity-50"
          >
            Create Claim
          </button>
        </CardFooter>
      </Card>
    </div>
  );
}
