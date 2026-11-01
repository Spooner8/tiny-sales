import { useState } from "react";

import { Button } from "../components/atoms/Button";
import { Modal } from "../components/molecules/Modal";
import { PageHeader } from "../components/molecules/PageHeader";
import { ShowInactiveToggle } from "../components/molecules/ShowInactiveToggle";
import { ArticleForm } from "../components/organisms/ArticleForm";
import { ArticleTable } from "../components/organisms/ArticleTable";
import {
  useArticlesQuery,
  useCreateArticle,
  useDeactivateArticle,
  useUpdateArticle,
} from "../hooks/useArticles";
import { useOpenSalesQuery } from "../hooks/useOpenSales";
import { useProductSubgroupsQuery } from "../hooks/useProductSubgroups";
import { useProductGroupsQuery } from "../hooks/useProductGroups";
import { confirmAction } from "../lib/confirm";
import { reservedQuantities } from "../lib/openSales";
import type { Article } from "../types/article";

export function ArticlePage() {
  const { data: articles, isLoading } = useArticlesQuery();
  const { data: productGroups } = useProductGroupsQuery();
  const { data: productSubgroups } = useProductSubgroupsQuery();
  const { data: openSales } = useOpenSalesQuery();
  const createMutation = useCreateArticle();
  const updateMutation = useUpdateArticle();
  const deactivateMutation = useDeactivateArticle();

  const [editing, setEditing] = useState<Article | "new" | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const activeMutation = editing === "new" ? createMutation : updateMutation;
  const activeProductGroups = (productGroups ?? []).filter((g) => g.active);
  const activeProductSubgroups = (productSubgroups ?? []).filter((s) => s.active);
  const visibleArticles = (articles ?? []).filter((a) => showInactive || a.active);

  function closeForm() {
    setEditing(null);
    createMutation.reset();
    updateMutation.reset();
  }

  async function handleDeactivate(id: number) {
    if (await confirmAction("Artikel wirklich deaktivieren?", "Deaktivieren")) {
      deactivateMutation.mutate(id);
    }
  }

  return (
    <section>
      <PageHeader title="Artikel" action={<Button onClick={() => setEditing("new")}>Neuer Artikel</Button>} />

      <Modal
        open={editing !== null}
        title={editing === "new" ? "Neuer Artikel" : "Artikel bearbeiten"}
        onClose={closeForm}
        size="lg"
      >
        {editing && productGroups && productSubgroups && articles && (
          <ArticleForm
            initial={editing === "new" ? undefined : editing}
            productGroups={activeProductGroups}
            productSubgroups={activeProductSubgroups}
            articles={articles}
            submitting={activeMutation.isPending}
            errorMessage={activeMutation.error?.message}
            onCancel={closeForm}
            onSubmit={(values) => {
              const action =
                editing === "new"
                  ? createMutation.mutateAsync(values)
                  : updateMutation.mutateAsync({ id: editing.id, ...values });
              action.then(closeForm).catch(() => {});
            }}
          />
        )}
      </Modal>

      {isLoading && <p>Wird geladen...</p>}

      {articles && productGroups && productSubgroups && (
        <ArticleTable
          articles={visibleArticles}
          productGroups={productGroups}
          productSubgroups={productSubgroups}
          onEdit={setEditing}
          onDeactivate={handleDeactivate}
          reserved={reservedQuantities(openSales ?? [])}
          toolbar={<ShowInactiveToggle checked={showInactive} onCheckedChange={setShowInactive} />}
        />
      )}

      {deactivateMutation.error && <p className="field-error">{deactivateMutation.error.message}</p>}
    </section>
  );
}
