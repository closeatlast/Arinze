import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ResponsiveContainer,
  LineChart, Line,
  BarChart, Bar,
  XAxis, YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";



function Card({ title, children }) {
  return (
    <div style={styles.card}>
      {title && <h3 style={styles.cardTitle}>{title}</h3>}
      {children}
    </div>
  );
}

function StatTile({ label, value, sub, color }) {
  return (
    <div style={{ ...styles.statTile, borderTop: `3px solid ${color || "#1a56db"}` }}>
      <span style={styles.statValue}>{value}</span>
      <span style={styles.statLabel}>{label}</span>
      {sub && <span style={styles.statSub}>{sub}</span>}
    </div>
  );
}


function ResourceBar({ label, allocated, used }) {
  const pct       = allocated > 0 ? Math.round((used / allocated) * 100) : 0;
  const barColor  = pct >= 90 ? "#dc2626" : pct >= 75 ? "#f59e0b" : "#1a56db";
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
        <span style={{ color: "#374151", fontWeight: 500 }}>{label}</span>
        <span style={{ color: "#6b7280" }}>{used} / {allocated} beds &nbsp;<strong style={{ color: barColor }}>{pct}%</strong></span>
      </div>
      <div style={styles.barTrack}>
        <div style={{ ...styles.barFill, width: `${Math.min(pct, 100)}%`, background: barColor }} />
      </div>
    </div>
  );
}

const fmt    = (v) => `$${Number(v).toLocaleString()}`;
const fmtK   = (v) => `$${(v / 1000).toFixed(0)}k`;

export default function Admin() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const [overview,       setOverview]       = useState(null);
  const [charts,         setCharts]         = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState("");
  const [clinicians,     setClinicians]     = useState({ clinicians: [], total: 0 });
  const [notifications,  setNotifications]  = useState({ total: 0, admitted_patients: 0 });

  useEffect(() => {
    if (!token) { navigate("/"); return; }

    const headers = { Authorization: `Bearer ${token}` };

    const fetchAll = async () => {
      try {
        const [ovRes, chRes, clinRes] = await Promise.all([
          fetch("http://127.0.0.1:5001/admin/overview",   { headers }),
          fetch("http://127.0.0.1:5001/admin/charts",     { headers }),
          fetch("http://127.0.0.1:5001/admin/clinicians", { headers }),
        ]);

        if ([401, 422].includes(ovRes.status)) { localStorage.removeItem("token"); navigate("/"); return; }
        if (ovRes.status === 403) { setError("Not authorized."); setLoading(false); return; }

        const ovData   = ovRes.ok  ? await ovRes.json()  : null;
        const chData   = chRes.ok  ? await chRes.json()  : null;
        const clinData = clinRes.ok ? await clinRes.json() : { clinicians: [], total: 0 };

        setOverview(ovData);
        setCharts(chData);
        setClinicians(clinData);
      } catch {
        setError("Could not load dashboard. Is the backend running?");
      } finally {
        setLoading(false);
      }
    };

    const fetchNotifs = async () => {
      try {
        const res = await fetch("http://127.0.0.1:5001/notifications", { headers });
        if (res.ok) setNotifications(await res.json());
      } catch {}
    };

    fetchAll();
    fetchNotifs();
  }, [token, navigate]);

  const handleLogout = () => { localStorage.removeItem("token"); localStorage.removeItem("role"); navigate("/"); };

  if (loading) return <div style={styles.centered}>Loading dashboard…</div>;
  if (error)   return <div style={{ ...styles.centered, color: "crimson" }}>{error}</div>;

  const occupancyPct = overview ? Math.round((overview.currently_admitted / overview.total_beds) * 100) : 0;
  const budgetPct    = overview ? Math.round((overview.cost_ytd / overview.annual_budget) * 100) : 0;

  const downloadReport = () => {
    const ov = overview || {};
    const resourceRows = (ov.resource_distribution || []).map((r) => {
      const pct = ov.total_beds > 0 ? Math.round((r.used / r.allocated) * 100) : 0;
      return `<tr><td>${r.label}</td><td style="text-align:right">${r.used}</td><td style="text-align:right">${r.allocated}</td><td style="text-align:right">${pct}%</td></tr>`;
    }).join("");

    const html = `<!DOCTYPE html><html><head><title>Admin Report – Arinze</title>
<style>
  body { font-family: Arial, sans-serif; margin: 40px; color: #111; font-size: 13px; }
  h1   { font-size: 22px; margin-bottom: 4px; }
  h2   { font-size: 15px; margin: 24px 0 8px; border-bottom: 2px solid #111; padding-bottom: 4px; }
  p    { margin: 2px 0; color: #555; }
  table{ width: 100%; border-collapse: collapse; margin-top: 6px; }
  th   { text-align: left; font-size: 11px; color: #666; padding: 6px 8px; border-bottom: 1px solid #ccc; }
  td   { padding: 6px 8px; border-bottom: 1px solid #eee; }
  .grid{ display: grid; grid-template-columns: 1fr 1fr; gap: 8px 32px; margin-top: 6px; }
  .stat{ font-size: 13px; padding: 4px 0; }
  .stat strong { float: right; }
  @media print { button { display: none; } }
</style></head><body>
<h1>Hospital Operations Report</h1>
<p><strong>Facility:</strong> Central Medical Center &nbsp;|&nbsp; <strong>Generated:</strong> ${new Date().toLocaleDateString()}</p>

<h2>Key Metrics</h2>
<div class="grid">
  <div class="stat">Total Patients <strong>${ov.total_patients ?? "—"}</strong></div>
  <div class="stat">Total Admissions <strong>${ov.total_admissions ?? "—"}</strong></div>
  <div class="stat">Currently Admitted <strong>${ov.currently_admitted ?? "—"}</strong></div>
  <div class="stat">Bed Occupancy <strong>${occupancyPct}% (${ov.currently_admitted} / ${ov.total_beds})</strong></div>
  <div class="stat">Admissions (7d) <strong>${ov.admissions_7d ?? "—"}</strong></div>
  <div class="stat">Discharges (7d) <strong>${ov.discharges_7d ?? "—"}</strong></div>
  <div class="stat">Avg Length of Stay <strong>${ov.avg_los ?? "—"} days</strong></div>
  <div class="stat">ICU Occupied <strong>${ov.icu_occupied ?? "—"} / ${ov.icu_beds ?? "—"}</strong></div>
</div>

<h2>Cost Summary</h2>
<div class="grid">
  <div class="stat">Cost MTD <strong>${fmt(ov.cost_mtd ?? 0)}</strong></div>
  <div class="stat">Cost Last Month <strong>${fmt(ov.cost_last_month ?? 0)}</strong></div>
  <div class="stat">Cost YTD <strong>${fmt(ov.cost_ytd ?? 0)}</strong></div>
  <div class="stat">Annual Budget <strong>${fmt(ov.annual_budget ?? 0)}</strong></div>
  <div class="stat">Budget Used (YTD) <strong>${budgetPct}%</strong></div>
  <div class="stat">Avg Cost / Patient <strong>${fmt(ov.avg_cost_per_patient ?? 0)}</strong></div>
  <div class="stat">Top Cost Category <strong>${ov.top_dept ?? "—"}</strong></div>
  <div class="stat">Total Procedure Cost <strong>${fmt(ov.procedure_cost_total ?? 0)}</strong></div>
</div>

<h2>Ward Resource Utilization</h2>
<table><thead><tr><th>Ward</th><th style="text-align:right">Occupied</th><th style="text-align:right">Capacity</th><th style="text-align:right">Utilization</th></tr></thead>
<tbody>${resourceRows || "<tr><td colspan='4'>No data</td></tr>"}</tbody></table>

</body></html>`;

    const w = window.open("", "_blank");
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  };

  const costOverTime         = charts?.cost_over_time  || [];
  const admissionsDischarges = charts?.adm_discharge   || [];
  const resources            = overview?.resource_distribution || [];

  return (
    <div style={styles.page}>
      <div style={styles.nav}>
        <div style={styles.navBrand}><span style={styles.navDot} />Administrator Dashboard</div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <span style={{ fontSize: 20, lineHeight: 1 }}>🔔</span>
            {notifications.total > 0 && (
              <span style={styles.notifBadge}>{notifications.total}</span>
            )}
          </div>
          <span style={styles.navSub}>
            {notifications.admitted_patients > 0
              ? `${notifications.admitted_patients} admitted`
              : "Central Medical Center"}
          </span>
          <button style={styles.reportBtn} onClick={downloadReport}>Download Report</button>
          <button style={styles.logoutBtn} onClick={handleLogout}>Logout</button>
        </div>
      </div>

      <div style={styles.body}>

        <div style={styles.tilesRow}>
          <StatTile label="Cost MTD"          color="#1a56db" value={fmt(overview.cost_mtd)}           sub={`vs ${fmt(overview.cost_last_month)} last mo`} />
          <StatTile label="YTD Spend"         color="#7c3aed" value={fmt(overview.cost_ytd)}           sub={`of ${fmt(overview.annual_budget)} budget`} />
          <StatTile label="Admissions (7d)"   color="#0891b2" value={overview.admissions_7d}           sub={`${overview.discharges_7d} discharges`} />
          <StatTile label="Bed Occupancy"     color="#059669" value={`${occupancyPct}%`}               sub={`${overview.currently_admitted} / ${overview.total_beds} beds`} />
          <StatTile label="Avg Length of Stay"color="#d97706" value={`${overview.avg_los} days`}       sub={`${overview.total_patients} total patients`} />
          <StatTile label="Total Patients"    color="#dc2626" value={overview.total_patients}          sub={`${overview.total_admissions} admissions on record`} />
        </div>

        <div style={styles.chartRow}>
          <Card title="Monthly Billing — Discharged Patients">
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={costOverTime} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={fmtK} tick={{ fontSize: 12 }} width={46} />
                <Tooltip formatter={(v) => fmt(v)} />
                <Line type="monotone" dataKey="cost" stroke="#1a56db" strokeWidth={2.5}
                  dot={{ r: 4, fill: "#1a56db" }} activeDot={{ r: 6 }} name="Total Cost" />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <Card title="Admissions vs Discharges (Weekly)">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={admissionsDischarges} margin={{ top: 4, right: 16, left: 0, bottom: 0 }} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} width={36} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="admissions" name="Admissions" fill="#1a56db" radius={[4, 4, 0, 0]} />
                <Bar dataKey="discharges" name="Discharges" fill="#06b6d4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>

        <Card title={`Clinicians on Duty — ${clinicians.total} active`}>
          <div style={styles.clinicianGrid}>
            {clinicians.clinicians.length === 0
              ? <p style={{ fontSize: 13, color: "#9ca3af", gridColumn: "1/-1" }}>No active admissions.</p>
              : clinicians.clinicians.map((c) => (
                <div key={c.name} style={styles.clinicianRow}>
                  <span style={styles.clinicianName}>{c.name}</span>
                  <span style={styles.clinicianBadge}>{c.active_patients} patient{c.active_patients !== 1 ? "s" : ""}</span>
                </div>
              ))
            }
          </div>
        </Card>

        <div style={styles.summaryGrid}>

          <Card title="Hospital Overview">
            <div style={styles.overviewGrid}>
              <OvItem label="Total Beds"     value={overview.total_beds} />
              <OvItem label="Occupied"       value={overview.currently_admitted} color="#1a56db" />
              <OvItem label="Available"      value={overview.available_beds}     color="#059669" />
              <OvItem label="ICU Beds"       value={`${overview.icu_occupied} / ${overview.icu_beds}`} />
              <OvItem label="Staff On Duty"  value={overview.staff_on_duty} />
              <OvItem label="Occupancy Rate" value={`${occupancyPct}%`} color={occupancyPct > 85 ? "#dc2626" : "#059669"} />
            </div>
          </Card>

          <Card title="Cost Summary">
            <div style={styles.overviewGrid}>
              <OvItem label="Cost MTD"       value={fmt(overview.cost_mtd)}          color="#1a56db" />
              <OvItem label="Last Month"     value={fmt(overview.cost_last_month)} />
              <OvItem label="YTD Spend"      value={fmt(overview.cost_ytd)} />
              <OvItem label="Annual Budget"  value={fmt(overview.annual_budget)} />
              <OvItem label="Top Category"   value={overview.top_dept} small />
              <OvItem label="Avg / Patient"  value={fmt(overview.avg_cost_per_patient)} />
            </div>
            <div style={styles.barTrack}>
              <div style={{ ...styles.barFill, width: `${Math.min(budgetPct, 100)}%`, background: budgetPct > 90 ? "#dc2626" : "#1a56db" }} />
            </div>
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>{budgetPct}% of annual budget used (YTD)</div>
          </Card>

          <Card title="Patient Flow">
            <div style={styles.overviewGrid}>
              <OvItem label="Admissions (7d)"   value={overview.admissions_7d}    color="#1a56db" />
              <OvItem label="Discharges (7d)"   value={overview.discharges_7d}    color="#059669" />
              <OvItem label="Avg LOS"           value={`${overview.avg_los} days`} />
              <OvItem label="Pending Discharge" value={overview.pending_discharge} color="#d97706" />
              <OvItem label="Total Admissions"  value={overview.total_admissions} />
              <OvItem label="Total Patients"    value={overview.total_patients} />
            </div>
          </Card>

          <Card title="Resource Distribution">
            {resources.length === 0
              ? <p style={{ fontSize: 13, color: "#9ca3af" }}>No active admissions by ward.</p>
              : resources.map((r) => <ResourceBar key={r.label} {...r} />)
            }
          </Card>

        </div>
      </div>
    </div>
  );
}

function OvItem({ label, value, color, small }) {
  return (
    <div style={styles.overviewItem}>
      <span style={styles.ovLabel}>{label}</span>
      <span style={{ ...styles.ovValue, color: color || "#111827", fontSize: small ? 13 : 16 }}>{value}</span>
    </div>
  );
}

const styles = {
  page:     { fontFamily: "'Segoe UI', sans-serif", background: "#f0f4f8", minHeight: "100vh", color: "#1a202c" },
  centered: { display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontSize: 16 },

  nav: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 24px", height: 56, background: "#fff", borderBottom: "1px solid #e5e7eb", position: "sticky", top: 0, zIndex: 10 },
  navBrand:   { display: "flex", alignItems: "center", gap: 10, fontWeight: 800, fontSize: 17, color: "#111827" },
  navDot:     { width: 10, height: 10, borderRadius: "50%", background: "#1a56db" },
  navSub:     { fontSize: 13, color: "#6b7280" },
  logoutBtn:  { padding: "6px 14px", border: "1px solid #d1d5db", borderRadius: 7, background: "#fff", cursor: "pointer", fontSize: 13, color: "#374151" },
  notifBadge: { position: "absolute", top: -6, right: -8, background: "#ef4444", color: "#fff", fontSize: 10, fontWeight: 700, borderRadius: "50%", width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center" },
  reportBtn:  { padding: "6px 14px", border: "1px solid #1a56db", borderRadius: 7, background: "#eff6ff", cursor: "pointer", fontSize: 13, color: "#1a56db", fontWeight: 600 },

  body:     { padding: 24, display: "flex", flexDirection: "column", gap: 20 },

  tilesRow: { display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 14 },
  statTile: { background: "#fff", borderRadius: 10, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 4, boxShadow: "0 1px 3px rgba(0,0,0,0.07)" },
  statValue:{ fontSize: 22, fontWeight: 800, color: "#111827" },
  statLabel:{ fontSize: 12, fontWeight: 600, color: "#6b7280" },
  statSub:  { fontSize: 11, color: "#9ca3af", marginTop: 2 },

  chartRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 },

  card:     { background: "#fff", borderRadius: 12, padding: "20px 22px", boxShadow: "0 1px 4px rgba(0,0,0,0.07)", border: "1px solid #e5e7eb" },
  cardTitle:{ margin: "0 0 16px", fontSize: 14, fontWeight: 700, color: "#111827", textTransform: "uppercase", letterSpacing: "0.05em", paddingBottom: 10, borderBottom: "1px solid #f3f4f6" },

  summaryGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20 },
  overviewGrid:{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 16px" },
  overviewItem:{ display: "flex", flexDirection: "column", gap: 2 },
  ovLabel:  { fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" },
  ovValue:  { fontSize: 16, fontWeight: 700 },

  barTrack: { height: 8, background: "#e5e7eb", borderRadius: 99, overflow: "hidden", marginTop: 10 },
  barFill:  { height: "100%", borderRadius: 99, transition: "width 0.4s ease" },

  clinicianGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "8px 16px" },
  clinicianRow:  { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 10px", background: "#f9fafb", borderRadius: 8, border: "1px solid #e5e7eb" },
  clinicianName: { fontSize: 13, fontWeight: 600, color: "#111827" },
  clinicianBadge:{ fontSize: 11, fontWeight: 700, color: "#1a56db", background: "#eff6ff", padding: "2px 8px", borderRadius: 20 },
};
