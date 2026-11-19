'use client';

import React from 'react';

export function PaymentReconciliationTab() {
  return (
    <div data-testid="payment-reconciliation-tab" className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Payment Reconciliation
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Match bank statement credits and insurer payouts against survey fee bills
          </p>
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
        <p className="text-sm">Reconciliation cockpit interface</p>
      </div>
    </div>
  );
}

export default PaymentReconciliationTab;
