"""Add dispatch status activity fields."""

from typing import Sequence, Union

from alembic import op

revision: str = "6e7f8091a2b3"
down_revision: Union[str, Sequence[str], None] = "4d5e6f708192"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE dispatch_orders ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMP NULL;")
    op.execute(
        "ALTER TABLE dispatch_orders ADD COLUMN IF NOT EXISTS status_changed_by INTEGER NULL REFERENCES users(id);"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_dispatch_orders_status_changed_by ON dispatch_orders(status_changed_by);"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_dispatch_orders_status_changed_by;")
    op.execute("ALTER TABLE dispatch_orders DROP COLUMN IF EXISTS status_changed_by;")
    op.execute("ALTER TABLE dispatch_orders DROP COLUMN IF EXISTS status_changed_at;")
