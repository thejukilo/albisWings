import Link from 'next/link';
import { format } from 'date-fns';

type Aircraft = {
  id: string;
  registration: string;
  manufacturer: string;
  model: string;
  currentFtc: number | null;
  currentHobbs: number | null;
  totalLandings: number;
  lastPosition: string | null;
  isAog: boolean;
};

type Upcoming = {
  id: string;
  registration: string;
  starts_at: string;
  ends_at: string;
  purpose: string;
  instructor_name: string | null;
};

type Aog = { id: string; registration: string; count: number };
type OpenTech = { aircraft_id: string; registration: string; open_defects: number };
type RecentFlight = {
  id: string;
  flight_date: string;
  aircraft_id: string;
  origin_icao: string;
  destination_icao: string;
  block_off: string;
  landing: string;
};

const PURPOSE_DOT: Record<string, string> = {
  privat:     'var(--success)',
  schulung:   'var(--accent)',
  commercial: 'var(--warning)',
  maintenance:'var(--danger)',
};

export function Dashboard({
  userName, sepLandings90d,
  upcoming, aircraft, aogList, openTechlog, recentFlights,
  isStaff, isInstructor,
}: {
  userName: string;
  sepLandings90d: number;
  upcoming: Upcoming[];
  aircraft: Aircraft[];
  aogList: Aog[];
  openTechlog: OpenTech[];
  recentFlights: RecentFlight[];
  isStaff: boolean;
  isInstructor: boolean;
}) {
  const currencyWarning = sepLandings90d < 3;
  const regByAircraftId = new Map(aircraft.map(a => [a.id, a.registration]));

  return (
    <div className="pd">
      <style>{styles}</style>

      {/* Header */}
      <header className="pd-header">
        <div>
          <h1 className="pd-title">Übersicht</h1>
          <p className="pd-subtitle">Willkommen zurück, {userName}.</p>
        </div>
        <div className="pd-header-actions">
          <Link href="/reservations/new" className="pd-btn-primary">
            <span>+ Neue Reservation</span>
          </Link>
        </div>
      </header>

      {/* AOG banner — only if relevant */}
      {aogList.length > 0 && (
        <div className="pd-banner pd-banner-danger">
          <div className="pd-banner-icon">⚠</div>
          <div className="pd-banner-body">
            <div className="pd-banner-title">
              {aogList.length === 1 ? 'Ein Flugzeug ist ausser Betrieb' : `${aogList.length} Flugzeuge sind ausser Betrieb`}
            </div>
            <div className="pd-banner-text">
              {aogList.map((a, i) => (
                <span key={a.id}>
                  {i > 0 && ' · '}
                  <Link href={`/techlog/${a.id}`} className="pd-banner-link">
                    {a.registration}
                  </Link>
                  <span className="pd-muted">{' '}({a.count} {a.count === 1 ? 'Eintrag' : 'Einträge'})</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* KPI strip */}
      <div className="pd-kpi-grid">
        <Kpi
          label="SEP Landungen (90 Tage)"
          value={String(sepLandings90d)}
          tone={currencyWarning ? 'danger' : 'normal'}
          hint={currencyWarning ? 'Unter 3 — Currency abgelaufen' : 'Currency erfüllt'}
        />
        <Kpi
          label="Kommende Flüge"
          value={String(upcoming.length)}
          hint="In den nächsten 7 Tagen"
        />
        <Kpi
          label="Flotte verfügbar"
          value={`${aircraft.filter(a => !a.isAog).length} / ${aircraft.length}`}
          hint={aogList.length > 0 ? `${aogList.length} AOG` : 'Alle einsatzbereit'}
          tone={aogList.length > 0 ? 'warning' : 'normal'}
        />
        {isStaff && (
          <Kpi
            label="Offene Techlog-Einträge"
            value={String(openTechlog.reduce((s, t) => s + t.open_defects, 0))}
            hint={`auf ${openTechlog.length} Flugzeug${openTechlog.length === 1 ? '' : 'en'}`}
            tone={openTechlog.length > 0 ? 'warning' : 'normal'}
          />
        )}
      </div>

      {/* Two-column body */}
      <div className="pd-cols">
        {/* Left — Upcoming */}
        <section className="pd-card">
          <div className="pd-card-head">
            <h2 className="pd-card-title">Meine kommenden Flüge</h2>
            <Link href="/reservations" className="pd-card-link">Alle ansehen →</Link>
          </div>
          {upcoming.length === 0 ? (
            <div className="pd-empty">
              <div className="pd-empty-text">Keine kommenden Reservationen.</div>
              <Link href="/reservations/new" className="pd-btn-ghost">+ Reservation erstellen</Link>
            </div>
          ) : (
            <div className="pd-list">
              {upcoming.map((u) => (
                <Link key={u.id} href={`/reservations/${u.id}`} className="pd-list-row">
                  <div className="pd-list-date">
                    <div className="pd-list-day">{format(new Date(u.starts_at), 'dd')}</div>
                    <div className="pd-list-mon">{format(new Date(u.starts_at), 'MMM')}</div>
                  </div>
                  <div className="pd-list-body">
                    <div className="pd-list-line1">
                      <span className="pd-reg">{u.registration}</span>
                      <span className="pd-dot" style={{ background: PURPOSE_DOT[u.purpose] ?? 'var(--text-3)' }} />
                      <span className="pd-muted">{u.purpose}</span>
                    </div>
                    <div className="pd-list-line2">
                      {format(new Date(u.starts_at), 'HH:mm')}–{format(new Date(u.ends_at), 'HH:mm')}
                      {u.instructor_name && <> · mit {u.instructor_name}</>}
                    </div>
                  </div>
                  <div className="pd-list-arrow">→</div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Right — Fleet */}
        <section className="pd-card">
          <div className="pd-card-head">
            <h2 className="pd-card-title">Flotte</h2>
            <Link href="/flightlog" className="pd-card-link">Flightlog →</Link>
          </div>
          <div className="pd-fleet">
            {aircraft.map((a) => (
              <Link key={a.id} href={`/flightlog/${a.id}`} className={`pd-fleet-row ${a.isAog ? 'pd-fleet-aog' : ''}`}>
                <div className="pd-fleet-reg">
                  <span className="pd-reg">{a.registration}</span>
                  {a.isAog && <span className="pd-tag pd-tag-danger">AOG</span>}
                </div>
                <div className="pd-fleet-meta">
                  <div className="pd-fleet-loc">
                    <span className="pd-muted">@</span> {a.lastPosition ?? '—'}
                  </div>
                  <div className="pd-fleet-num">
                    <span className="pd-muted">FTC</span> {a.currentFtc != null ? a.currentFtc.toFixed(1) : '—'}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>

      {/* Recent activity */}
      <section className="pd-card">
        <div className="pd-card-head">
          <h2 className="pd-card-title">Letzte Aktivität</h2>
          <Link href="/flightlog" className="pd-card-link">Vollständiger Flightlog →</Link>
        </div>
        {recentFlights.length === 0 ? (
          <div className="pd-empty"><div className="pd-empty-text">Keine kürzlichen Flüge.</div></div>
        ) : (
          <div className="pd-activity">
            {recentFlights.map(f => (
              <Link key={f.id} href={`/flightlog/${f.aircraft_id}`} className="pd-activity-row">
                <div className="pd-activity-time">
                  {format(new Date(f.flight_date), 'dd.MM.')}{' '}
                  <span className="pd-muted">{format(new Date(f.block_off), 'HH:mm')}</span>
                </div>
                <div className="pd-activity-body">
                  <span className="pd-reg">{regByAircraftId.get(f.aircraft_id) ?? '—'}</span>
                  <span className="pd-muted">flog</span>
                  <span className="pd-mono">{f.origin_icao}</span>
                  <span className="pd-muted">→</span>
                  <span className="pd-mono">{f.destination_icao}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Kpi({ label, value, hint, tone = 'normal' }: {
  label: string; value: string; hint?: string; tone?: 'normal' | 'warning' | 'danger';
}) {
  return (
    <div className={`pd-kpi pd-kpi-${tone}`}>
      <div className="pd-kpi-label">{label}</div>
      <div className="pd-kpi-value">{value}</div>
      {hint && <div className="pd-kpi-hint">{hint}</div>}
    </div>
  );
}

const styles = `
.pd { display: flex; flex-direction: column; gap: 24px; }
.pd-header { display: flex; align-items: end; justify-content: space-between; gap: 16px; }
.pd-title { font-size: 24px; font-weight: 600; letter-spacing: -0.02em; margin: 0; color: var(--text); }
.pd-subtitle { font-size: 14px; color: var(--text-2); margin: 4px 0 0; }
.pd-header-actions { display: flex; gap: 8px; }

.pd-btn-primary {
  display: inline-flex; align-items: center; gap: 6px;
  background: var(--text); color: var(--bg);
  padding: 8px 14px; border-radius: 6px;
  font-size: 13px; font-weight: 500; text-decoration: none;
  transition: opacity 0.1s, transform 0.05s;
}
.pd-btn-primary:hover { opacity: 0.85; }
.pd-btn-primary:active { transform: translateY(1px); }
.pd-btn-ghost {
  display: inline-flex; align-items: center; gap: 6px;
  background: transparent; color: var(--text-2);
  padding: 6px 10px; border-radius: 6px;
  font-size: 13px; text-decoration: none;
  border: 1px solid var(--border);
}
.pd-btn-ghost:hover { background: var(--surface); color: var(--text); }

.pd-banner {
  display: flex; gap: 14px; align-items: start;
  padding: 14px 16px; border-radius: 8px;
  border: 1px solid var(--border);
}
.pd-banner-danger { background: var(--danger-bg); border-color: color-mix(in srgb, var(--danger) 25%, var(--border)); }
.pd-banner-icon {
  width: 28px; height: 28px; border-radius: 50%;
  display: grid; place-items: center; flex-shrink: 0;
  background: var(--danger); color: white; font-size: 13px; font-weight: 700;
}
.pd-banner-title { font-weight: 600; color: var(--text); font-size: 14px; margin-bottom: 2px; }
.pd-banner-text { font-size: 13px; color: var(--text); }
.pd-banner-link { color: var(--text); text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 2px; }

.pd-kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
.pd-kpi {
  background: var(--surface); border: 1px solid var(--border);
  padding: 16px; border-radius: 10px;
  display: flex; flex-direction: column; gap: 4px;
}
.pd-kpi-label { font-size: 11px; color: var(--text-2); text-transform: uppercase; letter-spacing: 0.04em; font-weight: 500; }
.pd-kpi-value { font-size: 28px; font-weight: 600; letter-spacing: -0.02em; color: var(--text); line-height: 1.1; }
.pd-kpi-hint { font-size: 12px; color: var(--text-2); margin-top: 2px; }
.pd-kpi-danger .pd-kpi-value { color: var(--danger); }
.pd-kpi-warning .pd-kpi-value { color: var(--warning); }

.pd-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
@media (max-width: 1024px) { .pd-cols { grid-template-columns: 1fr; } }

.pd-card {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 10px; overflow: hidden;
}
.pd-card-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 16px; border-bottom: 1px solid var(--border);
}
.pd-card-title { font-size: 14px; font-weight: 600; color: var(--text); margin: 0; }
.pd-card-link { font-size: 12px; color: var(--text-2); text-decoration: none; }
.pd-card-link:hover { color: var(--text); }

.pd-empty { padding: 36px 24px; text-align: center; display: flex; flex-direction: column; gap: 12px; align-items: center; }
.pd-empty-text { font-size: 13px; color: var(--text-2); }

.pd-list { display: flex; flex-direction: column; }
.pd-list-row {
  display: grid; grid-template-columns: 52px 1fr 16px;
  gap: 14px; padding: 12px 16px; align-items: center;
  text-decoration: none; color: inherit;
  border-bottom: 1px solid var(--border);
  transition: background-color 0.08s;
}
.pd-list-row:last-child { border-bottom: none; }
.pd-list-row:hover { background: var(--surface-2); }
.pd-list-date {
  background: var(--bg); border: 1px solid var(--border);
  border-radius: 6px; padding: 4px 0; text-align: center;
}
.pd-list-day { font-size: 16px; font-weight: 600; color: var(--text); line-height: 1.1; }
.pd-list-mon { font-size: 9px; color: var(--text-2); text-transform: uppercase; letter-spacing: 0.05em; }
.pd-list-line1 { display: flex; gap: 8px; align-items: center; font-size: 13px; color: var(--text); }
.pd-list-line2 { font-size: 12px; color: var(--text-2); margin-top: 2px; }
.pd-list-arrow { color: var(--text-3); }

.pd-reg {
  display: inline-block; padding: 1px 6px; border-radius: 4px;
  background: var(--surface-2); border: 1px solid var(--border);
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 12px; font-weight: 500; letter-spacing: 0.02em;
  color: var(--text);
}
.pd-mono { font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 12px; color: var(--text); }
.pd-muted { color: var(--text-2); }
.pd-dot { width: 6px; height: 6px; border-radius: 50%; display: inline-block; }

.pd-tag {
  display: inline-block; padding: 1px 6px; border-radius: 4px;
  font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;
}
.pd-tag-danger { background: var(--danger); color: white; }

.pd-fleet { display: flex; flex-direction: column; }
.pd-fleet-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px; text-decoration: none; color: inherit;
  border-bottom: 1px solid var(--border);
  transition: background-color 0.08s;
}
.pd-fleet-row:last-child { border-bottom: none; }
.pd-fleet-row:hover { background: var(--surface-2); }
.pd-fleet-aog { background: var(--danger-bg); }
.pd-fleet-reg { display: flex; align-items: center; gap: 8px; }
.pd-fleet-meta { display: flex; gap: 16px; font-size: 12px; color: var(--text); }
.pd-fleet-num { font-family: 'JetBrains Mono', ui-monospace, monospace; }

.pd-activity { display: flex; flex-direction: column; }
.pd-activity-row {
  display: grid; grid-template-columns: 100px 1fr; gap: 14px;
  padding: 10px 16px; font-size: 13px;
  text-decoration: none; color: inherit;
  border-bottom: 1px solid var(--border);
}
.pd-activity-row:last-child { border-bottom: none; }
.pd-activity-row:hover { background: var(--surface-2); }
.pd-activity-time { font-family: 'JetBrains Mono', ui-monospace, monospace; color: var(--text-2); font-size: 12px; }
.pd-activity-body { display: flex; gap: 8px; align-items: center; color: var(--text); }

.pd-footnote { font-size: 12px; color: var(--text-3); text-align: center; margin: 16px 0; }
.pd-link { color: var(--text-2); text-decoration: underline; }
`;
