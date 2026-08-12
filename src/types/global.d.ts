
declare global {
  interface Window {
    salvarAudioNaBiblioteca?: (audio: {
      texto: string;
      audio_url: string;
      voz: string;
      duracao?: string;
    }) => void;
  }
}

export {};
