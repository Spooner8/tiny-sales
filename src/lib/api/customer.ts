import { invokeCommand } from "./client";
import type { Customer, NewCustomer, UpdateCustomer } from "../../types/customer";

export const customerApi = {
  list: () => invokeCommand<Customer[]>("list_customers"),
  create: (input: NewCustomer) => invokeCommand<Customer>("create_customer", { input }),
  update: (input: UpdateCustomer) => invokeCommand<Customer>("update_customer", { input }),
  deactivate: (id: number) => invokeCommand<void>("deactivate_customer", { id }),
};
