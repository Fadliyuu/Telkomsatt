import { DocumentSnapshot, Timestamp } from "firebase/firestore";

/**
 * Konversi terpusat untuk data Firestore.
 * Mengubah instance Timestamp menjadi JS Date secara aman.
 */
export function mapFirestoreDoc<T>(docSnap: DocumentSnapshot): T {
  const data = docSnap.data() || {};
  const converted: Record<string, unknown> = { id: docSnap.id };

  for (const [key, value] of Object.entries(data)) {
    if (value instanceof Timestamp) {
      converted[key] = value.toDate();
    } else if (
      value &&
      typeof value === "object" &&
      "toDate" in value &&
      typeof (value as { toDate: () => Date }).toDate === "function"
    ) {
      converted[key] = (value as { toDate: () => Date }).toDate();
    } else {
      converted[key] = value;
    }
  }

  // Ensure default fallback dates if missing
  if (!converted.createdAt) converted.createdAt = new Date();
  if (!converted.updatedAt) converted.updatedAt = new Date();

  return converted as T;
}

export function mapFirestoreDocs<T>(docs: DocumentSnapshot[]): T[] {
  return docs.map((d) => mapFirestoreDoc<T>(d));
}
