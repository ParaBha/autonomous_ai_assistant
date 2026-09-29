import requests
import sys

import time

BASE_URL = "http://127.0.0.1:8000/api/v1/auth"

def test_flow():
    test_email = f"test_user_{int(time.time())}@example.com"
    test_password = "Password123!"
    
    print("1. Testing Signup...")
    signup_payload = {
        "email": test_email,
        "password": test_password,
        "name": "Dr. Alex Rivera",
        "profession": "Lead AI Researcher",
        "phone": "+1 (555) 987-6543",
        "institution": "Stanford University",
        "field_of_study": "Quantum Computing & AI"
    }
    
    resp = requests.post(f"{BASE_URL}/signup", json=signup_payload)
    if resp.status_code == 400 and "already registered" in resp.text:
        print("   User exists, attempting signin...")
        resp = requests.post(f"{BASE_URL}/signin", json={"email": test_email, "password": test_password})
    
    assert resp.status_code == 200, f"Signup/Signin failed: {resp.status_code} - {resp.text}"
    user_data = resp.json()
    token = user_data.get("access_token")
    assert token, "No access_token in response!"
    print("   Signup/Signin successful! Token received.")
    print(f"   Institution: {user_data.get('institution')}")
    print(f"   Field of Study: {user_data.get('field_of_study')}")

    headers = {"Authorization": f"Bearer {token}"}

    print("\n2. Testing GET /profile/me...")
    resp = requests.get(f"{BASE_URL}/profile/me", headers=headers)
    assert resp.status_code == 200, f"GET /profile/me failed: {resp.status_code} - {resp.text}"
    me_data = resp.json()
    assert me_data["email"] == test_email
    assert me_data["institution"] == "Stanford University"
    assert me_data["field_of_study"] == "Quantum Computing & AI"
    print("   GET /profile/me verified!")

    print("\n3. Testing PUT /profile...")
    update_payload = {
        "institution": "MIT CSAIL",
        "field_of_study": "Generative AI Architectures"
    }
    resp = requests.put(f"{BASE_URL}/profile", json=update_payload, headers=headers)
    assert resp.status_code == 200, f"PUT /profile failed: {resp.status_code} - {resp.text}"
    updated_data = resp.json()
    assert updated_data["institution"] == "MIT CSAIL"
    assert updated_data["field_of_study"] == "Generative AI Architectures"
    print("   PUT /profile verified!")

    print("\n4. Testing GET /profile/stats...")
    resp = requests.get(f"{BASE_URL}/profile/stats", headers=headers)
    assert resp.status_code == 200, f"GET /profile/stats failed: {resp.status_code} - {resp.text}"
    stats_data = resp.json()
    assert "stats" in stats_data
    print("   GET /profile/stats verified!")

    print("\n5. Testing /change-password...")
    new_password = "NewPassword456!"
    resp = requests.post(
        f"{BASE_URL}/change-password",
        json={"current_password": test_password, "new_password": new_password},
        headers=headers
    )
    assert resp.status_code == 200, f"Change password failed: {resp.status_code} - {resp.text}"
    print("   Password changed successfully!")

    # Re-verify signin with new password
    resp = requests.post(f"{BASE_URL}/signin", json={"email": test_email, "password": new_password})
    assert resp.status_code == 200, "Signin with new password failed!"
    print("   Signin with new password verified!")

    # Revert password back
    token2 = resp.json()["access_token"]
    requests.post(
        f"{BASE_URL}/change-password",
        json={"current_password": new_password, "new_password": test_password},
        headers={"Authorization": f"Bearer {token2}"}
    )
    print("   Password restored to original.")

    print("\nALL AUTH & PROFILE TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_flow()
