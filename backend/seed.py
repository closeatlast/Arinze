import random
from datetime import datetime, timedelta
from faker import Faker
from app import app
from models import (
    db, Patient, Admission, Vitals,
    Medication, Procedure, Charge, ClinicalNote, Insurance,
    Appointment, Message
)

fake = Faker()
random.seed(42)
Faker.seed(42)

BLOOD_TYPES   = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]
GENDERS       = ["Male", "Female"]
ALLERGIES_POOL = ["Penicillin", "Sulfa drugs", "Latex", "Aspirin", "Codeine",
                  "Iodine", "Morphine", "NSAIDs", "None"]

WARDS = [
    "General Ward A", "General Ward B",
    "Surgical Ward A", "Surgical Ward B",
    "Cardiology Ward A", "Orthopedic Ward C",
    "Neurology Ward", "Pediatric Ward", "ICU",
]

PHYSICIANS = [
    "Dr. Sarah Okonkwo", "Dr. James Obi", "Dr. Amina Yusuf",
    "Dr. Chidi Nwosu", "Dr. Fatima Al-Rashid", "Dr. Kevin Mensah",
    "Dr. Priya Sharma", "Dr. Marcus Webb", "Dr. Ngozi Eze",
]

NURSES = [
    "Nurse T. Adeyemi", "Nurse B. Eze", "Nurse K. Mensah",
    "Nurse L. Okafor", "Nurse A. Ibrahim",
]

DIAGNOSES = [
    ("Acute Appendicitis",      ["Mild Dehydration", "Leukocytosis"]),
    ("Unstable Angina",         ["Hypertension", "Type 2 Diabetes"]),
    ("Community-acquired Pneumonia", ["Hypoxia", "Dehydration"]),
    ("Closed Tibial Fracture",  ["Soft Tissue Contusion", "Mild Concussion"]),
    ("Acute Ischemic Stroke",   ["Hypertension", "Atrial Fibrillation"]),
    ("Diabetic Ketoacidosis",   ["Type 1 Diabetes", "Dehydration"]),
    ("Sepsis",                  ["UTI", "Acute Kidney Injury"]),
    ("COPD Exacerbation",       ["Chronic Bronchitis", "Hypoxia"]),
    ("Acute Pancreatitis",      ["Gallstones", "Mild Dehydration"]),
    ("Hypertensive Crisis",     ["Chronic Hypertension", "Headache"]),
    ("Hip Fracture",            ["Osteoporosis", "Anemia"]),
    ("Acute Asthma Attack",     ["Allergic Rhinitis"]),
    ("Bowel Obstruction",       ["Dehydration", "Abdominal Distension"]),
    ("Pulmonary Embolism",      ["DVT", "Tachycardia"]),
    ("Cellulitis – Right Leg",  ["Leukocytosis"]),
]

PROCEDURES_POOL = [
    ("Appendectomy", 7200),
    ("ORIF – Tibia", 8500),
    ("Coronary Angiography", 4300),
    ("Bronchoscopy", 2800),
    ("CT Scan – Abdomen", 1400),
    ("MRI – Brain", 2200),
    ("Chest X-Ray", 320),
    ("Lumbar Puncture", 980),
    ("Endoscopy", 1850),
    ("Echocardiogram", 1100),
    ("Blood Transfusion", 760),
    ("Central Line Placement", 1200),
    ("Intubation / Mechanical Ventilation", 3400),
    ("General Anesthesia", 1800),
    ("Post-Op Monitoring", 950),
    ("Wound Debridement", 1100),
    ("Fracture Reduction", 3200),
    ("Cardiac Catheterization", 5600),
]

MEDICATIONS_POOL = [
    ("Amoxicillin 500mg",        "IV",  "Q8H",            85,  "Active"),
    ("Ibuprofen 400mg",          "PO",  "Q6H PRN",         18, "Active"),
    ("Metoprolol 25mg",          "PO",  "BID",             22, "Active"),
    ("Atorvastatin 40mg",        "PO",  "Nightly",         35, "Active"),
    ("Lisinopril 10mg",          "PO",  "Daily",           28, "Active"),
    ("Aspirin 81mg",             "PO",  "Daily",           12, "Active"),
    ("Ondansetron 4mg",          "IV",  "Q6H PRN",         45, "Active"),
    ("IV Fluids (NS 0.9%)",      "IV",  "125 mL/hr",       95, "Active"),
    ("Heparin 5000 units",       "SC",  "Q12H",            62, "Active"),
    ("Enoxaparin 40mg",          "SC",  "Daily",           78, "Active"),
    ("Furosemide 40mg",          "IV",  "BID",             34, "Active"),
    ("Prednisone 40mg",          "PO",  "Daily",           29, "Active"),
    ("Salbutamol Inhaler",       "INH", "Q4H PRN",         42, "Active"),
    ("Tramadol 50mg",            "PO",  "Q6H PRN",         33, "Active"),
    ("Insulin Glargine 20 units","SC",  "Nightly",         88, "Active"),
    ("Pantoprazole 40mg",        "IV",  "Daily",           54, "Active"),
    ("Ceftriaxone 1g",           "IV",  "Q24H",            110,"Active"),
    ("Vancomycin 1g",            "IV",  "Q12H",            145,"Active"),
    ("Nitroglycerin 0.4mg SL",   "SL",  "PRN chest pain",  18, "Active"),
]

INSURANCE_PROVIDERS = [
    ("BlueCross BlueShield",  ["PPO Gold Plan",       "HMO Silver Plan",  "PPO Platinum Plan"]),
    ("Aetna",                 ["Choice POS II",       "HMO 20",           "Open Access Select"]),
    ("UnitedHealthcare",      ["Choice Plus PPO",     "Select Plus HMO",  "Core Network"]),
    ("Cigna",                 ["Open Access Plus",    "LocalPlus",        "Savings Fund Plan"]),
    ("Humana",                ["Gold Plus HMO",       "Choice PPO",       "National POS"]),
    ("Kaiser Permanente",     ["HMO Standard",        "HMO Deductible",   "Senior Advantage"]),
    ("Medicaid",              ["Standard Medicaid",   "Managed Care"]),
    ("Medicare",              ["Part A & B",          "Medicare Advantage"]),
]

COVERAGE_TIERS = [
    (90, 1000,  800,  3000, 900),
    (80, 2000, 1500,  5000, 1200),
    (70, 3000, 2000,  7000, 1500),
    (60, 5000, 1000, 10000, 500),
]

APPT_TYPES = [
    "Follow-up Consultation",
    "Post-op Check",
    "Lab Review",
    "Discharge Planning",
    "Medication Review",
    "Physical Therapy",
    "Cardiology Consult",
    "Telemedicine Check-in",
]

APPT_TIMES = ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
              "11:00", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30"]

MESSAGE_TEMPLATES = [
    {
        "subject": "Discharge Instructions",
        "body": "Please follow the attached discharge plan carefully. Take all prescribed medications as directed. Rest for at least 3-5 days and avoid strenuous activity. Contact us if you experience fever above 38.5°C, increased pain, or any unusual symptoms.",
    },
    {
        "subject": "Lab Results Ready",
        "body": "Your recent lab results have been reviewed. Your blood panel looks within acceptable ranges. We have updated your care plan accordingly. Please continue your current medications and attend your scheduled follow-up appointment.",
    },
    {
        "subject": "Upcoming Appointment Reminder",
        "body": "This is a reminder of your upcoming appointment. Please arrive 15 minutes early to complete any required paperwork. Bring a list of your current medications and your insurance card. If you need to reschedule, please call us at least 24 hours in advance.",
    },
    {
        "subject": "Prescription Update",
        "body": "Your attending physician has updated your prescription. Please review the changes and pick up your new medication from the hospital pharmacy. If you have any questions or concerns about the new medication, do not hesitate to contact the nursing team.",
    },
    {
        "subject": "Care Plan Update",
        "body": "Your care plan has been reviewed and updated following your most recent assessment. Your recovery is progressing well. We have adjusted your physical therapy schedule and updated your dietary recommendations. Please review the attached notes at your next visit.",
    },
    {
        "subject": "Post-Procedure Follow-up",
        "body": "Thank you for coming in for your procedure. Your recovery appears to be on track. Please monitor the treatment site for any signs of redness, swelling, or discharge. Keep the area clean and dry. Your next follow-up is already scheduled — you will receive a reminder shortly.",
    },
]

CLINICAL_NOTES_TEMPLATES = [
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

def rand_date_between(start_str, end_str):
    start = datetime.strptime(start_str, "%Y-%m-%d")
    end   = datetime.strptime(end_str,   "%Y-%m-%d")
    delta = (end - start).days
    return (start + timedelta(days=random.randint(0, delta))).strftime("%Y-%m-%d")

def rand_admit_date():
    base = datetime(2026, 1, 1)
    offset = random.randint(0, 68)
    return (base + timedelta(days=offset)).strftime("%Y-%m-%d")

def rand_discharge(admit_str, status):
    if status == "Discharged":
        admit = datetime.strptime(admit_str, "%Y-%m-%d")
        stay  = random.randint(2, 10)
        discharge = admit + timedelta(days=stay)
        today = datetime(2026, 3, 10)
        if discharge > today:
            discharge = today
        return discharge.strftime("%Y-%m-%d")
    return None

def note_timestamp(admit_str, offset_days=0):
    dt = datetime.strptime(admit_str, "%Y-%m-%d") + timedelta(days=offset_days)
    dt = dt.replace(hour=random.randint(7, 21), minute=random.choice([0, 15, 30, 45]))
    return dt.strftime("%Y-%m-%d %H:%M")


def seed():
    with app.app_context():
        db.drop_all()
        db.create_all()
        print("Tables created.")

        patients_created = []

        for i in range(50):
            gender   = random.choice(GENDERS)
            first    = fake.first_name_male() if gender == "Male" else fake.first_name_female()
            last     = fake.last_name()
            dob      = rand_date_between("1940-01-01", "2005-12-31")
            allergies_list = random.sample(ALLERGIES_POOL[:-1], k=random.randint(0, 2))

            patient = Patient(
                mrn        = f"MRN-{88300 + i:05d}",
                first_name = first,
                last_name  = last,
                dob        = dob,
                gender     = gender,
                blood_type = random.choice(BLOOD_TYPES),
                phone      = fake.phone_number()[:20],
                email      = fake.email(),
                address    = fake.address().replace("\n", ", ")[:200],
                allergies  = ", ".join(allergies_list),
            )
            db.session.add(patient)
            db.session.flush()

            num_admissions = random.randint(1, 2)
            for j in range(num_admissions):
                status       = random.choices(
                    ["Admitted", "Under Observation", "Discharged"],
                    weights=[30, 20, 50], k=1
                )[0]
                admit_date   = rand_admit_date()
                discharge_dt = rand_discharge(admit_date, status)
                diag, sec    = random.choice(DIAGNOSES)
                physician    = random.choice(PHYSICIANS)
                ward         = random.choice(WARDS)
                admit_type   = random.choice(["Emergency", "Elective"])

                admission = Admission(
                    patient_id          = patient.id,
                    admit_date          = admit_date,
                    discharge_date      = discharge_dt,
                    ward                = ward,
                    bed                 = f"Bed {random.randint(1, 30):02d}",
                    attending_physician = physician,
                    admission_type      = admit_type,
                    status              = status,
                    chief_complaint     = fake.sentence(nb_words=8).rstrip("."),
                    primary_diagnosis   = diag,
                    secondary_diagnoses = ", ".join(sec),
                    admission_notes     = fake.paragraph(nb_sentences=4),
                )
                db.session.add(admission)
                db.session.flush()

                hr = random.randint(55, 115)
                vitals = Vitals(
                    admission_id  = admission.id,
                    heart_rate    = hr,
                    blood_pressure= f"{random.randint(100,160)}/{random.randint(60,100)}",
                    temperature   = f"{round(random.uniform(36.2, 39.1), 1)}°C",
                    spo2          = f"{random.randint(93, 100)}%",
                    resp_rate     = random.randint(12, 24),
                    weight        = f"{random.randint(52, 110)} kg",
                    height        = random.choice(["5'3\"","5'5\"","5'7\"","5'9\"","5'11\"","6'0\"","6'2\""]),
                )
                db.session.add(vitals)

                meds_sample = random.sample(MEDICATIONS_POOL, k=random.randint(2, 5))
                for m in meds_sample:
                    name, route, freq, cost, status_m = m
                    med_status = status_m if status != "Discharged" else random.choice(["Discontinued", "Discharged Rx"])
                    db.session.add(Medication(
                        admission_id = admission.id,
                        name         = name,
                        route        = route,
                        frequency    = freq,
                        status       = med_status,
                        cost         = cost,
                    ))

                procs_sample = random.sample(PROCEDURES_POOL, k=random.randint(1, 3))
                for proc_name, proc_cost in procs_sample:
                    db.session.add(Procedure(
                        admission_id = admission.id,
                        name         = proc_name,
                        cost         = proc_cost + random.randint(-200, 300),
                        proc_date    = admit_date,
                    ))

                days = random.randint(2, 10)
                db.session.add(Charge(admission_id=admission.id, category="room",      description=f"Room & Board ({days} days)", amount=round(850 * days, 2)))
                db.session.add(Charge(admission_id=admission.id, category="meals",     description=f"Meals ({days} days)",         amount=round(45 * days, 2)))
                db.session.add(Charge(admission_id=admission.id, category="lab",       description="Laboratory Tests",              amount=round(random.uniform(300, 900), 2)))
                db.session.add(Charge(admission_id=admission.id, category="radiology", description="Radiology / Imaging",           amount=round(random.uniform(200, 700), 2)))
                if random.random() > 0.4:
                    db.session.add(Charge(admission_id=admission.id, category="therapy", description="Physical / Occupational Therapy", amount=round(random.uniform(100, 500), 2)))

                num_notes = random.randint(2, 4)
                for day_offset in random.sample(range(0, max(1, days)), k=min(num_notes, max(1, days))):
                    template = random.choice(CLINICAL_NOTES_TEMPLATES)
                    note_text = template.format(
                        pain=random.randint(2, 8),
                        temp=round(random.uniform(37.5, 39.1), 1)
                    )
                    author = physician if random.random() > 0.4 else random.choice(NURSES)
                    db.session.add(ClinicalNote(
                        admission_id = admission.id,
                        author       = author,
                        note         = note_text,
                        created_at   = note_timestamp(admit_date, day_offset),
                    ))

            provider_name, plans = random.choice(INSURANCE_PROVIDERS)
            plan_name             = random.choice(plans)
            cov_pct, ded_total, ded_met, oop_max, oop_met = random.choice(COVERAGE_TIERS)
            ded_met  = min(ded_total,  ded_met  + random.randint(-200, 200))
            oop_met  = min(oop_max,    oop_met  + random.randint(-300, 300))
            eff_year = random.choice([2024, 2025, 2026])
            db.session.add(Insurance(
                patient_id        = patient.id,
                provider          = provider_name,
                plan_name         = plan_name,
                member_id         = f"{provider_name[:3].upper()}-{random.randint(1000000, 9999999)}",
                group_number      = f"GRP-{random.randint(10000, 99999)}",
                coverage_pct      = cov_pct,
                deductible_total  = float(ded_total),
                deductible_met    = float(max(0, ded_met)),
                out_of_pocket_max = float(oop_max),
                out_of_pocket_met = float(max(0, oop_met)),
                effective_date    = f"{eff_year}-01-01",
                expiry_date       = f"{eff_year}-12-31",
            ))

            for _ in range(random.randint(2, 4)):
                future_days = random.randint(1, 90)
                appt_date   = (datetime(2026, 3, 10) + timedelta(days=future_days)).strftime("%Y-%m-%d")
                appt_status = "Scheduled" if future_days > 0 else "Completed"
                db.session.add(Appointment(
                    patient_id = patient.id,
                    clinician  = random.choice(PHYSICIANS),
                    appt_date  = appt_date,
                    appt_time  = random.choice(APPT_TIMES),
                    appt_type  = random.choice(APPT_TYPES),
                    status     = appt_status,
                    notes      = fake.sentence(nb_words=10) if random.random() > 0.5 else "",
                ))

            num_msgs = random.randint(2, 4)
            for k in range(num_msgs):
                template  = random.choice(MESSAGE_TEMPLATES)
                days_ago  = random.randint(1, 30)
                sent_at   = (datetime(2026, 3, 10) - timedelta(days=days_ago)).strftime("%Y-%m-%d %H:%M")
                is_read = False if (patient.id == 1 and k < 2) else random.choice([True, True, False])
                db.session.add(Message(
                    patient_id = patient.id,
                    sender     = random.choice(PHYSICIANS),
                    subject    = template["subject"],
                    body       = template["body"],
                    created_at = sent_at,
                    is_read    = is_read,
                ))

            patients_created.append(patient)

        db.session.commit()
        print(f"✅ Seeded {len(patients_created)} patients with admissions, vitals, medications, procedures, charges, notes, insurance, appointments, and messages.")


if __name__ == "__main__":
    seed()
