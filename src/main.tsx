import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Versão nova publicada: quando o service worker novo assume, recarrega uma vez para já usar o código novo
// (sem isso a tela ficava na versão anterior até o segundo F5).
if ('serviceWorker' in navigator) {
  const tinhaControle = !!navigator.serviceWorker.controller;
  let recarregou = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!tinhaControle || recarregou) return;
    recarregou = true;
    window.location.reload();
  });
  // confere se saiu versão nova ao voltar para a aba
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') navigator.serviceWorker.getRegistration().then((r) => r?.update()).catch(() => {});
  });
}

createRoot(document.getElementById("root")!).render(<App />);
