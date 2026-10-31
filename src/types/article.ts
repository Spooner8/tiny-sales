export interface ArticleComponentDetail {
  componentArticleId: number;
  code: string;
  name: string;
  patternNumber: string | null;
  priceCents: number;
}

export interface Article {
  id: number;
  code: string;
  name: string;
  productGroupId: number;
  productSubgroupId: number;
  patternNumber: string | null;
  priceCents: number;
  stock: number;
  active: boolean;
  discontinued: boolean;
  createdAt: string;
  updatedAt: string;
  components: ArticleComponentDetail[];
  /** Base price plus components, before the promotion. */
  totalPriceCents: number;
  /** Promotion in percent (0 = none). */
  discountPercent: number;
  /** What is charged: totalPriceCents after the promotion, rounded to 5 Rappen. */
  salePriceCents: number;
}

export interface NewArticleComponentLink {
  componentArticleId: number;
  priceOverrideCents: number | null;
}

export interface NewArticle {
  name: string;
  productGroupId: number;
  productSubgroupId: number;
  patternNumber: string | null;
  priceCents: number;
  stock: number;
  discontinued: boolean;
  discountPercent: number;
  componentLinks: NewArticleComponentLink[];
}

export interface UpdateArticle {
  id: number;
  name: string;
  productGroupId: number;
  productSubgroupId: number;
  patternNumber: string | null;
  priceCents: number;
  stock: number;
  active: boolean;
  discontinued: boolean;
  discountPercent: number;
  componentLinks: NewArticleComponentLink[];
}
