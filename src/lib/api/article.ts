import { invokeCommand } from "./client";
import type { Article, NewArticle, UpdateArticle } from "../../types/article";

export const articleApi = {
  list: () => invokeCommand<Article[]>("list_articles"),
  create: (input: NewArticle) => invokeCommand<Article>("create_article", { input }),
  update: (input: UpdateArticle) => invokeCommand<Article>("update_article", { input }),
  deactivate: (id: number) => invokeCommand<void>("deactivate_article", { id }),
};
