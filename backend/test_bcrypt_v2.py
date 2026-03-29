
from passlib.context import CryptContext
import sys
import traceback

try:
    print("Starting bcrypt test...")
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    password = "testpassword"
    print(f"Hashing password: {password}")
    hashed = pwd_context.hash(password)
    print(f"Hashed result: {hashed}")
    
    print("Verifying password...")
    verified = pwd_context.verify(password, hashed)
    print(f"Verified: {verified}")
    
    print("Bcrypt test successful")
except Exception as e:
    print(f"ERROR: {type(e).__name__}: {e}")
    traceback.print_exc()
