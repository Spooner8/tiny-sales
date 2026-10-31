import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { articleApi } from "../lib/api/article";
import type { NewArticle, UpdateArticle } from "../types/article";

const ARTICLES_KEY = ["articles"] as const;

export function useArticlesQuery() {
  return useQuery({ queryKey: ARTICLES_KEY, queryFn: articleApi.list });
}

export function useCreateArticle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: NewArticle) => articleApi.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ARTICLES_KEY }),
  });
}

export function useUpdateArticle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateArticle) => articleApi.update(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ARTICLES_KEY }),
  });
}

export function useDeactivateArticle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => articleApi.deactivate(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ARTICLES_KEY }),
  });
}
