export async function paginate(qb: { getManyAndCount: () => Promise<unknown> }, opts: { page?: number; pageSize?: number }) {
  const [items, total] = (await qb.getManyAndCount()) as [unknown[], number]
  return {
    items,
    meta: {
      totalItems: total,
      itemCount: items.length,
      itemsPerPage: opts.pageSize ?? 10,
      totalPages: Math.ceil(total / (opts.pageSize ?? 10)),
      currentPage: opts.page ?? 1,
    },
  }
}