"use client";

import { useRef, useCallback, useEffect } from "react";

type AlertType = "notification" | "message";

const SOUND_URLS: Record<AlertType, string> = {
  notification: "/sounds/notification.wav",
  message: "/sounds/message.wav",
};

let permissionState: NotificationPermission | "unsupported" = "unsupported";

function requestPermissionOnce() {
  if (typeof globalThis.window === "undefined" || !("Notification" in globalThis)) return;
  if (Notification.permission === "granted" || Notification.permission === "denied") {
    permissionState = Notification.permission;
    return;
  }
  Notification.requestPermission().then((perm) => {
    permissionState = perm;
  });
}

export function useNotificationAlerts() {
  const audioCache = useRef<Map<string, HTMLAudioElement>>(new Map());
  const prevNotifCount = useRef<number | null>(null);
  const prevMsgCount = useRef<number | null>(null);

  useEffect(() => {
    requestPermissionOnce();
  }, []);

  const playSound = useCallback((type: AlertType) => {
    try {
      let audio = audioCache.current.get(type);
      if (!audio) {
        audio = new Audio(SOUND_URLS[type]);
        audio.volume = type === "notification" ? 0.5 : 0.4;
        audioCache.current.set(type, audio);
      }
      audio.currentTime = 0;
      audio.play().catch(() => {});
    } catch {
      // Audio not available
    }
  }, []);

  const showBrowserNotification = useCallback((title: string, body: string, type: AlertType) => {
    if (permissionState !== "granted") return;
    try {
      const n = new Notification(title, {
        body,
        icon: "/icon-192x192.png",
        tag: type,
        silent: true,
      });
      setTimeout(() => n.close(), 6000);
    } catch {
      // Notification not available
    }
  }, []);

  const checkNotifications = useCallback(
    (newCount: number) => {
      if (prevNotifCount.current !== null && newCount > prevNotifCount.current) {
        const diff = newCount - prevNotifCount.current;
        playSound("notification");
        showBrowserNotification(
          "Nueva notificación",
          diff === 1
            ? "Tienes una nueva notificación"
            : `Tienes ${diff} nuevas notificaciones`,
          "notification"
        );
      }
      prevNotifCount.current = newCount;
    },
    [playSound, showBrowserNotification]
  );

  const checkMessages = useCallback(
    (newCount: number) => {
      if (prevMsgCount.current !== null && newCount > prevMsgCount.current) {
        const diff = newCount - prevMsgCount.current;
        playSound("message");
        showBrowserNotification(
          "Nuevo mensaje",
          diff === 1
            ? "Tienes un nuevo mensaje"
            : `Tienes ${diff} nuevos mensajes`,
          "message"
        );
      }
      prevMsgCount.current = newCount;
    },
    [playSound, showBrowserNotification]
  );

  return { checkNotifications, checkMessages };
}
