import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { EMPTY_SALE_DISCOUNT } from "../lib/money/discount";
import {
  deleteOpenSale,
  getOpenSaleSyncError,
  loadOpenSales,
  newOpenSaleId,
  nextOpenSaleNumber,
  persistOpenSale,
  subscribeOpenSaleSyncError,
} from "../lib/openSales";
import type { OpenSale } from "../types/openSale";

export const OPEN_SALES_KEY = ["openSales"] as const;

/**
 * The cache is the working copy of all open sales (see lib/openSales): it is
 * loaded once and then only changed locally and written through, so it is
 * never refetched behind the cashier's back.
 */
export function useOpenSalesQuery() {
  return useQuery({
    queryKey: OPEN_SALES_KEY,
    queryFn: loadOpenSales,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

export function useOpenSaleActions() {
  const queryClient = useQueryClient();

  return useMemo(() => {
    const getAll = () => queryClient.getQueryData<OpenSale[]>(OPEN_SALES_KEY) ?? [];

    function create(): OpenSale {
      const sales = getAll();
      const now = new Date().toISOString();
      const sale: OpenSale = {
        id: newOpenSaleId(),
        number: nextOpenSaleNumber(sales),
        label: null,
        discount: EMPTY_SALE_DISCOUNT,
        pickupNumber: "",
        createdAt: now,
        updatedAt: now,
        items: [],
      };
      queryClient.setQueryData<OpenSale[]>(OPEN_SALES_KEY, [...sales, sale].sort((a, b) => a.number - b.number));
      persistOpenSale(sale);
      return sale;
    }

    function update(id: string, change: (sale: OpenSale) => OpenSale) {
      let updated: OpenSale | undefined;
      queryClient.setQueryData<OpenSale[]>(OPEN_SALES_KEY, (prev) =>
        prev?.map((sale) => {
          if (sale.id !== id) return sale;
          updated = { ...change(sale), updatedAt: new Date().toISOString() };
          return updated;
        }),
      );
      if (updated) persistOpenSale(updated);
    }

    function remove(id: string) {
      queryClient.setQueryData<OpenSale[]>(OPEN_SALES_KEY, (prev) => prev?.filter((sale) => sale.id !== id));
      deleteOpenSale(id);
    }

    return { getAll, create, update, remove };
  }, [queryClient]);
}

/** Last failed write; the cache is then reloaded from the database. */
export function useOpenSaleSyncError(): string | null {
  const queryClient = useQueryClient();
  const error = useSyncExternalStore(subscribeOpenSaleSyncError, getOpenSaleSyncError);

  useEffect(() => {
    if (error) queryClient.invalidateQueries({ queryKey: OPEN_SALES_KEY });
  }, [error, queryClient]);

  return error?.message ?? null;
}

// Kept outside React so the selected tab survives leaving the checkout page.
let rememberedActiveId: string | null = null;

export function getRememberedOpenSaleId(): string | null {
  return rememberedActiveId;
}

export function useActiveOpenSaleId(): [string | null, (id: string | null) => void] {
  const [activeId, setActiveIdState] = useState<string | null>(rememberedActiveId);
  const setActiveId = (id: string | null) => {
    rememberedActiveId = id;
    setActiveIdState(id);
  };
  return [activeId, setActiveId];
}
