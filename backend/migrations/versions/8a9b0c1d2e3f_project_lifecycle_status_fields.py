"""Add project lifecycle status metadata fields."""

from typing import Sequence, Union

from alembic import op

revision: str = "8a9b0c1d2e3f"
down_revision: Union[str, Sequence[str], None] = "7f8a9b0c1d2e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE projects ADD COLUMN IF NOT EXISTS status_reason VARCHAR(500);")
    op.execute("ALTER TABLE projects ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMP;")
    op.execute("ALTER TABLE projects ADD COLUMN IF NOT EXISTS closed_at DATE;")
    op.execute("UPDATE projects SET status = 'active' WHERE status = 'planned';")
    op.execute("ALTER TABLE projects ALTER COLUMN status SET DEFAULT 'active';")


def downgrade() -> None:
    op.execute("ALTER TABLE projects ALTER COLUMN status SET DEFAULT 'planned';")
    op.execute("ALTER TABLE projects DROP COLUMN IF EXISTS closed_at;")
    op.execute("ALTER TABLE projects DROP COLUMN IF EXISTS status_changed_at;")
    op.execute("ALTER TABLE projects DROP COLUMN IF EXISTS status_reason;")
