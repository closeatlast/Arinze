# Arinze Health Systems

A full-stack hospital management web application with role-based dashboards for admins, clinicians, and patients.

## Tech Stack

- **Backend:** Python, Flask, SQLAlchemy, Flask-JWT-Extended, Flask-Bcrypt
- **Frontend:** React, React Router
- **Database:** SQLite

---

## Project Structure

```
Arinze/
├── backend/
│   ├── app.py              # Flask API + all routes
│   ├── models.py           # SQLAlchemy database models
│   ├── seed.py             # Faker-based demo seeder
│   ├── seed_from_csv.py    # Synthea CSV data seeder
│   └── requirements.txt
└── frontend/
    ├── public/
    └── src/
        ├── App.js
        ├── Login.js
        ├── Admin.js
        ├── Clinician.js
        └── Patient.js
```

---

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/closeatlast/Arinze.git
cd Arinze
```

---

### 2. Set up the backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

#### Seed the database

```bash
python3 seed.py
```

Then start the Flask server:

```bash
python3 app.py
```

The backend runs at **http://127.0.0.1:5001**

---

### 3. Set up the frontend

Open a new terminal tab:

```bash
cd frontend
npm install
npm start
```

The frontend runs at **http://localhost:3000**

---

## Demo Accounts

| Role      | Email                  | Password |
|-----------|------------------------|----------|
| Admin     | admin@test.com         | 1234     |
| Clinician | clinician@test.com     | 1234     |
| Patient   | patient@test.com       | 1234     |

These are pre-filled on the login page for convenience.

---

## Dashboards

### Admin
- Hospital stats: occupancy, revenue, active patients, procedures
- Weekly admissions/discharges bar chart
- Monthly revenue trend chart
- Staff on duty panel
- CSV report download

### Clinician
- Patient list with search
- Per-patient snapshot: vitals, medications, clinical notes
- Edit vitals inline
- Add clinical notes
- Schedule and manage appointments
- Send messages to patients
- Discharge workflow

### Patient
- Billing breakdown: room charges, procedures, medications
- Insurance summary with deductible and out-of-pocket tracking
- Payment form (card or bank transfer)
- Appointments tab
- Messages tab with unread indicators
- Downloadable bill (print to PDF)
