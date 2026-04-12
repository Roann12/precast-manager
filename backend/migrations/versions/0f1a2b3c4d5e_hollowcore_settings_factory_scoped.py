"""Factory scoping for hollowcore settings."""

from typing import Sequence, Union

from alembic import op

revision: str = "0f1a2b3c4d5e"
down_revision: Union[str, Sequence[str], None] = "d9c1e2f3a4b5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE hollowcore_settings ADD COLUMN IF NOT EXISTS factory_id INTEGER;")
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'fk_hollowcore_settings_factory_id'
            ) THEN
                ALTER TABLE hollowcore_settings
                ADD CONSTRAINT fk_hollowcore_settings_factory_id
                FOREIGN KEY (factory_id) REFERENCES factories(id);
            END IF;
        END
        $$;
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_hollowcore_settings_factory_id ON hollowcore_settings(factory_id);")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_hollowcore_settings_factory_id;")
    op.execute("ALTER TABLE hollowcore_settings DROP CONSTRAINT IF EXISTS fk_hollowcore_settings_factory_id;")
    op.execute("ALTER TABLE hollowcore_settings DROP COLUMN IF EXISTS factory_id;")

