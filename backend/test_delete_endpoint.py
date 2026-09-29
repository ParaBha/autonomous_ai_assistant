from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_project_create_and_delete():
    # 1. Create a project
    create_res = client.post("/api/v1/projects/", json={"title": "Test Delete Roadmap End to End", "description": "Testing delete flow"})
    assert create_res.status_code == 200, f"Create failed: {create_res.text}"
    project = create_res.json()
    project_id = project["id"]
    print(f"[TEST] Created project ID: {project_id}")

    # 2. List projects to verify it exists
    list_res = client.get("/api/v1/projects/")
    assert list_res.status_code == 200
    projects = list_res.json()
    assert any(p["id"] == project_id for p in projects), "Created project not found in list"
    print(f"[TEST] Verified project {project_id} exists in DB")

    # 3. Delete the project
    delete_res = client.delete(f"/api/v1/projects/{project_id}")
    assert delete_res.status_code == 200, f"Delete failed: {delete_res.text}"
    assert delete_res.json()["id"] == project_id
    print(f"[TEST] Deleted project {project_id} successfully")

    # 4. List projects again to verify it is permanently removed
    list_res2 = client.get("/api/v1/projects/")
    assert list_res2.status_code == 200
    projects2 = list_res2.json()
    assert not any(p["id"] == project_id for p in projects2), "Deleted project still found in DB"
    print(f"[TEST] Verified project {project_id} is permanently removed from DB")

    # 5. Test deleting non-existent project returns 404
    delete_res_404 = client.delete(f"/api/v1/projects/99999999")
    assert delete_res_404.status_code == 404, "Deleting non-existent project should return 404"
    print("[TEST] Verified 404 on deleting non-existent project")

    print("[SUCCESS] All backend delete roadmap tests passed!")

if __name__ == "__main__":
    test_project_create_and_delete()
