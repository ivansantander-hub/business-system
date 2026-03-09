"use client";

import { useRef, useCallback, useEffect } from "react";

type AlertType = "notification" | "message";

const SOUND_URLS: Record<AlertType, string> = {
  notification: "/sounds/notification.wav",
  message: "/sounds/message.wav",
};

let swRegistration: ServiceWorkerRegistration | null = null;
let permissionRequested = false;

async function initServiceWorker() {
  if (globalThis.window === undefined || !("serviceWorker" in navigator)) return;

  try {
    swRegistration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;
  } catch {
    swRegistration = null;
  }
}

function requestPermissionOnce() {
  if (globalThis.window === undefined || !("Notification" in globalThis)) return;
  if (permissionRequested) return;
  permissionRequested = true;

  if (Notification.permission === "default") {
    Notification.requestPermission().catch(() => {});
  }
}

export function useNotificationAlerts() {
  const audioCache = useRef<Map<string, HTMLAudioElement>>(new Map());
  const prevNotifCount = useRef<number | null>(null);
  const prevMsgCount = useRef<number | null>(null);

  useEffect(() => {
    requestPermissionOnce();
    initServiceWorker();
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

  const showNotification = useCallback((title: string, body: string, tag: AlertType) => {
    if (Notification.permission !== "granted") return;

    if (swRegistration?.active) {
      swRegistration.active.postMessage({ type: "SHOW_NOTIFICATION", title, body, tag });
      return;
    }

    try {
      const n = new Notification(title, {
        body,
        icon: "/icon-192x192.png",
        tag,
        silent: true,
      });
      setTimeout(() => n.close(), 6000);
    } catch {
      // Fallback failed
    }
  }, []);

  const checkNotifications = useCallback(
    (newCount: number) => {
      if (prevNotifCount.current !== null && newCount > prevNotifCount.current) {
        const diff = newCount - prevNotifCount.current;
        playSound("notification");
        showNotification(
          "Nueva notificación",
          diff === 1
            ? "Tienes una nueva notificación"
            : `Tienes ${diff} nuevas notificaciones`,
          "notification"
        );
      }
      prevNotifCount.current = newCount;
    },
    [playSound, showNotification]
  );

  const checkMessages = useCallback(
    (newCount: number) => {
      if (prevMsgCount.current !== null && newCount > prevMsgCount.current) {
        const diff = newCount - prevMsgCount.current;
        playSound("message");
        showNotification(
          "Nuevo mensaje",
          diff === 1
            ? "Tienes un nuevo mensaje"
            : `Tienes ${diff} nuevos mensajes`,
          "message"
        );
      }
      prevMsgCount.current = newCount;
    },
    [playSound, showNotification]
  );

  return { checkNotifications, checkMessages };
}
