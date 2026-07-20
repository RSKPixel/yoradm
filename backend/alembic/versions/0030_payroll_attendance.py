"""Create payroll attendance table

Revision ID: 0030_payroll_attendance
Revises: 0029_payroll_employees
Create Date: 2026-07-19
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0030_payroll_attendance"
down_revision: Union[str, None] = "0029_payroll_employees"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "yoradm_payroll_attendance",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("employee_id", sa.Integer(), nullable=False),
        sa.Column("attendance_date", sa.Date(), nullable=False),
        sa.Column("status", sa.String(length=1), nullable=False),
        sa.Column("remarks", sa.String(length=255), nullable=True),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["employee_id"],
            ["yoradm_payroll_employee.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(["created_by"], ["yoradm_users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "employee_id",
            "attendance_date",
            name="uq_yoradm_payroll_attendance_emp_date",
        ),
    )
    op.create_index(
        op.f("ix_yoradm_payroll_attendance_employee_id"),
        "yoradm_payroll_attendance",
        ["employee_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_yoradm_payroll_attendance_attendance_date"),
        "yoradm_payroll_attendance",
        ["attendance_date"],
        unique=False,
    )
    op.create_index(
        op.f("ix_yoradm_payroll_attendance_created_by"),
        "yoradm_payroll_attendance",
        ["created_by"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_yoradm_payroll_attendance_created_by"),
        table_name="yoradm_payroll_attendance",
    )
    op.drop_index(
        op.f("ix_yoradm_payroll_attendance_attendance_date"),
        table_name="yoradm_payroll_attendance",
    )
    op.drop_index(
        op.f("ix_yoradm_payroll_attendance_employee_id"),
        table_name="yoradm_payroll_attendance",
    )
    op.drop_table("yoradm_payroll_attendance")
