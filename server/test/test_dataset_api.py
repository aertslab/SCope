" Tests for the /dataset/ section of the HTTP API "

from pathlib import Path
import io

from test.api_fixture import (
    admin,
    another_user,
    client,
    database,
    database_engine,
    guest,
    loom_limit_9_bytes,
    my_tmp_path,
    user,
)

# =========================================
# GET: /v1/dataset/{dataset_id}/coordinates
# =========================================

# TODO: add tests for successful requests, testing the different request parameters
def test_unauthenticated_cannot_get_coordinates():
    "Test that an unauthenticated user cannot get coordinates of a dataset"
    response = client.get("/api/v1/dataset/1/coordinates")
    assert response.status_code == 422


def test_admin_cannot_get_coordinates_from_non_existing_dataset(admin):
    "Test that a request as admin for coordinates on a non-existing dataset fails"
    response = client.get("/api/v1/dataset/1/coordinates", headers={"Authorization": f"bearer {admin['access_token']}"})
    assert response.status_code == 404


def test_user_cannot_get_coordinates_from_non_existing_dataset(user):
    "Test that a request for as user for coordinates on a non-existing dataset fails"
    response = client.get("/api/v1/dataset/1/coordinates", headers={"Authorization": f"bearer {user['access_token']}"})
    assert response.status_code == 404


def test_admin_get_coordinates_on_non_existing_loom_file_fails(admin, loom_limit_9_bytes):
    "Test that a request as admin for coordinates fails if the loom file cannot be found"
    # Create a project
    response = client.post(
        "/api/v1/project/new", params={"name": "test"}, headers={"Authorization": f"bearer {admin['access_token']}"}
    )
    assert response.status_code == 200
    project = response.json()

    # Add a datatset
    response = client.post(
        "/api/v1/project/dataset",
        params={"project": project["uuid"], "name": "Test dataset"},
        files={"uploadfile": ("test-data-file.loom", io.BytesIO(b"Test data"), "application/vnd.loom")},
        headers={"Authorization": f"bearer {admin['access_token']}"},
    )
    assert response.status_code == 200
    dataset = response.json()

    # Check starts here
    response = client.get(
        f"/api/v1/dataset/{dataset['id']}/coordinates",
        headers={"Authorization": f"bearer {admin['access_token']}"},
    )
    assert response.status_code == 500
    assert response.json()["detail"] == "Loom file for dataset 1 could not be located"


def test_user_get_coordinates_on_non_existing_loom_file_fails(user, loom_limit_9_bytes):
    "Test that a request as user for coordinates fails if the loom file cannot be found"
    # Create a project
    response = client.post(
        "/api/v1/project/new", params={"name": "test"}, headers={"Authorization": f"bearer {user['access_token']}"}
    )
    assert response.status_code == 200
    project = response.json()

    # Add a datatset
    response = client.post(
        "/api/v1/project/dataset",
        params={"project": project["uuid"], "name": "Test dataset"},
        files={"uploadfile": ("test-data-file.loom", io.BytesIO(b"Test data"), "application/vnd.loom")},
        headers={"Authorization": f"bearer {user['access_token']}"},
    )
    assert response.status_code == 200
    dataset = response.json()

    # Check starts here
    response = client.get(
        f"/api/v1/dataset/{dataset['id']}/coordinates",
        headers={"Authorization": f"bearer {user['access_token']}"},
    )
    assert response.status_code == 500
    assert response.json()["detail"] == "Loom file for dataset 1 could not be located"


def test_user_cannot_get_coordinates_from_non_owned_dataset(user, another_user, loom_limit_9_bytes):
    "Test that a user cannot get coordinates from a dataset it does not own"

    # Create a project
    response = client.post(
        "/api/v1/project/new", params={"name": "test"}, headers={"Authorization": f"bearer {user['access_token']}"}
    )
    assert response.status_code == 200
    project = response.json()

    # Add a datatset
    response = client.post(
        "/api/v1/project/dataset",
        params={"project": project["uuid"], "name": "Test dataset"},
        files={"uploadfile": ("test-data-file.loom", io.BytesIO(b"Test data"), "application/vnd.loom")},
        headers={"Authorization": f"bearer {user['access_token']}"},
    )
    assert response.status_code == 200
    dataset = response.json()

    # Check starts here
    response = client.get(
        f"/api/v1/dataset/{dataset['id']}/coordinates",
        headers={"Authorization": f"bearer {another_user['access_token']}"},
    )
    assert response.status_code == 401


def test_guest_cannot_get_coordinates_from_non_owned_dataset(user, guest, loom_limit_9_bytes):
    "Test that a guest cannot get coordinates from a dataset it does not own"

    # Create a project
    response = client.post(
        "/api/v1/project/new", params={"name": "test"}, headers={"Authorization": f"bearer {user['access_token']}"}
    )
    assert response.status_code == 200
    project = response.json()

    # Add a datatset
    response = client.post(
        "/api/v1/project/dataset",
        params={"project": project["uuid"], "name": "Test dataset"},
        files={"uploadfile": ("test-data-file.loom", io.BytesIO(b"Test data"), "application/vnd.loom")},
        headers={"Authorization": f"bearer {user['access_token']}"},
    )
    assert response.status_code == 200
    dataset = response.json()

    # Check starts here
    response = client.get(
        f"/api/v1/dataset/{dataset['id']}/coordinates",
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 401
