export type BridgeState = {
  actions: string[];
  isHomeBridge: boolean;
  ui: string;
};

export type NodeApiFetchResult = {
  body: string;
  contentLength?: number;
  contentType: string;
  data: unknown;
  ok: boolean;
  status: number;
  statusText: string;
};

export type QdnResourceMetadata = {
  category?: string | null;
  description?: string | null;
  tags?: string[] | null;
  title?: string | null;
};

export type QdnResourceStatus = {
  status?: string | null;
};

export type QdnResource = {
  created?: number | null;
  identifier?: string | null;
  latestSignature?: string | null;
  metadata?: QdnResourceMetadata | null;
  name: string;
  service: string;
  size?: number | null;
  status?: QdnResourceStatus | string | null;
  updated?: number | null;
};

export type NodeStatus = {
  height?: number;
  isSynchronizing?: boolean;
  numberOfConnections?: number;
  syncPercent?: number;
  syncPhase?: string;
  [key: string]: unknown;
};

export type QdnSelectedAccount = {
  address: string;
  avatarUrl?: string | null;
  isUnlocked?: boolean;
  name?: string | null;
};

export type AccountContext = {
  account: QdnSelectedAccount | null;
  writableNames: string[];
};

export type PublishActionResult = {
  accepted?: boolean;
  action?: string;
  resource?: {
    identifier?: string | null;
    name?: string;
    service?: string;
  };
  transactionSignature?: string;
  [key: string]: unknown;
};

export type RecipeIngredient = {
  id: string;
  text: string;
  amount: number | null;
  amountMax: number | null;
  unit: string;
  item: string;
  scalable: boolean;
};

export type RecipeSource = {
  name: string;
  url: string;
};

export type RecipeV1 = {
  schema: 'qortium.recipes.recipe.v1';
  id: string;
  name: string;
  description: string;
  baseServings: number | null;
  yieldText: string;
  prepMinutes: number | null;
  cookMinutes: number | null;
  category: string;
  cuisine: string;
  tags: string[];
  image: string;
  images: string[];
  ingredients: RecipeIngredient[];
  instructions: string[];
  notes: string[];
  source: RecipeSource;
  createdAt: number;
  updatedAt: number;
};

export type RecipeValidation = {
  errors: string[];
  recipe: RecipeV1 | null;
};

export type PublishedRecipe = {
  recipe: RecipeV1;
  resource: QdnResource;
};
