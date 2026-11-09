"""Role endpoints: the roles a candidate can apply for."""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import get_session
from app.models import Role
from app.schemas import RoleSummary

router = APIRouter(prefix="/roles", tags=["roles"])


@router.get("", response_model=list[RoleSummary])
def list_roles(session: Session = Depends(get_session)) -> list[Role]:
    return list(session.scalars(select(Role).order_by(Role.name)))
