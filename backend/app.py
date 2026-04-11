from flask import Flask, request, jsonify
from flask_bcrypt import Bcrypt
from flask_jwt_extended import (
    JWTManager,
    create_access_token,
    jwt_required,
    get_jwt_identity,
    get_jwt,
)
from flask_cors import CORS
from sqlalchemy import func
from datetime import datetime, timedelta
import os
import uuid

from models import db, Patient, Admission, Charge, Procedure, Medication, Appointment, Message, ClinicalNote, Vitals

print("RUNNING FILE:", os.path.abspath(__file__))

app = Flask(__name__)
CORS(app)

app.config["JWT_SECRET_KEY"]               = "super-secret-key"
app.config["SQLALCHEMY_DATABASE_URI"]      = "sqlite:///hospital.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

bcrypt = Bcrypt(app)
jwt    = JWTManager(app)
db.init_app(app)

users = [
    {"email": "admin@test.com",     "password": None, "role": "admin",     "patient_id": None},
    {"email": "patient@test.com",   "password": None, "role": "patient",   "patient_id": 1},
    {"email": "clinician@test.com", "password": None, "role": "clinician", "patient_id": None},
]

def _hash(pw):
    return bcrypt.generate_password_hash(pw).decode("utf-8")

users[0]["password"] = _hash("1234")
users[1]["password"] = _hash("1234")
users[2]["password"] = _hash("1234")

def is_admin():
    return get_jwt().get("role") == "admin"

MONTH_NAMES = {
    "01": "Jan", "02": "Feb", "03": "Mar", "04": "Apr",
    "05": "May", "06": "Jun", "07": "Jul", "08": "Aug",
    "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dec",
}

WARD_CAPACITY = {
    "General Ward A":    40,
    "General Ward B":    40,
    "Surgical Ward A":   30,
    "Surgical Ward B":   30,
    "Cardiology Ward A": 25,
    "Orthopedic Ward C": 25,
    "Neurology Ward":    20,
    "Pediatric Ward":    20,
    "ICU":               16,
}

def month_label(ym_str):
    try:
        parts = ym_str.split("-")
        return f"{MONTH_NAMES.get(parts[1], parts[1])} {parts[0]}"
    except Exception:
        return ym_str

def week_label(date_str):
    try:
        d = datetime.strptime(date_str, "%Y-%m-%d")
        week_of_month = (d.day - 1) // 7 + 1
        return f"{d.strftime('%b')} W{week_of_month}"
    except Exception:
        return date_str


@app.get("/")
def health():
    return jsonify({"msg": "API running"}), 200


@app.post("/login")
def login():
    data     = request.get_json() or {}
    email    = (data.get("email") or "").strip()
    password = (data.get("password") or "").strip()

    user = next((u for u in users if u["email"] == email), None)
    if not user or not bcrypt.check_password_hash(user["password"], password):
        return jsonify({"msg": "Bad credentials"}), 401

    token = create_access_token(
        identity=user["email"],
        additional_claims={"role": user["role"]},
    )
    return jsonify({"token": token, "role": user["role"]}), 200


@app.get("/patients")
@jwt_required()
def get_patients():
    patients = Patient.query.order_by(Patient.last_name).all()
    result = []
    for p in patients:
        p_dict = p.to_dict()
        latest = (
            Admission.query
            .filter_by(patient_id=p.id)
            .order_by(Admission.id.desc())
            .first()
        )
        if latest:
            p_dict["status"]       = latest.status
            p_dict["ward"]         = latest.ward
            p_dict["bed"]          = latest.bed
            p_dict["admit_date"]   = latest.admit_date
            p_dict["admission_id"] = latest.id
        else:
            p_dict["status"]       = "No Record"
            p_dict["ward"]         = "—"
            p_dict["bed"]          = "—"
            p_dict["admit_date"]   = "—"
            p_dict["admission_id"] = None
        result.append(p_dict)
    return jsonify(result), 200


@app.get("/patients/<int:patient_id>")
@jwt_required()
def get_patient(patient_id):
    patient = Patient.query.get_or_404(patient_id)
    p_dict  = patient.to_dict()
    latest  = (
        Admission.query
        .filter_by(patient_id=patient.id)
        .order_by(Admission.id.desc())
        .first()
    )
    p_dict["admission"] = latest.to_dict() if latest else None
    return jsonify(p_dict), 200


@app.get("/patients/<int:patient_id>/admissions")
@jwt_required()
def get_patient_admissions(patient_id):
    admissions = (
        Admission.query
        .filter_by(patient_id=patient_id)
        .order_by(Admission.id.desc())
        .all()
    )
    return jsonify([a.to_dict() for a in admissions]), 200


@app.get("/admissions/<int:admission_id>")
@jwt_required()
def get_admission(admission_id):
    admission = Admission.query.get_or_404(admission_id)
    return jsonify(admission.to_dict()), 200


@app.get("/patient/me")
@jwt_required()
def patient_me():
    email = get_jwt_identity()
    user  = next((u for u in users if u["email"] == email), None)
    if not user or user["role"] != "patient":
        return jsonify({"msg": "Forbidden"}), 403

    patient_id = user.get("patient_id")
    if not patient_id:
        return jsonify({"msg": "No patient record linked to this account"}), 404

    patient = db.session.get(Patient, patient_id)
    if not patient:
        return jsonify({"msg": "Patient not found"}), 404

    p_dict = patient.to_dict()
    latest = (
        Admission.query
        .filter_by(patient_id=patient.id)
        .order_by(Admission.id.desc())
        .first()
    )
    p_dict["admission"] = latest.to_dict() if latest else None
    return jsonify(p_dict), 200


@app.get("/appointments/patient/<int:patient_id>")
@jwt_required()
def get_patient_appointments(patient_id):
    appts = (
        Appointment.query
        .filter_by(patient_id=patient_id)
        .order_by(Appointment.appt_date, Appointment.appt_time)
        .all()
    )
    return jsonify([a.to_dict() for a in appts]), 200


@app.get("/appointments/me")
@jwt_required()
def get_my_appointments():
    email = get_jwt_identity()
    user  = next((u for u in users if u["email"] == email), None)
    if not user or user["role"] != "patient":
        return jsonify({"msg": "Forbidden"}), 403
    patient_id = user.get("patient_id")
    appts = (
        Appointment.query
        .filter_by(patient_id=patient_id)
        .order_by(Appointment.appt_date, Appointment.appt_time)
        .all()
    )
    return jsonify([a.to_dict() for a in appts]), 200


@app.post("/appointments")
@jwt_required()
def create_appointment():
    role = get_jwt().get("role")
    if role not in ["clinician", "admin"]:
        return jsonify({"msg": "Forbidden"}), 403
    data = request.get_json() or {}
    appt = Appointment(
        patient_id = data.get("patient_id"),
        clinician  = data.get("clinician", "Clinician"),
        appt_date  = data.get("appt_date"),
        appt_time  = data.get("appt_time", "09:00"),
        appt_type  = data.get("appt_type", "Follow-up"),
        status     = "Scheduled",
        notes      = data.get("notes", ""),
    )
    db.session.add(appt)
    db.session.commit()
    return jsonify(appt.to_dict()), 201


@app.patch("/appointments/<int:appt_id>")
@jwt_required()
def update_appointment(appt_id):
    role = get_jwt().get("role")
    if role not in ["clinician", "admin"]:
        return jsonify({"msg": "Forbidden"}), 403
    appt = db.session.get(Appointment, appt_id)
    if not appt:
        return jsonify({"msg": "Not found"}), 404
    data = request.get_json() or {}
    if "status" in data:
        appt.status = data["status"]
    if "notes" in data:
        appt.notes = data["notes"]
    db.session.commit()
    return jsonify(appt.to_dict()), 200


@app.get("/messages/patient/<int:patient_id>")
@jwt_required()
def get_messages_for_patient(patient_id):
    msgs = (
        Message.query
        .filter_by(patient_id=patient_id)
        .order_by(Message.created_at.desc())
        .all()
    )
    return jsonify([m.to_dict() for m in msgs]), 200


@app.get("/messages/me")
@jwt_required()
def get_my_messages():
    email = get_jwt_identity()
    user  = next((u for u in users if u["email"] == email), None)
    if not user or user["role"] != "patient":
        return jsonify({"msg": "Forbidden"}), 403
    patient_id = user.get("patient_id")
    msgs = (
        Message.query
        .filter_by(patient_id=patient_id)
        .order_by(Message.created_at.desc())
        .all()
    )
    return jsonify([m.to_dict() for m in msgs]), 200


@app.post("/messages")
@jwt_required()
def send_message():
    role = get_jwt().get("role")
    if role not in ["clinician", "admin"]:
        return jsonify({"msg": "Forbidden"}), 403
    data = request.get_json() or {}
    now  = datetime.now().strftime("%Y-%m-%d %H:%M")
    msg  = Message(
        patient_id = data.get("patient_id"),
        sender     = data.get("sender", "Clinician"),
        subject    = data.get("subject", "(No subject)"),
        body       = data.get("body", ""),
        created_at = now,
        is_read    = False,
    )
    db.session.add(msg)
    db.session.commit()
    return jsonify(msg.to_dict()), 201


@app.patch("/messages/<int:msg_id>/read")
@jwt_required()
def mark_message_read(msg_id):
    msg = db.session.get(Message, msg_id)
    if not msg:
        return jsonify({"msg": "Not found"}), 404
    msg.is_read = True
    db.session.commit()
    return jsonify(msg.to_dict()), 200


@app.post("/admissions/<int:adm_id>/notes")
@jwt_required()
def add_clinical_note(adm_id):
    role = get_jwt().get("role")
    if role not in ["clinician", "admin"]:
        return jsonify({"msg": "Forbidden"}), 403
    adm = db.session.get(Admission, adm_id)
    if not adm:
        return jsonify({"msg": "Not found"}), 404
    data = request.get_json() or {}
    note = ClinicalNote(
        admission_id = adm_id,
        author       = data.get("author", "Clinician"),
        note         = data.get("note", ""),
        created_at   = datetime.now().strftime("%Y-%m-%d %H:%M"),
    )
    db.session.add(note)
    db.session.commit()
    return jsonify(note.to_dict()), 201


@app.patch("/admissions/<int:adm_id>/vitals")
@jwt_required()
def update_vitals(adm_id):
    role = get_jwt().get("role")
    if role not in ["clinician", "admin"]:
        return jsonify({"msg": "Forbidden"}), 403
    adm = db.session.get(Admission, adm_id)
    if not adm:
        return jsonify({"msg": "Not found"}), 404
    data = request.get_json() or {}
    v = adm.vitals
    if not v:
        v = Vitals(admission_id=adm_id)
        db.session.add(v)
    for field in ["heart_rate", "blood_pressure", "temperature", "spo2", "resp_rate", "weight", "height"]:
        if field in data:
            setattr(v, field, data[field])
    db.session.commit()
    return jsonify(v.to_dict()), 200


@app.patch("/admissions/<int:adm_id>/discharge")
@jwt_required()
def discharge_patient(adm_id):
    role = get_jwt().get("role")
    if role not in ["clinician", "admin"]:
        return jsonify({"msg": "Forbidden"}), 403
    adm = db.session.get(Admission, adm_id)
    if not adm:
        return jsonify({"msg": "Not found"}), 404
    data          = request.get_json() or {}
    adm.status    = "Discharged"
    adm.discharge_date = data.get("discharge_date") or datetime.now().strftime("%Y-%m-%d")
    summary = data.get("summary", "").strip()
    if summary:
        adm.admission_notes = (adm.admission_notes or "") + f"\n\nDischarge Summary: {summary}"
    db.session.commit()
    return jsonify(adm.to_dict()), 200


@app.get("/notifications")
@jwt_required()
def get_notifications():
    email = get_jwt_identity()
    role  = get_jwt().get("role")
    user  = next((u for u in users if u["email"] == email), None)

    if role == "patient":
        patient_id      = user.get("patient_id") if user else None
        unread_msgs     = Message.query.filter_by(patient_id=patient_id, is_read=False).count() if patient_id else 0
        upcoming_appts  = Appointment.query.filter_by(patient_id=patient_id, status="Scheduled").count() if patient_id else 0
        return jsonify({"unread_messages": unread_msgs, "upcoming_appointments": upcoming_appts, "total": unread_msgs + upcoming_appts}), 200

    if role == "clinician":
        today        = datetime(2026, 3, 10).strftime("%Y-%m-%d")
        todays_appts = Appointment.query.filter_by(appt_date=today, status="Scheduled").count()
        return jsonify({"todays_appointments": todays_appts, "total": todays_appts}), 200

    if role == "admin":
        admitted = Admission.query.filter(Admission.status.in_(["Admitted", "Under Observation"])).count()
        return jsonify({"admitted_patients": admitted, "total": admitted}), 200

    return jsonify({"total": 0}), 200


@app.get("/admin/overview")
@jwt_required()
def admin_overview():
    if not is_admin():
        return jsonify({"msg": "Forbidden"}), 403

    today     = datetime(2026, 3, 10)
    week_ago  = (today - timedelta(days=7)).strftime("%Y-%m-%d")
    today_str = today.strftime("%Y-%m-%d")
    cur_month = today.strftime("%Y-%m")

    total_patients    = Patient.query.count()
    total_admissions  = Admission.query.count()
    currently_admitted = Admission.query.filter(
        Admission.status.in_(["Admitted", "Under Observation"])
    ).count()

    admissions_7d = Admission.query.filter(
        Admission.admit_date >= week_ago,
        Admission.admit_date <= today_str
    ).count()

    discharges_7d = Admission.query.filter(
        Admission.discharge_date >= week_ago,
        Admission.discharge_date <= today_str
    ).count()

    discharged = Admission.query.filter(Admission.discharge_date.isnot(None)).all()
    if discharged:
        los_days = [
            (datetime.strptime(a.discharge_date, "%Y-%m-%d") -
             datetime.strptime(a.admit_date,     "%Y-%m-%d")).days
            for a in discharged
        ]
        avg_los = round(sum(los_days) / len(los_days), 1)
    else:
        avg_los = 0

    total_cost = db.session.query(func.sum(Charge.amount)).scalar() or 0

    cost_mtd = (
        db.session.query(func.sum(Charge.amount))
        .join(Admission, Admission.id == Charge.admission_id)
        .filter(func.strftime("%Y-%m", Admission.admit_date) == cur_month)
        .scalar() or 0
    )

    cost_last_month_str = (today.replace(day=1) - timedelta(days=1)).strftime("%Y-%m")
    cost_last_month = (
        db.session.query(func.sum(Charge.amount))
        .join(Admission, Admission.id == Charge.admission_id)
        .filter(func.strftime("%Y-%m", Admission.admit_date) == cost_last_month_str)
        .scalar() or 0
    )

    cost_ytd = (
        db.session.query(func.sum(Charge.amount))
        .join(Admission, Admission.id == Charge.admission_id)
        .filter(func.strftime("%Y", Admission.admit_date) == str(today.year))
        .scalar() or 0
    )

    avg_cost_per_patient = round(total_cost / total_patients, 2) if total_patients else 0

    top_category = (
        db.session.query(Charge.category, func.sum(Charge.amount).label("total"))
        .group_by(Charge.category)
        .order_by(func.sum(Charge.amount).desc())
        .first()
    )
    top_dept_str = f"{top_category.category.title()} – ${top_category.total:,.0f}" if top_category else "—"

    proc_cost_total = db.session.query(func.sum(Procedure.cost)).scalar() or 0

    total_beds     = sum(WARD_CAPACITY.values())
    available_beds = max(0, total_beds - currently_admitted)

    icu_occupied = Admission.query.filter(
        Admission.ward == "ICU",
        Admission.status.in_(["Admitted", "Under Observation"])
    ).count()

    ward_rows = (
        db.session.query(Admission.ward, func.count(Admission.id).label("count"))
        .filter(Admission.status.in_(["Admitted", "Under Observation"]))
        .group_by(Admission.ward)
        .order_by(func.count(Admission.id).desc())
        .all()
    )
    resource_distribution = [
        {
            "label":     row.ward,
            "used":      row.count,
            "allocated": WARD_CAPACITY.get(row.ward, 30),
        }
        for row in ward_rows
    ]

    pending_discharge = Admission.query.filter(
        Admission.status == "Under Observation"
    ).count()

    return jsonify({
        "total_patients":        total_patients,
        "total_admissions":      total_admissions,
        "currently_admitted":    currently_admitted,
        "admissions_7d":         admissions_7d,
        "discharges_7d":         discharges_7d,
        "pending_discharge":     pending_discharge,
        "avg_los":               avg_los,
        "total_beds":            total_beds,
        "available_beds":        available_beds,
        "icu_beds":              WARD_CAPACITY["ICU"],
        "icu_occupied":          icu_occupied,
        "cost_mtd":              round(cost_mtd,          2),
        "cost_last_month":       round(cost_last_month,   2),
        "cost_ytd":              round(cost_ytd,          2),
        "cost_total":            round(total_cost,        2),
        "avg_cost_per_patient":  avg_cost_per_patient,
        "top_dept":              top_dept_str,
        "procedure_cost_total":  round(proc_cost_total,   2),
        "resource_distribution": resource_distribution,
    }), 200


@app.get("/admin/charts")
@jwt_required()
def admin_charts():
    if not is_admin():
        return jsonify({"msg": "Forbidden"}), 403

    cost_rows = (
        db.session.query(
            func.strftime("%Y-%m", Admission.admit_date).label("month"),
            func.sum(Charge.amount).label("total"),
        )
        .join(Charge, Charge.admission_id == Admission.id)
        .group_by("month")
        .order_by("month")
        .all()
    )
    cost_over_time = [
        {"month": month_label(row.month), "cost": round(row.total or 0, 2)}
        for row in cost_rows
    ]

    cutoff = (datetime(2026, 3, 10) - timedelta(weeks=8)).strftime("%Y-%m-%d")

    adm_rows = (
        Admission.query
        .filter(Admission.admit_date >= cutoff)
        .order_by(Admission.admit_date)
        .all()
    )

    week_map = {}
    for a in adm_rows:
        label = week_label(a.admit_date)
        if label not in week_map:
            week_map[label] = {"week": label, "admissions": 0, "discharges": 0, "_date": a.admit_date}
        week_map[label]["admissions"] += 1

    dis_rows = (
        Admission.query
        .filter(
            Admission.discharge_date.isnot(None),
            Admission.discharge_date >= cutoff
        )
        .order_by(Admission.discharge_date)
        .all()
    )
    for a in dis_rows:
        label = week_label(a.discharge_date)
        if label in week_map:
            week_map[label]["discharges"] += 1
        else:
            week_map[label] = {"week": label, "admissions": 0, "discharges": 1, "_date": a.discharge_date}

    adm_discharge = sorted(week_map.values(), key=lambda x: x["_date"])
    for row in adm_discharge:
        del row["_date"]

    return jsonify({
        "cost_over_time":    cost_over_time,
        "adm_discharge":     adm_discharge,
    }), 200


@app.get("/admin/activity")
@jwt_required()
def admin_activity():
    if not is_admin():
        return jsonify({"msg": "Forbidden"}), 403

    return jsonify([
        {"id": 1, "time": "2026-03-10 08:20", "actor": "clinician@test.com", "action": "Viewed patient snapshot"},
        {"id": 2, "time": "2026-03-10 09:14", "actor": "admin@test.com",     "action": "Generated weekly report"},
        {"id": 3, "time": "2026-03-10 10:02", "actor": "clinician@test.com", "action": "Updated clinical note"},
        {"id": 4, "time": "2026-03-10 11:30", "actor": "patient@test.com",   "action": "Viewed billing dashboard"},
    ]), 200


@app.post("/admin/report")
@jwt_required()
def admin_report():
    if not is_admin():
        return jsonify({"msg": "Forbidden"}), 403

    data        = request.get_json() or {}
    report_type = data.get("report_type", "weekly")
    report_id   = str(uuid.uuid4())
    return jsonify({"report_id": report_id, "status": "queued", "type": report_type}), 200


if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    app.run(debug=True, port=5001)
