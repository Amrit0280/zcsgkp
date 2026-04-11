import sqlite3
from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import shutil

from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
    HAS_PSYCOPG2 = True
except ImportError:
    HAS_PSYCOPG2 = False


# Support ephemeral /tmp database on Vercel
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORIGINAL_DB = os.path.join(BASE_DIR, 'portal', 'database.db')
TMP_DB = '/tmp/database.db'

if os.environ.get("VERCEL") or os.environ.get("VERCEL_URL") or os.environ.get("AWS_EXECUTION_ENV"):
    if not os.path.exists(TMP_DB):
        try: shutil.copyfile(ORIGINAL_DB, TMP_DB)
        except Exception: pass
    DB_PATH = TMP_DB
else:
    DB_PATH = ORIGINAL_DB

DATABASE_URL = os.environ.get("DATABASE_URL")
IS_POSTGRES = DATABASE_URL is not None and DATABASE_URL.startswith("postgres") and HAS_PSYCOPG2

def get_db_connection():
    # If on Vercel, mandate PostgreSQL. Warn loudly if misconfigured!
    if os.environ.get("VERCEL") or os.environ.get("VERCEL_URL"):
        if not DATABASE_URL:
            raise RuntimeError("CRITICAL ERROR: DATABASE_URL environment variable is missing in Vercel! You must add it to Vercel Settings to use this app.")
        if not HAS_PSYCOPG2:
            raise RuntimeError("CRITICAL ERROR: psycopg2 failed to load on Vercel! Please check build logs.")
        return psycopg2.connect(DATABASE_URL)
        
    # Local behavior
    if IS_POSTGRES:
        return psycopg2.connect(DATABASE_URL)
    else:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        return conn

def db_query(query, params=(), fetchone=False, fetchall=False, commit=False):
    conn = get_db_connection()
    result = None
    last_id = None
    try:
        if IS_POSTGRES:
            pg_query = query.replace("?", "%s")
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                if "INSERT" in pg_query.upper() and ("admissions" in pg_query or "notices" in pg_query):
                    pg_query += " RETURNING id"
                cur.execute(pg_query, params)
                if commit:
                    conn.commit()
                if fetchone:
                    result = dict(cur.fetchone()) if cur.rowcount > 0 else None
                elif fetchall:
                    result = [dict(row) for row in cur.fetchall()]
                elif "RETURNING id" in pg_query:
                    res = cur.fetchone()
                    if res: last_id = res['id']
        else:
            cur = conn.cursor()
            cur.execute(query, params)
            if commit:
                conn.commit()
            if fetchone:
                row = cur.fetchone()
                result = dict(row) if row else None
            elif fetchall:
                result = [dict(row) for row in cur.fetchall()]
            else:
                last_id = cur.lastrowid
    finally:
        conn.close()
    
    if commit and not fetchone and not fetchall:
        return last_id
    return result

def init_db():
    if not IS_POSTGRES: return
    conn = get_db_connection()
    with conn.cursor() as cur:
        cur.execute("SELECT to_regclass('public.admins');")
        if not cur.fetchone()[0]:
            cur.execute('''
                CREATE TABLE admins (id SERIAL PRIMARY KEY, admin_id VARCHAR(255) NOT NULL, password VARCHAR(255) NOT NULL);
                INSERT INTO admins (admin_id, password) VALUES ('admin', 'admin123');
                CREATE TABLE website_content (id SERIAL PRIMARY KEY, hero_headline TEXT, hero_subtitle TEXT, admissions_banner TEXT);
                INSERT INTO website_content (hero_headline, hero_subtitle, admissions_banner) 
                VALUES ('Shape Your Child''s<br><span class="italic gold">Future</span> with<span class="gold"> Excellence</span>', 
                        'Zenith Convent School offers a CBSE-affiliated, nurturing academic environment that develops tomorrow''s leaders through discipline, values, and innovation.',
                        'Admissions 2026–27 are open.');
                CREATE TABLE admissions (
                    id SERIAL PRIMARY KEY, student_name VARCHAR(255), parent_name VARCHAR(255), class_applying VARCHAR(50), 
                    phone VARCHAR(50), email VARCHAR(255), message TEXT, submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                CREATE TABLE notices (
                    id SERIAL PRIMARY KEY, title VARCHAR(255), content TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            ''')
    conn.commit()
    conn.close()

try:
    init_db()
except Exception as e:
    print("Postgres Init Error:", e)

# ─── SERVE STATIC HTML PAGES (FOR LOCAL TESTING) ───
from flask import send_from_directory

@app.route('/')
def home():
    return send_from_directory(BASE_DIR, 'index.html')

@app.route('/<path:path>')
def serve_file(path):
    target = os.path.join(BASE_DIR, path)
    if os.path.exists(target):
        return send_from_directory(BASE_DIR, path)
        
    portal_target = os.path.join(BASE_DIR, 'portal', path)
    if os.path.exists(portal_target):
        return send_from_directory(os.path.join(BASE_DIR, 'portal'), path)
        
    return "File not found", 404

# ─── API ENDPOINTS ───

# 1. Admin Login
@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    admin = db_query('SELECT * FROM admins WHERE admin_id = ? AND password = ?', (data.get('admin_id'), data.get('password')), fetchone=True)
    if admin:
        return jsonify({"success": True, "message": "Login successful"}), 200
    return jsonify({"success": False, "message": "Invalid Admin ID or Password"}), 401

# 2. Add an Admission Application
@app.route('/api/admissions', methods=['POST'])
def apply_admission():
    data = request.json
    try:
        db_query('INSERT INTO admissions (student_name, parent_name, class_applying, phone, email, message) VALUES (?, ?, ?, ?, ?, ?)',
                 (data['studentName'], data['parentName'], data['classApplying'], data['phone'], data['email'], data.get('message', '')), commit=True)
        return jsonify({"success": True, "message": "Application submitted successfully!"}), 201
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 400

# 3. Get all Admission Applications (Admin Use)
@app.route('/api/admissions', methods=['GET'])
def get_admissions():
    admissions = db_query('SELECT * FROM admissions ORDER BY submitted_at DESC', fetchall=True)
    return jsonify(admissions), 200

# 4. Get all Notices
@app.route('/api/notices', methods=['GET'])
def get_notices():
    notices = db_query('SELECT * FROM notices ORDER BY created_at DESC', fetchall=True)
    return jsonify(notices), 200

# 5. Add a Notice (Admin Use)
@app.route('/api/notices', methods=['POST'])
def add_notice():
    data = request.json
    title, content = data.get('title'), data.get('content')
    if not title or not content:
        return jsonify({"success": False, "message": "Title and Content are required."}), 400
    new_id = db_query('INSERT INTO notices (title, content) VALUES (?, ?)', (title, content), commit=True)
    return jsonify({"success": True, "message": "Notice added successfully!", "id": new_id}), 201

# 6. Delete a Notice (Admin Use)
@app.route('/api/notices/<int:notice_id>', methods=['DELETE'])
def delete_notice(notice_id):
    db_query('DELETE FROM notices WHERE id = ?', (notice_id,), commit=True)
    return jsonify({"success": True, "message": "Notice deleted successfully"}), 200

# 7. Update Admin Credentials (Admin Use)
@app.route('/api/admin/update', methods=['PUT'])
def update_admin():
    data = request.json
    new_id, new_pwd = data.get('new_id'), data.get('new_password')
    if not new_id or not new_pwd:
        return jsonify({"success": False, "message": "ID and Password are required."}), 400
    db_query('UPDATE admins SET admin_id = ?, password = ? WHERE id = 1', (new_id, new_pwd), commit=True)
    return jsonify({"success": True, "message": "Admin credentials updated successfully!"}), 200

# 7. Update Admin Credentials (Settings)
@app.route('/api/admin/credentials', methods=['PUT'])
def update_credentials():
    data = request.json
    new_id, new_pwd = data.get('new_id'), data.get('new_password')
    if not new_id or not new_pwd:
        return jsonify({"success": False, "message": "New ID and Password are required."}), 400
    db_query('UPDATE admins SET admin_id = ?, password = ? WHERE id = 1', (new_id, new_pwd), commit=True)
    return jsonify({"success": True}), 200

# 8. Get Website Content
@app.route('/api/content', methods=['GET'])
def get_content():
    content = db_query('SELECT * FROM website_content WHERE id = 1', fetchone=True)
    if content: return jsonify(content), 200
    return jsonify({}), 404

# 9. Update Website Content (Admin)
@app.route('/api/content', methods=['PUT'])
def update_content():
    data = request.json
    db_query('UPDATE website_content SET hero_headline = ?, hero_subtitle = ?, admissions_banner = ? WHERE id = 1', 
             (data.get('hero_headline'), data.get('hero_subtitle'), data.get('admissions_banner')), commit=True)
    return jsonify({"success": True}), 200

if __name__ == '__main__':
    app.run(debug=True, port=5000)
