import { DOMMatrix } from '@napi-rs/canvas';

if (typeof global.DOMMatrix === 'undefined') {
  // @ts-expect-error Node global lacks DOMMatrix; polyfill for pdfjs-dist
  global.DOMMatrix = DOMMatrix;
}

if (typeof global.URL.createObjectURL === 'undefined') {
  global.URL.createObjectURL = () => 'blob:http://localhost/fake-blob-url';
}
if (typeof global.URL.revokeObjectURL === 'undefined') {
  global.URL.revokeObjectURL = () => {
    /* no-op */
  };
}
