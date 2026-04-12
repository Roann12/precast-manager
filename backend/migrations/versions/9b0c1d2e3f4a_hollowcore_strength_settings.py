"""Add hollowcore cutting/final strength settings."""

from typing import Sequence, Union

from alembic import op

revision: str = "9b0c1d2e3f4a"
down_revision: Union[str, Sequence[str], None] = "8a9b0c1d2e3f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE hollowcore_settings ADD COLUMN IF NOT EXISTS cutting_strength_mpa INTEGER;")
    op.execute("ALTER TABLE hollowcore_settings ADD COLUMN IF NOT EXISTS final_strength_mpa INTEGER;")
    op.execute("UPDATE hollowcore_settings SET cutting_strength_mpa = COALESCE(cutting_strength_mpa, 15);")
    op.execute("UPDATE hollowcore_settings SET final_strength_mpa = COALESCE(final_strength_mpa, 30);")


def downgrade() -> None:
    op.execute("ALTER TABLE hollowcore_settings DROP COLUMN IF EXISTS final_strength_mpa;")
    op.execute("ALTER TABLE hollowcore_settings DROP COLUMN IF EXISTS cutting_strength_mpa;")
