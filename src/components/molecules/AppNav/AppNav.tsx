import { Menu as BaseMenu } from "@base-ui/react/menu";
import {
  BarChart3,
  FolderTree,
  LayoutTemplate,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  QrCode,
  Receipt,
  Settings,
  ShoppingCart,
  Tags,
} from "lucide-react";
import type { LinkProps } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { ComponentType } from "react";

import appMark from "../../../assets/app-mark.svg";
import { NavLink } from "../../atoms/NavLink";
import { useCompanyProfileQuery } from "../../../hooks/useCompanyProfile";
import { useOpenSalesQuery } from "../../../hooks/useOpenSales";

interface NavItem {
  to: LinkProps["to"];
  label: string;
  exact: boolean;
  icon: ComponentType<{ size?: number }>;
}

const PRIMARY_ITEMS: NavItem[] = [
  { to: "/", label: "Kasse", exact: true, icon: ShoppingCart },
  { to: "/articles", label: "Artikel", exact: false, icon: Package },
  { to: "/sales", label: "Verkäufe", exact: false, icon: Receipt },
  { to: "/statistics", label: "Statistik", exact: false, icon: BarChart3 },
];

const SECONDARY_ITEMS: NavItem[] = [
  { to: "/product-groups", label: "Warengruppen", exact: false, icon: FolderTree },
  { to: "/product-subgroups", label: "Warenuntergruppen", exact: false, icon: Tags },
  { to: "/labels", label: "Etiketten", exact: false, icon: QrCode },
  { to: "/label-templates", label: "Etiketten-Vorlagen", exact: false, icon: LayoutTemplate },
  { to: "/settings", label: "Einstellungen", exact: false, icon: Settings },
];

const COLLAPSE_STORAGE_KEY = "tiny-sales-nav-collapsed";

export function AppNav() {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_STORAGE_KEY) === "1");
  // Open sales with something in the cart, so they aren't forgotten while
  // working on another page.
  const { data: openSales } = useOpenSalesQuery();
  const { data: company } = useCompanyProfileQuery();
  const openSaleCount = (openSales ?? []).filter((sale) => sale.items.length > 0).length;

  useEffect(() => {
    localStorage.setItem(COLLAPSE_STORAGE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  return (
    <nav className={`app-nav ${collapsed ? "collapsed" : ""}`}>
      <div className="app-nav-brand">
        {/* Collapsed, a full logo would be unreadably small: prefer the square mark. */}
        {company?.logo ? (
          <img src={collapsed ? company.logoMark || company.logo : company.logo} alt={company.name} />
        ) : (
          // No logo entered yet (Einstellungen → Firma): the app's own mark.
          <img className="app-nav-brand-mark" src={appMark} alt="Tiny Sales" />
        )}
      </div>
      <button
        type="button"
        className="app-nav-collapse-toggle"
        onClick={() => setCollapsed((prev) => !prev)}
        title={collapsed ? "Menü ausklappen" : "Menü einklappen"}
      >
        {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
      </button>

      <div className="app-nav-items">
        {PRIMARY_ITEMS.map((item) => {
          const badge = item.to === "/" ? openSaleCount : 0;
          return (
            <NavLink key={item.to} to={item.to} activeOptions={{ exact: item.exact }}>
              <span className="app-nav-icon">
                <item.icon size={18} />
                {collapsed && badge > 0 && <span className="app-nav-dot" title={`${badge} offene Verkäufe`} />}
              </span>
              {!collapsed && <span>{item.label}</span>}
              {!collapsed && badge > 0 && (
                <span className="app-nav-badge" title={`${badge} offene Verkäufe`}>
                  {badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </div>

      <div className="app-nav-spacer" />

      <BaseMenu.Root>
        <BaseMenu.Trigger className="app-nav-gear" title="Stammdaten und Einstellungen">
          <Settings size={18} />
          {!collapsed && <span>Mehr</span>}
        </BaseMenu.Trigger>
        <BaseMenu.Portal>
          <BaseMenu.Positioner side="top" align="start" sideOffset={8}>
            <BaseMenu.Popup className="app-nav-menu-popup">
              {SECONDARY_ITEMS.map((item) => (
                <BaseMenu.Item
                  key={item.to}
                  className="app-nav-menu-item"
                  render={
                    <NavLink to={item.to} activeOptions={{ exact: item.exact }}>
                      <item.icon size={16} />
                      <span>{item.label}</span>
                    </NavLink>
                  }
                />
              ))}
            </BaseMenu.Popup>
          </BaseMenu.Positioner>
        </BaseMenu.Portal>
      </BaseMenu.Root>
    </nav>
  );
}
