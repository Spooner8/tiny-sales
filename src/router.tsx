import { createRootRoute, createRoute, createRouter, Outlet } from "@tanstack/react-router";

import { AppShell } from "./components/templates/AppShell";
import { ArticlePage } from "./pages/ArticlePage";
import { CheckoutPage } from "./pages/CheckoutPage";
import { LabelsPage } from "./pages/LabelsPage";
import { LabelTemplatesPage } from "./pages/LabelTemplatesPage";
import { ProductGroupsPage } from "./pages/ProductGroupsPage";
import { ProductSubgroupsPage } from "./pages/ProductSubgroupsPage";
import { SalesPage } from "./pages/SalesPage";
import { SettingsPage } from "./pages/SettingsPage";
import { StatisticsPage } from "./pages/StatisticsPage";

const rootRoute = createRootRoute({
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});

const checkoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: CheckoutPage,
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
