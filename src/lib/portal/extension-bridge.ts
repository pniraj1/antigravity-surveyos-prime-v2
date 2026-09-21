import type { PortalPacket } from './packet';

/** The Relay content script stamps the page when the extension is installed. */
export function isExtensionPresent(): boolean {
  return typeof document !== 'undefined' && !!document.documentElement.dataset.surveyosExt;
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
