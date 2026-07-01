// ============================================================
// MANAGER ANALYTICS MODULE - KPI stats, line chart, bar chart, pie chart
// ============================================================

let currentAnalyticsInterval = 'weekly';

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
    } else if (intervalMode === 'monthly' || intervalMode === 'quarters') {
        return [
            { key: 'jan', name: 'Jan', value: 0 }, { key: 'feb', name: 'Feb', value: 0 },
            { key: 'mar', name: 'Mar', value: 0 }, { key: 'apr', name: 'Apr', value: 0 },
            { key: 'may', name: 'May', value: 0 }, { key: 'jun', name: 'Jun', value: 0 },
            { key: 'jul', name: 'Jul', value: 0 }, { key: 'aug', name: 'Aug', value: 0 },
            { key: 'sep', name: 'Sep', value: 0 }, { key: 'oct', name: 'Oct', value: 0 },
            { key: 'nov', name: 'Nov', value: 0 }, { key: 'dec', name: 'Dec', value: 0 }
        ];
    } else if (intervalMode === 'yearly') {
        return [
            { key: '2024', name: '2024', value: 0 },
            { key: '2025', name: '2025', value: 0 },
            { key: '2026', name: '2026', value: 0 }
        ];
    }
    return [];
}

async function fetchExecutiveSummaryStatistics() {
    try {
        const response = await fetch(`${API_BASE_URL}manager/dashboard_summary?interval=${currentAnalyticsInterval}`);
        if (!response.ok) throw new Error('Data endpoint drop.');
        const data = await response.json();
        const metrics = data.items[0] || { gross_revenue: 0, total_tickets: 0, active_queues: 0, total_staff: 0 };

        document.getElementById('statGrossRevenue').innerText = `RM ${parseFloat(metrics.gross_revenue).toFixed(2)}`;
        document.getElementById('statTotalOrders').innerText = metrics.total_tickets;
        document.getElementById('statActiveOrders').innerText = metrics.active_queues;
        document.getElementById('statTotalStaff').innerText = metrics.total_staff;

        updateChartsTextHeaderLabels();

        await generateWeeklySalesLineGraph();
        await generateWeeklyRevenueBarGraph();
        await generateDiningDistributionPieGraph();
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
    
    document.getElementById('lblRevenueBarChartTitle').innerText = `${capitalized} Average Order Value Peak Performance (RM)`;
    document.getElementById('lblSalesLineChartTitle').innerText = `${capitalized} Total Sales Trend Performance (RM)`;
    document.getElementById('lblPieChartTitle').innerText = `Revenue Share Metrics Breakdown (${capitalized})`;
}

async function generateWeeklySalesLineGraph() {
    const svg = document.getElementById('svgWeeklySalesLineChart');
    if (!svg) return;
    svg.innerHTML = '';

    try {
        const res = await fetch(`${API_BASE_URL}manager/sales_trend?interval=${currentAnalyticsInterval}`);
        const data = await res.json();
        const rows = data.items || [];

        const timelineTemplate = generateTimelineTemplate(currentAnalyticsInterval);

        rows.forEach(item => {
            const rawLabel = String(item.TIME_LABEL || item.time_label || item.DAY_NAME || item.day_name || '').trim().toLowerCase();
            const cleanKey = rawLabel.substring(0, 3);
            
            const pointIndex = timelineTemplate.findIndex(p => p.key === cleanKey || p.key === rawLabel);
            if (pointIndex !== -1) {
                timelineTemplate[pointIndex].value = parseFloat(item.TOTAL_SALES || item.total_sales || 0);
            }
        });

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

    } catch (err) {
        console.error("Line trend chart execution exception:", err);
        svg.innerHTML = `<text x="350" y="120" fill="var(--danger)" text-anchor="middle">Network error fetching data.</text>`;
    }
}

async function generateWeeklyRevenueBarGraph() {
    const svg = document.getElementById('svgWeeklyRevenueChart');
    if (!svg) return;
    svg.innerHTML = '';

    try {
        const res = await fetch(`${API_BASE_URL}manager/revenue_by_day?interval=${currentAnalyticsInterval}`);
        const data = await res.json();
        const rows = data.items || [];

        const timelineTemplate = generateTimelineTemplate(currentAnalyticsInterval);

        rows.forEach(item => {
            const rawLabel = String(item.time_label || item.TIME_LABEL || item.day_name || item.DAY_NAME || '').trim().toLowerCase();
            const cleanKey = rawLabel.substring(0, 3);
            
            const barIndex = timelineTemplate.findIndex(b => b.key === cleanKey || b.key === rawLabel);
            if (barIndex !== -1) {
                timelineTemplate[barIndex].value = parseFloat(item.daily_revenue || item.DAILY_REVENUE || item.total_sales || item.TOTAL_SALES || 0);
            }
        });

        const maxRevenueValue = Math.max(...timelineTemplate.map(d => d.value), 5);
        const chartHeightBoundary = 180;
        const totalBarsCount = timelineTemplate.length;
        
        const svgCanvasWidth = 640;
        const chartInlinePadding = 24; 
        const usableGraphWidth = svgCanvasWidth - (chartInlinePadding * 2);
        const horizontalWidthStep = usableGraphWidth / totalBarsCount;

        svg.innerHTML += `<line x1="${chartInlinePadding}" y1="${chartHeightBoundary}" x2="${svgCanvasWidth - chartInlinePadding}" y2="${chartHeightBoundary}" stroke="var(--border)" stroke-width="2"/>`;

        timelineTemplate.forEach((day, index) => {
            const barWidthSize = Math.min(38, horizontalWidthStep * 0.6);
            const barProportionalHeight = (day.value / maxRevenueValue) * chartHeightBoundary;

            const positionX = chartInlinePadding + (index * horizontalWidthStep) + (horizontalWidthStep - barWidthSize) / 2;
            const positionY = chartHeightBoundary - barProportionalHeight;

            svg.innerHTML += `
                <g>
                    <rect x="${positionX}" y="${positionY}" width="${barWidthSize}" height="${barProportionalHeight}" 
                          fill="var(--amber)" opacity="${day.value > 0 ? '1' : '0.15'}" rx="5" 
                          style="animation: barGrow 1s cubic-bezier(0.16, 1, 0.3, 1) forwards; 
                                 transform-origin: bottom; 
                                 transform: scaleY(0);">
                    </rect>
                    <text x="${positionX + (barWidthSize / 2)}" y="${chartHeightBoundary + 22}" class="chart-axis-text" text-anchor="middle">${day.name}</text>
                    ${day.value > 0 ? `<text x="${positionX + (barWidthSize / 2)}" y="${positionY - 10}" class="chart-value-label">RM ${day.value.toFixed(2)}</text>` : ''}
                </g>
            `;
        });
    } catch (err) {
        console.error("Weekly bar chart execution exception:", err);
    }
}

async function generateDiningDistributionPieGraph() {
    const svgCircle = document.getElementById('svgDiningTypePieChart');
    const legendContainer = document.getElementById('pieChartLegendLabelsContainer');
    if (!svgCircle || !legendContainer) return;

    svgCircle.innerHTML = '';
    legendContainer.innerHTML = '';

    try {
        const res = await fetch(`${API_BASE_URL}manager/orders_by_dining_type?interval=${currentAnalyticsInterval}`);
        const data = await res.json();
        const records = data.items || [];

        const structuralTotalSum = records.reduce((sum, current) => sum + parseFloat(current.total_count || current.revenue_count || current.TOTAL_COUNT || 0), 0);

        if (structuralTotalSum === 0) {
            legendContainer.innerHTML = '<div style="color:var(--text-muted); padding: 20px;">No revenue logged for this timeline.</div>';
            svgCircle.innerHTML = `<circle cx="50" cy="50" r="15.915" fill="none" stroke="var(--border)" stroke-width="31.83"></circle>`;
            return;
        }

        const colorPalettesPalette = ['var(--amber)', 'var(--success)', 'var(--info)', '#9333ea'];
        let cumulativeOffset = 0;

        records.forEach((row, index) => {
            const cleanTypeName = String(row.dining_type || row.DINING_TYPE).trim();
            const revenueVal = parseFloat(row.total_count || row.revenue_count || row.TOTAL_COUNT || 0);

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
                <div class="legend-row-item" style="animation: animFadeIn 0.4s ease forwards; animation-delay: ${index * 0.15}s; opacity:0; margin-bottom:4px;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span style="color:${colorChoice}; font-size:1.2rem;">■</span>
                        <strong>${cleanTypeName}</strong>
                    </div>
                    <span style="font-weight:700; color:var(--text-secondary);">RM ${revenueVal.toFixed(2)} (${pct.toFixed(1)}%)</span>
                </div>
            `);

            cumulativeOffset += pct;
        });
    } catch (err) {
        console.error("Pie configuration exception:", err);
    }
}

window.fetchExecutiveSummaryStatistics = fetchExecutiveSummaryStatistics;
window.handleIntervalFilterChange = handleIntervalFilterChange;
window.generateWeeklyRevenueBarGraph = generateWeeklyRevenueBarGraph;
window.generateWeeklySalesLineGraph = generateWeeklySalesLineGraph;
window.generateDiningDistributionPieGraph = generateDiningDistributionPieGraph;