import sqlite3
from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import shutil
import random
import string
import time
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

# ─── OTP STORE (in-memory, resets on restart) ───
_otp_store = {}  # { 'code': '123456', 'expires': timestamp }
ADMIN_EMAIL = os.environ.get('ADMIN_EMAIL', 'mauryaamrit0280@gmail.com')
SMTP_EMAIL = os.environ.get('SMTP_EMAIL', '')
SMTP_PASSWORD = os.environ.get('SMTP_PASSWORD', '')

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

        # Portals for Teacher & Student
        cur.execute('''CREATE TABLE IF NOT EXISTS teachers (
            id SERIAL PRIMARY KEY, username VARCHAR(255) NOT NULL UNIQUE, password VARCHAR(255) NOT NULL, name VARCHAR(255)
        );''')
        cur.execute("SELECT COUNT(*) FROM teachers;")
        if cur.fetchone()[0] == 0:
            cur.execute("INSERT INTO teachers (username, password, name) VALUES ('teacher', 'teacher123', 'Default Teacher');")

        cur.execute('''CREATE TABLE IF NOT EXISTS students (
            id SERIAL PRIMARY KEY, username VARCHAR(255) NOT NULL UNIQUE, password VARCHAR(255) NOT NULL, name VARCHAR(255), class_name VARCHAR(50)
        );''')
        cur.execute("SELECT COUNT(*) FROM students;")
        if cur.fetchone()[0] == 0:
            cur.execute("INSERT INTO students (username, password, name, class_name) VALUES ('student', 'student123', 'Default Student', 'Class 1');")

        cur.execute('''CREATE TABLE IF NOT EXISTS class_activities (
            id SERIAL PRIMARY KEY, teacher_username VARCHAR(255), class_name VARCHAR(50), 
            description TEXT, image_data TEXT NOT NULL, activity_date DATE DEFAULT CURRENT_DATE, 
            uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );''')

        # Commit all table creations FIRST
        conn.commit()

        # Safe migration for existing DB (separate transaction so rollback doesn't undo tables)
        try:
            cur.execute("ALTER TABLE website_content ADD COLUMN academic_year VARCHAR(50) DEFAULT '2026–27';")
            conn.commit()
        except Exception:
            conn.rollback()
        
        # Ensure seat_data column exists
        try:
            cur.execute("ALTER TABLE website_content ADD COLUMN seat_data TEXT DEFAULT NULL;")
            conn.commit()
        except Exception:
            conn.rollback()
    
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

# 3b. Clear ALL Admission Applications (Admin Use)
@app.route('/api/admissions', methods=['DELETE'])
def clear_all_admissions():
    try:
        db_query('DELETE FROM admissions', commit=True)
        return jsonify({'success': True, 'message': 'All admission records cleared successfully.'}), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

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
    try:
        data = request.json
        is_open = bool(data.get('admission_open', True))
        if IS_POSTGRES:
            # PostgreSQL uses TRUE/FALSE booleans; column guaranteed by init_db
            db_query('UPDATE website_content SET admission_open = %s WHERE id = 1', (is_open,), commit=True)
        else:
            # SQLite: ensure column exists (safe migration for local dev), store as 1/0
            try:
                db_query('ALTER TABLE website_content ADD COLUMN admission_open INTEGER DEFAULT 1', commit=True)
            except Exception:
                pass  # column already exists — that's fine
            db_query('UPDATE website_content SET admission_open = ? WHERE id = 1', (1 if is_open else 0,), commit=True)
        return jsonify({"success": True, "admission_open": is_open}), 200
    except Exception as e:
        print("Update Admission Status Error:", e)
        return jsonify({"success": False, "message": str(e)}), 500

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

# 20. Update an Image
@app.route('/api/gallery/<int:img_id>', methods=['PUT'])
def update_gallery_img(img_id):
    data = request.json
    title = data.get('title')
    category_id = data.get('category_id')
    db_query('UPDATE gallery_images SET title = ?, category_id = ? WHERE id = ?', 
             (title, category_id if category_id else None, img_id), commit=True)
    return jsonify({'success': True, 'message': 'Image updated.'}), 200

# ─── TEACHER & STUDENT PORTAL ───

@app.route('/api/teacher/login', methods=['POST'])
def teacher_login():
    data = request.json
    teacher = db_query('SELECT * FROM teachers WHERE username = ? AND password = ?', (data.get('username'), data.get('password')), fetchone=True)
    if teacher:
        return jsonify({"success": True, "message": "Login successful", "user": {"username": teacher['username'], "name": teacher['name']}}), 200
    return jsonify({"success": False, "message": "Invalid Username or Password"}), 401

@app.route('/api/student/login', methods=['POST'])
def student_login():
    data = request.json
    student = db_query('SELECT * FROM students WHERE username = ? AND password = ?', (data.get('username'), data.get('password')), fetchone=True)
    if student:
        return jsonify({"success": True, "message": "Login successful", "user": {"username": student['username'], "name": student['name'], "class_name": student['class_name']}}), 200
    return jsonify({"success": False, "message": "Invalid Username or Password"}), 401

@app.route('/api/activities', methods=['POST'])
def add_activity():
    data = request.json
    teacher_username = data.get('teacher_username', 'teacher')
    class_name = data.get('class_name')
    image_data = data.get('image_data')  # Expected to be large base64
    
    if not class_name or not image_data:
        return jsonify({"success": False, "message": "Class and Image are required."}), 400
        
    db_query('INSERT INTO class_activities (teacher_username, class_name, image_data) VALUES (?, ?, ?)',
             (teacher_username, class_name, image_data), commit=True)
    return jsonify({"success": True, "message": "Activity uploaded successfully!"}), 201

@app.route('/api/activities', methods=['GET'])
def get_activities():
    class_name = request.args.get('class')
    date_filter = request.args.get('date') # Optional date filter
    
    # Base query
    query = 'SELECT * FROM class_activities'
    params = []
    conditions = []
    
    if class_name:
        conditions.append('class_name = ?')
        params.append(class_name)
    
    # Automatically filter by today if date is 'today', otherwise exact date, otherwise all
    if date_filter == 'today':
        import datetime
        today_str = datetime.date.today().isoformat()
        conditions.append('activity_date = ?')
        params.append(today_str)
    elif date_filter:
        conditions.append('activity_date = ?')
        params.append(date_filter)
        
    if conditions:
        query += ' WHERE ' + ' AND '.join(conditions)
        
    query += ' ORDER BY uploaded_at DESC'
    
    activities = db_query(query, tuple(params), fetchall=True)
    
    # We may need to format activity_date to string for JSON serialization
    for act in activities:
        if 'activity_date' in act and hasattr(act['activity_date'], 'isoformat'):
            act['activity_date'] = act['activity_date'].isoformat()
            
    return jsonify(activities), 200

@app.route('/api/activities/<int:act_id>', methods=['DELETE'])
def delete_activity(act_id):
    db_query('DELETE FROM class_activities WHERE id = ?', (act_id,), commit=True)
    return jsonify({"success": True, "message": "Activity deleted successfully"}), 200

# ─── FORGOT PASSWORD / RESET PASSWORD ───

def _generate_otp():
    code = ''.join(random.choices(string.digits, k=6))
    _otp_store['code'] = code
    _otp_store['expires'] = time.time() + 600  # 10 minutes
    return code

def _send_otp_email(code):
    if not SMTP_EMAIL or not SMTP_PASSWORD:
        raise RuntimeError('SMTP_EMAIL and SMTP_PASSWORD environment variables are required to send emails.')
    
    msg = MIMEMultipart('alternative')
    msg['From'] = SMTP_EMAIL
    msg['To'] = ADMIN_EMAIL
    msg['Subject'] = f'🔐 Zenith Admin Password Reset Code: {code}'
    
    html_body = f"""
    <div style="font-family:'Poppins',Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#f8fafc;border-radius:16px;">
        <div style="text-align:center;margin-bottom:24px;">
            <div style="width:60px;height:60px;background:linear-gradient(135deg,#F4C430,#d4a017);border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:24px;font-weight:900;color:#0A3D62;">Z</div>
        </div>
        <h2 style="text-align:center;color:#0A3D62;margin-bottom:8px;">Password Reset Request</h2>
        <p style="text-align:center;color:#7F8C8D;font-size:14px;margin-bottom:28px;">Use the verification code below to reset your Admin Portal password.</p>
        <div style="background:white;border:2px dashed #F4C430;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
            <p style="color:#7F8C8D;font-size:12px;margin-bottom:8px;text-transform:uppercase;letter-spacing:1px;">Your Verification Code</p>
            <p style="font-size:36px;font-weight:900;color:#0A3D62;letter-spacing:8px;margin:0;">{code}</p>
        </div>
        <p style="text-align:center;color:#e74c3c;font-size:13px;font-weight:600;">⏰ This code expires in 10 minutes.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
        <p style="text-align:center;color:#aaa;font-size:11px;">Zenith Convent School — Admin Portal<br>If you didn't request this, please ignore this email.</p>
    </div>
    """
    
    msg.attach(MIMEText(html_body, 'html'))
    
    with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
        server.login(SMTP_EMAIL, SMTP_PASSWORD)
        server.sendmail(SMTP_EMAIL, ADMIN_EMAIL, msg.as_string())

# 22. Request Password Reset OTP
@app.route('/api/forgot-password', methods=['POST'])
def forgot_password():
    try:
        code = _generate_otp()
        _send_otp_email(code)
        # Mask the email for privacy in response
        masked = ADMIN_EMAIL[:3] + '***' + ADMIN_EMAIL[ADMIN_EMAIL.index('@'):]
        return jsonify({'success': True, 'message': f'Verification code sent to {masked}'}), 200
    except Exception as e:
        print('Forgot Password Error:', e)
        return jsonify({'success': False, 'message': 'Failed to send verification code. Please contact the administrator.'}), 500

# 23. Verify OTP and Reset Password
@app.route('/api/reset-password', methods=['POST'])
def reset_password():
    data = request.json
    code = (data.get('code') or '').strip()
    new_password = (data.get('new_password') or '').strip()
    
    if not code or not new_password:
        return jsonify({'success': False, 'message': 'Verification code and new password are required.'}), 400
    
    if len(new_password) < 4:
        return jsonify({'success': False, 'message': 'Password must be at least 4 characters.'}), 400
    
    stored = _otp_store.get('code')
    expires = _otp_store.get('expires', 0)
    
    if not stored or code != stored:
        return jsonify({'success': False, 'message': 'Invalid verification code.'}), 401
    
    if time.time() > expires:
        _otp_store.clear()
        return jsonify({'success': False, 'message': 'Verification code has expired. Please request a new one.'}), 401
    
    # Code is valid — reset password
    _otp_store.clear()
    db_query('UPDATE admins SET password = ? WHERE id = 1', (new_password,), commit=True)
    return jsonify({'success': True, 'message': 'Password reset successfully! You can now login.'}), 200

# 24. Health Check (for Render/Deployment monitoring)
@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy", "database": "postgres" if IS_POSTGRES else "sqlite"}), 200

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=True, host='0.0.0.0', port=port)
