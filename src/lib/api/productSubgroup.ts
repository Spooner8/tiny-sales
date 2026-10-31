import { invokeCommand } from "./client";
import type { NewProductSubgroup, ProductSubgroup, UpdateProductSubgroup } from "../../types/productSubgroup";

export const productSubgroupApi = {
  list: () => invokeCommand<ProductSubgroup[]>("list_product_subgroups"),
  create: (input: NewProductSubgroup) => invokeCommand<ProductSubgroup>("create_product_subgroup", { input }),
  update: (input: UpdateProductSubgroup) => invokeCommand<ProductSubgroup>("update_product_subgroup", { input }),
  deactivate: (id: number) => invokeCommand<void>("deactivate_product_subgroup", { id }),
};
