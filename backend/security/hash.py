import bcrypt

def hash_password(password: str) -> str:
    # Sử dụng gensalt để đảm bảo mỗi mật khẩu có một salt riêng biệt
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        # bcrypt.checkpw tự động trích xuất salt từ hashed_password
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False