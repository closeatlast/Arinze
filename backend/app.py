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
from collections import defaultdict
import os
import uuid

from models import db, Patient, Admission, Charge, Procedure, Medication, Appointment, Message, ClinicalNote, Vitals, User

print("RUNNING FILE:", os.path.abspath(__file__))

app = Flask(__name__)
CORS(app)

app.config["JWT_SECRET_KEY"]               = "super-secret-key"
app.config["SQLALCHEMY_DATABASE_URI"]      = "sqlite:///hospital.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["JWT_ACCESS_TOKEN_EXPIRES"]     = timedelta(hours=8)

bcrypt = Bcrypt(app)
jwt    = JWTManager(app)
db.init_app(app)

def is_admin():
    return get_jwt().get("role") == "admin"

MONTH_NAMES = {
    "01": "Jan", "02": "Feb", "03": "Mar", "04": "Apr",
    "05": "May", "06": "Jun", "07": "Jul", "08": "Aug",
    "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dec",
}

WARD_CAPACITY = {
    "General Ward A":    50,
    "General Ward B":    50,
    "Surgical Ward A":   55,
    "Surgical Ward B":   50,
    "Cardiology Ward A": 45,
    "Orthopedic Ward C": 60,
    "Neurology Ward":    45,
    "Pediatric Ward":    55,
    "ICU":               45,
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

    user = User.query.filter_by(email=email.lower()).first()
    if not user or not bcrypt.check_password_hash(user.password_hash, password):
        return jsonify({"msg": "Bad credentials"}), 401

    token = create_access_token(
        identity=user.email,
        additional_claims={
            "role":       user.role,
            "name":       user.name       or "",
            "department": user.department or "",
        },
    )
    return jsonify({"token": token, "role": user.role}), 200

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

@app.get("/clinician/patients")
@jwt_required()
def clinician_patients():
    if get_jwt().get("role") != "clinician":
        return jsonify({"msg": "Forbidden"}), 403

    physician_name = get_jwt().get("name", "")
    if not physician_name:
        return jsonify([]), 200

    admission_rows = (
        Admission.query
        .filter_by(attending_physician=physician_name)
        .order_by(Admission.id.desc())
        .all()
    )
    seen_pids = []
    for a in admission_rows:
        if a.patient_id not in seen_pids:
            seen_pids.append(a.patient_id)

    result = []
    for pid in seen_pids:
        patient = db.session.get(Patient, pid)
        if not patient:
            continue
        p_dict = patient.to_dict()
        latest = (
            Admission.query
            .filter_by(patient_id=pid, attending_physician=physician_name)
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

    result.sort(key=lambda p: p["last_name"])
    return jsonify(result), 200

@app.get("/admin/clinicians")
@jwt_required()
def admin_clinicians():
    if not is_admin():
        return jsonify({"msg": "Forbidden"}), 403

    rows = (
        db.session.query(
            Admission.attending_physician,
            func.count(Admission.patient_id.distinct()).label("active_patients"),
        )
        .filter(Admission.status.in_(["Admitted", "Under Observation"]))
        .group_by(Admission.attending_physician)
        .order_by(func.count(Admission.patient_id.distinct()).desc())
        .all()
    )

    clinicians = [
        {"name": r.attending_physician, "active_patients": r.active_patients}
        for r in rows
    ]
    return jsonify({"clinicians": clinicians, "total": len(clinicians)}), 200

@app.get("/patients/<int:patient_id>")
@jwt_required()
def get_patient(patient_id):
    patient = Patient.query.get_or_404(patient_id)
    p_dict  = patient.to_dict()

    claims = get_jwt()
    physician_name = claims.get("name", "") if claims.get("role") == "clinician" else ""

    if physician_name:
        latest = (
            Admission.query
            .filter_by(patient_id=patient.id, attending_physician=physician_name)
            .order_by(Admission.id.desc())
            .first()
        )
    else:
        latest = (
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
    user  = User.query.filter_by(email=email).first()
    if not user or user.role != "patient":
        return jsonify({"msg": "Forbidden"}), 403

    patient_id = user.patient_id
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
    user  = User.query.filter_by(email=email).first()
    if not user or user.role != "patient":
        return jsonify({"msg": "Forbidden"}), 403
    patient_id = user.patient_id
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

@app.patch("/appointments/<int:appt_id>/cancel")
@jwt_required()
def cancel_appointment(appt_id):
    claims = get_jwt()
    if claims.get("role") != "patient":
        return jsonify({"msg": "Forbidden"}), 403
    email = get_jwt_identity()
    user  = User.query.filter_by(email=email).first()
    appt  = db.session.get(Appointment, appt_id)
    if not appt:
        return jsonify({"msg": "Not found"}), 404
    if not user or appt.patient_id != user.patient_id:
        return jsonify({"msg": "Forbidden"}), 403
    if appt.status != "Scheduled":
        return jsonify({"msg": "Only scheduled appointments can be cancelled"}), 400
    appt.status = "Cancelled"
    db.session.commit()
    return jsonify(appt.to_dict()), 200

@app.get("/messages/patient/<int:patient_id>")
@jwt_required()
def get_messages_for_patient(patient_id):
    msgs = (
        Message.query
        .filter_by(patient_id=patient_id, parent_id=None)
        .order_by(Message.created_at.desc())
        .all()
    )
    return jsonify([m.to_dict() for m in msgs]), 200

@app.get("/messages/me")
@jwt_required()
def get_my_messages():
    email = get_jwt_identity()
    user  = User.query.filter_by(email=email).first()
    if not user or user.role != "patient":
        return jsonify({"msg": "Forbidden"}), 403
    patient_id = user.patient_id
    msgs = (
        Message.query
        .filter_by(patient_id=patient_id, parent_id=None)
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

@app.post("/messages/<int:msg_id>/reply")
@jwt_required()
def reply_to_message(msg_id):
    claims = get_jwt()
    role   = claims.get("role")
    if role not in ["patient", "clinician", "admin"]:
        return jsonify({"msg": "Forbidden"}), 403

    parent = db.session.get(Message, msg_id)
    if not parent:
        return jsonify({"msg": "Not found"}), 404

    if role == "patient":
        email = get_jwt_identity()
        user  = User.query.filter_by(email=email).first()
        if not user or user.patient_id != parent.patient_id:
            return jsonify({"msg": "Forbidden"}), 403
        sender = user.name or "Patient"
    else:
        sender = claims.get("name", "Care Team")

    data  = request.get_json() or {}
    reply = Message(
        patient_id = parent.patient_id,
        sender     = sender,
        subject    = f"Re: {parent.subject}",
        body       = data.get("body", ""),
        created_at = datetime.now().strftime("%Y-%m-%d %H:%M"),
        is_read    = False,
        parent_id  = parent.id,
    )
    db.session.add(reply)
    db.session.commit()
    return jsonify(parent.to_dict()), 201

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
    user  = User.query.filter_by(email=email).first()

    if role == "patient":
        patient_id      = user.patient_id if user else None
        unread_msgs     = Message.query.filter_by(patient_id=patient_id, is_read=False).count() if patient_id else 0
        upcoming_appts  = Appointment.query.filter_by(patient_id=patient_id, status="Scheduled").count() if patient_id else 0
        return jsonify({"unread_messages": unread_msgs, "upcoming_appointments": upcoming_appts, "total": unread_msgs + upcoming_appts}), 200

    if role == "clinician":
        name = get_jwt().get("name", "")
        unread_msgs = (
            db.session.query(func.count(Message.id))
            .join(Admission, Admission.patient_id == Message.patient_id)
            .filter(
                Admission.attending_physician == name,
                Message.is_read == False,
            )
            .scalar() or 0
        )
        return jsonify({"unread_messages": unread_msgs, "total": unread_msgs}), 200

    if role == "admin":
        admitted = db.session.query(
            func.count(Admission.patient_id.distinct())
        ).filter(Admission.status.in_(["Admitted", "Under Observation"])).scalar() or 0
        return jsonify({"admitted_patients": admitted, "total": admitted}), 200

    return jsonify({"total": 0}), 200

@app.get("/admin/overview")
@jwt_required()
def admin_overview():
    if not is_admin():
        return jsonify({"msg": "Forbidden"}), 403

    today     = datetime.now()
    week_ago  = (today - timedelta(days=7)).strftime("%Y-%m-%d")
    today_str = today.strftime("%Y-%m-%d")
    cur_month = today.strftime("%Y-%m")

    total_patients    = Patient.query.count()
    total_admissions  = Admission.query.count()
    currently_admitted = db.session.query(
        func.count(Admission.patient_id.distinct())
    ).filter(
        Admission.status.in_(["Admitted", "Under Observation"])
    ).scalar() or 0

    admissions_7d = db.session.query(
        func.count(Admission.patient_id.distinct())
    ).filter(
        Admission.admit_date >= week_ago,
        Admission.admit_date <= today_str
    ).scalar() or 0

    discharges_7d = db.session.query(
        func.count(Admission.patient_id.distinct())
    ).filter(
        Admission.discharge_date >= week_ago,
        Admission.discharge_date <= today_str
    ).scalar() or 0

    discharged = Admission.query.filter(Admission.discharge_date.isnot(None)).all()
    if discharged:
        los_days = []
        for a in discharged:
            try:
                los = (datetime.strptime(a.discharge_date, "%Y-%m-%d") -
                       datetime.strptime(a.admit_date,     "%Y-%m-%d")).days
                if los >= 1:
                    los_days.append(los)
            except (ValueError, TypeError):
                pass
        avg_los = round(sum(los_days) / len(los_days), 1) if los_days else 0
    else:
        avg_los = 0

    total_cost = db.session.query(func.sum(Charge.amount)).scalar() or 0

    cost_mtd = (
        db.session.query(func.sum(Charge.amount))
        .join(Admission, Admission.id == Charge.admission_id)
        .filter(
            Admission.status == "Discharged",
            func.strftime("%Y-%m", Admission.admit_date) == cur_month,
        )
        .scalar() or 0
    )

    cost_last_month_str = (today.replace(day=1) - timedelta(days=1)).strftime("%Y-%m")
    cost_last_month = (
        db.session.query(func.sum(Charge.amount))
        .join(Admission, Admission.id == Charge.admission_id)
        .filter(
            Admission.status == "Discharged",
            func.strftime("%Y-%m", Admission.admit_date) == cost_last_month_str,
        )
        .scalar() or 0
    )

    cost_ytd = (
        db.session.query(func.sum(Charge.amount))
        .join(Admission, Admission.id == Charge.admission_id)
        .filter(
            Admission.status == "Discharged",
            func.strftime("%Y", Admission.admit_date) == str(today.year),
        )
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

    icu_occupied = db.session.query(
        func.count(Admission.patient_id.distinct())
    ).filter(
        Admission.ward == "ICU",
        Admission.status.in_(["Admitted", "Under Observation"])
    ).scalar() or 0

    ward_rows = (
        db.session.query(Admission.ward, func.count(Admission.patient_id.distinct()).label("count"))
        .filter(Admission.status.in_(["Admitted", "Under Observation"]))
        .group_by(Admission.ward)
        .order_by(func.count(Admission.patient_id.distinct()).desc())
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

    pending_discharge = db.session.query(
        func.count(Admission.patient_id.distinct())
    ).filter(
        Admission.status == "Under Observation"
    ).scalar() or 0

    staff_on_duty = (
        db.session.query(func.count(Admission.attending_physician.distinct()))
        .filter(Admission.status.in_(["Admitted", "Under Observation"]))
        .scalar() or 0
    )

    twelve_months_ago = (today - timedelta(days=365)).strftime("%Y-%m-%d")
    cost_12m = (
        db.session.query(func.sum(Charge.amount))
        .join(Admission, Admission.id == Charge.admission_id)
        .filter(Admission.admit_date >= twelve_months_ago)
        .scalar() or 0
    )
    annual_budget = round(cost_12m * 1.15 / 1000) * 1000

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
        "staff_on_duty":         staff_on_duty,
        "annual_budget":         annual_budget,
    }), 200

@app.get("/admin/charts")
@jwt_required()
def admin_charts():
    if not is_admin():
        return jsonify({"msg": "Forbidden"}), 403

    cost_cutoff = f"{datetime.now().year}-01-01"
    cost_rows = (
        db.session.query(
            func.strftime("%Y-%m", Admission.admit_date).label("month"),
            func.sum(Charge.amount).label("total"),
        )
        .join(Charge, Charge.admission_id == Admission.id)
        .filter(
            Admission.status == "Discharged",
            Admission.admit_date >= cost_cutoff,
        )
        .group_by("month")
        .order_by("month")
        .all()
    )
    cost_over_time = [
        {"month": month_label(row.month), "cost": round(row.total or 0, 2)}
        for row in cost_rows
    ]

    cutoff = (datetime.now() - timedelta(weeks=10)).strftime("%Y-%m-%d")

    adm_rows = (
        Admission.query
        .filter(
            Admission.status == "Discharged",
            Admission.admit_date >= cutoff,
        )
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

    activities = []

    note_rows = (
        db.session.query(ClinicalNote, Patient)
        .join(Admission, ClinicalNote.admission_id == Admission.id)
        .join(Patient, Admission.patient_id == Patient.id)
        .order_by(ClinicalNote.created_at.desc())
        .limit(8)
        .all()
    )
    for note, pt in note_rows:
        activities.append({
            "time":   note.created_at,
            "actor":  note.author,
            "action": f"Clinical note added for {pt.first_name} {pt.last_name}",
        })

    adm_rows = (
        db.session.query(Admission, Patient)
        .join(Patient, Admission.patient_id == Patient.id)
        .order_by(Admission.admit_date.desc())
        .limit(8)
        .all()
    )
    for adm, pt in adm_rows:
        activities.append({
            "time":   adm.admit_date + " 08:00",
            "actor":  adm.attending_physician,
            "action": f"{pt.first_name} {pt.last_name} admitted to {adm.ward}",
        })

    dis_rows = (
        db.session.query(Admission, Patient)
        .join(Patient, Admission.patient_id == Patient.id)
        .filter(Admission.discharge_date.isnot(None))
        .order_by(Admission.discharge_date.desc())
        .limit(6)
        .all()
    )
    for adm, pt in dis_rows:
        activities.append({
            "time":   adm.discharge_date + " 14:00",
            "actor":  adm.attending_physician,
            "action": f"{pt.first_name} {pt.last_name} discharged from {adm.ward}",
        })

    activities.sort(key=lambda x: x["time"], reverse=True)
    return jsonify([{"id": i + 1, **a} for i, a in enumerate(activities[:20])]), 200

@app.get("/admin/waste")
@jwt_required()
def admin_waste():
    if not is_admin():
        return jsonify({"msg": "Forbidden"}), 403

    items = []

    ninety_days_ago = (datetime.now() - timedelta(days=90)).strftime("%Y-%m-%d")

    disc_rows = (
        db.session.query(
            Admission.ward,
            func.sum(Medication.cost).label("total"),
            func.count(Medication.id).label("cnt"),
        )
        .join(Medication, Medication.admission_id == Admission.id)
        .filter(
            Medication.status.in_(["Discontinued", "Discharged Rx"]),
            Medication.cost > 0,
            Admission.admit_date >= ninety_days_ago,
        )
        .group_by(Admission.ward)
        .order_by(func.sum(Medication.cost).desc())
        .all()
    )
    disc_total = round(sum(r.total for r in disc_rows), 0)
    disc_count = sum(r.cnt for r in disc_rows)
    if disc_total > 0:
        top_ward = disc_rows[0].ward if disc_rows else "ICU"
        items.append({
            "id": 1,
            "category": "Unused Medications",
            "department": top_ward,
            "value": f"${disc_total:,.0f}",
            "severity": "high" if disc_total > 5000 else "medium",
            "detail": f"{disc_count} discontinued medications with unrecovered pharmacy costs.",
        })

    all_discharged = Admission.query.filter(Admission.discharge_date.isnot(None)).all()
    if all_discharged:
        all_los = [
            max(1, (datetime.strptime(a.discharge_date, "%Y-%m-%d") -
                    datetime.strptime(a.admit_date,     "%Y-%m-%d")).days)
            for a in all_discharged
        ]
        avg_los_all = sum(all_los) / len(all_los)

        long_stay_threshold = 14
        today_str = datetime.now().strftime("%Y-%m-%d")
        active_adms = Admission.query.filter(
            Admission.status.in_(["Admitted", "Under Observation"]),
            Admission.admit_date.isnot(None),
        ).all()
        prolonged = []
        for a in active_adms:
            try:
                current_los = (
                    datetime.strptime(today_str,    "%Y-%m-%d") -
                    datetime.strptime(a.admit_date, "%Y-%m-%d")
                ).days
                if current_los > long_stay_threshold:
                    prolonged.append((a, current_los))
            except (ValueError, TypeError):
                pass

        if prolonged:
            extra_cost = round(sum((los - long_stay_threshold) * 220 for _, los in prolonged))
            ward_freq: dict = {}
            for a, _ in prolonged:
                ward_freq[a.ward] = ward_freq.get(a.ward, 0) + 1
            top_ward = max(ward_freq, key=ward_freq.get)
            items.append({
                "id": 2,
                "category": "Prolonged Active Stays",
                "department": top_ward,
                "value": f"${extra_cost:,.0f}",
                "severity": "high" if len(prolonged) > 30 else "medium",
                "detail": (
                    f"{len(prolonged)} currently admitted patients have exceeded "
                    f"{long_stay_threshold} days (3.5× the average LOS). Estimated at $220/day in extended overhead."
                ),
            })

    historical_cutoff = (datetime.now() - timedelta(days=70)).strftime("%Y-%m-%d")
    multi_pids = [
        r[0] for r in
        db.session.query(Admission.patient_id)
        .group_by(Admission.patient_id)
        .having(func.count(Admission.id) > 1)
        .all()
    ]
    if multi_pids:
        all_multi_adms = (
            Admission.query
            .filter(
                Admission.patient_id.in_(multi_pids),
                Admission.admit_date < historical_cutoff,
                Admission.discharge_date.isnot(None),
            )
            .order_by(Admission.patient_id, Admission.admit_date)
            .all()
        )
        by_patient: dict = defaultdict(list)
        for a in all_multi_adms:
            by_patient[a.patient_id].append(a)

        readmit_count   = 0
        readmit_ids     = []
        readmit_wards: dict = {}
        for pid, adms in by_patient.items():
            for i in range(len(adms) - 1):
                prev, curr = adms[i], adms[i + 1]
                if not prev.discharge_date or not curr.admit_date:
                    continue
                try:
                    gap = (
                        datetime.strptime(curr.admit_date,      "%Y-%m-%d") -
                        datetime.strptime(prev.discharge_date,  "%Y-%m-%d")
                    ).days
                    if 0 <= gap <= 30:
                        readmit_count += 1
                        readmit_ids.append(curr.id)
                        readmit_wards[curr.ward] = readmit_wards.get(curr.ward, 0) + 1
                except (ValueError, TypeError):
                    pass

        if readmit_count > 0:
            readmit_cost = (
                db.session.query(func.sum(Charge.amount))
                .filter(Charge.admission_id.in_(readmit_ids))
                .scalar() or 0
            )
            est_avoidable = round(readmit_cost * 0.20)
            top_ward = max(readmit_wards, key=readmit_wards.get) if readmit_wards else "General Ward"
            items.append({
                "id": 3,
                "category": "30-Day Readmissions",
                "department": top_ward,
                "value": f"${est_avoidable:,.0f}",
                "severity": "high" if readmit_count > 50 else "medium",
                "detail": (
                    f"{readmit_count} patients readmitted within 30 days of prior discharge. "
                    f"20% of readmission costs attributed as potentially avoidable."
                ),
            })

    icu_elective_ids = [
        r[0] for r in
        db.session.query(Admission.id)
        .filter(Admission.ward == "ICU", Admission.admission_type == "Elective")
        .all()
    ]
    if icu_elective_ids:
        icu_elective_cost = (
            db.session.query(func.sum(Charge.amount))
            .filter(Charge.admission_id.in_(icu_elective_ids))
            .scalar() or 0
        )
        est_icu_avoidable = round(icu_elective_cost * 0.30)
        items.append({
            "id": 4,
            "category": "Elective ICU Placements",
            "department": "ICU",
            "value": f"${est_icu_avoidable:,.0f}",
            "severity": "high" if len(icu_elective_ids) > 30 else "medium",
            "detail": (
                f"{len(icu_elective_ids)} elective admissions assigned to ICU. "
                f"30% of associated costs flagged as potentially avoidable resource misallocation."
            ),
        })

    therapy_adm_ids = set(
        r[0] for r in
        db.session.query(Charge.admission_id)
        .filter(Charge.category == "therapy")
        .all()
    )
    no_therapy_adms = Admission.query.filter(
        Admission.discharge_date.isnot(None),
        Admission.id.notin_(list(therapy_adm_ids)),
    ).all()
    long_no_therapy = []
    for a in no_therapy_adms:
        try:
            los = (
                datetime.strptime(a.discharge_date, "%Y-%m-%d") -
                datetime.strptime(a.admit_date,     "%Y-%m-%d")
            ).days
            if los > 5:
                long_no_therapy.append((a, los))
        except (ValueError, TypeError):
            pass
    if long_no_therapy:
        missed_pt_cost = round(sum(los * 120 for _, los in long_no_therapy))
        nt_wards: dict = {}
        for a, _ in long_no_therapy:
            nt_wards[a.ward] = nt_wards.get(a.ward, 0) + 1
        top_nt_ward = max(nt_wards, key=nt_wards.get) if nt_wards else "General Ward"
        items.append({
            "id": 5,
            "category": "Unbilled PT / OT Sessions",
            "department": top_nt_ward,
            "value": f"${missed_pt_cost:,.0f}",
            "severity": "medium",
            "detail": (
                f"{len(long_no_therapy)} patients stayed 5+ days with no physical or "
                f"occupational therapy charge recorded. Estimated at $120/day."
            ),
        })

    total = sum(
        int(item["value"].replace("$", "").replace(",", ""))
        for item in items
    )
    return jsonify({"items": items, "total": total}), 200

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
