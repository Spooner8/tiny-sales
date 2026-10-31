import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { labelTemplateApi } from "../lib/api/labelTemplate";
import type { NewLabelTemplate, UpdateLabelTemplate } from "../types/labelTemplate";

const LABEL_TEMPLATES_KEY = ["labelTemplates"] as const;

export function useLabelTemplatesQuery() {
  return useQuery({ queryKey: LABEL_TEMPLATES_KEY, queryFn: labelTemplateApi.list });
}

export function useCreateLabelTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: NewLabelTemplate) => labelTemplateApi.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: LABEL_TEMPLATES_KEY }),
  });
}

export function useUpdateLabelTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateLabelTemplate) => labelTemplateApi.update(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: LABEL_TEMPLATES_KEY }),
  });
}

export function useDeactivateLabelTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => labelTemplateApi.deactivate(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: LABEL_TEMPLATES_KEY }),
  });
}
