
import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'system';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  leadId?: string;
  actioned?: boolean;
}

interface NotificationsContextType {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAsActioned: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  removeNotification: (id: string) => void;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  subscribeToPush: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  // Inicializar com notificações salvas no localStorage
  const [notifications, setNotifications] = useState<Notification[]>(() => {
    try {
      const saved = localStorage.getItem('user_notifications');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Only keep notifications from the last 7 days to avoid unbounded growth
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const filtered = parsed.filter((n: any) => new Date(n.timestamp) > sevenDaysAgo);

        // Update localStorage with filtered list if any were removed
        if (filtered.length !== parsed.length) {
           setTimeout(() => localStorage.setItem('user_notifications', JSON.stringify(filtered)), 0);
        }

        // Rehydrating Date objects
        return filtered.map((n: any) => ({
          ...n,
          timestamp: new Date(n.timestamp)
        }));
      }
    } catch (e) {
      console.error("Failed to load notifications", e);
    }
    return [];
  });

  // Request Notification Permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Salvar no localStorage sempre que mudar
  useEffect(() => {
    localStorage.setItem('user_notifications', JSON.stringify(notifications));
  }, [notifications]);

  // Sync across tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'user_notifications' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          setNotifications(parsed.map((n: any) => ({
            ...n,
            timestamp: new Date(n.timestamp)
          })));
        } catch (err) {
          console.error("Error syncing notifications:", err);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(notification =>
        notification.id === id
          ? { ...notification, read: true }
          : notification
      )
    );
  };

  const markAsActioned = (id: string) => {
    setNotifications(prev =>
      prev.map(notification =>
        notification.id === id
          ? { ...notification, actioned: true }
          : notification
      )
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev =>
      prev.map(notification => ({ ...notification, read: true }))
    );
  };

  const clearAll = () => {
    setNotifications([]);
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  };

  const addNotification = React.useCallback((notificationData: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: Notification = {
      ...notificationData,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
      read: false,
      actioned: false
    };

    setNotifications(prev => [newNotification, ...prev]);

    // Trigger System Notification (Mobile/Desktop)
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        // Use service worker registration if available for better mobile support
        if (navigator.serviceWorker && navigator.serviceWorker.ready) {
          navigator.serviceWorker.ready.then(registration => {
            registration.showNotification(newNotification.title, {
              body: newNotification.message,
              icon: '/icons/icon-192x192.png',
              badge: '/icons/icon-192x192.png',
              tag: newNotification.id, // Prevent duplicates
              data: { url: '/' } // Can be used to handle click
            });
          });
        } else {
          // Fallback to standard API
          const n = new Notification(newNotification.title, {
            body: newNotification.message,
            icon: '/icons/icon-192x192.png',
          });
        }
      } catch (err) {
        console.error("Failed to show system notification", err);
      }
    }
  }, []);

  // --- NEW: PUSH SUBSCRIPTION LOGIC ---
  const VAPID_PUBLIC_KEY = 'BK92_w8EsZQ_6sJApDMTLotu-iToHzgjcuVttmgl0AVprNy2eMxiAdyXf-ZgyvmJ40DMM3SHvbqDtVIOwo3IIFc';

  const subscribeToPush = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    try {
      const registration = await navigator.serviceWorker.ready;

      // Check existing subscription
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: VAPID_PUBLIC_KEY
        });
      }

      // Save to Supabase
      const { data: { user } } = await supabase.auth.getUser();

      if (user && subscription) {
        const { error } = await supabase
          .from('user_push_subscriptions')
          .upsert({
            user_id: user.id,
            subscription: subscription.toJSON()
          }, { onConflict: 'user_id,subscription' });

        if (error) console.error("Error saving push subscription:", error);
      }

    } catch (error) {
      console.error("Push subscription failed:", error);
    }
  };

  // Auto-subscribe on load if logged in
  useEffect(() => {
    if (Notification.permission === 'default') {
      // Wait for user interaction usually, but let's try or wait for explicit 'enable'
    } else if (Notification.permission === 'granted') {
      subscribeToPush();
    }
  }, []);

  const value = {
    notifications,
    unreadCount,
    markAsRead,
    markAsActioned,
    markAllAsRead,
    clearAll,
    removeNotification,
    addNotification,
    subscribeToPush // Expose this if we want a manual button
  };

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationsProvider');
  }
  return context;
}
