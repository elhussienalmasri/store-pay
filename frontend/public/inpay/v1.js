/* EscrowPay inline pay loader. Mounts the checkout iframe and relays its events. */
(function () {
  'use strict';
  var script = document.currentScript;
  if (!script) return;
  var url = new URL(script.src, window.location.href);
  var escrowId = url.searchParams.get('escrow_id') || url.searchParams.get('id') || '';
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(escrowId)) return;
  var target = script.getAttribute('data-target');
  var root = target ? document.getElementById(target) : script.parentElement;
  if (!root || root.querySelector('iframe[data-escrowpay-inpay]')) return;

  var origin = url.origin;
  var frame = document.createElement('iframe');
  frame.title = 'EscrowPay secure checkout';
  frame.setAttribute('data-escrowpay-inpay', escrowId);
  frame.style.cssText = 'display:block;width:100%;height:300px;min-width:0;border:0;background:transparent;color-scheme:normal';
  frame.src = origin + '/inpay/' + encodeURIComponent(escrowId);

  var ready = false;
  var queued = null;
  var activePayment = null;
  function send(order) {
    if (ready && frame.contentWindow) {
      frame.contentWindow.postMessage({ type: 'escrowpay:pay', escrowId: escrowId, order: order }, origin);
    } else {
      queued = order;
    }
  }
  function onMessage(event) {
    if (event.source !== frame.contentWindow || event.origin !== origin) return;
    var data = event.data;
    if (!data || (data.escrowId || data.widgetId) !== escrowId) return;
    if (data.type === 'escrowpay:resize' && Number.isFinite(data.height)) {
      frame.style.height = Math.max(250, Math.min(1000, data.height)) + 'px';
      return;
    }
    if (data.type !== 'escrowpay:event') return;
    if (data.name === 'escrowpay:ready') {
      ready = true;
      if (queued) {
        var order = queued;
        queued = null;
        send(order);
      }
    }
    if (data.name === 'escrowpay:submitted' && activePayment) {
      activePayment.submitted = true;
    }
    if (data.name === 'escrowpay:paid' && activePayment) {
      activePayment.resolve(data.detail);
      activePayment = null;
    }
    if (data.name === 'escrowpay:error' && activePayment) {
      var failure = new Error(data.detail?.message || 'The payment could not be completed.');
      failure.canRetry = !activePayment.submitted;
      activePayment.reject(failure);
      activePayment = null;
    }
    if (data.name === 'escrowpay:reset' && activePayment) {
      activePayment.reject(new Error('The payment was reset.'));
      activePayment = null;
    }
    if (['escrowpay:ready', 'escrowpay:wallet-connected', 'escrowpay:submitted', 'escrowpay:paid', 'escrowpay:error', 'escrowpay:reset'].indexOf(data.name) !== -1) {
      window.dispatchEvent(new CustomEvent(data.name, { detail: data.detail }));
    }
  }
  function onPay(event) {
    if (event.detail && (event.detail.escrowId || event.detail.widgetId) === escrowId) send(event.detail);
  }
  window.addEventListener('message', onMessage);
  window.addEventListener('escrowpay:pay', onPay);

  window.EscrowPayInPay = window.EscrowPayInPay || {};
  window.EscrowPayInPay.pay = function (order) {
    if (!order || typeof order !== 'object') return Promise.reject(new Error('An order is required to start payment.'));
    if (activePayment) return Promise.reject(new Error('A payment is already in progress.'));
    return new Promise(function (resolve, reject) {
      activePayment = { resolve: resolve, reject: reject };
      send(order);
    });
  };

  var lifecycle = new MutationObserver(function () {
    if (!root.isConnected || !frame.isConnected) {
      window.removeEventListener('message', onMessage);
      window.removeEventListener('escrowpay:pay', onPay);
      lifecycle.disconnect();
    }
  });
  lifecycle.observe(document.documentElement, { childList: true, subtree: true });
  root.appendChild(frame);
})();
