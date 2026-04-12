"""Add factories and factory_id columns for RBAC.

This migration is written to be idempotent (uses IF NOT EXISTS) because
the project has historically been run with non-strict schema state.
"""

from typing import Sequence, Union

from alembic import op


revision: str = "c9d1f2a3b4c5"
down_revision: Union[str, Sequence[str], None] = "b3a2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Factories table.
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS factories (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL UNIQUE
        );
        """
    )

    # Add factory_id columns (nullable for backwards compatibility).
    tables_with_factory_id = [
        "users",
        "projects",
        "elements",
        "moulds",
        "production_schedule",
        "yard_inventory",
        "dispatch_orders",
    ]
    for t in tables_with_factory_id:
        op.execute(f"ALTER TABLE {t} ADD COLUMN IF NOT EXISTS factory_id INTEGER;")

    # Foreign keys (guarded by constraint existence).
    fk_specs = [
        ("users", "factory_id", "factories", "id", "fk_users_factory_id"),
        ("projects", "factory_id", "factories", "id", "fk_projects_factory_id"),
        ("elements", "factory_id", "factories", "id", "fk_elements_factory_id"),
        ("moulds", "factory_id", "factories", "id", "fk_moulds_factory_id"),
        ("production_schedule", "factory_id", "factories", "id", "fk_production_schedule_factory_id"),
        ("yard_inventory", "factory_id", "factories", "id", "fk_yard_inventory_factory_id"),
        ("dispatch_orders", "factory_id", "factories", "id", "fk_dispatch_orders_factory_id"),
    ]

    for table, col, ref_table, ref_col, conname in fk_specs:
        op.execute(
            f"""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_constraint
                    WHERE conname = '{conname}'
                ) THEN
                    ALTER TABLE {table}
                    ADD CONSTRAINT {conname}
                    FOREIGN KEY ({col}) REFERENCES {ref_table}({ref_col});
                END IF;
            END
            $$;
            """
        )


def downgrade() -> None:
    # Dropping constraints first.
    fk_table_by_name = {
        "fk_users_factory_id": "users",
        "fk_projects_factory_id": "projects",
        "fk_elements_factory_id": "elements",
        "fk_moulds_factory_id": "moulds",
        "fk_production_schedule_factory_id": "production_schedule",
        "fk_yard_inventory_factory_id": "yard_inventory",
        "fk_dispatch_orders_factory_id": "dispatch_orders",
    }
    for conname, table in fk_table_by_name.items():
        op.execute(f"ALTER TABLE {table} DROP CONSTRAINT IF EXISTS {conname};")

    for t in [
        "users",
        "projects",
        "elements",
        "moulds",
        "production_schedule",
        "yard_inventory",
        "dispatch_orders",
    ]:
        op.execute(f"ALTER TABLE {t} DROP COLUMN IF EXISTS factory_id;")

    op.execute("DROP TABLE IF EXISTS factories;")

