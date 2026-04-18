# Arinze Health Systems

A full-stack hospital management platform with role-based dashboards for administrators, clinicians, and patients. Built with React, Flask, and SQLite, using synthetic EHR data from [Synthea](https://synthea.mitre.org/).

## Tech Stack

- **Backend:** Python, Flask, SQLAlchemy, Flask-JWT-Extended, Flask-Bcrypt
- **Frontend:** React, React Router, Recharts
- **Database:** SQLite
- **Data:** Synthea synthetic EHR (561 patients, 1,641 admissions)

---

## Project Structure

```
Arinze/
├── backend/
│   ├── app.py              # Flask REST API and all routes
│   ├── models.py           # SQLAlchemy database models
│   ├── seed_from_csv.py    # Synthea CSV ingestion pipeline
│   └── instance/
│       └── hospital.db     # Pre-built SQLite database (ready to use)
│   ├── requirements.txt
├── frontend/
│   ├── public/
│   └── src/
│       ├── App.js
│       ├── Login.js
│       ├── Admin.js
│       ├── Clinician.js
│       └── Patient.js
└── credentials.csv         # All demo login credentials
```

---

## Getting Started

The database is already built and included in the repo. You do not need to run the seeder.

### 1. Clone the repository

```bash
git clone https://github.com/closeatlast/Arinze.git
cd Arinze
```

### 2. Start the backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
python3 app.py
```

The backend runs at **http://127.0.0.1:5001**

### 3. Start the frontend

Open a new terminal tab:

```bash
cd frontend
npm install
npm start
```

The frontend runs at **http://localhost:3000**

---

## Demo Accounts

Full credentials for all 561 patients and 25 clinicians are in `credentials.csv`. Quick start accounts:

| Role      | Email                        | Password     |
|-----------|------------------------------|--------------|
| Admin     | admin@arinze.com             | admin2026    |
| Clinician | almeta.carter@arinze.com     | almeta2026   |
| Patient   | abel.dooley@gmail.com        | abel2026     |

All clinician passwords follow the pattern `firstname2026`. All patient passwords follow the same pattern.

---

## Dashboards

### Admin
- Live metrics: bed occupancy, admissions, discharges, average length of stay, cost MTD/YTD
- Monthly billing trend chart (YTD, discharged patients)
- Weekly admissions vs discharges bar chart
- Ward-by-ward resource distribution
- Clinicians on duty with active patient counts
- Downloadable HTML operations report

### Clinician
- Patient list filtered to the logged-in physician's own patients
- Per-patient detail: vitals, medications, procedures, charges, clinical notes, insurance
- Write clinical notes, update vitals inline
- Schedule appointments and send messages to patients
- Discharge workflow with summary notes

### Patient
- Itemized billing: room & board, lab, radiology, therapy, procedures, medications
- Insurance summary with coverage percentage, deductible, and out-of-pocket tracking
- Calculated balance due
- Appointments tab
- Messages inbox with unread indicators
- Downloadable bill (print to PDF)

---

## Rebuilding the Database

If you want to regenerate the database from raw Synthea CSVs:

1. Generate a Synthea dataset (`--population 2500` recommended) and export CSVs
2. Place the CSVs in `~/Downloads/csv/`
3. Run: `python3 seed_from_csv.py`
