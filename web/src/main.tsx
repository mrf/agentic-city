import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

document.body.style.margin = '0';
document.body.style.overflow = 'hidden';
document.body.style.background = '#0d1014';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
