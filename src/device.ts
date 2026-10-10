/** Touch-capable device (iPad reports maxTouchPoints > 1 even in "desktop" Safari mode). */
export const IS_TOUCH =
  (typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches) ||
  (navigator.maxTouchPoints || 0) > 1;

export const IS_IOS =
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1);

let probe: HTMLDivElement | null = null;

/** CSS-pixel safe-area insets (notch / home indicator / rounded corners). */
export function safeInsets() {
  if (!probe) {
    probe = document.createElement('div');
    probe.style.cssText =
      'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;' +
      'padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);';
    document.body.appendChild(probe);
  }
  const cs = getComputedStyle(probe);
  const n = (v: string) => parseFloat(v) || 0;
  return { top: n(cs.paddingTop), right: n(cs.paddingRight), bottom: n(cs.paddingBottom), left: n(cs.paddingLeft) };
}
