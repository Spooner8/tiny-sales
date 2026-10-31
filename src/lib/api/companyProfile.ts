import { invokeCommand } from "./client";
import type { CompanyProfile } from "../../types/companyProfile";

export const companyProfileApi = {
  get: () => invokeCommand<CompanyProfile>("get_company_profile"),
  save: (input: CompanyProfile) => invokeCommand<CompanyProfile>("save_company_profile", { input }),
};
