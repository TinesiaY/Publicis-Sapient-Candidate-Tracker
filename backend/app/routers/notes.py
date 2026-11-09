"""Note endpoints: add and list the notes on a candidate.

Notes are append-only. There are no edit or delete routes, so PUT and DELETE on this path return 405.
"""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import find_candidate, get_session
from app.models import Note
from app.schemas import NoteCreate, NoteRead

router = APIRouter(prefix="/candidates/{candidate_id}/notes", tags=["notes"])


@router.get("", response_model=list[NoteRead])
def list_notes(candidate_id: int, session: Session = Depends(get_session)) -> list[Note]:
    find_candidate(session, candidate_id)
    query = (
        select(Note)
        .where(Note.candidate_id == candidate_id)
        .order_by(Note.created_at.desc(), Note.id.desc())
    )
    return list(session.scalars(query))


@router.post("", status_code=201, response_model=NoteRead)
def add_note(
    candidate_id: int,
    data: NoteCreate,
    session: Session = Depends(get_session),
) -> Note:
    # Archived candidates can still get notes. The server sets created_at, not the client.
    find_candidate(session, candidate_id)
    note = Note(candidate_id=candidate_id, body=data.body)
    session.add(note)
    session.commit()
    session.refresh(note)
    return note
