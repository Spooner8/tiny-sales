import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { companyProfileApi } from "../lib/api/companyProfile";
import type { CompanyProfile } from "../types/companyProfile";

const COMPANY_PROFILE_KEY = ["companyProfile"] as const;

export function useCompanyProfileQuery() {
  return useQuery({ queryKey: COMPANY_PROFILE_KEY, queryFn: companyProfileApi.get });
}

export function useSaveCompanyProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CompanyProfile) => companyProfileApi.save(input),
    onSuccess: (profile) => queryClient.setQueryData(COMPANY_PROFILE_KEY, profile),
  });
}
