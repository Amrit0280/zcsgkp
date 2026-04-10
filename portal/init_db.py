import sqlite3
import os

DB_PATH = 'database.db'

def init_db():
    print("Initializing Database...")
    # Read Schema
    with open('schema.sql', 'r') as f:
        schema = f.read()

    # Apply Schema
    with sqlite3.connect(DB_PATH) as conn:
        conn.executescript(schema)
        
        # Insert Default Admin (In a real app, hash this password!)
        print("Inserting default Admin user: admin / zenith2026")
        conn.execute("INSERT INTO admins (admin_id, password) VALUES (?, ?)", ('admin', 'zenith2026'))
        
        # Insert some mock notices
        conn.execute("INSERT INTO notices (title, content) VALUES (?, ?)", 
                     ('Summer Vacation', 'Summer Vacation starts early next week.'))
        
        # Insert a mock admission entry
        conn.execute("INSERT INTO admissions (student_name, parent_name, class_applying, phone, email, message) VALUES (?, ?, ?, ?, ?, ?)",
                     ('Aarav Kumar', 'Rahul Kumar', 'Class I', '+91 9876543210', 'rahul@example.com', 'Interested in school transport.'))
        
        conn.commit()
        print("Database Initialized successfully.")

if __name__ == '__main__':
    init_db()
