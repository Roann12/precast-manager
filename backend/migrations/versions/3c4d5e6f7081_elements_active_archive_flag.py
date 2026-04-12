"""Add active flag to elements for archiving."""

from typing import Sequence, Union

from alembic import op

revision: str = "3c4d5e6f7081"
down_revision: Union[str, Sequence[str], None] = "2b3c4d5e6f70"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE elements ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;")
    op.execute("CREATE INDEX IF NOT EXISTS ix_elements_active ON elements(active);")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_elements_active;")
    op.execute("ALTER TABLE elements DROP COLUMN IF EXISTS active;")

