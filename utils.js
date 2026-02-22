const fs = require('fs');
const path = require('path');

const archiveDeletion = (node, reason) => {
    if (!fs.existsSync('./cemetery')) fs.mkdirSync('./cemetery');
    
    const tombstone = {
        id: node.id,
        title: node.title,
        content: node.content, // Now saving the full HTML!
        views: node.views || 0,
        reason: reason,
        originalParent: node.parentId || 'root',
        deletedAt: new Date().toLocaleString()
    };
    
    fs.writeFileSync(`./cemetery/${node.id}.json`, JSON.stringify(tombstone, null, 2));
};

// Helper to handle the structural "Healing" (Grandparent adoption)
const healNode = (targetId, parentId, childrenToMove) => {
    // 1. Update the Parent Node
    const parentPath = `./nodes/${parentId}.json`;
    if (fs.existsSync(parentPath)) {
        let parentData = JSON.parse(fs.readFileSync(parentPath));
        parentData.children = parentData.children.filter(child => child.id !== targetId);
        parentData.children = [...parentData.children, ...childrenToMove];
        fs.writeFileSync(parentPath, JSON.stringify(parentData));
    }

    // 2. Update the Orphans
    childrenToMove.forEach(child => {
        const childPath = `./nodes/${child.id}.json`;
        if (fs.existsSync(childPath)) {
            let childData = JSON.parse(fs.readFileSync(childPath));
            childData.parentId = parentId;
            fs.writeFileSync(childPath, JSON.stringify(childData));
        }
    });
};

const reviveNode = (nodeId) => {
    const deadPath = `./cemetery/${nodeId}.json`;
    const nodePath = `./nodes/${nodeId}.json`;

    if (!fs.existsSync(deadPath)) return { success: false, message: "Tombstone not found." };

    const deadData = JSON.parse(fs.readFileSync(deadPath));

    // Reconstruct the node exactly as it was
    const revivedNode = {
        id: deadData.id,
        title: deadData.title,
        parentId: deadData.originalParent,
        content: deadData.content, // RESTORED CONTENT
        children: [], // Children remain with the grandparent for safety
        views: deadData.views,
        isUnderConstruction: true // Set to true so admin can check it first
    };

    // Re-attach to Parent
    const parentPath = `./nodes/${revivedNode.parentId}.json`;
    if (fs.existsSync(parentPath)) {
        let parentData = JSON.parse(fs.readFileSync(parentPath));
        if (!parentData.children.find(c => c.id === nodeId)) {
            parentData.children.push({ id: revivedNode.id, title: revivedNode.title });
            fs.writeFileSync(parentPath, JSON.stringify(parentData));
        }
    }

    fs.writeFileSync(nodePath, JSON.stringify(revivedNode, null, 2));
    fs.unlinkSync(deadPath);

    return { success: true };
};

module.exports = { archiveDeletion, healNode, reviveNode };