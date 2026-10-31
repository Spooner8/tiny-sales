import { useQuery } from "@tanstack/react-query";

import { saleApi } from "../lib/api/sale";

export function useRevenueByDay(from: string, to: string) {
  return useQuery({
    queryKey: ["statistics", "byDay", from, to],
    queryFn: () => saleApi.revenueByDay(from, to),
  });
}

export function useRevenueByProductGroup(from: string, to: string) {
  return useQuery({
    queryKey: ["statistics", "byProductGroup", from, to],
    queryFn: () => saleApi.revenueByProductGroup(from, to),
  });
}

export function useRevenueByArticle(from: string, to: string) {
  return useQuery({
    queryKey: ["statistics", "byArticle", from, to],
    queryFn: () => saleApi.revenueByArticle(from, to),
  });
}
