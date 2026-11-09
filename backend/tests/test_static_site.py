"""The built React site is served from the API's address. Page addresses get the site, the API stays under /api,
and files outside the site folder are never served."""

import pytest
from fastapi.testclient import TestClient

from app.db import make_session_factory
from app.main import create_app

SITE_TEXT = "candidate tracker site"


@pytest.fixture
def site(tmp_path):
    root = tmp_path / "dist"
    (root / "assets").mkdir(parents=True)
    (root / "index.html").write_text(f"<html>{SITE_TEXT}</html>", encoding="utf-8")
    (root / "assets" / "app.js").write_text("console.log('app')", encoding="utf-8")
    (tmp_path / "secret.txt").write_text("keep out", encoding="utf-8")
    return root


@pytest.fixture
def site_client(engine, executor, provider, site):
    app = create_app(
        session_factory=make_session_factory(engine),
        provider=provider,
        executor=executor,
        site_dir=site,
    )
    return TestClient(app)


def test_the_site_is_served_at_the_root(site_client):
    response = site_client.get("/")

    assert response.status_code == 200
    assert SITE_TEXT in response.text


def test_a_page_address_gets_the_site_so_a_refresh_works(site_client):
    response = site_client.get("/candidates/1")

    assert response.status_code == 200
    assert SITE_TEXT in response.text


def test_built_files_are_served(site_client):
    response = site_client.get("/assets/app.js")

    assert response.status_code == 200
    assert "console.log" in response.text


def test_the_api_answers_under_api(site_client):
    response = site_client.get("/api/candidates")

    assert response.status_code == 200
    assert response.json() == []


def test_an_unknown_api_address_is_a_404_not_the_site(site_client):
    response = site_client.get("/api/nothing-here")

    assert response.status_code == 404
    assert SITE_TEXT not in response.text


def test_health_still_answers(site_client):
    assert site_client.get("/health").json() == {"status": "ok"}


def test_files_outside_the_site_folder_are_not_served(site_client):
    response = site_client.get("/%2e%2e/secret.txt")

    assert "keep out" not in response.text


def test_without_a_build_the_api_still_runs(engine, executor, provider, tmp_path):
    app = create_app(
        session_factory=make_session_factory(engine),
        provider=provider,
        executor=executor,
        site_dir=tmp_path / "missing",
    )
    client = TestClient(app)

    assert client.get("/health").json() == {"status": "ok"}
    assert client.get("/").status_code == 404
