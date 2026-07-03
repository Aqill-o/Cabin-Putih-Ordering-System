// ============================================================
// HOME MODULE - Chef's recommendations, popular items, recently ordered
// ============================================================

function generateHomeRecommendationCardHTML(item) {
    let displayImageSrc = 'https://images.pexels.com/photos/1251198/pexels-photo-1251198.jpeg?auto=compress&cs=tinysrgb&w=400&h=260';
    const itemType = String(item.type || 'burger').trim().toLowerCase();

    if (itemType === 'noodle') {
        displayImageSrc = 'https://images.pexels.com/photos/1907228/pexels-photo-1907228.jpeg?auto=compress&cs=tinysrgb&w=400&h=260';
    } else if (itemType === 'beverage') {
        displayImageSrc = 'https://images.pexels.com/photos/2474669/pexels-photo-2474669.jpeg?auto=compress&cs=tinysrgb&w=400&h=260';
    } else if (itemType === 'addon') {
        displayImageSrc = 'https://images.pexels.com/photos/4110251/pexels-photo-4110251.jpeg?auto=compress&cs=tinysrgb&w=400&h=260';
    }

    // Direct reference to the sanitized image path matching your menu cards
    if (item.imgUrl && 
        String(item.imgUrl).trim() !== '' && 
        String(item.imgUrl) !== 'null' && 
        String(item.imgUrl) !== 'undefined') {
        displayImageSrc = item.imgUrl;
    }

    return `
        <div class="food-card">
            <div class="food-img-wrapper" style="position: relative; width: 100%; padding-top: 66%; background-color: var(--bg-card); overflow: hidden;">
                <img src="${displayImageSrc}" alt="${item.name}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover;">
                ${!item.available ? '<div class="sold-out-overlay" style="position: absolute; inset: 0; background: rgba(11, 15, 25, 0.7); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center;"><span class="sold-out-pill" style="background: var(--danger); color: white; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; padding: 6px 16px; border-radius: 99px;">Sold Out</span></div>' : ''}
            </div>
            <div class="food-info">
                <div class="food-title">${item.name}</div>
                <div class="food-meta">
                    <div class="food-price">RM ${item.price.toFixed(2)}</div>
                </div>
            </div>
        </div>`;
}

// ============================================================
// CHEF'S RECOMMENDATIONS
// ============================================================
function renderHomeRecommendations() {
    // Fire off all sections consecutively using the updated safe master map patterns
    renderPopularItems();
    renderRecentlyOrderedItems();
}

// ============================================================
// POPULAR ITEMS - Cross-referenced with core master data
// ============================================================
async function renderPopularItems() {
    const grid = document.getElementById('homePopularItemsTargetGrid');
    if (!grid) return;

    grid.innerHTML = '<div class="loading" style="color: var(--text-secondary);">Fetching popular picks...</div>';

    try {
        const response = await fetch(`${window.API_BASE_URL}customer/popular_items`, { method: 'GET' });
        if (!response.ok) throw new Error('Failed to fetch popular items.');

        const data = await response.json();
        const apiItems = data.items || [];

        if (apiItems.length === 0) {
            grid.innerHTML = '<div class="loading" style="color: var(--text-secondary);">No order history yet to rank popular picks.</div>';
            return;
        }

        // Map through items, finding their full counterpart in global catalog to secure custom images
        const renderedCardsHtml = apiItems.map(apiItem => {
            const matchId = apiItem.id || apiItem.item_id || apiItem.ITEM_ID;
            const fullCatalogItem = window.globalCatalogItems.find(x => x.id === matchId);

            if (fullCatalogItem) {
                return generateHomeRecommendationCardHTML(fullCatalogItem);
            }

            // Fallback object if not found in catalog cache
            return generateHomeRecommendationCardHTML({
                id: matchId,
                name: apiItem.name || apiItem.item_name || 'Unnamed Recipe',
                price: parseFloat(apiItem.price || 0),
                type: apiItem.type || apiItem.item_type || 'burger',
                available: apiItem.available == 1 || apiItem.available === true,
                imgUrl: apiItem.item_image_url || apiItem.image_url || apiItem.IMAGE_URL
            });
        }).join('');

        grid.innerHTML = renderedCardsHtml;
    } catch (err) {
        console.error("Popular items fetch fault:", err);
        grid.innerHTML = '<div class="loading" style="color: var(--text-secondary);">Unable to load popular items right now.</div>';
    }
}

// ============================================================
// RECENTLY ORDERED - Cross-referenced with core master data
// ============================================================
async function renderRecentlyOrderedItems() {
    const section = document.getElementById('homeRecentlyOrderedSection');
    const grid = document.getElementById('homeRecentlyOrderedTargetGrid');
    if (!grid || !section) return;

    grid.innerHTML = '<div class="loading" style="color: var(--text-secondary);">Fetching your recent picks...</div>';

    try {
        const response = await fetch(`${window.API_BASE_URL}customer/recent_items?cust_id=${window.currentCustomerID}`, { method: 'GET' });
        if (!response.ok) throw new Error('Failed to fetch recent items.');

        const data = await response.json();
        const apiItems = data.items || [];

        if (apiItems.length === 0) {
            section.style.display = 'none';
            return;
        }

        section.style.display = '';

        // Map through items, utilizing window.globalCatalogItems to inherit the safe imgUrl state
        const renderedCardsHtml = apiItems.map(apiItem => {
            const matchId = apiItem.id || apiItem.item_id || apiItem.ITEM_ID;
            const fullCatalogItem = window.globalCatalogItems.find(x => x.id === matchId);

            if (fullCatalogItem) {
                return generateHomeRecommendationCardHTML(fullCatalogItem);
            }

            // Fallback object if not found in catalog cache
            return generateHomeRecommendationCardHTML({
                id: matchId,
                name: apiItem.name || apiItem.item_name || 'Unnamed Recipe',
                price: parseFloat(apiItem.price || 0),
                type: apiItem.type || apiItem.item_type || 'burger',
                available: apiItem.available == 1 || apiItem.available === true,
                imgUrl: apiItem.item_image_url || apiItem.image_url || apiItem.IMAGE_URL
            });
        }).join('');

        grid.innerHTML = renderedCardsHtml;
    } catch (err) {
        console.error("Recently ordered fetch fault:", err);
        section.style.display = 'none';
    }
}

// Export for module usage
window.generateHomeRecommendationCardHTML = generateHomeRecommendationCardHTML;
window.renderHomeRecommendations = renderHomeRecommendations;
window.renderPopularItems = renderPopularItems;
window.renderRecentlyOrderedItems = renderRecentlyOrderedItems;