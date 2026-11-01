import { invokeCommand } from "./client";
import type {
  CompleteCustomerOrder,
  CompletedCustomerOrder,
  CustomerOrder,
  OrderStatus,
  SaveCustomerOrder,
} from "../../types/customerOrder";

export const customerOrderApi = {
  list: () => invokeCommand<CustomerOrder[]>("list_customer_orders"),
  get: (id: number) => invokeCommand<CustomerOrder>("get_customer_order", { id }),
  save: (input: SaveCustomerOrder) => invokeCommand<CustomerOrder>("save_customer_order", { input }),
  setStatus: (id: number, status: OrderStatus) =>
    invokeCommand<CustomerOrder>("set_customer_order_status", { id, status }),
  delete: (id: number) => invokeCommand<void>("delete_customer_order", { id }),
  complete: (input: CompleteCustomerOrder) =>
    invokeCommand<CompletedCustomerOrder>("complete_customer_order", { input }),
};
