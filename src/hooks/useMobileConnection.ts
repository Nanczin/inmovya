
import { useState, useEffect, useCallback } from 'react';
import { useToast } from "@/hooks/use-toast";

interface MobileConnectionState {
    activeIp: string | null;
    connectionStatus: 'idle' | 'scanning' | 'connected' | 'failed';
    lastChecked: Date | null;
}

export function useMobileConnection() {
    const { toast } = useToast();
    const [state, setState] = useState<MobileConnectionState>({
        activeIp: null,
        connectionStatus: 'idle',
        lastChecked: null,
    });

    const checkIp = useCallback(async (ip: string, timeoutMs: number = 1000): Promise<boolean> => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
            await fetch(`http://${ip}:8080`, {
                method: 'HEAD',
                mode: 'no-cors',
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            return true;
        } catch (error) {
            clearTimeout(timeoutId);
            return false;
        }
    }, []);

    const scanNetwork = useCallback(async () => {
        setState(prev => ({ ...prev, connectionStatus: 'scanning' }));

        // Check localStorage first
        const savedIp = localStorage.getItem('IP_CELULAR');
        if (savedIp) {
            const isAlive = await checkIp(savedIp);
            if (isAlive) {
                setState({
                    activeIp: savedIp,
                    connectionStatus: 'connected',
                    lastChecked: new Date()
                });
                toast({
                    title: "Celular conectado",
                    description: `Conexão restabelecida com ${savedIp}`,
                });
                return;
            }
        }

        // Safety timeout to FORCE 'failed' state if scan hangs
        // This runs in parallel to the scan
        const safetyTimeoutPromise = new Promise<{ ip: string; status: boolean } | null>((resolve) => {
            setTimeout(() => {
                console.warn("Scan timed out - forcing failed state");
                resolve(null);
            }, 5000); // 5 seconds absolute max
        });

        // Scan range 192.168.1.10 - 192.168.1.30
        const baseIp = '192.168.1.';
        const start = 10;
        const end = 30;
        const promises: Promise<{ ip: string; status: boolean }>[] = [];

        // Create all promises first
        for (let i = start; i <= end; i++) {
            const ip = `${baseIp}${i}`;
            promises.push(checkIp(ip, 2000).then(status => ({ ip, status })));
        }

        try {
            // Race logic
            const scanPromise = new Promise<{ ip: string; status: boolean } | null>((resolve) => {
                let completed = 0;
                const total = promises.length;

                if (total === 0) resolve(null);

                promises.forEach(p => {
                    p.then(res => {
                        if (res.status) {
                            resolve(res);
                        } else {
                            completed++;
                            if (completed === total) resolve(null);
                        }
                    });
                });
            });

            // Race scan vs timeout
            const found = await Promise.race([scanPromise, safetyTimeoutPromise]);

            if (found && found.status) {
                localStorage.setItem('IP_CELULAR', found.ip);
                setState({
                    activeIp: found.ip,
                    connectionStatus: 'connected',
                    lastChecked: new Date()
                });
                toast({
                    title: "Celular detectado!",
                    description: `Novo IP configurado: ${found.ip}`,
                });
            } else {
                setState({
                    activeIp: null,
                    connectionStatus: 'failed',
                    lastChecked: new Date()
                });
                // Failed state will trigger the banner in UI
            }
        } catch (e) {
            console.error("Scan error", e);
            setState(prev => ({ ...prev, connectionStatus: 'failed' }));
        }
    }, [checkIp, toast]);

    // Initial scan on mount
    useEffect(() => {
        scanNetwork();
    }, [scanNetwork]);

    const validateIp = (ip: string) => {
        const regex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
        return regex.test(ip);
    };

    const setManualIp = (ip: string) => {
        if (validateIp(ip)) {
            localStorage.setItem('IP_CELULAR', ip);

            // Update state immediately to "connected" to unlock UI (Optimistic)
            setState({
                activeIp: ip,
                connectionStatus: 'connected',
                lastChecked: new Date()
            });

            // Verification in background
            checkIp(ip).then(isAlive => {
                if (isAlive) {
                    toast({
                        title: "IP Configurado",
                        description: `Conectado ao IP: ${ip}`,
                    });
                } else {
                    toast({
                        title: "Aviso",
                        description: "IP salvo, mas o dispositivo não respondeu ao teste. Verifique se o app está aberto.",
                        variant: "default"
                    });
                }
            });
            return true;
        } else {
            toast({
                title: "IP Inválido",
                description: "Formato de IP incorreto.",
                variant: "destructive"
            });
        }
        return false;
    };

    return {
        ...state,
        scanNetwork,
        setManualIp
    };
}
