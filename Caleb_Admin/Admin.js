import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

function Card({ title, children }) {
  return (
    <div style={{
      border: "1px solid #ddd",
      borderRadius: 12,
      padding: 16,
      background: "#fff",
      boxShadow: "0 1px 8px rgba(0,0,0,0.06)"
    }}>
      <div style={{ fontWeight: 700, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}

export default function Admin() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [overview, setOverview] = useState(null);
  const [activity, setActivity] = useState([]);

  const token = localStorage.getItem("token");

  useEffect(() => {
    if (!token) {
      navigate("/");
      return;
    }

    const authHeaders = { Authorization: `Bearer ${token}` };

    const fetchAll = async () => {
      setLoading(true);
      setErr("");

      try {
        const [overviewRes, activityRes] = await Promise.all([
          fetch("http://127.0.0.1:5001/admin/overview", { headers: authHeaders }),
          fetch("http://127.0.0.1:5001/admin/activity", { headers: authHeaders }),
        ]);

        // if token invalid/expired, bounce to login
        if ([401, 422].includes(overviewRes.status) || [401, 422].includes(activityRes.status)) {
          localStorage.removeItem("token");
          navigate("/");
          return;
        }

        // if not admin, show message
        if (overviewRes.status === 403 || activityRes.status === 403) {
          setErr("You are not authorized to view the admin dashboard.");
          setLoading(false);
          return;
        }

        const overviewData = overviewRes.ok ? await overviewRes.json() : null;
        const activityData = activityRes.ok ? await activityRes.json() : [];

        setOverview(overviewData);
        setActivity(activityData);
        setLoading(false);
      } catch (e) {
        setErr("Failed to load admin dashboard. Is Flask running?");
        setLoading(false);
      }
    };

    fetchAll();
  }, [token, navigate]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/");
  };

  if (loading) return <div style={{ padding: 24 }}>Loading…</div>;
  if (err) return <div style={{ padding: 24, color: "crimson" }}>{err}</div>;

  return (
    <div style={{ minHeight: "100vh", background: "#f6f7fb" }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "16px 24px",
        borderBottom: "1px solid #e7e7e7",
        background: "white"
      }}>
        <div style={{ fontSize: 20, fontWeight: 800 }}>Administrator Dashboard</div>
        <button onClick={handleLogout}>Logout</button>
      </div>

      <div style={{ padding: 24, display: "grid", gap: 16 }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 16
        }}>
          <Card title="Total Cost (MTD)">
            <div style={{ fontSize: 22, fontWeight: 800 }}>
              {overview?.cost_mtd ?? "—"}
            </div>
          </Card>

          <Card title="Admissions (7d)">
            <div style={{ fontSize: 22, fontWeight: 800 }}>
              {overview?.admissions_7d ?? "—"}
            </div>
          </Card>

          <Card title="Discharges (7d)">
            <div style={{ fontSize: 22, fontWeight: 800 }}>
              {overview?.discharges_7d ?? "—"}
            </div>
          </Card>

          <Card title="Waste Reduction Score">
            <div style={{ fontSize: 22, fontWeight: 800 }}>
              {overview?.waste_score ?? "—"}
            </div>
          </Card>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr",
          gap: 16
        }}>
          <Card title="Cost Breakdown by Department">
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {(overview?.cost_by_department ?? []).map((row) => (
                <li key={row.department}>
                  {row.department}: {row.cost}
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Generate Analytics Report">
            <button
              onClick={async () => {
                const res = await fetch("http://127.0.0.1:5001/admin/report", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify({ report_type: "weekly" }),
                });

                if (!res.ok) {
                  alert("Report generation failed");
                  return;
                }
                const data = await res.json();
                alert(`Report queued: ${data.report_id}`);
              }}
            >
              Generate Weekly Report
            </button>
          </Card>
        </div>

        <Card title="Activity Logs">
          {activity.length === 0 ? (
            <div>No recent activity.</div>
          ) : (
            <table width="100%" cellPadding="8" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left" }}>
                  <th style={{ borderBottom: "1px solid #eee" }}>Time</th>
                  <th style={{ borderBottom: "1px solid #eee" }}>Actor</th>
                  <th style={{ borderBottom: "1px solid #eee" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {activity.map((a) => (
                  <tr key={a.id}>
                    <td style={{ borderBottom: "1px solid #f1f1f1" }}>{a.time}</td>
                    <td style={{ borderBottom: "1px solid #f1f1f1" }}>{a.actor}</td>
                    <td style={{ borderBottom: "1px solid #f1f1f1" }}>{a.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  );
}
