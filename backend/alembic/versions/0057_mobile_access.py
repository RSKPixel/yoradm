"""Mobile app access: phones authorised in person, their rep scope, and an audit log.

Revision ID: 0057_mobile_access
Revises: 0056_orid_costing_dhall
Create Date: 2026-10-31
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0057_mobile_access"
down_revision: Union[str, None] = "0056_orid_costing_dhall"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _ts(name: str) -> sa.Column:
    return sa.Column(name, sa.DateTime(timezone=True), nullable=True)


def upgrade() -> None:
    op.create_table(
        "yoradm_mobile_devices",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("label", sa.String(length=128), nullable=True),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="pending"),
        sa.Column("device_uid", sa.String(length=64), nullable=True),
        sa.Column("secret_hash", sa.String(length=64), nullable=True),
        sa.Column("activation_code_hash", sa.String(length=64), nullable=True),
        _ts("activation_expires_at"),
        sa.Column("android_id", sa.String(length=64), nullable=True),
        sa.Column("model", sa.String(length=128), nullable=True),
        sa.Column("os_version", sa.String(length=64), nullable=True),
        sa.Column("app_version", sa.String(length=32), nullable=True),
        _ts("activated_at"),
        _ts("last_seen_at"),
        sa.Column("last_ip", sa.String(length=64), nullable=True),
        _ts("revoked_at"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("device_uid"),
        sa.UniqueConstraint("activation_code_hash"),
    )
    op.create_index("ix_yoradm_mobile_devices_status", "yoradm_mobile_devices", ["status"])

    op.create_table(
        "yoradm_mobile_device_reps",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("device_id", sa.Integer(), nullable=False),
        sa.Column("rep_name", sa.String(length=255), nullable=False),
        sa.ForeignKeyConstraint(["device_id"], ["yoradm_mobile_devices.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("device_id", "rep_name", name="uq_yoradm_mobile_device_reps"),
    )
    op.create_index("ix_yoradm_mobile_device_reps_device_id", "yoradm_mobile_device_reps", ["device_id"])

    op.create_table(
        "yoradm_mobile_audit",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("device_id", sa.Integer(), nullable=True),
        sa.Column("event", sa.String(length=32), nullable=False),
        sa.Column("path", sa.String(length=255), nullable=True),
        sa.Column("detail", sa.String(length=255), nullable=True),
        sa.Column("ip", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["device_id"], ["yoradm_mobile_devices.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_yoradm_mobile_audit_device_id", "yoradm_mobile_audit", ["device_id"])
    op.create_index("ix_yoradm_mobile_audit_event", "yoradm_mobile_audit", ["event"])
    op.create_index("ix_yoradm_mobile_audit_created_at", "yoradm_mobile_audit", ["created_at"])


def downgrade() -> None:
    op.drop_table("yoradm_mobile_audit")
    op.drop_table("yoradm_mobile_device_reps")
    op.drop_table("yoradm_mobile_devices")
