'use client';

import React, { useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Search,
  Mail,
  RefreshCw,
  Users,
  Bell,
  CreditCard,
  Code2,
  Cpu,
} from 'lucide-react';
import { verifyPayment, rejectPayment } from '@/lib/firebase/payments';
import { useAuthStore } from '@/stores/auth-store';
import { useProfileStore } from '@/stores/profile-store';
import { getDaysRemaining } from '@/lib/subscription/status';

import { useAdminData } from './hooks/useAdminData';
import { useAdminActions } from './hooks/useAdminActions';

import { ApprovalQueueTab } from './tabs/ApprovalQueueTab';
import { SurveyorsTab } from './tabs/SurveyorsTab';
import { PaymentsTab } from './tabs/PaymentsTab';
import { DevNotesTab } from './tabs/DevNotesTab';
import { AIModelsTab } from './tabs/AIModelsTab';

import { DismissModal } from './modals/DismissModal';
import { EmailComposerModal } from './modals/EmailComposerModal';
import { VerifyPaymentModal } from './modals/VerifyPaymentModal';
import { RejectPaymentModal } from './modals/RejectPaymentModal';
import { DeleteAccountModal } from './modals/DeleteAccountModal';

import type { AdminTab, PaymentFilter, NewSignup, SurveyorAdminProfile } from './types';
import type { PaymentRecord } from '@/types/payment';

export function AdminDashboard() {
  const user = useAuthStore((s) => s.user);
  const profile = useProfileStore((s) => s.profile);
  const isAuthorized = Boolean(user && profile?.isAdmin === true);

  const [activeTab, setActiveTab] = useState<AdminTab>('surveyors');
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('pending');

  // Modal state
  const [dismissModal, setDismissModal] = useState<{ uid: string; email: string; name: string } | null>(null);
  const [emailModal, setEmailModal] = useState<{ email: string; name: string } | null>(null);
  const [verifyModal, setVerifyModal] = useState<{ payment: PaymentRecord } | null>(null);
  const [rejectModal, setRejectModal] = useState<{ payment: PaymentRecord } | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ surveyor: SurveyorAdminProfile } | null>(null);

  const {
    surveyors,
    signups,
    payments,
    loading,
    signupsLoading,
    paymentsLoading,
    fetchAllProfiles,
    fetchSignups,
    fetchPayments,
    refreshAll,
    setSurveyors,
    setSignups,
  } = useAdminData(isAuthorized);

  const {
    processingId,
    handleApprove,
    handleDismissConfirm,
    handleSendCustomEmail,
    handleUpdateStatus,
    handleUpdateExpiry,
    handleUpdateId,
    handleUpdateName,
    handleExtendSubscription,
    handleDeleteAccount,
  } = useAdminActions({ fetchAllProfiles, fetchSignups, setSurveyors, setSignups });

  // Badge counts
  const expiringSoonCount = surveyors.filter(s => {
    const expiry = s.subscriptionExpiry;
    if (!expiry) return false;
    const days = getDaysRemaining(expiry);
    return days > 0 && days <= 7;
  }).length;

  const pendingPaymentsCount = payments.filter(p => p.status === 'pending').length;

  if (!isAuthorized) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-neutral-50 p-8">
        <div className="max-w-md w-full bg-white border border-border rounded-2xl shadow-sm p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-status-danger-tint flex items-center justify-center mx-auto mb-4">
            <ShieldAlert size={32} className="text-status-danger" />
          </div>
          <h2 className="text-lg font-medium text-foreground mb-2">Not Authorized</h2>
          <p className="text-sm text-muted-foreground font-medium">
            The administrator dashboard is restricted to accounts with admin privileges.
            This attempt has been logged.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-neutral-50">
      {/* Header */}
      <div className="px-8 py-8 border-b bg-white border-border">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <ShieldCheck size={24} />
              </div>
              <h1 className="text-2xl font-medium tracking-tight text-foreground">Regulator Dashboard</h1>
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              Manage all active surveyors and their digital profile vaults.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {activeTab === 'surveyors' && (
              <>
                <button
                  onClick={() => {
                    const emails = surveyors.map(s => s.email).filter(Boolean).join(', ');
                    navigator.clipboard.writeText(emails);
                    alert(`Copied ${surveyors.length} email addresses to clipboard!`);
                  }}
                  className="px-4 py-2.5 rounded-xl border border-border text-foreground hover:bg-neutral-50 transition-all font-medium text-xs flex items-center gap-2 shadow-sm"
                  title="Copy All Emails"
                >
                  <Mail size={16} className="text-primary" /> Copy All Emails
                </button>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                  <input
                    type="text"
                    placeholder="Search by name or UID..."
                    className="pl-10 pr-4 py-2.5 rounded-xl border border-border text-sm w-64 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>
              </>
            )}
            <button
              onClick={refreshAll}
              className="p-2.5 rounded-xl border border-border text-foreground hover:bg-neutral-50 transition-all"
              title="Refresh Data"
            >
              <RefreshCw size={18} className={loading || signupsLoading || paymentsLoading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="max-w-7xl mx-auto mt-6 flex gap-1 border-b border-border">
          <button
            onClick={() => setActiveTab('surveyors')}
            className={`flex items-center gap-2 px-5 py-2.5 text-xs font-medium uppercase tracking-wider rounded-t-lg transition-all ${
              activeTab === 'surveyors'
                ? 'bg-white border border-b-white border-border text-primary -mb-px'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Users size={14} />
            All Surveyors
            <span className="ml-1 px-1.5 py-0.5 rounded-md bg-neutral-100 text-foreground text-[9px]">
              {surveyors.length}
            </span>
            {expiringSoonCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-md bg-status-danger-tint text-status-danger text-[9px] font-medium">
                {expiringSoonCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('signups')}
            className={`flex items-center gap-2 px-5 py-2.5 text-xs font-medium uppercase tracking-wider rounded-t-lg transition-all ${
              activeTab === 'signups'
                ? 'bg-white border border-b-white border-border text-primary -mb-px'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Bell size={14} />
            New Signups
            {signups.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-md bg-status-warning-tint text-foreground text-[9px] font-medium">
                {signups.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('payments')}
            className={`flex items-center gap-2 px-5 py-2.5 text-xs font-medium uppercase tracking-wider rounded-t-lg transition-all ${
              activeTab === 'payments'
                ? 'bg-white border border-b-white border-border text-primary -mb-px'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <CreditCard size={14} />
            Payments
            {pendingPaymentsCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-md bg-status-success-tint text-status-success text-[9px] font-medium">
                {pendingPaymentsCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('dev-notes')}
            className={`flex items-center gap-2 px-5 py-2.5 text-xs font-medium uppercase tracking-wider rounded-t-lg transition-all ${
              activeTab === 'dev-notes'
                ? 'bg-white border border-b-white border-border text-primary -mb-px'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Code2 size={14} />
            Dev Notes
          </button>
          <button
            onClick={() => setActiveTab('ai-models')}
            className={`flex items-center gap-2 px-5 py-2.5 text-xs font-medium uppercase tracking-wider rounded-t-lg transition-all ${
              activeTab === 'ai-models'
                ? 'bg-white border border-b-white border-border text-primary -mb-px'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Cpu size={14} />
            AI Models
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-7xl mx-auto">
          {activeTab === 'signups' && (
            <ApprovalQueueTab
              signups={signups}
              loading={signupsLoading}
              approvingId={processingId}
              onApprove={(signup: NewSignup, trialDays: number) => handleApprove(signup, trialDays)}
              onDismiss={(signup: NewSignup) =>
                setDismissModal({ uid: signup.uid, email: signup.email, name: signup.profileName || signup.name || signup.displayName })
              }
              onEmail={(email, name) => setEmailModal({ email, name })}
            />
          )}

          {activeTab === 'surveyors' && (
            <SurveyorsTab
              surveyors={surveyors}
              loading={loading}
              processingId={processingId}
              searchQuery={searchQuery}
              onUpdateStatus={handleUpdateStatus}
              onUpdateExpiry={handleUpdateExpiry}
              onUpdateId={handleUpdateId}
              onUpdateName={handleUpdateName}
              onExtend={handleExtendSubscription}
              onDeleteAccount={(surveyor) => setDeleteModal({ surveyor })}
            />
          )}

          {activeTab === 'payments' && (
            <PaymentsTab
              payments={payments}
              surveyors={surveyors}
              loading={paymentsLoading}
              paymentFilter={paymentFilter}
              setPaymentFilter={setPaymentFilter}
              onVerify={(payment) => setVerifyModal({ payment })}
              onReject={(payment) => setRejectModal({ payment })}
            />
          )}

          {activeTab === 'dev-notes' && <DevNotesTab />}

          {activeTab === 'ai-models' && <AIModelsTab adminEmail={user?.email ?? 'admin'} />}
        </div>
      </div>

      {/* Footer */}
      <div className="px-8 py-4 border-t bg-white border-border text-center">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Motor SurveyOS • Digital Profile Sync Registry • Administrative Access Only
        </p>
      </div>

      {/* Modals */}
      {dismissModal && (
        <DismissModal
          uid={dismissModal.uid}
          email={dismissModal.email}
          name={dismissModal.name}
          onConfirm={(uid, email, name, reason, sendEmailFlag) => {
            setDismissModal(null);
            handleDismissConfirm(uid, email, name, reason, sendEmailFlag);
          }}
          onCancel={() => setDismissModal(null)}
        />
      )}

      {emailModal && (
        <EmailComposerModal
          email={emailModal.email}
          name={emailModal.name}
          onSend={async (email, name, subject, body) => {
            await handleSendCustomEmail(email, name, subject, body);
            setEmailModal(null);
          }}
          onCancel={() => setEmailModal(null)}
        />
      )}

      {verifyModal && (
        <VerifyPaymentModal
          payment={verifyModal.payment}
          onConfirm={async (payment, duration) => {
            if (!user) return;
            try {
              await verifyPayment(payment.userUid!, payment.id!, user.uid, duration);
              // Refresh both — order matters: payments first, then profiles
              await fetchPayments();
              await fetchAllProfiles();
            } catch (err) {
              console.error('Verify failed:', err);
              alert('Payment verification failed. Check console.');
            } finally {
              setVerifyModal(null);
            }
          }}
          onCancel={() => setVerifyModal(null)}
        />
      )}

      {rejectModal && (
        <RejectPaymentModal
          payment={rejectModal.payment}
          onConfirm={async (payment, reason) => {
            try {
              await rejectPayment(payment.userUid!, payment.id!, reason);
              await fetchPayments();
            } catch (err) {
              console.error('Reject failed:', err);
            } finally {
              setRejectModal(null);
            }
          }}
          onCancel={() => setRejectModal(null)}
        />
      )}

      {deleteModal && (
        <DeleteAccountModal
          surveyor={deleteModal.surveyor}
          processing={processingId === deleteModal.surveyor.id}
          onConfirm={() => {
            handleDeleteAccount(deleteModal.surveyor.id, () => {
              setDeleteModal(null);
              fetchAllProfiles();
            });
          }}
          onCancel={() => setDeleteModal(null)}
        />
      )}
    </div>
  );
}
