import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

function SectionCard({ title, children }) {
  return (
    <div style={styles.card}>
      <h3 style={styles.cardTitle}>{title}</h3>
      {children}
    </div>
  );
}

function LineItem({ label, value, bold }) {
  return (
    <div style={{ ...styles.lineItem, fontWeight: bold ? 600 : 400 }}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function Divider() {
  return <hr style={styles.divider} />;
}

const fmt = (v) =>
  `$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function ApptPill({ status }) {
  const map = {
    Scheduled:  { bg: "#dbeafe", color: "#1e40af" },
    Completed:  { bg: "#dcfce7", color: "#166534" },
    Cancelled:  { bg: "#f3f4f6", color: "#6b7280" },
  };
  const c = map[status] || { bg: "#f3f4f6", color: "#374151" };
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 20, background: c.bg, color: c.color }}>
      {status}
    </span>
  );
}

export default function Patient() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  const [paymentMethod, setPaymentMethod] = useState("card");
  const [cardForm,      setCardForm]      = useState({ name: "", number: "", expiry: "", cvv: "" });
  const [bankForm,      setBankForm]      = useState({ accountName: "", routingNumber: "", accountNumber: "", accountType: "checking" });
  const [submitted,     setSubmitted]     = useState(false);

  const [activeTab, setActiveTab] = useState("billing");

  const [appointments,  setAppointments]  = useState([]);
  const [apptLoading,   setApptLoading]   = useState(false);
  const [expandedAppt,  setExpandedAppt]  = useState(null);

  const [messages,      setMessages]      = useState([]);
  const [msgLoading,    setMsgLoading]    = useState(false);
  const [replyingTo,    setReplyingTo]    = useState(null);
  const [replyBody,     setReplyBody]     = useState("");
  const [replySending,  setReplySending]  = useState(false);

  const [notifications, setNotifications] = useState({ total: 0, unread_messages: 0, upcoming_appointments: 0 });

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (!token) { navigate("/"); return; }

    const fetchMe = async () => {
      try {
        const res = await fetch("http://127.0.0.1:5001/patient/me", { headers });
        if ([401, 422].includes(res.status)) { localStorage.removeItem("token"); navigate("/"); return; }
        if (!res.ok) { setError("Could not load your data."); setLoading(false); return; }
        setData(await res.json());
      } catch {
        setError("Cannot reach the server. Is the backend running?");
      } finally {
        setLoading(false);
      }
    };

    const fetchAppts = async () => {
      setApptLoading(true);
      try {
        const res = await fetch("http://127.0.0.1:5001/appointments/me", { headers });
        setAppointments(res.ok ? await res.json() : []);
      } catch { setAppointments([]); }
      finally  { setApptLoading(false); }
    };

    const fetchMsgs = async () => {
      setMsgLoading(true);
      try {
        const res = await fetch("http://127.0.0.1:5001/messages/me", { headers });
        setMessages(res.ok ? await res.json() : []);
      } catch { setMessages([]); }
      finally  { setMsgLoading(false); }
    };

    const fetchNotifs = async () => {
      try {
        const res = await fetch("http://127.0.0.1:5001/notifications", { headers });
        if (res.ok) setNotifications(await res.json());
      } catch {}
    };

    fetchMe();
    fetchAppts();
    fetchMsgs();
    fetchNotifs();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMarkRead = async (msgId) => {
    try {
      const res = await fetch(`http://127.0.0.1:5001/messages/${msgId}/read`, {
        method: "PATCH",
        headers,
      });
      if (res.ok) {
        const updated = await res.json();
        setMessages((prev) => prev.map((m) => (m.id === msgId ? updated : m)));
        setNotifications((prev) => ({
          ...prev,
          unread_messages: Math.max(0, prev.unread_messages - 1),
          total: Math.max(0, prev.total - 1),
        }));
      }
    } catch {}
  };

  const handleCancelAppt = async (apptId) => {
    try {
      const res = await fetch(`http://127.0.0.1:5001/appointments/${apptId}/cancel`, {
        method: "PATCH",
        headers,
      });
      if (res.ok) {
        const updated = await res.json();
        setAppointments((prev) => prev.map((a) => (a.id === apptId ? updated : a)));
        setNotifications((prev) => ({
          ...prev,
          upcoming_appointments: Math.max(0, prev.upcoming_appointments - 1),
          total: Math.max(0, prev.total - 1),
        }));
      }
    } catch {}
  };

  const handleReply = async (msgId) => {
    if (!replyBody.trim()) return;
    setReplySending(true);
    try {
      const res = await fetch(`http://127.0.0.1:5001/messages/${msgId}/reply`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ body: replyBody }),
      });
      if (res.ok) {
        const updated = await res.json();
        setMessages((prev) => prev.map((m) => (m.id === msgId ? updated : m)));
        setReplyingTo(null);
        setReplyBody("");
      }
    } catch {}
    setReplySending(false);
  };

  const handleLogout = () => { localStorage.removeItem("token"); localStorage.removeItem("role"); navigate("/"); };

  if (loading) return <div style={styles.centered}>Loading…</div>;
  if (error)   return <div style={{ ...styles.centered, color: "crimson" }}>{error}</div>;
  if (!data)   return null;

  const adm        = data.admission;
  const ins        = data.insurance;
  const admCharges = adm?.charges     || [];
  const procs      = adm?.procedures  || [];
  const meds       = adm?.medications || [];

  const roomCharge   = admCharges.find((c) => c.category === "room")  || { description: "Room & Board", amount: 0 };
  const mealsCharge  = admCharges.find((c) => c.category === "meals") || { description: "Meals", amount: 0 };
  const otherCharges = admCharges.filter((c) => c.category !== "room" && c.category !== "meals");

  const chargesTotal = admCharges.reduce((s, c) => s + c.amount, 0);
  const procTotal    = procs.reduce((s, p) => s + p.cost,  0);
  const medTotal     = meds.reduce((s,  m) => s + m.cost,  0);
  const careTotal    = procTotal + medTotal;
  const totalBill    = chargesTotal + careTotal;

  const coveragePct      = ins?.coverage_pct ?? 80;
  const insurancePays    = totalBill * (coveragePct / 100);
  const remainingBalance = totalBill - insurancePays;

  const admitDate     = adm?.admit_date     || "—";
  const dischargeDate = adm?.discharge_date || "Present";
  const durationLabel = `${admitDate} → ${dischargeDate}`;

  const handleCardChange = (e) => setCardForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  const handleBankChange = (e) => setBankForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  const handleSubmit     = (e) => { e.preventDefault(); setSubmitted(true); };

  const unreadCount = messages.filter((m) => !m.is_read).length;

  const downloadBill = () => {
    const rows = (items, labelKey, valueKey) =>
      items.map((i) => `<tr><td>${i[labelKey]}</td><td style="text-align:right">${fmt(i[valueKey])}</td></tr>`).join("");

    const html = `<!DOCTYPE html><html><head><title>Bill – ${data.first_name} ${data.last_name}</title>
<style>
  body { font-family: Arial, sans-serif; margin: 40px; color: #111; font-size: 14px; }
  h1   { font-size: 22px; margin-bottom: 4px; }
  h2   { font-size: 15px; margin: 24px 0 8px; border-bottom: 2px solid #111; padding-bottom: 4px; }
  p    { margin: 2px 0; color: #555; }
  table{ width: 100%; border-collapse: collapse; margin-top: 6px; }
  th   { text-align: left; font-size: 12px; color: #666; padding: 6px 8px; border-bottom: 1px solid #ccc; }
  td   { padding: 6px 8px; border-bottom: 1px solid #eee; }
  .total-row td { font-weight: bold; border-top: 2px solid #111; border-bottom: none; }
  .balance { margin-top: 28px; padding: 16px 20px; border: 2px solid #111; text-align: right; font-size: 18px; font-weight: bold; }
  @media print { button { display: none; } }
</style></head><body>
<h1>Hospital Bill</h1>
<p><strong>Patient:</strong> ${data.first_name} ${data.last_name} &nbsp;|&nbsp; <strong>MRN:</strong> ${data.mrn}</p>
<p><strong>Admission:</strong> ${admitDate} &nbsp;→&nbsp; ${dischargeDate}</p>
<p><strong>Generated:</strong> ${new Date().toLocaleDateString()}</p>

<h2>Room &amp; Board Charges</h2>
<table><thead><tr><th>Description</th><th style="text-align:right">Amount</th></tr></thead><tbody>
  <tr><td>${roomCharge.description}</td><td style="text-align:right">${fmt(roomCharge.amount)}</td></tr>
  <tr><td>${mealsCharge.description}</td><td style="text-align:right">${fmt(mealsCharge.amount)}</td></tr>
  ${rows(otherCharges, "description", "amount")}
  <tr class="total-row"><td>Charges Subtotal</td><td style="text-align:right">${fmt(chargesTotal)}</td></tr>
</tbody></table>

<h2>Procedures</h2>
<table><thead><tr><th>Procedure</th><th style="text-align:right">Cost</th></tr></thead><tbody>
  ${procs.length ? rows(procs, "name", "cost") : "<tr><td colspan='2'>None recorded</td></tr>"}
</tbody></table>

<h2>Medications</h2>
<table><thead><tr><th>Medication</th><th style="text-align:right">Cost</th></tr></thead><tbody>
  ${meds.length ? rows(meds, "name", "cost") : "<tr><td colspan='2'>None recorded</td></tr>"}
</tbody></table>

<h2>Insurance &amp; Balance</h2>
<table><tbody>
  <tr><td>Total Bill</td><td style="text-align:right">${fmt(totalBill)}</td></tr>
  <tr><td>Insurance Coverage (${ins?.coverage_pct ?? 80}% – ${ins?.provider ?? "N/A"})</td><td style="text-align:right">− ${fmt(insurancePays)}</td></tr>
  <tr class="total-row"><td>Patient Responsibility</td><td style="text-align:right">${fmt(remainingBalance)}</td></tr>
</tbody></table>

<div class="balance">Amount Due: ${fmt(remainingBalance)}</div>
</body></html>`;

    const w = window.open("", "_blank");
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  };

  return (
    <div style={styles.page}>
      <div style={styles.nav}>
        <div style={styles.navBrand}><span style={styles.navDot} />Patient Portal</div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <span style={{ fontSize: 20, lineHeight: 1 }}>🔔</span>
            {notifications.total > 0 && (
              <span style={styles.notifBadge}>{notifications.total}</span>
            )}
          </div>
          <span style={styles.navUser}>{data.first_name} {data.last_name}</span>
          <button style={styles.logoutBtn} onClick={handleLogout}>Logout</button>
        </div>
      </div>

      <div style={styles.header}>
        <div>
          <h2 style={styles.headerTitle}>My Health Portal</h2>
          <p style={styles.headerSub}>
            {data.first_name} {data.last_name} &nbsp;|&nbsp; {data.mrn} &nbsp;|&nbsp; {durationLabel}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={styles.totalBadge}>
            Balance Due: <strong>{fmt(remainingBalance)}</strong>
          </div>
          <button style={styles.downloadBtn} onClick={downloadBill}>
            Download Bill
          </button>
        </div>
      </div>

      <div style={styles.outerTabBar}>
        {[
          { key: "billing",      label: "Billing" },
          { key: "appointments", label: `Appointments${appointments.length ? ` (${appointments.length})` : ""}` },
          { key: "messages",     label: `Messages${unreadCount > 0 ? ` (${unreadCount} new)` : messages.length ? ` (${messages.length})` : ""}` },
        ].map(({ key, label }) => (
          <button
            key={key}
            style={{ ...styles.outerTabBtn, ...(activeTab === key ? styles.outerTabBtnActive : {}) }}
            onClick={() => setActiveTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === "billing" && (
        <div style={styles.grid}>
          <SectionCard title="Charges">
            <LineItem label="Duration of Stay" value={durationLabel} />
            <Divider />
            <LineItem label={roomCharge.description}  value={fmt(roomCharge.amount)} />
            <LineItem label={mealsCharge.description} value={fmt(mealsCharge.amount)} />
            <Divider />
            <p style={styles.subheading}>Other Services</p>
            {otherCharges.length > 0
              ? otherCharges.map((c) => <LineItem key={c.id} label={c.description} value={fmt(c.amount)} />)
              : <p style={styles.empty}>No additional charges.</p>
            }
            <Divider />
            <LineItem label="Section Total" value={fmt(chargesTotal)} bold />
          </SectionCard>

          <SectionCard title="Care">
            <p style={styles.subheading}>Procedures</p>
            {procs.length > 0
              ? procs.map((p) => <LineItem key={p.id} label={p.name} value={fmt(p.cost)} />)
              : <p style={styles.empty}>No procedures recorded.</p>
            }
            <Divider />
            <p style={styles.subheading}>Medications</p>
            {meds.length > 0
              ? meds.map((m) => <LineItem key={m.id} label={m.name} value={fmt(m.cost)} />)
              : <p style={styles.empty}>No medications recorded.</p>
            }
            <Divider />
            <LineItem label="Cost of Care Subtotal" value={fmt(careTotal)} />
            <Divider />
            <LineItem label="Section Total" value={fmt(careTotal)} bold />
          </SectionCard>

          <SectionCard title="Insurance Summary">
            {ins ? (
              <>
                <LineItem label="Provider"  value={ins.provider} />
                <LineItem label="Plan"      value={ins.plan_name} />
                <LineItem label="Member ID" value={ins.member_id} />
                <LineItem label="Group No." value={ins.group_number} />
                <Divider />
                <LineItem label="Coverage"       value={`${ins.coverage_pct}%`} />
                <LineItem label="Total Bill"     value={fmt(totalBill)} />
                <LineItem label="Insurance Pays" value={fmt(insurancePays)} />
                <Divider />
                <p style={styles.subheading}>Deductible</p>
                <LineItem label="Annual Deductible"    value={fmt(ins.deductible_total)} />
                <LineItem label="Met So Far"           value={fmt(ins.deductible_met)} />
                <LineItem label="Remaining Deductible" value={fmt(ins.deductible_remaining)} />
                <Divider />
                <p style={styles.subheading}>Out-of-Pocket</p>
                <LineItem label="OOP Maximum"   value={fmt(ins.out_of_pocket_max)} />
                <LineItem label="OOP Met"       value={fmt(ins.out_of_pocket_met)} />
                <LineItem label="OOP Remaining" value={fmt(ins.out_of_pocket_remaining)} />
                <Divider />
              </>
            ) : (
              <p style={styles.empty}>No insurance information on file.</p>
            )}
            <div style={styles.balanceBanner}>
              <span>Your Remaining Balance</span>
              <strong style={{ fontSize: 22 }}>{fmt(remainingBalance)}</strong>
            </div>
          </SectionCard>

          <SectionCard title="Payment Options">
            <div style={styles.tabRow}>
              <button
                style={{ ...styles.tab, ...(paymentMethod === "card" ? styles.tabActive : {}) }}
                onClick={() => { setPaymentMethod("card"); setSubmitted(false); }}
              >
                Credit / Debit Card
              </button>
              <button
                style={{ ...styles.tab, ...(paymentMethod === "bank" ? styles.tabActive : {}) }}
                onClick={() => { setPaymentMethod("bank"); setSubmitted(false); }}
              >
                Bank Transfer
              </button>
            </div>

            {submitted ? (
              <div style={styles.successBox}>
                Payment submitted successfully! A confirmation will be sent to your email.
              </div>
            ) : paymentMethod === "card" ? (
              <form onSubmit={handleSubmit} style={styles.form}>
                <label style={styles.label}>Cardholder Name</label>
                <input name="name" placeholder="Jane Doe" value={cardForm.name}
                  onChange={handleCardChange} style={styles.input} required />
                <label style={styles.label}>Card Number</label>
                <input name="number" placeholder="•••• •••• •••• ••••" value={cardForm.number}
                  onChange={handleCardChange} maxLength={19} style={styles.input} required />
                <div style={styles.row2}>
                  <div style={{ flex: 1 }}>
                    <label style={styles.label}>Expiry</label>
                    <input name="expiry" placeholder="MM / YY" value={cardForm.expiry}
                      onChange={handleCardChange} maxLength={7} style={styles.input} required />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={styles.label}>CVV</label>
                    <input name="cvv" placeholder="•••" value={cardForm.cvv}
                      onChange={handleCardChange} maxLength={4} style={styles.input} required />
                  </div>
                </div>
                <div style={styles.payRow}>
                  <span style={styles.payAmount}>Pay {fmt(remainingBalance)}</span>
                  <button type="submit" style={styles.payBtn}>Submit Payment</button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleSubmit} style={styles.form}>
                <label style={styles.label}>Account Holder Name</label>
                <input name="accountName" placeholder="Jane Doe" value={bankForm.accountName}
                  onChange={handleBankChange} style={styles.input} required />
                <label style={styles.label}>Account Type</label>
                <select name="accountType" value={bankForm.accountType}
                  onChange={handleBankChange} style={styles.input}>
                  <option value="checking">Checking</option>
                  <option value="savings">Savings</option>
                </select>
                <label style={styles.label}>Routing Number</label>
                <input name="routingNumber" placeholder="9-digit routing number" value={bankForm.routingNumber}
                  onChange={handleBankChange} maxLength={9} style={styles.input} required />
                <label style={styles.label}>Account Number</label>
                <input name="accountNumber" placeholder="Account number" value={bankForm.accountNumber}
                  onChange={handleBankChange} style={styles.input} required />
                <div style={styles.payRow}>
                  <span style={styles.payAmount}>Pay {fmt(remainingBalance)}</span>
                  <button type="submit" style={styles.payBtn}>Submit Transfer</button>
                </div>
              </form>
            )}
          </SectionCard>
        </div>
      )}

      {activeTab === "appointments" && (
        <div style={styles.tabContent}>
          <h3 style={styles.tabContentTitle}>My Appointments</h3>
          {apptLoading ? (
            <p style={styles.empty}>Loading appointments…</p>
          ) : appointments.length === 0 ? (
            <p style={styles.empty}>No appointments on record.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {appointments.map((a) => {
                const isOpen = expandedAppt === a.id;
                const apptDate = new Date(a.appt_date + "T00:00:00");
                const dayNum = a.appt_date?.split("-")[2];
                const monthStr = apptDate.toLocaleString("default", { month: "short" });
                const fullDate = apptDate.toLocaleString("default", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
                return (
                  <div key={a.id} style={{ ...styles.apptCard, cursor: "pointer", transition: "box-shadow 0.15s" }}
                    onClick={() => setExpandedAppt(isOpen ? null : a.id)}>
                    <div style={styles.apptDateBox}>
                      <span style={styles.apptDateDay}>{dayNum}</span>
                      <span style={styles.apptDateMon}>{monthStr}</span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                          <span style={{ fontWeight: 700, fontSize: 15, color: "#111827" }}>{a.appt_type}</span>
                          <ApptPill status={a.status} />
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }} onClick={(e) => e.stopPropagation()}>
                          {a.status === "Scheduled" && (
                            <button style={styles.cancelApptBtn} onClick={() => handleCancelAppt(a.id)}>
                              Cancel
                            </button>
                          )}
                          <span style={{ fontSize: 12, color: "#9ca3af" }}>{isOpen ? "▲" : "▼"}</span>
                        </div>
                      </div>
                      <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
                        {a.appt_time} &nbsp;·&nbsp; {a.clinician}
                      </div>

                      {isOpen && (
                        <div style={styles.apptSummary} onClick={(e) => e.stopPropagation()}>
                          <div style={styles.apptSummaryGrid}>
                            <div style={styles.apptSummaryItem}>
                              <span style={styles.apptSummaryLabel}>Date</span>
                              <span style={styles.apptSummaryValue}>{fullDate}</span>
                            </div>
                            <div style={styles.apptSummaryItem}>
                              <span style={styles.apptSummaryLabel}>Time</span>
                              <span style={styles.apptSummaryValue}>{a.appt_time}</span>
                            </div>
                            <div style={styles.apptSummaryItem}>
                              <span style={styles.apptSummaryLabel}>Type</span>
                              <span style={styles.apptSummaryValue}>{a.appt_type}</span>
                            </div>
                            <div style={styles.apptSummaryItem}>
                              <span style={styles.apptSummaryLabel}>Provider</span>
                              <span style={styles.apptSummaryValue}>{a.clinician}</span>
                            </div>
                            <div style={styles.apptSummaryItem}>
                              <span style={styles.apptSummaryLabel}>Status</span>
                              <span style={styles.apptSummaryValue}><ApptPill status={a.status} /></span>
                            </div>
                          </div>
                          {a.notes ? (
                            <div style={styles.apptNoteBox}>
                              <span style={styles.apptNoteLabel}>
                                {a.status === "Completed" ? "Visit Summary" : "Appointment Notes"}
                              </span>
                              <p style={styles.apptNoteText}>{a.notes}</p>
                            </div>
                          ) : (
                            <p style={{ fontSize: 13, color: "#9ca3af", marginTop: 12 }}>
                              {a.status === "Completed" ? "No visit summary on file." : "No additional notes."}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === "messages" && (
        <div style={styles.tabContent}>
          <h3 style={styles.tabContentTitle}>My Messages</h3>
          {msgLoading ? (
            <p style={styles.empty}>Loading messages…</p>
          ) : messages.length === 0 ? (
            <p style={styles.empty}>No messages yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {messages.map((m) => (
                <div
                  key={m.id}
                  style={{
                    ...styles.msgCard,
                    borderLeft: `4px solid ${m.is_read ? "#e5e7eb" : "#1a56db"}`,
                    background: m.is_read ? "#fff" : "#f0f7ff",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, fontSize: 15, color: "#111827" }}>{m.subject}</span>
                      {!m.is_read && <span style={styles.unreadBadge}>New</span>}
                    </div>
                    <span style={{ fontSize: 12, color: "#9ca3af", whiteSpace: "nowrap" }}>{m.created_at}</span>
                  </div>
                  <p style={{ margin: "8px 0 0", fontSize: 14, color: "#374151", lineHeight: 1.7 }}>{m.body}</p>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
                    <span style={{ fontSize: 12, color: "#9ca3af" }}>From: {m.sender}</span>
                    <div style={{ display: "flex", gap: 8 }}>
                      {!m.is_read && (
                        <button style={styles.markReadBtn} onClick={() => handleMarkRead(m.id)}>Mark as Read</button>
                      )}
                      <button style={styles.replyBtn} onClick={() => { setReplyingTo(replyingTo === m.id ? null : m.id); setReplyBody(""); }}>
                        {replyingTo === m.id ? "Cancel" : "Reply"}
                      </button>
                    </div>
                  </div>

                  {m.replies && m.replies.length > 0 && (
                    <div style={{ marginTop: 12, borderTop: "1px solid #e5e7eb", paddingTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                      {m.replies.map((r) => (
                        <div key={r.id} style={{ paddingLeft: 16, borderLeft: `3px solid ${r.sender === "Patient" || !r.sender.startsWith("Dr.") ? "#6b7280" : "#1a56db"}`, background: "#f9fafb", borderRadius: 6, padding: "10px 14px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>{r.sender}</span>
                            <span style={{ fontSize: 11, color: "#9ca3af" }}>{r.created_at}</span>
                          </div>
                          <p style={{ margin: 0, fontSize: 13, color: "#374151", lineHeight: 1.6 }}>{r.body}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {replyingTo === m.id && (
                    <div style={{ marginTop: 12, borderTop: "1px solid #e5e7eb", paddingTop: 12 }}>
                      <textarea
                        style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "10px 12px", fontSize: 13, resize: "vertical", minHeight: 80, boxSizing: "border-box" }}
                        placeholder="Write your reply…"
                        value={replyBody}
                        onChange={(e) => setReplyBody(e.target.value)}
                      />
                      <div style={{ textAlign: "right", marginTop: 8 }}>
                        <button style={styles.markReadBtn} disabled={replySending || !replyBody.trim()} onClick={() => handleReply(m.id)}>
                          {replySending ? "Sending…" : "Send Reply"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const styles = {
  page:     { fontFamily: "'Segoe UI', sans-serif", background: "#f0f4f8", minHeight: "100vh", color: "#1a202c" },
  centered: { display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontSize: 16 },

  nav:         { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 24px", height: 56, background: "#fff", borderBottom: "1px solid #e5e7eb", position: "sticky", top: 0, zIndex: 10 },
  navBrand:    { display: "flex", alignItems: "center", gap: 10, fontWeight: 800, fontSize: 17, color: "#111827" },
  navDot:      { width: 10, height: 10, borderRadius: "50%", background: "#1a56db" },
  navUser:     { fontSize: 13, color: "#6b7280" },
  logoutBtn:   { padding: "6px 14px", border: "1px solid #d1d5db", borderRadius: 7, background: "#fff", cursor: "pointer", fontSize: 13, color: "#374151" },
  notifBadge:  { position: "absolute", top: -6, right: -8, background: "#ef4444", color: "#fff", fontSize: 10, fontWeight: 700, borderRadius: "50%", width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center" },

  header:      { background: "#1a56db", color: "#fff", margin: "0 24px 0", borderRadius: "0 0 12px 12px", padding: "20px 28px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 },
  headerTitle: { margin: 0, fontSize: 22, fontWeight: 700 },
  headerSub:   { margin: "4px 0 0", fontSize: 13, opacity: 0.85 },
  totalBadge:  { background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 8, padding: "10px 18px", fontSize: 15 },

  outerTabBar:     { display: "flex", gap: 0, margin: "24px 24px 0", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", overflow: "hidden" },
  outerTabBtn:     { flex: 1, padding: "12px 20px", border: "none", background: "transparent", cursor: "pointer", fontSize: 14, fontWeight: 600, color: "#6b7280", borderBottom: "2px solid transparent" },
  outerTabBtnActive: { color: "#1a56db", borderBottom: "2px solid #1a56db", background: "#f0f7ff" },

  grid:     { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 20, padding: "20px 24px" },
  card:     { background: "#fff", borderRadius: 12, padding: "22px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" },
  cardTitle:{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, color: "#1a56db", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "2px solid #e8f0fe", paddingBottom: 10 },
  lineItem: { display: "flex", justifyContent: "space-between", fontSize: 14, padding: "5px 0", color: "#2d3748" },
  divider:  { border: "none", borderTop: "1px solid #edf2f7", margin: "10px 0" },
  subheading: { margin: "8px 0 4px", fontSize: 12, fontWeight: 600, color: "#718096", textTransform: "uppercase", letterSpacing: "0.06em" },
  empty:    { fontSize: 13, color: "#9ca3af", margin: "4px 0" },
  balanceBanner: { background: "#ebf5ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 15, color: "#1e40af", marginTop: 4 },

  tabRow:   { display: "flex", gap: 8, marginBottom: 20 },
  tab:      { flex: 1, padding: "9px 0", border: "1px solid #d1d5db", borderRadius: 8, background: "#f9fafb", cursor: "pointer", fontSize: 13, fontWeight: 500, color: "#4b5563" },
  tabActive:{ background: "#1a56db", color: "#fff", border: "1px solid #1a56db" },
  form:     { display: "flex", flexDirection: "column", gap: 6 },
  label:    { fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 2 },
  input:    { padding: "9px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14, outline: "none", width: "100%", boxSizing: "border-box", color: "#111827" },
  row2:     { display: "flex", gap: 12 },
  payRow:   { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, padding: "12px 0 0", borderTop: "1px solid #edf2f7" },
  payAmount:{ fontSize: 16, fontWeight: 700, color: "#1a56db" },
  payBtn:   { background: "#1a56db", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  successBox: { background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, padding: "16px", color: "#166534", fontSize: 14, textAlign: "center", marginTop: 8 },

  tabContent:     { padding: "24px 24px" },
  tabContentTitle:{ margin: "0 0 20px", fontSize: 18, fontWeight: 700, color: "#111827" },

  apptCard:    { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "16px 20px", display: "flex", gap: 18, alignItems: "flex-start", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" },
  apptDateBox: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, padding: "8px 14px", minWidth: 54, flexShrink: 0 },
  apptDateDay: { fontSize: 24, fontWeight: 800, color: "#1a56db", lineHeight: 1 },
  apptDateMon: { fontSize: 12, fontWeight: 600, color: "#6b7280", marginTop: 2 },

  msgCard:     { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "18px 20px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" },
  replyBtn:        { padding: "5px 12px", fontSize: 12, fontWeight: 600, border: "1px solid #d1d5db", borderRadius: 6, background: "#f9fafb", cursor: "pointer", color: "#374151" },
  cancelApptBtn:   { padding: "5px 14px", fontSize: 12, fontWeight: 600, border: "1px solid #fca5a5", borderRadius: 6, background: "#fff1f2", cursor: "pointer", color: "#b91c1c" },

  apptSummary:      { marginTop: 16, paddingTop: 16, borderTop: "1px solid #f3f4f6" },
  apptSummaryGrid:  { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "10px 24px", marginBottom: 14 },
  apptSummaryItem:  { display: "flex", flexDirection: "column", gap: 2 },
  apptSummaryLabel: { fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.04em" },
  apptSummaryValue: { fontSize: 13, fontWeight: 500, color: "#111827" },
  apptNoteBox:      { background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: "12px 14px" },
  apptNoteLabel:    { display: "block", fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 },
  apptNoteText:     { margin: 0, fontSize: 13, color: "#374151", lineHeight: 1.6 },
  unreadBadge: { fontSize: 11, fontWeight: 700, background: "#1a56db", color: "#fff", padding: "2px 8px", borderRadius: 20 },
  markReadBtn: { padding: "5px 14px", border: "1px solid #bfdbfe", borderRadius: 7, background: "#eff6ff", color: "#1a56db", fontSize: 12, fontWeight: 600, cursor: "pointer" },
  downloadBtn: { padding: "9px 16px", border: "1px solid rgba(255,255,255,0.5)", borderRadius: 8, background: "rgba(255,255,255,0.15)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" },
};
