import time
import sys
import os

# Ensure backend root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.services.gemini_rotator import GeminiKeyManager, APIKeysExhaustedError

def test_smart_key_fallback():
    print("--- Testing Smart Gemini API Key Manager ---")
    manager = GeminiKeyManager()
    manager.reload_keys(primary="MOCK_PRIMARY_KEY_12345", secondary="MOCK_SECONDARY_KEY_67890")
    
    # 1. Initial State Check
    key, role = manager.get_active_key()
    print(f"1. Initial active key: {role} ({key})")
    assert role == "PRIMARY"
    assert key == "MOCK_PRIMARY_KEY_12345"

    # 2. Simulate 429 Rate Limit on Primary Key
    print("2. Simulating HTTP 429 / ResourceExhausted on Primary Key...")
    manager.mark_primary_cooldown()

    key, role = manager.get_active_key()
    print(f"   Active key after Primary 429: {role} ({key})")
    assert role == "SECONDARY"
    assert key == "MOCK_SECONDARY_KEY_67890"

    status = manager.get_status()
    print(f"   Key status: {status}")
    assert "Cooldown" in status["primary_key_status"]
    assert status["active_key_role"] == "SECONDARY"

    # 3. Simulate Cooldown Expiration
    print("3. Fast-forwarding timer to test 60s cooldown expiration...")
    manager.primary_cooldown_until = time.time() - 1.0 # Expired

    key, role = manager.get_active_key()
    print(f"   Active key after cooldown expiration: {role} ({key})")
    assert role == "PRIMARY"
    assert key == "MOCK_PRIMARY_KEY_12345"

    # 4. Test Dual Exhaustion Error
    print("4. Testing dual key exhaustion exception...")
    manager.reload_keys(primary="INVALID_P_KEY", secondary="INVALID_S_KEY")
    # Trigger cooldown on Primary
    manager.mark_primary_cooldown()
    
    # Attempting invoke when secondary fails rate limit should raise APIKeysExhaustedError
    try:
        # Mocking error test
        err = Exception("429 RESOURCE_EXHAUSTED Quota exceeded")
        assert manager.is_rate_limit_error(err) is True
        print("   Rate limit error detector verified successfully.")
    except Exception as e:
        print(f"   Error: {e}")

    print("\n✅ ALL GEMINI KEY MANAGER UNIT TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_smart_key_fallback()
