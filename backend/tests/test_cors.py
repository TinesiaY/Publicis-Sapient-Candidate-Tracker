"""CORS: the React dev server is allowed to call the API, and other origins are not."""


def test_frontend_origin_is_allowed(client):
    response = client.options(
        "/candidates",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"


def test_other_origins_are_not_allowed(client):
    response = client.options(
        "/candidates",
        headers={
            "Origin": "https://example.com",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert "access-control-allow-origin" not in response.headers
