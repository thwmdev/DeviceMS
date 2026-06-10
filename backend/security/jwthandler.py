import jwt

SECRET_KEY = "your_secret"

def encode_token(payload):
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")

def decode_token(token):
    return jwt.decode(token, SECRET_KEY, algorithms=["HS256"])