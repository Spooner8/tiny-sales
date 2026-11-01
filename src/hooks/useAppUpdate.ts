import { useMutation, useQuery } from "@tanstack/react-query";
import { getVersion } from "@tauri-apps/api/app";
import { relaunch } from "@tauri-apps/plugin-process";
import { check } from "@tauri-apps/plugin-updater";
import type { Update } from "@tauri-apps/plugin-updater";
import { useState } from "react";

import { toError } from "../lib/api/client";

export const APP_UPDATE_KEY = ["app", "update"] as const;

/**
 * The updater's error when no endpoint has a release manifest, e.g. while
 * nothing is published yet (drafts are invisible): simply no update.
 */
const NO_RELEASE_PUBLISHED = "Could not fetch a valid release JSON from the remote";

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
    queryFn: async () => {
      try {
        return await check();
      } catch (err) {
        const error = toError(err);
        if (error.message === NO_RELEASE_PUBLISHED) return null;
        throw error;
      }
    },
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
      try {
        await update.downloadAndInstall((event) => {
          if (event.event === "Started") {
            total = event.data.contentLength ?? 0;
          } else if (event.event === "Progress" && total > 0) {
            downloaded += event.data.chunkLength;
            setProgress(Math.min(100, Math.round((downloaded / total) * 100)));
          }
        });
        await relaunch();
      } catch (err) {
        throw toError(err);
      }
    },
  });

  return { ...mutation, progress };
}
