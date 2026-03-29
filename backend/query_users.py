
import sqlite3
import os

db_path = "./research_assistant.db"
if not os.path.exists(db_path):
    print(f"Database not found at {db_path}")
else:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id, email, full_name, hashed_password FROM users;")
        users = cursor.fetchall()
        print(f"Found {len(users)} users:")
        for user in users:
            print(f"ID: {user[0]}, Email: {user[1]}, Name: {user[2]}, Hash: {user[3][:20]}...")
    except sqlite3.OperationalError as e:
        print(f"Error: {e}")
    finally:
        conn.close()
