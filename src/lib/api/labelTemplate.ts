import { invokeCommand } from "./client";
import type { LabelTemplate, NewLabelTemplate, UpdateLabelTemplate } from "../../types/labelTemplate";

export const labelTemplateApi = {
  list: () => invokeCommand<LabelTemplate[]>("list_label_templates"),
  create: (input: NewLabelTemplate) => invokeCommand<LabelTemplate>("create_label_template", { input }),
  update: (input: UpdateLabelTemplate) => invokeCommand<LabelTemplate>("update_label_template", { input }),
  deactivate: (id: number) => invokeCommand<void>("deactivate_label_template", { id }),
};
