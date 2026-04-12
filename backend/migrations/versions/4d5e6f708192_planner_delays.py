"""Add planner delay events table."""

from typing import Sequence, Union

from alembic import op

revision: str = "4d5e6f708192"
down_revision: Union[str, Sequence[str], None] = "3c4d5e6f7081"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS planner_delays (
            id SERIAL PRIMARY KEY,
            factory_id INTEGER NULL REFERENCES factories(id),
            planner_type VARCHAR(32) NOT NULL,
            delay_date DATE NOT NULL,
            mould_id INTEGER NULL REFERENCES moulds(id) ON DELETE CASCADE,
            bed_id INTEGER NULL REFERENCES hollowcore_beds(id) ON DELETE CASCADE,
            lost_capacity INTEGER NOT NULL DEFAULT 1,
            reason VARCHAR(255) NULL,
            created_by INTEGER NULL REFERENCES users(id),
            created_at TIMESTAMP NOT NULL DEFAULT NOW()
        );
        """
    )

    op.execute("CREATE INDEX IF NOT EXISTS ix_planner_delays_factory_id ON planner_delays(factory_id);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_planner_delays_planner_type ON planner_delays(planner_type);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_planner_delays_delay_date ON planner_delays(delay_date);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_planner_delays_mould_id ON planner_delays(mould_id);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_planner_delays_bed_id ON planner_delays(bed_id);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_planner_delays_created_by ON planner_delays(created_by);")
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_planner_delays_factory_type_date ON planner_delays(factory_id, planner_type, delay_date);"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_planner_delays_factory_type_date;")
    op.execute("DROP INDEX IF EXISTS ix_planner_delays_created_by;")
    op.execute("DROP INDEX IF EXISTS ix_planner_delays_bed_id;")
    op.execute("DROP INDEX IF EXISTS ix_planner_delays_mould_id;")
    op.execute("DROP INDEX IF EXISTS ix_planner_delays_delay_date;")
    op.execute("DROP INDEX IF EXISTS ix_planner_delays_planner_type;")
    op.execute("DROP INDEX IF EXISTS ix_planner_delays_factory_id;")
    op.execute("DROP TABLE IF EXISTS planner_delays;")

