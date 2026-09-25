/**
 * DOM events between the page (main bundle) and the lazy stage: plain
 * CustomEvents on window, so the page never imports the 3D chunk.
 */
export const CONTACT_SENT_EVENT = "cv:contact-sent";

export function announceContactSent(): void {
  window.dispatchEvent(new CustomEvent(CONTACT_SENT_EVENT));
}
