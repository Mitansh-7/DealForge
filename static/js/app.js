// Nebula Store - Application Logic

let allDeals = [];
let availableGenres = [];
let activeGenre = null;
let searchQuery = '';
let maxPrice = 5000; // default, will auto-adjust
let currencySymbol = '$'; // default, will detect from data
let sortBy = 'discount';
let isRefreshing = false;

document.addEventListener('DOMContentLoaded', () => {
    fetchDeals();
    setupEventListeners();
});

// Setup event listeners for filtering and sorting
function setupEventListeners() {
    const searchInput = document.getElementById('search-input');
    const priceSlider = document.getElementById('price-range');
    const sortSelect = document.getElementById('sort-select');
    const refreshBtn = document.getElementById('refresh-deals-btn');

    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase().strip();
        renderDeals();
    });

    priceSlider.addEventListener('input', (e) => {
        maxPrice = parseFloat(e.target.value);
        updatePriceSliderLabel();
        renderDeals();
    });

    sortSelect.addEventListener('change', (e) => {
        sortBy = e.target.value;
        renderDeals();
    });

    refreshBtn.addEventListener('click', () => {
        if (!isRefreshing) {
            refreshDeals();
        }
    });
}

// Strip helper
String.prototype.strip = function() {
    return this.replace(/^\s+|\s+$/g, '');
};

// Fetch deals from cache endpoint
async function fetchDeals() {
    showLoadingSkeletons();
    try {
        const response = await fetch('/api/deals');
        if (response.ok) {
            const data = await response.json();
            allDeals = data.deals || [];
            availableGenres = data.genres || [];
            
            // Detect currency from scraped prices
            detectCurrencySymbol(allDeals);
            
            // Set slider max price based on highest price in deals
            adjustPriceSliderLimit(allDeals);
            
            // Render filter chips and grid
            renderGenreChips();
            renderSpotlightHero(data.featured);
            renderDeals();
        } else {
            console.error("Failed to load deals:", response.status);
        }
    } catch (e) {
        console.error("Error loading deals:", e);
    }
}

// Force scrape fresh deals from Steam
async function refreshDeals() {
    isRefreshing = true;
    const refreshBtn = document.getElementById('refresh-deals-btn');
    const refreshIcon = document.getElementById('refresh-icon');
    
    // UI Loading state
    refreshBtn.classList.add('loading');
    showLoadingSkeletons();
    
    try {
        const response = await fetch('/api/refresh', { method: 'POST' });
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                allDeals = data.deals || [];
                availableGenres = data.genres || [];
                
                detectCurrencySymbol(allDeals);
                adjustPriceSliderLimit(allDeals);
                
                renderGenreChips();
                renderSpotlightHero(data.featured);
                renderDeals();
            } else {
                alert("Scraping error: " + (data.error || "Unknown error"));
            }
        } else {
            alert("Failed to connect to refresh endpoint. Server returned: " + response.status);
        }
    } catch (e) {
        console.error("Error refreshing deals:", e);
        alert("Error connecting to server. Please try again.");
    } finally {
        isRefreshing = false;
        refreshBtn.classList.remove('loading');
    }
}

// Show skeleton loading animations
function showLoadingSkeletons() {
    // Show Hero Skeleton
    document.getElementById('hero-skeleton').classList.remove('hidden');
    document.getElementById('hero-card-content').classList.add('hidden');
    
    // Build grid skeletons
    const gridWrapper = document.getElementById('deals-grid-wrapper');
    const budgetWrapper = document.getElementById('budget-deals-wrapper');
    
    let skeletonHtml = '';
    for (let i = 0; i < 4; i++) {
        skeletonHtml += `
            <div class="rate-card skeleton-card">
                <div class="card-image skeleton-image skeleton-pulse"></div>
                <div class="card-details">
                    <div class="skeleton-title skeleton-pulse" style="width: 80%; height: 16px; margin-bottom: 0.5rem;"></div>
                    <div class="skeleton-subtitle skeleton-pulse" style="width: 50%; height: 12px; margin-bottom: 1rem;"></div>
                    <div class="skeleton-rating skeleton-pulse" style="width: 60%; height: 12px; margin-bottom: 1.5rem;"></div>
                    <div class="skeleton-price skeleton-pulse" style="width: 40%; height: 16px; margin-left: auto;"></div>
                </div>
            </div>
        `;
    }
    
    gridWrapper.innerHTML = skeletonHtml;
    budgetWrapper.innerHTML = skeletonHtml;
}

// Detect currency symbol dynamically from pricing strings
function detectCurrencySymbol(deals) {
    for (const deal of deals) {
        const priceStr = deal.original_price || deal.final_price;
        if (priceStr) {
            // Find currency symbols: $, ₹, €, £, ¥, C$, etc.
            const match = priceStr.match(/[^\d,.\s]+/);
            if (match) {
                currencySymbol = match[0].strip();
                break;
            }
        }
    }
    console.log("Detected local pricing currency:", currencySymbol);
}

// Set maximum values on the slider based on scraped prices
function adjustPriceSliderLimit(deals) {
    let max = 1000;
    deals.forEach(deal => {
        const val = deal.final_price_val;
        if (val > max) max = val;
    });
    
    // Round to nearest 500
    max = Math.ceil(max / 500) * 500;
    
    const slider = document.getElementById('price-range');
    slider.max = max;
    slider.value = max;
    maxPrice = max;
    
    updatePriceSliderLabel();
}

// Update label display next to slider
function updatePriceSliderLabel() {
    const display = document.getElementById('price-limit-display');
    const slider = document.getElementById('price-range');
    if (parseFloat(slider.value) === 0) {
        display.textContent = 'Free';
    } else {
        display.textContent = `${currencySymbol}${parseFloat(slider.value).toLocaleString()}`;
    }
}

// Render dynamic genre filtering chips
function renderGenreChips() {
    const wrapper = document.getElementById('genre-chips-wrapper');
    wrapper.innerHTML = '';
    
    // Add "All" Chip
    const allChip = document.createElement('div');
    allChip.className = `genre-chip ${activeGenre === null ? 'active' : ''}`;
    allChip.textContent = 'All Genres';
    allChip.addEventListener('click', () => {
        activeGenre = null;
        document.querySelectorAll('.genre-chip').forEach(c => c.classList.remove('active'));
        allChip.classList.add('active');
        document.querySelectorAll('.quickplay-item').forEach(c => c.classList.remove('active'));
        renderDeals();
    });
    wrapper.appendChild(allChip);
    
    // Filter to top 15 genres to avoid cluttering layout
    const topGenres = availableGenres.slice(0, 15);
    
    topGenres.forEach(genre => {
        const chip = document.createElement('div');
        chip.className = `genre-chip ${activeGenre === genre ? 'active' : ''}`;
        chip.textContent = genre;
        chip.addEventListener('click', () => {
            if (activeGenre === genre) {
                activeGenre = null;
                chip.classList.remove('active');
                allChip.classList.add('active');
            } else {
                activeGenre = genre;
                document.querySelectorAll('.genre-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
            }
            syncQuickplaySidebarHighlight();
            renderDeals();
        });
        wrapper.appendChild(chip);
    });
}

// Quickplay sidebar genre selection shortcuts
function setQuickplayGenre(genre) {
    activeGenre = genre;
    
    // Update chips highlights
    document.querySelectorAll('.genre-chip').forEach(chip => {
        if (chip.textContent === genre) {
            chip.classList.add('active');
        } else {
            chip.classList.remove('active');
        }
    });
    
    // Update sidebar active highlights
    document.querySelectorAll('.quickplay-item').forEach(item => {
        const text = item.querySelector('span').textContent;
        if (text.includes(genre)) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
    
    renderDeals();
}

function syncQuickplaySidebarHighlight() {
    document.querySelectorAll('.quickplay-item').forEach(item => {
        const text = item.querySelector('span').textContent;
        if (activeGenre && text.includes(activeGenre)) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}

// Render Featured Spotlight Hero Card
function renderSpotlightHero(featured) {
    if (!featured) {
        document.getElementById('hero-skeleton').classList.remove('hidden');
        document.getElementById('hero-card-content').classList.add('hidden');
        return;
    }
    
    // Fade skeletons
    document.getElementById('hero-skeleton').classList.add('hidden');
    const heroCard = document.getElementById('hero-card-content');
    heroCard.classList.remove('hidden');
    heroCard.classList.add('fade-in');
    
    // Set details
    const highResImg = `https://cdn.akamai.steamstatic.com/steam/apps/${featured.appid}/header.jpg`;
    document.getElementById('hero-game-img').src = highResImg;
    document.getElementById('hero-game-img').onerror = function() {
        this.onerror = null;
        this.src = featured.capsule_img;
    };
    document.getElementById('hero-bg-blur').style.backgroundImage = `url(${highResImg})`;
    document.getElementById('hero-game-title').textContent = featured.title;
    
    // Extract first few tags as dev/tag text
    const tags = featured.tags || [];
    document.getElementById('hero-game-dev').textContent = tags.length > 0 ? tags.slice(0, 3).join(' • ') : 'Steam Special Deal';
    
    // Ratings
    document.getElementById('hero-rating-pct').textContent = `${featured.rating_pct}%`;
    document.getElementById('hero-rating-desc').textContent = featured.rating_desc;
    document.getElementById('hero-reviews-count').textContent = `${featured.rating_count.toLocaleString()} user reviews`;
    
    // Prices
    document.getElementById('hero-old-price').textContent = featured.original_price;
    document.getElementById('hero-new-price').textContent = featured.final_price;
    
    // Links
    document.getElementById('hero-buy-btn').href = featured.link;
}

// Render main cards grid
function renderDeals() {
    const gridWrapper = document.getElementById('deals-grid-wrapper');
    const budgetWrapper = document.getElementById('budget-deals-wrapper');
    
    if (allDeals.length === 0) {
        gridWrapper.innerHTML = `<div class="empty-state">No active deals found. Click refresh to sync.</div>`;
        return;
    }
    
    // Filter deals
    let filtered = allDeals.filter(deal => {
        // Search filter
        const matchesSearch = deal.title.toLowerCase().includes(searchQuery);
        
        // Price limit filter
        const matchesPrice = deal.final_price_val <= maxPrice;
        
        // Genre tag filter
        const matchesGenre = activeGenre === null || (deal.tags && deal.tags.includes(activeGenre));
        
        return matchesSearch && matchesPrice && matchesGenre;
    });
    
    // Sort deals
    filtered.sort((a, b) => {
        if (sortBy === 'discount') {
            return b.discount_val - a.discount_val; // high to low
        } else if (sortBy === 'price-low') {
            return a.final_price_val - b.final_price_val; // low to high
        } else if (sortBy === 'rating') {
            return b.rating_pct - a.rating_pct; // high to low
        } else if (sortBy === 'title') {
            return a.title.localeCompare(b.title); // alphabetical
        }
        return 0;
    });
    
    // 1. Render Main Grid ("For You" section)
    gridWrapper.innerHTML = '';
    filtered.forEach(deal => {
        gridWrapper.appendChild(createDealCard(deal));
    });
    
    if (filtered.length === 0) {
        gridWrapper.innerHTML = `<div class="empty-state" style="grid-column: span 4; text-align: center; padding: 3rem; color: var(--text-muted);">No deals match your active filters.</div>`;
    }
    
    // 2. Render Budget Section (Deals under $10 or ₹500, depending on currency)
    const budgetThreshold = currencySymbol === '₹' ? 500 : 10;
    const budgetDeals = allDeals.filter(deal => deal.final_price_val > 0 && deal.final_price_val <= budgetThreshold)
                                 .sort((a, b) => b.discount_val - a.discount_val) // sort by discount
                                 .slice(0, 4); // Limit to 4 cards
                                 
    budgetWrapper.innerHTML = '';
    budgetDeals.forEach(deal => {
        budgetWrapper.appendChild(createDealCard(deal));
    });
    
    if (budgetDeals.length === 0) {
        budgetWrapper.innerHTML = `<div class="empty-state" style="grid-column: span 4; text-align: center; padding: 2rem; color: var(--text-muted);">No budget bargains currently available.</div>`;
    }
}

// Create Card HTML element for a deal
function createDealCard(deal) {
    const card = document.createElement('a');
    card.href = deal.link;
    card.target = '_blank';
    card.className = 'rate-card fade-in';
    
    // Render platforms
    const winActive = deal.platforms.includes('win') ? 'active' : '';
    const macActive = deal.platforms.includes('mac') ? 'active' : '';
    const linActive = deal.platforms.includes('linux') ? 'active' : '';
    
    // Build tags line
    const tagsText = deal.tags && deal.tags.length > 0 ? deal.tags.slice(0, 2).join(', ') : 'Special';
    
    // Thumbs icon rating color
    const thumbClass = deal.rating_pct >= 80 ? 'text-purple' : 'text-muted';
    
    // Determine price pill formatting
    const isFree = deal.final_price_val === 0 || deal.final_price.toLowerCase().includes('free');
    const isDiscounted = deal.discount_pct !== '0%' && deal.discount_pct !== '';
    
    let priceHtml = '';
    if (isFree) {
        priceHtml = `<span class="new-price">FREE</span>`;
    } else if (isDiscounted) {
        priceHtml = `
            <span class="old-price">${deal.original_price}</span>
            <span class="new-price">${deal.final_price}</span>
        `;
    } else {
        priceHtml = `<span class="new-price">${deal.final_price}</span>`;
    }
    
    const discountClass = isDiscounted ? 'discounted' : '';
    const freeClass = isFree ? 'badge-free' : '';
    
    const cardImgUrl = `https://cdn.akamai.steamstatic.com/steam/apps/${deal.appid}/header.jpg`;
    
    card.innerHTML = `
        <div class="card-image">
            <img src="${cardImgUrl}" alt="${deal.title}" loading="lazy" onerror="this.onerror=null; this.src='${deal.capsule_img}';">
            ${isDiscounted ? `<span class="discount-badge">${deal.discount_pct}</span>` : ''}
        </div>
        <div class="card-details">
            <div class="card-info-left">
                <h3 class="card-title" title="${deal.title}">${deal.title}</h3>
                <span class="card-subtitle">${tagsText}</span>
                <div class="card-rating">
                    <i class="fa-solid fa-thumbs-up ${thumbClass}"></i>
                    <span class="rating-pct">${deal.rating_pct}%</span>
                    <span class="platform-indicators">
                        <i class="fa-brands fa-windows active" title="Windows PC Support"></i>
                    </span>
                </div>
            </div>
            <div class="card-info-right">
                <div class="card-price-pill ${discountClass} ${freeClass}">
                    ${priceHtml}
                </div>
            </div>
        </div>
    `;
    
    return card;
}
