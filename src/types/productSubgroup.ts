export interface ProductSubgroup {
  id: number;
  productGroupId: number;
  name: string;
  active: boolean;
}

export interface NewProductSubgroup {
  productGroupId: number;
  name: string;
}

export interface UpdateProductSubgroup {
  id: number;
  productGroupId: number;
  name: string;
  active: boolean;
}
