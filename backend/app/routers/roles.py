"""Role endpoints: the jobs that candidates apply for."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.deps import get_session
from app.models import Role
from app.schemas import RoleCreate, RoleDetail, RoleSummary

router = APIRouter(prefix="/roles", tags=["roles"])

DUPLICATE_ROLE_MESSAGE = "A job with this name already exists"


def _is_duplicate_name(error: IntegrityError) -> bool:
    """True only when the failed insert broke the case-insensitive job name index. This matches SQLite's error text."""
    return "uq_roles_name_lower" in str(error.orig)


@router.get("", response_model=list[RoleSummary])
def list_roles(session: Session = Depends(get_session)) -> list[Role]:
    return list(session.scalars(select(Role).order_by(Role.name)))


@router.get("/{role_id}", response_model=RoleDetail)
def get_role(role_id: int, session: Session = Depends(get_session)) -> Role:
    role = session.get(Role, role_id)
    if role is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return role


@router.post("", status_code=201, response_model=RoleDetail)
def create_role(data: RoleCreate, session: Session = Depends(get_session)) -> Role:
    # Compare in lower case, so "back" and "Back" count as the same job.
    already_exists = session.scalar(
        select(Role.id).where(func.lower(Role.name) == func.lower(data.name))
    )
    if already_exists is not None:
        raise HTTPException(status_code=409, detail=DUPLICATE_ROLE_MESSAGE)

    role = Role(name=data.name, jd_text=data.jd_text)
    session.add(role)
    try:
        session.commit()
    except IntegrityError as error:
        session.rollback()
        if _is_duplicate_name(error):
            raise HTTPException(status_code=409, detail=DUPLICATE_ROLE_MESSAGE) from error
        raise

    session.refresh(role)
    return role
