/** Editor/reference types. Runtime files are native JavaScript modules. */
export interface Asset {
  id: string;
  name: string;
  category: string;
  description?: string;
  tags: string[];
  aliases: string[];
  packagePath: string;
  usdPath: string;
  fileType: 'usd' | 'usda' | 'usdc' | 'usdz';
  usdSizeBytes?: number;
  packageSizeBytes?: number;
  thumbnailUrl: string | null;
  remoteThumbnailUrl?: string | null;
  thumbnailPath?: string | null;
  usdUrl: string;
  sourceUrl: string;
  viewerSourceUrl: string;
  metadataSource: string;
  ai?: {
    tags: string[];
    aliases: string[];
    addedTags: string[];
    addedAliases: string[];
    provider: string;
    status: 'approved';
  };
}
export interface Catalog {
  schemaVersion: 1;
  dataset: 'nvidia/simready-assets';
  revision: string;
  mode: 'preview' | 'snapshot';
  generatedAt: string;
  assets: Asset[];
  issues?: Array<{ path: string; reason: string }>;
}
export interface SearchState {
  query?: string;
  category?: string;
  format?: string;
  saved?: boolean;
  savedIds?: string[];
  sort?: 'relevance' | 'name' | 'size';
}
