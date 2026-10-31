import { invokeCommand } from "./client";
import type { OpenSale, SaveOpenSale } from "../../types/openSale";

export const openSaleApi = {
  list: () => invokeCommand<OpenSale[]>("list_open_sales"),
  save: (input: SaveOpenSale) => invokeCommand<void>("save_open_sale", { input }),
  delete: (id: string) => invokeCommand<void>("delete_open_sale", { id }),
};
