import { useMutation, useQuery } from "@tanstack/react-query";
import { getVersion } from "@tauri-apps/api/app";
import { relaunch } from "@tauri-apps/plugin-process";
import { check } from "@tauri-apps/plugin-updater";
import type { Update } from "@tauri-apps/plugin-updater";
import { useState } from "react";

export const APP_UPDATE_KEY = ["app", "update"] as const;

export function useAppVersionQuery() {
  return useQuery({ queryKey: ["app", "version"], queryFn: getVersion, staleTime: Infinity });
}

/**
 * Asks GitHub for a newer release once per start; `null` means up to date.
 * Without internet the check simply fails - the shop keeps working offline.
 */
export function useUpdateCheckQuery() {
  return useQuery({
    queryKey: APP_UPDATE_KEY,
    queryFn: () => check(),
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

/**
 * Downloads and installs an update, then restarts the app. On Windows the
 * installer closes the app itself and starts the new version afterwards.
 * `progress` is the downloaded share in percent, if the size is known.
 */
export function useInstallUpdate() {
  const [progress, setProgress] = useState<number | null>(null);

  const mutation = useMutation({
    mutationFn: async (update: Update) => {
      let total = 0;
      let downloaded = 0;
      setProgress(null);
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") {
          total = event.data.contentLength ?? 0;
        } else if (event.event === "Progress" && total > 0) {
          downloaded += event.data.chunkLength;
          setProgress(Math.min(100, Math.round((downloaded / total) * 100)));
        }
      });
      await relaunch();
    },
  });

  return { ...mutation, progress };
}
