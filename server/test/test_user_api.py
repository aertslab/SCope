" Tests for the /user/ section of the HTTP API "

from test.api_fixture import client, database_engine, database, guest, user, admin


def test_create_user(database):
    "Test that a new guest user can be created"
    response = client.post("/api/v1/user/new")
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert "user" in data
    assert data["user"]["id"] == 1
    assert data["user"]["name"] == "Guest"
    assert data["user"]["role"] == "guest"


def test_list_users(admin):
    "Test that an admin user can list all users"
    auth = f"bearer {admin['access_token']}"
    response = client.get("/api/v1/user/all", headers={"authorization": auth})
    assert response.status_code == 200
    users = response.json()
    assert len(users) == 1


def test_list_users_fail_as_guest(guest):
    "Test that a guest cannot list all users"
    auth = f"bearer {guest['access_token']}"
    response = client.get("/api/v1/user/all", headers={"authorization": auth})
    assert response.status_code == 401
    assert response.json() == {"detail": "Not an admin"}


def test_list_users_fail_as_user(user):
    "Test that a regular user cannot list all users"
    auth = f"bearer {user['access_token']}"
    response = client.get("/api/v1/user/all", headers={"authorization": auth})
    assert response.status_code == 401
    assert response.json() == {"detail": "Not an admin"}


def test_delete_user(guest, admin):
    "Test that an admin user can delete a user"
    auth = f"bearer {admin['access_token']}"
    response = client.delete("/api/v1/user/", params={"user_id": guest["user"]["id"]}, headers={"authorization": auth})
    assert response.status_code == 200

    users_resp = client.get("/api/v1/user/all", headers={"authorization": auth})
    users = users_resp.json()
    assert len(users) == 1
    assert users[0]["id"] == 2


def test_delete_user_fail_as_guest(guest, admin):
    "Test that a guest cannot delete a user"
    auth = f"bearer {guest['access_token']}"
    response = client.delete("/api/v1/user/", params={"user_id": admin["user"]["id"]}, headers={"authorization": auth})
    assert response.status_code == 401
    assert response.json() == {"detail": "Not an admin"}


def test_delete_user_fail_as_user(user, admin):
    "Test that a guest cannot delete a user"
    auth = f"bearer {user['access_token']}"
    response = client.delete("/api/v1/user/", params={"user_id": admin["user"]["id"]}, headers={"authorization": auth})
    assert response.status_code == 401
    assert response.json() == {"detail": "Not an admin"}


def test_promote_to_admin(guest, admin):
    "Test that an admin user can promote someone to admin"
    auth = f"bearer {admin['access_token']}"
    response = client.post(
        "/api/v1/user/promote", params={"user_id": guest["user"]["id"]}, headers={"authorization": auth}
    )
    assert response.status_code == 200

    new_admin = response.json()
    assert new_admin["id"] == guest["user"]["id"]
    assert new_admin["role"] == "admin"


def test_promote_fail_as_guest(guest, user):
    "Test that a guest cannot promote someone to admin"
    auth = f"bearer {guest['access_token']}"
    response = client.post(
        "/api/v1/user/promote", params={"user_id": user["user"]["id"]}, headers={"authorization": auth}
    )
    assert response.status_code == 401
    assert response.json() == {"detail": "Not an admin"}


def test_promote_fail_as_user(guest, user):
    "Test that a regular user cannot promote someone to admin"
    auth = f"bearer {user['access_token']}"
    response = client.post(
        "/api/v1/user/promote", params={"user_id": guest["user"]["id"]}, headers={"authorization": auth}
    )
    assert response.status_code == 401
    assert response.json() == {"detail": "Not an admin"}


def test_promote_invalid_to_admin(admin):
    "Test that an admin user cannot promote an invalid user id admin"
    auth = f"bearer {admin['access_token']}"
    response = client.post("/api/v1/user/promote", params={"user_id": 56}, headers={"authorization": auth})
    assert response.status_code == 400
    assert response.json() == {"detail": "Unknown user_id 56"}


def test_demote_from_admin(guest, admin):
    "Test that an admin user can demote someone from admin"
    auth = f"bearer {admin['access_token']}"
    response = client.post(
        "/api/v1/user/promote", params={"user_id": guest["user"]["id"]}, headers={"authorization": auth}
    )
    assert response.status_code == 200

    # Demote the old admin
    auth = f"bearer {guest['access_token']}"
    response = client.post(
        "/api/v1/user/demote", params={"user_id": admin["user"]["id"]}, headers={"authorization": auth}
    )
    assert response.status_code == 200

    old_admin_now_user = response.json()
    assert old_admin_now_user["id"] == admin["user"]["id"]
    assert old_admin_now_user["role"] == "user"


def test_demote_fail_as_guest(guest, admin):
    "Test that a guest cannot demote someone from admin"
    auth = f"bearer {guest['access_token']}"
    response = client.post(
        "/api/v1/user/demote", params={"user_id": admin["user"]["id"]}, headers={"authorization": auth}
    )
    assert response.status_code == 401
    assert response.json() == {"detail": "Not an admin"}


def test_demote_fail_as_user(user, admin):
    "Test that a regular user cannot demote someone from admin"
    auth = f"bearer {user['access_token']}"
    response = client.post(
        "/api/v1/user/demote", params={"user_id": admin["user"]["id"]}, headers={"authorization": auth}
    )
    assert response.status_code == 401
    assert response.json() == {"detail": "Not an admin"}


def test_demote_fail_from_guest(guest, admin):
    "Test that a guest cannot be _demoted_, equivalent to promotion to _user_"
    auth = f"bearer {admin['access_token']}"
    response = client.post(
        "/api/v1/user/demote", params={"user_id": guest["user"]["id"]}, headers={"authorization": auth}
    )
    assert response.status_code == 400
    assert response.json() == {"detail": f"User {guest['user']['id']} is not an admin"}


def test_demote_invalid_from_admin(admin):
    "Test that an admin user cannot promote an invalid user id admin"
    auth = f"bearer {admin['access_token']}"
    response = client.post("/api/v1/user/demote", params={"user_id": 56}, headers={"authorization": auth})
    assert response.status_code == 400
    assert response.json() == {"detail": "Unknown user_id 56"}


def test_new_user_no_projects(guest):
    "Test that a new user has no projects"
    auth = f"bearer {guest['access_token']}"
    response = client.get("/api/v1/user/", headers={"authorization": auth})
    assert response.status_code == 200

    assert response.json() == []
