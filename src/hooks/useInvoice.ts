import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { invoiceApi } from "../lib/api/invoice";

const INVOICE_KEY = "invoice";
const REMINDER_KEY = "invoiceReminder";
export const INVOICES_KEY = ["invoices"] as const;

export function useInvoicesQuery() {
  return useQuery({ queryKey: INVOICES_KEY, queryFn: invoiceApi.list });
}

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
      queryClient.invalidateQueries({ queryKey: INVOICES_KEY });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["sale"] });
      // A paid invoice can finish its order.
      queryClient.invalidateQueries({ queryKey: ["customerOrders"] });
    },
  });
}

export function useCreateInvoiceReminder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (invoiceId: number) => invoiceApi.createReminder(invoiceId),
    onSuccess: (_result, invoiceId) => {
      queryClient.invalidateQueries({ queryKey: [INVOICE_KEY, invoiceId] });
      queryClient.invalidateQueries({ queryKey: INVOICES_KEY });
    },
  });
}

export function useInvoiceReminderQuery(id: number) {
  return useQuery({ queryKey: [REMINDER_KEY, id], queryFn: () => invoiceApi.getReminder(id) });
}

export function useStoreInvoiceReminderPdf() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => invoiceApi.storeReminderPdf(id),
    onSuccess: (_result, id) => {
      queryClient.invalidateQueries({ queryKey: [REMINDER_KEY, id] });
      queryClient.invalidateQueries({ queryKey: [INVOICE_KEY] });
    },
  });
}
