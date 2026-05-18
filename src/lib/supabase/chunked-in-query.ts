export async function fetchInChunks<T>(
  client: unknown,
  table: string,
  column: string,
  values: string[],
  selectColumns: string,
  chunkSize = 100,
): Promise<T[]> {
  if (values.length === 0) return [];

  const chunks: string[][] = [];
  for (let i = 0; i < values.length; i += chunkSize) {
    chunks.push(values.slice(i, i + chunkSize));
  }

  const results = await Promise.all(
    chunks.map(async (chunk) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const query = (client as any).from(table).select(selectColumns).in(column, chunk);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as T[];
    }),
  );

  return results.flat();
}
