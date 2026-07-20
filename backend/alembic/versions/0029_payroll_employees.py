"""Create payroll employees table

Revision ID: 0029_payroll_employees
Revises: 0028_gr_place_remarks
Create Date: 2026-07-19
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0029_payroll_employees"
down_revision: Union[str, None] = "0028_gr_place_remarks"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "yoradm_payroll_employee",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("emp_code", sa.String(length=32), nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("designation", sa.String(length=128), nullable=True),
        sa.Column("join_date", sa.Date(), nullable=True),
        sa.Column("phone", sa.String(length=32), nullable=True),
        sa.Column("monthly_salary", sa.Float(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column("remarks", sa.String(length=512), nullable=True),
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
        sa.ForeignKeyConstraint(["created_by"], ["yoradm_users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("emp_code", name="uq_yoradm_payroll_employee_emp_code"),
    )
    op.create_index(
        op.f("ix_yoradm_payroll_employee_emp_code"),
        "yoradm_payroll_employee",
        ["emp_code"],
        unique=False,
    )
    op.create_index(
        op.f("ix_yoradm_payroll_employee_name"),
        "yoradm_payroll_employee",
        ["name"],
        unique=False,
    )
    op.create_index(
        op.f("ix_yoradm_payroll_employee_created_by"),
        "yoradm_payroll_employee",
        ["created_by"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_yoradm_payroll_employee_created_by"), table_name="yoradm_payroll_employee")
    op.drop_index(op.f("ix_yoradm_payroll_employee_name"), table_name="yoradm_payroll_employee")
    op.drop_index(op.f("ix_yoradm_payroll_employee_emp_code"), table_name="yoradm_payroll_employee")
    op.drop_table("yoradm_payroll_employee")
