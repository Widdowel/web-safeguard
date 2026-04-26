const SIZE_UNITS = ["o", "Ko", "Mo", "Go", "To", "Po"] as const;

export function formatBytes(value: bigint | number, fractionDigits = 1): string {
  const bytes = typeof value === "bigint" ? Number(value) : value;
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 o";
  const i = Math.min(SIZE_UNITS.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const scaled = bytes / Math.pow(1024, i);
  return `${scaled.toFixed(i === 0 ? 0 : fractionDigits)} ${SIZE_UNITS[i]}`;
}

const NUMBER_FR = new Intl.NumberFormat("fr-FR");
export const formatNumber = (n: number | bigint): string =>
  NUMBER_FR.format(typeof n === "bigint" ? Number(n) : n);

const DATE_FR = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
export const formatDateTime = (date: Date | string): string =>
  DATE_FR.format(typeof date === "string" ? new Date(date) : date);
