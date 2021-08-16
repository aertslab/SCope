" Tests for the /user/ section of the HTTP API "

from pathlib import Path
import io

from test.api_fixture import (
    client,
    my_tmp_path,
    database_engine,
    database,
    guest,
    user,
    another_user,
    admin,
    loom_limit_9_bytes,
    expired_admin_token,
    spoofed_admin_token,
)

from scopeserver import models, schemas
from scopeserver.config import settings

INVALID_TOKEN = "invalid-token.invalid-token.invalid-token"

GARBAGE_TOKEN = "garbage_token"

# ====================
# GET: /v1/project/all
# ====================


def test_unauthenticated_cannot_list_all_projects(database):
    "Test that an unauthenticated user cannot list all projects"
    response = client.get("/api/v1/project/all")
    assert response.status_code == 422


def test_expired_admin_cannot_list_all_projects(database, admin, expired_admin_token):
    "Test that an expired admin token cannot list all projects"
    token = expired_admin_token(uid=admin["user"]["id"])
    response = client.get("/api/v1/project/all", headers={"Authorization": f"bearer {token}"})
    assert response.status_code == 401


def test_spoof_admin_cannot_list_all_projects(database, admin, spoofed_admin_token):
    "Test that a spoofed admin token cannot list all projects"
    token = spoofed_admin_token(uid=admin["user"]["id"])
    response = client.get("/api/v1/project/all", headers={"Authorization": f"bearer {token}"})
    assert response.status_code == 401


def test_invalid_token_cannot_list_all_projects(database):
    "Test that an invalid API token cannot list all projects"
    response = client.get("/api/v1/project/all", headers={"Authorization": f"bearer {INVALID_TOKEN}"})
    assert response.status_code == 401


def test_garbage_token_cannot_list_all_projects(database):
    "Test that a garbage API token cannot list all projects"
    response = client.get("/api/v1/project/all", headers={"Authorization": f"bearer {GARBAGE_TOKEN}"})
    assert response.status_code == 401


def test_guest_cannot_list_all_projects(guest):
    "Test that a guest user cannot list all projects"
    response = client.get("/api/v1/project/all", headers={"Authorization": f"bearer {guest['access_token']}"})
    assert response.status_code == 401


def test_user_cannot_list_all_projects(user):
    "Test that a regular user cannot list all projects"
    response = client.get("/api/v1/project/all", headers={"Authorization": f"bearer {user['access_token']}"})
    assert response.status_code == 401


def test_admin_list_all_projects(admin):
    "Test that an admin user can list all projects"
    response = client.get("/api/v1/project/all", headers={"Authorization": f"bearer {admin['access_token']}"})
    assert response.status_code == 200
    assert response.json() == []


# =====================
# POST: /v1/project/new
# =====================


def test_unauthenticated_cannot_create_project(database):
    "Test that an unauthenticated user can create a new project"
    response = client.post("/api/v1/project/new", params={"name": "test"})
    assert response.status_code == 422


def test_expired_admin_cannot_create_project(database, admin, expired_admin_token):
    "Test that an expired admin token cannot create a project"
    token = expired_admin_token(uid=admin["user"]["id"])
    response = client.post("/api/v1/project/new", params={"name": "test"}, headers={"Authorization": f"bearer {token}"})
    assert response.status_code == 401


def test_spoof_admin_cannot_create_project(database, admin, spoofed_admin_token):
    "Test that a spoofed admin token cannot create a project"
    token = spoofed_admin_token(uid=admin["user"]["id"])
    response = client.post("/api/v1/project/new", params={"name": "test"}, headers={"Authorization": f"bearer {token}"})
    assert response.status_code == 401


def test_guest_create_project(guest):
    "Test that a guest can create a new project"
    response = client.post(
        "/api/v1/project/new", params={"name": "test"}, headers={"Authorization": f"bearer {guest['access_token']}"}
    )
    assert response.status_code == 200
    project = response.json()
    project["name"] == "test"
    len(project["uuid"]) > 0


def test_user_create_project(user):
    "Test that a regular user can create a new project"
    response = client.post(
        "/api/v1/project/new", params={"name": "test"}, headers={"Authorization": f"bearer {user['access_token']}"}
    )
    assert response.status_code == 200
    project = response.json()
    project["name"] == "test"
    len(project["uuid"]) > 0


def test_admin_create_project(admin):
    "Test that an admin user can create a new project"
    response = client.post(
        "/api/v1/project/new", params={"name": "test"}, headers={"Authorization": f"bearer {admin['access_token']}"}
    )
    assert response.status_code == 200
    project = response.json()
    project["name"] == "test"
    len(project["uuid"]) > 0


# ====================
# DELETE: /v1/project/
# ====================


def test_unauthenticated_cannot_delete_project(database, guest):
    "Test that an unauthenticated user cannot delete a real project"
    response = client.post(
        "/api/v1/project/new", params={"name": "test"}, headers={"Authorization": f"bearer {guest['access_token']}"}
    )
    assert response.status_code == 200
    project = response.json()

    # Check starts here
    response = client.delete("/api/v1/project/", params={"project": project["uuid"]})
    assert response.status_code == 422


def test_guest_delete_own_project(database, guest):
    "Test that a guest can delete a project they own"
    db = database()

    response = client.post(
        "/api/v1/project/new", params={"name": "test"}, headers={"Authorization": f"bearer {guest['access_token']}"}
    )
    assert response.status_code == 200
    project = response.json()

    # Check starts here
    response = client.delete(
        "/api/v1/project/",
        params={"project": project["uuid"]},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 200

    # Check that the database entry and the directory are deleted
    assert len(db.query(models.Project).filter(models.Project.uuid == project["uuid"]).all()) == 0
    assert not (settings.DATA_PATH / Path(project["uuid"])).exists()


def test_guest_cannot_delete_non_owned_project(database, guest, user):
    "Test that a guest cannot delete a project they do not own"
    db = database()

    # User creates a project
    response = client.post(
        "/api/v1/project/new", params={"name": "test"}, headers={"Authorization": f"bearer {user['access_token']}"}
    )
    assert response.status_code == 200
    project = response.json()

    # Check starts here
    response = client.delete(
        "/api/v1/project/",
        params={"project": project["uuid"]},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 401

    # Check that the database entry and the directory are intact
    assert len(db.query(models.Project).filter(models.Project.uuid == project["uuid"]).all()) == 1
    assert (settings.DATA_PATH / Path(project["uuid"])).exists()


def test_user_delete_own_project(database, user):
    "Test that a regular user can delete a project they own"
    db = database()

    response = client.post(
        "/api/v1/project/new", params={"name": "test"}, headers={"Authorization": f"bearer {user['access_token']}"}
    )
    assert response.status_code == 200
    project = response.json()

    # Check starts here
    response = client.delete(
        "/api/v1/project/",
        params={"project": project["uuid"]},
        headers={"Authorization": f"bearer {user['access_token']}"},
    )
    assert response.status_code == 200

    # Check that the database entry and the directory are deleted
    assert len(db.query(models.Project).filter(models.Project.uuid == project["uuid"]).all()) == 0
    assert not (settings.DATA_PATH / Path(project["uuid"])).exists()


def test_user_cannot_delete_non_owned_project(database, guest, user):
    "Test that a regular user cannot delete a project they do not own"
    db = database()

    # Guest creates a project
    response = client.post(
        "/api/v1/project/new", params={"name": "test"}, headers={"Authorization": f"bearer {guest['access_token']}"}
    )
    assert response.status_code == 200
    project = response.json()

    # Check starts here
    response = client.delete(
        "/api/v1/project/",
        params={"project": project["uuid"]},
        headers={"Authorization": f"bearer {user['access_token']}"},
    )
    assert response.status_code == 401

    # Check that the database entry and the directory are intact
    assert len(db.query(models.Project).filter(models.Project.uuid == project["uuid"]).all()) == 1
    assert (settings.DATA_PATH / Path(project["uuid"])).exists()


def test_admin_delete_own_project(database, admin):
    "Test that an admin user can delete a project they created"
    db = database()

    response = client.post(
        "/api/v1/project/new", params={"name": "test"}, headers={"Authorization": f"bearer {admin['access_token']}"}
    )
    assert response.status_code == 200
    project = response.json()

    # Check starts here
    response = client.delete(
        "/api/v1/project/",
        params={"project": project["uuid"]},
        headers={"Authorization": f"bearer {admin['access_token']}"},
    )
    assert response.status_code == 200

    # Check that the database entry and the directory are deleted
    assert len(db.query(models.Project).filter(models.Project.uuid == project["uuid"]).all()) == 0
    assert not (settings.DATA_PATH / Path(project["uuid"])).exists()


def test_admin_delete_non_owned_project(database, admin, user):
    "Test that an admin user _can_ delete a project they do not own"
    db = database()

    # User creates a project
    response = client.post(
        "/api/v1/project/new", params={"name": "test"}, headers={"Authorization": f"bearer {user['access_token']}"}
    )
    assert response.status_code == 200
    project = response.json()

    # Check starts here
    response = client.delete(
        "/api/v1/project/",
        params={"project": project["uuid"]},
        headers={"Authorization": f"bearer {admin['access_token']}"},
    )
    assert response.status_code == 200

    # Check that the database entry and the directory are deleted
    assert len(db.query(models.Project).filter(models.Project.uuid == project["uuid"]).all()) == 0
    assert not (settings.DATA_PATH / Path(project["uuid"])).exists()


def test_admin_cannot_delete_nonexisting_project(admin):
    "Test that trying to delete a project that does not exist should fail"
    response = client.delete(
        "/api/v1/project/",
        params={"project": "fake-project-uuid"},
        headers={"Authorization": f"bearer {admin['access_token']}"},
    )
    assert response.status_code == 400


def test_owner_not_creator_delete_own_project(database, guest, user):
    "Test that a user who is an owner, but did not create the project, can delete the project"
    db = database()

    # Guest creates a project (guest is the creator and initial owner)
    response = client.post(
        "/api/v1/project/new", params={"name": "test"}, headers={"Authorization": f"bearer {guest['access_token']}"}
    )
    assert response.status_code == 200
    project = response.json()

    # Guest adds user to owners
    response = client.post(
        "/api/v1/project/owner",
        params={"project": project["uuid"], "user_id": user["user"]["id"]},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 200

    # Check starts here
    response = client.delete(
        "/api/v1/project/",
        params={"project": project["uuid"]},
        headers={"Authorization": f"bearer {user['access_token']}"},
    )
    assert response.status_code == 200

    # Check that the database entry and the directory are deleted
    assert len(db.query(models.Project).filter(models.Project.uuid == project["uuid"]).all()) == 0
    assert not (settings.DATA_PATH / Path(project["uuid"])).exists()


# =========================
# POST: /v1/project/dataset
# =========================


def test_unauthenticated_cannot_add_dataset_existing_project(loom_limit_9_bytes, guest):
    "Test that an unauthenticated user cannot add data to a real project"
    response = client.post(
        "/api/v1/project/new", params={"name": "test"}, headers={"Authorization": f"bearer {guest['access_token']}"}
    )
    assert response.status_code == 200
    project = response.json()

    # Check starts here
    some_file = io.BytesIO(b"Test data")
    response = client.post(
        "/api/v1/project/dataset",
        params={"project": project["uuid"], "name": "Test dataset"},
        files={"uploadfile": ("test-data-file.loom", some_file, "application/vnd.loom")},
    )
    assert response.status_code == 422


def test_add_text_dataset(database, loom_limit_9_bytes, guest):
    "Test that text (not binary) is handled correctly"
    db = database()

    response = client.post(
        "/api/v1/project/new", params={"name": "test"}, headers={"Authorization": f"bearer {guest['access_token']}"}
    )
    assert response.status_code == 200
    project = response.json()

    response = client.post(
        "/api/v1/project/dataset",
        params={"project": project["uuid"], "name": "Test dataset"},
        files={"uploadfile": ("test-data-file.loom", io.StringIO("Test data"), "application/vnd.loom")},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 200
    dataset = response.json()
    db_project = db.query(models.Project).filter(models.Project.uuid == project["uuid"]).first()
    db_dataset = db.query(models.Dataset).filter(models.Dataset.id == dataset["id"]).first()

    assert (settings.DATA_PATH / Path(project["uuid"]) / "test-data-file.loom").exists()
    assert db_project.size == 9
    assert db_dataset.size == 9
    assert db_dataset.filename == "test-data-file.loom"
    assert dataset["filename"] == "test-data-file.loom"


def test_guest_can_add_dataset_to_own_project(database, loom_limit_9_bytes, guest):
    "Test that a guest can add a dataset to a project they created"
    db = database()

    response = client.post(
        "/api/v1/project/new", params={"name": "test"}, headers={"Authorization": f"bearer {guest['access_token']}"}
    )
    assert response.status_code == 200
    project = response.json()

    some_file = io.BytesIO(b"Test data")

    # Checks start here
    response = client.post(
        "/api/v1/project/dataset",
        params={"project": project["uuid"], "name": "Test dataset"},
        files={"uploadfile": ("test-data-file.loom", some_file, "application/vnd.loom")},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 200
    dataset = response.json()
    db_project = db.query(models.Project).filter(models.Project.uuid == project["uuid"]).first()
    db_dataset = db.query(models.Dataset).filter(models.Dataset.id == dataset["id"]).first()

    assert (settings.DATA_PATH / Path(project["uuid"]) / "test-data-file.loom").exists()
    assert db_project.size == 9
    assert db_dataset.size == 9
    assert db_dataset.filename == "test-data-file.loom"
    assert dataset["filename"] == "test-data-file.loom"


def test_guest_cannot_add_dataset_to_non_owned_project(database, loom_limit_9_bytes, guest, user):
    "Test that a guest can add a dataset to a project they created"
    db = database()

    response = client.post(
        "/api/v1/project/new", params={"name": "test"}, headers={"Authorization": f"bearer {user['access_token']}"}
    )
    assert response.status_code == 200
    project = response.json()

    # Checks start here
    response = client.post(
        "/api/v1/project/dataset",
        params={"project": project["uuid"], "name": "Test dataset"},
        files={"uploadfile": ("test-data-file.loom", io.BytesIO(b"Test data"), "application/vnd.loom")},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 401
    dbproj = db.query(models.Project).filter(models.Project.uuid == project["uuid"]).first()
    assert dbproj.size == 0
    assert len(dbproj.datasets) == 0


def test_guest_cannot_add_dataset_to_used_project(database, loom_limit_9_bytes, guest, user):
    "Test that a guest user who has access to a project, but is not an owner, canNOT add a dataset"
    db = database()

    response = client.post(
        "/api/v1/project/new", params={"name": "test"}, headers={"Authorization": f"bearer {user['access_token']}"}
    )
    assert response.status_code == 200
    project = response.json()

    # Add guest to project
    response = client.post(
        "/api/v1/project/user",
        params={"project": project["uuid"], "user_id": guest["user"]["id"]},
        headers={"Authorization": f"bearer {user['access_token']}"},
    )

    # Check starts here
    response = client.post(
        "/api/v1/project/dataset",
        params={"project": project["uuid"], "name": "Test dataset"},
        files={"uploadfile": ("test-data-file.loom", io.BytesIO(b"Test data"), "application/vnd.loom")},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 401
    dbproj = db.query(models.Project).filter(models.Project.uuid == project["uuid"]).first()
    assert dbproj.size == 0
    assert len(dbproj.datasets) == 0


def test_guest_second_owner_can_add_dataset(database, loom_limit_9_bytes, guest, user):
    "Test that a guest user who did not create the project, but is an owner, can add a dataset"
    db = database()

    response = client.post(
        "/api/v1/project/new", params={"name": "test"}, headers={"Authorization": f"bearer {user['access_token']}"}
    )
    assert response.status_code == 200
    project = response.json()

    # Add guest to project owners
    response = client.post(
        "/api/v1/project/owner",
        params={"project": project["uuid"], "user_id": guest["user"]["id"]},
        headers={"Authorization": f"bearer {user['access_token']}"},
    )

    # Checks start here
    response = client.post(
        "/api/v1/project/dataset",
        params={"project": project["uuid"], "name": "Test dataset"},
        files={"uploadfile": ("test-data-file.loom", io.BytesIO(b"Test data"), "application/vnd.loom")},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 200
    dataset = response.json()
    db_project = db.query(models.Project).filter(models.Project.uuid == project["uuid"]).first()
    db_dataset = db.query(models.Dataset).filter(models.Dataset.id == dataset["id"]).first()

    assert (settings.DATA_PATH / Path(project["uuid"]) / "test-data-file.loom").exists()
    assert db_project.size == 9
    assert db_dataset.size == 9
    assert db_dataset.filename == "test-data-file.loom"
    assert dataset["filename"] == "test-data-file.loom"


def test_user_can_add_dataset_to_own_project(database, loom_limit_9_bytes, user):
    "Test that a regular user can add a dataset to a project they created"
    db = database()

    response = client.post(
        "/api/v1/project/new", params={"name": "test"}, headers={"Authorization": f"bearer {user['access_token']}"}
    )
    assert response.status_code == 200
    project = response.json()

    some_file = io.BytesIO(b"Test data")

    # Checks start here
    response = client.post(
        "/api/v1/project/dataset",
        params={"project": project["uuid"], "name": "Test dataset"},
        files={"uploadfile": ("test-data-file.loom", some_file, "application/vnd.loom")},
        headers={"Authorization": f"bearer {user['access_token']}"},
    )
    assert response.status_code == 200
    dataset = response.json()
    db_project = db.query(models.Project).filter(models.Project.uuid == project["uuid"]).first()
    db_dataset = db.query(models.Dataset).filter(models.Dataset.id == dataset["id"]).first()

    assert (settings.DATA_PATH / Path(project["uuid"]) / "test-data-file.loom").exists()
    assert db_project.size == 9
    assert db_dataset.size == 9
    assert db_dataset.filename == "test-data-file.loom"
    assert dataset["filename"] == "test-data-file.loom"


def test_user_cannot_add_dataset_to_non_owned_project(database, loom_limit_9_bytes, guest, user):
    "Test that a guest can add a dataset to a project they created"
    db = database()

    response = client.post(
        "/api/v1/project/new", params={"name": "test"}, headers={"Authorization": f"bearer {guest['access_token']}"}
    )
    assert response.status_code == 200
    project = response.json()

    # Checks start here
    response = client.post(
        "/api/v1/project/dataset",
        params={"project": project["uuid"], "name": "Test dataset"},
        files={"uploadfile": ("test-data-file.loom", io.BytesIO(b"Test data"), "application/vnd.loom")},
        headers={"Authorization": f"bearer {user['access_token']}"},
    )
    assert response.status_code == 401
    dbproj = db.query(models.Project).filter(models.Project.uuid == project["uuid"]).first()
    assert dbproj.size == 0
    assert len(dbproj.datasets) == 0


def test_admin_can_add_dataset_to_own_project(database, loom_limit_9_bytes, admin):
    "Test that an admin can add a dataset to a project they created"
    db = database()

    response = client.post(
        "/api/v1/project/new", params={"name": "test"}, headers={"Authorization": f"bearer {admin['access_token']}"}
    )
    assert response.status_code == 200
    project = response.json()

    some_file = io.BytesIO(b"Test data")

    # Checks start here
    response = client.post(
        "/api/v1/project/dataset",
        params={"project": project["uuid"], "name": "Test dataset"},
        files={"uploadfile": ("test-data-file.loom", some_file, "application/vnd.loom")},
        headers={"Authorization": f"bearer {admin['access_token']}"},
    )
    assert response.status_code == 200
    dataset = response.json()
    db_project = db.query(models.Project).filter(models.Project.uuid == project["uuid"]).first()
    db_dataset = db.query(models.Dataset).filter(models.Dataset.id == dataset["id"]).first()

    assert (settings.DATA_PATH / Path(project["uuid"]) / "test-data-file.loom").exists()
    assert db_project.size == 9
    assert db_dataset.size == 9
    assert db_dataset.filename == "test-data-file.loom"
    assert dataset["filename"] == "test-data-file.loom"


def test_admin_can_add_dataset_to_non_owned_project(database, loom_limit_9_bytes, admin, user):
    "Test that an admin can add a dataset to a project they do not own"
    db = database()

    response = client.post(
        "/api/v1/project/new", params={"name": "test"}, headers={"Authorization": f"bearer {user['access_token']}"}
    )
    assert response.status_code == 200
    project = response.json()

    some_file = io.BytesIO(b"Test data")

    # Checks start here
    response = client.post(
        "/api/v1/project/dataset",
        params={"project": project["uuid"], "name": "Test dataset"},
        files={"uploadfile": ("test-data-file.loom", some_file, "application/vnd.loom")},
        headers={"Authorization": f"bearer {admin['access_token']}"},
    )
    assert response.status_code == 200
    dataset = response.json()
    db_project = db.query(models.Project).filter(models.Project.uuid == project["uuid"]).first()
    db_dataset = db.query(models.Dataset).filter(models.Dataset.id == dataset["id"]).first()

    assert (settings.DATA_PATH / Path(project["uuid"]) / "test-data-file.loom").exists()
    assert db_project.size == 9
    assert db_dataset.size == 9
    assert db_dataset.filename == "test-data-file.loom"
    assert dataset["filename"] == "test-data-file.loom"


def test_admin_cannot_add_dataset_to_nonexisting_project(admin, loom_limit_9_bytes):
    "Test that trying to delete a project that does not exist should fail"
    response = client.post(
        "/api/v1/project/dataset",
        params={"project": "fake-project-uuid", "name": "Test dataset"},
        files={"uploadfile": ("test-data-file.loom", io.BytesIO(b"Test data"), "application/vnd.loom")},
        headers={"Authorization": f"bearer {admin['access_token']}"},
    )
    assert response.status_code == 400


def test_add_invalid_mime_type(loom_limit_9_bytes, guest):
    "Test that text (not binary) is handled correctly"
    response = client.post(
        "/api/v1/project/new", params={"name": "test"}, headers={"Authorization": f"bearer {guest['access_token']}"}
    )
    assert response.status_code == 200
    project = response.json()

    response = client.post(
        "/api/v1/project/dataset",
        params={"project": project["uuid"], "name": "Test dataset"},
        files={"uploadfile": ("test-data-file.loom", io.BytesIO(b"Test data"), "application/x-hdf5")},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 415


def test_add_too_big(loom_limit_9_bytes, guest):
    "Test that text (not binary) is handled correctly"
    response = client.post(
        "/api/v1/project/new", params={"name": "test"}, headers={"Authorization": f"bearer {guest['access_token']}"}
    )
    assert response.status_code == 200
    project = response.json()

    response = client.post(
        "/api/v1/project/dataset",
        params={"project": project["uuid"], "name": "Test dataset"},
        files={"uploadfile": ("test-data-file.loom", io.BytesIO(b"Too much data"), "application/vnd.loom")},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 409


# ===========================
# DELETE: /v1/project/dataset
# ===========================


def test_unauthenticated_cannot_delete_dataset_existing_project(database, loom_limit_9_bytes, guest):
    "Test that an unauthenticated user cannot delete dataset from a real project"
    response = client.post(
        "/api/v1/project/new", params={"name": "test"}, headers={"Authorization": f"bearer {guest['access_token']}"}
    )
    assert response.status_code == 200
    project = response.json()

    response = client.post(
        "/api/v1/project/dataset",
        params={"project": project["uuid"], "name": "Test dataset"},
        files={"uploadfile": ("test-data-file.loom", io.BytesIO(b"Test data"), "application/vnd.loom")},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 200
    dataset = response.json()

    # Check starts here
    response = client.delete(
        "/api/v1/project/dataset",
        params={"project": project["uuid"], "dataset": dataset["id"]},
    )
    assert response.status_code == 422


def test_guest_can_delete_dataset_from_own_project(database, loom_limit_9_bytes, guest):
    "Test that a guest can delete a dataset from a project they created"
    db = database()

    response = client.post(
        "/api/v1/project/new", params={"name": "test"}, headers={"Authorization": f"bearer {guest['access_token']}"}
    )
    assert response.status_code == 200
    project = response.json()

    some_file = io.BytesIO(b"Test data")

    response = client.post(
        "/api/v1/project/dataset",
        params={"project": project["uuid"], "name": "Test dataset"},
        files={"uploadfile": ("test-data-file.loom", some_file, "application/vnd.loom")},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 200
    dataset = response.json()

    # Checks start here
    response = client.delete(
        "/api/v1/project/dataset",
        params={"project": project["uuid"], "dataset": dataset["id"]},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 200
    db_project = db.query(models.Project).filter(models.Project.uuid == project["uuid"]).first()

    assert not (settings.DATA_PATH / Path(project["uuid"]) / "test-data-file.loom").exists()
    assert db_project.size == 0
    assert db.query(models.Dataset).filter(models.Dataset.id == dataset["id"]).first() is None


def test_guest_cannot_delete_dataset_from_non_owned_project(database, loom_limit_9_bytes, guest, user):
    "Test that a guest cannot delete a dataset from a project the do not own"
    db = database()

    response = client.post(
        "/api/v1/project/new", params={"name": "test"}, headers={"Authorization": f"bearer {user['access_token']}"}
    )
    assert response.status_code == 200
    project = response.json()

    response = client.post(
        "/api/v1/project/dataset",
        params={"project": project["uuid"], "name": "Test dataset"},
        files={"uploadfile": ("test-data-file.loom", io.BytesIO(b"Test data"), "application/vnd.loom")},
        headers={"Authorization": f"bearer {user['access_token']}"},
    )
    assert response.status_code == 200
    dataset = response.json()

    # Checks start here
    response = client.delete(
        "/api/v1/project/dataset",
        params={"project": project["uuid"], "dataset": dataset["id"]},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 401
    db_project = db.query(models.Project).filter(models.Project.uuid == project["uuid"]).first()

    assert (settings.DATA_PATH / Path(project["uuid"]) / "test-data-file.loom").exists()
    assert db_project.size == 9
    assert (
        schemas.Dataset.from_orm(db.query(models.Dataset).filter(models.Dataset.id == dataset["id"]).first()).dict()
        == dataset
    )


def test_guest_cannot_delete_dataset_from_used_project(database, loom_limit_9_bytes, guest, user):
    "Test that a guest user who has access to a project, but is not an owner, canNOT add a dataset"
    db = database()

    response = client.post(
        "/api/v1/project/new", params={"name": "test"}, headers={"Authorization": f"bearer {user['access_token']}"}
    )
    assert response.status_code == 200
    project = response.json()

    response = client.post(
        "/api/v1/project/dataset",
        params={"project": project["uuid"], "name": "Test dataset"},
        files={"uploadfile": ("test-data-file.loom", io.BytesIO(b"Test data"), "application/vnd.loom")},
        headers={"Authorization": f"bearer {user['access_token']}"},
    )
    assert response.status_code == 200
    dataset = response.json()

    # Add guest to project
    response = client.post(
        "/api/v1/project/user",
        params={"project": project["uuid"], "user_id": guest["user"]["id"]},
        headers={"Authorization": f"bearer {user['access_token']}"},
    )

    # Check starts here
    response = client.delete(
        "/api/v1/project/dataset",
        params={"project": project["uuid"], "dataset": dataset["id"]},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 401
    db_project = db.query(models.Project).filter(models.Project.uuid == project["uuid"]).first()

    assert (settings.DATA_PATH / Path(project["uuid"]) / "test-data-file.loom").exists()
    assert db_project.size == 9
    assert (
        schemas.Dataset.from_orm(db.query(models.Dataset).filter(models.Dataset.id == dataset["id"]).first()).dict()
        == dataset
    )


def test_guest_second_owner_can_delete_dataset(database, loom_limit_9_bytes, guest, user):
    "Test that a guest user who did not create the project, but is an owner, can add a dataset"
    db = database()

    response = client.post(
        "/api/v1/project/new", params={"name": "test"}, headers={"Authorization": f"bearer {user['access_token']}"}
    )
    assert response.status_code == 200
    project = response.json()

    response = client.post(
        "/api/v1/project/dataset",
        params={"project": project["uuid"], "name": "Test dataset"},
        files={"uploadfile": ("test-data-file.loom", io.BytesIO(b"Test data"), "application/vnd.loom")},
        headers={"Authorization": f"bearer {user['access_token']}"},
    )
    assert response.status_code == 200
    dataset = response.json()

    # Add guest to project owners
    response = client.post(
        "/api/v1/project/owner",
        params={"project": project["uuid"], "user_id": guest["user"]["id"]},
        headers={"Authorization": f"bearer {user['access_token']}"},
    )

    # Checks start here
    response = client.delete(
        "/api/v1/project/dataset",
        params={"project": project["uuid"], "dataset": dataset["id"]},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 200
    db_project = db.query(models.Project).filter(models.Project.uuid == project["uuid"]).first()

    assert not (settings.DATA_PATH / Path(project["uuid"]) / "test-data-file.loom").exists()
    assert db_project.size == 0
    assert db.query(models.Dataset).filter(models.Dataset.id == dataset["id"]).first() is None


def test_user_can_delete_dataset_from_own_project(database, loom_limit_9_bytes, user):
    "Test that a regular user can delete a dataset from a project they created"
    db = database()

    response = client.post(
        "/api/v1/project/new", params={"name": "test"}, headers={"Authorization": f"bearer {user['access_token']}"}
    )
    assert response.status_code == 200
    project = response.json()

    some_file = io.BytesIO(b"Test data")

    response = client.post(
        "/api/v1/project/dataset",
        params={"project": project["uuid"], "name": "Test dataset"},
        files={"uploadfile": ("test-data-file.loom", some_file, "application/vnd.loom")},
        headers={"Authorization": f"bearer {user['access_token']}"},
    )
    assert response.status_code == 200
    dataset = response.json()

    # Checks start here
    response = client.delete(
        "/api/v1/project/dataset",
        params={"project": project["uuid"], "dataset": dataset["id"]},
        headers={"Authorization": f"bearer {user['access_token']}"},
    )
    assert response.status_code == 200
    db_project = db.query(models.Project).filter(models.Project.uuid == project["uuid"]).first()

    assert not (settings.DATA_PATH / Path(project["uuid"]) / "test-data-file.loom").exists()
    assert db_project.size == 0
    assert db.query(models.Dataset).filter(models.Dataset.id == dataset["id"]).first() is None


def test_user_cannot_delete_dataset_from_non_owned_project(database, loom_limit_9_bytes, guest, user):
    "Test that a guest cannot delete a dataset from a project the do not own"
    db = database()

    response = client.post(
        "/api/v1/project/new", params={"name": "test"}, headers={"Authorization": f"bearer {guest['access_token']}"}
    )
    assert response.status_code == 200
    project = response.json()

    response = client.post(
        "/api/v1/project/dataset",
        params={"project": project["uuid"], "name": "Test dataset"},
        files={"uploadfile": ("test-data-file.loom", io.BytesIO(b"Test data"), "application/vnd.loom")},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 200
    dataset = response.json()

    # Checks start here
    response = client.delete(
        "/api/v1/project/dataset",
        params={"project": project["uuid"], "dataset": dataset["id"]},
        headers={"Authorization": f"bearer {user['access_token']}"},
    )
    assert response.status_code == 401
    db_project = db.query(models.Project).filter(models.Project.uuid == project["uuid"]).first()

    assert (settings.DATA_PATH / Path(project["uuid"]) / "test-data-file.loom").exists()
    assert db_project.size == 9
    assert (
        schemas.Dataset.from_orm(db.query(models.Dataset).filter(models.Dataset.id == dataset["id"]).first()).dict()
        == dataset
    )


def test_admin_can_delete_dataset_from_own_project(database, loom_limit_9_bytes, admin):
    "Test that an admin user can delete a dataset from a project they created"
    db = database()

    response = client.post(
        "/api/v1/project/new", params={"name": "test"}, headers={"Authorization": f"bearer {admin['access_token']}"}
    )
    assert response.status_code == 200
    project = response.json()

    some_file = io.BytesIO(b"Test data")

    response = client.post(
        "/api/v1/project/dataset",
        params={"project": project["uuid"], "name": "Test dataset"},
        files={"uploadfile": ("test-data-file.loom", some_file, "application/vnd.loom")},
        headers={"Authorization": f"bearer {admin['access_token']}"},
    )
    assert response.status_code == 200
    dataset = response.json()

    # Checks start here
    response = client.delete(
        "/api/v1/project/dataset",
        params={"project": project["uuid"], "dataset": dataset["id"]},
        headers={"Authorization": f"bearer {admin['access_token']}"},
    )
    assert response.status_code == 200
    db_project = db.query(models.Project).filter(models.Project.uuid == project["uuid"]).first()

    assert not (settings.DATA_PATH / Path(project["uuid"]) / "test-data-file.loom").exists()
    assert db_project.size == 0
    assert db.query(models.Dataset).filter(models.Dataset.id == dataset["id"]).first() is None


def test_admin_can_delete_dataset_from_non_owned_project(database, loom_limit_9_bytes, guest, admin):
    "Test that a admin cannot delete a dataset from a project the do not own"
    db = database()

    response = client.post(
        "/api/v1/project/new", params={"name": "test"}, headers={"Authorization": f"bearer {guest['access_token']}"}
    )
    assert response.status_code == 200
    project = response.json()

    response = client.post(
        "/api/v1/project/dataset",
        params={"project": project["uuid"], "name": "Test dataset"},
        files={"uploadfile": ("test-data-file.loom", io.BytesIO(b"Test data"), "application/vnd.loom")},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 200
    dataset = response.json()

    # Checks start here
    response = client.delete(
        "/api/v1/project/dataset",
        params={"project": project["uuid"], "dataset": dataset["id"]},
        headers={"Authorization": f"bearer {admin['access_token']}"},
    )
    assert response.status_code == 200
    db_project = db.query(models.Project).filter(models.Project.uuid == project["uuid"]).first()

    assert not (settings.DATA_PATH / Path(project["uuid"]) / "test-data-file.loom").exists()
    assert db_project.size == 0
    assert db.query(models.Dataset).filter(models.Dataset.id == dataset["id"]).first() is None


def test_admin_cannot_delete_existing_dataset_not_in_project(loom_limit_9_bytes, admin):
    "Test that an admin user cannot delete a nonexisting dataset from a project"
    response = client.post(
        "/api/v1/project/new", params={"name": "test"}, headers={"Authorization": f"bearer {admin['access_token']}"}
    )
    assert response.status_code == 200
    projectA = response.json()

    response = client.post(
        "/api/v1/project/new", params={"name": "test"}, headers={"Authorization": f"bearer {admin['access_token']}"}
    )
    assert response.status_code == 200
    projectB = response.json()

    response = client.post(
        "/api/v1/project/dataset",
        params={"project": projectA["uuid"], "name": "Test dataset"},
        files={"uploadfile": ("test-data-file.loom", io.BytesIO(b"Test data"), "application/vnd.loom")},
        headers={"Authorization": f"bearer {admin['access_token']}"},
    )
    assert response.status_code == 200
    dataset = response.json()

    # Checks start here
    response = client.delete(
        "/api/v1/project/dataset",
        params={"project": projectB["uuid"], "dataset": dataset["id"]},
        headers={"Authorization": f"bearer {admin['access_token']}"},
    )
    assert response.status_code == 400


def test_admin_cannot_delete_nonexisting_dataset(admin):
    "Test that trying to delete a dataset that does not exist"
    response = client.post(
        "/api/v1/project/new", params={"name": "test"}, headers={"Authorization": f"bearer {admin['access_token']}"}
    )
    assert response.status_code == 200
    project = response.json()

    response = client.delete(
        "/api/v1/project/dataset",
        params={"project": project["uuid"], "dataset": 555},
        headers={"Authorization": f"bearer {admin['access_token']}"},
    )
    assert response.status_code == 400


def test_admin_cannot_delete_from_nonexisting_project(admin):
    "Test that trying to delete a dataset from project that does not exist"
    response = client.delete(
        "/api/v1/project/dataset",
        params={"project": "fake-project-uuid", "dataset": 1},
        headers={"Authorization": f"bearer {admin['access_token']}"},
    )
    assert response.status_code == 400


# =========================
# GET: /v1/project/datasets
# =========================


def test_unauthenticated_cannot_list_projects(guest):
    "Test that an unauthenticated user cannot list datasets"
    response = client.post(
        "/api/v1/project/new",
        params={"name": "test"},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 200
    project = response.json()

    # Check starts here
    response = client.get("/api/v1/project/datasets", params={"project": project["uuid"]})
    assert response.status_code == 422


def test_guest_can_list_datasets_in_own_project(loom_limit_9_bytes, guest):
    "Test that a guest can list all datasets in a project they created"
    response = client.post(
        "/api/v1/project/new", params={"name": "test"}, headers={"Authorization": f"bearer {guest['access_token']}"}
    )
    assert response.status_code == 200
    project = response.json()

    # Check that there are no datasets
    response = client.get(
        "/api/v1/project/datasets",
        params={"project": project["uuid"]},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 200
    assert response.json() == []

    # Add a datatset
    response = client.post(
        "/api/v1/project/dataset",
        params={"project": project["uuid"], "name": "Test dataset"},
        files={"uploadfile": ("test-data-file.loom", io.BytesIO(b"Test data"), "application/vnd.loom")},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 200
    dataset = response.json()

    # Check that there is 1 dataset
    response = client.get(
        "/api/v1/project/datasets",
        params={"project": project["uuid"]},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 200
    datasets = response.json()

    assert len(datasets) == 1
    assert datasets[0] == dataset


def test_guest_cannot_list_datasets_in_non_owned_project(guest, user):
    "Test that a guest cannot list datasets in a project they do not own"
    response = client.post(
        "/api/v1/project/new", params={"name": "test"}, headers={"Authorization": f"bearer {user['access_token']}"}
    )
    assert response.status_code == 200
    project = response.json()

    # Check that there are no datasets
    response = client.get(
        "/api/v1/project/datasets",
        params={"project": project["uuid"]},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 401


def test_guest_can_list_datasets_in_used_project(loom_limit_9_bytes, guest, user):
    "Test that a guest user who has access to a project, but is not an owner, can list datasets"
    response = client.post(
        "/api/v1/project/new", params={"name": "test"}, headers={"Authorization": f"bearer {user['access_token']}"}
    )
    assert response.status_code == 200
    project = response.json()

    response = client.post(
        "/api/v1/project/dataset",
        params={"project": project["uuid"], "name": "Test dataset"},
        files={"uploadfile": ("test-data-file.loom", io.BytesIO(b"Test data"), "application/vnd.loom")},
        headers={"Authorization": f"bearer {user['access_token']}"},
    )
    assert response.status_code == 200
    dataset = response.json()

    # Add guest to project
    response = client.post(
        "/api/v1/project/user",
        params={"project": project["uuid"], "user_id": guest["user"]["id"]},
        headers={"Authorization": f"bearer {user['access_token']}"},
    )

    # Check starts here
    response = client.get(
        "/api/v1/project/datasets",
        params={"project": project["uuid"]},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 200
    assert response.json() == [dataset]


def test_guest_second_owner_can_list_datasets(database, loom_limit_9_bytes, guest, user):
    "Test that a guest user who did not create the project, but is an owner, can list datasets"
    response = client.post(
        "/api/v1/project/new", params={"name": "test"}, headers={"Authorization": f"bearer {user['access_token']}"}
    )
    assert response.status_code == 200
    project = response.json()

    response = client.post(
        "/api/v1/project/dataset",
        params={"project": project["uuid"], "name": "Test dataset"},
        files={"uploadfile": ("test-data-file.loom", io.BytesIO(b"Test data"), "application/vnd.loom")},
        headers={"Authorization": f"bearer {user['access_token']}"},
    )
    assert response.status_code == 200
    dataset = response.json()

    # Add guest to project owners
    response = client.post(
        "/api/v1/project/owner",
        params={"project": project["uuid"], "user_id": guest["user"]["id"]},
        headers={"Authorization": f"bearer {user['access_token']}"},
    )

    # Checks start here
    response = client.get(
        "/api/v1/project/datasets",
        params={"project": project["uuid"]},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 200
    assert response.json() == [dataset]


def test_user_can_list_datasets_in_own_project(loom_limit_9_bytes, user):
    "Test that a regular user can list all datasets in a project they created"
    response = client.post(
        "/api/v1/project/new", params={"name": "test"}, headers={"Authorization": f"bearer {user['access_token']}"}
    )
    assert response.status_code == 200
    project = response.json()

    # Check that there are no datasets
    response = client.get(
        "/api/v1/project/datasets",
        params={"project": project["uuid"]},
        headers={"Authorization": f"bearer {user['access_token']}"},
    )
    assert response.status_code == 200
    assert response.json() == []

    # Add a datatset
    response = client.post(
        "/api/v1/project/dataset",
        params={"project": project["uuid"], "name": "Test dataset"},
        files={"uploadfile": ("test-data-file.loom", io.BytesIO(b"Test data"), "application/vnd.loom")},
        headers={"Authorization": f"bearer {user['access_token']}"},
    )
    assert response.status_code == 200
    dataset = response.json()

    # Check that there is 1 dataset
    response = client.get(
        "/api/v1/project/datasets",
        params={"project": project["uuid"]},
        headers={"Authorization": f"bearer {user['access_token']}"},
    )
    assert response.status_code == 200
    datasets = response.json()

    assert len(datasets) == 1
    assert datasets[0] == dataset


def test_user_cannot_list_datasets_in_non_owned_project(guest, user):
    "Test that a regular user cannot list datasets in a project they do not own"
    response = client.post(
        "/api/v1/project/new", params={"name": "test"}, headers={"Authorization": f"bearer {guest['access_token']}"}
    )
    assert response.status_code == 200
    project = response.json()

    # Check that there are no datasets
    response = client.get(
        "/api/v1/project/datasets",
        params={"project": project["uuid"]},
        headers={"Authorization": f"bearer {user['access_token']}"},
    )
    assert response.status_code == 401


def test_admin_can_list_datasets_in_own_project(loom_limit_9_bytes, admin):
    "Test that an admin user can list all datasets in a project they created"
    response = client.post(
        "/api/v1/project/new", params={"name": "test"}, headers={"Authorization": f"bearer {admin['access_token']}"}
    )
    assert response.status_code == 200
    project = response.json()

    # Check that there are no datasets
    response = client.get(
        "/api/v1/project/datasets",
        params={"project": project["uuid"]},
        headers={"Authorization": f"bearer {admin['access_token']}"},
    )
    assert response.status_code == 200
    assert response.json() == []

    # Add a datatset
    response = client.post(
        "/api/v1/project/dataset",
        params={"project": project["uuid"], "name": "Test dataset"},
        files={"uploadfile": ("test-data-file.loom", io.BytesIO(b"Test data"), "application/vnd.loom")},
        headers={"Authorization": f"bearer {admin['access_token']}"},
    )
    assert response.status_code == 200
    dataset = response.json()

    # Check that there is 1 dataset
    response = client.get(
        "/api/v1/project/datasets",
        params={"project": project["uuid"]},
        headers={"Authorization": f"bearer {admin['access_token']}"},
    )
    assert response.status_code == 200
    datasets = response.json()

    assert len(datasets) == 1
    assert datasets[0] == dataset


def test_admin_can_list_datasets_in_non_owned_project(loom_limit_9_bytes, guest, admin):
    "Test that an admin user can list datasets in a project they do not own"
    response = client.post(
        "/api/v1/project/new", params={"name": "test"}, headers={"Authorization": f"bearer {guest['access_token']}"}
    )
    assert response.status_code == 200
    project = response.json()

    # Check that there are no datasets
    response = client.get(
        "/api/v1/project/datasets",
        params={"project": project["uuid"]},
        headers={"Authorization": f"bearer {admin['access_token']}"},
    )

    assert response.status_code == 200
    assert response.json() == []

    # Add a datatset
    response = client.post(
        "/api/v1/project/dataset",
        params={"project": project["uuid"], "name": "Test dataset"},
        files={"uploadfile": ("test-data-file.loom", io.BytesIO(b"Test data"), "application/vnd.loom")},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 200
    dataset = response.json()

    # Check that there is 1 dataset
    response = client.get(
        "/api/v1/project/datasets",
        params={"project": project["uuid"]},
        headers={"Authorization": f"bearer {admin['access_token']}"},
    )
    assert response.status_code == 200
    datasets = response.json()

    assert len(datasets) == 1
    assert datasets[0] == dataset


def test_admin_cannot_list_nonexisting_datasets(admin):
    "Test that trying to list a project that does not exist should fail"
    response = client.get(
        "/api/v1/project/datasets",
        params={"project": "fake-project-uuid"},
        headers={"Authorization": f"bearer {admin['access_token']}"},
    )
    assert response.status_code == 404


# ======================
# GET: /v1/project/users
# ======================


def test_unauthenticated_cannot_list_users(guest):
    "Test that an unauthenticated user cannot list users in a project"
    response = client.post(
        "/api/v1/project/new",
        params={"name": "test"},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 200
    project = response.json()

    # Check starts here
    response = client.get("/api/v1/project/users", params={"project": project["uuid"]})
    assert response.status_code == 422


def test_guest_can_list_users_in_own_project(guest):
    "Test that a guest can list the users in a project they created"
    response = client.post(
        "/api/v1/project/new", params={"name": "test"}, headers={"Authorization": f"bearer {guest['access_token']}"}
    )
    assert response.status_code == 200
    project = response.json()

    response = client.get(
        "/api/v1/project/users",
        params={"project": project["uuid"]},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 200
    users = response.json()
    assert users == [{"name": guest["user"]["name"], "role": "guest", "id": 1}]


def test_guest_cannot_list_users_in_non_owned_project(guest, user):
    "Test that a guest cannot list the users in a project they do not own"
    response = client.post(
        "/api/v1/project/new", params={"name": "test"}, headers={"Authorization": f"bearer {user['access_token']}"}
    )
    assert response.status_code == 200
    project = response.json()

    response = client.get(
        "/api/v1/project/users",
        params={"project": project["uuid"]},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 401


def test_guest_can_list_users_in_used_project(loom_limit_9_bytes, guest, user):
    "Test that a guest user who has access to a project, but is not an owner, can list users"
    response = client.post(
        "/api/v1/project/new", params={"name": "test"}, headers={"Authorization": f"bearer {user['access_token']}"}
    )
    assert response.status_code == 200
    project = response.json()

    # Add guest to project
    response = client.post(
        "/api/v1/project/user",
        params={"project": project["uuid"], "user_id": guest["user"]["id"]},
        headers={"Authorization": f"bearer {user['access_token']}"},
    )

    # Check starts here
    response = client.get(
        "/api/v1/project/users",
        params={"project": project["uuid"]},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 200
    assert response.json() == [user["user"], guest["user"]]


def test_guest_second_owner_can_list_users(loom_limit_9_bytes, guest, user):
    "Test that a guest user who did not create the project, but is an owner, can list users"
    response = client.post(
        "/api/v1/project/new", params={"name": "test"}, headers={"Authorization": f"bearer {user['access_token']}"}
    )
    assert response.status_code == 200
    project = response.json()

    # Add guest to project owners
    response = client.post(
        "/api/v1/project/owner",
        params={"project": project["uuid"], "user_id": guest["user"]["id"]},
        headers={"Authorization": f"bearer {user['access_token']}"},
    )

    # Checks start here
    response = client.get(
        "/api/v1/project/users",
        params={"project": project["uuid"]},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 200
    assert response.json() == [user["user"], guest["user"]]


def test_user_can_list_users_in_own_project(user):
    "Test that a regular user can list the users in a project they created"
    response = client.post(
        "/api/v1/project/new", params={"name": "test"}, headers={"Authorization": f"bearer {user['access_token']}"}
    )
    assert response.status_code == 200
    project = response.json()

    response = client.get(
        "/api/v1/project/users",
        params={"project": project["uuid"]},
        headers={"Authorization": f"bearer {user['access_token']}"},
    )
    assert response.status_code == 200
    users = response.json()
    assert users == [{"name": user["user"]["name"], "role": "user", "id": 1}]


def test_user_cannot_list_users_in_non_owned_project(guest, user):
    "Test that a regular user cannot list the users in a project they do not own"
    response = client.post(
        "/api/v1/project/new", params={"name": "test"}, headers={"Authorization": f"bearer {guest['access_token']}"}
    )
    assert response.status_code == 200
    project = response.json()

    response = client.get(
        "/api/v1/project/users",
        params={"project": project["uuid"]},
        headers={"Authorization": f"bearer {user['access_token']}"},
    )
    assert response.status_code == 401


def test_admin_can_list_users_in_own_project(admin):
    "Test that an admin user can list the users in a project they created"
    response = client.post(
        "/api/v1/project/new", params={"name": "test"}, headers={"Authorization": f"bearer {admin['access_token']}"}
    )
    assert response.status_code == 200
    project = response.json()

    response = client.get(
        "/api/v1/project/users",
        params={"project": project["uuid"]},
        headers={"Authorization": f"bearer {admin['access_token']}"},
    )
    assert response.status_code == 200
    users = response.json()
    assert users == [{"name": admin["user"]["name"], "role": "admin", "id": 1}]


def test_admin_can_list_users_in_non_owned_project(admin, user):
    "Test that an admin user can list the users in a project they created"
    response = client.post(
        "/api/v1/project/new", params={"name": "test"}, headers={"Authorization": f"bearer {user['access_token']}"}
    )
    assert response.status_code == 200
    project = response.json()

    response = client.get(
        "/api/v1/project/users",
        params={"project": project["uuid"]},
        headers={"Authorization": f"bearer {admin['access_token']}"},
    )
    assert response.status_code == 200
    users = response.json()
    assert users == [user["user"]]


def test_list_users_nonexistent_project(admin):
    "Test that users cannot be listed on a project that does not exist"
    response = client.get(
        "/api/v1/project/users",
        params={"project": "this-project-does-not-exist-uuid"},
        headers={"Authorization": f"bearer {admin['access_token']}"},
    )
    assert response.status_code == 404


# ======================
# POST: /v1/project/user
# ======================


def test_unauthenticated_cannot_add_users_to_project(guest):
    "Test that an unauthenticated user cannot add users to a project"
    response = client.post(
        "/api/v1/project/new",
        params={"name": "test"},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 200
    project = response.json()

    # Check starts here
    response = client.post("/api/v1/project/user", params={"project": project["uuid"], "user_id": 52})
    assert response.status_code == 422


def test_guest_can_add_user_to_own_project(guest, user):
    "Test that a guest can add a user to a project they own"
    response = client.post(
        "/api/v1/project/new",
        params={"name": "test"},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 200
    project = response.json()

    # Check starts here
    response = client.post(
        "/api/v1/project/user",
        params={"project": project["uuid"], "user_id": user["user"]["id"]},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 200

    # User can now list users?
    response = client.get(
        "/api/v1/project/users",
        params={"project": project["uuid"]},
        headers={"Authorization": f"bearer {user['access_token']}"},
    )
    assert response.status_code == 200
    assert response.json() == [guest["user"], user["user"]]


def test_guest_cannot_add_user_to_non_owned_project(guest, user):
    "Test that a guest can add a user to a project they own"
    response = client.post(
        "/api/v1/project/new",
        params={"name": "test"},
        headers={"Authorization": f"bearer {user['access_token']}"},
    )
    assert response.status_code == 200
    project = response.json()

    # Check starts here
    response = client.post(
        "/api/v1/project/user",
        params={"project": project["uuid"], "user_id": guest["user"]["id"]},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 401

    # User can now list users?
    response = client.get(
        "/api/v1/project/users",
        params={"project": project["uuid"]},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 401


def test_guest_cannot_add_user_to_used_project(guest, user):
    "Test that a guest user who has access to a project, but is not an owner, canNOT add users"
    response = client.post(
        "/api/v1/project/new", params={"name": "test"}, headers={"Authorization": f"bearer {user['access_token']}"}
    )
    assert response.status_code == 200
    project = response.json()

    # Add guest to project
    response = client.post(
        "/api/v1/project/user",
        params={"project": project["uuid"], "user_id": guest["user"]["id"]},
        headers={"Authorization": f"bearer {user['access_token']}"},
    )

    # Check starts here
    response = client.post(
        "/api/v1/project/user",
        params={"project": project["uuid"], "user_id": guest["user"]["id"]},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 401


def test_guest_second_owner_can_add_users(guest, user, another_user):
    "Test that a guest user who did not create the project, but is an owner, can add users"
    response = client.post(
        "/api/v1/project/new", params={"name": "test"}, headers={"Authorization": f"bearer {user['access_token']}"}
    )
    assert response.status_code == 200
    project = response.json()

    # Add guest to project owners
    response = client.post(
        "/api/v1/project/owner",
        params={"project": project["uuid"], "user_id": guest["user"]["id"]},
        headers={"Authorization": f"bearer {user['access_token']}"},
    )

    # Checks start here
    response = client.post(
        "/api/v1/project/user",
        params={"project": project["uuid"], "user_id": another_user["user"]["id"]},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 200

    # User can now list users?
    response = client.get(
        "/api/v1/project/users",
        params={"project": project["uuid"]},
        headers={"Authorization": f"bearer {another_user['access_token']}"},
    )
    assert response.json() == [user["user"], guest["user"], another_user["user"]]


def test_user_can_add_user_to_own_project(guest, user):
    "Test that a regular user can add a user to a project they own"
    response = client.post(
        "/api/v1/project/new",
        params={"name": "test"},
        headers={"Authorization": f"bearer {user['access_token']}"},
    )
    assert response.status_code == 200
    project = response.json()

    # Check starts here
    response = client.post(
        "/api/v1/project/user",
        params={"project": project["uuid"], "user_id": guest["user"]["id"]},
        headers={"Authorization": f"bearer {user['access_token']}"},
    )
    assert response.status_code == 200

    # User can now list users?
    response = client.get(
        "/api/v1/project/users",
        params={"project": project["uuid"]},
        headers={"Authorization": f"bearer {user['access_token']}"},
    )
    assert response.status_code == 200
    assert response.json() == [user["user"], guest["user"]]


def test_user_cannot_add_user_to_non_owned_project(guest, user):
    "Test that a guest can add a user to a project they own"
    response = client.post(
        "/api/v1/project/new",
        params={"name": "test"},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 200
    project = response.json()

    # Check starts here
    response = client.post(
        "/api/v1/project/user",
        params={"project": project["uuid"], "user_id": user["user"]["id"]},
        headers={"Authorization": f"bearer {user['access_token']}"},
    )
    assert response.status_code == 401

    # User can now list users?
    response = client.get(
        "/api/v1/project/users",
        params={"project": project["uuid"]},
        headers={"Authorization": f"bearer {user['access_token']}"},
    )
    assert response.status_code == 401


def test_admin_can_add_user_to_own_project(admin, user):
    "Test that a regular user can add a user to a project they own"
    response = client.post(
        "/api/v1/project/new",
        params={"name": "test"},
        headers={"Authorization": f"bearer {admin['access_token']}"},
    )
    assert response.status_code == 200
    project = response.json()

    # Check starts here
    response = client.post(
        "/api/v1/project/user",
        params={"project": project["uuid"], "user_id": user["user"]["id"]},
        headers={"Authorization": f"bearer {admin['access_token']}"},
    )
    assert response.status_code == 200

    # User can now list users?
    response = client.get(
        "/api/v1/project/users",
        params={"project": project["uuid"]},
        headers={"Authorization": f"bearer {user['access_token']}"},
    )
    assert response.status_code == 200
    assert response.json() == [admin["user"], user["user"]]


def test_admin_can_add_user_to_non_owned_project(admin, user):
    "Test that a regular user can add a user to a project they own"
    response = client.post(
        "/api/v1/project/new",
        params={"name": "test"},
        headers={"Authorization": f"bearer {user['access_token']}"},
    )
    assert response.status_code == 200
    project = response.json()

    # Check starts here
    response = client.post(
        "/api/v1/project/user",
        params={"project": project["uuid"], "user_id": admin["user"]["id"]},
        headers={"Authorization": f"bearer {admin['access_token']}"},
    )
    assert response.status_code == 200

    # User can now list users?
    response = client.get(
        "/api/v1/project/users",
        params={"project": project["uuid"]},
        headers={"Authorization": f"bearer {admin['access_token']}"},
    )
    assert response.status_code == 200
    assert response.json() == [user["user"], admin["user"]]


def test_admin_cannot_add_user_to_nonexistent_project(admin):
    response = client.post(
        "/api/v1/project/user",
        params={"project": "uuid-for-fake-project", "user_id": admin["user"]["id"]},
        headers={"Authorization": f"bearer {admin['access_token']}"},
    )
    assert response.status_code == 400


def test_admin_cannot_add_nonexisting_user_to_project(admin):
    response = client.post(
        "/api/v1/project/new",
        params={"name": "test"},
        headers={"Authorization": f"bearer {admin['access_token']}"},
    )
    assert response.status_code == 200
    project = response.json()

    response = client.post(
        "/api/v1/project/user",
        params={"project": project["uuid"], "user_id": 55},
        headers={"Authorization": f"bearer {admin['access_token']}"},
    )
    assert response.status_code == 400


def test_admin_cannot_add_user_already_in_project(admin):
    response = client.post(
        "/api/v1/project/new",
        params={"name": "test"},
        headers={"Authorization": f"bearer {admin['access_token']}"},
    )
    assert response.status_code == 200
    project = response.json()

    response = client.post(
        "/api/v1/project/user",
        params={"project": project["uuid"], "user_id": admin["user"]["id"]},
        headers={"Authorization": f"bearer {admin['access_token']}"},
    )
    assert response.status_code == 400


# ========================
# DELETE: /v1/project/user
# ========================


def test_unauthenticated_cannot_delete_user_from_project(guest):
    "Test that an unauthenticated user cannot delete users from a project"
    response = client.post(
        "/api/v1/project/new",
        params={"name": "test"},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 200
    project = response.json()

    # Check starts here
    response = client.delete(
        "/api/v1/project/user", params={"project": project["uuid"], "user_id": guest["user"]["id"]}
    )
    assert response.status_code == 422


def test_guest_can_delete_user_from_own_project(guest):
    "Test that a guest can delete a user from a project they own"
    response = client.post(
        "/api/v1/project/new",
        params={"name": "test"},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 200
    project = response.json()

    # Check starts here
    response = client.delete(
        "/api/v1/project/user",
        params={"project": project["uuid"], "user_id": guest["user"]["id"]},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 200


def test_guest_cannot_delete_user_from_non_owned_project(guest, user):
    "Test that a guest can delete a user from a project they own"
    response = client.post(
        "/api/v1/project/new",
        params={"name": "test"},
        headers={"Authorization": f"bearer {user['access_token']}"},
    )
    assert response.status_code == 200
    project = response.json()

    # Check starts here
    response = client.delete(
        "/api/v1/project/user",
        params={"project": project["uuid"], "user_id": user["user"]["id"]},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 401


def test_guest_cannot_delete_user_from_used_project(guest, user):
    "Test that a guest user who has access to a project, but is not an owner, canNOT delete users"
    response = client.post(
        "/api/v1/project/new", params={"name": "test"}, headers={"Authorization": f"bearer {user['access_token']}"}
    )
    assert response.status_code == 200
    project = response.json()

    # Add guest to project
    response = client.post(
        "/api/v1/project/user",
        params={"project": project["uuid"], "user_id": guest["user"]["id"]},
        headers={"Authorization": f"bearer {user['access_token']}"},
    )

    # Check starts here
    response = client.delete(
        "/api/v1/project/user",
        params={"project": project["uuid"], "user_id": user["user"]["id"]},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 401


def test_guest_second_owner_can_delete_users(guest, user, another_user):
    "Test that a guest user who did not create the project, but is an owner, can delete users"
    response = client.post(
        "/api/v1/project/new", params={"name": "test"}, headers={"Authorization": f"bearer {user['access_token']}"}
    )
    assert response.status_code == 200
    project = response.json()

    # Add another_user to project
    response = client.post(
        "/api/v1/project/user",
        params={"project": project["uuid"], "user_id": another_user["user"]["id"]},
        headers={"Authorization": f"bearer {user['access_token']}"},
    )

    # Add guest to project owners
    response = client.post(
        "/api/v1/project/owner",
        params={"project": project["uuid"], "user_id": guest["user"]["id"]},
        headers={"Authorization": f"bearer {user['access_token']}"},
    )
    assert response.status_code == 200

    # Check that project now has 3 users:
    response = client.get(
        "/api/v1/project/users",
        params={"project": project["uuid"]},
        headers={"Authorization": f"bearer {user['access_token']}"},
    )
    assert response.status_code == 200
    assert response.json() == [user["user"], another_user["user"], guest["user"]]

    # Checks start here
    response = client.delete(
        "/api/v1/project/user",
        params={"project": project["uuid"], "user_id": another_user["user"]["id"]},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 200

    # Check that project now has 2 users:
    response = client.get(
        "/api/v1/project/users",
        params={"project": project["uuid"]},
        headers={"Authorization": f"bearer {user['access_token']}"},
    )
    assert response.status_code == 200
    assert response.json() == [user["user"], guest["user"]]


def test_user_can_delete_user_from_own_project(user):
    "Test that a regular user can delete a user from a project they own"
    response = client.post(
        "/api/v1/project/new",
        params={"name": "test"},
        headers={"Authorization": f"bearer {user['access_token']}"},
    )
    assert response.status_code == 200
    project = response.json()

    # Check starts here
    response = client.delete(
        "/api/v1/project/user",
        params={"project": project["uuid"], "user_id": user["user"]["id"]},
        headers={"Authorization": f"bearer {user['access_token']}"},
    )
    assert response.status_code == 200


def test_user_cannot_delete_user_from_non_owned_project(guest, user):
    "Test that a guest can delete a user to a project they own"
    response = client.post(
        "/api/v1/project/new",
        params={"name": "test"},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 200
    project = response.json()

    # Check starts here
    response = client.delete(
        "/api/v1/project/user",
        params={"project": project["uuid"], "user_id": guest["user"]["id"]},
        headers={"Authorization": f"bearer {user['access_token']}"},
    )
    assert response.status_code == 401


def test_admin_can_delete_user_from_own_project(admin):
    "Test that an admin user can delete a user from a project they own"
    response = client.post(
        "/api/v1/project/new",
        params={"name": "test"},
        headers={"Authorization": f"bearer {admin['access_token']}"},
    )
    assert response.status_code == 200
    project = response.json()

    # Check starts here
    response = client.delete(
        "/api/v1/project/user",
        params={"project": project["uuid"], "user_id": admin["user"]["id"]},
        headers={"Authorization": f"bearer {admin['access_token']}"},
    )
    assert response.status_code == 200


def test_admin_can_delete_user_from_non_owned_project(guest, admin):
    "Test that a guest can delete a user to a project they own"
    response = client.post(
        "/api/v1/project/new",
        params={"name": "test"},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 200
    project = response.json()

    # Check starts here
    response = client.delete(
        "/api/v1/project/user",
        params={"project": project["uuid"], "user_id": guest["user"]["id"]},
        headers={"Authorization": f"bearer {admin['access_token']}"},
    )
    assert response.status_code == 200


def test_cannot_remove_unknown_user(admin, guest):
    "Test that an admin cannot remove a user that doesn't exist"
    response = client.post(
        "/api/v1/project/new",
        params={"name": "test"},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 200
    project = response.json()

    # Check starts here
    response = client.delete(
        "/api/v1/project/user",
        params={"project": project["uuid"], "user_id": 55},
        headers={"Authorization": f"bearer {admin['access_token']}"},
    )
    assert response.status_code == 400


def test_cannot_remove_user_from_unknown_project(admin, guest):
    "Test that an admin cannot remove a user from a project that doesn't exist"
    response = client.delete(
        "/api/v1/project/user",
        params={"project": "not-a-valid-uuid", "user_id": guest["user"]["id"]},
        headers={"Authorization": f"bearer {admin['access_token']}"},
    )
    assert response.status_code == 400


def test_cannot_remove_user_not_in_project(guest, user):
    "Test that a user who isn't even in a project cannot be removed from it"
    response = client.post(
        "/api/v1/project/new",
        params={"name": "test"},
        headers={"Authorization": f"bearer {user['access_token']}"},
    )
    assert response.status_code == 200
    project = response.json()

    response = client.delete(
        "/api/v1/project/user",
        params={"project": project["uuid"], "user_id": guest["user"]["id"]},
        headers={"Authorization": f"bearer {user['access_token']}"},
    )
    assert response.status_code == 400


# ======================
# GET: /v1/project/owner
# ======================


def test_unauthenticated_cannot_list_owners_of_project(guest):
    "Test that an unauthenticated user cannot owners of a project"
    response = client.post(
        "/api/v1/project/new",
        params={"name": "test"},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 200
    project = response.json()

    # Check starts here
    response = client.get("/api/v1/project/owner", params={"project": project["uuid"]})
    assert response.status_code == 422


def test_guest_can_list_owners_of_own_project(guest):
    "Test that a guest can list the owners of a project they own"
    response = client.post(
        "/api/v1/project/new",
        params={"name": "test"},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 200
    project = response.json()

    # Check starts here
    response = client.get(
        "/api/v1/project/owner",
        params={"project": project["uuid"]},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 200
    assert response.json() == [guest["user"]]


def test_guest_cannot_list_owners_of_non_owned_project(guest, user):
    "Test that a guest cannot list the owners of a project they do not own"
    response = client.post(
        "/api/v1/project/new",
        params={"name": "test"},
        headers={"Authorization": f"bearer {user['access_token']}"},
    )
    assert response.status_code == 200
    project = response.json()

    # Check starts here
    response = client.get(
        "/api/v1/project/owner",
        params={"project": project["uuid"]},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 401


def test_user_can_list_owners_of_own_project(user):
    "Test that a regular user can list the owners of a project they own"
    response = client.post(
        "/api/v1/project/new",
        params={"name": "test"},
        headers={"Authorization": f"bearer {user['access_token']}"},
    )
    assert response.status_code == 200
    project = response.json()

    # Check starts here
    response = client.get(
        "/api/v1/project/owner",
        params={"project": project["uuid"]},
        headers={"Authorization": f"bearer {user['access_token']}"},
    )
    assert response.status_code == 200
    assert response.json() == [user["user"]]


def test_user_cannot_list_owners_of_non_owned_project(guest, user):
    "Test that a regular user cannot list the owners of a project they do not own"
    response = client.post(
        "/api/v1/project/new",
        params={"name": "test"},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 200
    project = response.json()

    # Check starts here
    response = client.get(
        "/api/v1/project/owner",
        params={"project": project["uuid"]},
        headers={"Authorization": f"bearer {user['access_token']}"},
    )
    assert response.status_code == 401


def test_admin_can_list_owners_of_own_project(admin):
    "Test that an admin user can list the owners of a project they own"
    response = client.post(
        "/api/v1/project/new",
        params={"name": "test"},
        headers={"Authorization": f"bearer {admin['access_token']}"},
    )
    assert response.status_code == 200
    project = response.json()

    # Check starts here
    response = client.get(
        "/api/v1/project/owner",
        params={"project": project["uuid"]},
        headers={"Authorization": f"bearer {admin['access_token']}"},
    )
    assert response.status_code == 200
    assert response.json() == [admin["user"]]


def test_admin_can_list_owners_of_non_owned_project(guest, admin):
    "Test that a regular user cannot list the owners of a project they do not own"
    response = client.post(
        "/api/v1/project/new",
        params={"name": "test"},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 200
    project = response.json()

    # Check starts here
    response = client.get(
        "/api/v1/project/owner",
        params={"project": project["uuid"]},
        headers={"Authorization": f"bearer {admin['access_token']}"},
    )
    assert response.status_code == 200
    assert response.json() == [guest["user"]]


def test_admin_cannot_list_owners_of_unknown_project(admin):
    "Test that an admin cannot list the owners of a project that doesn't exist"
    response = client.get(
        "/api/v1/project/owner",
        params={"project": "not-a-valid-uuid"},
        headers={"Authorization": f"bearer {admin['access_token']}"},
    )
    assert response.status_code == 400


# =======================
# POST: /v1/project/owner
# =======================


def test_unauthenticated_cannot_add_owner_to_project(user, guest):
    "Test that an unauthenticated user cannot add owners to a project"
    response = client.post(
        "/api/v1/project/new",
        params={"name": "test"},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 200
    project = response.json()

    # Check starts here
    response = client.post("/api/v1/project/owner", params={"project": project["uuid"], "user_id": user["user"]["id"]})
    assert response.status_code == 422


def test_guest_can_add_owner_to_own_project(guest, user):
    "Test that a guest can add an owner to a project they own"
    response = client.post(
        "/api/v1/project/new",
        params={"name": "test"},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 200
    project = response.json()

    # Check starts here
    response = client.post(
        "/api/v1/project/owner",
        params={"project": project["uuid"], "user_id": user["user"]["id"]},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 200

    response = client.get(
        "/api/v1/project/owner",
        params={"project": project["uuid"]},
        headers={"Authorization": f"bearer {user['access_token']}"},
    )
    assert response.status_code == 200
    assert response.json() == [guest["user"], user["user"]]


def test_guest_cannot_add_owner_to_non_owned_project(guest, user):
    "Test that a guest cannot add an owner to a project they do not own"
    response = client.post(
        "/api/v1/project/new",
        params={"name": "test"},
        headers={"Authorization": f"bearer {user['access_token']}"},
    )
    assert response.status_code == 200
    project = response.json()

    # Check starts here
    response = client.post(
        "/api/v1/project/owner",
        params={"project": project["uuid"], "user_id": guest["user"]["id"]},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 401


def test_user_can_add_owner_to_own_project(user, guest):
    "Test that a regular user can add an owner to a project they own"
    response = client.post(
        "/api/v1/project/new",
        params={"name": "test"},
        headers={"Authorization": f"bearer {user['access_token']}"},
    )
    assert response.status_code == 200
    project = response.json()

    # Check starts here
    response = client.post(
        "/api/v1/project/owner",
        params={"project": project["uuid"], "user_id": guest["user"]["id"]},
        headers={"Authorization": f"bearer {user['access_token']}"},
    )
    assert response.status_code == 200

    response = client.get(
        "/api/v1/project/owner",
        params={"project": project["uuid"]},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 200
    assert response.json() == [user["user"], guest["user"]]


def test_user_cannot_add_owner_to_non_owned_project(guest, user):
    "Test that a regular user cannot add an owner to a project they do not own"
    response = client.post(
        "/api/v1/project/new",
        params={"name": "test"},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 200
    project = response.json()

    # Check starts here
    response = client.post(
        "/api/v1/project/owner",
        params={"project": project["uuid"], "user_id": user["user"]["id"]},
        headers={"Authorization": f"bearer {user['access_token']}"},
    )
    assert response.status_code == 401


def test_admin_can_add_owner_to_own_project(admin, guest):
    "Test that an admin user can add an owner to a project they own"
    response = client.post(
        "/api/v1/project/new",
        params={"name": "test"},
        headers={"Authorization": f"bearer {admin['access_token']}"},
    )
    assert response.status_code == 200
    project = response.json()

    # Check starts here
    response = client.post(
        "/api/v1/project/owner",
        params={"project": project["uuid"], "user_id": guest["user"]["id"]},
        headers={"Authorization": f"bearer {admin['access_token']}"},
    )
    assert response.status_code == 200

    response = client.get(
        "/api/v1/project/owner",
        params={"project": project["uuid"]},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 200
    assert response.json() == [admin["user"], guest["user"]]


def test_admin_can_add_owner_to_non_owned_project(guest, admin):
    "Test that an admin user can add an owner to a project they do not own"
    response = client.post(
        "/api/v1/project/new",
        params={"name": "test"},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 200
    project = response.json()

    # Check starts here
    response = client.post(
        "/api/v1/project/owner",
        params={"project": project["uuid"], "user_id": admin["user"]["id"]},
        headers={"Authorization": f"bearer {admin['access_token']}"},
    )
    assert response.status_code == 200

    response = client.get(
        "/api/v1/project/owner",
        params={"project": project["uuid"]},
        headers={"Authorization": f"bearer {admin['access_token']}"},
    )
    assert response.status_code == 200
    print(response.json())
    assert response.json() == [guest["user"], admin["user"]]


def test_admin_cannot_add_owner_to_unknown_project(admin):
    "Test that an admin cannot add an owner to a project that doesn't exist"
    response = client.post(
        "/api/v1/project/owner",
        params={"project": "not-a-valid-uuid", "user_id": admin["user"]["id"]},
        headers={"Authorization": f"bearer {admin['access_token']}"},
    )
    assert response.status_code == 400


def test_add_owner_who_is_already_an_owner(guest):
    "Try to add an owner who is already an owner"
    response = client.post(
        "/api/v1/project/new",
        params={"name": "test"},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 200
    project = response.json()

    # Check starts here
    response = client.post(
        "/api/v1/project/owner",
        params={"project": project["uuid"], "user_id": guest["user"]["id"]},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 400


def test_add_owner_who_does_not_exist(guest):
    "Try to add an owner who doesn't exist"
    response = client.post(
        "/api/v1/project/new",
        params={"name": "test"},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 200
    project = response.json()

    # Check starts here
    response = client.post(
        "/api/v1/project/owner",
        params={"project": project["uuid"], "user_id": 666},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 400


# =========================
# DELETE: /v1/project/owner
# =========================


def test_unauthenticated_cannot_delete_owner_from_project(guest):
    "Test that an unauthenticated user cannot delete owners from a project"
    response = client.post(
        "/api/v1/project/new",
        params={"name": "test"},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 200
    project = response.json()

    # Check starts here
    response = client.delete(
        "/api/v1/project/owner", params={"project": project["uuid"], "user_id": guest["user"]["id"]}
    )
    assert response.status_code == 422


def test_guest_can_delete_owner_from_own_project(guest, user):
    "Test that a guest can delete an owner to a project they own"
    response = client.post(
        "/api/v1/project/new",
        params={"name": "test"},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 200
    project = response.json()

    response = client.post(
        "/api/v1/project/owner",
        params={"project": project["uuid"], "user_id": user["user"]["id"]},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 200

    response = client.get(
        "/api/v1/project/owner",
        params={"project": project["uuid"]},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 200
    assert response.json() == [guest["user"], user["user"]]

    # Check starts here
    response = client.delete(
        "/api/v1/project/owner",
        params={"project": project["uuid"], "user_id": user["user"]["id"]},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 200

    response = client.get(
        "/api/v1/project/owner",
        params={"project": project["uuid"]},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 200
    assert response.json() == [guest["user"]]


def test_owner_can_delete_other_owner_from_project(guest, user):
    "Test that a project owner can delete another owner from a project they own"
    response = client.post(
        "/api/v1/project/new",
        params={"name": "test"},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 200
    project = response.json()

    response = client.post(
        "/api/v1/project/owner",
        params={"project": project["uuid"], "user_id": user["user"]["id"]},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 200

    response = client.get(
        "/api/v1/project/owner",
        params={"project": project["uuid"]},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 200
    assert response.json() == [guest["user"], user["user"]]

    # Check starts here
    response = client.delete(
        "/api/v1/project/owner",
        params={"project": project["uuid"], "user_id": guest["user"]["id"]},
        headers={"Authorization": f"bearer {user['access_token']}"},
    )
    assert response.status_code == 200

    response = client.get(
        "/api/v1/project/owner",
        params={"project": project["uuid"]},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 200
    assert response.json() == [user["user"]]


def test_guest_cannot_delete_owner_from_non_owned_project(guest, user):
    "Test that a guest cannot delete an owner to a project they do not own"
    response = client.post(
        "/api/v1/project/new",
        params={"name": "test"},
        headers={"Authorization": f"bearer {user['access_token']}"},
    )
    assert response.status_code == 200
    project = response.json()

    # Check starts here
    response = client.delete(
        "/api/v1/project/owner",
        params={"project": project["uuid"], "user_id": user["user"]["id"]},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 401

    response = client.get(
        "/api/v1/project/owner",
        params={"project": project["uuid"]},
        headers={"Authorization": f"bearer {user['access_token']}"},
    )
    assert response.status_code == 200
    assert response.json() == [user["user"]]


def test_user_can_delete_owner_from_own_project(user, guest):
    "Test that a regular user can delete an owner from a project they own"
    response = client.post(
        "/api/v1/project/new",
        params={"name": "test"},
        headers={"Authorization": f"bearer {user['access_token']}"},
    )
    assert response.status_code == 200
    project = response.json()

    response = client.post(
        "/api/v1/project/owner",
        params={"project": project["uuid"], "user_id": guest["user"]["id"]},
        headers={"Authorization": f"bearer {user['access_token']}"},
    )
    assert response.status_code == 200

    # Check starts here
    response = client.delete(
        "/api/v1/project/owner",
        params={"project": project["uuid"], "user_id": guest["user"]["id"]},
        headers={"Authorization": f"bearer {user['access_token']}"},
    )
    assert response.status_code == 200

    response = client.get(
        "/api/v1/project/owner",
        params={"project": project["uuid"]},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 200
    assert response.json() == [user["user"]]


def test_user_cannot_delete_owner_from_non_owned_project(guest, user):
    "Test that a regular user cannot delete an owner from a project they do not own"
    response = client.post(
        "/api/v1/project/new",
        params={"name": "test"},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 200
    project = response.json()

    # Check starts here
    response = client.post(
        "/api/v1/project/owner",
        params={"project": project["uuid"], "user_id": guest["user"]["id"]},
        headers={"Authorization": f"bearer {user['access_token']}"},
    )
    assert response.status_code == 401

    response = client.get(
        "/api/v1/project/owner",
        params={"project": project["uuid"]},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 200
    assert response.json() == [guest["user"]]


def test_admin_can_delete_owner_from_own_project(admin, guest):
    "Test that an admin user can delete an owner from a project they own"
    response = client.post(
        "/api/v1/project/new",
        params={"name": "test"},
        headers={"Authorization": f"bearer {admin['access_token']}"},
    )
    assert response.status_code == 200
    project = response.json()

    response = client.post(
        "/api/v1/project/owner",
        params={"project": project["uuid"], "user_id": guest["user"]["id"]},
        headers={"Authorization": f"bearer {admin['access_token']}"},
    )
    assert response.status_code == 200

    response = client.get(
        "/api/v1/project/owner",
        params={"project": project["uuid"]},
        headers={"Authorization": f"bearer {admin['access_token']}"},
    )
    assert response.status_code == 200
    assert response.json() == [admin["user"], guest["user"]]

    # Check starts here
    response = client.delete(
        "/api/v1/project/owner",
        params={"project": project["uuid"], "user_id": guest["user"]["id"]},
        headers={"Authorization": f"bearer {admin['access_token']}"},
    )
    assert response.status_code == 200

    response = client.get(
        "/api/v1/project/owner",
        params={"project": project["uuid"]},
        headers={"Authorization": f"bearer {admin['access_token']}"},
    )
    assert response.status_code == 200
    assert response.json() == [admin["user"]]


def test_admin_can_delete_owner_from_non_owned_project(guest, admin):
    "Test that an admin user can delete an owner from a project they do not own"
    response = client.post(
        "/api/v1/project/new",
        params={"name": "test"},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 200
    project = response.json()

    response = client.delete(
        "/api/v1/project/owner",
        params={"project": project["uuid"], "user_id": guest["user"]["id"]},
        headers={"Authorization": f"bearer {admin['access_token']}"},
    )
    assert response.status_code == 200

    response = client.get(
        "/api/v1/project/owner",
        params={"project": project["uuid"]},
        headers={"Authorization": f"bearer {admin['access_token']}"},
    )
    assert response.status_code == 200
    assert response.json() == []


def test_admin_cannot_delete_owner_from_unknown_project(admin):
    "Test that an admin cannot delete an owner from a project that doesn't exist"
    response = client.delete(
        "/api/v1/project/owner",
        params={"project": "not-a-valid-uuid", "user_id": admin["user"]["id"]},
        headers={"Authorization": f"bearer {admin['access_token']}"},
    )
    assert response.status_code == 400


def test_delete_owner_who_does_not_exist(guest, user):
    "Try to add an owner who doesn't exist"
    response = client.post(
        "/api/v1/project/new",
        params={"name": "test"},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 200
    project = response.json()

    # Check starts here
    response = client.delete(
        "/api/v1/project/owner",
        params={"project": project["uuid"], "user_id": 666},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 400


def test_delete_owner_who_is_not_an_owner(guest, user):
    "Try to add an owner who doesn't exist"
    response = client.post(
        "/api/v1/project/new",
        params={"name": "test"},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 200
    project = response.json()

    # Check starts here
    response = client.delete(
        "/api/v1/project/owner",
        params={"project": project["uuid"], "user_id": user["user"]["id"]},
        headers={"Authorization": f"bearer {guest['access_token']}"},
    )
    assert response.status_code == 400
