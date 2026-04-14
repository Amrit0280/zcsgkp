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

if os.environ.get("VERCEL") or os.environ.get("VERCEL_URL") or os.environ.get("AWS_EXECUTION_ENV") or os.environ.get("RENDER"):
    if not os.path.exists(TMP_DB):
        try: shutil.copyfile(ORIGINAL_DB, TMP_DB)
        except Exception: pass
    DB_PATH = TMP_DB
else:
    DB_PATH = ORIGINAL_DB

DATABASE_URL = os.environ.get("DATABASE_URL")
IS_POSTGRES = DATABASE_URL is not None and DATABASE_URL.startswith("postgres") and HAS_PSYCOPG2

def get_db_connection():
    # If on Vercel or Render, mandate PostgreSQL. Warn loudly if misconfigured!
    if os.environ.get("VERCEL") or os.environ.get("VERCEL_URL") or os.environ.get("RENDER"):
        if not DATABASE_URL:
            raise RuntimeError("CRITICAL ERROR: DATABASE_URL environment variable is missing in Vercel/Render! You must add it to Settings to use this app.")
        if not HAS_PSYCOPG2:
            raise RuntimeError("CRITICAL ERROR: psycopg2 failed to load! Please check build logs.")
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
                    row = cur.fetchone()
                    result = dict(row) if row else None
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
        # Create each table individually with IF NOT EXISTS for idempotent initialization
        cur.execute('''CREATE TABLE IF NOT EXISTS admins (
            id SERIAL PRIMARY KEY, admin_id VARCHAR(255) NOT NULL, password VARCHAR(255) NOT NULL
        );''')
        # Seed admin if empty
        cur.execute("SELECT COUNT(*) FROM admins;")
        if cur.fetchone()[0] == 0:
            cur.execute("INSERT INTO admins (admin_id, password) VALUES ('admin', 'admin123');")

        cur.execute('''CREATE TABLE IF NOT EXISTS website_content (
            id SERIAL PRIMARY KEY, hero_headline TEXT, hero_subtitle TEXT, admissions_banner TEXT,
            admission_open BOOLEAN DEFAULT TRUE, academic_year VARCHAR(50) DEFAULT '2026–27'
        );''')
        # Seed website content if empty
        cur.execute("SELECT COUNT(*) FROM website_content;")
        if cur.fetchone()[0] == 0:
            cur.execute('''INSERT INTO website_content (hero_headline, hero_subtitle, admissions_banner, admission_open, academic_year) 
                VALUES ('Shape Your Child''s<br><span class="italic gold">Future</span> with<span class="gold"> Excellence</span>', 
                        'Zenith Convent School offers a CBSE-affiliated, nurturing academic environment that develops tomorrow''s leaders through discipline, values, and innovation.',
                        'Admissions 2026–27 are open.', TRUE, '2026–27');''')

        cur.execute('''CREATE TABLE IF NOT EXISTS admissions (
            id SERIAL PRIMARY KEY, student_name VARCHAR(255), parent_name VARCHAR(255), class_applying VARCHAR(50), 
            phone VARCHAR(50), email VARCHAR(255), message TEXT, submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );''')

        cur.execute('''CREATE TABLE IF NOT EXISTS notices (
            id SERIAL PRIMARY KEY, title VARCHAR(255), content TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );''')

        cur.execute('''CREATE TABLE IF NOT EXISTS gallery_categories (
            id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL UNIQUE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );''')
        # Seed gallery categories if empty
        cur.execute("SELECT COUNT(*) FROM gallery_categories;")
        if cur.fetchone()[0] == 0:
            cur.execute("INSERT INTO gallery_categories (name) VALUES ('Infrastructure'),('Annual Events'),('Farewell'),('Sports Day'),('Facilities'),('Other Events');")

        cur.execute('''CREATE TABLE IF NOT EXISTS gallery_images (
            id SERIAL PRIMARY KEY, title VARCHAR(255), category_id INTEGER REFERENCES gallery_categories(id) ON DELETE SET NULL,
            image_data TEXT NOT NULL, uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );''')

        # Safe migration for existing DB
        try:
            cur.execute("ALTER TABLE website_content ADD COLUMN academic_year VARCHAR(50) DEFAULT '2026–27';")
        except Exception:
            conn.rollback()
    
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
    db_query('UPDATE website_content SET hero_headline = ?, hero_subtitle = ?, admissions_banner = ?, academic_year = ? WHERE id = 1', 
             (data.get('hero_headline'), data.get('hero_subtitle'), data.get('admissions_banner'), data.get('academic_year')), commit=True)
    return jsonify({"success": True}), 200

# 10. Get Admission Status
@app.route('/api/admission-status', methods=['GET'])
def get_admission_status():
    content = db_query('SELECT admission_open FROM website_content WHERE id = 1', fetchone=True)
    if content is None:
        return jsonify({"admission_open": True}), 200
    val = content.get('admission_open')
    # Handle both boolean (Postgres) and integer (SQLite: 1/0)
    is_open = bool(val) if val is not None else True
    return jsonify({"admission_open": is_open}), 200

# 11. Update Admission Status (Admin)
@app.route('/api/admission-status', methods=['PUT'])
def update_admission_status():
    data = request.json
    is_open = bool(data.get('admission_open', True))
    # Ensure the column exists in SQLite (migration-safe)
    try:
        db_query('ALTER TABLE website_content ADD COLUMN admission_open INTEGER DEFAULT 1', commit=True)
    except Exception:
        pass  # column already exists — that's fine
    db_query('UPDATE website_content SET admission_open = ? WHERE id = 1', (1 if is_open else 0,), commit=True)
    return jsonify({"success": True, "admission_open": is_open}), 200

# 12. Get Seats Data
@app.route('/api/seats', methods=['GET'])
def get_seats():
    # Ensure column exists (migration-safe)
    try:
        db_query('ALTER TABLE website_content ADD COLUMN seat_data TEXT DEFAULT NULL', commit=True)
    except Exception:
        pass
    content = db_query('SELECT seat_data FROM website_content WHERE id = 1', fetchone=True)
    if content and content.get('seat_data'):
        import json as _json
        try:
            return jsonify(_json.loads(content['seat_data'])), 200
        except Exception:
            pass
    # Return defaults if nothing saved yet
    defaults = {
        'Nursery': 30, 'LKG': 30, 'UKG': 30,
        'Class I': 40, 'Class II': 40, 'Class III': 40, 'Class IV': 40, 'Class V': 40,
        'Class VI': 40, 'Class VII': 40, 'Class VIII': 40,
        'Class IX': 35, 'Class X': 35, 'Class XI': 30, 'Class XII': 30
    }
    return jsonify(defaults), 200

# 13. Save Seats Data (Admin)
@app.route('/api/seats', methods=['PUT'])
def save_seats():
    import json as _json
    data = request.json   # expects { "Nursery": 15, "LKG": 20, ... }
    # Ensure column exists (migration-safe)
    try:
        db_query('ALTER TABLE website_content ADD COLUMN seat_data TEXT DEFAULT NULL', commit=True)
    except Exception:
        pass
    db_query('UPDATE website_content SET seat_data = ? WHERE id = 1',
             (_json.dumps(data),), commit=True)
    total = sum(int(v) for v in data.values() if str(v).isdigit())
    return jsonify({"success": True, "total": total}), 200

# ─── GALLERY API ENDPOINTS ───

# Ensure gallery tables exist for SQLite (migration-safe)
def ensure_gallery_tables():
    if IS_POSTGRES:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("""CREATE TABLE IF NOT EXISTS gallery_categories (
                id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL UNIQUE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );""")
            cur.execute("SELECT COUNT(*) FROM gallery_categories;")
            if cur.fetchone()[0] == 0:
                cur.execute("INSERT INTO gallery_categories (name) VALUES ('Infrastructure'),('Annual Events'),('Farewell'),('Sports Day'),('Facilities'),('Other Events');")
            cur.execute("""CREATE TABLE IF NOT EXISTS gallery_images (
                id SERIAL PRIMARY KEY, title VARCHAR(255), category_id INTEGER REFERENCES gallery_categories(id) ON DELETE SET NULL,
                image_data TEXT NOT NULL, uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );""")
        conn.commit()
        conn.close()
    else:
        conn = sqlite3.connect(DB_PATH)
        conn.execute("""CREATE TABLE IF NOT EXISTS gallery_categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );""")
        conn.execute("""CREATE TABLE IF NOT EXISTS gallery_images (
            id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, category_id INTEGER,
            image_data TEXT NOT NULL, uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );""")
        # Seed default categories if none exist
        cur = conn.execute("SELECT COUNT(*) FROM gallery_categories")
        if cur.fetchone()[0] == 0:
            for cat in ['Infrastructure','Annual Events','Farewell','Sports Day','Facilities','Other Events']:
                conn.execute("INSERT OR IGNORE INTO gallery_categories (name) VALUES (?)", (cat,))
        conn.commit()
        conn.close()

try:
    ensure_gallery_tables()
except Exception as e:
    print("Gallery Table Init Error:", e)

# 14. Get gallery categories
@app.route('/api/gallery/categories', methods=['GET'])
def get_gallery_categories():
    cats = db_query('SELECT * FROM gallery_categories ORDER BY name ASC', fetchall=True)
    return jsonify(cats), 200

# 15. Add gallery category (Admin)
@app.route('/api/gallery/categories', methods=['POST'])
def add_gallery_category():
    data = request.json
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'success': False, 'message': 'Category name is required.'}), 400
    try:
        new_id = db_query('INSERT INTO gallery_categories (name) VALUES (?)', (name,), commit=True)
        return jsonify({'success': True, 'message': 'Category added.', 'id': new_id}), 201
    except Exception as e:
        return jsonify({'success': False, 'message': 'Category already exists or error: ' + str(e)}), 400

# 16. Delete gallery category (Admin)
@app.route('/api/gallery/categories/<int:cat_id>', methods=['DELETE'])
def delete_gallery_category(cat_id):
    db_query('DELETE FROM gallery_categories WHERE id = ?', (cat_id,), commit=True)
    return jsonify({'success': True, 'message': 'Category deleted.'}), 200

# 17. Get all gallery images (with category name)
@app.route('/api/gallery', methods=['GET'])
def get_gallery():
    cat_filter = request.args.get('category_id')
    if cat_filter:
        images = db_query(
            'SELECT gi.*, gc.name as category_name FROM gallery_images gi LEFT JOIN gallery_categories gc ON gi.category_id = gc.id WHERE gi.category_id = ? ORDER BY gi.uploaded_at DESC',
            (cat_filter,), fetchall=True)
    else:
        images = db_query(
            'SELECT gi.*, gc.name as category_name FROM gallery_images gi LEFT JOIN gallery_categories gc ON gi.category_id = gc.id ORDER BY gi.uploaded_at DESC',
            fetchall=True)
    return jsonify(images), 200

# 18. Upload gallery image (Admin)
@app.route('/api/gallery', methods=['POST'])
def upload_gallery_image():
    data = request.json
    title = (data.get('title') or '').strip()
    category_id = data.get('category_id')
    image_data = data.get('image_data', '').strip()
    if not image_data:
        return jsonify({'success': False, 'message': 'Image data is required.'}), 400
    try:
        new_id = db_query(
            'INSERT INTO gallery_images (title, category_id, image_data) VALUES (?, ?, ?)',
            (title, category_id if category_id else None, image_data), commit=True)
        return jsonify({'success': True, 'message': 'Image uploaded.', 'id': new_id}), 201
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 400

# 19. Delete gallery image (Admin)
@app.route('/api/gallery/<int:img_id>', methods=['DELETE'])
def delete_gallery_image(img_id):
    db_query('DELETE FROM gallery_images WHERE id = ?', (img_id,), commit=True)
    return jsonify({'success': True, 'message': 'Image deleted.'}), 200

# 20. Update gallery image metadata (Admin)
@app.route('/api/gallery/<int:img_id>', methods=['PUT'])
def update_gallery_image(img_id):
    data = request.json
    title = (data.get('title') or '').strip()
    category_id = data.get('category_id')
    db_query('UPDATE gallery_images SET title = ?, category_id = ? WHERE id = ?',
             (title, category_id if category_id else None, img_id), commit=True)
    return jsonify({'success': True, 'message': 'Image updated.'}), 200

# 21. Health Check (for Render/Deployment monitoring)
@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy", "database": "postgres" if IS_POSTGRES else "sqlite"}), 200

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=True, host='0.0.0.0', port=port)
