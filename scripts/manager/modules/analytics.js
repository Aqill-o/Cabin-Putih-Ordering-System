// ============================================================
// MANAGER ANALYTICS MODULE - KPI stats, line chart, bar chart, pie chart
// ============================================================

let currentAnalyticsInterval = 'weekly';

// NOTE: these templates must mirror exactly what the backend SQL returns
// for each interval (see manager/sales_trend + manager/sales_by_dining_type):
//   weekly   -> day-of-week label, for the CURRENT week               (Mon..Sun)
//   monthly  -> 3-letter month abbreviation, one row per month of the CURRENT year (Jan..Dec)
//   quarters -> quarter label (Mar/Jun/Sep/Dec), one row per quarter of the CURRENT year (4 rows)
//   yearly   -> 4-digit year, one row per year for the last 3 years (dynamic, not hardcoded)
function generateTimelineTemplate(intervalMode) {
    if (intervalMode === 'weekly') {
        return [
            { key: 'mon', matches: ['mon', 'monday'], name: 'Mon', value: 0 },
            { key: 'tue', matches: ['tue', 'tuesday'], name: 'Tue', value: 0 },
            { key: 'wed', matches: ['wed', 'wednesday'], name: 'Wed', value: 0 },
            { key: 'thu', matches: ['thu', 'thursday'], name: 'Thu', value: 0 },
            { key: 'fri', matches: ['fri', 'friday'], name: 'Fri', value: 0 },
            { key: 'sat', matches: ['sat', 'saturday'], name: 'Sat', value: 0 },
            { key: 'sun', matches: ['sun', 'sunday'], name: 'Sun', value: 0 }
        ];
    }

    if (intervalMode === 'monthly') {
        // Backend returns one row per month of the CURRENT year, label = "Mon" (Jan..Dec)
        const MONTH_KEYS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
        const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return MONTH_KEYS.map((key, idx) => ({
            key,
            matches: [key, MONTH_NAMES[idx].toLowerCase()],
            name: MONTH_NAMES[idx],
            value: 0
        }));
    }

    if (intervalMode === 'quarters') {
        // Backend returns one row per quarter of the CURRENT year, labeled by the
        // quarter's last month: Mar (Q1), Jun (Q2), Sep (Q3), Dec (Q4)
        return [
            { key: 'mar', matches: ['mar', 'q1'], name: 'Q1', value: 0 },
            { key: 'jun', matches: ['jun', 'q2'], name: 'Q2', value: 0 },
            { key: 'sep', matches: ['sep', 'q3'], name: 'Q3', value: 0 },
            { key: 'dec', matches: ['dec', 'q4'], name: 'Q4', value: 0 }
        ];
    }

    if (intervalMode === 'yearly') {
        // Backend returns one row per year for the CURRENT year + prior 2 years.
        // Computed dynamically so this doesn't need updating every January.
        const currentYear = new Date().getFullYear();
        const years = [currentYear - 2, currentYear - 1, currentYear];
        return years.map(year => ({
            key: String(year),
            matches: [String(year)],
            name: String(year),
            value: 0
        }));
    }

    return [];
}

// Matches a raw label coming back from the API to the correct bucket in the
// timeline template. Yearly labels ("2024","2025","2026") all share the same
// first 3 characters ("202"), so yearly must ALWAYS match on the full,
// exact label - never a truncated prefix. Weekly/monthly/quarters labels
// are day/month names and are safe to compare against their first 3 chars too.
function locateTemplateTimelineIndex(item, timelineTemplate, intervalMode) {
    const rawLabel = String(item.TIME_LABEL || item.time_label || item.DAY_NAME || item.day_name || '').trim().toLowerCase();
    if (!rawLabel) return -1;

    if (intervalMode === 'yearly') {
        return timelineTemplate.findIndex(t => t.key === rawLabel || t.matches.includes(rawLabel));
    }

    const shortCleanKey = rawLabel.substring(0, 3);
    return timelineTemplate.findIndex(t =>
        t.key === rawLabel ||
        t.matches.includes(rawLabel) ||
        t.matches.includes(shortCleanKey)
    );
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

        // Redraw all graphs with the newly selected filter context!
        await generateWeeklySalesLineGraph();
        await generateDiningTypeClusterChart();
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

    document.getElementById('lblRevenueBarChartTitle').innerText = `${capitalized} Total Order Sales by Dining Type (RM)`;
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
            const pointIndex = locateTemplateTimelineIndex(item, timelineTemplate, currentAnalyticsInterval);
            if (pointIndex !== -1) {
                timelineTemplate[pointIndex].value += parseFloat(item.TOTAL_SALES || item.total_sales || 0);
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

async function generateDiningTypeClusterChart() {
    const svg = document.getElementById('svgWeeklyRevenueChart');
    const legendContainer = document.getElementById('barChartLegendLabelsContainer');
    if (!svg) return;
    svg.innerHTML = '';
    if (legendContainer) legendContainer.innerHTML = '';

    try {
        const res = await fetch(`${API_BASE_URL}manager/sales_by_dining_type?interval=${currentAnalyticsInterval}`);
        const data = await res.json();
        const rows = data.items || [];

        const timelineTemplate = generateTimelineTemplate(currentAnalyticsInterval);

        // Discover which dining types actually appear, so colors/legend stay
        // consistent even when a period has zero orders for a given type.
        const diningTypeSet = new Set();
        rows.forEach(item => {
            diningTypeSet.add(String(item.dining_type || item.DINING_TYPE || 'Unknown').trim());
        });
        const diningTypes = Array.from(diningTypeSet).sort();

        // Each bucket now holds a value PER dining type instead of one number.
        timelineTemplate.forEach(bucket => {
            bucket.valuesByType = {};
            diningTypes.forEach(type => { bucket.valuesByType[type] = 0; });
        });

        rows.forEach(item => {
            const bucketIndex = locateTemplateTimelineIndex(item, timelineTemplate, currentAnalyticsInterval);
            if (bucketIndex === -1) return;
            const type = String(item.dining_type || item.DINING_TYPE || 'Unknown').trim();
            const amount = parseFloat(item.total_sales || item.TOTAL_SALES || 0);
            timelineTemplate[bucketIndex].valuesByType[type] = (timelineTemplate[bucketIndex].valuesByType[type] || 0) + amount;
        });

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
    } catch (err) {
        console.error("Dining type cluster chart execution exception:", err);
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
window.generateDiningTypeClusterChart = generateDiningTypeClusterChart;
window.generateWeeklySalesLineGraph = generateWeeklySalesLineGraph;
window.generateDiningDistributionPieGraph = generateDiningDistributionPieGraph;