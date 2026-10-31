export interface ProductGroup {
  id: number;
  name: string;
  active: boolean;
}

export interface NewProductGroup {
  name: string;
}

export interface UpdateProductGroup {
  id: number;
  name: string;
  active: boolean;
}
