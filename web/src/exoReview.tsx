import { useMemo, useState } from 'react';
import fetched from '../../data/exo/FETCH.json';
import { evidenceForPlanet, type EvidenceReference } from '../../src/exo/evidence.js';
import { EXO_ACT_ORDER } from '../../src/exo/def.js';
import type { ExoSurface } from '../../src/exo/session.js';
import type { ReviewRecipe } from '../../src/exo/reviewReplay.js';
import { massKindNoteFor } from '../../src/exo/names.js';
import './exoReview.css';

interface ReviewProps {
  readonly surface: ExoSurface;
  readonly review: ReviewRecipe;
  readonly busy: boolean;
  readonly status: string;
  readonly onChange: (review: ReviewRecipe) => void;
  readonly onReplay: () => void;
  readonly onShare: () => void;
  readonly onDownload: () => void;
}

function PaperLink({ reference }: { readonly reference: EvidenceReference | null }): JSX.Element {
  if (reference === null) return <span>Source reference unavailable</span>;
  return reference.href === null ? <span>{reference.label} · no usable source link</span> : <a href={reference.href} target="_blank" rel="noopener noreferrer">{reference.label} <span aria-hidden="true">↗</span></a>;
}

const number = (value: number): string => value.toLocaleString('en-US', { maximumFractionDigits: 6 });

export function ExoReview({ surface, review, busy, status, onChange, onReplay, onShare, onDownload }: ReviewProps): JSX.Element {
  const [planetInput, setPlanetInput] = useState(review.planet);
  const [inputError, setInputError] = useState('');
  const evidence = useMemo(() => evidenceForPlanet(review.planet, surface.tables.measurements, surface.tables.planets, surface.tables.references, review.parameter), [surface, review.planet, review.parameter]);
  const picked = review.measurementIds.map((id) => evidence.rows.find((row) => row.id === id)).filter((row) => row !== undefined);
  const unit = review.parameter === 'radius' ? 'Earth radii' : 'Earth masses';
  const records = surface.session.log.records;
  const analyses = records.filter((record) => record.viewId.startsWith('analysis:'));
  const composite = evidence.composite;
  const compositeMassKind = evidence.planet?.mass_kind ?? null;
  const massKinds = new Set([...picked.map((row) => row.measurement.mass_kind), compositeMassKind].filter((kind) => kind !== null));
  const options = useMemo(() => [...new Set(surface.tables.measurements.map((row) => row.pl_name))].sort(), [surface]);

  function pickPlanet(name: string): void {
    if (!options.includes(name)) {
      setInputError('Choose a planet in this saved archive slice.');
      return;
    }
    setInputError('');
    setPlanetInput(name);
    const next = evidenceForPlanet(name, surface.tables.measurements, surface.tables.planets, surface.tables.references, review.parameter);
    const ordered = [...next.rows.filter((row) => row.figure.state === 'present'), ...next.rows.filter((row) => row.figure.state !== 'present')];
    onChange({ ...review, planet: name, measurementIds: ordered.slice(0, 2).map((row) => row.id) });
  }

  function pickRow(index: number, id: string): void {
    if (index === 1 && review.measurementIds.length === 0) return;
    const ids = [...review.measurementIds];
    const previous = ids[index];
    const other = index === 0 ? 1 : 0;
    if (ids[other] === id && previous !== undefined) ids[other] = previous;
    ids[index] = id;
    onChange({ ...review, measurementIds: ids });
  }

  const plotted = picked.flatMap((row, index) => row.figure.state === 'present' && row.figure.value !== null ? [{ label: row.reference?.label ?? row.measurement.ref_label, value: row.figure.value, lower: row.figure.lower, upper: row.figure.upper, color: index === 0 ? '#3777c8' : '#ba6535' }] : []);
  const compositeValue = composite?.figure.state === 'present' ? composite.figure.value : null;
  const domainValues = plotted.flatMap((row) => [row.lower ?? row.value, row.value, row.upper ?? row.value]);
  if (compositeValue !== null && compositeValue !== undefined) domainValues.push(compositeValue);
  const min = domainValues.length === 0 ? 0 : Math.min(...domainValues);
  const max = domainValues.length === 0 ? 1 : Math.max(...domainValues);
  const pad = Math.max((max - min) * .17, Math.abs(max) * .025, .1);
  const left = min - pad;
  const right = max + pad;
  const x = (value: number): number => 180 + ((value - left) / (right - left)) * 620;
  const graphHeight = Math.max(160, plotted.length * 58 + 92);

  return (
    <main className="exo-review" aria-busy={busy}>
      <header className="exo-review-hero">
        <div className="exo-review-brand"><a href="../">VIZFOOTPRINT.JS</a><span>PUBLIC DATA · INSPECTABLE ANALYSIS</span></div>
        <div className="exo-review-kicker">NASA EXOPLANET ARCHIVE / AN INDEPENDENT DEMONSTRATION</div>
        <h1>One planet.<br />Several published values.</h1>
        <p className="exo-review-lede">Follow a number back to its paper. Read the uncertainty.<br className="exo-desktop-break" /> Rebuild the same review from a shared link.</p>
        <div className="exo-review-snapshot"><span className="exo-status-dot" /> Saved archive slice · {fetched.retrievedAt.slice(0, 10)} <span>· No sign-in or model key</span></div>
      </header>

      <section className="exo-review-toolbar" aria-label="Choose an evidence review">
        <form onSubmit={(event) => { event.preventDefault(); pickPlanet(planetInput); }}>
          <label htmlFor="exo-planet">Planet</label>
          <div className="exo-review-search"><input id="exo-planet" list="exo-planets" value={planetInput} onChange={(event) => setPlanetInput(event.target.value)} disabled={busy} /><datalist id="exo-planets">{options.map((name) => <option key={name} value={name} />)}</datalist><button type="submit" disabled={busy}>Explore</button></div>
        </form>
        <label className="exo-review-parameter" htmlFor="exo-parameter">Parameter<select id="exo-parameter" aria-label="Parameter" value={review.parameter} disabled={busy} onChange={(event) => onChange({ ...review, parameter: event.target.value as ReviewRecipe['parameter'] })}><option value="radius">Radius · Earth radii</option><option value="mass">Mass · Earth masses</option></select></label>
        <div className="exo-review-actions"><button type="button" className="exo-button-secondary" disabled={busy} onClick={onReplay}>{busy ? 'Rebuilding…' : 'Replay this review'}</button><button type="button" className="exo-button-primary" disabled={busy} onClick={onShare}>Copy review link</button></div>
        {inputError && <p className="exo-review-error" role="alert">{inputError}</p>}
      </section>
      <p className="exo-review-status" role="status">{status || 'Choose two published records below, then replay or share this focused review.'}</p>

      <section className="exo-review-section" aria-labelledby="exo-record-heading">
        <div className="exo-section-heading"><div><span className="exo-step">01 / READ THE EVIDENCE</span><h2 id="exo-record-heading">{review.planet}, by publication</h2></div><p>{evidence.rows.length} publication rows in this slice<br />{evidence.rows.filter((row) => row.figure.state === 'present').length} report a {review.parameter} value · {evidence.rows.filter((row) => row.figure.state !== 'present').length} bounded or missing</p></div>
        <div className="exo-measurement-grid">
          {[0, 1].map((index) => {
            const row = picked[index];
            return <article className={`exo-measurement-card exo-measurement-${index}`} key={index}>
              <label htmlFor={`exo-publication-${index}`} className="exo-card-eyebrow">PUBLICATION {index === 0 ? 'A' : 'B'}<select id={`exo-publication-${index}`} aria-label={`Publication ${index === 0 ? 'A' : 'B'}`} disabled={busy || evidence.rows.length === 0 || (index === 1 && review.measurementIds.length === 0)} value={review.measurementIds[index] ?? ''} onChange={(event) => pickRow(index, event.target.value)}>
                {!review.measurementIds[index] && <option value="">{index === 0 ? 'Select a publication' : 'No second record selected'}</option>}
                {evidence.rows.map((entry) => <option key={entry.id} value={entry.id} disabled={review.measurementIds[index] === undefined && entry.id === review.measurementIds[index === 0 ? 1 : 0]}>{entry.measurement.ref_label} · {entry.figure.valueLabel}</option>)}
              </select></label>
              <div className="exo-measurement-value">{row?.figure.valueLabel ?? 'No publication selected'}</div><div className="exo-measurement-unit">{unit}</div>
              <p className="exo-measurement-uncertainty">{row?.figure.uncertaintyLabel ?? 'Select another record to compare.'}</p>
              <div className="exo-measurement-source"><PaperLink reference={row?.reference ?? null} /></div>
              {row && <p className="exo-measurement-meta">Published {row.measurement.pl_pubdate || 'date not supplied'}{row.measurement.default_flag === 1 ? ' · archive default PS solution' : ''}{review.parameter === 'mass' && row.measurement.mass_kind ? ` · ${row.measurement.mass_kind}` : ''}</p>}
              {review.parameter === 'mass' && row?.measurement.mass_kind && <p className="exo-measurement-meta">{massKindNoteFor(row.measurement.mass_kind) ?? 'Mass provenance is not further described in this demo.'}</p>}
            </article>;
          })}
        </div>
      </section>

      <section className="exo-review-section exo-interval-section" aria-labelledby="exo-compare-heading">
        <div className="exo-section-heading"><div><span className="exo-step">02 / KEEP THE UNCERTAINTY</span><h2 id="exo-compare-heading">Different numbers need context.</h2></div><span className="exo-unit-tag">{unit} · linear scale</span></div>
        {review.parameter === 'mass' && massKinds.size > 1 && <p className="exo-review-notice">These records use different mass provenance types. A true mass, M·sin(i), and a mass estimated from radius are different quantities or methods; the plotted difference must not be read as disagreement about the same measurement.</p>}
        {plotted.length > 0 ? <div className="exo-chart-scroll"><svg className="exo-interval-chart" viewBox={`0 0 880 ${graphHeight}`} role="img" aria-label={`Selected ${review.parameter} values with their reported uncertainty endpoints. The composite is shown separately without an uncertainty interval.`}>
          <line x1="180" y1={graphHeight - 44} x2="800" y2={graphHeight - 44} stroke="#bbc8d4" />
          {[0, 1, 2, 3, 4].map((tick) => { const value = left + (right - left) * tick / 4; return <g key={tick}><line x1={x(value)} y1="18" x2={x(value)} y2={graphHeight - 40} stroke="#e5ebf0" /><text x={x(value)} y={graphHeight - 20} textAnchor="middle" fill="#5b6d7b" fontSize="12">{number(value)}</text></g>; })}
          {compositeValue !== null && compositeValue !== undefined && <g><line x1={x(compositeValue)} y1="18" x2={x(compositeValue)} y2={graphHeight - 44} stroke="#507066" strokeDasharray="5 5" /><text x={x(compositeValue)} y="12" textAnchor="middle" fill="#507066" fontSize="11">composite</text></g>}
          {plotted.map((row, index) => { const y = 48 + index * 58; return <g key={index}><text x="160" y={y + 4} textAnchor="end" fill="#324d62" fontSize="12">{row.label.length > 23 ? `${row.label.slice(0, 22)}…` : row.label}</text><line x1={x(row.lower ?? row.value)} y1={y} x2={x(row.upper ?? row.value)} y2={y} stroke={row.color} strokeWidth="3" />{[row.lower, row.upper].filter((value) => value !== null).map((value, side) => <line key={side} x1={x(value!)} y1={y - 7} x2={x(value!)} y2={y + 7} stroke={row.color} strokeWidth="2" />)}<circle cx={x(row.value)} cy={y} r="6" fill={row.color} stroke="white" strokeWidth="2" /></g>; })}
        </svg></div> : <p className="exo-review-notice">Neither selected row supplies a measured {review.parameter}. Bounds and missing values are listed in the evidence cards and are not drawn as measurements.</p>}
        <p className="exo-chart-note">Bars use each paper’s reported upper and lower uncertainties, where supplied. A difference between values, or overlap of these intervals, is not a statistical significance test. Bounds and missing values are not plotted as measured values.</p>
        <aside className="exo-composite-card"><span className="exo-card-eyebrow">THE ARCHIVE COMPOSITE IS A SEPARATE SOURCE</span><div className="exo-composite-layout"><div><strong>{composite?.figure.valueLabel ?? 'Not available'}</strong>{review.parameter === 'mass' && <p>Provenance: {compositeMassKind ?? 'not supplied'}{compositeMassKind ? ` · ${massKindNoteFor(compositeMassKind) ?? 'no further description'}` : ''}</p>}</div><div><PaperLink reference={composite?.reference ?? null} /><p>{composite?.reference?.note ?? 'Its parameters may come from different publications; the row need not be one self-consistent published solution.'}</p>{picked.some((row) => row.isCompositeSource) && <p>This source is also selected above. It is not independent corroboration of that publication.</p>}</div></div><p className="exo-chart-note">Composite uncertainties were not downloaded in this slice. No interval is invented or borrowed from a matching PS row.</p></aside>
      </section>

      <section className="exo-review-section" aria-labelledby="exo-replay-heading">
        <div className="exo-section-heading"><div><span className="exo-step">03 / FOLLOW THE RECORD</span><h2 id="exo-replay-heading">The steps behind the view.</h2></div><span className="exo-unit-tag">{analyses.length} declared analyses · {records.length} commits</span></div>
        <div className="exo-provenance-grid"><article><span className="exo-provenance-number">01</span><h3>Read a saved slice</h3><p>Two archive tables, downloaded {fetched.retrievedAt.slice(0, 10)}. Publication solutions and composite values keep separate identities.</p></article><article><span className="exo-provenance-number">02</span><h3>Run declared analysis</h3><p>The library groups measured radii, derives their numeric spread, brings over the composite radius and computes the difference.</p></article><article><span className="exo-provenance-number">03</span><h3>Restore this review</h3><p>Replay starts a new session, reruns the five analyses and selects this planet. The link restores the parameter and A/B records.</p></article></div>
        <details className="exo-review-details"><summary>Inspect the execution record and source fingerprints</summary><ol className="exo-analysis-list">{EXO_ACT_ORDER.map((act) => { const record = analyses.find((item) => item.viewId === `analysis:${act.id}`); return <li key={act.id}><strong>{act.id}</strong> <span>{record ? 'Recorded' : 'Not recorded'}</span><p>{record?.cause?.intent ?? act.intent}</p></li>; })}</ol><p>Parameter and A/B choices are reading settings in the share recipe. The full exploration desk’s later gestures, branches and layout are not included.</p><p>Matching a saved source and replaying a calculation demonstrates reproducibility; it does not certify the source’s scientific accuracy.</p><dl className="exo-hashes"><dt>PS · SHA-256</dt><dd>{review.sources.ps}</dd><dt>PSCompPars · SHA-256</dt><dd>{review.sources.pscomppars}</dd></dl><button type="button" className="exo-button-secondary" onClick={onDownload}>Download review evidence</button></details>
        <details className="exo-review-details"><summary>Inspect all {evidence.rows.length} publication rows for {review.planet}</summary><div className="exo-table-scroll"><table><thead><tr><th>Publication</th><th>{review.parameter} ({unit})</th><th>Reported uncertainty</th><th>State</th></tr></thead><tbody>{evidence.rows.map((row) => <tr key={row.id}><td><PaperLink reference={row.reference} /></td><td>{row.figure.valueLabel}</td><td>{row.figure.uncertaintyLabel}</td><td>{row.figure.state}</td></tr>)}</tbody></table></div></details>
      </section>
      <footer className="exo-review-footer"><p>An independent open-source demonstration by Sanjay Krishna Anbalagan. No NASA endorsement is implied.</p><p>This research has made use of the NASA Exoplanet Archive, operated by the California Institute of Technology under contract with NASA under the Exoplanet Exploration Program. <a href="https://doi.org/10.26133/NEA12" target="_blank" rel="noopener noreferrer">PS: NEA12</a> · <a href="https://doi.org/10.26133/NEA13" target="_blank" rel="noopener noreferrer">PSCompPars: NEA13</a> · <a href="https://exoplanetarchive.ipac.caltech.edu/docs/pscp_calc.html" target="_blank" rel="noopener noreferrer">How the composite is assembled</a></p></footer>
    </main>
  );
}
