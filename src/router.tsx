import { createRootRoute, createRoute, createRouter, Outlet } from "@tanstack/react-router";

import { AppShell } from "./components/templates/AppShell";
import { useDatabaseErrorQuery } from "./hooks/useSettings";
import { ArticlePage } from "./pages/ArticlePage";
import { CheckoutPage } from "./pages/CheckoutPage";
import { CustomersPage } from "./pages/CustomersPage";
import { DatabaseErrorPage } from "./pages/DatabaseErrorPage";
import { InvoicePage } from "./pages/InvoicePage";
import { LabelsPage } from "./pages/LabelsPage";
import { LabelTemplatesPage } from "./pages/LabelTemplatesPage";
import { OrderCheckoutPage } from "./pages/OrderCheckoutPage";
import { OrderPage } from "./pages/OrderPage";
import { OrdersPage } from "./pages/OrdersPage";
import { ProductGroupsPage } from "./pages/ProductGroupsPage";
import { ProductSubgroupsPage } from "./pages/ProductSubgroupsPage";
import { SalesPage } from "./pages/SalesPage";
import { SettingsPage } from "./pages/SettingsPage";
import { StatisticsPage } from "./pages/StatisticsPage";

/**
 * Every page needs the database. If it couldn't be opened at startup, only
 * the error page is shown, until an update or another database fixes it.
 */
function RootLayout() {
  const { data: databaseError, isPending } = useDatabaseErrorQuery();
  if (isPending) return null;
  if (databaseError) {
    return (
      <div className="app-frame">
        <DatabaseErrorPage error={databaseError} />
      </div>
    );
  }
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

const rootRoute = createRootRoute({ component: RootLayout });

const checkoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: CheckoutPage,
});

const ordersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/orders",
  component: OrdersPage,
});

/** `orderId` is "new" for a new order. */
const orderRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/orders/$orderId",
  component: OrderPage,
});

const orderCheckoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/orders/$orderId/checkout",
  component: OrderCheckoutPage,
});

const invoiceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/invoices/$invoiceId",
  component: InvoicePage,
});

const customersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/customers",
  component: CustomersPage,
});

const articleRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/articles",
  component: ArticlePage,
});

const productGroupsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/product-groups",
  component: ProductGroupsPage,
});

const productSubgroupsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/product-subgroups",
  component: ProductSubgroupsPage,
});

const labelsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/labels",
  component: LabelsPage,
});

const labelTemplatesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/label-templates",
  component: LabelTemplatesPage,
});

const salesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sales",
  component: SalesPage,
});

const statisticsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/statistics",
  component: StatisticsPage,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: SettingsPage,
});

const routeTree = rootRoute.addChildren([
  checkoutRoute,
  ordersRoute,
  orderRoute,
  orderCheckoutRoute,
  invoiceRoute,
  customersRoute,
  articleRoute,
  productGroupsRoute,
  productSubgroupsRoute,
  labelsRoute,
  labelTemplatesRoute,
  salesRoute,
  statisticsRoute,
  settingsRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
