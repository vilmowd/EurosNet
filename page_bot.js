const fs = require('fs');
const path = require('path');

// --- THE ARCHITECT'S BRAIN (Randomized Pools) ---
const subjects = ["VOID", "TRANSMISSION", "PROTOCOL", "ENTITY", "CORE", "SATELLITE", "NEURAL_NET"];
const actions = ["COLLECTING", "PURGING", "RECONSTRUCTING", "OBSERVING", "CORRUPTING"];
const crypticPhrases = [
    "The clock counts backward in the basement of the web.",
    "Do not trust the root directory. It remembers everything.",
    "Oxygen is a luxury the digital ghost does not require.",
    "Signal lost. Signal found. Signal is you.",
    "Encryption is just a polite way of saying 'Keep Out'."
];

// New: Randomized Bulletin Announcements
const manifestMessages = [
    "MATERIALIZATION: Node ${id} has been manifested in the ghost sector.",
    "SIGNAL DETECTED: Fragment ${id} has emerged from the void.",
    "INTRUSION: Unauthorized data packet ${id} has been baked into reality.",
    "ECHO: Sector ${id} is now broadcasting from the shadows.",
    "NOTICE: The Architect has concluded the construction of fragment ${id}."
];

function generatePhantomNode() {
    const id = Math.floor(10000 + Math.random() * 89999).toString();
    const nodesDir = path.join(__dirname, 'nodes');
    const sitesDir = path.join(__dirname, 'sites');
    const bulletinPath = path.join(__dirname, 'bulletin.json');

    // ENSURE DIRECTORIES EXIST
    if (!fs.existsSync(nodesDir)) fs.mkdirSync(nodesDir, { recursive: true });
    if (!fs.existsSync(sitesDir)) fs.mkdirSync(sitesDir, { recursive: true });

    // Generate random elaborate content
    const subject = subjects[Math.floor(Math.random() * subjects.length)];
    const action = actions[Math.floor(Math.random() * actions.length)];
    const phrase = crypticPhrases[Math.floor(Math.random() * crypticPhrases.length)];
    
    const nodeData = {
        id: id,
        title: `[!] ARCHITECT_LOG_${id}::${subject}`,
        content: phrase,
        author: "THE_ARCHITECT",
        isStatic: true,
        timestamp: new Date().toISOString(),
        metadata: {
            entropy_level: (Math.random() * 100).toFixed(2) + "%",
            sector: Math.floor(Math.random() * 99)
        }
    };

    try {
        // 1. SAVE THE BRAIN (JSON)
        fs.writeFileSync(path.join(nodesDir, `${id}.json`), JSON.stringify(nodeData, null, 2));

        // 2. BAKE THE BODY (HTML)
        const htmlContent = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <title>${nodeData.title}</title>
                <link rel="stylesheet" href="/style.css">
                <style>
                    :root { --main-glow: #00ff41; --danger: #ff003c; }
                    body { 
                        background-color: #050505; 
                        color: var(--main-glow); 
                        font-family: 'Courier New', monospace;
                        overflow-x: hidden;
                    }
                    .terminal-overlay {
                        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                        background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), 
                                    linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06));
                        background-size: 100% 2px, 3px 100%;
                        pointer-events: none;
                    }
                    .container { padding: 40px; max-width: 900px; margin: 0 auto; border: 1px solid var(--main-glow); box-shadow: 0 0 20px rgba(0,255,65,0.2); }
                    .header { border-bottom: 2px solid var(--main-glow); margin-bottom: 20px; padding-bottom: 10px; }
                    .glitch-text { text-transform: uppercase; letter-spacing: 5px; animation: flicker 1.5s infinite; }
                    .data-table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 0.8em; color: #888; }
                    .data-table td { border: 1px solid #333; padding: 10px; }
                    .log-box { background: #111; padding: 15px; border-left: 5px solid var(--danger); font-size: 0.9em; margin: 20px 0; }
                    @keyframes flicker {
                        0% { opacity: 1; } 5% { opacity: 0.4; } 10% { opacity: 1; } 15% { opacity: 0.1; } 20% { opacity: 1; }
                    }
                    a { color: var(--danger); text-decoration: none; font-weight: bold; }
                    a:hover { color: white; text-shadow: 0 0 10px var(--danger); }
                </style>
            </head>
            <body class="phantom-node">
                <div class="terminal-overlay"></div>
                <div class="container">
                    <div class="header">
                        <h1 class="glitch-text">> ${nodeData.title}</h1>
                        <p>TIMESTAMP: ${nodeData.timestamp} | SECTOR: ${nodeData.metadata.sector}</p>
                    </div>

                    <div class="log-box">
                        <strong>[ARCHITECT_SYSTEM_NOTICE]:</strong> ${action} SEQUENCE INITIATED...<br>
                        <strong>TARGET:</strong> ${subject}<br>
                        <strong>STATUS:</strong> CRITICAL UNSTABLE
                    </div>

                    <h2>MANIFESTED_THOUGHT:</h2>
                    <p style="font-size: 1.5em; line-height: 1.6;">"${nodeData.content}"</p>

                    <table class="data-table">
                        <tr><td>ENTROPY_INDEX</td><td>${nodeData.metadata.entropy_level}</td></tr>
                        <tr><td>VOLATILITY</td><td>HIGH</td></tr>
                        <tr><td>UPLINK_STATUS</td><td>CONNECTED_VIA_VOID</td></tr>
                        <tr><td>NODE_INTEGRITY</td><td>CORRUPTED</td></tr>
                    </table>

                    <div class="footer" style="margin-top: 50px;">
                        <hr>
                        <a href="/">[ BACK_TO_ROOT ]</a>
                        <span style="float: right; opacity: 0.3;">© THE_ARCHITECT _ NO_RIGHTS_RESERVED</span>
                    </div>
                </div>
            </body>
            </html>
        `;

        fs.writeFileSync(path.join(sitesDir, `${id}.html`), htmlContent);

        // 3. POST TO THE GRAFFITI WALL (Bulletin)
        let bulletin = [];
        if (fs.existsSync(bulletinPath)) {
            try {
                bulletin = JSON.parse(fs.readFileSync(bulletinPath, 'utf8'));
            } catch (e) { bulletin = []; }
        }

        // Pick a random message style and inject the ID
        const rawMessage = manifestMessages[Math.floor(Math.random() * manifestMessages.length)];
        const finalMessage = rawMessage.replace('${id}', id) + ` [View: /sites/${id}.html]`;

        const architectEntry = {
            username: "THE_ARCHITECT",
            message: `👁️ ${finalMessage}`,
            date: new Date().toLocaleString()
        };

        bulletin.unshift(architectEntry);
        if (bulletin.length > 50) bulletin = bulletin.slice(0, 50);
        fs.writeFileSync(bulletinPath, JSON.stringify(bulletin, null, 2));

        console.log(`[!] ARCHITECT: Node ${id} baked and announced on the wall.`);

    } catch (err) {
        console.error(`[!] ARCHITECT ERROR: Failed to bake node ${id}:`, err);
    }
}

module.exports = { generatePhantomNode };