addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request))
})

// KV namespace will be bound to QR_TRACKER
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
}

async function handleRequest(request) {
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            headers: corsHeaders
        })
    }

    const url = new URL(request.url)
    const path = url.pathname

    if (path.startsWith('/api/qr-codes')) {
        if (request.method === 'GET') {
            // Get all QR codes
            const data = await QR_TRACKER.get('all_codes')
            const codes = data ? JSON.parse(data) : []
            return new Response(JSON.stringify(codes), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        } else if (request.method === 'POST') {
            // Create new QR code
            const code = await request.json()
            const data = await QR_TRACKER.get('all_codes')
            const codes = data ? JSON.parse(data) : []
            codes.push(code)
            await QR_TRACKER.put('all_codes', JSON.stringify(codes))
            return new Response(JSON.stringify(code), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        } else if (request.method === 'DELETE') {
            // Delete QR code
            const id = path.split('/').pop()
            const data = await QR_TRACKER.get('all_codes')
            let codes = data ? JSON.parse(data) : []
            codes = codes.filter(code => code.id !== id)
            await QR_TRACKER.put('all_codes', JSON.stringify(codes))
            return new Response(JSON.stringify({ message: 'QR code deleted' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }
    } else if (path === '/api/record-scan') {
        if (request.method === 'POST') {
            const scanData = await request.json()
            const data = await QR_TRACKER.get('all_codes')
            let codes = data ? JSON.parse(data) : []
            const code = codes.find(c => c.id === scanData.qrId)
            
            if (code) {
                const visitorId = request.headers.get('visitor-id') || 
                    Math.random().toString(36).substr(2, 9)
                
                code.scans = code.scans || []
                code.visitors = code.visitors || []
                code.scans.push({
                    timestamp: scanData.timestamp,
                    visitorId,
                    os: scanData.os
                })
                code.totalScans = (code.totalScans || 0) + 1

                if (!code.visitors.includes(visitorId)) {
                    code.visitors.push(visitorId)
                    code.uniqueScans = (code.uniqueScans || 0) + 1
                }

                await QR_TRACKER.put('all_codes', JSON.stringify(codes))
                return new Response(JSON.stringify(code), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }
            
            return new Response(JSON.stringify({ error: 'QR code not found' }), {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }
    }

    return new Response('Not found', { status: 404 })
} 