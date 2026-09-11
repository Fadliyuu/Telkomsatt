export function toLocalDateInput(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function getReportDateRange(start: string, end: string) {
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T23:59:59.999`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) ||
      !Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime()) ||
      toLocalDateInput(startDate) !== start || toLocalDateInput(endDate) !== end) {
    throw new Error("Pilih tanggal mulai dan tanggal akhir yang valid.");
  }
  if (startDate > endDate) throw new Error("Tanggal mulai tidak boleh melewati tanggal akhir.");
  return { startDate, endDate };
}
