"""
Knowledge Base Builder for Zenith Convent School Chatbot
=========================================================
Reads sources from:
  1. Database/website.txt  → URLs to crawl
  2. Database/*.html       → Local HTML files
  3. Database/*.pdf        → PDF files

Outputs: chatbot/knowledge_base.json

Usage:
    python chatbot/build_kb.py

Run this whenever source files change to rebuild the knowledge base.
"""

import os
import sys
import json
import re
import time

# ── Dependency check ──────────────────────────────────────────────────────────
try:
    import requests
    from bs4 import BeautifulSoup
except ImportError:
    print("ERROR: Install dependencies first: pip install beautifulsoup4 requests lxml")
    sys.exit(1)

try:
    from pypdf import PdfReader
except ImportError:
    try:
        from PyPDF2 import PdfReader
    except ImportError:
        PdfReader = None
        print("WARNING: pypdf not installed. PDF files will be skipped.")

# ── Paths ─────────────────────────────────────────────────────────────────────
BASE_DIR    = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_DIR      = os.path.join(BASE_DIR, 'Database')
OUTPUT_DIR  = os.path.join(BASE_DIR, 'chatbot')
OUTPUT_FILE = os.path.join(OUTPUT_DIR, 'knowledge_base.json')
os.makedirs(OUTPUT_DIR, exist_ok=True)

# ── Helpers ───────────────────────────────────────────────────────────────────
CHUNK_SIZE = 500   # characters per chunk (with overlap)
OVERLAP    = 80

def clean_text(text: str) -> str:
    """Collapse whitespace and remove boilerplate characters."""
    text = re.sub(r'\s+', ' ', text)
    text = re.sub(r'[^\x20-\x7E\u0900-\u097F]', ' ', text)  # keep ASCII + Devanagari
    return text.strip()

def chunk_text(text: str, source: str, url_or_file: str) -> list[dict]:
    """Split long text into overlapping chunks."""
    chunks = []
    start = 0
    text = clean_text(text)
    while start < len(text):
        end = min(start + CHUNK_SIZE, len(text))
        chunk = text[start:end]
        if len(chunk) > 60:   # skip tiny chunks
            chunks.append({
                "source": source,
                "ref":    url_or_file,
                "text":   chunk
            })
        start += CHUNK_SIZE - OVERLAP
    return chunks

def html_to_text(html: str) -> str:
    """Extract visible text from HTML, skipping scripts/styles."""
    soup = BeautifulSoup(html, 'lxml')
    for tag in soup(['script', 'style', 'noscript', 'meta', 'link', 'head']):
        tag.decompose()
    return soup.get_text(separator=' ')

# ── 1. Web Crawler ─────────────────────────────────────────────────────────────
def crawl_website(start_url: str, max_pages: int = 40) -> list[dict]:
    """BFS crawl within the same domain, return list of KB chunks."""
    from urllib.parse import urljoin, urlparse
    
    if not start_url.startswith('http'):
        start_url = 'https://' + start_url
    
    domain = urlparse(start_url).netloc
    visited = set()
    queue   = [start_url]
    all_chunks = []

    headers = {
        'User-Agent': 'Mozilla/5.0 (compatible; ZCSBot/1.0; school-chatbot)'
    }

    print(f"  [WEB] Crawling: {start_url}")
    while queue and len(visited) < max_pages:
        url = queue.pop(0)
        if url in visited:
            continue
        visited.add(url)

        try:
            resp = requests.get(url, headers=headers, timeout=10)
            if resp.status_code != 200:
                continue
            ct = resp.headers.get('content-type', '')
            if 'html' not in ct:
                continue

            text = html_to_text(resp.text)
            chunks = chunk_text(text, source='website', url_or_file=url)
            all_chunks.extend(chunks)
            print(f"    [OK] {url} -> {len(chunks)} chunks")

            # Discover new links
            soup = BeautifulSoup(resp.text, 'lxml')
            for a in soup.find_all('a', href=True):
                href = urljoin(url, a['href'])
                parsed = urlparse(href)
                # Stay on same domain, ignore anchors/external
                if parsed.netloc == domain and href not in visited:
                    href_clean = parsed._replace(fragment='', query='').geturl()
                    if href_clean not in visited:
                        queue.append(href_clean)

            time.sleep(0.5)   # polite delay
        except Exception as e:
            print(f"    [ERR] {url} -> {e}")
            continue

    print(f"  [OK] Crawled {len(visited)} pages, {len(all_chunks)} total chunks")
    return all_chunks

# ── 2. Local HTML Parser ───────────────────────────────────────────────────────
def parse_html_file(filepath: str) -> list[dict]:
    print(f"  [HTML] {os.path.basename(filepath)}")
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        html = f.read()
    text = html_to_text(html)
    chunks = chunk_text(text, source='local_html', url_or_file=os.path.basename(filepath))
    print(f"    [OK] {len(chunks)} chunks")
    return chunks

# ── 3. PDF Parser ──────────────────────────────────────────────────────────────
def parse_pdf_file(filepath: str) -> list[dict]:
    if PdfReader is None:
        print(f"  [SKIP] PDF (pypdf not installed): {filepath}")
        return []
    print(f"  [PDF] {os.path.basename(filepath)}")
    reader = PdfReader(filepath)
    full_text = ''
    for page in reader.pages:
        try:
            full_text += page.extract_text() or ''
        except Exception:
            pass
    chunks = chunk_text(full_text, source='pdf', url_or_file=os.path.basename(filepath))
    print(f"    [OK] {len(chunks)} chunks")
    return chunks

# ── Main Builder ───────────────────────────────────────────────────────────────
def build():
    print("\n[BUILD] Building Zenith Chatbot Knowledge Base...")
    print(f"   Source folder: {DB_DIR}")
    all_chunks = []

    # 1. Crawl URLs from website.txt
    urls_file = os.path.join(DB_DIR, 'website.txt')
    if os.path.exists(urls_file):
        with open(urls_file, 'r') as f:
            urls = [line.strip() for line in f if line.strip()]
        print(f"\n[1/3] Website Crawling ({len(urls)} URL(s))")
        for url in urls:
            try:
                chunks = crawl_website(url)
                all_chunks.extend(chunks)
            except Exception as e:
                print(f"  [ERR] Failed to crawl {url}: {e}")
    else:
        print("[1/3] No website.txt found — skipping")

    # 2. Parse local HTML & TXT files
    print(f"\n[2/3] Local HTML & TXT Files")
    local_files = [f for f in os.listdir(DB_DIR) if (f.endswith('.html') or f.endswith('.txt')) and f != 'website.txt']
    if local_files:
        for fname in local_files:
            try:
                chunks = parse_html_file(os.path.join(DB_DIR, fname))
                all_chunks.extend(chunks)
            except Exception as e:
                print(f"  [ERR] {fname}: {e}")
    else:
        print("  (none found)")

    # 3. Parse PDF files
    print(f"\n[3/3] PDF Files")
    pdf_files = [f for f in os.listdir(DB_DIR) if f.lower().endswith('.pdf')]
    if pdf_files:
        for fname in pdf_files:
            try:
                chunks = parse_pdf_file(os.path.join(DB_DIR, fname))
                all_chunks.extend(chunks)
            except Exception as e:
                print(f"  [ERR] {fname}: {e}")
    else:
        print("  (none found)")

    # Assign IDs
    for i, ch in enumerate(all_chunks):
        ch['id'] = i

    # Save
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(all_chunks, f, ensure_ascii=False, indent=2)

    print(f"\n[DONE] Knowledge base built successfully!")
    print(f"   Total chunks : {len(all_chunks)}")
    print(f"   Saved to     : {OUTPUT_FILE}")
    return all_chunks

if __name__ == '__main__':
    build()
