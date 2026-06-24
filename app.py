from flask import Flask, render_template, jsonify
from scraper import get_cached_deals, scrape_steam_specials
import os

app = Flask(__name__)

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/deals")
def api_deals():
    """
    Returns cached deals, along with unique genres for filtering and a featured spotlight deal.
    """
    data = get_cached_deals()
    deals = data.get('deals', [])
    last_updated = data.get('last_updated', '')
    
    # Extract unique genres/tags
    genres_set = set()
    for deal in deals:
        for tag in deal.get('tags', []):
            if tag:
                genres_set.add(tag)
                
    # Sort genres alphabetically
    sorted_genres = sorted(list(genres_set))
    
    # Pick a featured deal: highest discount percentage
    featured = None
    if deals:
        # Sort by discount percentage descending, then by reviews descending
        sorted_by_deal = sorted(deals, key=lambda x: (x.get('discount_val', 0), x.get('rating_pct', 0)), reverse=True)
        # Select the top one as the featured spotlight game
        featured = sorted_by_deal[0]
        
    return jsonify({
        'last_updated': last_updated,
        'deals': deals,
        'genres': sorted_genres,
        'featured': featured
    })

@app.route("/api/refresh", methods=["POST"])
def api_refresh():
    """
    Force triggers a scrape of Steam Specials and updates the cache.
    """
    try:
        deals = scrape_steam_specials(pages=3)
        
        # Extract unique genres/tags
        genres_set = set()
        for deal in deals:
            for tag in deal.get('tags', []):
                if tag:
                    genres_set.add(tag)
        sorted_genres = sorted(list(genres_set))
        
        # Pick featured deal
        featured = None
        if deals:
            sorted_by_deal = sorted(deals, key=lambda x: (x.get('discount_val', 0), x.get('rating_pct', 0)), reverse=True)
            featured = sorted_by_deal[0]
            
        import time
        last_updated = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
        
        return jsonify({
            'success': True,
            'last_updated': last_updated,
            'deals': deals,
            'genres': sorted_genres,
            'featured': featured
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True, port=5000)
