/**
 * Content Script
 * Injects the getUserMedia interceptor into the page's main world
 * so we can anonymize mic audio before any web app receives it.
 */

// Pass the worklet URL and current settings to the injected script
function injectInterceptor() {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('injected.js');
  script.dataset.workletUrl = chrome.runtime.getURL('audio-processor.js');

  // Load current settings and pass them
  chrome.storage.local.get('voiceAnonymizer', (result) => {
    script.dataset.settings = JSON.stringify(result.voiceAnonymizer || {});
    (document.head || document.documentElement).appendChild(script);
    script.onload = () => script.remove();
  });
}

injectInterceptor();

// Listen for setting updates from popup
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'VOICE_ANON_SETTINGS') {
    // Forward to page context via custom event
    window.dispatchEvent(
      new CustomEvent('__voiceAnon_settingsUpdate', {
        detail: message.settings,
      })
    );
  }
});