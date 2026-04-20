from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()


class Patient(db.Model):
    __tablename__ = "patients"

    id             = db.Column(db.Integer, primary_key=True)
    mrn            = db.Column(db.String(20), unique=True, nullable=False)
    first_name     = db.Column(db.String(80), nullable=False)
    last_name      = db.Column(db.String(80), nullable=False)
    dob            = db.Column(db.String(20), nullable=False)
    gender         = db.Column(db.String(10))
    blood_type     = db.Column(db.String(5))
    phone          = db.Column(db.String(20))
    email          = db.Column(db.String(120))
    address        = db.Column(db.String(200))
    allergies      = db.Column(db.String(200), default="")

    admissions     = db.relationship("Admission",    back_populates="patient", cascade="all, delete-orphan")
    insurance      = db.relationship("Insurance",    back_populates="patient", uselist=False, cascade="all, delete-orphan")
    appointments   = db.relationship("Appointment",  back_populates="patient", cascade="all, delete-orphan")
    messages       = db.relationship("Message",      back_populates="patient", cascade="all, delete-orphan")

    def to_dict(self):
        from datetime import date
        dob_date  = datetime.strptime(self.dob, "%Y-%m-%d").date()
        age       = (date.today() - dob_date).days // 365
        return {
            "id":         self.id,
            "mrn":        self.mrn,
            "first_name": self.first_name,
            "last_name":  self.last_name,
            "name":       f"{self.first_name} {self.last_name}",
            "dob":        self.dob,
            "age":        age,
            "gender":     self.gender,
            "blood_type": self.blood_type,
            "phone":      self.phone,
            "email":      self.email,
            "address":    self.address,
            "allergies":  [a.strip() for a in self.allergies.split(",") if a.strip()],
            "insurance":  self.insurance.to_dict() if self.insurance else None,
        }


class Admission(db.Model):
    __tablename__ = "admissions"

    id                    = db.Column(db.Integer, primary_key=True)
    patient_id            = db.Column(db.Integer, db.ForeignKey("patients.id"), nullable=False)
    admit_date            = db.Column(db.String(20))
    discharge_date        = db.Column(db.String(20), nullable=True)
    ward                  = db.Column(db.String(80))
    bed                   = db.Column(db.String(20))
    attending_physician   = db.Column(db.String(100))
    admission_type        = db.Column(db.String(20))
    status                = db.Column(db.String(30))
    chief_complaint       = db.Column(db.Text)
    primary_diagnosis     = db.Column(db.String(200))
    secondary_diagnoses   = db.Column(db.String(400), default="")
    admission_notes       = db.Column(db.Text)

    patient        = db.relationship("Patient", back_populates="admissions")
    vitals         = db.relationship("Vitals",        back_populates="admission", uselist=False, cascade="all, delete-orphan")
    medications    = db.relationship("Medication",    back_populates="admission", cascade="all, delete-orphan")
    procedures     = db.relationship("Procedure",     back_populates="admission", cascade="all, delete-orphan")
    charges        = db.relationship("Charge",        back_populates="admission", cascade="all, delete-orphan")
    clinical_notes = db.relationship("ClinicalNote",  back_populates="admission", cascade="all, delete-orphan", order_by="ClinicalNote.created_at.desc()")

    def to_dict(self):
        return {
            "id":                  self.id,
            "patient_id":          self.patient_id,
            "admit_date":          self.admit_date,
            "discharge_date":      self.discharge_date,
            "ward":                self.ward,
            "bed":                 self.bed,
            "attending_physician": self.attending_physician,
            "admission_type":      self.admission_type,
            "status":              self.status,
            "chief_complaint":     self.chief_complaint,
            "primary_diagnosis":   self.primary_diagnosis,
            "secondary_diagnoses": [d.strip() for d in self.secondary_diagnoses.split(",") if d.strip()],
            "admission_notes":     self.admission_notes,
            "vitals":              self.vitals.to_dict()         if self.vitals         else None,
            "medications":         [m.to_dict() for m in self.medications],
            "procedures":          [p.to_dict() for p in self.procedures],
            "charges":             [c.to_dict() for c in self.charges],
            "clinical_notes":      [n.to_dict() for n in self.clinical_notes],
        }


class Vitals(db.Model):
    __tablename__ = "vitals"

    id           = db.Column(db.Integer, primary_key=True)
    admission_id = db.Column(db.Integer, db.ForeignKey("admissions.id"), nullable=False)
    heart_rate   = db.Column(db.Integer)
    blood_pressure = db.Column(db.String(10))
    temperature  = db.Column(db.String(10))
    spo2         = db.Column(db.String(6))
    resp_rate    = db.Column(db.Integer)
    weight       = db.Column(db.String(10))
    height       = db.Column(db.String(10))

    admission    = db.relationship("Admission", back_populates="vitals")

    def to_dict(self):
        return {
            "heart_rate":     self.heart_rate,
            "blood_pressure": self.blood_pressure,
            "temperature":    self.temperature,
            "spo2":           self.spo2,
            "resp_rate":      self.resp_rate,
            "weight":         self.weight,
            "height":         self.height,
        }


class Medication(db.Model):
    __tablename__ = "medications"

    id           = db.Column(db.Integer, primary_key=True)
    admission_id = db.Column(db.Integer, db.ForeignKey("admissions.id"), nullable=False)
    name         = db.Column(db.String(120))
    route        = db.Column(db.String(20))
    frequency    = db.Column(db.String(60))
    status       = db.Column(db.String(30))
    cost         = db.Column(db.Float, default=0.0)

    admission    = db.relationship("Admission", back_populates="medications")

    def to_dict(self):
        return {
            "id":        self.id,
            "name":      self.name,
            "route":     self.route,
            "frequency": self.frequency,
            "status":    self.status,
            "cost":      self.cost,
        }


class Procedure(db.Model):
    __tablename__ = "procedures"

    id           = db.Column(db.Integer, primary_key=True)
    admission_id = db.Column(db.Integer, db.ForeignKey("admissions.id"), nullable=False)
    name         = db.Column(db.String(150))
    cost         = db.Column(db.Float, default=0.0)
    proc_date    = db.Column(db.String(20))

    admission    = db.relationship("Admission", back_populates="procedures")

    def to_dict(self):
        return {
            "id":        self.id,
            "name":      self.name,
            "cost":      self.cost,
            "proc_date": self.proc_date,
        }


class Charge(db.Model):
    __tablename__ = "charges"

    id           = db.Column(db.Integer, primary_key=True)
    admission_id = db.Column(db.Integer, db.ForeignKey("admissions.id"), nullable=False)
    category     = db.Column(db.String(60))
    description  = db.Column(db.String(200))
    amount       = db.Column(db.Float, default=0.0)

    admission    = db.relationship("Admission", back_populates="charges")

    def to_dict(self):
        return {
            "id":          self.id,
            "category":    self.category,
            "description": self.description,
            "amount":      self.amount,
        }


class Insurance(db.Model):
    __tablename__ = "insurance"

    id                  = db.Column(db.Integer, primary_key=True)
    patient_id          = db.Column(db.Integer, db.ForeignKey("patients.id"), nullable=False, unique=True)
    provider            = db.Column(db.String(100))
    plan_name           = db.Column(db.String(100))
    member_id           = db.Column(db.String(40))
    group_number        = db.Column(db.String(30))
    coverage_pct        = db.Column(db.Integer)
    deductible_total    = db.Column(db.Float)
    deductible_met      = db.Column(db.Float)
    out_of_pocket_max   = db.Column(db.Float)
    out_of_pocket_met   = db.Column(db.Float)
    effective_date      = db.Column(db.String(20))
    expiry_date         = db.Column(db.String(20))

    patient = db.relationship("Patient", back_populates="insurance")

    def to_dict(self):
        deductible_remaining   = round(max(self.deductible_total  - self.deductible_met,  0), 2)
        oop_remaining          = round(max(self.out_of_pocket_max - self.out_of_pocket_met, 0), 2)
        return {
            "id":                    self.id,
            "provider":              self.provider,
            "plan_name":             self.plan_name,
            "member_id":             self.member_id,
            "group_number":          self.group_number,
            "coverage_pct":          self.coverage_pct,
            "deductible_total":      self.deductible_total,
            "deductible_met":        self.deductible_met,
            "deductible_remaining":  deductible_remaining,
            "out_of_pocket_max":     self.out_of_pocket_max,
            "out_of_pocket_met":     self.out_of_pocket_met,
            "out_of_pocket_remaining": oop_remaining,
            "effective_date":        self.effective_date,
            "expiry_date":           self.expiry_date,
        }


class ClinicalNote(db.Model):
    __tablename__ = "clinical_notes"

    id           = db.Column(db.Integer, primary_key=True)
    admission_id = db.Column(db.Integer, db.ForeignKey("admissions.id"), nullable=False)
    author       = db.Column(db.String(100))
    note         = db.Column(db.Text)
    created_at   = db.Column(db.String(30))

    admission    = db.relationship("Admission", back_populates="clinical_notes")

    def to_dict(self):
        return {
            "id":         self.id,
            "author":     self.author,
            "note":       self.note,
            "created_at": self.created_at,
        }


class Appointment(db.Model):
    __tablename__ = "appointments"

    id         = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.Integer, db.ForeignKey("patients.id"), nullable=False)
    clinician  = db.Column(db.String(100))
    appt_date  = db.Column(db.String(20))
    appt_time  = db.Column(db.String(10))
    appt_type  = db.Column(db.String(60))
    status     = db.Column(db.String(30), default="Scheduled")
    notes      = db.Column(db.Text, default="")

    patient = db.relationship("Patient", back_populates="appointments")

    def to_dict(self):
        return {
            "id":         self.id,
            "patient_id": self.patient_id,
            "clinician":  self.clinician,
            "appt_date":  self.appt_date,
            "appt_time":  self.appt_time,
            "appt_type":  self.appt_type,
            "status":     self.status,
            "notes":      self.notes,
        }


class Message(db.Model):
    __tablename__ = "messages"

    id         = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.Integer, db.ForeignKey("patients.id"), nullable=False)
    sender     = db.Column(db.String(100))
    subject    = db.Column(db.String(200))
    body       = db.Column(db.Text)
    created_at = db.Column(db.String(30))
    is_read    = db.Column(db.Boolean, default=False)
    parent_id  = db.Column(db.Integer, db.ForeignKey("messages.id"), nullable=True)

    patient  = db.relationship("Patient", back_populates="messages")
    replies  = db.relationship("Message", backref=db.backref("parent", remote_side="Message.id"),
                               foreign_keys="Message.parent_id", order_by="Message.created_at",
                               lazy="dynamic")

    def to_dict(self, include_replies=True):
        d = {
            "id":         self.id,
            "patient_id": self.patient_id,
            "sender":     self.sender,
            "subject":    self.subject,
            "body":       self.body,
            "created_at": self.created_at,
            "is_read":    self.is_read,
            "parent_id":  self.parent_id,
        }
        if include_replies:
            d["replies"] = [r.to_dict(include_replies=False) for r in self.replies]
        return d


class User(db.Model):
    __tablename__ = "users"

    id            = db.Column(db.Integer, primary_key=True)
    email         = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)
    role          = db.Column(db.String(20), nullable=False)   # admin | clinician | patient
    name          = db.Column(db.String(120), nullable=True)   # display name
    department    = db.Column(db.String(60),  nullable=True)   # e.g. "Cardiology"
    patient_id    = db.Column(db.Integer, db.ForeignKey("patients.id"), nullable=True)

    def to_dict(self):
        return {
            "id":         self.id,
            "email":      self.email,
            "role":       self.role,
            "patient_id": self.patient_id,
        }
