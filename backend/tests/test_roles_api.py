"""Role API tests: the list that fills the role dropdown in the frontend."""


def test_list_roles_returns_id_and_name_ordered_by_name(client, role_ids):
    response = client.get("/roles")

    assert response.status_code == 200
    rows = response.json()
    assert [row["name"] for row in rows] == ["Backend Engineer", "Frontend Engineer"]
    assert rows[0]["id"] == role_ids["backend"]
    assert set(rows[0]) == {"id", "name"}
