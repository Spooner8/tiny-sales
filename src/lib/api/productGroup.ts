import { invokeCommand } from "./client";
import type { NewProductGroup, ProductGroup, UpdateProductGroup } from "../../types/productGroup";

export const productGroupApi = {
  list: () => invokeCommand<ProductGroup[]>("list_product_groups"),
  create: (input: NewProductGroup) => invokeCommand<ProductGroup>("create_product_group", { input }),
  update: (input: UpdateProductGroup) => invokeCommand<ProductGroup>("update_product_group", { input }),
  deactivate: (id: number) => invokeCommand<void>("deactivate_product_group", { id }),
};
