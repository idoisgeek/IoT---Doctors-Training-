const http = require('http');
const fs = require('fs').promises;
const path = require('path');
const https = require('https');
const config = require('./config');

// MIME types for different file extensions
const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

const PORT = 3000;

// Data directory for storing JSON files
const DATA_DIR = path.join(__dirname, 'data');


// OpenAI API request handler
async function callOpenAI(messages) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.openai.com',
            path: '/v1/chat/completions',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.OPENAI_API_KEY}`
            }
        };

        const apiReq = https.request(options, (apiRes) => {
            let data = '';
            apiRes.on('data', (chunk) => data += chunk);
            apiRes.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    if (apiRes.statusCode === 200) {
                        resolve(response.choices[0].message.content);
                    } else {
                        reject({ statusCode: apiRes.statusCode, response });
                    }
                } catch (error) {
                    reject({ statusCode: 500, error: 'Failed to parse API response' });
                }
            });
        });

        apiReq.on('error', (error) => {
            reject({ statusCode: 500, error: 'Failed to call ChatGPT API' });
        });

        const requestBody = {
            model: 'gpt-3.5-turbo',
            messages: messages,
            temperature: 0.3,
            max_tokens: 500,
            presence_penalty: 0,
            frequency_penalty: 0
        };

        apiReq.write(JSON.stringify(requestBody));
        apiReq.end();
    });
}

// Ensure data directory exists
async function ensureDataDir() {
    try {
        await fs.access(DATA_DIR);
    } catch {
        await fs.mkdir(DATA_DIR);
    }
}

// Initialize data file
async function initializeDataFile() {
    const dataFile = path.join(DATA_DIR, 'prompts.json');
    try {
        await fs.access(dataFile);
    } catch {
        await fs.writeFile(dataFile, '[]');
    }
}

// Create HTTP server
const server = http.createServer(async (req, res) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours

    // Handle OPTIONS request for CORS
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // Parse URL
    const url = new URL(req.url, `http://${req.headers.host}`);

    try {
        if (url.pathname === '/api/prompts') {
            if (req.method === 'GET') {
                const data = await fs.readFile(path.join(DATA_DIR, 'prompts.json'), 'utf8');
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(data);
            } 
            else if (req.method === 'POST') {
                let body = '';
                req.on('data', chunk => body += chunk);
                req.on('end', async () => {
                    try {
                        await fs.writeFile(
                            path.join(DATA_DIR, 'prompts.json'),
                            JSON.stringify(JSON.parse(body), null, 2)
                        );
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true }));
                    } catch (error) {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Error saving prompts' }));
                    }
                });
            }
        } 
        else if (url.pathname.startsWith('/api/prompts/')) {
            if (req.method === 'DELETE') {
                const id = parseInt(url.pathname.split('/').pop());
                const dataFile = path.join(DATA_DIR, 'prompts.json');
                const data = JSON.parse(await fs.readFile(dataFile, 'utf8'));
                const filteredPrompts = data.filter(prompt => prompt.id !== id);
                await fs.writeFile(dataFile, JSON.stringify(filteredPrompts, null, 2));
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            }
        } 
        else if (url.pathname === '/api/chat') {
            if (req.method === 'POST') {

                let body = '';
                req.on('data', chunk => body += chunk);
                req.on('end', async () => {
                    try {
                        const { messages } = JSON.parse(body);
                        
                        try {
                            const content = await callOpenAI(messages);
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ content }));
                        } catch (error) {
                            console.error('OpenAI API Error:', error);
                            
                            if (error.statusCode === 429) {
                                const retryAfter = error.response.error?.retry_after || 60;
                                res.writeHead(429, { 
                                    'Content-Type': 'application/json',
                                    'Retry-After': retryAfter
                                });
                                res.end(JSON.stringify({
                                    error: error.response.error?.message || 'Rate limit exceeded',
                                    retryAfter
                                }));
                            } else {
                                res.writeHead(error.statusCode || 500, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({
                                    error: error.response?.error?.message || error.error || 'Internal server error'
                                }));
                            }
                        }
                    } catch (error) {
                        console.error('Error parsing request:', error);
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Invalid request format' }));
                    }
                });
            }
        } else {
            // Serve static files
            try {
                // Handle root path
                if (req.url === '/') {
                    req.url = '/index.html';
                }
                
                // Clean the URL to prevent directory traversal
                const cleanUrl = req.url.replace(/\.\./g, '');
                let filePath = path.join(__dirname, cleanUrl);
                const extname = path.extname(filePath);
                const contentType = MIME_TYPES[extname] || 'application/octet-stream';

                const content = await fs.readFile(filePath);
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(content);
            } catch (error) {
                if (error.code === 'ENOENT') {
                    res.writeHead(404);
                    res.end('File not found');
                } else {
                    console.error('Error serving static file:', error);
                    res.writeHead(500);
                    res.end('Internal server error');
                }
            }
        }
    } catch (error) {
        console.error('Server error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
    }
});

// Initialize and start server
async function start() {
    await ensureDataDir();
    await initializeDataFile();
    
    server.listen(PORT, () => {
        console.log(`Server running at http://localhost:${PORT}`);
        console.log(`Data directory: ${DATA_DIR}`);
    });
}

start();
