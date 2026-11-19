export const LIBRARY_SECTIONS = ["champions", "traits", "items", "augments", "roles"] as const;

export type LibrarySection = (typeof LIBRARY_SECTIONS)[number];

export const libraryPath = {
  root: () => "/library",
  set: (set: number) => `/library/${set}`,
  section: (set: number, section: LibrarySection) => `/library/${set}/${section}`,
  champion: (set: number, apiName: string) =>
    `/library/${set}/champions/${encodeURIComponent(apiName)}`,
  trait: (set: number, apiName: string) => `/library/${set}/traits#${encodeURIComponent(apiName)}`,
};
