// @ts-check
(() => {
  const statusTitle = document.getElementById('status-title');
  const statusDesc = document.getElementById('status-desc');
  const actionArea = document.getElementById('action-area');
  const btnEnable = document.getElementById('btn-enable');

  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    const tab = tabs[0];
    if (!tab || !tab.url) {
      if (statusTitle) statusTitle.textContent = 'No Active Tab';
      if (statusDesc) statusDesc.textContent = 'Open an insurer surveyor portal to use SurveyOS.';
      return;
    }

    try {
      const u = new URL(tab.url);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') {
        if (statusTitle) statusTitle.textContent = 'Non-web page';
        if (statusDesc) statusDesc.textContent = 'SurveyOS works on web insurer portals.';
        return;
      }

      const origin = u.origin;
      const pattern = origin + '/*';

      chrome.permissions.contains({ origins: [pattern] }, (hasPermission) => {
        if (hasPermission) {
          if (statusTitle) statusTitle.innerHTML = '<span class="active-dot"></span> Active on ' + u.hostname;
          if (statusDesc) statusDesc.textContent = 'SurveyOS is ready to auto-fill and learn field mappings on this portal.';
          if (actionArea) actionArea.style.display = 'none';
        } else {
          if (statusTitle) statusTitle.innerHTML = '<span class="inactive-dot"></span> Custom Portal: ' + u.hostname;
          if (statusDesc) statusDesc.textContent = 'Click below to enable SurveyOS on this portal. It will learn fields as you type.';
          if (actionArea) actionArea.style.display = 'block';

          if (btnEnable) {
            btnEnable.onclick = () => {
              chrome.permissions.request({ origins: [pattern] }, async (granted) => {
                if (granted) {
                  if (statusTitle) statusTitle.innerHTML = '<span class="active-dot"></span> Active on ' + u.hostname;
                  if (statusDesc) statusDesc.textContent = 'Permission granted. Reloading portal with SurveyOS sidecar...';
                  if (actionArea) actionArea.style.display = 'none';
                  if (tab.id) chrome.tabs.reload(tab.id);
                  setTimeout(() => window.close(), 1000);
                }
              });
            };
          }
        }
      });
    } catch {
      if (statusTitle) statusTitle.textContent = 'SurveyOS Portal Fill';
      if (statusDesc) statusDesc.textContent = 'Ready for insurer surveyor portals.';
    }
  });
})();
