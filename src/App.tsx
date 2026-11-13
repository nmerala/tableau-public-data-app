import { useEffect, useMemo, useRef, useState } from 'react';
import type { TableauViz } from '@tableau/embedding-api';
import { DEFAULT_VIZ, Table, createViz, filterTo, onChange, onReady, readSummary, worksheetNames } from './tableau';

// URL params:  ?viz=<public viz url>  &sheet=<worksheet>  &region=<value> (selection pushed by a Tableau URL action)
//              &metric=<measure name>  &show=1 (show the embedded viz instead of hiding it)
const q = new URLSearchParams(location.search);
const VIZ = q.get('viz') || DEFAULT_VIZ;
const SHEET = q.get('sheet') || undefined;
const SHOW_VIZ = q.get('show') === '1';
const DIM = q.get('dim') || undefined; // force which column is the card dimension
const inFrame = window.self !== window.top;

type Group = { key: string; sums: number[] };

function group(t: Table, dimIdx: number, measureIdx: number[]): Group[] {
  const m = new Map<string, number[]>();
  for (const r of t.rows) {
    const k = String(r[dimIdx]);
    const acc = m.get(k) || measureIdx.map(() => 0);
    measureIdx.forEach((mi, j) => (acc[j] += Number(r[mi]) || 0));
    m.set(k, acc);
  }
  return [...m].map(([key, sums]) => ({ key, sums }));
}

export default function App() {
  const host = useRef<HTMLDivElement>(null);
  const vizRef = useRef<TableauViz | null>(null);
  const [table, setTable] = useState<Table | null>(null);
  const [sheets, setSheets] = useState<string[]>([]);
  const [status, setStatus] = useState('Loading Tableau…');
  const initialSel = q.get('select') || q.get('region'); // pushed in by a Tableau URL action
  const [selected, setSelected] = useState<string | null>(initialSel);
  const appliedInitial = useRef(false);
  const [metric, setMetric] = useState<string | null>(q.get('metric'));

  async function refresh() {
    try { setTable(await readSummary(vizRef.current!, SHEET)); setStatus(''); }
    catch (e) { setStatus('Could not read data from Tableau: ' + (e as Error).message); }
  }

  useEffect(() => {
    if (!host.current || vizRef.current) return;
    const viz = createViz(host.current, VIZ);
    vizRef.current = viz;
    onReady(viz, () => { setSheets(worksheetNames(viz)); refresh(); onChange(viz, refresh); });
  }, []);

  const view = useMemo(() => {
    if (!table) return null;
    const dimIdx = DIM ? table.columns.findIndex(c => c.name === DIM) : table.columns.findIndex(c => !c.numeric);
    const measureIdx = table.columns.map((c, i) => (c.numeric ? i : -1)).filter(i => i >= 0);
    if (dimIdx < 0 || !measureIdx.length) return null;
    const mi = Math.max(0, measureIdx.findIndex(i => table.columns[i].name === metric));
    const groups = group(table, dimIdx, measureIdx).sort((a, b) => b.sums[mi] - a.sums[mi]).slice(0, 12);
    return { dim: table.columns[dimIdx].name, measures: measureIdx.map(i => table.columns[i].name), mi, groups };
  }, [table, metric]);

  useEffect(() => { // apply a selection that arrived via URL to the embedded viz, once, after data is first read
    if (view && initialSel && !appliedInitial.current && vizRef.current) {
      appliedInitial.current = true;
      filterTo(vizRef.current, view.dim, initialSel, SHEET).catch(e => setStatus('Filter failed: ' + (e as Error).message));
    }
  }, [view]);

  async function pick(key: string) {
    const next = selected === key ? null : key;
    setSelected(next);
    if (view && vizRef.current) await filterTo(vizRef.current, view.dim, next, SHEET).then(() => setStatus(''), e => setStatus('Filter failed: ' + (e as Error).message));
  }

  const max = view ? Math.max(...view.groups.map(g => g.sums[view.mi]), 1) : 1;
  const fmt = (n: number) => (Math.abs(n) >= 1000 ? (n / 1000).toFixed(1) + 'K' : n.toFixed(Math.abs(n) < 10 ? 2 : 0));

  return (
    <main>
      <header>
        <h1>Tableau-powered app</h1>
        <p>This page contains <b>no data</b>. Everything below is read live from a Tableau Public viz{inFrame ? ' (running inside a Tableau dashboard)' : ''}.</p>
      </header>
      {status && <p className="status">{status}</p>}
      {view && (
        <>
          <div className="toggle">
            {view.measures.map((m, i) => (
              <button key={m} className={i === view.mi ? 'on' : ''} onClick={() => setMetric(m)}>{m}</button>
            ))}
          </div>
          <div className="cards">
            {view.groups.map(g => (
              <button key={g.key} className={'card' + (selected === g.key ? ' sel' : '')} onClick={() => pick(g.key)}>
                <span className="k">{g.key}</span>
                <span className="v">{fmt(g.sums[view.mi])}</span>
                <span className="bar"><i style={{ width: `${(Math.max(g.sums[view.mi], 0) / max) * 100}%` }} /></span>
              </button>
            ))}
          </div>
          <p className="hint">Dimension: {view.dim} · click a card to filter the Tableau viz · {sheets.length} worksheets found</p>
        </>
      )}
      <div ref={host} className={SHOW_VIZ ? 'viz' : 'viz hidden'} />
    </main>
  );
}
