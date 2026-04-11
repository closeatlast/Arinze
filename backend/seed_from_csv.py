import os
import re
import csv
import random
from datetime import datetime, timedelta
from collections import defaultdict

from app import app
from models import (
    db, Patient, Admission, Vitals,
    Medication, Procedure, Charge, ClinicalNote, Insurance,
    Appointment, Message,
)

random.seed(42)

CSV_DIR         = os.path.expanduser("~/Downloads/csv/")
TARGET_PATIENTS = 50
TODAY           = datetime(2026, 3, 10)
DATE_SHIFT      = timedelta(days=1573)
MIN_ORIG_DATE   = "2015-01-01"

BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]

WARDS = [
    "General Ward A", "General Ward B",
    "Surgical Ward A", "Surgical Ward B",
    "Cardiology Ward A", "Orthopedic Ward C",
    "Neurology Ward", "Pediatric Ward", "ICU",
]

APPT_TYPES = [
    "Follow-up Consultation", "Post-op Check", "Lab Review",
    "Discharge Planning", "Medication Review", "Physical Therapy",
    "Cardiology Consult", "Telemedicine Check-in",
]

APPT_TIMES = [
    "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
    "11:00", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30",
]

MESSAGE_TEMPLATES = [
    {
        "subject": "Discharge Instructions",
        "body": (
            "Please follow the attached discharge plan carefully. Take all prescribed "
            "medications as directed. Rest for at least 3–5 days and avoid strenuous "
            "activity. Contact us if you experience fever above 38.5°C or increased pain."
        ),
    },
    {
        "subject": "Lab Results Ready",
        "body": (
            "Your recent lab results have been reviewed. Your blood panel looks within "
            "acceptable ranges. We have updated your care plan accordingly. Please "
            "continue your current medications and attend your scheduled follow-up."
        ),
    },
    {
        "subject": "Upcoming Appointment Reminder",
        "body": (
            "This is a reminder of your upcoming appointment. Please arrive 15 minutes "
            "early to complete any required paperwork. Bring a list of your current "
            "medications and your insurance card."
        ),
    },
    {
        "subject": "Prescription Update",
        "body": (
            "Your attending physician has updated your prescription. Please review the "
            "changes and pick up your new medication from the hospital pharmacy. Contact "
            "the nursing team with any questions."
        ),
    },
    {
        "subject": "Care Plan Update",
        "body": (
            "Your care plan has been reviewed and updated following your most recent "
            "assessment. Your recovery is progressing well. We have adjusted your "
            "physical therapy schedule and updated your dietary recommendations."
        ),
    },
]

CLINICAL_NOTES = [
    "Patient is stable and responding well to current treatment. Continue monitoring vitals every 4 hours.",
    "Pain level reported at {pain}/10. Analgesics adjusted. Patient ambulated twice today with assistance.",
    "Labs reviewed: WBC trending down, indicating response to antibiotics. Recheck tomorrow morning.",
    "Discussed discharge plan with patient and family. Prescriptions prepared. Follow-up scheduled in 2 weeks.",
    "Patient complained of mild nausea this morning. Antiemetic given with good effect. Tolerating clear liquids.",
    "Wound site assessed — healing well with no signs of infection. Dressing changed.",
    "Physiotherapy session completed. Patient progressing with mobility exercises. ROM improving.",
    "ECG reviewed — no new changes. Continue telemetry overnight and reassess in the morning.",
    "Patient febrile at {temp}°C. Blood cultures drawn. IV antibiotics escalated per ID consult.",
    "Imaging results reviewed with radiology. Plan updated accordingly. Family notified.",
]

VITALS_CODES = {
    "8867-4":  "heart_rate",
    "8480-6":  "sys_bp",
    "8462-4":  "dia_bp",
    "8310-5":  "temperature",
    "2708-6":  "spo2",
    "9279-1":  "resp_rate",
    "29463-7": "weight",
    "8302-2":  "height",
}

COVERAGE_TIERS = [
    (90, 1000,  800,  3000),
    (80, 2000, 1500,  5000),
    (70, 3000, 2000,  7000),
    (60, 5000, 1000, 10000),
]


def read_csv(filename):
    path = os.path.join(CSV_DIR, filename)
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def shift_date(date_str):
    if not date_str:
        return None
    try:
        dt = datetime.strptime(date_str[:10], "%Y-%m-%d")
        return (dt + DATE_SHIFT).strftime("%Y-%m-%d")
    except ValueError:
        return None


def clean_name(raw):
    return re.sub(r"\d+", "", raw).strip()


def cm_to_height_str(cm_val):
    try:
        total_inches = float(cm_val) / 2.54
        feet  = int(total_inches // 12)
        inches = round(total_inches % 12)
        return f"{feet}'{inches}\""
    except (ValueError, TypeError):
        return None


def plan_name_for(payer_name):
    name_up = (payer_name or "").upper()
    if any(k in name_up for k in ("HMO", "KAISER", "MEDICAID")):
        return random.choice(["HMO Gold Plan", "HMO Silver Plan", "HMO Standard", "Managed Care"])
    if any(k in name_up for k in ("PPO", "BLUE", "BCBS", "AETNA", "UNITED", "CIGNA", "HUMANA")):
        return random.choice(["PPO Gold Plan", "PPO Platinum Plan", "PPO Silver Plan", "Open Access Plus"])
    if "MEDICARE" in name_up:
        return random.choice(["Part A & B", "Medicare Advantage"])
    return random.choice(["Choice Plan", "Savings Fund Plan", "Open Access Plan"])


def seed():
    print("Loading CSVs…")

    payers_map = {r["Id"]: r["NAME"] for r in read_csv("payers.csv")}

    providers_raw = read_csv("providers.csv")
    physicians = []
    for r in providers_raw:
        parts = r["NAME"].split()
        if len(parts) >= 2:
            first = clean_name(parts[0])
            last  = clean_name(parts[-1])
            if first and last:
                physicians.append(f"Dr. {first} {last}")
    physicians = list(dict.fromkeys(physicians))[:25] or ["Dr. Smith"]

    patient_payer: dict[str, str] = {}
    for r in read_csv("payer_transitions.csv"):
        pid = r["PATIENT"]
        patient_payer[pid] = payers_map.get(r["PAYER"], "BlueCross BlueShield")

    patient_allergies: dict[str, list] = defaultdict(list)
    for r in read_csv("allergies.csv"):
        desc = r.get("DESCRIPTION", "").strip()
        if desc:
            patient_allergies[r["PATIENT"]].append(desc)

    print("Filtering encounters…")
    enc_by_patient: dict[str, list] = defaultdict(list)
    for r in read_csv("encounters.csv"):
        if (
            r["ENCOUNTERCLASS"] in ("inpatient", "emergency")
            and r["START"][:10] >= MIN_ORIG_DATE
        ):
            enc_by_patient[r["PATIENT"]].append(r)

    eligible_pids = [pid for pid, encs in enc_by_patient.items() if encs]
    random.shuffle(eligible_pids)
    selected_pids = set(eligible_pids[:TARGET_PATIENTS])
    print(f"Selected {len(selected_pids)} patients from {len(eligible_pids)} eligible.")

    patients_rows = {r["Id"]: r for r in read_csv("patients.csv")}

    print("Loading conditions…")
    conditions_by_enc: dict[str, list] = defaultdict(list)
    for r in read_csv("conditions.csv"):
        conditions_by_enc[r["ENCOUNTER"]].append(r["DESCRIPTION"])

    print("Loading medications…")
    meds_by_enc: dict[str, list] = defaultdict(list)
    for r in read_csv("medications.csv"):
        meds_by_enc[r["ENCOUNTER"]].append(r)

    print("Loading procedures…")
    procs_by_enc: dict[str, list] = defaultdict(list)
    for r in read_csv("procedures.csv"):
        procs_by_enc[r["ENCOUNTER"]].append(r)

    print("Loading observations (vital signs)…")
    vitals_by_enc: dict[str, dict] = defaultdict(dict)
    for r in read_csv("observations.csv"):
        code = r.get("CODE", "")
        if code in VITALS_CODES and r.get("CATEGORY") == "vital-signs":
            vitals_by_enc[r["ENCOUNTER"]][VITALS_CODES[code]] = r["VALUE"]

    print("Writing to database…")

    with app.app_context():
        db.drop_all()
        db.create_all()
        print("Tables created.")

        patients_created = []

        for idx, pid in enumerate(sorted(selected_pids)):
            pr = patients_rows.get(pid)
            if not pr:
                continue

            gender       = "Male" if pr["GENDER"] == "M" else "Female"
            first_name   = clean_name(pr["FIRST"])
            last_name    = clean_name(pr["LAST"])
            allergies_list = list(dict.fromkeys(patient_allergies.get(pid, [])))[:3]
            allergy_str  = ", ".join(allergies_list)

            patient = Patient(
                mrn        = f"MRN-{10000 + idx:05d}",
                first_name = first_name or "Patient",
                last_name  = last_name  or str(idx),
                dob        = pr["BIRTHDATE"],
                gender     = gender,
                blood_type = random.choice(BLOOD_TYPES),
                phone      = f"({random.randint(200,999)}) {random.randint(200,999)}-{random.randint(1000,9999)}",
                email      = f"{first_name.lower() or 'patient'}.{last_name.lower() or str(idx)}@email.com",
                address    = f"{pr['ADDRESS']}, {pr['CITY']}, {pr['STATE']} {pr['ZIP']}",
                allergies  = allergy_str,
            )
            db.session.add(patient)
            db.session.flush()

            for enc in enc_by_patient[pid]:
                admit_date     = shift_date(enc["START"])
                discharge_date = shift_date(enc["STOP"]) if enc.get("STOP") else None

                if not admit_date:
                    continue
                admit_dt = datetime.strptime(admit_date, "%Y-%m-%d")
                if admit_dt > TODAY:
                    continue

                days_since_admit = (TODAY - admit_dt).days
                if days_since_admit <= 45 and random.random() < 0.6:
                    status         = random.choice(["Admitted", "Under Observation"])
                    discharge_date = None
                elif discharge_date:
                    dis_dt = datetime.strptime(discharge_date, "%Y-%m-%d")
                    if dis_dt <= TODAY:
                        status = "Discharged"
                    else:
                        discharge_date = None
                        status = random.choice(["Admitted", "Under Observation"])
                else:
                    status = random.choice(["Admitted", "Under Observation"])

                admission_type = "Emergency" if enc["ENCOUNTERCLASS"] == "emergency" else "Elective"
                physician      = random.choice(physicians)
                ward           = random.choice(WARDS)

                enc_conditions = conditions_by_enc.get(enc["Id"], [])
                primary_dx     = (
                    enc_conditions[0]
                    if enc_conditions
                    else (enc.get("REASONDESCRIPTION") or enc.get("DESCRIPTION") or "Unspecified")
                )
                secondary_dx   = ", ".join(enc_conditions[1:4])
                chief_complaint = (enc.get("REASONDESCRIPTION") or enc.get("DESCRIPTION") or "Unspecified complaint")

                los_days = 3
                if discharge_date and status == "Discharged":
                    los_days = max(1, (datetime.strptime(discharge_date, "%Y-%m-%d") - admit_dt).days)

                admission = Admission(
                    patient_id          = patient.id,
                    admit_date          = admit_date,
                    discharge_date      = discharge_date if status == "Discharged" else None,
                    ward                = ward,
                    bed                 = f"Bed {random.randint(1, 30):02d}",
                    attending_physician = physician,
                    admission_type      = admission_type,
                    status              = status,
                    chief_complaint     = chief_complaint[:200],
                    primary_diagnosis   = primary_dx[:200],
                    secondary_diagnoses = secondary_dx[:400],
                    admission_notes     = (
                        f"Patient admitted via {admission_type.lower()} presenting with "
                        f"{chief_complaint.lower()[:100]}."
                    ),
                )
                db.session.add(admission)
                db.session.flush()

                ev = vitals_by_enc.get(enc["Id"], {})
                sys_bp = ev.get("sys_bp")
                dia_bp = ev.get("dia_bp")
                bp_str = (
                    f"{int(float(sys_bp))}/{int(float(dia_bp))}"
                    if sys_bp and dia_bp
                    else f"{random.randint(100, 160)}/{random.randint(60, 100)}"
                )
                hr   = int(float(ev["heart_rate"])) if "heart_rate" in ev else random.randint(55, 115)
                temp = f"{float(ev['temperature']):.1f}°C" if "temperature" in ev else f"{round(random.uniform(36.2, 39.1), 1)}°C"
                spo2 = f"{int(float(ev['spo2']))}%" if "spo2" in ev else f"{random.randint(93, 100)}%"
                rr   = int(float(ev["resp_rate"])) if "resp_rate" in ev else random.randint(12, 24)
                wt   = f"{round(float(ev['weight']), 1)} kg" if "weight" in ev else f"{random.randint(52, 110)} kg"
                ht   = (cm_to_height_str(ev["height"]) if "height" in ev else None) or random.choice(["5'3\"", "5'6\"", "5'9\"", "6'0\""])

                db.session.add(Vitals(
                    admission_id   = admission.id,
                    heart_rate     = hr,
                    blood_pressure = bp_str,
                    temperature    = temp,
                    spo2           = spo2,
                    resp_rate      = rr,
                    weight         = wt,
                    height         = ht,
                ))

                for m in meds_by_enc.get(enc["Id"], [])[:5]:
                    med_name   = (m.get("DESCRIPTION") or "Unknown Medication")[:120]
                    cost       = float(m.get("BASE_COST") or 0)
                    med_status = "Active" if status != "Discharged" else random.choice(["Discontinued", "Discharged Rx"])
                    db.session.add(Medication(
                        admission_id = admission.id,
                        name         = med_name,
                        route        = "PO",
                        frequency    = "Daily",
                        status       = med_status,
                        cost         = round(cost, 2),
                    ))

                enc_procs = procs_by_enc.get(enc["Id"], [])[:3]
                for p in enc_procs:
                    proc_name = (p.get("DESCRIPTION") or "Procedure")[:150]
                    cost      = float(p.get("BASE_COST") or 0)
                    db.session.add(Procedure(
                        admission_id = admission.id,
                        name         = proc_name,
                        cost         = round(cost, 2),
                        proc_date    = admit_date,
                    ))

                days_val = max(1, los_days)
                db.session.add(Charge(admission_id=admission.id, category="room",      description=f"Room & Board ({days_val} days)", amount=round(850 * days_val, 2)))
                db.session.add(Charge(admission_id=admission.id, category="meals",     description=f"Meals ({days_val} days)",         amount=round(45 * days_val, 2)))
                db.session.add(Charge(admission_id=admission.id, category="lab",       description="Laboratory Tests",                amount=round(random.uniform(300, 900), 2)))
                db.session.add(Charge(admission_id=admission.id, category="radiology", description="Radiology / Imaging",             amount=round(random.uniform(200, 700), 2)))
                if random.random() > 0.4:
                    db.session.add(Charge(admission_id=admission.id, category="therapy", description="Physical / Occupational Therapy", amount=round(random.uniform(100, 500), 2)))
                if enc_procs:
                    proc_total = sum(float(p.get("BASE_COST") or 0) for p in enc_procs)
                    if proc_total > 0:
                        db.session.add(Charge(admission_id=admission.id, category="procedure", description="Procedure Fees", amount=round(proc_total, 2)))

                num_notes    = random.randint(2, 4)
                note_offsets = random.sample(range(0, max(1, days_val)), k=min(num_notes, max(1, days_val)))
                for offset in note_offsets:
                    note_dt   = admit_dt + timedelta(days=offset, hours=random.randint(7, 21), minutes=random.choice([0, 15, 30, 45]))
                    note_text = random.choice(CLINICAL_NOTES).format(
                        pain=random.randint(2, 8),
                        temp=round(random.uniform(37.5, 39.1), 1),
                    )
                    db.session.add(ClinicalNote(
                        admission_id = admission.id,
                        author       = random.choice(physicians),
                        note         = note_text,
                        created_at   = note_dt.strftime("%Y-%m-%d %H:%M"),
                    ))

            payer_name = patient_payer.get(pid, "BlueCross BlueShield")
            plan       = plan_name_for(payer_name)
            cov_pct, ded_total, ded_met_base, oop_max = random.choice(COVERAGE_TIERS)
            ded_met = min(ded_total, ded_met_base + random.randint(-200, 200))
            oop_met = min(oop_max,  random.randint(300, int(oop_max * 0.7)))
            db.session.add(Insurance(
                patient_id        = patient.id,
                provider          = payer_name,
                plan_name         = plan,
                member_id         = f"{payer_name[:3].upper()}-{random.randint(1000000, 9999999)}",
                group_number      = f"GRP-{random.randint(10000, 99999)}",
                coverage_pct      = cov_pct,
                deductible_total  = float(ded_total),
                deductible_met    = float(max(0, ded_met)),
                out_of_pocket_max = float(oop_max),
                out_of_pocket_met = float(max(0, oop_met)),
                effective_date    = "2026-01-01",
                expiry_date       = "2026-12-31",
            ))

            for _ in range(random.randint(2, 4)):
                future_days = random.randint(1, 90)
                appt_date   = (TODAY + timedelta(days=future_days)).strftime("%Y-%m-%d")
                db.session.add(Appointment(
                    patient_id = patient.id,
                    clinician  = random.choice(physicians),
                    appt_date  = appt_date,
                    appt_time  = random.choice(APPT_TIMES),
                    appt_type  = random.choice(APPT_TYPES),
                    status     = "Scheduled",
                    notes      = "",
                ))

            for k in range(random.randint(2, 4)):
                tmpl     = random.choice(MESSAGE_TEMPLATES)
                days_ago = random.randint(1, 30)
                sent_at  = (TODAY - timedelta(days=days_ago)).strftime("%Y-%m-%d %H:%M")
                is_read = False if (patient.id == 1 and k < 2) else random.choice([True, True, False])
                db.session.add(Message(
                    patient_id = patient.id,
                    sender     = random.choice(physicians),
                    subject    = tmpl["subject"],
                    body       = tmpl["body"],
                    created_at = sent_at,
                    is_read    = is_read,
                ))

            patients_created.append(patient)
            if (idx + 1) % 10 == 0:
                print(f"  …{idx + 1} patients done")

        all_admissions = Admission.query.all()
        random.shuffle(all_admissions)
        target_active = max(8, len(all_admissions) // 5)
        activated = 0
        for adm in all_admissions:
            if activated >= target_active:
                break
            adm.discharge_date = None
            adm.status = random.choice(["Admitted", "Under Observation"])
            for med in adm.medications:
                med.status = "Active"
            activated += 1

        db.session.commit()
        print(f"\n✅ Seeded {len(patients_created)} patients from CSV data.")
        print(f"   Encounters, vitals, medications, procedures, charges,")
        print(f"   clinical notes, insurance, appointments, and messages created.")
        active_count = Admission.query.filter(Admission.status.in_(["Admitted", "Under Observation"])).count()
        print(f"   Active admissions: {active_count} / {len(all_admissions)} total.")


if __name__ == "__main__":
    seed()
