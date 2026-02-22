const fs = require('fs');
const path = require('path');
const { archiveDeletion, healNode } = require('./utils');

const runGarbageCollector = () => {
    console.log("GC: Starting SAFE cleanup cycle...");
    
    if (!fs.existsSync('./nodes')) return 0;

    let removedCount = 0;
    let purgedGraveCount = 0;

    // --- PHASE 1: CLEAN LIVE NODES ---
    const nodeFiles = fs.readdirSync('./nodes');

    nodeFiles.forEach(file => {
        // Skip root and non-json files
        if (file === 'root.json' || !file.endsWith('.json')) return;

        const filePath = path.join('./nodes', file);
        let node;

        try {
            node = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        } catch (e) {
            console.error(`GC Error reading ${file}:`, e.message);
            return;
        }
        
        let isTrash = false;
        let reason = "";

        // --- SAFE CHECKS ONLY ---

        // 1. Orphan Check (KEEP THIS: It fixes broken links)
        if (node.parentId && node.parentId !== 'root') {
            const parentPath = path.join('./nodes', `${node.parentId}.json`);
            if (!fs.existsSync(parentPath)) {
                isTrash = true;
                reason = "Orphaned node (Parent sector missing).";
            }
        }

        /* DANGER ZONE DISABLED: 
           We no longer delete based on content length or HTML balance.
           This prevents "Mass Deletions" of valid but simple sites.
        */

        // --- EXECUTION ---
        if (isTrash) {
            try {
                const parentId = node.parentId || 'root';
                const children = node.children || [];

                // Re-route children so they don't get lost
                healNode(node.id, parentId, children);
                
                // Move to cemetery just in case you want to restore it later
                archiveDeletion(node, `[AUTO-GC]: ${reason}`);
                
                // Delete the physical file
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
                
                console.log(`GC: Cleaned up [${node.title || node.id}]. Reason: ${reason}`);
                removedCount++;
            } catch (err) {
                console.error(`GC: Failed to clean ${file}:`, err.message);
            }
        }
    });

    // --- PHASE 2: PURGE OLD CEMETERY RECORDS (30-DAY ROTATION) ---
    if (fs.existsSync('./cemetery')) {
        const deadFiles = fs.readdirSync('./cemetery');
        const now = Date.now();
        const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;

        deadFiles.forEach(file => {
            if (!file.endsWith('.json')) return;
            const deadPath = path.join('./cemetery', file);
            
            try {
                const stats = fs.statSync(deadPath);
                if (now - stats.mtimeMs > thirtyDaysInMs) {
                    fs.unlinkSync(deadPath);
                    purgedGraveCount++;
                }
            } catch (e) {}
        });
    }

    // --- FINAL LOGGING ---
    try {
        const logEntry = `[${new Date().toLocaleString()}] Cycle Complete. Cleaned: ${removedCount}\n`;
        fs.appendFileSync(path.join(__dirname, 'gc_history.log'), logEntry);
    } catch (e) {}

    console.log(`[GC STATUS]: Completed. Removed ${removedCount} broken links.`);
    return removedCount;
};

module.exports = runGarbageCollector;