// ============================================================
// MANAGER ANALYTICS MODULE - KPI stats, line chart, bar chart, pie chart
// Now powered directly by ORDS auto-REST enabled objects
// (orders/, payment/, optionally employee/) instead of custom endpoints.
// ============================================================

const ORDS_BASE_URL = 'https://oracleapex.com/ords/cabin_putih/';

let currentAnalyticsInterval = 'weekly';

// Cache of the joined orders+payment dataset for the current page load,
// so switching intervals doesn't re-fetch the whole table every time.
let cachedJoinedOrders = null;

// ------------------------------------------------------------------
// ORDS fetching helpers
// ------------------------------------------------------------------

// ORDS auto-REST paginates (default page size is small). This walks every
// page via `hasMore` until the full result set has been collected.
async function fetchAllOrdsRows(resourcePath) {
    let allRows = [];
    let offset = 0;
    const pageSize = 500;

    while (true) {
        const url = `${ORDS_BASE_URL}${resourcePath}?limit=${pageSize}&offset=${offset}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`ORDS request failed for "${resourcePath}" (status ${res.status})`);
        const data = await res.json();
        const items = data.items || [];
        allRows = allRows.concat(items);

        if (!data.hasMore || items.length === 0) break;
        offset += items.length;
    }

    return allRows;
}

// Reads a field off an ORDS row regardless of case (Oracle unquoted
// identifiers come back uppercase, e.g. "DINING_TYPE", but this stays
// defensive in case the workspace has quoted/lowercase columns).
function readField(row, fieldName) {
    if (row[fieldName] !== undefined) return row[fieldName];
    if (row[fieldName.toUpperCase()] !== undefined) return row[fieldName.toUpperCase()];
    if (row[fieldName.toLowerCase()] !== undefined) return row[fieldName.toLowerCase()];
    return undefined;
}

// Fetches ORDERS + PAYMENT and joins them client-side (PAYMENT_ID -> PAY_ID),
// filtering out cancelled orders. Cached for the lifetime of the page.
async function fetchJoinedOrders(forceRefresh = false) {
    if (cachedJoinedOrders && !forceRefresh) return cachedJoinedOrders;

    const [orders, payments] = await Promise.all([
        fetchAllOrdsRows('orders/'),
        fetchAllOrdsRows('payment/')
    ]);

    const paymentById = new Map();
    payments.forEach(p => {
        const payId = String(readField(p, 'PAY_ID') || '').trim();
        paymentById.set(payId, {
            amount: parseFloat(readField(p, 'TOTAL_AMOUNT') || 0),
            payType: String(readField(p, 'PAY_TYPE') || 'Unknown').trim()
        });
    });

    cachedJoinedOrders = orders
        .filter(o => String(readField(o, 'ORDER_STATUS') || '').trim().toLowerCase() !== 'cancelled')
        .map(o => {
            const payId = String(readField(o, 'PAYMENT_ID') || '').trim();
            const paymentInfo = paymentById.get(payId) || { amount: 0, payType: 'Unknown' };
            return {
                orderId: readField(o, 'ORDER_ID'),
                diningType: String(readField(o, 'DINING_TYPE') || 'Unknown').trim(),
                status: String(readField(o, 'ORDER_STATUS') || '').trim(),
                employeeNum: String(readField(o, 'EMPLOYEE_NUM') || '').trim(),
                dateOrder: new Date(readField(o, 'DATE_ORDER')),
                amount: paymentInfo.amount,
                paymentType: paymentInfo.payType
            };
        })
        .filter(o => !isNaN(o.dateOrder.getTime()));

    return cachedJoinedOrders;
}

// Best-effort staff count: tries a dedicated `employee/` ORDS object first;
// if it isn't enabled, falls back to counting distinct employees who show
// up in the given (already interval-filtered) orders.
async function fetchTotalStaffCount(intervalOrders) {
    try {
        const employees = await fetchAllOrdsRows('employee/');
        if (employees.length > 0) return employees.length;
    } catch (e) {
        console.warn('employee/ ORDS object not available, falling back to distinct staff in orders.', e);
    }
    const distinctEmployees = new Set(intervalOrders.map(o => o.employeeNum).filter(Boolean));
    return distinctEmployees.size;
}

// ------------------------------------------------------------------
// Interval / bucket logic
// ------------------------------------------------------------------

// Date range that each interval covers:
//   weekly   -> current ISO week (Mon-Sun)
//   monthly  -> current calendar year (bucketed Jan-Dec)
//   quarters -> current calendar year (bucketed into 4 quarters)
//   yearly   -> current year + prior 2 years (bucketed by year)
function getIntervalDateRange(intervalMode) {
    const now = new Date();

    if (intervalMode === 'weekly') {
        const day = now.getDay(); // 0=Sun..6=Sat
        const diffToMonday = (day === 0 ? -6 : 1 - day);
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday);
        const end = new Date(start);
        end.setDate(start.getDate() + 7);
        return { start, end };
    }

    if (intervalMode === 'monthly' || intervalMode === 'quarters') {
        const start = new Date(now.getFullYear(), 0, 1);
        const end = new Date(now.getFullYear() + 1, 0, 1);
        return { start, end };
    }

    if (intervalMode === 'yearly') {
        const start = new Date(now.getFullYear() - 2, 0, 1);
        const end = new Date(now.getFullYear() + 1, 0, 1);
        return { start, end };
    }

    return { start: new Date(0), end: new Date(8640000000000000) };
}

function filterOrdersByInterval(orders, intervalMode) {
    const { start, end } = getIntervalDateRange(intervalMode);
    return orders.filter(o => o.dateOrder >= start && o.dateOrder < end);
}

// Assigns each order to a bucket key that matches generateTimelineTemplate()'s keys exactly.
function getBucketKeyForOrder(order, intervalMode) {
    const date = order.dateOrder;

    if (intervalMode === 'weekly') {
        const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']; // Date.getDay(): 0=Sun
        return WEEKDAY_KEYS[date.getDay()];
    }
    if (intervalMode === 'monthly') {
        const MONTH_KEYS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
        return MONTH_KEYS[date.getMonth()];
    }
    if (intervalMode === 'quarters') {
        // Every month rolls up to its quarter's closing month: Mar/Jun/Sep/Dec
        const QUARTER_END_KEYS = ['mar', 'mar', 'mar', 'jun', 'jun', 'jun', 'sep', 'sep', 'sep', 'dec', 'dec', 'dec'];
        return QUARTER_END_KEYS[date.getMonth()];
    }
    if (intervalMode === 'yearly') {
        return String(date.getFullYear());
    }
    return null;
}

// NOTE: these templates define the fixed bucket set for each interval:
//   weekly   -> Mon..Sun for the current week
//   monthly  -> Jan..Dec for the current year
//   quarters -> Q1..Q4 (labeled Mar/Jun/Sep/Dec) for the current year
//   yearly   -> current year + prior 2 years (dynamic, not hardcoded)
function generateTimelineTemplate(intervalMode) {
    if (intervalMode === 'weekly') {
        return [
            { key: 'mon', name: 'Mon', value: 0 },
            { key: 'tue', name: 'Tue', value: 0 },
            { key: 'wed', name: 'Wed', value: 0 },
            { key: 'thu', name: 'Thu', value: 0 },
            { key: 'fri', name: 'Fri', value: 0 },
            { key: 'sat', name: 'Sat', value: 0 },
            { key: 'sun', name: 'Sun', value: 0 }
        ];
    }

    if (intervalMode === 'monthly') {
        const MONTH_KEYS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
        const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return MONTH_KEYS.map((key, idx) => ({ key, name: MONTH_NAMES[idx], value: 0 }));
    }

    if (intervalMode === 'quarters') {
        return [
            { key: 'mar', name: 'Q1', value: 0 },
            { key: 'jun', name: 'Q2', value: 0 },
            { key: 'sep', name: 'Q3', value: 0 },
            { key: 'dec', name: 'Q4', value: 0 }
        ];
    }

    if (intervalMode === 'yearly') {
        const currentYear = new Date().getFullYear();
        const years = [currentYear - 2, currentYear - 1, currentYear];
        return years.map(year => ({ key: String(year), name: String(year), value: 0 }));
    }

    return [];
}

// ------------------------------------------------------------------
// Aggregation (replaces what the old custom SQL endpoints used to do)
// ------------------------------------------------------------------

function aggregateSalesByBucket(intervalOrders, intervalMode) {
    const template = generateTimelineTemplate(intervalMode);
    const bucketByKey = new Map(template.map(t => [t.key, t]));

    intervalOrders.forEach(order => {
        const key = getBucketKeyForOrder(order, intervalMode);
        const bucket = bucketByKey.get(key);
        if (bucket) bucket.value += order.amount;
    });

    return template;
}

function aggregateOrderCountByBucketAndDiningType(intervalOrders, intervalMode) {
    const template = generateTimelineTemplate(intervalMode);
    const bucketByKey = new Map(template.map(t => [t.key, t]));

    const diningTypes = Array.from(new Set(intervalOrders.map(o => o.diningType))).sort();

    template.forEach(bucket => {
        bucket.valuesByType = {};
        diningTypes.forEach(type => { bucket.valuesByType[type] = 0; });
    });

    intervalOrders.forEach(order => {
        const key = getBucketKeyForOrder(order, intervalMode);
        const bucket = bucketByKey.get(key);
        if (!bucket) return;
        bucket.valuesByType[order.diningType] = (bucket.valuesByType[order.diningType] || 0) + 1;
    });

    return { template, diningTypes };
}

function aggregateRevenueShareByPaymentType(intervalOrders) {
    const totalByType = new Map();
    intervalOrders.forEach(order => {
        totalByType.set(order.paymentType, (totalByType.get(order.paymentType) || 0) + order.amount);
    });
    return Array.from(totalByType.entries()).map(([paymentType, total]) => ({ paymentType, total }));
}

// ------------------------------------------------------------------
// Main refresh entry point
// ------------------------------------------------------------------

async function fetchExecutiveSummaryStatistics() {
    try {
        const allOrders = await fetchJoinedOrders();
        const intervalOrders = filterOrdersByInterval(allOrders, currentAnalyticsInterval);

        const grossRevenue = intervalOrders.reduce((sum, o) => sum + o.amount, 0);
        const totalTickets = intervalOrders.length;
        // ASSUMPTION: "active" = not Completed (Cancelled orders are already excluded entirely).
        // Adjust this if your actual status values differ (e.g. 'Pending', 'Preparing', 'Ready').
        const activeQueues = intervalOrders.filter(o => o.status.toLowerCase() !== 'completed').length;
        const totalStaff = await fetchTotalStaffCount(intervalOrders);

        document.getElementById('statGrossRevenue').innerText = `RM ${grossRevenue.toFixed(2)}`;
        document.getElementById('statTotalOrders').innerText = totalTickets;
        document.getElementById('statActiveOrders').innerText = activeQueues;
        document.getElementById('statTotalStaff').innerText = totalStaff;

        updateChartsTextHeaderLabels();

        renderSalesLineGraph(intervalOrders);
        renderDiningTypeClusterChart(intervalOrders);
        renderPaymentMethodPieGraph(intervalOrders);
    } catch (e) {
        console.error("Summary metrics failed initialization maps.", e);
    }
}

async function handleIntervalFilterChange() {
    const filterSelect = document.getElementById('ddlAnalyticsInterval');
    if (!filterSelect) return;
    currentAnalyticsInterval = filterSelect.value;
    await fetchExecutiveSummaryStatistics();
}

function updateChartsTextHeaderLabels() {
    const capitalized = currentAnalyticsInterval.charAt(0).toUpperCase() + currentAnalyticsInterval.slice(1);

    document.getElementById('lblRevenueBarChartTitle').innerText = `${capitalized} Total Orders by Dining Type`;
    document.getElementById('lblSalesLineChartTitle').innerText = `${capitalized} Total Sales Trend Performance (RM)`;
    document.getElementById('lblPieChartTitle').innerText = `Revenue Share by Payment Method (${capitalized})`;
}

// ------------------------------------------------------------------
// Rendering (SVG-building logic unchanged from before - just fed
// pre-aggregated, already-in-memory data instead of a fetch response)
// ------------------------------------------------------------------

function renderSalesLineGraph(intervalOrders) {
    const svg = document.getElementById('svgWeeklySalesLineChart');
    if (!svg) return;
    svg.innerHTML = '';

    const timelineTemplate = aggregateSalesByBucket(intervalOrders, currentAnalyticsInterval);

    const maxSalesValue = Math.max(...timelineTemplate.map(d => d.value), 10);
    const chartHeightBoundary = 180;
    const totalPointsCount = timelineTemplate.length;

    const svgCanvasWidth = 700;
    const chartInlinePadding = 40;
    const usableGraphWidth = svgCanvasWidth - (chartInlinePadding * 2);
    const horizontalWidthStep = totalPointsCount > 1 ? usableGraphWidth / (totalPointsCount - 1) : usableGraphWidth;

    svg.innerHTML += `<line x1="${chartInlinePadding}" y1="${chartHeightBoundary}" x2="${svgCanvasWidth - chartInlinePadding}" y2="${chartHeightBoundary}" stroke="var(--border)" stroke-width="2"/>`;

    let pointsPathString = "";
    let areaFillPathString = `${chartInlinePadding},${chartHeightBoundary} `;

    const coordinatesMatrix = timelineTemplate.map((pt, index) => {
        const positionX = chartInlinePadding + (index * horizontalWidthStep);
        const proportionalHeight = (pt.value / maxSalesValue) * chartHeightBoundary;
        const positionY = chartHeightBoundary - proportionalHeight;

        pointsPathString += `${positionX},${positionY} `;
        areaFillPathString += `${positionX},${positionY} `;
        return { x: positionX, y: positionY, val: pt.value, label: pt.name };
    });

    areaFillPathString += `${svgCanvasWidth - chartInlinePadding},${chartHeightBoundary}`;

    svg.innerHTML += `
        <defs>
            <linearGradient id="lineChartGradientFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="var(--info)" stop-opacity="0.25"/>
                <stop offset="100%" stop-color="var(--info)" stop-opacity="0.0"/>
            </linearGradient>
        </defs>
        <polygon points="${areaFillPathString}" fill="url(#lineChartGradientFill)"></polygon>
    `;

    svg.innerHTML += `
        <polyline points="${pointsPathString}" fill="none" stroke="var(--info)" stroke-width="3" 
                  style="stroke-dasharray: 1400; stroke-dashoffset: 1400; animation: lineDraw 1.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;">
        </polyline>
    `;

    coordinatesMatrix.forEach((coord) => {
        svg.innerHTML += `
            <g>
                <circle cx="${coord.x}" cy="${coord.y}" r="5" fill="var(--bg-main)" stroke="var(--info)" stroke-width="2.5"></circle>
                <text x="${coord.x}" y="${chartHeightBoundary + 22}" class="chart-axis-text" text-anchor="middle">${coord.label}</text>
                ${coord.val > 0 ? `<text x="${coord.x}" y="${coord.y - 12}" class="chart-value-label" style="fill: var(--info); font-weight: 700;">RM ${coord.val.toFixed(2)}</text>` : ''}
            </g>
        `;
    });
}

function renderDiningTypeClusterChart(intervalOrders) {
    const svg = document.getElementById('svgWeeklyRevenueChart');
    const legendContainer = document.getElementById('barChartLegendLabelsContainer');
    if (!svg) return;
    svg.innerHTML = '';
    if (legendContainer) legendContainer.innerHTML = '';

    const { template: timelineTemplate, diningTypes } = aggregateOrderCountByBucketAndDiningType(intervalOrders, currentAnalyticsInterval);

    const colorPalette = ['var(--amber)', 'var(--info)', 'var(--success)', '#9333ea', '#DB2777'];
    const colorByType = {};
    diningTypes.forEach((type, i) => { colorByType[type] = colorPalette[i % colorPalette.length]; });

    const maxValue = Math.max(
        ...timelineTemplate.flatMap(bucket => diningTypes.map(t => bucket.valuesByType[t] || 0)),
        5
    );

    const chartHeightBoundary = 180;
    const svgCanvasWidth = 640;
    const chartInlinePadding = 24;
    const usableGraphWidth = svgCanvasWidth - (chartInlinePadding * 2);
    const groupWidthStep = usableGraphWidth / timelineTemplate.length;

    const barGap = 3;
    const typeCount = Math.max(diningTypes.length, 1);
    const groupInnerWidth = groupWidthStep * 0.72;
    const barWidth = Math.min(22, (groupInnerWidth - (barGap * (typeCount - 1))) / typeCount);
    const clusterWidth = (barWidth * typeCount) + (barGap * (typeCount - 1));

    svg.innerHTML += `<line x1="${chartInlinePadding}" y1="${chartHeightBoundary}" x2="${svgCanvasWidth - chartInlinePadding}" y2="${chartHeightBoundary}" stroke="var(--border)" stroke-width="2"/>`;

    timelineTemplate.forEach((bucket, groupIndex) => {
        const groupCenterX = chartInlinePadding + (groupIndex * groupWidthStep) + (groupWidthStep / 2);
        const clusterStartX = groupCenterX - (clusterWidth / 2);

        diningTypes.forEach((type, typeIndex) => {
            const value = bucket.valuesByType[type] || 0;
            const barHeight = (value / maxValue) * chartHeightBoundary;
            const barX = clusterStartX + (typeIndex * (barWidth + barGap));
            const barY = chartHeightBoundary - barHeight;

            svg.innerHTML += `
                <g>
                    <rect x="${barX}" y="${barY}" width="${barWidth}" height="${barHeight}"
                          fill="${colorByType[type]}" opacity="${value > 0 ? '1' : '0.15'}" rx="3"
                          style="animation: barGrow 1s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                                 transform-origin: bottom;
                                 transform: scaleY(0);">
                    </rect>
                    ${value > 0 ? `<text x="${barX + (barWidth / 2)}" y="${barY - 6}" class="chart-value-label" style="font-size: 8px;">${value.toFixed(0)}</text>` : ''}
                </g>
            `;
        });

        svg.innerHTML += `<text x="${groupCenterX}" y="${chartHeightBoundary + 22}" class="chart-axis-text" text-anchor="middle">${bucket.name}</text>`;
    });

    if (legendContainer) {
        diningTypes.forEach(type => {
            legendContainer.insertAdjacentHTML('beforeend', `
                <div style="display:flex; align-items:center; gap:8px; font-size:0.8rem; color:var(--text-secondary); font-weight:600;">
                    <span style="width:11px; height:11px; border-radius:3px; background:${colorByType[type]}; display:inline-block;"></span>
                    ${type}
                </div>
            `);
        });
    }
}

function renderPaymentMethodPieGraph(intervalOrders) {
    const svgCircle = document.getElementById('svgDiningTypePieChart');
    const legendContainer = document.getElementById('pieChartLegendLabelsContainer');
    if (!svgCircle || !legendContainer) return;

    svgCircle.innerHTML = '';
    legendContainer.innerHTML = '';

    const shareRows = aggregateRevenueShareByPaymentType(intervalOrders);
    const structuralTotalSum = shareRows.reduce((sum, row) => sum + row.total, 0);

    if (structuralTotalSum === 0) {
        legendContainer.innerHTML = '<div style="color:var(--text-muted); padding: 20px;">No revenue logged for this timeline.</div>';
        svgCircle.innerHTML = `<circle cx="50" cy="50" r="15.915" fill="none" stroke="var(--border)" stroke-width="31.83"></circle>`;
        return;
    }

    const colorPalettesPalette = ['var(--amber)', 'var(--success)', 'var(--info)', '#9333ea', '#DB2777'];
    let cumulativeOffset = 0;

    shareRows.forEach((row, index) => {
        const revenueVal = row.total;
        const pct = (revenueVal / structuralTotalSum) * 100;
        const colorChoice = colorPalettesPalette[index % colorPalettesPalette.length];

        svgCircle.insertAdjacentHTML('beforeend', `
            <circle cx="50" cy="50" r="15.915" fill="none"
                    stroke="${colorChoice}"
                    stroke-width="31.83"
                    stroke-dasharray="${pct} ${100 - pct}"
                    stroke-dashoffset="${25 - cumulativeOffset}">
            </circle>
        `);

        legendContainer.insertAdjacentHTML('beforeend', `
            <div class="legend-simple-item" style="animation: animFadeIn 0.4s ease forwards; animation-delay: ${index * 0.15}s; opacity:0;">
                <span class="legend-color-dot" style="background:${colorChoice};"></span>
                <span>${row.paymentType}</span>
                <span class="legend-value">RM ${revenueVal.toFixed(2)} (${pct.toFixed(1)}%)</span>
            </div>
        `);

        cumulativeOffset += pct;
    });
}

window.fetchExecutiveSummaryStatistics = fetchExecutiveSummaryStatistics;
window.handleIntervalFilterChange = handleIntervalFilterChange;