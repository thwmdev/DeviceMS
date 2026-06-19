from flask import request
from security.jwthandler import decode_token

def get_current_user():
    auth_header = request.headers.get("Authorization")

    if not auth_header:
        return None

    try:
        token = auth_header.split(" ")[1]
        user = decode_token(token)
        return user
    except:
        return None