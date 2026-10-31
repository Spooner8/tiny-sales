import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { productSubgroupApi } from "../lib/api/productSubgroup";
import type { NewProductSubgroup, UpdateProductSubgroup } from "../types/productSubgroup";

const PRODUCT_SUBGROUPS_KEY = ["productSubgroups"] as const;

export function useProductSubgroupsQuery() {
  return useQuery({ queryKey: PRODUCT_SUBGROUPS_KEY, queryFn: productSubgroupApi.list });
}

export function useCreateProductSubgroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: NewProductSubgroup) => productSubgroupApi.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PRODUCT_SUBGROUPS_KEY }),
  });
}

export function useUpdateProductSubgroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateProductSubgroup) => productSubgroupApi.update(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PRODUCT_SUBGROUPS_KEY }),
  });
}

export function useDeactivateProductSubgroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => productSubgroupApi.deactivate(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PRODUCT_SUBGROUPS_KEY }),
  });
}
