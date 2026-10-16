/** True on touch-first devices (phones, tablets): "swipe" wording there, keys and buttons elsewhere. */
export const isTouchDevice = () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true;
