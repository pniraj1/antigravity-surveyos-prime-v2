import type { PortalPacket } from './packet';

/** The Relay content script stamps the page when the extension is installed. */
export function isExtensionPresent(): boolean {
  return typeof document !== 'undefined' && !!document.documentElement.dataset.surveyosExt;
}

export const NOT_INSTALLED_LINE = 'Fill the portal automatically with the SurveyOS Portal Fill extension.';

/** Must match the extension's claimTail: uppercase, alphanumerics only, last 4. */
const claimTail = (claimNo: string) => '…' + claimNo.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(-4);

export function readyLine(portal: 'nia' | 'uiic' | 'oic', claimNo: string): string {
  const name = portal === 'nia' ? 'New India' : portal === 'oic' ? 'Oriental Insurance' : 'United India';
  return `Ready: claim ${claimTail(claimNo)} is waiting for the ${name} portal. Open the claim there and click Fill. Expires in 24 h. Sending another claim replaces this one.`;
}

export function sendPacketToExtension(
  packet: PortalPacket,
  timeoutMs = 3000,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  return new Promise((resolve) => {
    const onAck = (ev: MessageEvent) => {
      if (ev.origin !== location.origin || ev.source !== window) return;
      if (!ev.data || ev.data.type !== 'surveyos:portal-packet-ack') return;
      cleanup();
      resolve(ev.data.ok ? { ok: true } : { ok: false, reason: ev.data.reason ?? 'extension refused the packet' });
    };
    const timer = setTimeout(() => { cleanup(); resolve({ ok: false, reason: 'No reply from the extension. Is it enabled?' }); }, timeoutMs);
    const cleanup = () => { clearTimeout(timer); window.removeEventListener('message', onAck); };
    window.addEventListener('message', onAck);
    window.postMessage({ type: 'surveyos:portal-packet', packet }, location.origin);
  });
}

/** Push cloud-backed learned mappings into the local extension storage. */
export function pushCloudLearningsToExtension(
  portal: string,
  flow: string,
  bindings: any[],
  timeoutMs = 3000,
): Promise<{ ok: boolean }> {
  return new Promise((resolve) => {
    const onAck = (ev: MessageEvent) => {
      if (ev.origin !== location.origin || ev.source !== window) return;
      if (!ev.data || ev.data.type !== 'surveyos:portal-sync-push-ack') return;
      cleanup();
      resolve({ ok: !!ev.data.ok });
    };
    const timer = setTimeout(() => { cleanup(); resolve({ ok: false }); }, timeoutMs);
    const cleanup = () => { clearTimeout(timer); window.removeEventListener('message', onAck); };
    window.addEventListener('message', onAck);
    window.postMessage({ type: 'surveyos:portal-sync-push', portal, flow, bindings }, location.origin);
  });
}

/** Retrieve all locally confirmed learned mappings from the extension to sync to the cloud. */
export function pullLearningsFromExtension(
  timeoutMs = 3000,
): Promise<{ ok: boolean; learnings?: Record<string, any[]> }> {
  return new Promise((resolve) => {
    const onAck = (ev: MessageEvent) => {
      if (ev.origin !== location.origin || ev.source !== window) return;
      if (!ev.data || ev.data.type !== 'surveyos:portal-sync-pull-ack') return;
      cleanup();
      resolve({ ok: !!ev.data.ok, learnings: ev.data.learnings });
    };
    const timer = setTimeout(() => { cleanup(); resolve({ ok: false }); }, timeoutMs);
    const cleanup = () => { clearTimeout(timer); window.removeEventListener('message', onAck); };
    window.addEventListener('message', onAck);
    window.postMessage({ type: 'surveyos:portal-sync-pull' }, location.origin);
  });
}
