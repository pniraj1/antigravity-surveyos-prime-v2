'use client';

// ═══════════════════════════════════════════════════════════
// CONNECT SYNC DIALOG
// Lets the surveyor enter the 8-char code from SurveyOS Sync
// to connect it as a document drive. Exchanges the code for a
// bridge token via the Sync Cloudflare Worker, then persists
// the token in the surveyor profile.
// ═══════════════════════════════════════════════════════════

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/stores/auth-store';
import { useProfileStore } from '@/stores/profile-store';
import { redeemLinkCode } from '@/lib/sync-bridge/client';
import { toast } from 'sonner';
import { Loader2, Plane } from 'lucide-react';

interface ConnectSyncDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConnectSyncDialog({ open, onOpenChange }: ConnectSyncDialogProps) {
  const user = useAuthStore((s) => s.user);
  const updateProfile = useProfileStore((s) => s.updateProfile);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const handleConnect = async () => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length !== 8) {
      toast.error('Enter the 8-character code from SurveyOS Sync.');
      return;
    }
    if (!user?.uid) {
      toast.error('Please sign in first.');
      return;
    }
    setBusy(true);
    try {
      const token = await redeemLinkCode(trimmed, user.uid);
      updateProfile({ syncBridgeToken: token, syncConnectedAt: new Date().toISOString() });
      toast.success('SurveyOS Sync connected.');
      setCode('');
      onOpenChange(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not connect SurveyOS Sync.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plane size={16} />
            Connect SurveyOS Sync
          </DialogTitle>
          <DialogDescription>
            In the SurveyOS Sync app, open Settings &rarr; &ldquo;Connect to motorsurveyos&rdquo; to get an
            8-character code, then enter it here. Valid for 10 minutes.
          </DialogDescription>
        </DialogHeader>
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="e.g. K7M4P2QX"
          maxLength={8}
          autoFocus
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={handleConnect} disabled={busy}>
            {busy ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
            Connect
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
