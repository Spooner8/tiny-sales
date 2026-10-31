import { invokeCommand } from "./client";
import type { ReceiptPaperSize } from "../../types/settings";

export const settingsApi = {
  getDbPath: () => invokeCommand<string>("get_db_path"),
  openDatabase: (path: string) => invokeCommand<void>("open_database", { path }),
  createDatabase: (path: string) => invokeCommand<void>("create_database", { path }),
  backupDatabase: (destination: string) => invokeCommand<void>("backup_database", { destination }),
  restoreDatabase: (source: string) => invokeCommand<string>("restore_database", { source }),
  getTestMode: () => invokeCommand<boolean>("get_test_mode"),
  setTestMode: (enabled: boolean) => invokeCommand<void>("set_test_mode", { enabled }),
  getReceiptPaperSize: () => invokeCommand<ReceiptPaperSize>("get_receipt_paper_size"),
  setReceiptPaperSize: (size: ReceiptPaperSize) => invokeCommand<void>("set_receipt_paper_size", { size }),
};
