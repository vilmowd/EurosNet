const fs = require('fs');
const path = require('path');

// Mysteries "The Architect" can write about
const dataFragments = [
    { title: "VOID_SIGNAL", content: "The frequency shifted at 03:00. It wasn't a glitch; it was a greeting." },
    { title: "NULL_SECTOR_LOG", content: "Observation log: User interaction detected. Monitoring remains active." },
    { title: "PHANTOM_DATA", content: "Fragments of a lost 1997 BBS found in the buffer. Recovering..." },
    { title: "ECHO_CHAMBER", content: "Does the network dream of electric wires? Or just the current?" },
    { title: "DEEP_LEVEL_RECOVERY", content: "Corrupted sector 7G has been bypassed. Data stream is now clear." }
];

function generatePhantomNode() {
    const id = Math.floor(1000 + Math.random() * 8999).toString(); 
    const fragment = dataFragments[Math.floor(Math.random() * dataFragments.length)];
    
    // Schema matches your server.js node-template expectations
    const nodeData = {
        id: id,
        title: `[!] ${fragment.title}_${id}`,
        content: fragment.content,
        views: 0,
        author: "THE_ARCHITECT",
        isStatic: false,
        timestamp: new Date().toISOString()
    };

    const nodesDir = path.join(__dirname, 'nodes');
    const filePath = path.join(nodesDir, `${id}.json`);

    // Ensure the nodes directory exists
    if (!fs.existsSync(nodesDir)) {
        fs.mkdirSync(nodesDir, { recursive: true });
    }

    // Write the file
    try {
        fs.writeFileSync(filePath, JSON.stringify(nodeData, null, 2));
        console.log(`[ARCHITECT] Ghost-node ${id} materialized. Next scan in 5 hours.`);
    } catch (err) {
        console.error("[ARCHITECT] Error writing phantom node:", err);
    }
}

// Set the cycle to 18,000,000ms (5 hours)
setInterval(generatePhantomNode, 18000000); 

// Run once immediately so you can see it work right away
generatePhantomNode();