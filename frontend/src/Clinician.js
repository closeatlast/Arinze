import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const APPT_TYPES = [
  "Follow-up", "Consultation", "Lab Review", "Physical Exam",
  "Pre-op Assessment", "Post-discharge", "Telemedicine", "Imaging Review",
];
const APPT_TIMES = [
  "08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30",
  "13:00","13:30","14:00","14:30","15:00","15:30","16:00",
];

function StatusPill({ status }) {
  const colors = {
    "Admitted":           { bg: "#dbeafe", color: "#1e40af" },
    "Under Observation":  { bg: "#fef9c3", color: "#854d0e" },
    "Discharged":         { bg: "#dcfce7", color: "#166534" },
    "Scheduled":          { bg: "#dbeafe", color: "#1e40af" },
    "Completed":          { bg: "#dcfce7", color: "#166534" },
    "Cancelled":          { bg: "#f3f4f6", color: "#6b7280" },
  };
  const c = colors[status] || { bg: "#f3f4f6", color: "#374151" };
  return <span style={{ ...styles.pill, background: c.bg, color: c.color }}>{status}</span>;
}

function VitalChip({ label, value, alert }) {
  return (
    <div style={{ ...styles.vitalChip, borderColor: alert ? "#fca5a5" : "#e5e7eb", background: alert ? "#fff7f7" : "#f9fafb" }}>
      <span style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
      <span style={{ fontSize: 20, fontWeight: 700, color: alert ? "#dc2626" : "#111827" }}>{value}</span>
    </div>
  );
}

function SectionCard({ title, icon, children }) {
  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <span style={styles.cardIcon}>{icon}</span>
        <h3 style={styles.cardTitle}>{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Tag({ text, color }) {
  const palette = {
    red:   { bg: "#fee2e2", color: "#991b1b" },
    blue:  { bg: "#dbeafe", color: "#1e40af" },
    gray:  { bg: "#f3f4f6", color: "#374151" },
    green: { bg: "#dcfce7", color: "#166534" },
  };
  const c = palette[color] || palette.gray;
  return <span style={{ ...styles.tag, background: c.bg, color: c.color }}>{text}</span>;
}

export default function Clinician() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const [patientList,    setPatientList]    = useState([]);
  const [selectedId,     setSelectedId]     = useState(null);
  const [patient,        setPatient]        = useState(null);
  const [listLoading,    setListLoading]    = useState(true);
  const [detailLoading,  setDetailLoading]  = useState(false);
  const [error,          setError]          = useState("");
  const [search,         setSearch]         = useState("");

  const [activeTab,      setActiveTab]      = useState("snapshot");

  const [appointments,   setAppointments]   = useState([]);
  const [apptLoading,    setApptLoading]    = useState(false);
  const [newApptForm,    setNewApptForm]    = useState({ clinician: "", appt_date: "", appt_time: "09:00", appt_type: "Follow-up", notes: "" });
  const [apptSubmitting, setApptSubmitting] = useState(false);
  const [apptSuccess,    setApptSuccess]    = useState(false);

  const [messages,       setMessages]       = useState([]);
  const [msgLoading,     setMsgLoading]     = useState(false);
  const [newMsgForm,     setNewMsgForm]     = useState({ sender: "Clinician", subject: "", body: "" });
  const [msgSubmitting,  setMsgSubmitting]  = useState(false);
  const [msgSuccess,     setMsgSuccess]     = useState(false);

  const [notifications,  setNotifications]  = useState({ total: 0, todays_appointments: 0 });

  const [noteForm,       setNoteForm]       = useState({ author: "", note: "" });
  const [noteSubmitting, setNoteSubmitting] = useState(false);
  const [noteSuccess,    setNoteSuccess]    = useState(false);

  const [editingVitals,    setEditingVitals]    = useState(false);
  const [vitalsForm,       setVitalsForm]       = useState({});
  const [vitalsSubmitting, setVitalsSubmitting] = useState(false);

  const [showDischarge,       setShowDischarge]       = useState(false);
  const [dischargeForm,       setDischargeForm]       = useState({ discharge_date: "2026-03-10", summary: "" });
  const [dischargeSubmitting, setDischargeSubmitting] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (!token) { navigate("/"); return; }

    const fetchList = async () => {
      try {
        const res = await fetch("http://127.0.0.1:5001/patients", { headers });
        if ([401, 422].includes(res.status)) { localStorage.removeItem("token"); navigate("/"); return; }
        const data = await res.json();
        setPatientList(data);
        if (data.length > 0) setSelectedId(data[0].id);
      } catch {
        setError("Could not load patients. Is the backend running?");
      } finally {
        setListLoading(false);
      }
    };

    const fetchNotifs = async () => {
      try {
        const res = await fetch("http://127.0.0.1:5001/notifications", { headers });
        if (res.ok) setNotifications(await res.json());
      } catch {}
    };

    fetchList();
    fetchNotifs();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setActiveTab("snapshot");
    setEditingVitals(false);
    setShowDischarge(false);
    setNoteSuccess(false);

    const fetchDetail = async () => {
      setDetailLoading(true);
      try {
        const res  = await fetch(`http://127.0.0.1:5001/patients/${selectedId}`, { headers });
        setPatient(await res.json());
      } catch {
        setError("Could not load patient details.");
      } finally {
        setDetailLoading(false);
      }
    };

    const fetchAppts = async () => {
      setApptLoading(true);
      try {
        const res = await fetch(`http://127.0.0.1:5001/appointments/patient/${selectedId}`, { headers });
        setAppointments(res.ok ? await res.json() : []);
      } catch { setAppointments([]); }
      finally  { setApptLoading(false); }
    };

    const fetchMsgs = async () => {
      setMsgLoading(true);
      try {
        const res = await fetch(`http://127.0.0.1:5001/messages/patient/${selectedId}`, { headers });
        setMessages(res.ok ? await res.json() : []);
      } catch { setMessages([]); }
      finally  { setMsgLoading(false); }
    };

    fetchDetail();
    fetchAppts();
    fetchMsgs();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const handleLogout = () => { localStorage.removeItem("token"); localStorage.removeItem("role"); navigate("/"); };

  const filtered = patientList.filter(
    (p) =>
      `${p.first_name} ${p.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
      p.mrn.toLowerCase().includes(search.toLowerCase())
  );

  const adm    = patient?.admission;
  const vitals = adm?.vitals;
  const status = adm?.status || "—";

  const handleNewAppt = async (e) => {
    e.preventDefault();
    setApptSubmitting(true);
    try {
      const res = await fetch("http://127.0.0.1:5001/appointments", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ ...newApptForm, patient_id: selectedId }),
      });
      if (res.ok) {
        const created = await res.json();
        setAppointments((prev) =>
          [...prev, created].sort((a, b) => a.appt_date.localeCompare(b.appt_date))
        );
        setNewApptForm({ clinician: "", appt_date: "", appt_time: "09:00", appt_type: "Follow-up", notes: "" });
        setApptSuccess(true);
        setTimeout(() => setApptSuccess(false), 3000);
      }
    } catch {}
    setApptSubmitting(false);
  };

  const handleApptStatus = async (apptId, newStatus) => {
    try {
      const res = await fetch(`http://127.0.0.1:5001/appointments/${apptId}`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const updated = await res.json();
        setAppointments((prev) => prev.map((a) => (a.id === apptId ? updated : a)));
      }
    } catch {}
  };

  const handleSendMsg = async (e) => {
    e.preventDefault();
    setMsgSubmitting(true);
    try {
      const res = await fetch("http://127.0.0.1:5001/messages", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ ...newMsgForm, patient_id: selectedId }),
      });
      if (res.ok) {
        const created = await res.json();
        setMessages((prev) => [created, ...prev]);
        setNewMsgForm({ sender: "Clinician", subject: "", body: "" });
        setMsgSuccess(true);
        setTimeout(() => setMsgSuccess(false), 3000);
      }
    } catch {}
    setMsgSubmitting(false);
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!adm) return;
    setNoteSubmitting(true);
    try {
      const res = await fetch(`http://127.0.0.1:5001/admissions/${adm.id}/notes`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(noteForm),
      });
      if (res.ok) {
        const created = await res.json();
        setPatient((prev) => ({
          ...prev,
          admission: {
            ...prev.admission,
            clinical_notes: [created, ...(prev.admission.clinical_notes || [])],
          },
        }));
        setNoteForm({ author: "", note: "" });
        setNoteSuccess(true);
        setTimeout(() => setNoteSuccess(false), 3000);
      }
    } catch {}
    setNoteSubmitting(false);
  };

  const openVitalsEditor = () => {
    const v = patient?.admission?.vitals || {};
    setVitalsForm({
      heart_rate:     v.heart_rate     ?? "",
      blood_pressure: v.blood_pressure ?? "",
      temperature:    v.temperature    ?? "",
      spo2:           v.spo2           ?? "",
      resp_rate:      v.resp_rate      ?? "",
      weight:         v.weight         ?? "",
      height:         v.height         ?? "",
    });
    setEditingVitals(true);
  };

  const handleUpdateVitals = async (e) => {
    e.preventDefault();
    if (!adm) return;
    setVitalsSubmitting(true);
    try {
      const res = await fetch(`http://127.0.0.1:5001/admissions/${adm.id}/vitals`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(vitalsForm),
      });
      if (res.ok) {
        const updated = await res.json();
        setPatient((prev) => ({
          ...prev,
          admission: { ...prev.admission, vitals: updated },
        }));
        setEditingVitals(false);
      }
    } catch {}
    setVitalsSubmitting(false);
  };

  const handleDischarge = async (e) => {
    e.preventDefault();
    if (!adm) return;
    setDischargeSubmitting(true);
    try {
      const res = await fetch(`http://127.0.0.1:5001/admissions/${adm.id}/discharge`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(dischargeForm),
      });
      if (res.ok) {
        const updated = await res.json();
        setPatient((prev) => ({ ...prev, admission: updated }));
        setPatientList((prev) =>
          prev.map((p) =>
            p.id === selectedId ? { ...p, status: "Discharged" } : p
          )
        );
        setShowDischarge(false);
      }
    } catch {}
    setDischargeSubmitting(false);
  };

  return (
    <div style={styles.page}>
      <div style={styles.nav}>
        <div style={styles.navBrand}><span style={styles.navDot} />Clinician Dashboard</div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <span style={{ fontSize: 20, lineHeight: 1 }}>🔔</span>
            {notifications.total > 0 && (
              <span style={styles.notifBadge}>{notifications.total}</span>
            )}
          </div>
          <span style={styles.navUser}>
            {notifications.todays_appointments > 0
              ? `${notifications.todays_appointments} appt${notifications.todays_appointments !== 1 ? "s" : ""} today`
              : "Clinician Portal"}
          </span>
          <button style={styles.logoutBtn} onClick={handleLogout}>Logout</button>
        </div>
      </div>

      <div style={styles.body}>
        <aside style={styles.sidebar}>
          <p style={styles.sidebarLabel}>Patient List</p>
          <input
            placeholder="Search name or MRN…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={styles.searchInput}
          />

          {listLoading ? (
            <p style={{ fontSize: 13, color: "#9ca3af", padding: "8px 4px" }}>Loading…</p>
          ) : error ? (
            <p style={{ fontSize: 13, color: "crimson", padding: "8px 4px" }}>{error}</p>
          ) : (
            <div style={styles.patientList}>
              {filtered.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  style={{
                    ...styles.patientItem,
                    background:   p.id === selectedId ? "#eff6ff" : "#fff",
                    borderColor:  p.id === selectedId ? "#1a56db" : "#e5e7eb",
                  }}
                >
                  <div style={styles.patientAvatar}>
                    {p.first_name?.[0]}{p.last_name?.[0]}
                  </div>
                  <div style={{ flex: 1, textAlign: "left", minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {p.first_name} {p.last_name}
                    </div>
                    <div style={{ fontSize: 11, color: "#6b7280" }}>{p.mrn} · {p.ward}</div>
                  </div>
                  <StatusPill status={p.status} />
                </button>
              ))}
            </div>
          )}
        </aside>

        <main style={styles.main}>
          {detailLoading || !patient ? (
            <div style={styles.placeholder}>
              {detailLoading ? "Loading patient…" : "Select a patient"}
            </div>
          ) : (
            <>
              <div style={styles.headerCard}>
                <div style={styles.avatarLarge}>
                  {patient.first_name?.[0]}{patient.last_name?.[0]}
                </div>
                <div style={styles.headerInfo}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <h2 style={styles.patientName}>{patient.first_name} {patient.last_name}</h2>
                    <StatusPill status={status} />
                    {adm && <span style={styles.admTypeTag}>{adm.admission_type}</span>}
                  </div>
                  <div style={styles.headerMeta}>
                    <span><strong>MRN:</strong> {patient.mrn}</span>
                    <span><strong>DOB:</strong> {patient.dob}</span>
                    <span><strong>Age:</strong> {patient.age} yrs</span>
                    <span><strong>Gender:</strong> {patient.gender}</span>
                    <span><strong>Blood Type:</strong> {patient.blood_type}</span>
                    <span><strong>Phone:</strong> {patient.phone}</span>
                  </div>
                  {adm && (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                      <span style={styles.infoChip}>📍 {adm.ward} · {adm.bed}</span>
                      <span style={styles.infoChip}>👨‍⚕️ {adm.attending_physician}</span>
                      <span style={styles.infoChip}>📅 Admitted: {adm.admit_date}</span>
                      {adm.discharge_date && (
                        <span style={styles.infoChip}>🏠 Discharged: {adm.discharge_date}</span>
                      )}
                    </div>
                  )}
                  {patient.allergies?.length > 0 && (
                    <div style={{ display: "flex", gap: 6, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#dc2626" }}>⚠ ALLERGIES:</span>
                      {patient.allergies.map((a) => <Tag key={a} text={a} color="red" />)}
                    </div>
                  )}
                  {adm && adm.status !== "Discharged" && (
                    <div style={{ marginTop: 14 }}>
                      <button
                        style={styles.dischargeBtn}
                        onClick={() => setShowDischarge((v) => !v)}
                      >
                        🏠 {showDischarge ? "Cancel Discharge" : "Discharge Patient"}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {showDischarge && adm && adm.status !== "Discharged" && (
                <div style={styles.dischargePanel}>
                  <p style={styles.dischargePanelTitle}>📋 Complete Discharge</p>
                  <form onSubmit={handleDischarge} style={styles.form2col}>
                    <div>
                      <label style={styles.formLabel}>Discharge Date</label>
                      <input
                        type="date"
                        style={styles.formInput}
                        value={dischargeForm.discharge_date}
                        onChange={(e) => setDischargeForm((p) => ({ ...p, discharge_date: e.target.value }))}
                        required
                      />
                    </div>
                    <div style={{ gridColumn: "1 / -1" }}>
                      <label style={styles.formLabel}>Discharge Summary (optional)</label>
                      <textarea
                        style={{ ...styles.formInput, resize: "vertical", minHeight: 72 }}
                        value={dischargeForm.summary}
                        placeholder="Brief summary of treatment, outcomes, and follow-up instructions…"
                        onChange={(e) => setDischargeForm((p) => ({ ...p, summary: e.target.value }))}
                      />
                    </div>
                    <div style={{ gridColumn: "1 / -1", display: "flex", gap: 10, justifyContent: "flex-end" }}>
                      <button type="button" style={styles.cancelBtn} onClick={() => setShowDischarge(false)}>
                        Cancel
                      </button>
                      <button type="submit" style={styles.dischargeConfirmBtn} disabled={dischargeSubmitting}>
                        {dischargeSubmitting ? "Processing…" : "✓ Confirm Discharge"}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              <div style={styles.tabBar}>
                {[
                  { key: "snapshot",     label: "🏥 Snapshot" },
                  { key: "appointments", label: `📅 Appointments${appointments.length ? ` (${appointments.length})` : ""}` },
                  { key: "messages",     label: `✉️ Messages${messages.length ? ` (${messages.length})` : ""}` },
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    style={{ ...styles.tabBtn, ...(activeTab === key ? styles.tabBtnActive : {}) }}
                    onClick={() => setActiveTab(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {activeTab === "snapshot" && (
                !adm ? (
                  <div style={styles.placeholder}>No admission on record for this patient.</div>
                ) : (
                  <div style={styles.grid}>
                    <SectionCard title="Admission Summary" icon="🏥">
                      <div style={styles.summaryGrid}>
                        <div style={styles.summaryItem}>
                          <span style={styles.summaryLabel}>Chief Complaint</span>
                          <span style={styles.summaryValue}>{adm.chief_complaint}</span>
                        </div>
                        <div style={styles.summaryItem}>
                          <span style={styles.summaryLabel}>Primary Diagnosis</span>
                          <span style={{ ...styles.summaryValue, color: "#1a56db", fontWeight: 700 }}>{adm.primary_diagnosis}</span>
                        </div>
                        <div style={styles.summaryItem}>
                          <span style={styles.summaryLabel}>Secondary Diagnoses</span>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                            {adm.secondary_diagnoses?.map((d) => <Tag key={d} text={d} color="blue" />)}
                          </div>
                        </div>
                        <div style={styles.summaryItem}>
                          <span style={styles.summaryLabel}>Admission Type</span>
                          <span style={styles.summaryValue}>{adm.admission_type}</span>
                        </div>
                      </div>
                      <div style={styles.notesBox}>
                        <span style={styles.summaryLabel}>Admission Notes</span>
                        <p style={styles.notesText}>{adm.admission_notes}</p>
                      </div>
                    </SectionCard>

                    <div style={styles.card}>
                      <div style={styles.cardHeader}>
                        <span style={styles.cardIcon}>💓</span>
                        <h3 style={styles.cardTitle}>Vitals Snapshot</h3>
                        <button
                          style={styles.editSmallBtn}
                          onClick={editingVitals ? () => setEditingVitals(false) : openVitalsEditor}
                        >
                          {editingVitals ? "✕ Cancel" : "✏ Edit Vitals"}
                        </button>
                      </div>
                      {editingVitals ? (
                        <form onSubmit={handleUpdateVitals} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          <div style={styles.vitalsEditGrid}>
                            {[
                              { key: "heart_rate",     label: "Heart Rate (bpm)",  type: "number" },
                              { key: "blood_pressure", label: "Blood Pressure",    type: "text" },
                              { key: "temperature",    label: "Temperature (°C)",  type: "text" },
                              { key: "spo2",           label: "SpO₂ (%)",          type: "text" },
                              { key: "resp_rate",      label: "Resp. Rate (/min)", type: "number" },
                              { key: "weight",         label: "Weight",            type: "text" },
                              { key: "height",         label: "Height",            type: "text" },
                            ].map(({ key, label, type }) => (
                              <div key={key}>
                                <label style={styles.formLabel}>{label}</label>
                                <input
                                  type={type}
                                  style={styles.formInput}
                                  value={vitalsForm[key] ?? ""}
                                  onChange={(e) => setVitalsForm((p) => ({ ...p, [key]: e.target.value }))}
                                />
                              </div>
                            ))}
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <button type="submit" style={styles.submitBtn} disabled={vitalsSubmitting}>
                              {vitalsSubmitting ? "Saving…" : "Save Vitals"}
                            </button>
                          </div>
                        </form>
                      ) : vitals ? (
                        <div style={styles.vitalsGrid}>
                          <VitalChip label="Heart Rate"     value={`${vitals.heart_rate} bpm`}  alert={vitals.heart_rate > 100 || vitals.heart_rate < 50} />
                          <VitalChip label="Blood Pressure" value={vitals.blood_pressure} />
                          <VitalChip label="Temperature"    value={vitals.temperature}            alert={parseFloat(vitals.temperature) > 38} />
                          <VitalChip label="SpO₂"           value={vitals.spo2}                   alert={parseFloat(vitals.spo2) < 95} />
                          <VitalChip label="Resp. Rate"     value={`${vitals.resp_rate} /min`}    alert={vitals.resp_rate > 20} />
                          <VitalChip label="Weight"         value={vitals.weight} />
                          <VitalChip label="Height"         value={vitals.height} />
                        </div>
                      ) : (
                        <p style={{ fontSize: 13, color: "#9ca3af" }}>No vitals recorded.</p>
                      )}
                    </div>

                    <SectionCard title="Medications" icon="💊">
                      {adm.medications?.length > 0 ? (
                        <table style={styles.table}>
                          <thead>
                            <tr>{["Medication", "Route", "Frequency", "Status"].map((h) => (
                              <th key={h} style={styles.th}>{h}</th>
                            ))}</tr>
                          </thead>
                          <tbody>
                            {adm.medications.map((m, i) => (
                              <tr key={m.id} style={{ background: i % 2 === 0 ? "#fff" : "#f9fafb" }}>
                                <td style={styles.td}>{m.name}</td>
                                <td style={styles.td}>{m.route}</td>
                                <td style={styles.td}>{m.frequency}</td>
                                <td style={styles.td}>
                                  <Tag text={m.status} color={m.status === "Active" ? "blue" : "gray"} />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : <p style={{ fontSize: 13, color: "#9ca3af" }}>No medications recorded.</p>}
                    </SectionCard>

                    <SectionCard title="Clinical Notes" icon="📋">
                      {adm.clinical_notes?.length > 0 ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                          {adm.clinical_notes.map((n) => (
                            <div key={n.id} style={styles.noteCard}>
                              <div style={styles.noteMeta}>
                                <span style={{ fontWeight: 600, color: "#1a56db" }}>{n.author}</span>
                                <span style={{ color: "#9ca3af", fontSize: 12 }}>{n.created_at}</span>
                              </div>
                              <p style={{ margin: "6px 0 0", fontSize: 13, color: "#374151", lineHeight: 1.6 }}>{n.note}</p>
                            </div>
                          ))}
                        </div>
                      ) : <p style={{ fontSize: 13, color: "#9ca3af" }}>No clinical notes recorded.</p>}

                      <div style={styles.addNoteSection}>
                        <p style={styles.addNoteTitle}>Add Clinical Note</p>
                        {noteSuccess && (
                          <div style={{ ...styles.successBanner, marginBottom: 10 }}>✅ Note added successfully.</div>
                        )}
                        <form onSubmit={handleAddNote} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          <input
                            style={styles.formInput}
                            placeholder="Author / Your name"
                            value={noteForm.author}
                            onChange={(e) => setNoteForm((p) => ({ ...p, author: e.target.value }))}
                            required
                          />
                          <textarea
                            style={{ ...styles.formInput, resize: "vertical", minHeight: 80 }}
                            placeholder="Note content…"
                            value={noteForm.note}
                            onChange={(e) => setNoteForm((p) => ({ ...p, note: e.target.value }))}
                            required
                          />
                          <div style={{ textAlign: "right" }}>
                            <button type="submit" style={styles.submitBtn} disabled={noteSubmitting}>
                              {noteSubmitting ? "Adding…" : "Add Note"}
                            </button>
                          </div>
                        </form>
                      </div>
                    </SectionCard>
                  </div>
                )
              )}

              {activeTab === "appointments" && (
                <div>
                  <SectionCard title="Schedule New Appointment" icon="➕">
                    {apptSuccess && (
                      <div style={styles.successBanner}>✅ Appointment scheduled successfully!</div>
                    )}
                    <form onSubmit={handleNewAppt} style={styles.form2col}>
                      <div>
                        <label style={styles.formLabel}>Clinician Name</label>
                        <input
                          style={styles.formInput}
                          value={newApptForm.clinician}
                          placeholder="e.g. Dr. Jane Smith"
                          onChange={(e) => setNewApptForm((p) => ({ ...p, clinician: e.target.value }))}
                          required
                        />
                      </div>
                      <div>
                        <label style={styles.formLabel}>Appointment Type</label>
                        <select
                          style={styles.formInput}
                          value={newApptForm.appt_type}
                          onChange={(e) => setNewApptForm((p) => ({ ...p, appt_type: e.target.value }))}
                        >
                          {APPT_TYPES.map((t) => <option key={t}>{t}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={styles.formLabel}>Date</label>
                        <input
                          type="date"
                          style={styles.formInput}
                          value={newApptForm.appt_date}
                          onChange={(e) => setNewApptForm((p) => ({ ...p, appt_date: e.target.value }))}
                          required
                        />
                      </div>
                      <div>
                        <label style={styles.formLabel}>Time</label>
                        <select
                          style={styles.formInput}
                          value={newApptForm.appt_time}
                          onChange={(e) => setNewApptForm((p) => ({ ...p, appt_time: e.target.value }))}
                        >
                          {APPT_TIMES.map((t) => <option key={t}>{t}</option>)}
                        </select>
                      </div>
                      <div style={{ gridColumn: "1 / -1" }}>
                        <label style={styles.formLabel}>Notes (optional)</label>
                        <textarea
                          style={{ ...styles.formInput, resize: "vertical", minHeight: 64 }}
                          value={newApptForm.notes}
                          placeholder="Any additional notes…"
                          onChange={(e) => setNewApptForm((p) => ({ ...p, notes: e.target.value }))}
                        />
                      </div>
                      <div style={{ gridColumn: "1 / -1", textAlign: "right" }}>
                        <button type="submit" style={styles.submitBtn} disabled={apptSubmitting}>
                          {apptSubmitting ? "Scheduling…" : "Schedule Appointment"}
                        </button>
                      </div>
                    </form>
                  </SectionCard>

                  <div style={{ marginTop: 20 }}>
                    <p style={styles.sectionHeading}>All Appointments</p>
                    {apptLoading ? (
                      <p style={{ color: "#9ca3af", fontSize: 14 }}>Loading appointments…</p>
                    ) : appointments.length === 0 ? (
                      <p style={{ color: "#9ca3af", fontSize: 14 }}>No appointments on record.</p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {appointments.map((a) => (
                          <div key={a.id} style={styles.apptRow}>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                                <span style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>{a.appt_type}</span>
                                <StatusPill status={a.status} />
                              </div>
                              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                                📅 {a.appt_date} at {a.appt_time} &nbsp;·&nbsp; 👨‍⚕️ {a.clinician}
                              </div>
                              {a.notes && (
                                <p style={{ margin: "4px 0 0", fontSize: 12, color: "#4b5563" }}>{a.notes}</p>
                              )}
                            </div>
                            {a.status === "Scheduled" && (
                              <div style={{ display: "flex", gap: 6, flexShrink: 0, alignSelf: "center" }}>
                                <button style={styles.actionBtnGreen} onClick={() => handleApptStatus(a.id, "Completed")}>
                                  Complete
                                </button>
                                <button style={styles.actionBtnRed} onClick={() => handleApptStatus(a.id, "Cancelled")}>
                                  Cancel
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === "messages" && (
                <div>
                  <SectionCard title="Send Message to Patient" icon="✉️">
                    {msgSuccess && (
                      <div style={styles.successBanner}>✅ Message sent successfully!</div>
                    )}
                    <form onSubmit={handleSendMsg} style={styles.formSingle}>
                      <div>
                        <label style={styles.formLabel}>From (Sender Name)</label>
                        <input
                          style={styles.formInput}
                          value={newMsgForm.sender}
                          placeholder="e.g. Dr. Jane Smith"
                          onChange={(e) => setNewMsgForm((p) => ({ ...p, sender: e.target.value }))}
                          required
                        />
                      </div>
                      <div>
                        <label style={styles.formLabel}>Subject</label>
                        <input
                          style={styles.formInput}
                          value={newMsgForm.subject}
                          placeholder="e.g. Lab Results Ready"
                          onChange={(e) => setNewMsgForm((p) => ({ ...p, subject: e.target.value }))}
                          required
                        />
                      </div>
                      <div>
                        <label style={styles.formLabel}>Message</label>
                        <textarea
                          style={{ ...styles.formInput, resize: "vertical", minHeight: 100 }}
                          value={newMsgForm.body}
                          placeholder="Type your message here…"
                          onChange={(e) => setNewMsgForm((p) => ({ ...p, body: e.target.value }))}
                          required
                        />
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <button type="submit" style={styles.submitBtn} disabled={msgSubmitting}>
                          {msgSubmitting ? "Sending…" : "Send Message"}
                        </button>
                      </div>
                    </form>
                  </SectionCard>

                  <div style={{ marginTop: 20 }}>
                    <p style={styles.sectionHeading}>Message History</p>
                    {msgLoading ? (
                      <p style={{ color: "#9ca3af", fontSize: 14 }}>Loading messages…</p>
                    ) : messages.length === 0 ? (
                      <p style={{ color: "#9ca3af", fontSize: 14 }}>No messages on record.</p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {messages.map((m) => (
                          <div
                            key={m.id}
                            style={{ ...styles.msgRow, borderLeft: `3px solid ${m.is_read ? "#e5e7eb" : "#1a56db"}` }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                <span style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>{m.subject}</span>
                                {!m.is_read && <span style={styles.unreadBadge}>Unread</span>}
                              </div>
                              <span style={{ fontSize: 11, color: "#9ca3af", whiteSpace: "nowrap" }}>{m.created_at}</span>
                            </div>
                            <p style={{ margin: "6px 0 0", fontSize: 13, color: "#4b5563", lineHeight: 1.6 }}>{m.body}</p>
                            <div style={{ marginTop: 6, fontSize: 11, color: "#9ca3af" }}>From: {m.sender}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

const styles = {
  page:        { fontFamily: "'Segoe UI', sans-serif", background: "#f0f4f8", minHeight: "100vh", color: "#1a202c" },

  nav:         { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 24px", height: 56, background: "#fff", borderBottom: "1px solid #e5e7eb", position: "sticky", top: 0, zIndex: 10 },
  navBrand:    { display: "flex", alignItems: "center", gap: 10, fontWeight: 800, fontSize: 17, color: "#111827" },
  navDot:      { width: 10, height: 10, borderRadius: "50%", background: "#1a56db" },
  navUser:     { fontSize: 13, color: "#6b7280" },
  logoutBtn:   { padding: "6px 14px", border: "1px solid #d1d5db", borderRadius: 7, background: "#fff", cursor: "pointer", fontSize: 13, color: "#374151" },
  notifBadge:  { position: "absolute", top: -6, right: -8, background: "#ef4444", color: "#fff", fontSize: 10, fontWeight: 700, borderRadius: "50%", width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center" },

  body:        { display: "flex", height: "calc(100vh - 56px)" },

  sidebar:     { width: 260, minWidth: 260, background: "#fff", borderRight: "1px solid #e5e7eb", display: "flex", flexDirection: "column", padding: "16px 12px", overflowY: "auto" },
  sidebarLabel:{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em", paddingLeft: 4 },
  searchInput: { width: "100%", padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 13, marginBottom: 10, boxSizing: "border-box", outline: "none" },
  patientList: { display: "flex", flexDirection: "column", gap: 6 },
  patientItem: { display: "flex", alignItems: "center", gap: 10, padding: "10px 10px", border: "1px solid", borderRadius: 10, cursor: "pointer", background: "#fff", width: "100%", transition: "all 0.15s" },
  patientAvatar: { width: 36, height: 36, borderRadius: "50%", background: "#dbeafe", color: "#1e40af", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, flexShrink: 0 },

  main:        { flex: 1, overflowY: "auto", padding: 24 },
  placeholder: { display: "flex", alignItems: "center", justifyContent: "center", height: "60%", fontSize: 15, color: "#9ca3af" },

  headerCard:  { background: "#fff", borderRadius: 14, padding: "22px 26px", marginBottom: 20, display: "flex", gap: 22, alignItems: "flex-start", boxShadow: "0 1px 4px rgba(0,0,0,0.07)", border: "1px solid #e5e7eb" },
  avatarLarge: { width: 72, height: 72, borderRadius: "50%", background: "#1a56db", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 24, flexShrink: 0 },
  headerInfo:  { flex: 1 },
  patientName: { margin: 0, fontSize: 22, fontWeight: 800, color: "#111827" },
  headerMeta:  { display: "flex", flexWrap: "wrap", gap: "6px 20px", marginTop: 8, fontSize: 13, color: "#4b5563" },
  infoChip:    { fontSize: 12, background: "#f1f5f9", color: "#475569", padding: "4px 10px", borderRadius: 20 },
  admTypeTag:  { fontSize: 11, fontWeight: 700, background: "#fef3c7", color: "#92400e", padding: "3px 9px", borderRadius: 20, textTransform: "uppercase", letterSpacing: "0.05em" },

  tabBar:      { display: "flex", gap: 4, marginBottom: 20, background: "#fff", borderRadius: 10, padding: 4, border: "1px solid #e5e7eb" },
  tabBtn:      { flex: 1, padding: "9px 16px", border: "none", borderRadius: 8, background: "transparent", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#6b7280" },
  tabBtnActive:{ background: "#1a56db", color: "#fff" },

  grid:        { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 },

  card:        { background: "#fff", borderRadius: 12, padding: "20px 22px", boxShadow: "0 1px 4px rgba(0,0,0,0.07)", border: "1px solid #e5e7eb" },
  cardHeader:  { display: "flex", alignItems: "center", gap: 8, marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid #f3f4f6" },
  cardIcon:    { fontSize: 18 },
  cardTitle:   { margin: 0, fontSize: 14, fontWeight: 700, color: "#111827", textTransform: "uppercase", letterSpacing: "0.05em" },

  summaryGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 20px", marginBottom: 14 },
  summaryItem: { display: "flex", flexDirection: "column", gap: 3 },
  summaryLabel:{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em" },
  summaryValue:{ fontSize: 14, color: "#111827" },
  notesBox:    { background: "#f8fafc", borderRadius: 8, padding: "12px 14px", border: "1px solid #e2e8f0" },
  notesText:   { margin: "6px 0 0", fontSize: 13, color: "#475569", lineHeight: 1.7 },

  vitalsGrid:  { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 10 },
  vitalChip:   { display: "flex", flexDirection: "column", gap: 4, padding: "12px 14px", borderRadius: 10, border: "1px solid" },

  table:       { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th:          { textAlign: "left", padding: "8px 12px", fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "2px solid #f3f4f6" },
  td:          { padding: "9px 12px", borderBottom: "1px solid #f3f4f6", color: "#374151" },

  noteCard:    { background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 14px" },
  noteMeta:    { display: "flex", justifyContent: "space-between", alignItems: "center" },

  pill:        { fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 20 },
  tag:         { fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 6 },

  sectionHeading: { margin: "0 0 12px", fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em" },
  successBanner:  { background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, padding: "12px 16px", color: "#166534", fontSize: 13, marginBottom: 16 },

  form2col:    { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 20px" },
  formSingle:  { display: "flex", flexDirection: "column", gap: 12 },
  formLabel:   { fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 4, display: "block" },
  formInput:   { width: "100%", padding: "9px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box", color: "#111827", background: "#fff" },
  submitBtn:   { background: "#1a56db", color: "#fff", border: "none", borderRadius: 8, padding: "10px 22px", fontSize: 14, fontWeight: 600, cursor: "pointer" },

  apptRow:     { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "14px 16px", display: "flex", alignItems: "flex-start", gap: 16 },
  actionBtnGreen: { padding: "5px 12px", border: "1px solid #86efac", borderRadius: 6, background: "#f0fdf4", color: "#166534", fontSize: 12, fontWeight: 600, cursor: "pointer" },
  actionBtnRed:   { padding: "5px 12px", border: "1px solid #fca5a5", borderRadius: 6, background: "#fff5f5", color: "#dc2626", fontSize: 12, fontWeight: 600, cursor: "pointer" },

  msgRow:      { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "14px 16px" },
  unreadBadge: { fontSize: 10, fontWeight: 700, background: "#dbeafe", color: "#1e40af", padding: "2px 7px", borderRadius: 20 },

  dischargeBtn:        { padding: "8px 16px", border: "1px solid #fca5a5", borderRadius: 8, background: "#fff5f5", color: "#dc2626", fontSize: 13, fontWeight: 700, cursor: "pointer" },
  dischargePanel:      { background: "#fff5f5", border: "1px solid #fca5a5", borderRadius: 12, padding: "20px 22px", marginBottom: 20 },
  dischargePanelTitle: { margin: "0 0 16px", fontSize: 14, fontWeight: 700, color: "#991b1b" },
  dischargeConfirmBtn: { padding: "9px 20px", border: "none", borderRadius: 8, background: "#dc2626", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" },
  cancelBtn:           { padding: "9px 16px", border: "1px solid #d1d5db", borderRadius: 8, background: "#fff", color: "#374151", fontSize: 13, fontWeight: 600, cursor: "pointer" },

  editSmallBtn:   { marginLeft: "auto", padding: "4px 10px", border: "1px solid #d1d5db", borderRadius: 6, background: "#f9fafb", color: "#374151", fontSize: 11, fontWeight: 600, cursor: "pointer" },
  vitalsEditGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 16px" },

  addNoteSection: { marginTop: 18, paddingTop: 16, borderTop: "1px solid #f3f4f6" },
  addNoteTitle:   { margin: "0 0 10px", fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em" },
};
