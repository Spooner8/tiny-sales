import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { settingsApi } from "../lib/api/settings";
import type { ReceiptPaperSize } from "../types/settings";

export function useDbPathQuery() {
  return useQuery({ queryKey: ["settings", "dbPath"], queryFn: settingsApi.getDbPath });
}

/** Why the database couldn't be opened at startup; `null` while one is open. */
export function useDatabaseErrorQuery() {
  return useQuery({ queryKey: ["database", "error"], queryFn: settingsApi.getDatabaseError });
}

export function useRetryDatabase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => settingsApi.retryDatabase(),
    onSuccess: () => queryClient.invalidateQueries(),
  });
}

// Switching the database makes every cached query stale, not just the path.
export function useOpenDatabase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (path: string) => settingsApi.openDatabase(path),
    onSuccess: () => queryClient.invalidateQueries(),
  });
}

export function useCreateDatabase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (path: string) => settingsApi.createDatabase(path),
    onSuccess: () => queryClient.invalidateQueries(),
  });
}

export function useBackupDatabase() {
  return useMutation({
    mutationFn: (destination: string) => settingsApi.backupDatabase(destination),
  });
}

export function useRestoreDatabase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (source: string) => settingsApi.restoreDatabase(source),
    onSuccess: () => queryClient.invalidateQueries(),
  });
}

export function useTestModeQuery() {
  return useQuery({ queryKey: ["settings", "testMode"], queryFn: settingsApi.getTestMode });
}

export function useSetTestMode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (enabled: boolean) => settingsApi.setTestMode(enabled),
    // A different database is attached now: every cached query is stale.
    onSuccess: () => queryClient.invalidateQueries(),
  });
}

export function useReceiptPaperSizeQuery() {
  return useQuery({
    queryKey: ["settings", "receiptPaperSize"],
    queryFn: settingsApi.getReceiptPaperSize,
  });
}

export function useSetReceiptPaperSize() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (size: ReceiptPaperSize) => settingsApi.setReceiptPaperSize(size),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings", "receiptPaperSize"] }),
  });
}
