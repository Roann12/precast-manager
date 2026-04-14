# File overview: Business logic services for app/services/seed.py.
from sqlalchemy import func
from sqlalchemy.orm import Session
from datetime import date

from ..core.security import get_password_hash
from ..models.factory import Factory
from ..models.project import Project
from ..models.user import User
from ..models.element import Element
from ..models.mould import Mould
from ..models.yard_location import YardLocation
from ..models.production import ProductionSchedule
from ..models.hollowcore_cast import HollowcoreCast


# Handles seed demo data flow.
def seed_demo_data(db: Session):
    """
    Seed some demo data so dashboard/Hollowcore/QC screens have something to show.

    This is intentionally idempotent: it creates missing rows but won't duplicate
    production/hollowcore entries for the same day.
    """

    today = date.today()

    # -----------------------
    # Factory
    # -----------------------
    factory = db.query(Factory).filter(Factory.name == "Factory A").first()
    if not factory:
        factory = Factory(name="Factory A")
        db.add(factory)
        db.commit()
        db.refresh(factory)

    # -----------------------
    # Users (demo login)
    # -----------------------
    demo_users = [
        ("Admin", "admin@local", "admin123", "admin"),
        ("Planner", "planner@local", "planner123", "planner"),
        ("Production", "production@local", "production123", "production"),
        ("Yard", "yard@local", "yard123", "yard"),
        ("Dispatch", "dispatch@local", "dispatch123", "dispatch"),
        ("QC", "qc@local", "qc123", "QC"),
        ("Viewer", "viewer@local", "viewer123", "viewer"),
    ]
    for name, email, password, role in demo_users:
        u = db.query(User).filter(func.lower(User.email) == email.lower()).first()
        if not u:
            u = User(
                name=name,
                email=email,
                password_hash=get_password_hash(password),
                role=role,
                factory_id=factory.id,
                must_change_password=False,
            )
            db.add(u)
        else:
            # Keep demo user in sync for development.
            u.factory_id = factory.id
            u.role = role
            u.name = name
    db.commit()

    # -----------------------
    # Super admin (system-level factory management)
    # -----------------------
    super_email = "superadmin@local"
    super_password = "superadmin123"
    super_user = db.query(User).filter(func.lower(User.email) == super_email.lower()).first()
    if not super_user:
        db.add(
            User(
                name="Super Admin",
                email=super_email,
                password_hash=get_password_hash(super_password),
                role="admin",
                factory_id=None,
                must_change_password=False,
            )
        )
        db.commit()
    else:
        # Ensure it stays a true super admin.
        super_user.factory_id = None
        super_user.role = "admin"
        super_user.password_hash = get_password_hash(super_password)
        super_user.name = "Super Admin"
        super_user.must_change_password = False
        db.commit()

    # -----------------------
    # Project (ensure exists)
    # -----------------------
    project = db.query(Project).filter(Project.project_name == "Demo Bridge Project").first()
    if not project:
        project = Project(
            project_name="Demo Bridge Project",
            client="City Council",
            start_date=today,
            status="active",
            factory_id=factory.id,
        )
        db.add(project)
        db.commit()
        db.refresh(project)
    elif project.factory_id is None:
        project.factory_id = factory.id
        db.commit()

    # -----------------------
    # Elements (ensure exists)
    # -----------------------
    element_specs = [
        {
            "element_type": "Column",
            "element_mark": "C1",
            "quantity": 12,
            "volume": 0.85,
            "status": "scheduled",
        },
        {
            "element_type": "Beam",
            "element_mark": "B5",
            "quantity": 8,
            "volume": 1.2,
            "status": "planned",
        },
        # Hollowcore panel example (drives Hollowcore bucket + today units).
        {
            "element_type": "Wall",
            "element_mark": "W3",
            "quantity": 6,
            "volume": 2.1,
            "status": "planned",
            "panel_length_mm": 6000,
            "slab_thickness_mm": 200,
        },
    ]

    existing_marks = {
        m[0]
        for m in db.query(Element.element_mark)
        .filter(Element.project_id == project.id)
        .all()
    }
    for spec in element_specs:
        if spec["element_mark"] in existing_marks:
            continue
        db.add(
            Element(
                project_id=project.id,
                factory_id=factory.id,
                element_type=spec["element_type"],
                element_mark=spec["element_mark"],
                quantity=spec["quantity"],
                volume=spec.get("volume"),
                status=spec.get("status"),
                panel_length_mm=spec.get("panel_length_mm"),
                slab_thickness_mm=spec.get("slab_thickness_mm"),
            )
        )
    db.commit()

    # Ensure all existing elements for the project have factory_id set.
    for e in db.query(Element).filter(Element.project_id == project.id).all():
        if e.factory_id is None:
            e.factory_id = factory.id
    db.commit()

    elements_by_mark = {
        e.element_mark: e
        for e in db.query(Element).filter(Element.project_id == project.id).all()
    }

    # -----------------------
    # Moulds (ensure exists)
    # -----------------------
    mould_specs = [
        ("Column Mould 1", "Column", 6, 24),
        ("Beam Mould 1", "Beam", 4, 24),
        ("Wall Mould 1", "Wall", 2, 24),
    ]
    existing_mould_names = {m[0] for m in db.query(Mould.name).all()}
    for name, mould_type, capacity, cycle_time_hours in mould_specs:
        if name in existing_mould_names:
            continue
        db.add(
            Mould(
                factory_id=factory.id,
                name=name,
                mould_type=mould_type,
                capacity=capacity,
                cycle_time_hours=cycle_time_hours,
                active=True,
            )
        )
    db.commit()

    # Ensure existing moulds have factory_id set.
    for m in db.query(Mould).filter(Mould.name.in_([x[0] for x in mould_specs])).all():
        if m.factory_id is None:
            m.factory_id = factory.id
    db.commit()

    moulds_by_type = {m.mould_type: m for m in db.query(Mould).all()}

    # -----------------------
    # Yard Locations (ensure exists)
    # -----------------------
    location_specs = [
        ("A1", "Near crane"),
        ("B1", "North storage"),
        ("C1", "Transport loading zone"),
    ]
    existing_location_names = {l[0] for l in db.query(YardLocation.name).all()}
    for name, desc in location_specs:
        if name in existing_location_names:
            continue
        db.add(YardLocation(name=name, description=desc))
    db.commit()

    # -----------------------
    # ProductionSchedule (drives dashboard "today")
    # -----------------------
    if not db.query(ProductionSchedule).filter(
        ProductionSchedule.production_date == today,
        ProductionSchedule.factory_id == factory.id,
    ).first():
        col = elements_by_mark.get("C1")
        beam = elements_by_mark.get("B5")
        if col and moulds_by_type.get("Column"):
            db.add(
                ProductionSchedule(
                    element_id=col.id,
                    mould_id=moulds_by_type["Column"].id,
                    factory_id=factory.id,
                    production_date=today,
                    quantity=10,
                    batch_id="COL-TODAY",
                    status="completed",
                )
            )
        if beam and moulds_by_type.get("Beam"):
            db.add(
                ProductionSchedule(
                    element_id=beam.id,
                    mould_id=moulds_by_type["Beam"].id,
                    factory_id=factory.id,
                    production_date=today,
                    quantity=6,
                    batch_id="BEAM-TODAY",
                    status="planned",
                )
            )
        db.commit()

    # -----------------------
    # HollowcoreCast (drives dashboard + Hollowcore bucket)
    # -----------------------
    wall = elements_by_mark.get("W3")
    if wall:
        cast_exists = (
            db.query(HollowcoreCast)
            .filter(HollowcoreCast.cast_date == today, HollowcoreCast.element_id == wall.id)
            .first()
        )
        if not cast_exists:
            db.add(
                HollowcoreCast(
                    element_id=wall.id,
                    cast_date=today,
                    bed_number=1,
                    cast_slot_index=0,
                    slab_thickness_mm=wall.slab_thickness_mm or 200,
                    panel_length_mm=wall.panel_length_mm or 6000,
                    quantity=6,
                    batch_id="HC-W3-TODAY",
                    status="completed",
                )
            )
            db.commit()

    return {"message": "Demo data created/updated successfully"}