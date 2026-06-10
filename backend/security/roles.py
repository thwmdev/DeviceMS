from functools import wraps
from flask import request, jsonify
from security.jwthandler import decode_token
import jwt
def token_and_role_required(allowed_roles=[]):
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            auth_header = request.headers.get('Authorization')
            
            if not auth_header or not auth_header.startswith("Bearer "):
                return jsonify({"message": "Yêu cầu đăng nhập hệ thống!"}), 401
            
            token = auth_header.split(" ")[1]
            try:
                payload = decode_token(token)
                user_role = payload.get("role", "").upper()
                
                if allowed_roles and user_role not in [role.upper() for role in allowed_roles]:
                    return jsonify({"message": "Bạn không có quyền truy cập chức năng này!"}), 403
                
                request.user_claims = payload
            except jwt.ExpiredSignatureError:
                return jsonify({"message": "Phiên làm việc đã hết hạn!"}), 401
            except jwt.InvalidTokenError:
                return jsonify({"message": "Mã xác thực không hợp lệ!"}), 401
                
            return f(*args, **kwargs)
        return decorated
    return decorator