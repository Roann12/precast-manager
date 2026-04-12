"""Enforce QC batch-age uniqueness and allow hollowcore cut status workflow."""

from typing import Sequence, Union

from alembic import op

revision: str = "ab1c2d3e4f5a"
down_revision: Union[str, Sequence[str], None] = "9b0c1d2e3f4a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_quality_tests_batch_age
        ON quality_tests (batch_id, age_days)
        WHERE batch_id IS NOT NULL AND age_days IS NOT NULL;
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_quality_tests_batch_age;")
