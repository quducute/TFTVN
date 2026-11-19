export const articlePath = {
  list: (options: { category?: string | null; tag?: string | null; page?: number } = {}) => {
    const search = new URLSearchParams();
    if (options.category) {
      search.set("category", options.category);
    }
    if (options.tag) {
      search.set("tag", options.tag);
    }
    if (options.page && options.page > 1) {
      search.set("page", String(options.page));
    }
    const text = search.toString();
    return text ? `/articles?${text}` : "/articles";
  },
  mine: (page = 1) => (page > 1 ? `/articles/mine?page=${page}` : "/articles/mine"),
  create: () => "/articles/new",
  detail: (publicId: string) => `/articles/${publicId}`,
  edit: (publicId: string) => `/articles/${publicId}/edit`,
};
