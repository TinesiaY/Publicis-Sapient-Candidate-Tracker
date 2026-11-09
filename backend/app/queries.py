"""Candidate queries: search, filters, sorting and stage counts.

The routes call these functions, so the rules for searching and sorting live in one place.
"""

from typing import Literal
from sqlalchemy import Select, case, func, or_, select
from sqlalchemy.orm import Session
from app.models import Candidate, Stage

SortOrder = Literal["added", "stage"]

def candidate_list_query(
    stage: Stage | None = None,
    role_id: int | None = None,
    search: str | None = None,
    sort: SortOrder = "added",
) -> Select:
    query = select(Candidate)

    if stage is not None:
        query = query.where(Candidate.stage == stage.value)

    if role_id is not None:
        query = query.where(Candidate.role_id == role_id)

    term = (search or "").strip()
    if term:
        # icontains ignores case. autoescape=True makes % and _ match literally.
        query = query.where(
            or_(
                Candidate.name.icontains(term, autoescape=True),
                Candidate.email.icontains(term, autoescape=True),
            )
        )

    if sort == "stage":
        # Pipeline order, not alphabetical: Applied first, Rejected last.
        stage_rank = case({s.value: rank for rank, s in enumerate(Stage)}, value=Candidate.stage)
        return query.order_by(stage_rank, Candidate.created_at.desc(), Candidate.id.desc())

    return query.order_by(Candidate.created_at.desc(), Candidate.id.desc())

def stage_counts(session: Session) -> dict[str, int]:
    """Count candidates in every stage. Stages with no candidates still appear, with 0."""
    counts = {stage.value: 0 for stage in Stage}
    rows = session.execute(select(Candidate.stage, func.count()).group_by(Candidate.stage)).all()
    for stage, count in rows:
        counts[stage] = count
    return counts