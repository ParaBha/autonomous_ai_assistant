"""
One-time migration script to add missing columns to the users table.
SQLAlchemy's create_all() only creates new tables, it does not alter existing ones.
This script safely adds institution, field_of_study, and research_interests columns
if they don't already exist.
"""
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "research_assistant.db")

def migrate():
    if not os.path.exists(DB_PATH):
        print(f"Database not found at {DB_PATH}. Nothing to migrate.")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Get existing columns
    cursor.execute("PRAGMA table_info(users)")
    existing_columns = {row[1] for row in cursor.fetchall()}
    print(f"Existing columns in 'users': {existing_columns}")

    migrations = [
        ("institution", "TEXT"),
        ("field_of_study", "TEXT"),
        ("research_interests", "TEXT"),  # JSON stored as TEXT in SQLite
        ("created_at", "TIMESTAMP"),
        ("updated_at", "TIMESTAMP"),
    ]

    for col_name, col_type in migrations:
        if col_name not in existing_columns:
            sql = f"ALTER TABLE users ADD COLUMN {col_name} {col_type}"
            print(f"  Adding column: {col_name} ({col_type})")
            cursor.execute(sql)
        else:
            print(f"  Column already exists: {col_name}")

    conn.commit()
    conn.close()
    print("Migration complete.")

if __name__ == "__main__":
    migrate()
