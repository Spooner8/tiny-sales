import { invokeCommand } from "./client";
import type {
  ArticleRevenue,
  DailyRevenue,
  NewSale,
  NewSaleReturn,
  ProductGroupRevenue,
  SaleListEntry,
  SaleReturnWithItems,
  SaleWithItems,
} from "../../types/sale";

export const saleApi = {
  create: (input: NewSale) => invokeCommand<SaleWithItems>("create_sale", { input }),
  list: (from: string, to: string) => invokeCommand<SaleListEntry[]>("list_sales", { from, to }),
  get: (id: number) => invokeCommand<SaleWithItems>("get_sale", { id }),
  createReturn: (input: NewSaleReturn) => invokeCommand<SaleReturnWithItems>("create_sale_return", { input }),
  listReturns: (saleId: number) => invokeCommand<SaleReturnWithItems[]>("list_sale_returns", { saleId }),
  revenueByDay: (from: string, to: string) =>
    invokeCommand<DailyRevenue[]>("get_revenue_by_day", { from, to }),
  revenueByProductGroup: (from: string, to: string) =>
    invokeCommand<ProductGroupRevenue[]>("get_revenue_by_product_group", { from, to }),
  revenueByArticle: (from: string, to: string) =>
    invokeCommand<ArticleRevenue[]>("get_revenue_by_article", { from, to }),
};
