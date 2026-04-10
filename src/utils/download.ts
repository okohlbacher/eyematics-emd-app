/**
 * Shared file download utilities.
 * Eliminates duplicated Blob→anchor→click patterns across pages.
 */

/** Trigger a browser download from a Blob. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  // Delay cleanup so the browser has time to start the download
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 500);
}

/** Build a CSV string from headers and rows (with BOM for Excel compat). */
export function buildCsv(headers: string[], rows: string[][]): string {
  const BOM = '\uFEFF';
  const csvContent = [headers, ...rows]
    .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','))
    .join('\n');
  return BOM + csvContent;
}

/** Download a CSV file. */
export function downloadCsv(headers: string[], rows: string[][], filename: string): void {
  const content = buildCsv(headers, rows);
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, filename);
}

/** Download a JSON file. */
export function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  downloadBlob(blob, filename);
}

/** Download a YAML file. */
export function downloadYaml(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/yaml;charset=utf-8;' });
  downloadBlob(blob, filename);
}

/** Generate a date-stamped filename. */
export function datedFilename(prefix: string, ext: string): string {
  return `${prefix}-${new Date().toISOString().slice(0, 10)}.${ext}`;
}
