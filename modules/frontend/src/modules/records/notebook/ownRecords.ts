import { listRecords } from "@/modules/core/services/generated/orthodontic-records";

const PAGE_SIZE = 100;

/**
 * Identificadores de las historias de la cuenta (según el listado del servidor, página a página): la
 * importación omite las entradas de cualquier otra historia. Solo viajan números de página y tamaño.
 */
export async function fetchOwnRecordIds(): Promise<Set<number>> {
  const ids = new Set<number>();
  for (let page = 0; ; page += 1) {
    const response = await listRecords({ page, size: PAGE_SIZE });
    response.content.forEach((record) => ids.add(record.id));
    if (response.last || response.content.length === 0) return ids;
  }
}
