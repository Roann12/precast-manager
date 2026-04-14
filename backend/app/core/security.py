# File overview: Core configuration/security setup for app/core/security.py.
from passlib.context import CryptContext

# `bcrypt` can be brittle depending on the installed `bcrypt` package version.
# For dev/demo + this container, use pbkdf2 which is widely available in passlib.
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")


# Handles verify password flow.
def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


# Handles get password hash flow.
def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

