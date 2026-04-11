// Highlight & reposition Botpress chatbot widget
(function () {
  // 1. Wait for Botpress to be ready, then customize via its API
  var configAttempts = 0;
  var configTimer = setInterval(function () {
    configAttempts++;
    if (window.botpress && window.botpress.updateConfiguration) {
      window.botpress.updateConfiguration({
        color: '#F4C430',
        variant: 'solid',
        themeMode: 'light',
        proactiveMessageEnabled: true,
        proactiveBubbleMessage: '👋 Hi! Ask us about admissions, fees, or anything!',
        proactiveBubbleTriggerType: 'afterDelay',
        proactiveBubbleDelayTime: 3
      });
      clearInterval(configTimer);
    }
    if (configAttempts > 30) clearInterval(configTimer);
  }, 500);

  // 2. Use MutationObserver to reposition the widget container once rendered
  var styled = false;
  var observer = new MutationObserver(function () {
    if (styled) return;
    // Botpress v3 injects a div at end of body
    var els = document.body.children;
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      // Match Botpress container by ID
      if (el.tagName === 'DIV' && el.id && el.id.toLowerCase().indexOf('bp') !== -1) {
        el.style.setProperty('position', 'fixed', 'important');
        el.style.setProperty('bottom', '80px', 'important');
        el.style.setProperty('right', '24px', 'important');
        el.style.setProperty('z-index', '997', 'important');
        styled = true;
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Auto-disconnect after 30s to save resources
  setTimeout(function () { observer.disconnect(); }, 30000);
})();
