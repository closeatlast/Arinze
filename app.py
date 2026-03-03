from flask import Flask, request, jsonify
from flask_bcrypt import Bcrypt
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

app.config["JWT_SECRET_KEY"] = "super-secret-key"

bcrypt = Bcrypt(app)
jwt = JWTManager(app)

# Demo users
users = [
    {
        "email": "admin@test.com",
        "password": bcrypt.generate_password_hash("1234").decode("utf-8"),
        "role": "admin"
    },
    {
        "email": "patient@test.com",
        "password": bcrypt.generate_password_hash("1234").decode("utf-8"),
        "role": "patient"
    },
    {
        "email": "clinician@test.com",
        "password": bcrypt.generate_password_hash("1234").decode("utf-8"),
        "role": "clinician"
    }
]

@app.route("/login", methods=["POST"])
def login():
    data = request.json
    email = data["email"]
    password = data["password"]

    user = next((u for u in users if u["email"] == email), None)

    if not user or not bcrypt.check_password_hash(user["password"], password):
        return jsonify({"msg": "Bad credentials"}), 401

    token = create_access_token(identity={"role": user["role"]})

    return jsonify(token=token, role=user["role"])


@app.route("/admin")
@jwt_required()
def admin():
    user = get_jwt_identity()
    if user["role"] != "admin":
        return {"msg": "Forbidden"}, 403
    return {"msg": "Admin dashboard"}


@app.route("/patient")
@jwt_required()
def patient():
    user = get_jwt_identity()
    if user["role"] != "patient":
        return {"msg": "Forbidden"}, 403
    return {"msg": "Patient dashboard"}


@app.route("/clinician")
@jwt_required()
def clinician():
    user = get_jwt_identity()
    if user["role"] != "clinician":
        return {"msg": "Forbidden"}, 403
    return {"msg": "Clinician dashboard"}


if __name__ == "__main__":
    app.run(debug=True)

