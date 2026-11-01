import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { customerApi } from "../lib/api/customer";
import type { NewCustomer, UpdateCustomer } from "../types/customer";

const CUSTOMERS_KEY = ["customers"] as const;

export function useCustomersQuery() {
  return useQuery({ queryKey: CUSTOMERS_KEY, queryFn: customerApi.list });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: NewCustomer) => customerApi.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CUSTOMERS_KEY }),
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateCustomer) => customerApi.update(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CUSTOMERS_KEY });
      // Orders show the customer's name.
      queryClient.invalidateQueries({ queryKey: ["customerOrders"] });
    },
  });
}

export function useDeactivateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => customerApi.deactivate(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CUSTOMERS_KEY }),
  });
}
