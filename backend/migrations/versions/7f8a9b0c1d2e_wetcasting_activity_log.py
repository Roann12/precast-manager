"""Add wetcasting activity log table."""

from typing import Sequence, Union

from alembic import op

revision: str = "7f8a9b0c1d2e"
down_revision: Union[str, Sequence[str], None] = "6e7f8091a2b3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS wetcasting_activity (
            id SERIAL PRIMARY KEY,
            factory_id INTEGER NULL REFERENCES factories(id),
            user_id INTEGER NOT NULL REFERENCES users(id),
            section VARCHAR(50) NOT NULL,
            action VARCHAR(80) NOT NULL,
            entity_type VARCHAR(50) NULL,
            entity_id INTEGER NULL,
            details JSON NULL,
            created_at TIMESTAMP NOT NULL DEFAULT NOW()
        );
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_wetcasting_activity_factory_id ON wetcasting_activity(factory_id);"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_wetcasting_activity_user_id ON wetcasting_activity(user_id);"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_wetcasting_activity_section ON wetcasting_activity(section);"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_wetcasting_activity_created_at ON wetcasting_activity(created_at);"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_wetcasting_activity_factory_created ON wetcasting_activity(factory_id, created_at);"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_wetcasting_activity_factory_created;")
    op.execute("DROP INDEX IF EXISTS ix_wetcasting_activity_created_at;")
    op.execute("DROP INDEX IF EXISTS ix_wetcasting_activity_section;")
    op.execute("DROP INDEX IF EXISTS ix_wetcasting_activity_user_id;")
    op.execute("DROP INDEX IF EXISTS ix_wetcasting_activity_factory_id;")
    op.execute("DROP TABLE IF EXISTS wetcasting_activity;")
