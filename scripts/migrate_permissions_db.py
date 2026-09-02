import os
from sqlalchemy import text
from backend.app.core.config import settings
from backend.app.db.session import engine, Base, SessionLocal
from backend.app.services.permission_service import permission_service
import backend.app.db.models as models

def migrate_db():
    print(f"Target Database: {settings.DATABASE_URL}")
    with engine.connect() as conn:
        def add_col_if_missing(table, col, col_type):
            result = conn.execute(text(f"PRAGMA table_info({table})"))
            cols = [row[1] for row in result.fetchall()]
            if col not in cols:
                print(f"Adding column '{col}' to table '{table}'...")
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}"))
                conn.commit()

        # Migrate users table
        add_col_if_missing("users", "role_id", "INTEGER")
        add_col_if_missing("users", "department", "VARCHAR(100) DEFAULT 'Computer Science & Engineering'")
        add_col_if_missing("users", "status", "VARCHAR(20) DEFAULT 'Active'")
        add_col_if_missing("users", "last_login_at", "DATETIME")

        # Migrate audit_logs table
        add_col_if_missing("audit_logs", "actor_name", "VARCHAR(100)")
        add_col_if_missing("audit_logs", "actor_role", "VARCHAR(50)")
        add_col_if_missing("audit_logs", "target_user_id", "INTEGER")
        add_col_if_missing("audit_logs", "target_name", "VARCHAR(100)")
        add_col_if_missing("audit_logs", "permission_key", "VARCHAR(100)")
        add_col_if_missing("audit_logs", "scope_json", "TEXT")
        add_col_if_missing("audit_logs", "previous_value", "TEXT")
        add_col_if_missing("audit_logs", "new_value", "TEXT")
        add_col_if_missing("audit_logs", "result", "VARCHAR(20) DEFAULT 'SUCCESS'")

    # Create any new tables defined in models
    Base.metadata.create_all(bind=engine)

    # Seed permissions and roles
    db = SessionLocal()
    permission_service.seed_default_roles_and_permissions(db)
    print("Permissions count:", db.query(models.Permission).count())
    print("Roles count:", db.query(models.Role).count())
    for r in db.query(models.Role).all():
        print(f"Role: {r.name:<12} | Display: {r.display_name:<20} | Perms: {len(r.permissions)}")
    for u in db.query(models.User).all():
        print(f"User: {u.username:<12} | Role: {u.role:<10} | RoleId: {u.role_id} | Status: {u.status} | Dept: {u.department}")
    db.close()
    print("Database migration & permission seeding completed successfully!")

if __name__ == "__main__":
    migrate_db()
