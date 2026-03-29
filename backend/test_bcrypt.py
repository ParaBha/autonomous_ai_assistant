
from passlib.context import CryptContext
import sys

try:
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    password = "testpassword"
    hashed = pwd_context.hash(password)
    print(f"Hashed: {hashed}")
    verified = pwd_context.verify(password, hashed)
    print(f"Verified: {verified}")
    
    # Test with a known bcrypt hash if possible, or just confirm it works
    print("Bcrypt test successful")
except Exception as e:
    print(f"Bcrypt test failed: {e}")
    import traceback
    traceback.print_exc()
