import os
import sys
from flask import Flask
from flask_cors import CORS

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from routers.auth import auth_bp
from routers.account import account_bp
from routers.allocation_request import allocation_request_bp
from routers.device import device_bp
from routers.product_category import product_category_bp
from routers.inventory import inventory_bp

app = Flask(__name__)

CORS(app, resources={r"/api/*": {"origins": "*"}})

app.register_blueprint(auth_bp, url_prefix="/api/auth")
app.register_blueprint(account_bp, url_prefix="/api/account")
app.register_blueprint(allocation_request_bp, url_prefix="/api/allocation-request")
app.register_blueprint(device_bp, url_prefix="/api/device")
app.register_blueprint(product_category_bp, url_prefix="/api/product-category")
app.register_blueprint(inventory_bp, url_prefix="/api/inventory")

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
