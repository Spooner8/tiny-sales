import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { invoiceApi } from "../lib/api/invoice";

const INVOICE_KEY = "invoice";

export function useInvoiceQuery(id: number) {
  return useQuery({ queryKey: [INVOICE_KEY, id], queryFn: () => invoiceApi.get(id) });
}

export function useStoreInvoicePdf() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => invoiceApi.storePdf(id),
    onSuccess: (_result, id) => queryClient.invalidateQueries({ queryKey: [INVOICE_KEY, id] }),
  });
}

export function useSetInvoicePaidOn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, paidOn }: { id: number; paidOn: string | null }) => invoiceApi.setPaidOn(id, paidOn),
    onSuccess: (_result, { id }) => {
      queryClient.invalidateQueries({ queryKey: [INVOICE_KEY, id] });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["sale"] });
    },
  });
}
