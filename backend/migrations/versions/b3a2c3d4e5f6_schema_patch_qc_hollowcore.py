"""Schema patching needed for QC/hollowcore dev builds.

This was previously done via startup-time SQL in ``backend/app/main.py``.
We moved it into a one-time Alembic migration so schema updates are explicit
and repeatable.
"""

from typing import Sequence, Union

from alembic import op

revision: str = "b3a2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "5a5c04ac6d32"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Project weekend flags.
    op.execute("ALTER TABLE projects ADD COLUMN IF NOT EXISTS work_saturday BOOLEAN NOT NULL DEFAULT FALSE")
    op.execute("ALTER TABLE projects ADD COLUMN IF NOT EXISTS work_sunday BOOLEAN NOT NULL DEFAULT FALSE")

    # Element fields used by QC and hollowcore planner.
    op.execute("ALTER TABLE elements ADD COLUMN IF NOT EXISTS concrete_strength_mpa INTEGER")
    op.execute("ALTER TABLE elements ADD COLUMN IF NOT EXISTS requires_cubes BOOLEAN NOT NULL DEFAULT FALSE")
    op.execute("ALTER TABLE elements ADD COLUMN IF NOT EXISTS mix_design_id INTEGER")
    op.execute("ALTER TABLE elements ADD COLUMN IF NOT EXISTS panel_length_mm INTEGER")
    op.execute("ALTER TABLE elements ADD COLUMN IF NOT EXISTS slab_thickness_mm INTEGER")

    # FK for elements.mix_design_id.
    op.execute(
        """
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_elements_mix_design_id'
    ) THEN
        ALTER TABLE elements
        ADD CONSTRAINT fk_elements_mix_design_id
        FOREIGN KEY (mix_design_id) REFERENCES mix_designs(id) ON DELETE SET NULL;
    END IF;
END
$$;
        """
    )

    # QC table fields.
    op.execute("ALTER TABLE quality_tests ADD COLUMN IF NOT EXISTS batch_id VARCHAR(50)")
    op.execute("ALTER TABLE quality_tests ADD COLUMN IF NOT EXISTS age_days INTEGER")
    op.execute("ALTER TABLE quality_tests ADD COLUMN IF NOT EXISTS measured_strength_mpa DOUBLE PRECISION")
    op.execute("ALTER TABLE quality_tests ADD COLUMN IF NOT EXISTS required_strength_mpa INTEGER")
    op.execute("ALTER TABLE quality_tests ADD COLUMN IF NOT EXISTS passed BOOLEAN")
    op.execute("ALTER TABLE quality_tests ADD COLUMN IF NOT EXISTS cube1_weight_kg DOUBLE PRECISION")
    op.execute("ALTER TABLE quality_tests ADD COLUMN IF NOT EXISTS cube1_strength_mpa DOUBLE PRECISION")
    op.execute("ALTER TABLE quality_tests ADD COLUMN IF NOT EXISTS cube2_weight_kg DOUBLE PRECISION")
    op.execute("ALTER TABLE quality_tests ADD COLUMN IF NOT EXISTS cube2_strength_mpa DOUBLE PRECISION")
    op.execute("ALTER TABLE quality_tests ADD COLUMN IF NOT EXISTS cube3_weight_kg DOUBLE PRECISION")
    op.execute("ALTER TABLE quality_tests ADD COLUMN IF NOT EXISTS cube3_strength_mpa DOUBLE PRECISION")
    op.execute("ALTER TABLE quality_tests ADD COLUMN IF NOT EXISTS avg_strength_mpa DOUBLE PRECISION")
    op.execute("ALTER TABLE quality_tests ADD COLUMN IF NOT EXISTS mix_design_id INTEGER")

    # FK for quality_tests.mix_design_id.
    op.execute(
        """
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_quality_tests_mix_design_id'
    ) THEN
        ALTER TABLE quality_tests
        ADD CONSTRAINT fk_quality_tests_mix_design_id
        FOREIGN KEY (mix_design_id) REFERENCES mix_designs(id) ON DELETE SET NULL;
    END IF;
END
$$;
        """
    )


def downgrade() -> None:
    # FKs first.
    op.execute("ALTER TABLE elements DROP CONSTRAINT IF EXISTS fk_elements_mix_design_id")
    op.execute("ALTER TABLE quality_tests DROP CONSTRAINT IF EXISTS fk_quality_tests_mix_design_id")

    # Columns (safe for dev; only used if you intentionally downgrade).
    op.execute("ALTER TABLE projects DROP COLUMN IF EXISTS work_saturday")
    op.execute("ALTER TABLE projects DROP COLUMN IF EXISTS work_sunday")

    op.execute("ALTER TABLE elements DROP COLUMN IF EXISTS concrete_strength_mpa")
    op.execute("ALTER TABLE elements DROP COLUMN IF EXISTS requires_cubes")
    op.execute("ALTER TABLE elements DROP COLUMN IF EXISTS mix_design_id")
    op.execute("ALTER TABLE elements DROP COLUMN IF EXISTS panel_length_mm")
    op.execute("ALTER TABLE elements DROP COLUMN IF EXISTS slab_thickness_mm")

    op.execute("ALTER TABLE quality_tests DROP COLUMN IF EXISTS batch_id")
    op.execute("ALTER TABLE quality_tests DROP COLUMN IF EXISTS age_days")
    op.execute("ALTER TABLE quality_tests DROP COLUMN IF EXISTS measured_strength_mpa")
    op.execute("ALTER TABLE quality_tests DROP COLUMN IF EXISTS required_strength_mpa")
    op.execute("ALTER TABLE quality_tests DROP COLUMN IF EXISTS passed")
    op.execute("ALTER TABLE quality_tests DROP COLUMN IF EXISTS cube1_weight_kg")
    op.execute("ALTER TABLE quality_tests DROP COLUMN IF EXISTS cube1_strength_mpa")
    op.execute("ALTER TABLE quality_tests DROP COLUMN IF EXISTS cube2_weight_kg")
    op.execute("ALTER TABLE quality_tests DROP COLUMN IF EXISTS cube2_strength_mpa")
    op.execute("ALTER TABLE quality_tests DROP COLUMN IF EXISTS cube3_weight_kg")
    op.execute("ALTER TABLE quality_tests DROP COLUMN IF EXISTS cube3_strength_mpa")
    op.execute("ALTER TABLE quality_tests DROP COLUMN IF EXISTS avg_strength_mpa")
    op.execute("ALTER TABLE quality_tests DROP COLUMN IF EXISTS mix_design_id")

