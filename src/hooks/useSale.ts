import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { saleApi } from "../lib/api/sale";
import { enqueueOpenSaleTask } from "../lib/openSales";
import type { OpenSale } from "../types/openSale";
import type { NewSale, NewSaleReturn } from "../types/sale";
import { OPEN_SALES_KEY } from "./useOpenSales";

export function useCreateSale() {
  const queryClient = useQueryClient();
  return useMutation({
    // Queued behind pending open-sale writes: completing deletes the open
    // sale, and a save landing afterwards would bring it back.
    mutationFn: (input: NewSale) => enqueueOpenSaleTask(() => saleApi.create(input)),
    onSuccess: (_sale, input) => {
      if (input.openSaleId) {
        queryClient.setQueryData<OpenSale[]>(OPEN_SALES_KEY, (prev) =>
          prev?.filter((sale) => sale.id !== input.openSaleId),
        );
      }
      queryClient.invalidateQueries({ queryKey: ["articles"] });
    },
  });
}

export function useSalesQuery(from: string, to: string) {
  return useQuery({ queryKey: ["sales", from, to], queryFn: () => saleApi.list(from, to) });
}

export function useSaleQuery(id: number | null) {
  return useQuery({
    queryKey: ["sale", id],
    queryFn: () => saleApi.get(id as number),
    enabled: id !== null,
  });
}

export function useSetSaleCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, customerId }: { id: number; customerId: number | null }) => saleApi.setCustomer(id, customerId),
    onSuccess: (_sale, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["sale", id] });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
    },
  });
}

export function useSaleReturnsQuery(saleId: number | null) {
  return useQuery({
    queryKey: ["saleReturns", saleId],
    queryFn: () => saleApi.listReturns(saleId as number),
    enabled: saleId !== null,
  });
}

export function useCreateSaleReturn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: NewSaleReturn) => saleApi.createReturn(input),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["saleReturns", variables.saleId] });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["articles"] });
      // A return lowers what an invoice is owed and can finish its order.
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoice"] });
      queryClient.invalidateQueries({ queryKey: ["customerOrders"] });
    },
  });
}
