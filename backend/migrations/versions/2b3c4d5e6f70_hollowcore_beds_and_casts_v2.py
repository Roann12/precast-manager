"""Add hollowcore beds and v2 cast fields.

This migration introduces factory-scoped hollowcore beds and extends hollowcore casts
to support bed_id-based planning and reporting.
"""

from typing import Sequence, Union

from alembic import op

revision: str = "2b3c4d5e6f70"
down_revision: Union[str, Sequence[str], None] = "1a2b3c4d5e6f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Beds
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS hollowcore_beds (
          id SERIAL PRIMARY KEY,
          factory_id INTEGER NULL REFERENCES factories(id),
          name VARCHAR(120) NOT NULL,
          length_mm INTEGER NOT NULL,
          max_casts_per_day INTEGER NOT NULL,
          active BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        );
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_hollowcore_beds_factory_id ON hollowcore_beds(factory_id);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_hollowcore_beds_active ON hollowcore_beds(active);")

    # Casts (extend existing table)
    op.execute("ALTER TABLE hollowcore_casts ADD COLUMN IF NOT EXISTS factory_id INTEGER NULL REFERENCES factories(id);")
    op.execute("ALTER TABLE hollowcore_casts ADD COLUMN IF NOT EXISTS bed_id INTEGER NULL REFERENCES hollowcore_beds(id);")
    op.execute("ALTER TABLE hollowcore_casts ADD COLUMN IF NOT EXISTS used_length_mm INTEGER NULL;")
    op.execute("ALTER TABLE hollowcore_casts ADD COLUMN IF NOT EXISTS waste_mm INTEGER NULL;")
    op.execute("ALTER TABLE hollowcore_casts ADD COLUMN IF NOT EXISTS created_by INTEGER NULL REFERENCES users(id);")

    # Keep status values flexible; application enforces planned|cast|completed.
    op.execute("ALTER TABLE hollowcore_casts ALTER COLUMN status SET DEFAULT 'planned';")

    op.execute("CREATE INDEX IF NOT EXISTS ix_hollowcore_casts_factory_id ON hollowcore_casts(factory_id);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_hollowcore_casts_bed_id ON hollowcore_casts(bed_id);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_hollowcore_casts_status ON hollowcore_casts(status);")

    # New uniqueness constraint (date, bed_id, slot). Leave legacy bed_number index intact if present.
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS ix_hollowcore_casts_unique_slot_v2
        ON hollowcore_casts(cast_date, bed_id, cast_slot_index)
        WHERE bed_id IS NOT NULL;
        """
    )

    # Settings (extend existing table)
    op.execute("ALTER TABLE hollowcore_settings ADD COLUMN IF NOT EXISTS default_waste_mm INTEGER NULL;")
    op.execute("ALTER TABLE hollowcore_settings ADD COLUMN IF NOT EXISTS default_casts_per_day INTEGER NULL;")


def downgrade() -> None:
    # Settings
    op.execute("ALTER TABLE hollowcore_settings DROP COLUMN IF EXISTS default_casts_per_day;")
    op.execute("ALTER TABLE hollowcore_settings DROP COLUMN IF EXISTS default_waste_mm;")

    # Casts (best-effort; keep old columns if used elsewhere)
    op.execute("DROP INDEX IF EXISTS ix_hollowcore_casts_unique_slot_v2;")
    op.execute("DROP INDEX IF EXISTS ix_hollowcore_casts_status;")
    op.execute("DROP INDEX IF EXISTS ix_hollowcore_casts_bed_id;")
    op.execute("DROP INDEX IF EXISTS ix_hollowcore_casts_factory_id;")
    op.execute("ALTER TABLE hollowcore_casts DROP COLUMN IF EXISTS created_by;")
    op.execute("ALTER TABLE hollowcore_casts DROP COLUMN IF EXISTS waste_mm;")
    op.execute("ALTER TABLE hollowcore_casts DROP COLUMN IF EXISTS used_length_mm;")
    op.execute("ALTER TABLE hollowcore_casts DROP COLUMN IF EXISTS bed_id;")
    op.execute("ALTER TABLE hollowcore_casts DROP COLUMN IF EXISTS factory_id;")

    # Beds
    op.execute("DROP TABLE IF EXISTS hollowcore_beds;")

