export const COMP_TABS = ["meta", "latest", "mine", "bookmarks"] as const;
export type CompTab = (typeof COMP_TABS)[number];

const query = (params: Record<string, string | number | null | undefined>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value != null && value !== "") {
      search.set(key, String(value));
    }
  }
  const text = search.toString();
  return text ? `?${text}` : "";
};

export const compPath = {
  list: (tab: CompTab = "meta", options: { page?: number; champion?: string | null } = {}) =>
    `/comps${tab === "meta" ? "" : `/${tab}`}${query({
      page: options.page && options.page > 1 ? options.page : null,
      champion: options.champion,
    })}`,
  create: () => "/comps/new",
  detail: (publicId: string) => `/comps/${publicId}`,
  edit: (publicId: string) => `/comps/${publicId}/edit`,
};
