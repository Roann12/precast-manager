from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
import secrets
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_factory_id, get_current_user, require_role
from ..auth.jwt import create_access_token
from ..core.security import get_password_hash, verify_password
from ..database import get_db
from ..models.factory import Factory
from ..models.user import User
from ..rate_limit import limiter


auth_router = APIRouter(prefix="/auth", tags=["auth"])


class AuthUserOut(BaseModel):
    id: int
    name: str
    email: str
    role: str
    factory_id: int | None
    must_change_password: bool = False
    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: AuthUserOut


@auth_router.post("/token", response_model=TokenResponse)
@limiter.limit("30/minute")
def login_for_access_token(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if not verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    access_token = create_access_token({"sub": str(user.id)})
    return TokenResponse(
        access_token=access_token,
        user=AuthUserOut(
            id=user.id,
            name=user.name,
            email=user.email,
            role=user.role,
            factory_id=user.factory_id,
            must_change_password=bool(getattr(user, "must_change_password", False)),
        ),
    )


@auth_router.get("/me", response_model=AuthUserOut)
def me(current_user: User = Depends(get_current_user)):
    return AuthUserOut(
        id=current_user.id,
        name=current_user.name,
        email=current_user.email,
        role=current_user.role,
        factory_id=current_user.factory_id,
        must_change_password=bool(getattr(current_user, "must_change_password", False)),
    )


class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str


@auth_router.post("/change-password")
def change_password(
    body: ChangePasswordIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not verify_password(body.current_password, current_user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")
    if not body.new_password or len(body.new_password) < 8:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="New password must be at least 8 characters")
    current_user.password_hash = get_password_hash(body.new_password)
    current_user.must_change_password = False
    db.commit()
    return {"message": "Password updated"}


admin_router = APIRouter(prefix="/admin", tags=["admin"])


class FactoryOut(BaseModel):
    id: int
    name: str
    is_active: bool

    class Config:
        from_attributes = True


class CreateUserIn(BaseModel):
    name: str
    email: str
    password: str
    role: str
    factory_id: int


class ResetPasswordOut(BaseModel):
    user_id: int
    temporary_password: str


@admin_router.get("/factories", response_model=list[FactoryOut])
def list_factories_for_admin(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin"])),
):
    # If the admin has no factory_id, treat them as a "super admin"
    # who can view all factories.
    if current_user.factory_id is None:
        return db.query(Factory).order_by(Factory.id).all()

    return db.query(Factory).filter(Factory.id == current_user.factory_id).all()


@admin_router.get("/users")
def list_users_for_admin(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")

    if current_user.factory_id is None:
        users = db.query(User).order_by(User.id).all()
    else:
        users = (
            db.query(User)
            .filter(User.factory_id == current_user.factory_id)
            .order_by(User.id)
            .all()
        )

    return [
        {
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "role": u.role,
            "factory_id": u.factory_id,
            "created_at": u.created_at,
        }
        for u in users
    ]


@admin_router.post("/users", status_code=201)
def create_user_for_admin(
    body: CreateUserIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")

    if current_user.factory_id is not None and body.factory_id != current_user.factory_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot create users in a different factory")

    existing = db.query(User).filter(User.email == body.email).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already exists")

    u = User(
        name=body.name,
        email=body.email,
        password_hash=get_password_hash(body.password),
        role=body.role,
        factory_id=body.factory_id,
        must_change_password=True,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return {
        "id": u.id,
        "name": u.name,
        "email": u.email,
        "role": u.role,
        "factory_id": u.factory_id,
        "created_at": u.created_at,
    }


@admin_router.post("/users/{user_id}/reset-password", response_model=ResetPasswordOut)
def reset_user_password(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin"])),
):
    # Only super admin can reset passwords across factories.
    if current_user.factory_id is not None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only super admin can reset passwords")

    u = db.get(User, user_id)
    if not u:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if u.factory_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot reset super admin password here")

    temp_pw = secrets.token_urlsafe(12)
    u.password_hash = get_password_hash(temp_pw)
    u.must_change_password = True
    db.commit()
    return ResetPasswordOut(user_id=u.id, temporary_password=temp_pw)


class CreateFactoryOnboardingIn(BaseModel):
    factory_name: str
    admin_name: str
    admin_email: str
    admin_password: str


@admin_router.post("/factories/onboard", status_code=201)
def onboard_factory(
    body: CreateFactoryOnboardingIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin"])),
):
    # Only super admin can create new factories.
    if current_user.factory_id is not None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only super admin can onboard factories")

    existing_factory = db.query(Factory).filter(Factory.name == body.factory_name).first()
    if existing_factory:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Factory name already exists")

    existing_user = db.query(User).filter(User.email == body.admin_email).first()
    if existing_user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Admin email already exists")

    factory = Factory(name=body.factory_name, is_active=True)
    db.add(factory)
    db.commit()
    db.refresh(factory)

    admin_user = User(
        name=body.admin_name,
        email=body.admin_email,
        password_hash=get_password_hash(body.admin_password),
        role="admin",
        factory_id=factory.id,
    )
    db.add(admin_user)
    db.commit()
    db.refresh(admin_user)

    return {
        "factory": {
            "id": factory.id,
            "name": factory.name,
            "is_active": factory.is_active,
        },
        "admin_user": {
            "id": admin_user.id,
            "name": admin_user.name,
            "email": admin_user.email,
            "role": admin_user.role,
            "factory_id": admin_user.factory_id,
            "created_at": admin_user.created_at,
        },
    }


@admin_router.post("/factories/{factory_id}/suspend")
def suspend_factory(
    factory_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin"])),
):
    if current_user.factory_id is not None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only super admin can suspend factories")

    factory = db.query(Factory).filter(Factory.id == factory_id).first()
    if not factory:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Factory not found")

    factory.is_active = False
    db.commit()
    return {"message": "Factory suspended"}


@admin_router.post("/factories/{factory_id}/reactivate")
def reactivate_factory(
    factory_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin"])),
):
    if current_user.factory_id is not None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only super admin can reactivate factories")

    factory = db.query(Factory).filter(Factory.id == factory_id).first()
    if not factory:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Factory not found")

    factory.is_active = True
    db.commit()
    return {"message": "Factory reactivated"}

