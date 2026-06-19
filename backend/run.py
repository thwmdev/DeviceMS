import os
import sys
from flask import Flask, make_response, request
from flask_cors import CORS

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from routers.auth import auth_bp
from routers.account import account_bp
from routers.allocation_request import allocation_request_bp
from routers.device import device_bp
from routers.product_category import product_category_bp
from routers.inventory import inventory_bp
from routers.depre import depre_bp

app = Flask(__name__)

allowed_origins = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "*").split(",")
    if origin.strip()
]

CORS(
    app,
    resources={r"/api/*": {"origins": allowed_origins}},
    methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)


def get_allowed_origin():
    origin = request.headers.get("Origin")
    if "*" in allowed_origins:
        return "*"
    if origin in allowed_origins:
        return origin
    return allowed_origins[0] if allowed_origins else "*"


@app.before_request
def handle_preflight():
    if request.method == "OPTIONS" and request.path.startswith("/api/"):
        response = make_response("", 204)
        response.headers["Access-Control-Allow-Origin"] = get_allowed_origin()
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        response.headers["Access-Control-Max-Age"] = "86400"
        return response
    return None


@app.after_request
def add_cors_headers(response):
    if request.path.startswith("/api/"):
        response.headers["Access-Control-Allow-Origin"] = get_allowed_origin()
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    return response

app.register_blueprint(auth_bp, url_prefix="/api/auth")
app.register_blueprint(account_bp, url_prefix="/api/account")
app.register_blueprint(allocation_request_bp, url_prefix="/api/allocation-request")
app.register_blueprint(device_bp, url_prefix="/api/device")
app.register_blueprint(product_category_bp, url_prefix="/api/product-category")
app.register_blueprint(inventory_bp, url_prefix="/api/inventory")
app.register_blueprint(depre_bp, url_prefix="/api/depreciation")


if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    debug = os.getenv("FLASK_DEBUG", "false").lower() == "true"
    app.run(host="0.0.0.0", port=port, debug=debug)
