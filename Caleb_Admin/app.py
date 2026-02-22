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
import os
import uuid

print("RUNNING FILE:", os.path.abspath(__file__))

app = Flask(__name__)
CORS(app)

app.config["JWT_SECRET_KEY"] = "super-secret-key"

bcrypt = Bcrypt(app)
jwt = JWTManager(app)

# Demo users
users = [
    {
        "email": "admin@test.com",
        "password": bcrypt.generate_password_hash("admin123").decode("utf-8"),
        "role": "admin",
    },
    {
        "email": "user@test.com",
        "password": bcrypt.generate_password_hash("user123").decode("utf-8"),
        "role": "user",
    },
]


def is_admin():
    claims = get_jwt()
    return claims.get("role") == "admin"


@app.get("/")
def health():
    return jsonify({"msg": "API running"}), 200


@app.post("/login")
def login():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip()
    password = (data.get("password") or "").strip()

    user = next((u for u in users if u["email"] == email), None)

    if not user or not bcrypt.check_password_hash(user["password"], password):
        return jsonify({"msg": "Bad credentials"}), 401

    # IMPORTANT:
    # identity (JWT subject) must be a STRING to avoid:
    # 422 "Subject must be a string"
    token = create_access_token(
        identity=user["email"],
        additional_claims={"role": user["role"]},
    )

    return jsonify({"token": token, "role": user["role"]}), 200


@app.get("/dashboard")
@jwt_required()
def dashboard():
    email = get_jwt_identity()          # string
    role = get_jwt().get("role")        # claim
    return jsonify({"msg": "User dashboard", "email": email, "role": role}), 200


@app.get("/admin/overview")
@jwt_required()
def admin_overview():
    if not is_admin():
        return jsonify({"msg": "Forbidden"}), 403

    return jsonify({
        "cost_mtd": "$128,450",
        "admissions_7d": 214,
        "discharges_7d": 198,
        "waste_score": 82,
        "cost_by_department": [
            {"department": "ER", "cost": "$41,200"},
            {"department": "Radiology", "cost": "$29,100"},
            {"department": "ICU", "cost": "$22,850"},
            {"department": "Surgery", "cost": "$35,300"},
        ],
    }), 200


@app.get("/admin/activity")
@jwt_required()
def admin_activity():
    if not is_admin():
        return jsonify({"msg": "Forbidden"}), 403

    return jsonify([
        {"id": 1, "time": "2026-02-21 16:20", "actor": "admin@test.com", "action": "Viewed dashboard"},
        {"id": 2, "time": "2026-02-21 16:22", "actor": "admin@test.com", "action": "Generated weekly report"},
    ]), 200


@app.post("/admin/report")
@jwt_required()
def admin_report():
    if not is_admin():
        return jsonify({"msg": "Forbidden"}), 403

    data = request.get_json() or {}
    report_type = data.get("report_type", "weekly")

    report_id = str(uuid.uuid4())
    return jsonify({"report_id": report_id, "status": "queued", "type": report_type}), 200


@app.get("/admin")
@jwt_required()
def admin_root():
    if not is_admin():
        return jsonify({"msg": "Forbidden"}), 403
    return jsonify({"msg": "Admin dashboard"}), 200


if __name__ == "__main__":
    # Port 5001 because your Mac has something holding 5000
    app.run(debug=True, port=5001)
