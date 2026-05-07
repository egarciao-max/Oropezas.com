// Debug overlay helper
window.AuthDebug = {
  log: function(msg) {
    console.log('[AUTH]', msg);
    var el = document.getElementById('auth-debug-log');
    if (!el) {
      el = document.createElement('div');
      el.id = 'auth-debug-log';
      el.style.cssText = 'position:fixed;bottom:60px;right:10px;width:300px;max-height:200px;overflow-y:auto;background:#1a1a1a;color:#0f0;font-family:monospace;font-size:11px;padding:8px;border-radius:4px;z-index:99999;opacity:0.9;';
      document.body.appendChild(el);
    }
    var line = document.createElement('div');
    line.textContent = new Date().toLocaleTimeString() + ' ' + msg;
    el.appendChild(line);
    el.scrollTop = el.scrollHeight;
  },
  clear: function() {
    var el = document.getElementById('auth-debug-log');
    if (el) el.innerHTML = '';
  }
};
