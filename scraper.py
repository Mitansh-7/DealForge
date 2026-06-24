import requests
from bs4 import BeautifulSoup
import re
import json
import time
import os

CACHE_FILE = os.path.join(os.path.dirname(__file__), 'deals_cache.json')

def scrape_steam_specials(pages=3):
    """
    Scrapes Steam specials search results and builds a local structured list of deals.
    Includes tag extraction and reviews parsing.
    """
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
    }
    
    base_url = 'https://store.steampowered.com/search/?specials=1'
    
    print("Initiating Steam Specials scrape...")
    try:
        response = requests.get(base_url, headers=headers, timeout=15)
        response.raise_for_status()
    except Exception as e:
        print(f"Error connecting to Steam Store: {e}")
        return []
        
    soup = BeautifulSoup(response.text, 'html.parser')
    
    # 1. Parse sidebar to get all tag mappings (ID -> Name)
    tag_map = {}
    sidebar_rows = soup.select('.tab_filter_control_row')
    for row in sidebar_rows:
        val = row.get('data-value')
        loc = row.get('data-loc')
        param = row.get('data-param')
        if val and loc and param == 'tags':
            tag_map[val] = loc
            
    print(f"Loaded {len(tag_map)} tag mappings from sidebar.")
    
    deals = []
    
    # 2. Iterate pages to fetch deal listings
    for page in range(1, pages + 1):
        print(f"Scraping page {page}...")
        if page > 1:
            url = f"{base_url}&page={page}"
            try:
                response = requests.get(url, headers=headers, timeout=15)
                response.raise_for_status()
                soup = BeautifulSoup(response.text, 'html.parser')
            except Exception as e:
                print(f"Error fetching page {page}: {e}")
                continue
                
        rows = soup.select('.search_result_row')
        print(f"Found {len(rows)} games on page {page}.")
        
        for row in rows:
            appid = row.get('data-ds-appid')
            if not appid:
                continue
                
            title_el = row.select_one('.search_name .title')
            title = title_el.text.strip() if title_el else 'Unknown Game'
            
            link = row.get('href', '')
            
            # Game thumbnail capsule
            img_el = row.select_one('.search_capsule img')
            capsule_img = img_el.get('src') if img_el else ''
            
            # Pricing
            pct_el = row.select_one('.discount_pct')
            orig_el = row.select_one('.discount_original_price')
            final_el = row.select_one('.discount_final_price')
            
            discount_pct = pct_el.text.strip() if pct_el else '0%'
            original_price = orig_el.text.strip() if orig_el else ''
            final_price = final_el.text.strip() if final_el else ''
            
            # Helper to parse price digits (e.g. ₹2,999.00 -> 2999.0)
            def parse_numeric_price(price_str):
                if not price_str:
                    return 0.0
                match = re.search(r'[\d,.]+', price_str)
                if match:
                    num_str = match.group().replace(',', '')
                    try:
                        return float(num_str)
                    except ValueError:
                        return 0.0
                return 0.0
                
            orig_val = parse_numeric_price(original_price)
            final_val = parse_numeric_price(final_price)
            
            # If no discount price exists, check if there's any price in the regular search results
            if not final_price:
                price_el = row.select_one('.search_price')
                if price_el:
                    final_price = price_el.text.strip()
                    final_val = parse_numeric_price(final_price)
                    original_price = final_price
                    orig_val = final_val
            
            # Platforms
            platforms = []
            plat_div = row.select_one('.search_platforms')
            if plat_div:
                for span in plat_div.select('span.platform_img'):
                    for cls in span.get('class', []):
                        if cls in ['win', 'mac', 'linux']:
                            platforms.append(cls)
            
            # Reviews
            rating_desc = 'No Reviews'
            rating_pct = 0
            rating_count = 0
            
            review_el = row.select_one('.search_review_summary')
            if review_el and review_el.get('data-tooltip-html'):
                tooltip = review_el.get('data-tooltip-html')
                parts = tooltip.split('<br>')
                if len(parts) > 0:
                    rating_desc = parts[0].strip()
                if len(parts) > 1:
                    pct_match = re.search(r'(\d+)%', parts[1])
                    count_match = re.search(r'([\d,]+)\s+user reviews', parts[1])
                    if pct_match:
                        rating_pct = int(pct_match.group(1))
                    if count_match:
                        rating_count = int(count_match.group(1).replace(',', ''))
                        
            # Tags
            tag_ids_raw = row.get('data-ds-tagids', '[]')
            try:
                tag_ids = json.loads(tag_ids_raw)
            except Exception:
                tag_ids = []
                
            tags = [tag_map[str(tid)] for tid in tag_ids if str(tid) in tag_map]
            
            # Get clean discount value
            disc_val = 0
            if discount_pct != '0%':
                try:
                    disc_val = int(discount_pct.replace('%', '').replace('-', ''))
                except ValueError:
                    disc_val = 0
            
            deals.append({
                'appid': appid,
                'title': title,
                'link': link,
                'capsule_img': capsule_img,
                'discount_pct': discount_pct,
                'discount_val': disc_val,
                'original_price': original_price,
                'original_price_val': orig_val,
                'final_price': final_price,
                'final_price_val': final_val,
                'platforms': list(set(platforms)),
                'rating_desc': rating_desc,
                'rating_pct': rating_pct,
                'rating_count': rating_count,
                'tag_ids': tag_ids,
                'tags': tags
            })
            
        # Respectful delay between requests
        time.sleep(0.5)
        
    print(f"Scrape completed. Found {len(deals)} valid deals.")
    
    # Save cache
    cache_data = {
        'last_updated': datetime_now_iso(),
        'deals': deals
    }
    
    try:
        with open(CACHE_FILE, 'w', encoding='utf-8') as f:
            json.dump(cache_data, f, indent=4, ensure_ascii=False)
        print("Data saved to cache successfully.")
    except Exception as e:
        print(f"Failed to write cache file: {e}")
        
    return deals

def datetime_now_iso():
    # Simple ISO datetime helper
    return time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())

def get_cached_deals():
    """
    Retrieves deals from the local cache file.
    If the file does not exist, triggers a fresh scrape.
    """
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return data
        except Exception as e:
            print(f"Failed reading cache: {e}")
            
    # Trigger scrape if no cache exists
    deals = scrape_steam_specials(pages=3)
    return {
        'last_updated': datetime_now_iso(),
        'deals': deals
    }

if __name__ == '__main__':
    # Test scraper directly
    scrape_steam_specials(pages=1)
