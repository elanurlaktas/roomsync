import '@testing-library/jest-dom/vitest';

// jsdom, Radix UI'ın (örn. Select) dayandığı bazı DOM API'lerini implemente
// etmiyor — testlerde bu bileşenlerle etkileşim kurabilmek için no-op'larla
// dolduruyoruz.
if (typeof window !== 'undefined') {
  if (!window.HTMLElement.prototype.hasPointerCapture) {
    window.HTMLElement.prototype.hasPointerCapture = () => false;
  }
  if (!window.HTMLElement.prototype.setPointerCapture) {
    window.HTMLElement.prototype.setPointerCapture = () => {};
  }
  if (!window.HTMLElement.prototype.releasePointerCapture) {
    window.HTMLElement.prototype.releasePointerCapture = () => {};
  }
  if (!window.HTMLElement.prototype.scrollIntoView) {
    window.HTMLElement.prototype.scrollIntoView = () => {};
  }
}
