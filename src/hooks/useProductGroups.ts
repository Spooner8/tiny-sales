import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { productGroupApi } from "../lib/api/productGroup";
import type { NewProductGroup, UpdateProductGroup } from "../types/productGroup";

const PRODUCT_GROUPS_KEY = ["productGroups"] as const;

export function useProductGroupsQuery() {
  return useQuery({ queryKey: PRODUCT_GROUPS_KEY, queryFn: productGroupApi.list });
}

export function useCreateProductGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: NewProductGroup) => productGroupApi.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PRODUCT_GROUPS_KEY }),
  });
}

export function useUpdateProductGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateProductGroup) => productGroupApi.update(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PRODUCT_GROUPS_KEY }),
  });
}

export function useDeactivateProductGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => productGroupApi.deactivate(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PRODUCT_GROUPS_KEY }),
  });
}
