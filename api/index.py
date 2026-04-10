import sqlite3
from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import shutil

app = Flask(__name__)
CORS(app)

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

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

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
    admin_id = data.get('admin_id')
    password = data.get('password')
    
    conn = get_db_connection()
    admin = conn.execute('SELECT * FROM admins WHERE admin_id = ? AND password = ?', (admin_id, password)).fetchone()
    conn.close()
    
    if admin:
        return jsonify({"success": True, "message": "Login successful"}), 200
    else:
        return jsonify({"success": False, "message": "Invalid Admin ID or Password"}), 401

# 2. Add an Admission Application
@app.route('/api/admissions', methods=['POST'])
def apply_admission():
    data = request.json
    try:
        conn = get_db_connection()
        conn.execute(
            'INSERT INTO admissions (student_name, parent_name, class_applying, phone, email, message) VALUES (?, ?, ?, ?, ?, ?)',
            (data['studentName'], data['parentName'], data['classApplying'], data['phone'], data['email'], data.get('message', ''))
        )
        conn.commit()
        conn.close()
        return jsonify({"success": True, "message": "Application submitted successfully!"}), 201
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 400

# 3. Get all Admission Applications (Admin Use)
@app.route('/api/admissions', methods=['GET'])
def get_admissions():
    conn = get_db_connection()
    admissions = conn.execute('SELECT * FROM admissions ORDER BY submitted_at DESC').fetchall()
    conn.close()
    return jsonify([dict(ix) for ix in admissions]), 200

# 4. Get all Notices
@app.route('/api/notices', methods=['GET'])
def get_notices():
    conn = get_db_connection()
    notices = conn.execute('SELECT * FROM notices ORDER BY created_at DESC').fetchall()
    conn.close()
    return jsonify([dict(ix) for ix in notices]), 200

# 5. Add a Notice (Admin Use)
@app.route('/api/notices', methods=['POST'])
def add_notice():
    data = request.json
    title = data.get('title')
    content = data.get('content')
    
    if not title or not content:
        return jsonify({"success": False, "message": "Title and Content are required."}), 400
        
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('INSERT INTO notices (title, content) VALUES (?, ?)', (title, content))
    conn.commit()
    new_id = cur.lastrowid
    conn.close()
    
    return jsonify({"success": True, "message": "Notice added successfully!", "id": new_id}), 201

# 6. Delete a Notice (Admin Use)
@app.route('/api/notices/<int:notice_id>', methods=['DELETE'])
def delete_notice(notice_id):
    conn = get_db_connection()
    conn.execute('DELETE FROM notices WHERE id = ?', (notice_id,))
    conn.commit()
    conn.close()
    return jsonify({"success": True, "message": "Notice deleted successfully"}), 200

# 7. Update Admin Credentials (Admin Use)
@app.route('/api/admin/update', methods=['PUT'])
def update_admin():
    data = request.json
    new_id = data.get('new_id')
    new_pwd = data.get('new_password')
    
    if not new_id or not new_pwd:
        return jsonify({"success": False, "message": "ID and Password are required."}), 400
        
    conn = get_db_connection()
    # Assuming the main admin is row ID 1
    conn.execute('UPDATE admins SET admin_id = ?, password = ? WHERE id = 1', (new_id, new_pwd))
    conn.commit()
    conn.close()
    
    return jsonify({"success": True, "message": "Admin credentials updated successfully!"}), 200

# 7. Update Admin Credentials (Settings)
@app.route('/api/admin/credentials', methods=['PUT'])
def update_credentials():
    data = request.json
    new_id = data.get('new_id')
    new_password = data.get('new_password')
    
    if not new_id or not new_password:
        return jsonify({"success": False, "message": "New ID and Password are required."}), 400
        
    conn = get_db_connection()
    # We update the default admin (id 1) since it's a single admin setup.
    conn.execute('UPDATE admins SET admin_id = ?, password = ? WHERE id = 1', (new_id, new_password))
    conn.commit()
    conn.close()
    
    return jsonify({"success": True}), 200

# 8. Get Website Content
@app.route('/api/content', methods=['GET'])
def get_content():
    conn = get_db_connection()
    content = conn.execute('SELECT * FROM website_content WHERE id = 1').fetchone()
    conn.close()
    if content:
        return jsonify(dict(content)), 200
    return jsonify({}), 404

# 9. Update Website Content (Admin)
@app.route('/api/content', methods=['PUT'])
def update_content():
    data = request.json
    hero_headline = data.get('hero_headline')
    hero_subtitle = data.get('hero_subtitle')
    admissions_banner = data.get('admissions_banner')
    
    conn = get_db_connection()
    conn.execute('''
        UPDATE website_content 
        SET hero_headline = ?, hero_subtitle = ?, admissions_banner = ? 
        WHERE id = 1
    ''', (hero_headline, hero_subtitle, admissions_banner))
    conn.commit()
    conn.close()
    return jsonify({"success": True}), 200

if __name__ == '__main__':
    app.run(debug=True, port=5000)
