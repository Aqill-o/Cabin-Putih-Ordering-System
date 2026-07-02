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
    return `
        <div class="food-card">
            <div class="food-img-wrapper">
                <img src="${displayImageSrc}" alt="${item.name}">
                ${!item.available ? '<div class="sold-out-overlay"><span class="sold-out-pill">Sold Out</span></div>' : ''}
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
// Widened from 3 -> 6 cards, prioritizing pricier "premium" items
// (previously hardcoded to .slice(0, 3), which caused the sparse grid)
// ============================================================
function renderHomeRecommendations() {
    const recommendationGrid = document.getElementById('homeRecommendationsTargetGrid');
    if (recommendationGrid) {
        if (!window.globalCatalogItems || window.globalCatalogItems.length === 0) {
            recommendationGrid.innerHTML = '<div class="loading" style="color: var(--text-secondary);">No recommended menu rows active in kitchen inventory profiles.</div>';
        } else {
            const curatedPicks = [...window.globalCatalogItems]
                .sort((a, b) => b.price - a.price)
                .slice(0, 6);
            recommendationGrid.innerHTML = curatedPicks.map(item => generateHomeRecommendationCardHTML(item)).join('');
        }
    }

    // Fire off the two new sections alongside the existing recommendations
    renderPopularItems();
    renderRecentlyOrderedItems();
}

// ============================================================
// POPULAR ITEMS - top sellers across all customers
// ============================================================
async function renderPopularItems() {
    const grid = document.getElementById('homePopularItemsTargetGrid');
    if (!grid) return;

    grid.innerHTML = '<div class="loading" style="color: var(--text-secondary);">Fetching popular picks...</div>';

    try {
        const response = await fetch(`${window.API_BASE_URL}customer/popular_items`, { method: 'GET' });
        if (!response.ok) throw new Error('Failed to fetch popular items.');

        const data = await response.json();
        const items = data.items || [];

        if (items.length === 0) {
            grid.innerHTML = '<div class="loading" style="color: var(--text-secondary);">No order history yet to rank popular picks.</div>';
            return;
        }

        grid.innerHTML = items.map(item => generateHomeRecommendationCardHTML({
            id: item.id,
            name: item.name,
            price: parseFloat(item.price),
            qty: item.qty,
            type: item.type,
            available: item.available == 1 || item.available === true
        })).join('');
    } catch (err) {
        console.error("Popular items fetch fault:", err);
        grid.innerHTML = '<div class="loading" style="color: var(--text-secondary);">Unable to load popular items right now.</div>';
    }
}

// ============================================================
// RECENTLY ORDERED - this customer's own order history
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
        const items = data.items || [];

        if (items.length === 0) {
            // No order history yet -- hide this section entirely rather than show an empty box
            section.style.display = 'none';
            return;
        }

        section.style.display = '';
        grid.innerHTML = items.map(item => generateHomeRecommendationCardHTML({
            id: item.id,
            name: item.name,
            price: parseFloat(item.price),
            qty: item.qty,
            type: item.type,
            available: item.available == 1 || item.available === true
        })).join('');
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