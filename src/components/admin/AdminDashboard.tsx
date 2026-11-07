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
  Receipt,
  Megaphone,
} from 'lucide-react';
import { toast } from 'sonner';
import { rejectPayment } from '@/lib/firebase/payments';
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
import { FeeScheduleTab } from './tabs/FeeScheduleTab';
import { AnnouncementsTab } from './tabs/AnnouncementsTab';

import { DismissModal } from './modals/DismissModal';
import { EmailComposerModal } from './modals/EmailComposerModal';
import { VerifyPaymentModal } from './modals/VerifyPaymentModal';
import { RejectPaymentModal } from './modals/RejectPaymentModal';
import { DeleteAccountModal } from './modals/DeleteAccountModal';
import { RecordOfflinePaymentModal } from './modals/RecordOfflinePaymentModal';

import type { AdminTab, PaymentFilter, NewSignup, SurveyorAdminProfile } from './types';
import type { PaymentRecord } from '@/types/payment';

export interface AdminDashboardProps {
  initialTab?: AdminTab;
  isAuthorized?: boolean;
  getAction?: (actions: {
    handleCopyEmails: () => void;
    setActiveTab: (tab: AdminTab) => void;
    setSearchQuery: (q: string) => void;
  }) => void;
}

export function AdminDashboard({
  initialTab = 'surveyors',
  isAuthorized: isAuthorizedProp,
  getAction,
}: AdminDashboardProps = {}) {
  const user = useAuthStore((s) => s.user);
  const profile = useProfileStore((s) => s.profile);
  const isAuthorized = isAuthorizedProp !== undefined ? isAuthorizedProp : Boolean(user && profile?.isAdmin === true);

  const [activeTab, setActiveTab] = useState<AdminTab>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('pending');

  // Modal state
  const [dismissModal, setDismissModal] = useState<{ uid: string; email: string; name: string } | null>(null);
  const [emailModal, setEmailModal] = useState<{ email: string; name: string } | null>(null);
  const [verifyModal, setVerifyModal] = useState<{ payment: PaymentRecord } | null>(null);
  const [rejectModal, setRejectModal] = useState<{ payment: PaymentRecord } | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ surveyor: SurveyorAdminProfile } | null>(null);
  const [isRecordModalOpen, setIsRecordModalOpen] = useState<boolean>(false);

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
    handleUpdateTeamSeats,
    handleVerify,
    handleRecordManualPayment,
  } = useAdminActions({
    fetchAllProfiles,
    fetchSignups,
    fetchPayments,
    setSurveyors,
    setSignups,
    adminUid: user?.uid,
  });

  // Badge counts
  const expiringSoonCount = surveyors.filter(s => {
    const expiry = s.subscriptionExpiry;
    if (!expiry) return false;
    const days = getDaysRemaining(expiry);
    return days > 0 && days <= 7;
  }).length;

  const pendingPaymentsCount = payments.filter(p => p.status === 'pending').length;

  const handleCopyEmails = () => {
    const emails = surveyors.map(s => s.email).filter((email): email is string => Boolean(email));
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(emails.join(', '));
    }
    toast.success(`Copied ${emails.length} email addresses to clipboard!`);
  };

  if (getAction) {
    getAction({
      handleCopyEmails,
      setActiveTab,
      setSearchQuery,
    });
  }

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
              <button
                onClick={handleCopyEmails}
                className="px-4 py-2.5 rounded-xl border border-border text-foreground hover:bg-neutral-50 transition-all font-medium text-xs flex items-center gap-2 shadow-sm focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                title="Copy All Emails"
              >
                <Mail size={16} className="text-primary" /> Copy All Emails
              </button>
            )}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <input
                type="text"
                aria-label="Search surveyors, licence, or ID"
                placeholder="Search by name, licence, or UID..."
                className="pl-10 pr-4 py-2.5 rounded-xl border border-border text-sm w-64 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none transition-all font-medium"
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  if (activeTab !== 'surveyors' && e.target.value.trim() !== '') {
                    setActiveTab('surveyors');
                  }
                }}
              />
            </div>
            <button
              onClick={refreshAll}
              className="p-2.5 rounded-xl border border-border text-foreground hover:bg-neutral-50 transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
              title="Refresh Data"
            >
              <RefreshCw size={18} className={loading || signupsLoading || paymentsLoading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Tab navigation: Primary Operations + System Tools */}
        <div className="max-w-7xl mx-auto mt-6 flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border">
          {/* Primary Operations Tabs */}
          <div role="tablist" aria-label="Primary Operations" className="flex items-center gap-2 overflow-x-auto">
            <button
              role="tab"
              aria-selected={activeTab === 'surveyors'}
              onClick={() => setActiveTab('surveyors')}
              className={`flex items-center gap-2 px-5 py-2.5 text-xs font-semibold uppercase tracking-wider rounded-t-lg transition-all border-b-2 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none ${
                activeTab === 'surveyors'
                  ? 'bg-white border-primary text-primary -mb-px'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-neutral-50'
              }`}
            >
              <Users size={16} />
              <span>All Surveyors</span>
              <span className="ml-1 px-1.5 py-0.5 rounded-md bg-neutral-100 text-foreground text-[11px] font-medium">
                {surveyors.length}
              </span>
              {expiringSoonCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-md bg-status-danger-tint text-status-danger text-[11px] font-medium">
                  {expiringSoonCount}
                </span>
              )}
            </button>

            <button
              role="tab"
              aria-selected={activeTab === 'signups'}
              onClick={() => setActiveTab('signups')}
              className={`flex items-center gap-2 px-5 py-2.5 text-xs font-semibold uppercase tracking-wider rounded-t-lg transition-all border-b-2 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none ${
                activeTab === 'signups'
                  ? 'bg-white border-primary text-primary -mb-px'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-neutral-50'
              }`}
            >
              <Bell size={16} />
              <span>New Signups</span>
              {signups.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-md bg-status-warning-tint text-foreground text-[11px] font-medium">
                  {signups.length}
                </span>
              )}
            </button>

            <button
              role="tab"
              aria-selected={activeTab === 'payments'}
              onClick={() => setActiveTab('payments')}
              className={`flex items-center gap-2 px-5 py-2.5 text-xs font-semibold uppercase tracking-wider rounded-t-lg transition-all border-b-2 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none ${
                activeTab === 'payments'
                  ? 'bg-white border-primary text-primary -mb-px'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-neutral-50'
              }`}
            >
              <CreditCard size={16} />
              <span>Payments</span>
              {pendingPaymentsCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-md bg-status-success-tint text-status-success text-[11px] font-medium">
                  {pendingPaymentsCount}
                </span>
              )}
            </button>
          </div>

          {/* System Tools Segmented Group */}
          <div role="tablist" aria-label="System Tools" className="flex items-center gap-1 bg-neutral-100 p-1 rounded-xl border border-border mb-1 overflow-x-auto">
            <span className="px-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider hidden sm:inline">
              System
            </span>
            <button
              role="tab"
              aria-selected={activeTab === 'ai-models'}
              onClick={() => setActiveTab('ai-models')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none ${
                activeTab === 'ai-models'
                  ? 'bg-white text-primary shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Cpu size={16} />
              <span>AI Models</span>
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'fee-schedule'}
              onClick={() => setActiveTab('fee-schedule')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none ${
                activeTab === 'fee-schedule'
                  ? 'bg-white text-primary shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Receipt size={16} />
              <span>Fee Schedule</span>
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'announcements'}
              onClick={() => setActiveTab('announcements')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none ${
                activeTab === 'announcements'
                  ? 'bg-white text-primary shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Megaphone size={16} />
              <span>Announcements</span>
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'dev-notes'}
              onClick={() => setActiveTab('dev-notes')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none ${
                activeTab === 'dev-notes'
                  ? 'bg-white text-primary shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Code2 size={16} />
              <span>Dev Notes</span>
            </button>
          </div>
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
              payments={payments}
              loading={loading}
              processingId={processingId}
              searchQuery={searchQuery}
              onUpdateStatus={handleUpdateStatus}
              onUpdateExpiry={handleUpdateExpiry}
              onUpdateId={handleUpdateId}
              onUpdateName={handleUpdateName}
              onExtend={handleExtendSubscription}
              onDeleteAccount={(surveyor) => setDeleteModal({ surveyor })}
              onUpdateTeamSeats={handleUpdateTeamSeats}
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
              onOpenRecordModal={() => setIsRecordModalOpen(true)}
            />
          )}

          {activeTab === 'dev-notes' && <DevNotesTab />}

          {activeTab === 'ai-models' && <AIModelsTab adminEmail={user?.email ?? 'admin'} />}
          {activeTab === 'fee-schedule' && <FeeScheduleTab adminName={user?.email ?? 'admin'} />}
          {activeTab === 'announcements' && <AnnouncementsTab adminName={user?.email ?? 'admin'} />}
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
          onConfirm={async (payment, duration, adminNotes) => {
            try {
              await handleVerify(payment, duration, adminNotes);
            } catch (err) {
              console.error('Verify failed:', err);
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

      {isRecordModalOpen && (
        <RecordOfflinePaymentModal
          surveyors={surveyors}
          onClose={() => setIsRecordModalOpen(false)}
          onRecord={async (userUid, data) => {
            await handleRecordManualPayment(userUid, data);
          }}
        />
      )}
    </div>
  );
}
