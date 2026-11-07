/**
 * EscrowPay embeddable widget loader (v1).
 *
 * Usage:
 *   <script src="https://pay.example.com/widget/v1.js" async></script>
 *   <button data-escrowpay data-public-key="pk_live_..." data-product="prd_...">
 *     Buy with crypto
 *   </button>
 *
 * All pricing is resolved server-side; the button only carries a product id.
 */
(function () {
  'use strict';

  if (window.EscrowPay && window.EscrowPay.__v1) return;

  var script = document.currentScript;
  var baseOrigin = 'http://localhost:3000';
  try {
    baseOrigin = new URL(script.src, window.location.href).origin;
  } catch (err) {
    /* keep default */
  }

  var active = null;

  function restoreButton() {
    if (!active) return;
    if (active.button) {
      active.button.disabled = false;
      active.button.textContent = active.label;
    }
    active = null;
  }

  function closeOverlay() {
    if (active && active.overlay && active.overlay.parentNode) {
      active.overlay.parentNode.removeChild(active.overlay);
    }
    restoreButton();
  }

  function showError(message) {
    var toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = [
      'position:fixed',
      'left:50%',
      'bottom:24px',
      'transform:translateX(-50%)',
      'z-index:2147483647',
      'max-width:420px',
      'width:calc(100% - 32px)',
      'padding:12px 16px',
      'border-radius:12px',
      'background:#2a1020',
      'border:1px solid #7f1d3a',
      'color:#ffd7e2',
      'font:13px/1.4 system-ui,-apple-system,Segoe UI,sans-serif',
      'box-shadow:0 12px 40px rgba(0,0,0,.45)',
    ].join(';');
    document.body.appendChild(toast);
    setTimeout(function () {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 6000);
  }

  function notifySuccess(orderId) {
    if (!active) return;
    var callbackName = active.callbackName;
    var detail = { orderId: orderId };
    try {
      if (callbackName && typeof window[callbackName] === 'function') {
        window[callbackName](detail);
      }
      if (active.button) {
        active.button.dispatchEvent(
          new CustomEvent('escrowpay:success', { detail: detail, bubbles: true })
        );
      }
    } catch (err) {
      console.warn('[EscrowPay] success callback failed', err);
    }
  }

  function onMessage(event) {
    if (!active) return;
    if (event.origin !== baseOrigin) return;
    var data = event.data || {};
    if (data.type === 'escrowpay:success') {
      notifySuccess(data.orderId);
      if (active.popup && !active.popup.closed) active.popup.close();
      closeOverlay();
    } else if (data.type === 'escrowpay:close') {
      if (active.popup && !active.popup.closed) active.popup.close();
      closeOverlay();
    }
  }

  if (!window.__escrowpayListener) {
    window.__escrowpayListener = true;
    window.addEventListener('message', onMessage);
  }

  function openPopup(checkoutUrl) {
    var width = 460;
    var height = 820;
    var left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2));
    var top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2));
    return window.open(
      checkoutUrl,
      'escrowpay_checkout',
      'popup=yes,width=' +
        width +
        ',height=' +
        height +
        ',left=' +
        left +
        ',top=' +
        top
    );
  }

  function openIframe(checkoutUrl) {
    var overlay = document.createElement('div');
    overlay.style.cssText = [
      'position:fixed',
      'inset:0',
      'z-index:2147483647',
      'background:rgba(5,6,10,.78)',
      'backdrop-filter:blur(6px)',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'padding:16px',
    ].join(';');

    var card = document.createElement('div');
    card.style.cssText = [
      'position:relative',
      'width:100%',
      'max-width:460px',
      'height:min(820px,100%)',
      'background:#0b0c10',
      'border:1px solid #23273a',
      'border-radius:24px',
      'overflow:hidden',
      'box-shadow:0 30px 80px rgba(0,0,0,.6)',
    ].join(';');

    var close = document.createElement('button');
    close.type = 'button';
    close.setAttribute('aria-label', 'Close checkout');
    close.innerHTML = '&times;';
    close.style.cssText = [
      'position:absolute',
      'right:10px',
      'top:10px',
      'z-index:2',
      'width:32px',
      'height:32px',
      'border-radius:10px',
      'border:1px solid rgba(255,255,255,.12)',
      'background:rgba(15,17,25,.9)',
      'color:#cbd5e1',
      'font-size:20px',
      'line-height:1',
      'cursor:pointer',
    ].join(';');
    close.onclick = closeOverlay;

    var frame = document.createElement('iframe');
    frame.src = checkoutUrl;
    frame.title = 'EscrowPay checkout';
    frame.allow = 'clipboard-write';
    frame.style.cssText = 'width:100%;height:100%;border:0;background:#0b0c10';

    card.appendChild(close);
    card.appendChild(frame);
    overlay.appendChild(card);
    overlay.addEventListener('click', function (event) {
      if (event.target === overlay) closeOverlay();
    });
    document.body.appendChild(overlay);
    return overlay;
  }

  function start(button) {
    if (active) return;

    var publicKey = button.getAttribute('data-public-key');
    var productId = button.getAttribute('data-product');
    var quantity = button.getAttribute('data-quantity') || '1';
    var mode = button.getAttribute('data-mode') || undefined;

    if (!publicKey || !productId) {
      showError('EscrowPay: data-public-key and data-product are required.');
      return;
    }

    active = {
      button: button,
      label: button.textContent,
      callbackName: button.getAttribute('data-on-success'),
      popup: null,
      overlay: null,
    };
    button.disabled = true;
    button.textContent = 'Opening checkout…';

    fetch(baseOrigin + '/api/v1/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        publishableKey: publicKey,
        productId: productId,
        quantity: Number(quantity) || 1,
        mode: mode,
      }),
    })
      .then(function (response) {
        return response.json().then(function (data) {
          if (!response.ok) throw new Error(data.error || 'Could not start checkout');
          return data;
        });
      })
      .then(function (data) {
        var checkoutUrl = data.session.checkoutUrl;
        var popup = openPopup(checkoutUrl);
        if (popup) {
          active.popup = popup;
          var closedTimer = setInterval(function () {
            if (!active) {
              clearInterval(closedTimer);
              return;
            }
            if (!active.popup || active.popup.closed) {
              clearInterval(closedTimer);
              if (!active.overlay) closeOverlay();
            }
          }, 800);
        } else {
          active.overlay = openIframe(checkoutUrl);
          button.disabled = false;
          button.textContent = active.label;
        }
      })
      .catch(function (err) {
        console.warn('[EscrowPay]', err);
        showError(err.message || 'Could not start the escrow checkout.');
        restoreButton();
      });
  }

  document.addEventListener('click', function (event) {
    var button = event.target.closest
      ? event.target.closest('[data-escrowpay]')
      : null;
    if (!button) return;
    event.preventDefault();
    start(button);
  });

  window.EscrowPay = {
    __v1: true,
    open: function (options) {
      if (!options || !options.checkoutUrl) {
        showError('EscrowPay.open requires a checkoutUrl');
        return;
      }
      closeOverlay();
      active = {
        button: null,
        label: '',
        callbackName: options.onSuccessName || null,
        popup: null,
        overlay: null,
      };
      var popup = openPopup(options.checkoutUrl);
      if (popup) {
        active.popup = popup;
      } else {
        active.overlay = openIframe(options.checkoutUrl);
      }
    },
    close: closeOverlay,
  };
})();
