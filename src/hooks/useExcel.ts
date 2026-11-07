import { useMutation, useQueryClient } from "@tanstack/react-query";

import { excelApi } from "../lib/api/excel";
import type { ExcelKind } from "../types/excel";

export function useExcelExchange(kind: ExcelKind) {
  const queryClient = useQueryClient();
  return {
    exportFile: useMutation({ mutationFn: (path: string) => excelApi.exportFile(kind, path) }),
    previewFile: useMutation({ mutationFn: (path: string) => excelApi.previewImport(kind, path) }),
    applyFile: useMutation({
      mutationFn: (path: string) => excelApi.applyImport(kind, path),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [kind] });
        // Orders and invoices show article and customer names.
        queryClient.invalidateQueries({ queryKey: ["customerOrders"] });
        queryClient.invalidateQueries({ queryKey: ["invoices"] });
      },
    }),
  };
}
