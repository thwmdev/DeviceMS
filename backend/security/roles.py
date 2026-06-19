from functools import wraps
from flask import request, jsonify
from security.jwthandler import decode_token
import jwt
import unicodedata

VALID_ROLES = ("ADMIN", "HR", "NHANVIEN")


def normalize_role_value(role):
    normalized = unicodedata.normalize("NFD", str(role or ""))
    normalized = "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")
    return normalized.replace(" ", "").replace("_", "").replace("-", "").upper()


def normalize_role(role):
    normalized = normalize_role_value(role)
    return normalized if normalized in VALID_ROLES else "NHANVIEN"

def token_and_role_required(allowed_roles=[]):
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            if request.method == 'OPTIONS':
                return '', 200

            auth_header = request.headers.get('Authorization')
            
            if not auth_header or not auth_header.startswith("Bearer "):
                return jsonify({"message": "Yêu cầu đăng nhập hệ thống!"}), 401
            
            token = auth_header.split(" ")[1]
            try:
                payload = decode_token(token)
                user_role = normalize_role(payload.get("role", ""))
                payload["role"] = user_role
                
                if allowed_roles and user_role not in [normalize_role(role) for role in allowed_roles]:
                    return jsonify({"message": "Bạn không có quyền truy cập chức năng này!"}), 403
                
                request.user_claims = payload
            except jwt.ExpiredSignatureError:
                return jsonify({"message": "Phiên làm việc đã hết hạn!"}), 401
            except jwt.InvalidTokenError:
                return jsonify({"message": "Mã xác thực không hợp lệ!"}), 401
                
            return f(*args, **kwargs)
        return decorated
    return decorator
