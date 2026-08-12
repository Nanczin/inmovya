import React, { createContext, useContext, ReactNode } from 'react';
import { useAutoTTS } from '@/hooks/useAutoTTS';

interface AutoTTSContextType {
  generateResponseWithAudio: (mensagem: string, texto?: string) => Promise<any>;
  playLastAudio: () => void;
  isGenerating: boolean;
  lastAudioUrl: string | null;
  hasAudio: boolean;
}

const AutoTTSContext = createContext<AutoTTSContextType | null>(null);

interface AutoTTSProviderProps {
  children: ReactNode;
  piperEndpoint?: string;
  enableAudio?: boolean;
}

export function AutoTTSProvider({ 
  children, 
  piperEndpoint = "https://0db839bdc4c3.ngrok-free.app",
  enableAudio = true 
}: AutoTTSProviderProps) {
  const autoTTS = useAutoTTS({ piperEndpoint, enableAudio });

  return (
    <AutoTTSContext.Provider value={autoTTS}>
      {children}
    </AutoTTSContext.Provider>
  );
}

export function useAutoTTSContext() {
  const context = useContext(AutoTTSContext);
  if (!context) {
    throw new Error('useAutoTTSContext deve ser usado dentro de AutoTTSProvider');
  }
  return context;
}