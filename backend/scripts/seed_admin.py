#!/usr/bin/env python3
"""Seed the initial admin user from environment settings."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import get_settings
from app.db.session import SessionLocal
from app.services import user_service


def main() -> None:
    settings = get_settings()
    db = SessionLocal()
    try:
        user = user_service.ensure_admin_exists(
            db,
            email=settings.admin_email,
            password=settings.admin_password,
            full_name=settings.admin_full_name,
            username=settings.admin_username,
        )
        print(
            f"Admin ready: id={user.id} username={user.username} "
            f"email={user.email} role={user.role.value}"
        )
    finally:
        db.close()


if __name__ == "__main__":
    main()
