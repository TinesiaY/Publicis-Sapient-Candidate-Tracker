"""Idempotent seed script: roles and candidates for local development.

Run from the backend folder:

    uv run python -m app.seed

Running it again changes nothing, because duplicate rows are skipped.
"""

from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.engine import Engine

from app.db import DB_PATH, Base, make_engine, make_session_factory
from app.models import Candidate, Role

# Placeholder data.
ROLES = [
    {"name": "Backend Engineer", "jd_text": "Build and maintain Python APIs."},
    {"name": "Frontend Engineer", "jd_text": "Build React interfaces in TypeScript."},
]

CANDIDATES = [
    {
        "name": "Ann Tan",
        "email": "ann.tan@example.com",
        "phone": "+61 123 456 789",
        "role": "Backend Engineer",
        "source": "Referral",
        "stage": "Applied",
        "resume_text": """
            Ann Tan
            Software Engineer (Full-Stack)
            Melbourne, Australia

            PROFILE
            Full-stack software engineer with 2 years of experience building web applications in Python and TypeScript. Comfortable across the stack, from React interfaces and FastAPI services to PostgreSQL schemas and automated tests. Most interested in internal tools and data-heavy products where clear validation and reliable reporting matter.

            EXPERIENCE

            Software Engineer, Northwind Logistics
            March 2024 - present
            - Built and maintain a shipment tracking dashboard in React and TypeScript, used daily by about 120 dispatch staff.
            - Reduced average page load time by 35 percent by splitting the bundle, lazy-loading routes and caching API responses on the client.
            - Developed REST endpoints with FastAPI and SQLAlchemy for shipment status updates, including input validation, pagination and role-based access checks.
            - Led the migration of a legacy Flask service to FastAPI, moving 14 endpoints with no change to client contracts and no downtime during cutover.
            - Raised backend test coverage on the booking module from 40 percent to 78 percent over three months by adding pytest unit and integration tests.
            - Worked with the operations team to write acceptance criteria for new features and ran weekly demos to collect feedback before release.

            Junior Developer (Internship), Brightpath Digital
            June 2023 - December 2023
            - Contributed to a client marketing site built with Next.js and Tailwind CSS, shipping six landing pages on schedule.
            - Built a Python CSV import tool that cleaned and validated 50,000+ customer records per run, saving the team roughly 10 hours of manual entry each week.
            - Fixed accessibility issues in forms and navigation, bringing the audited pages to WCAG 2.1 AA.
            - Documented deployment steps in the team wiki and onboarded two new interns.

            PROJECTS

            Course Scheduler (personal project, 2023)
            - Web app that generates conflict-free timetables from university course data.
            - Python FastAPI backend, React frontend, PostgreSQL for storage, deployed on a small cloud VM with Docker Compose.
            - Wrote the constraint-solving logic and its unit tests, with a small set of integration tests for the API.

            Open-source contributor, React component library
            - Merged three pull requests, including a keyboard navigation fix for dropdown menus.

            EDUCATION
            Bachelor of Information Technology (Software Engineering), Monash University, 2020 - 2023
            - Relevant coursework: data structures, databases, software testing, human-computer interaction, cloud computing.

            SKILLS
            Languages: Python, TypeScript, JavaScript, SQL, HTML, CSS
            Frameworks and tools: React, Vite, Tailwind CSS, FastAPI, SQLAlchemy, Next.js, pytest, Vitest, Git, Docker
            Databases: PostgreSQL, SQLite, MongoDB (basic)
            Practices: REST API design, unit and integration testing, code review, agile delivery

            CERTIFICATIONS
            AWS Certified Cloud Practitioner (2024)

            LANGUAGES
            English (native), Mandarin (conversational)

            VOLUNTEERING
            Coding mentor, library after-school club (2023 - present). Teach primary school students to build simple games in Scratch and Python.
            """,
    },
    {
        "name": "Ben Lee",
        "email": "ben.lee@example.com",
        "role": "Frontend Engineer",
        "source": "LinkedIn",
        "stage": "Screening",
        # Deliberately short: short resumes must still be accepted.
        "resume_text": "Front-end developer, 1 year. React, TypeScript.",
    },
    # Archived samples. They are hidden from Candidates and shown on the Archive page.
    # Each keeps its stage, and archived_at is the time it was archived.
    {
        "name": "Charlotte Lee",
        "email": "charlotte.lee@example.com",
        "role": "Frontend Engineer",
        "source": "Careers page",
        "stage": "Rejected",
        "resume_text": "Frontend developer, 3 years. React, accessibility, design systems.",
        "archived_at": datetime(2026, 11, 7, 10, 30, tzinfo=timezone.utc),
    },
    {
        "name": "Marcus Johnson",
        "email": "marcus.johnson@example.com",
        "role": "Backend Engineer",
        "source": "Wellfound",
        "stage": "Interview",
        "resume_text": "Backend developer, 4 years. Python, PostgreSQL, message queues.",
        "archived_at": datetime(2026, 11, 6, 9, 15, tzinfo=timezone.utc),
    },
    {
        "name": "Grace Park",
        "email": "grace.park@example.com",
        "role": "Frontend Engineer",
        "source": "LinkedIn",
        "stage": "Applied",
        "resume_text": "Junior front-end developer. HTML, CSS, JavaScript.",
        "archived_at": datetime(2026, 11, 4, 14, 0, tzinfo=timezone.utc),
    },
]


def seed_database(engine: Engine) -> None:
    """Create the tables if needed, then insert the seed rows. Safe to run more than once."""
    Base.metadata.create_all(engine)

    session_factory = make_session_factory(engine)
    with session_factory() as session:
        for row in ROLES:
            session.execute(
                # Job names are unique ignoring case, so skip any conflict rather than naming one column.
                sqlite_insert(Role).values(**row).on_conflict_do_nothing()
            )

        for row in CANDIDATES:
            role_id = session.scalar(select(Role.id).where(Role.name == row["role"]))
            values = {key: value for key, value in row.items() if key != "role"}
            values["role_id"] = role_id
            session.execute(
                sqlite_insert(Candidate)
                .values(**values)
                .on_conflict_do_nothing(index_elements=["email", "role_id"])
            )

        session.commit()


def count_rows(engine: Engine) -> tuple[int, int]:
    session_factory = make_session_factory(engine)
    with session_factory() as session:
        roles = session.scalar(select(func.count()).select_from(Role))
        candidates = session.scalar(select(func.count()).select_from(Candidate))
    return roles, candidates


def main() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    engine = make_engine()
    seed_database(engine)
    roles, candidates = count_rows(engine)
    print(f"Database: {DB_PATH}")
    print(f"Roles: {roles}, candidates: {candidates}")


if __name__ == "__main__":
    main()
