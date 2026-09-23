"""add supplier fulfillment lifecycle with existing order backfill"""
import uuid

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0002_supplier_fulfillments"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    fulfillment_status = postgresql.ENUM("PENDING", "ACCEPTED", "COLLECTING", "READY", "CANCELLED", name="supplier_fulfillment_status")
    op.create_table(
        "supplier_fulfillments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("order_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("orders.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("supplier_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("suppliers.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("status", fulfillment_status, nullable=False, server_default="PENDING"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("order_id", "supplier_id", name="uq_supplier_fulfillments_order_supplier"),
    )
    op.create_index("ix_supplier_fulfillments_supplier_created", "supplier_fulfillments", ["supplier_id", "created_at"])

    bind = op.get_bind()
    existing_pairs = bind.execute(sa.text("SELECT DISTINCT order_id, supplier_id FROM order_items")).mappings().all()
    fulfillment_table = sa.table(
        "supplier_fulfillments",
        sa.column("id", postgresql.UUID(as_uuid=True)),
        sa.column("order_id", postgresql.UUID(as_uuid=True)),
        sa.column("supplier_id", postgresql.UUID(as_uuid=True)),
        sa.column("status", fulfillment_status),
    )
    if existing_pairs:
        op.bulk_insert(fulfillment_table, [{"id": uuid.uuid4(), "order_id": row["order_id"], "supplier_id": row["supplier_id"], "status": "PENDING"} for row in existing_pairs])


def downgrade() -> None:
    op.drop_index("ix_supplier_fulfillments_supplier_created", table_name="supplier_fulfillments")
    op.drop_table("supplier_fulfillments")
    postgresql.ENUM(name="supplier_fulfillment_status").drop(op.get_bind(), checkfirst=False)
