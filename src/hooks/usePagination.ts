import { useState } from "react";

export function usePagination(pageSize = 25) {
  const [page, setPage] = useState(0);

  return {
    page,
    pageSize,
    from: page * pageSize,
    to: page * pageSize + pageSize - 1,
    nextPage: () => setPage((p) => p + 1),
    prevPage: () => setPage((p) => Math.max(0, p - 1)),
    resetPage: () => setPage(0),
    setPage,
  };
}
