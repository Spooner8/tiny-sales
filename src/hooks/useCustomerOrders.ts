import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { customerOrderApi } from "../lib/api/customerOrder";
import type { CompleteCustomerOrder, OrderStatus, SaveCustomerOrder } from "../types/customerOrder";

const CUSTOMER_ORDERS_KEY = ["customerOrders"] as const;

export function useCustomerOrdersQuery() {
  return useQuery({ queryKey: CUSTOMER_ORDERS_KEY, queryFn: customerOrderApi.list });
}

export function useCustomerOrderQuery(id: number | null) {
  return useQuery({
    queryKey: [...CUSTOMER_ORDERS_KEY, id],
    queryFn: () => customerOrderApi.get(id as number),
    enabled: id !== null,
  });
}

export function useSaveCustomerOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveCustomerOrder) => customerOrderApi.save(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CUSTOMER_ORDERS_KEY }),
  });
}

export function useSetCustomerOrderStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: OrderStatus }) => customerOrderApi.setStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CUSTOMER_ORDERS_KEY }),
  });
}

export function useDeleteCustomerOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => customerOrderApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CUSTOMER_ORDERS_KEY }),
  });
}

export function useCompleteCustomerOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CompleteCustomerOrder) => customerOrderApi.complete(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CUSTOMER_ORDERS_KEY });
      queryClient.invalidateQueries({ queryKey: ["articles"] });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
    },
  });
}
