from scraper import scrape_steam_specials
import os
import json

def test_steam_scraper():
    print("Running Steam Scraper test...")
    # Scrape just 1 page for verification speed
    deals = scrape_steam_specials(pages=1)
    
    # Assert we found deals
    assert len(deals) > 0, "No deals scraped from Steam Specials."
    print(f"Scraped {len(deals)} deals successfully!")
    
    # Assert cache file was created
    cache_path = os.path.join(os.path.dirname(__file__), 'deals_cache.json')
    assert os.path.exists(cache_path), "Cache file 'deals_cache.json' was not created."
    print("Cache file verified.")
    
    # Validate a sample deal
    sample = deals[0]
    required_fields = [
        'appid', 'title', 'link', 'capsule_img', 
        'discount_pct', 'original_price', 'final_price', 
        'original_price_val', 'final_price_val', 'platforms', 
        'rating_desc', 'rating_pct', 'rating_count', 'tags'
    ]
    
    for field in required_fields:
        assert field in sample, f"Field '{field}' missing from scraped deal data."
        
    print("\nSample deal verification:")
    print(f"Title: {sample['title']}".encode('utf-8'))
    print(f"AppID: {sample['appid']}")
    print(f"Discount: {sample['discount_pct']}")
    print(f"Original Price: {sample['original_price']}".encode('utf-8'))
    print(f"Final Price: {sample['final_price']}".encode('utf-8'))
    print(f"Platforms: {sample['platforms']}")
    print(f"Rating: {sample['rating_desc']} ({sample['rating_pct']}% from {sample['rating_count']} reviews)")
    print(f"Tags: {sample['tags'][:5]}")
    
    print("\nAll Scraper Assertions Passed!")

if __name__ == '__main__':
    try:
        test_steam_scraper()
    except AssertionError as e:
        print(f"Test Failed: {e}")
        exit(1)
    except Exception as e:
        print(f"Unexpected error during testing: {e}")
        exit(1)
