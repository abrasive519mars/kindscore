export type CsvCell = string | number | boolean | null | undefined;

function escapeCell(cell: CsvCell): string {
  if (cell === null || cell === undefined) return "";
  const text = String(cell);
  // RFC 4180: quote when the value contains a comma, a quote or a line break; double inner quotes.
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Pure CSV writer for the report exports. CRLF line endings, as spreadsheets expect. */
export function toCsv(headers: readonly string[], rows: readonly (readonly CsvCell[])[]): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeCell).join(","));
  return lines.join("\r\n") + "\r\n";
}
