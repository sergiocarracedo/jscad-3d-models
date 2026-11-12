export const sortModelsNewestFirst = (models) =>
  [...models].sort(
    (a, b) =>
      b.updatedAt - a.updatedAt || a.title.localeCompare(b.title) || a.id.localeCompare(b.id),
  );
