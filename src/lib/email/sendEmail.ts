/**
 * sendEmail — Manual Email Hand-off
 *
 * This utility prepares a mailto: link which opens the admin's local email client
 * (e.g., Gmail in browser or Outlook).
 *
 * This avoids all API keys, quotas, and backend dependencies.
 */

export interface EmailPayload {
  /** Recipient email address */
  to: string;
  /** Email subject line */
  subject: string;
  /** Plain-text body for the email */
  body: string;
}

export function sendEmail(payload: EmailPayload) {
  const { to, subject, body } = payload;
  
  const url = 
    `mailto:${encodeURIComponent(to)}` +
    `?subject=${encodeURIComponent(subject)}` +
    `&body=${encodeURIComponent(body)}`;

  // Open the system's default mail handler
  window.location.href = url;
}

// ── Simple Templates ──────────────────────────────────────────────────────────

export function buildApprovalEmail(name: string) {
  const subject = '✅ Your SurveyOS Access has been Approved!';
  const body = 
    `Hi ${name},\n\n` +
    `Great news! Your SurveyOS Prime surveyor account has been approved.\n` +
    `You now have full access to the platform.\n\n` +
    `Log in here: https://surveyos-v2-antigravity.web.app\n\n` +
    `— SurveyOS Prime Team\nsurveyosprime@gmail.com`;

  return { subject, body };
}

export function buildDismissalEmail(name: string, reason: string) {
  const subject = 'Your SurveyOS Access Request — Action Required';
  const body = 
    `Hi ${name},\n\n` +
    `Your access request has been reviewed. We need some additional information before we can activate your account:\n\n` +
    `"${reason}"\n\n` +
    `Please log back in and resubmit your registration form with the corrected details.\n\n` +
    `— SurveyOS Prime Team\nsurveyosprime@gmail.com`;

  return { subject, body };
}

export function buildCustomEmail(name: string, subject: string, message: string) {
  const body = `Hi ${name},\n\n${message}\n\n— SurveyOS Prime Team\nsurveyosprime@gmail.com`;
  return { subject, body };
}
