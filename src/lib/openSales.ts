import { openSaleApi } from "./api/openSale";
import type { OpenSale, SaveOpenSale } from "../types/openSale";

// The checkout changes open sales in the query cache right away (every scan
// must show at once) and persists them in the background. All database
// writes for open sales - and completing one - go through this serial queue,
// so a slower earlier save can never overwrite a later one or bring back a
// sale that was completed or cancelled in between.

let queueTail: Promise<unknown> = Promise.resolve();

/** Runs `task` after everything queued before it. */
export function enqueueOpenSaleTask<T>(task: () => Promise<T>): Promise<T> {
  const result = queueTail.then(task);
  queueTail = result.catch(() => undefined);
  return result;
}

/** Latest snapshot per open sale whose save is queued but hasn't run yet. */
const pendingSaves = new Map<string, SaveOpenSale>();

export interface OpenSaleSyncError {
  message: string;
}

let syncError: OpenSaleSyncError | null = null;
const syncErrorListeners = new Set<() => void>();

function setSyncError(error: OpenSaleSyncError | null) {
  if (error === null && syncError === null) return;
  syncError = error;
  syncErrorListeners.forEach((listener) => listener());
}

function reportFailure(err: unknown) {
  setSyncError({ message: err instanceof Error ? err.message : String(err) });
}

export function subscribeOpenSaleSyncError(listener: () => void): () => void {
  syncErrorListeners.add(listener);
  return () => syncErrorListeners.delete(listener);
}

export function getOpenSaleSyncError(): OpenSaleSyncError | null {
  return syncError;
}

/** Persists the open sale; rapid changes are coalesced into one write. */
export function persistOpenSale(sale: OpenSale) {
  const alreadyQueued = pendingSaves.has(sale.id);
  pendingSaves.set(sale.id, toSnapshot(sale));
  if (alreadyQueued) return;
  enqueueOpenSaleTask(async () => {
    const snapshot = pendingSaves.get(sale.id);
    // Deleted after this save was queued.
    if (!snapshot) return;
    pendingSaves.delete(sale.id);
    await openSaleApi.save(snapshot);
    setSyncError(null);
  }).catch(reportFailure);
}

export function deleteOpenSale(id: string) {
  pendingSaves.delete(id);
  enqueueOpenSaleTask(() => openSaleApi.delete(id)).catch(reportFailure);
}

/** Loads the open sales once every queued write has been applied. */
export function loadOpenSales(): Promise<OpenSale[]> {
  return enqueueOpenSaleTask(() => openSaleApi.list());
}

function toSnapshot(sale: OpenSale): SaveOpenSale {
  return {
    id: sale.id,
    number: sale.number,
    label: sale.label,
    discount: sale.discount,
    pickupNumber: sale.pickupNumber,
    items: sale.items,
  };
}

/** Quantity per article id held by open sales, optionally except one. */
export function reservedQuantities(openSales: OpenSale[], exceptId?: string): Map<number, number> {
  const reserved = new Map<number, number>();
  for (const sale of openSales) {
    if (sale.id === exceptId) continue;
    for (const item of sale.items) {
      reserved.set(item.articleId, (reserved.get(item.articleId) ?? 0) + item.quantity);
    }
  }
  return reserved;
}

/** Nothing worth keeping yet: no items and no name. */
export function isBlankOpenSale(sale: OpenSale): boolean {
  return sale.items.length === 0 && !sale.label?.trim();
}

export function openSaleTitle(sale: OpenSale): string {
  return sale.label?.trim() || `Verkauf ${sale.number}`;
}

/** Smallest tab number not used by another open sale. */
export function nextOpenSaleNumber(openSales: OpenSale[]): number {
  const used = new Set(openSales.map((sale) => sale.number));
  let number = 1;
  while (used.has(number)) number++;
  return number;
}

export function newOpenSaleId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
