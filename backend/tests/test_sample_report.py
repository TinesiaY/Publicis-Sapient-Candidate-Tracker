"""The sample report is written from the database: one section per sample candidate, and failures are explained."""

from app.ai.fake import FakeProvider
from app.sample_report import write_report
from app.seed import CANDIDATES, main, run_seed_summaries, seed_database
from tests.helpers import valid_reply


def test_the_report_has_a_section_for_every_sample_candidate(engine, tmp_path):
    seed_database(engine)
    run_seed_summaries(engine, FakeProvider([valid_reply("A short summary.")] * len(CANDIDATES)))
    path = tmp_path / "sample-summaries.md"

    write_report(engine, path)

    text = path.read_text(encoding="utf-8")
    for candidate in CANDIDATES:
        assert f"## {candidate['name']}" in text
    assert "A short summary." in text
    assert "Status: ready" in text


def test_a_failed_summary_is_explained_in_the_report(engine, tmp_path):
    seed_database(engine)
    run_seed_summaries(engine, FakeProvider(["not json"] + [valid_reply()] * (len(CANDIDATES) - 1)))
    path = tmp_path / "sample-summaries.md"

    write_report(engine, path)

    text = path.read_text(encoding="utf-8")
    assert "Status: failed (invalid_output)" in text
    assert "The AI reply did not match the expected format." in text


def test_the_report_command_writes_the_file_without_a_key(engine, tmp_path, monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    seed_database(engine)
    path = tmp_path / "out.md"

    exit_code = main(["--report", str(path)], engine=engine)

    assert exit_code == 0
    assert "## Ann Tan" in path.read_text(encoding="utf-8")
