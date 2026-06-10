import os
import sys
from flask import Flask
from flask_cors import CORS

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from routers.auth import auth_bp
from routers.account import account_bp

app = Flask(__name__)


CORS(app, resources={r"/api/*": {"origins": "*"}})



app.register_blueprint(auth_bp, url_prefix="/api/auth")
app.register_blueprint(account_bp, url_prefix="/api/account")

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)