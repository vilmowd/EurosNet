const express = require('express');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
// --- SAFETY NET LIBRARIES ---
const { JSDOM } = require('jsdom');
const createDOMPurify = require('dompurify');
const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);
const archiver = require('archiver');
const unzipper = require('unzipper');
const multer = require('multer'); // You likely already have this, if not: npm install multer
const upload = multer({ dest: 'uploads/' });
const runGarbageCollector = require('./gc.js');
const { archiveDeletion, healNode, reviveNode } = require('./utils');
const session = require('express-session');
const helmet = require('helmet');
const sanitizeHtml = require('sanitize-html');
const rateLimit = require('express-rate-limit');
const axios = require('axios');

require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;
let maintenanceMode = false;

// Initialize directories
if (!fs.existsSync('./nodes')) fs.mkdirSync('./nodes');

// Root node initialization
const rootPath = './nodes/root.json';
if (!fs.existsSync(rootPath)) {
    fs.writeFileSync(rootPath, JSON.stringify({
        id: "root",
        title: "THE SOURCE",
        content: "<h2>Welcome to the beginning.</h2><p>This is the root of the net.</p>",
        children: [],
        views: 0,
        isUnderConstruction: false
    }));
}






app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true, 
      directives: {
        "default-src": ["'self'"],
        "script-src": ["'self'", "'unsafe-inline'"],
        "style-src": ["'self'", "'unsafe-inline'"],
        // 1. Allow GIFs/Images from any URL
        "img-src": ["*", "data:", "blob:"], 
        // 2. Allow Videos/Audio from any URL (YouTube, Archive.org, etc.)
        "media-src": ["*", "data:", "blob:"],
        // 3. Allow IFrames (if you want to embed YouTube/Vimeo players)
        "frame-src": ["*"],
        "upgrade-insecure-requests": null,
      },
    },
  })
);

// 3. THE REST OF YOUR MIDDLEWARE
app.use(session({
    secret: 'retro-vibe-security-key',
    resave: false,
    saveUninitialized: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use('/sites', express.static(path.join(__dirname, 'public_sites')));
app.set('view engine', 'ejs');
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ limit: '5mb', extended: true }));

const sanitizeContent = (dirty) => {
    return sanitizeHtml(dirty, {
        allowedTags: [
            'address', 'article', 'aside', 'footer', 'header', 'h1', 'h2', 'h3', 'h4',
            'h5', 'h6', 'hgroup', 'main', 'nav', 'section', 'blockquote', 'dd', 'div',
            'dl', 'dt', 'figcaption', 'figure', 'hr', 'li', 'main', 'ol', 'p', 'pre',
            'ul', 'a', 'abbr', 'b', 'bdi', 'bdo', 'br', 'cite', 'code', 'data', 'dfn',
            'em', 'i', 'kbd', 'mark', 'q', 'rb', 'rp', 'rt', 'rtc', 'ruby', 's', 'samp',
            'small', 'span', 'strong', 'sub', 'sup', 'time', 'u', 'var', 'wbr', 'caption',
            'col', 'colgroup', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr',
            'img', 'marquee', 'center', 'video', 'source' // RETRO EXTRAS
        ],
        allowedAttributes: {
            'a': ['href', 'name', 'target'],
            'img': ['src', 'srcset', 'alt', 'title', 'width', 'height', 'loading'],
            'video': ['src', 'controls', 'width', 'height', 'autoplay', 'loop', 'muted'],
            'source': ['src', 'type'],
            '*': ['style', 'class', 'align'] // Allow style for the Geocities aesthetic
        },
        allowedStyles: {
            '*': {
                'color': [/^#/i, /rgb[/, /^[a-z]+$/],
                'background-color': [/^#/i, /rgb[/, /^[a-z]+$/],
                'text-align': [/^left$/, /^right$/, /^center$/, /^justify$/],
                'font-family': [/.*/],
                'font-size': [/.*/],
                'margin': [/.*/],
                'padding': [/.*/],
                'border': [/.*/]
            }
        }
    });
};

// Add the Rate Limiter at the top of your server.js
const spawnLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Allow 5 spawns per 15 mins
    message: "<h1>SYSTEM BUSY</h1><p>Too many nodes spawned from your IP. Take a breather, traveler.</p>"
});

// --- PUBLIC ROUTES ---

app.get('/', (req, res) => res.redirect('/node/root'));

app.get('/api/btc', async (req, res) => {
    try {
        const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
        // Explicitly send JSON
        res.setHeader('Content-Type', 'application/json');
        res.json(response.data);
    } catch (error) {
        console.error('Server BTC Fetch Error:', error.message);
        res.status(500).json({ bitcoin: { usd: 0 } });
    }
});

app.get('/node/:id', (req, res) => {
    const filePath = `./nodes/${req.params.id}.json`;
    
    // 1. Check if node exists
    if (!fs.existsSync(filePath)) {
        return res.send("Node lost. <a href='/'>Back to Source</a>");
    }
    
    try {
        // 2. Load and Update Node
        const node = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        node.views = (node.views || 0) + 1;
        fs.writeFileSync(filePath, JSON.stringify(node, null, 2));

        // 3. Handle Broadcast System
        let broadcast = { message: "" };
        if (fs.existsSync('./broadcast.json')) {
            try {
                broadcast = JSON.parse(fs.readFileSync('./broadcast.json', 'utf8'));
            } catch (e) {
                console.error("Broadcast read error:", e);
            }
        }

        // 4. Maintenance Status
        const maintenanceStatus = typeof maintenanceMode !== 'undefined' ? maintenanceMode : false;

        // 5. Sidebar: Get 5 most recent nodes (Filtered)
        const files = fs.readdirSync('./nodes');
        const recentNodes = files
            .filter(file => {
                // ONLY include .json files, EXCLUDE the root, and ignore system files
                return file.endsWith('.json') && 
                    file !== 'root.json' && 
                    file !== 'bulletin.json' && 
                    file !== 'filters.json';
            }) 
            .map(file => {
                try {
                    const data = JSON.parse(fs.readFileSync(`./nodes/${file}`, 'utf8'));
                    const stats = fs.statSync(`./nodes/${file}`);
                    
                    // Only return if it actually has a title/id
                    if (data.title && data.id) {
                        return { 
                            id: data.id, 
                            title: data.title, 
                            mtime: stats.mtime,
                            isStatic: data.isStatic || false 
                        };
                    }
                    return null;
                } catch (e) {
                    return null; // Skip corrupted files
                }
            })
            .filter(node => node !== null) // Remove the nulls we created above
            .sort((a, b) => b.mtime - a.mtime)
            .slice(0, 5);

        // 6. Bulletin Data
        let bulletin = [];
        if (fs.existsSync('./bulletin.json')) {
            bulletin = JSON.parse(fs.readFileSync('./bulletin.json', 'utf8'));
        }

        // 7. DYNAMIC CAPTCHA GENERATION
        // Generate two numbers between 1 and 10
        const num1 = Math.floor(Math.random() * 10) + 1;
        const num2 = Math.floor(Math.random() * 10) + 1;
        
        // Lock the sum into the session memory
        req.session.captchaAnswer = num1 + num2;
        
        // This is the string EJS will display
        const captchaQuestion = `${num1} + ${num2}`;

        // 8. RENDER THE PAGE
        res.render('node-template', { 
            node,
            captchaQuestion, // This fixes your "is not defined" error!
            recentNodes, 
            bulletin, 
            broadcast, 
            maintenanceMode: maintenanceStatus 
        });

    } catch (err) {
        console.error("Critical Sector Error:", err);
        res.status(500).send("<h1>SECTOR CORRUPTION</h1><p>The data fragment is unreadable.</p>");
    }
});

// 1. Show the page
app.get('/login', (req, res) => {
    res.render('login', { error: null }); 
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (username === process.env.ADMIN_USER && password === process.env.ADMIN_PASS) {
        req.session.authenticated = true;
        req.session.adminPassword = password; // Store it for your buttons
        res.redirect('/admin-portal'); // Look! No more ?key= in the URL!
    } else {
        res.render('login', { error: "INVALID CREDENTIALS" });
    }
});




app.post('/spawn/:parentId', spawnLimiter, (req, res) => {
    try {
        const { title, htmlContent, captchaInput } = req.body;
        
        // 1. Humanity Check
        if (parseInt(captchaInput) !== req.session.captchaAnswer) {
            return res.status(403).send("Captcha failed.");
        }

        // 2. Generate the ID & Sanitize
        const nodeId = uuidv4().substring(0, 8);
        const safeHtml = sanitizeContent(htmlContent); 

        // 3. THE BAKE (Updated for high-compatibility)
        const fullHtmlPage = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <link rel="icon" type="image/x-icon" href="/favicon.ico?v=1">
            <title>${title}</title>
            </head>
        <body style="margin: 0; padding: 0; background: #000;">
            ${safeHtml}
            
            <div style="background: #f0f0f0; color: #000; padding: 10px; border-top: 2px solid #808080; font-family: sans-serif; text-align: center;">
                <a href="/node/root" style="color: blue;">[ Return to Node Net ]</a> | 
                <a href="${nodeId}.html" download="${title}.html" style="color: blue;">[ Download Source ]</a>
            </div>
        </body>
        </html>`;

        // 4. SAVE THE PHYSICAL HTML FILE
        const filePath = path.join(__dirname, 'public_sites', `${nodeId}.html`);
        fs.writeFileSync(filePath, fullHtmlPage);

        // 4.5 CREATE THE NODE METADATA (The "Missing Link" for Recent Activity)
        const newNodeData = {
            id: nodeId,
            title: title,
            isStatic: true,
            views: 0,
            children: [],
            parentId: req.params.parentId,
            timestamp: new Date().toISOString()
        };
        const nodePath = path.join(__dirname, 'nodes', `${nodeId}.json`);
        fs.writeFileSync(nodePath, JSON.stringify(newNodeData, null, 2));

        // 5. UPDATE THE PARENT'S TREE
        const parentPath = path.join(__dirname, 'nodes', `${req.params.parentId}.json`);
        if (fs.existsSync(parentPath)) {
            const parentData = JSON.parse(fs.readFileSync(parentPath, 'utf8'));
            parentData.children.push({ id: nodeId, title: title, isStatic: true });
            fs.writeFileSync(parentPath, JSON.stringify(parentData, null, 2));
        }

        // --- NEW STEP: 5.5 AUTOMATED GRAFFITI ANNOUNCEMENT ---
        const bulletinPath = './bulletin.json';
        let bulletin = [];
        if (fs.existsSync(bulletinPath)) {
            bulletin = JSON.parse(fs.readFileSync(bulletinPath, 'utf8'));
        }

        const systemMessage = {
            username: "SYSTEM_BOT",
            message: `🚀 NEW SECTOR BAKED: "${title}" is now online! Check it out at /sites/${nodeId}.html`,
            date: new Date().toLocaleString()
        };

        bulletin.push(systemMessage);
        // Keep the wall clean - only keep the last 50 messages
        if (bulletin.length > 50) bulletin.shift(); 
        
        fs.writeFileSync(bulletinPath, JSON.stringify(bulletin, null, 2));
        // ----------------------------------------------------

        // 6. REDIRECT
        res.redirect(`/sites/${nodeId}.html`);

    } catch (error) {
        console.error("Bake Error:", error);
        res.status(500).send("The Architect encountered a baking error.");
    }
});

app.post('/bulletin/post', (req, res) => {
    // 1. Check for Lockdown
    if (typeof maintenanceMode !== 'undefined' && maintenanceMode) {
        return res.status(503).send("SYSTEM LOCKDOWN: The board is temporarily closed for maintenance.");
    }

    const { username, message } = req.body;
    const boardPath = './nodes/bulletin.json';
    const filterPath = './nodes/filters.json';

    // 2. Load the Banned Words list
    let bannedWords = [];
    try {
        if (fs.existsSync(filterPath)) {
            const filterData = JSON.parse(fs.readFileSync(filterPath, 'utf8'));
            bannedWords = filterData.bannedWords || [];
        }
    } catch (e) {
        console.error("::: FILTER READ ERROR :::", e);
        // If file fails, we proceed with an empty list rather than crashing
    }

    // 3. Perform the Security Scan
    // We check the username AND message for any banned phrases
    const contentToCheck = `${username} ${message}`.toLowerCase();
    const foundBadWord = bannedWords.find(word => 
        word.trim() !== "" && contentToCheck.includes(word.toLowerCase().trim())
    );

    if (foundBadWord) {
        return res.status(400).send(`
            <script>
                alert("ACCESS DENIED: Your post contains the forbidden term '${foundBadWord}'. Please keep the network clean.");
                window.location.href = "/node/root";
            </script>
        `);
    }

    // 4. Sanitize and Prep the Data
    // We escape < and > to prevent people from putting 
    // nasty scripts or broken HTML into your board.
    const safeUsername = (username || "Anon").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const safeMessage = (message || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    if (!safeMessage.trim()) {
        return res.redirect('/node/root'); // Don't post empty messages
    }

    // 5. Read, Update, and Save the Board
    let posts = [];
    try {
        if (fs.existsSync(boardPath)) {
            posts = JSON.parse(fs.readFileSync(boardPath, 'utf8'));
        }
    } catch (e) {
        posts = [];
    }

    // Add new post to the top
    posts.unshift({ 
        username: safeUsername, 
        message: safeMessage, 
        date: new Date().toLocaleString() 
    });

    // Keep only the most recent 15 posts to save disk space
    fs.writeFileSync(boardPath, JSON.stringify(posts.slice(0, 15), null, 2));

    console.log(`::: NEW BULLETIN FROM ${safeUsername} :::`);
    
    // Redirect back to the homepage/root
    res.redirect('/node/root'); 
});


app.post('/admin/panic', (req, res) => {
    const { adminPass } = req.body;
    if (adminPass !== process.env.ADMIN_PASS) return res.status(403).send("Unauthorized");

    // 1. Toggle the lock
    maintenanceMode = !maintenanceMode;

    // 2. Run an immediate cleanup if locking down
    if (maintenanceMode) {
        runGarbageCollector();
        console.log("[PANIC]: System entered lockdown. Cleanup triggered.");
    } else {
        console.log("[PANIC]: System released from lockdown.");
    }

    res.redirect(`/admin-portal?key=${adminPass}`);
});

app.get('/search', (req, res) => {
    try {
        const query = req.query.q ? req.query.q.toLowerCase() : '';
        
        // 1. Get files and filter for ONLY .json files
        const files = fs.readdirSync('./nodes').filter(f => f.endsWith('.json'));
        
        const results = files.map(f => {
            try {
                return JSON.parse(fs.readFileSync(`./nodes/${f}`, 'utf8'));
            } catch (e) {
                return null; // Skip files that are corrupted
            }
        })
        .filter(d => d && d.title && d.title.toLowerCase().includes(query));

        // 2. Render (Make sure views/search-results.ejs exists!)
        res.render('search-results', { results, query });
        
    } catch (error) {
        console.error("Search failed:", error);
        res.status(500).send("Search Engine Failure - Internal Error");
    }
});

app.get('/random', (req, res) => {
    const sitesDir = path.join(__dirname, 'public_sites');

    if (!fs.existsSync(sitesDir)) {
        return res.redirect('/node/root');
    }

    const bakedFiles = fs.readdirSync(sitesDir).filter(f => f.endsWith('.html'));

    if (bakedFiles.length === 0) {
        return res.redirect('/node/root');
    }

    // Pick the random filename (e.g., "cb07f03e.html")
    const randomSite = bakedFiles[Math.floor(Math.random() * bakedFiles.length)];

    // REDIRECT FIX: 
    // Use /sites/ (the public URL) and don't add .html again
    res.redirect(`/sites/${randomSite}`);
});

// --- ADMIN ROUTES ---


const isAdmin = (req, res, next) => {
    if (req.session && req.session.authenticated) return next();
    res.redirect('/login');
};


app.get('/admin-portal', isAdmin, (req, res) => {
    // Retrieve the admin password from the session
    const key = req.session.adminPassword; 

    try {
        // 1. GATHER NODE DATA
        // Ensure the directories exist before reading to prevent crashes
        if (!fs.existsSync('./nodes')) fs.mkdirSync('./nodes');
        if (!fs.existsSync('./cemetery')) fs.mkdirSync('./cemetery');

        const nodeFiles = fs.readdirSync('./nodes').filter(f => f.endsWith('.json'));
        const deadFiles = fs.readdirSync('./cemetery').filter(f => f.endsWith('.json'));

        // 2. GATHER BULLETIN DATA (The missing piece!)
        let bulletinData = [];
        const bulletinPath = './nodes/bulletin.json'; // RECOMMENDED: save inside nodes for Railway persistence
        
        // Fallback check: if not in nodes/, check root (transition period)
        const oldPath = './bulletin.json';
        const finalPath = fs.existsSync(bulletinPath) ? bulletinPath : oldPath;

        if (fs.existsSync(finalPath)) {
            try {
                bulletinData = JSON.parse(fs.readFileSync(finalPath, 'utf8'));
            } catch (err) {
                console.error("Malformed bulletin.json file:", err);
                bulletinData = [];
            }
        }

        // 3. CALCULATE SYSTEM WEIGHT
        const getDirSize = (dir, files) => {
            return files.reduce((acc, file) => {
                try {
                    const stats = fs.statSync(path.join(dir, file));
                    return acc + stats.size;
                } catch (e) {
                    return acc; 
                }
            }, 0);
        };

        const nodesWeightKB = (getDirSize('./nodes', nodeFiles) / 1024);
        const cemeteryWeightKB = (getDirSize('./cemetery', deadFiles) / 1024);
        const totalWeight = (nodesWeightKB + cemeteryWeightKB).toFixed(2);

        const ratio = (totalWeight > 0) 
            ? ((cemeteryWeightKB / totalWeight) * 100).toFixed(1) 
            : 0;

        // 4. RENDER THE DASHBOARD
        res.render('admin-dash', {
            // Data lists
            allNodes: nodeFiles.map(f => {
                const data = JSON.parse(fs.readFileSync(`./nodes/${f}`, 'utf8'));
                return { ...data, slug: f.replace('.json', '') };
            }),
            deadNodes: deadFiles.map(f => {
                const data = JSON.parse(fs.readFileSync(`./cemetery/${f}`, 'utf8'));
                return { ...data, slug: f.replace('.json', '') };
            }),
            bulletin: bulletinData, 
            
            // System Logs (Garbage Collector)
            gcLogs: fs.existsSync('./gc_history.log') 
                ? fs.readFileSync('./gc_history.log', 'utf8').trim().split('\n').slice(-5).reverse() 
                : ["No logs found. System healthy."],
            
            // Statistics for Resource Monitor
            stats: {
                liveCount: nodeFiles.length,
                deadCount: deadFiles.length,
                totalWeight: totalWeight,
                ratio: ratio
            },
            
            // System variables
            maintenanceMode: typeof maintenanceMode !== 'undefined' ? maintenanceMode : false,
            key: key 
        });

    } catch (error) {
        console.error("CRITICAL ADMIN PORTAL ERROR:", error);
        res.status(500).send("Admin Portal failed to load. Check server logs.");
    }
});

app.get('/admin/audit-network', isAdmin, (req, res) => {
    const filterPath = './nodes/filters.json';
    const nodesDir = './nodes';

    try {
        // 1. Load Banned Words
        let bannedWords = [];
        if (fs.existsSync(filterPath)) {
            bannedWords = JSON.parse(fs.readFileSync(filterPath, 'utf8')).bannedWords || [];
        }

        // 2. Scan all JSON files in /nodes
        const files = fs.readdirSync(nodesDir).filter(f => f.endsWith('.json') && f !== 'filters.json' && f !== 'bulletin.json');
        
        const flaggedSites = [];

        files.forEach(file => {
            const data = JSON.parse(fs.readFileSync(path.join(nodesDir, file), 'utf8'));
            const contentToScan = `${data.title} ${data.content}`.toLowerCase();
            
            // Check if any banned word exists in this specific site
            const violations = bannedWords.filter(word => contentToScan.includes(word.toLowerCase().trim()));

            if (violations.length > 0) {
                flaggedSites.push({
                    id: data.id,
                    title: data.title,
                    violations: violations
                });
            }
        });

        // 3. Render a special audit page (or send data back to dash)
        res.render('admin-audit', { 
            flaggedSites, 
            key: req.session.adminPassword 
        });

    } catch (e) {
        console.error("Audit failed:", e);
        res.status(500).send("Audit Error");
    }
});


app.post('/edit/:id', (req, res) => {
    const { title, content, adminPass } = req.body;
    if (adminPass !== process.env.ADMIN_PASS) return res.status(403).send("Unauthorized");

    const filePath = `./nodes/${req.params.id}.json`;
    if (fs.existsSync(filePath)) {
        const node = JSON.parse(fs.readFileSync(filePath));
        node.title = title;
        node.content = sanitizeContent(content); // SAFETY NET APPLIED
        fs.writeFileSync(filePath, JSON.stringify(node));
        res.redirect(`/node/${req.params.id}`);
    }
});

app.post('/admin/broadcast', (req, res) => {
    const { message, adminPass, clearBroadcast } = req.body;
    
    if (adminPass !== process.env.ADMIN_PASS) {
        return res.status(403).send("Unauthorized");
    }

    const broadcastPath = './broadcast.json';

    if (clearBroadcast === "true" || !message || message.trim() === "") {
        fs.writeFileSync(broadcastPath, JSON.stringify(null));
        app.locals.broadcast = null;
        console.log("::: BROADCAST SIGNAL TERMINATED :::");
    } else {
        const broadcastData = { message: message.trim() };
        fs.writeFileSync(broadcastPath, JSON.stringify(broadcastData));
        app.locals.broadcast = broadcastData;
        console.log("::: NEW BROADCAST TRANSMITTED :::");
    }

    // CHANGE: Redirect specifically to your admin route
    res.redirect('/admin-portal'); 
});

app.post('/admin/clear-bulletin', (req, res) => {
    if (req.body.adminPass !== process.env.ADMIN_PASS) {
        return res.status(403).send("Unauthorized");
    }
    
    fs.writeFileSync('./bulletin.json', JSON.stringify([]));
    
    // CHANGE: Redirect specifically to your admin route
    res.redirect('/admin-portal');
});


app.post('/admin/delete-bulletin/:index', (req, res) => {
    // 1. Check admin pass (ensure it's coming from req.body)
    if (req.body.adminPass !== process.env.ADMIN_PASS) {
        return res.status(403).send("Unauthorized");
    }

    try {
        const bulletinPath = './bulletin.json';
        
        // 2. Read and parse with a fallback to an empty array
        let bulletin = [];
        if (fs.existsSync(bulletinPath)) {
            bulletin = JSON.parse(fs.readFileSync(bulletinPath, 'utf8'));
        }

        // 3. Get the index from the URL
        const indexToDelete = parseInt(req.params.index);

        // 4. Validation: Check if index is a valid number and within array bounds
        if (!isNaN(indexToDelete) && indexToDelete >= 0 && indexToDelete < bulletin.length) {
            
            // IMPORTANT: If your admin UI displays the list REVERSED, 
            // you must delete from the original array correctly.
            // If the UI is NOT reversed, simple splice works:
            bulletin.splice(indexToDelete, 1);
            
            fs.writeFileSync(bulletinPath, JSON.stringify(bulletin, null, 2));
            console.log(`::: ADMIN: Successfully removed post #${indexToDelete} :::`);
        } else {
            console.log(`::: ADMIN: Delete failed. Invalid index: ${indexToDelete} :::`);
        }

        // 5. Explicit redirect back to the dashboard
        res.redirect('/admin-portal');

    } catch (e) {
        console.error("CRITICAL ERROR in delete-bulletin:", e);
        res.status(500).send("Internal Server Error: Check console logs.");
    }
});

app.post('/admin/toggle-construction/:id', (req, res) => {
    if (req.body.adminPass !== process.env.ADMIN_PASS) return res.status(403).send("Unauthorized");
    const filePath = `./nodes/${req.params.id}.json`;
    const node = JSON.parse(fs.readFileSync(filePath));
    node.isUnderConstruction = !node.isUnderConstruction;
    fs.writeFileSync(filePath, JSON.stringify(node));
    res.redirect('back');
});

app.post('/delete/:id', (req, res) => {
    const { adminPass, reason } = req.body;
    const targetId = req.params.id;

    if (adminPass !== process.env.ADMIN_PASS) return res.status(403).send("Unauthorized");
    
    const node = JSON.parse(fs.readFileSync(`./nodes/${targetId}.json`));
    
    // Use the shared tools!
    healNode(node.id, node.parentId, node.children || []);
    archiveDeletion(node, reason || "Manual Admin Delete");
    
    fs.unlinkSync(`./nodes/${targetId}.json`);
    res.redirect(`/admin-portal?key=${adminPass}`);
});

// --- ADMIN: EXPORT ENTIRE NETWORK ---
app.get('/admin/export', (req, res) => {
    const { key } = req.query;
    if (key !== process.env.ADMIN_PASS) return res.status(403).send("Unauthorized");

    // Set the headers so the browser knows a file is coming
    res.attachment(`node_net_backup_${Date.now()}.zip`);

    const archive = archiver('zip', { zlib: { level: 9 } });

    // Good practice: catch warnings and errors
    archive.on('error', (err) => res.status(500).send({ error: err.message }));

    // Pipe the archive data to the response
    archive.pipe(res);

    // Add the nodes directory
    archive.directory('nodes/', 'nodes');

    // Add the bulletin board if it exists
    if (fs.existsSync('./bulletin.json')) {
        archive.file('bulletin.json', { name: 'bulletin.json' });
    }

    // Finalize the archive (this tells the stream we are done)
    archive.finalize();
});

// --- ADMIN: RESTORE NETWORK FROM ZIP ---
app.post('/admin/restore', upload.single('backupZip'), async (req, res) => {
    const { adminPass } = req.body;
    if (adminPass !== process.env.ADMIN_PASS) return res.status(403).send("Unauthorized");

    if (!req.file) return res.status(400).send("No file uploaded.");

    const zipPath = req.file.path;

    try {
        // 1. Clear current nodes and bulletin
        // Be careful: this wipes the live data!
        fs.readdirSync('./nodes').forEach(file => fs.unlinkSync(path.join('./nodes', file)));
        
        // 2. Extract the ZIP
        await fs.createReadStream(zipPath)
            .pipe(unzipper.Extract({ path: './' }))
            .promise();

        // 3. Clean up the temp upload file
        fs.unlinkSync(zipPath);

        res.send("<h2>System Restored Successfully.</h2><a href='/admin-portal?key=" + adminPass + "'>Return to Dashboard</a>");
    } catch (err) {
        res.status(500).send("Restore failed: " + err.message);
    }
});


app.post('/admin/run-gc', (req, res) => {
    const { adminPass } = req.body;
    if (adminPass !== process.env.ADMIN_PASS) return res.status(403).send("Unauthorized");
    
    const count = runGarbageCollector();
    res.send(`<h2>Janitor complete. ${count} nodes were scrapped.</h2><a href="/admin-portal?key=${adminPass}">Back</a>`);
});

app.post('/admin/revive/:id', (req, res) => {
    const { adminPass } = req.body;
    if (adminPass !== process.env.ADMIN_PASS) return res.status(403).send("Unauthorized");

    const result = reviveNode(req.params.id);
    
    if (result.success) {
        res.redirect(`/admin-portal?key=${adminPass}`);
    } else {
        res.status(400).send(result.message);
    }
});



app.listen(port, () => {
    console.log(`[SYSTEM ONLINE]: Architect Terminal active on port ${port}`);
    
    // --- START THE JANITOR ---
    // This starts the timer as soon as the server is live.
    // 1000ms * 60s * 60m = 1 Hour
    setInterval(runGarbageCollector, 1000 * 60 * 60);
    console.log("[GC]: Garbage Collector scheduled for 1-hour intervals.");
});