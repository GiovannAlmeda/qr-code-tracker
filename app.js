// Data structure for storing QR codes and analytics
let qrCodesData = JSON.parse(localStorage.getItem('qrCodesData')) || {
    codes: []
};

// Save data to localStorage
function saveData() {
    localStorage.setItem('qrCodesData', JSON.stringify(qrCodesData));
}

// Generate unique ID for QR codes
function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

// Generate tracking URL
function generateTrackingUrl(url, id) {
    // Use the specific MapMagnet tracking page URL
    return `https://mapmagnet.co/tracking-page?id=${id}&url=${encodeURIComponent(url)}`;
}

// Generate QR Code
async function generateQRCode(url) {
    try {
        const qrContainer = document.createElement('div');
        await QRCode.toCanvas(qrContainer, url, {
            width: 200,
            margin: 2
        });
        return qrContainer;
    } catch (err) {
        console.error(err);
        return null;
    }
}

// Add new QR code
async function addQRCode(url, startDate, endDate) {
    const id = generateId();
    const trackingUrl = generateTrackingUrl(url, id);
    
    const qrCode = {
        id,
        originalUrl: url,
        trackingUrl,
        created: new Date().toISOString(),
        startDate,
        endDate,
        totalScans: 0,
        uniqueScans: 0,
        scans: [],
        visitors: new Set()
    };

    qrCodesData.codes.push(qrCode);
    saveData();
    await updateQRCodesList();
    return qrCode;
}

// Update QR codes list in UI
async function updateQRCodesList() {
    const container = document.getElementById('qrCodesList');
    container.innerHTML = '';

    const sortBy = document.getElementById('sortBy').value;
    const sortedCodes = [...qrCodesData.codes].sort((a, b) => {
        if (sortBy === 'date') {
            return new Date(b.created) - new Date(a.created);
        }
        return b.totalScans - a.totalScans;
    });

    for (const code of sortedCodes) {
        const element = document.createElement('div');
        element.className = 'border rounded p-4 flex items-center justify-between';
        
        const qrCanvas = await generateQRCode(code.trackingUrl);
        const statsHtml = `
            <div class="flex-1 ml-4">
                <div class="font-medium">${code.originalUrl}</div>
                <div class="text-sm text-gray-500">Created: ${new Date(code.created).toLocaleDateString()}</div>
                <div class="mt-2">
                    <span class="mr-4">Total Scans: ${code.totalScans}</span>
                    <span>Unique Scans: ${code.uniqueScans}</span>
                </div>
            </div>
        `;
        
        const actionsHtml = `
            <div class="flex space-x-2">
                <button class="bg-blue-500 text-white px-3 py-1 rounded text-sm" 
                        onclick="showAnalytics('${code.id}')">Analytics</button>
                <button class="bg-gray-200 px-3 py-1 rounded text-sm"
                        onclick="downloadQR('${code.id}')">Download QR</button>
            </div>
        `;

        element.appendChild(qrCanvas);
        element.insertAdjacentHTML('beforeend', statsHtml);
        element.insertAdjacentHTML('beforeend', actionsHtml);
        container.appendChild(element);
    }
}

// Show analytics for a specific QR code
function showAnalytics(id) {
    const code = qrCodesData.codes.find(c => c.id === id);
    if (!code) return;

    // Show modal
    document.getElementById('analyticsModal').classList.remove('hidden');

    // Prepare data for charts
    const scansData = prepareScanData(code);
    const osData = prepareOSData(code);
    
    // Create charts
    createScansChart(scansData);
    createOSChart(osData);
    
    // Update lists
    updateLocationLists(code);
}

// Prepare scan data for chart
function prepareScanData(code) {
    const dates = {};
    code.scans.forEach(scan => {
        const date = new Date(scan.timestamp).toLocaleDateString();
        dates[date] = (dates[date] || 0) + 1;
    });
    
    return {
        labels: Object.keys(dates),
        data: Object.values(dates)
    };
}

// Prepare OS data for chart
function prepareOSData(code) {
    const os = {};
    code.scans.forEach(scan => {
        os[scan.os] = (os[scan.os] || 0) + 1;
    });
    
    return {
        labels: Object.keys(os),
        data: Object.values(os)
    };
}

// Create scans chart
function createScansChart(data) {
    const ctx = document.getElementById('scansChart').getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.labels,
            datasets: [{
                label: 'Scans Over Time',
                data: data.data,
                borderColor: 'rgb(59, 130, 246)',
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Create OS chart
function createOSChart(data) {
    const ctx = document.getElementById('osChart').getContext('2d');
    new Chart(ctx, {
        type: 'pie',
        data: {
            labels: data.labels,
            datasets: [{
                data: data.data,
                backgroundColor: [
                    'rgb(59, 130, 246)',
                    'rgb(16, 185, 129)',
                    'rgb(239, 68, 68)'
                ]
            }]
        },
        options: {
            responsive: true
        }
    });
}

// Update location lists
function updateLocationLists(code) {
    const countries = {};
    const cities = {};
    
    code.scans.forEach(scan => {
        countries[scan.country] = (countries[scan.country] || 0) + 1;
        cities[scan.city] = (cities[scan.city] || 0) + 1;
    });

    const countriesList = document.getElementById('countriesList');
    const citiesList = document.getElementById('citiesList');
    
    countriesList.innerHTML = Object.entries(countries)
        .sort((a, b) => b[1] - a[1])
        .map(([country, count]) => `
            <div class="flex justify-between py-1">
                <span>${country}</span>
                <span>${count}</span>
            </div>
        `).join('');

    citiesList.innerHTML = Object.entries(cities)
        .sort((a, b) => b[1] - a[1])
        .map(([city, count]) => `
            <div class="flex justify-between py-1">
                <span>${city}</span>
                <span>${count}</span>
            </div>
        `).join('');
}

// Download QR code as PNG
async function downloadQR(id) {
    const code = qrCodesData.codes.find(c => c.id === id);
    if (!code) return;

    const canvas = await generateQRCode(code.trackingUrl);
    const link = document.createElement('a');
    link.download = `qr-${id}.png`;
    link.href = canvas.toDataURL();
    link.click();
}

// Export data as CSV
function downloadCSV() {
    const csvContent = [
        ['ID', 'URL', 'Created', 'Total Scans', 'Unique Scans'],
        ...qrCodesData.codes.map(code => [
            code.id,
            code.originalUrl,
            code.created,
            code.totalScans,
            code.uniqueScans
        ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'qr-codes-export.csv';
    link.click();
}

// Event Listeners
document.getElementById('generateQR').addEventListener('click', async () => {
    const url = document.getElementById('urlInput').value;
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    
    if (!url) {
        alert('Please enter a URL');
        return;
    }

    await addQRCode(url, startDate, endDate);
    document.getElementById('urlInput').value = '';
    document.getElementById('startDate').value = '';
    document.getElementById('endDate').value = '';
});

document.getElementById('sortBy').addEventListener('change', updateQRCodesList);
document.getElementById('downloadCSV').addEventListener('click', downloadCSV);

document.querySelectorAll('.closeModal').forEach(button => {
    button.addEventListener('click', () => {
        document.getElementById('analyticsModal').classList.add('hidden');
    });
});

// Initial load
updateQRCodesList(); 