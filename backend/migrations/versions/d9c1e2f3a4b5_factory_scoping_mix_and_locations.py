"""Factory scoping for mix designs + yard locations.

Previously these tables were global which allowed factories to see other factories'
confidential configuration.
"""

from typing import Sequence, Union

from alembic import op

revision: str = "d9c1e2f3a4b5"
down_revision: Union[str, Sequence[str], None] = "e1f2a3b4c5d6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # -----------------------
    # mix_designs.factory_id
    # -----------------------
    op.execute("ALTER TABLE mix_designs ADD COLUMN IF NOT EXISTS factory_id INTEGER")
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'fk_mix_designs_factory_id'
            ) THEN
                ALTER TABLE mix_designs
                ADD CONSTRAINT fk_mix_designs_factory_id
                FOREIGN KEY (factory_id) REFERENCES factories(id);
            END IF;
        END
        $$;
        """
    )

    # Replace global unique constraint with per-factory uniqueness.
    op.execute("ALTER TABLE mix_designs DROP CONSTRAINT IF EXISTS mix_designs_name_key")
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_mix_designs_factory_id_name ON mix_designs(factory_id, name)"
    )

    # Backfill factory_id where a mix design is referenced by elements belonging to exactly one factory.
    op.execute(
        """
        UPDATE mix_designs m
        SET factory_id = x.factory_id
        FROM (
            SELECT mix_design_id, MIN(factory_id) AS factory_id
            FROM elements
            WHERE mix_design_id IS NOT NULL
              AND factory_id IS NOT NULL
            GROUP BY mix_design_id
            HAVING COUNT(DISTINCT factory_id) = 1
        ) x
        WHERE m.id = x.mix_design_id
          AND m.factory_id IS NULL;
        """
    )

    # -----------------------
    # yard_locations.factory_id
    # -----------------------
    op.execute("ALTER TABLE yard_locations ADD COLUMN IF NOT EXISTS factory_id INTEGER")
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'fk_yard_locations_factory_id'
            ) THEN
                ALTER TABLE yard_locations
                ADD CONSTRAINT fk_yard_locations_factory_id
                FOREIGN KEY (factory_id) REFERENCES factories(id);
            END IF;
        END
        $$;
        """
    )

    # Replace global unique constraint with per-factory uniqueness.
    op.execute("ALTER TABLE yard_locations DROP CONSTRAINT IF EXISTS yard_locations_name_key")
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_yard_locations_factory_id_name ON yard_locations(factory_id, name)"
    )

    # Backfill factory_id where a location is referenced by yard inventory belonging to exactly one factory.
    op.execute(
        """
        UPDATE yard_locations yl
        SET factory_id = x.factory_id
        FROM (
            SELECT location_id, MIN(factory_id) AS factory_id
            FROM yard_inventory
            WHERE location_id IS NOT NULL
              AND factory_id IS NOT NULL
            GROUP BY location_id
            HAVING COUNT(DISTINCT factory_id) = 1
        ) x
        WHERE yl.id = x.location_id
          AND yl.factory_id IS NULL;
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_mix_designs_factory_id_name")
    op.execute("ALTER TABLE mix_designs DROP CONSTRAINT IF EXISTS fk_mix_designs_factory_id")
    op.execute("ALTER TABLE mix_designs DROP COLUMN IF EXISTS factory_id")

    op.execute("DROP INDEX IF EXISTS ix_yard_locations_factory_id_name")
    op.execute("ALTER TABLE yard_locations DROP CONSTRAINT IF EXISTS fk_yard_locations_factory_id")
    op.execute("ALTER TABLE yard_locations DROP COLUMN IF EXISTS factory_id")

