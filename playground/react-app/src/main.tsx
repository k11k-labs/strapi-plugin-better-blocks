import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'katex/dist/katex.min.css';
import Hls from 'hls.js';
import App from './App';

// The renderer picks hls.js up from `window.Hls` so it can play HLS (`.m3u8`)
// video outside Safari without taking on the dependency itself.
(window as unknown as { Hls: typeof Hls }).Hls = Hls;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
