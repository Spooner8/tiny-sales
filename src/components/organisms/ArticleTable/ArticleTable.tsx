import { createColumnHelper } from "@tanstack/react-table";
import type { ReactNode } from "react";

import { Badge } from "../../atoms/Badge";
import { Button } from "../../atoms/Button";
import { PriceTag } from "../../molecules/PriceTag";
import { FilterableTable } from "../FilterableTable";
import type { Article } from "../../../types/article";
import type { ProductSubgroup } from "../../../types/productSubgroup";
import type { ProductGroup } from "../../../types/productGroup";

export interface ArticleTableProps {
  articles: Article[];
  productGroups: ProductGroup[];
  productSubgroups: ProductSubgroup[];
  onEdit: (article: Article) => void;
  onDeactivate: (id: number) => void;
  /** Quantity per article id held by open sales at the checkout. */
  reserved?: Map<number, number>;
  /** Shown next to the search above the table. */
  toolbar?: ReactNode;
}

const columnHelper = createColumnHelper<Article>();

const STATUS_ACTIVE = "Aktiv";
const STATUS_INACTIVE = "Inaktiv";
const STATUS_DISCONTINUED = "Auslaufend";

export function ArticleTable({
  articles,
  productGroups,
  productSubgroups,
  onEdit,
  onDeactivate,
  reserved,
  toolbar,
}: ArticleTableProps) {
  const productGroupNameById = new Map(productGroups.map((g) => [g.id, g.name]));
  const productSubgroupNameById = new Map(productSubgroups.map((s) => [s.id, s.name]));
  const groupName = (article: Article) => productGroupNameById.get(article.productGroupId) ?? "";
  const subgroupName = (article: Article) => productSubgroupNameById.get(article.productSubgroupId) ?? "";

  const columns = [
    columnHelper.accessor("code", {
      header: "Art-Nr.",
      meta: { searchable: true, filterable: true },
    }),
    columnHelper.accessor((a) => a.patternNumber ?? "", {
      id: "patternNumber",
      header: "Muster-Nr.",
      cell: ({ getValue }) => getValue() || "–",
      meta: { searchable: true, filterable: true },
    }),
    columnHelper.accessor("name", {
      header: "Name",
      meta: { searchable: true, filterable: true, className: "col-name" },
    }),
    columnHelper.accessor(groupName, {
      id: "productGroup",
      header: "Warengruppe",
      cell: ({ getValue }) => getValue() || "–",
      meta: { searchable: true, filterable: true },
    }),
    columnHelper.accessor(subgroupName, {
      id: "productSubgroup",
      header: "Warenuntergruppe",
      cell: ({ getValue }) => getValue() || "–",
      meta: { searchable: true, filterable: true },
    }),
    columnHelper.accessor((a) => a.components.map((c) => c.name).join(", "), {
      id: "components",
      header: "Veredelungen",
      cell: ({ getValue }) => getValue() || "–",
      // Filter by each finishing on its own, not by the joined text.
      getUniqueValues: (a) => a.components.map((c) => c.name),
      meta: { searchable: true, filterable: true },
    }),
    columnHelper.display({
      id: "price",
      header: "Preis (CHF)",
      cell: ({ row }) => (
        <PriceTag
          listPriceCents={row.original.totalPriceCents}
          salePriceCents={row.original.salePriceCents}
          discountPercent={row.original.discountPercent}
          withCurrency={false}
        />
      ),
    }),
    columnHelper.accessor("stock", { header: "Bestand" }),
    columnHelper.accessor((a) => reserved?.get(a.id) ?? 0, {
      id: "reserved",
      header: "Reserviert",
      // Held by open sales at the checkout, not booked yet.
      cell: ({ getValue }) => getValue() || "–",
    }),
    columnHelper.accessor((a) => (a.active ? STATUS_ACTIVE : STATUS_INACTIVE), {
      id: "status",
      header: "Status",
      cell: ({ row }) => (
        <div className="row-actions">
          <Badge tone={row.original.active ? "success" : "neutral"}>
            {row.original.active ? STATUS_ACTIVE : STATUS_INACTIVE}
          </Badge>
          {row.original.discontinued && <Badge tone="warning">{STATUS_DISCONTINUED}</Badge>}
        </div>
      ),
      // "Auslaufend" is a flag next to active/inactive, not a third state, so
      // a discontinued article shows up under both of its values.
      getUniqueValues: (a) => [a.active ? STATUS_ACTIVE : STATUS_INACTIVE, ...(a.discontinued ? [STATUS_DISCONTINUED] : [])],
      meta: { filterable: true },
    }),
    columnHelper.display({
      id: "actions",
      header: "Aktionen",
      cell: ({ row }) => (
        <div className="row-actions">
          <Button variant="secondary" size="sm" onClick={() => onEdit(row.original)}>
            Bearbeiten
          </Button>
          {row.original.active && (
            <Button variant="danger" size="sm" onClick={() => onDeactivate(row.original.id)}>
              Deaktivieren
            </Button>
          )}
        </div>
      ),
    }),
  ];

  return (
    <FilterableTable
      data={articles}
      columns={columns}
      searchPlaceholder="Artikel suchen (Name, Art-Nr., Muster-Nr., Warengruppe...)"
      toolbar={toolbar}
    />
  );
}
