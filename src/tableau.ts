// The ONLY file that knows about Tableau. Swap this adapter for the Extensions API later
// (Cloud Data Apps, or Public once extensions land) and the React components stay the same.
import { TableauViz, TableauEventType } from '@tableau/embedding-api';

export type Table = { columns: { name: string; numeric: boolean }[]; rows: (string | number)[][] };

export const DEFAULT_VIZ = 'https://public.tableau.com/views/Superstore_24/Overview';

export function createViz(host: HTMLElement, src: string): TableauViz {
  const viz = new TableauViz();
  viz.src = src;
  viz.toolbar = 'hidden' as never;
  viz.hideTabs = true;
  viz.width = '100%';
  viz.height = '700px';
  host.appendChild(viz);
  return viz;
}

export function onReady(viz: TableauViz, cb: () => void) {
  viz.addEventListener(TableauEventType.FirstInteractive, cb);
}

export function onChange(viz: TableauViz, cb: () => void) {
  for (const t of [TableauEventType.FilterChanged, TableauEventType.ParameterChanged, TableauEventType.MarkSelectionChanged])
    viz.addEventListener(t, cb);
}

export function worksheetNames(viz: TableauViz): string[] {
  const s = viz.workbook.activeSheet as any;
  return s.worksheets ? s.worksheets.map((w: any) => w.name) : [s.name];
}

function getSheet(viz: TableauViz, name?: string): any {
  const s = viz.workbook.activeSheet as any;
  if (!s.worksheets) return s;
  return (name && s.worksheets.find((w: any) => w.name === name)) || s.worksheets[0];
}

export async function readSummary(viz: TableauViz, sheetName?: string): Promise<Table> {
  const ws = getSheet(viz, sheetName);
  const reader = await ws.getSummaryDataReaderAsync();
  try {
    const page = await reader.getPageAsync(0);
    const columns = page.columns.map((c: any) => ({ name: c.fieldName as string, numeric: c.dataType === 'float' || c.dataType === 'int' }));
    const rows = page.data.map((r: any[]) => r.map((cell, i) => (columns[i].numeric ? Number(cell.value) : String(cell.formattedValue))));
    return { columns, rows };
  } finally { await reader.releaseAsync(); }
}

// App -> Tableau
export async function filterTo(viz: TableauViz, field: string, value: string | null, sheetName?: string) {
  const ws = getSheet(viz, sheetName);
  if (value === null) await ws.clearFilterAsync(field).catch(() => {}); // clearing a never-applied filter errors; harmless
  else await ws.applyFilterAsync(field, [value], 'replace');
}

export async function setParameter(viz: TableauViz, name: string, value: string | number) {
  const p = (await viz.workbook.getParametersAsync()).find((x: any) => x.name === name);
  if (p) await p.changeValueAsync(value);
}
