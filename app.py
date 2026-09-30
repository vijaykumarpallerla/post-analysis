import os
import uuid
import psycopg2
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from supabase import create_client, Client
from datetime import datetime, timezone, timedelta
from functools import wraps

IST = timezone(timedelta(hours=5, minutes=30))

# Load environment variables from .env file
load_dotenv()

# Setup Supabase client
raw_db_url = os.environ.get("Data_base_url", "")
db_password = os.environ.get("DB_PASSWORD", "")
db_url = raw_db_url.replace("[YOUR-PASSWORD]", db_password)

project_ref = raw_db_url.split('@db.')[1].split('.supabase.co')[0]
supabase_url = f"https://{project_ref}.supabase.co"
supabase_key = os.environ.get("Suphabase_service_key")
supabase: Client = create_client(supabase_url, supabase_key)

API_KEY = os.environ.get("X_AGENT_KEY")

def require_api_key(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if request.headers.get("X-Agent-Key") != API_KEY:
            return jsonify({"status": "error", "message": "Unauthorized AI Agent"}), 401
        return f(*args, **kwargs)
    return decorated_function

# Ensure the storage bucket exists
try:
    supabase.storage.create_bucket('post_images', {'public': True})
    print("Checked/Created 'post_images' bucket in Supabase Storage.")
except Exception as e:
    # Usually throws an error if it already exists, which is fine
    pass

# Ensure the database table exists
try:
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS posts (
            id SERIAL PRIMARY KEY,
            text TEXT,
            image_url TEXT,
            document_url TEXT,
            media_description TEXT,
            posted_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)
    # Attempt to alter table if the column is missing from previous version
    try:
        cur.execute("ALTER TABLE posts ADD COLUMN IF NOT EXISTS document_url TEXT;")
        cur.execute("ALTER TABLE posts ADD COLUMN IF NOT EXISTS media_description TEXT;")
    except Exception as e:
        pass
        
    cur.execute("""
        CREATE TABLE IF NOT EXISTS post_metrics (
            id SERIAL PRIMARY KEY,
            post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
            reactions INTEGER DEFAULT 0,
            reposts INTEGER DEFAULT 0,
            comments INTEGER DEFAULT 0,
            impressions INTEGER DEFAULT 0,
            observed_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)
    conn.commit()
    cur.close()
    conn.close()
    print("Checked/Created 'posts' table in database.")
except Exception as e:
    print("Warning: Could not verify 'posts' table:", e)


app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)  # Enable CORS so the frontend can communicate with this backend

@app.route('/')
def index():
    return app.send_static_file('index.html')

@app.route('/api/posts', methods=['POST'])
def create_post():
    # Handle incoming Form Data (which can include text and files)
    text = request.form.get('text', '')
    media_description = request.form.get('media_description', '').strip()
    posted_at = request.form.get('posted_at', '').strip()
    image = request.files.get('image')
    document = request.files.get('document')
    
    print(f"--- New Post Received ---")
    print(f"Text: {text}")
    if posted_at:
        print(f"Posted At: {posted_at}")
    
    image_url = None
    if image and image.filename:
        print(f"Image attached: {image.filename}")
        try:
            # Upload to Supabase Storage (Not Base64, raw file)
            file_ext = image.filename.split('.')[-1]
            file_name = f"{uuid.uuid4()}.{file_ext}"
            
            # Read file data directly
            file_data = image.read()
            
            # Upload to bucket 'post_images'
            res = supabase.storage.from_('post_images').upload(
                path=file_name, 
                file=file_data, 
                file_options={"content-type": image.content_type}
            )
            image_url = supabase.storage.from_('post_images').get_public_url(file_name)
            print(f"Image uploaded successfully: {image_url}")
        except Exception as e:
            print("Storage upload error:", e)
            return jsonify({"status": "error", "message": f"Failed to upload image: {str(e)}"}), 500

    document_url = None
    if document and document.filename:
        print(f"Document attached: {document.filename}")
        try:
            file_ext = document.filename.split('.')[-1]
            file_name = f"{uuid.uuid4()}.{file_ext}"
            file_data = document.read()
            res = supabase.storage.from_('post_images').upload(
                path=file_name, 
                file=file_data, 
                file_options={"content-type": document.content_type}
            )
            document_url = supabase.storage.from_('post_images').get_public_url(file_name)
            print(f"Document uploaded successfully: {document_url}")
        except Exception as e:
            print("Storage upload error (document):", e)
            return jsonify({"status": "error", "message": f"Failed to upload document: {str(e)}"}), 500

    # Insert into Database using Supabase client
    try:
        data = {"text": text}
        if posted_at:
            data["posted_at"] = posted_at
        if image_url:
            data["image_url"] = image_url
        if document_url:
            data["document_url"] = document_url
        if media_description:
            data["media_description"] = media_description
            
        data["created_at"] = datetime.now(IST).strftime('%Y-%m-%d %H:%M:%S')
            
        response = supabase.table('posts').insert(data).execute()
        print("Saved to database successfully.")
        
    except Exception as e:
        print("Database insert error:", e)
        return jsonify({"status": "error", "message": f"Database error: {str(e)}"}), 500

    # Respond back to the frontend
    return jsonify({
        "status": "success",
        "message": "Post and image saved successfully to Supabase!"
    }), 201

@app.route('/api/posts', methods=['GET'])
def get_posts():
    try:
        response = supabase.table('posts').select('*').order('created_at', desc=True).execute()
        return jsonify({"status": "success", "data": response.data}), 200
    except Exception as e:
        print("Error fetching posts:", e)
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/posts/<int:post_id>', methods=['PUT'])
def update_post(post_id):
    text = request.form.get('text', '')
    media_description = request.form.get('media_description', '').strip()
    posted_at = request.form.get('posted_at', '').strip()
    image = request.files.get('image')
    document = request.files.get('document')

    update_data = {"text": text}
    if posted_at:
        update_data["posted_at"] = posted_at
    if media_description:
        update_data["media_description"] = media_description
    else:
        update_data["media_description"] = ""
        
    if image and image.filename:
        try:
            file_ext = image.filename.split('.')[-1]
            file_name = f"{uuid.uuid4()}.{file_ext}"
            supabase.storage.from_('post_images').upload(
                path=file_name, file=image.read(), file_options={"content-type": image.content_type}
            )
            update_data["image_url"] = supabase.storage.from_('post_images').get_public_url(file_name)
        except Exception as e:
            print("Storage upload error (image edit):", e)
            
    if document and document.filename:
        try:
            file_ext = document.filename.split('.')[-1]
            file_name = f"{uuid.uuid4()}.{file_ext}"
            supabase.storage.from_('post_images').upload(
                path=file_name, file=document.read(), file_options={"content-type": document.content_type}
            )
            update_data["document_url"] = supabase.storage.from_('post_images').get_public_url(file_name)
        except Exception as e:
            print("Storage upload error (doc edit):", e)
            
    try:
        supabase.table('posts').update(update_data).eq('id', post_id).execute()
        return jsonify({"status": "success", "message": "Post updated successfully"}), 200
    except Exception as e:
        print("Error updating post:", e)
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/posts/<int:post_id>', methods=['DELETE'])
def delete_post(post_id):
    try:
        res = supabase.table('posts').select('*').eq('id', post_id).execute()
        if not res.data:
            return jsonify({"status": "error", "message": "Post not found"}), 404
        
        post = res.data[0]
        image_url = post.get('image_url')
        document_url = post.get('document_url')

        if image_url:
            filename = image_url.split('/')[-1]
            try:
                supabase.storage.from_('post_images').remove([filename])
                print(f"Deleted image {filename} from storage.")
            except Exception as e:
                print(f"Warning: Could not delete image {filename}: {e}")
                
        if document_url:
            filename = document_url.split('/')[-1]
            try:
                supabase.storage.from_('post_images').remove([filename])
                print(f"Deleted document {filename} from storage.")
            except Exception as e:
                print(f"Warning: Could not delete document {filename}: {e}")
        
        supabase.table('posts').delete().eq('id', post_id).execute()
        print(f"Deleted post {post_id} from database.")
        
        return jsonify({"status": "success", "message": "Post deleted"}), 200
    except Exception as e:
        print("Error deleting post:", e)
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/posts/<int:post_id>/metrics', methods=['POST'])
def add_metrics(post_id):
    try:
        data = request.json
        insert_data = {
            "post_id": post_id,
            "reactions": int(data.get('reactions') or 0),
            "reposts": int(data.get('reposts') or 0),
            "comments": int(data.get('comments') or 0),
            "impressions": int(data.get('impressions') or 0),
            "created_at": datetime.now(IST).strftime('%Y-%m-%d %H:%M:%S')
        }
        if data.get('observed_at'):
            insert_data['observed_at'] = data.get('observed_at')
            
        supabase.table('post_metrics').insert(insert_data).execute()
        return jsonify({"status": "success", "message": "Metrics logged successfully!"}), 201
    except Exception as e:
        print("Error saving metrics:", e)
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/posts/<int:post_id>/metrics', methods=['GET'])
def get_metrics(post_id):
    try:
        response = supabase.table('post_metrics').select('*').eq('post_id', post_id).order('observed_at', desc=True).execute()
        return jsonify({"status": "success", "data": response.data}), 200
    except Exception as e:
        print("Error fetching metrics:", e)
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy"}), 200

# --- Public API for AI Agents ---

@app.route('/api/public/posts/latest', methods=['GET'])
@require_api_key
def get_public_latest_posts():
    limit = int(request.args.get('limit', 5))
    try:
        response = supabase.table('posts').select('*, post_metrics(*)').order('created_at', desc=True).limit(limit).execute()
        return jsonify({"status": "success", "data": response.data}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/public/posts', methods=['GET'])
@require_api_key
def get_public_posts():
    date = request.args.get('date')
    from_date = request.args.get('from')
    to_date = request.args.get('to')
    limit = int(request.args.get('limit', 30))
    
    try:
        query = supabase.table('posts').select('*, post_metrics(*)').order('created_at', desc=True)
        if date:
            query = query.gte('created_at', f"{date} 00:00:00").lte('created_at', f"{date} 23:59:59")
        elif from_date and to_date:
            query = query.gte('created_at', f"{from_date} 00:00:00").lte('created_at', f"{to_date} 23:59:59")
            
        response = query.limit(limit).execute()
        return jsonify({"status": "success", "data": response.data}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/public/posts/<int:post_id>', methods=['GET'])
@require_api_key
def get_public_post(post_id):
    try:
        response = supabase.table('posts').select('*, post_metrics(*)').eq('id', post_id).execute()
        if not response.data:
            return jsonify({"status": "error", "message": "Post not found"}), 404
        return jsonify({"status": "success", "data": response.data[0]}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == '__main__':
    print("Starting backend server on http://localhost:5000")
    app.run(debug=True, port=5000)
