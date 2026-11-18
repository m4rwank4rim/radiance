const { createCanvas, loadImage } = require('canvas');
const path = require('path');

class CanvasRenderer {
    static icons = {};

    /**
     * Load all custom icons into memory.
     */
    static async loadIcons() {
        const iconPath = path.join(__dirname, '../../Icons');
        try {
            this.icons.bomb = await loadImage(path.join(iconPath, 'bomb.png'));
            this.icons.diamond = await loadImage(path.join(iconPath, 'diamond.png'));
            this.icons.gem = await loadImage(path.join(iconPath, 'gem.png'));
        } catch (e) {
            console.error('Failed to load icons:', e.message);
        }
    }

    /**
     * Helper to draw the new minimal header layout.
     * @param {Object} ctx - Canvas context
     * @param {number} width - Canvas width
     * @param {Object} userData - User stats
     */
    static async drawHeader(ctx, width, userData) {
        const headerHeight = 140;
        const padding = 60;

        // Background (Very Dark, almost black)
        // No explicit rect needed if main BG covers it, but for safety:
        // ctx.fillStyle = '#0b0e11'; 
        // ctx.fillRect(0, 0, width, headerHeight);

        // --- LEFT: Avatar (Circle) & Name ---
        const avatarSize = 80;
        const avatarY = (headerHeight - avatarSize) / 2;
        
        try {
            if (userData.avatarUrl) {
                const avatar = await loadImage(userData.avatarUrl);
                ctx.save();
                ctx.beginPath();
                ctx.arc(padding + avatarSize/2, avatarY + avatarSize/2, avatarSize/2, 0, Math.PI * 2);
                ctx.clip();
                ctx.drawImage(avatar, padding, avatarY, avatarSize, avatarSize);
                ctx.restore();
            } else {
                ctx.fillStyle = '#c9d1d9';
                ctx.beginPath();
                ctx.arc(padding + avatarSize/2, avatarY + avatarSize/2, avatarSize/2, 0, Math.PI * 2);
                ctx.fill();
            }
        } catch (e) {
            // Fallback
        }

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 32px Arial'; 
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(userData.name || 'User', padding + avatarSize + 25, headerHeight / 2 - 15);

        // Rank (Small, Gold)
        if (userData.rank) {
            ctx.fillStyle = '#f2c94c';
            ctx.font = 'bold 20px Arial';
            ctx.fillText(userData.rank.toUpperCase(), padding + avatarSize + 25, headerHeight / 2 + 25);
        }

        // --- CENTER: Multiplier Badge (Rounded Pill) ---
        const multW = 160;
        const multH = 60;
        const multX = (width - multW) / 2;
        const multY = (headerHeight - multH) / 2;

        ctx.fillStyle = '#f2c94c'; // Gold
        this.drawRoundedRect(ctx, multX, multY, multW, multH, 12);
        ctx.fill();

        ctx.fillStyle = '#0d1117'; // Dark text on gold
        ctx.font = 'bold 32px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${(userData.multiplier || 1.0).toFixed(2)}x`, width / 2, headerHeight / 2 + 2);

        // --- RIGHT: Bet Amount & Profit ---
        const rightX = width - padding;
        
        ctx.textAlign = 'right';
        
        // "BET AMOUNT" Label (Small, Grey, Uppercase)
        ctx.fillStyle = '#8b949e';
        ctx.font = 'bold 16px Arial';
        ctx.fillText('BET AMOUNT', rightX, headerHeight / 2 - 25);

        // Bet Value & Profit (Large)
        // Format: "$52+ $500" where profit is green
        
        const betText = `$${(userData.bet || 0).toLocaleString()}`;
        ctx.font = 'bold 40px Arial';
        
        let totalWidth = ctx.measureText(betText).width;
        let profitText = '';
        
        if (userData.profit && userData.profit > 0) {
            profitText = `+$${userData.profit.toLocaleString(undefined, {maximumFractionDigits:0})} `;
            totalWidth += ctx.measureText(profitText).width;
        }

        // Right align the whole block
        // Draw Bet (White) at the far right
        ctx.fillStyle = '#ffffff';
        ctx.fillText(betText, rightX, headerHeight / 2 + 20);

        // Draw Profit (Green) to the left of Bet
        if (profitText) {
            const betWidth = ctx.measureText(betText).width;
            ctx.fillStyle = '#3fb950'; // Bright Green
            ctx.fillText(profitText, rightX - betWidth - 10, headerHeight / 2 + 20);
        }
    }

    /**
     * Draw a 5x5 Mines grid with custom UI optimized for Discord full-frame.
     * @param {number[][]} grid - 2D array representing the grid state (0: hidden, 1: gem, 2: mine)
     * @param {Object} userData - { name: string, avatarUrl: string, bet: number, multiplier: number, profit: number }
     * @returns {Buffer} - PNG buffer
     */
    static async drawMinesGrid(grid, userData = {}) {
        const width = 1200;
        const height = 1200; // Increased height to accommodate header + large grid
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // Background (Dark Charcoal/Black)
        ctx.fillStyle = '#0b0e11'; 
        ctx.fillRect(0, 0, width, height);

        await this.drawHeader(ctx, width, userData);

        // Grid Section (Centered below header)
        const headerHeight = 140;
        const gridSize = 5;
        const gridPadding = 20; // Increased gap
        
        // Calculate max possible size for the grid
        const availableWidth = width - 120; // 60px side padding
        const availableHeight = height - headerHeight - 60; // Bottom padding
        
        const gridSide = Math.min(availableWidth, availableHeight);
        const tileSize = (gridSide - (gridPadding * (gridSize - 1))) / gridSize;
        
        // Center the grid exactly
        const totalGridWidth = (tileSize * gridSize) + (gridPadding * (gridSize - 1));
        const gridX = (width - totalGridWidth) / 2;
        const gridY = headerHeight + (height - headerHeight - totalGridWidth) / 2;

        for (let row = 0; row < gridSize; row++) {
            for (let col = 0; col < gridSize; col++) {
                const x = gridX + col * (tileSize + gridPadding);
                const y = gridY + row * (tileSize + gridPadding);
                const state = grid[row][col];

                // Tile Background (Dark Blue-Grey)
                ctx.fillStyle = '#242c38'; 
                
                this.drawRoundedRect(ctx, x, y, tileSize, tileSize, 12); 
                ctx.fill();

                if (state === 3) { // Empty slot for Cash Out
                    continue;
                }

                if (state === 1) { // Gem
                    // Subtle Glow
                    ctx.shadowColor = 'rgba(88, 166, 255, 0.4)';
                    ctx.shadowBlur = 15;
                    ctx.strokeStyle = '#58a6ff'; // Blue
                    ctx.lineWidth = 3;
                    ctx.stroke();
                    ctx.shadowBlur = 0;

                    if (this.icons.diamond) {
                        ctx.drawImage(this.icons.diamond, x + 20, y + 20, tileSize - 40, tileSize - 40);
                    } else {
                        this.drawDiamond(ctx, x + tileSize / 2, y + tileSize / 2, tileSize * 0.6);
                    }
                } else if (state === 2) { // Mine
                    // Subtle Glow
                    ctx.shadowColor = 'rgba(248, 81, 73, 0.4)';
                    ctx.shadowBlur = 15;
                    ctx.strokeStyle = '#f85149'; // Red
                    ctx.lineWidth = 3;
                    ctx.stroke();
                    ctx.shadowBlur = 0;

                    if (this.icons.bomb) {
                        ctx.drawImage(this.icons.bomb, x + 20, y + 20, tileSize - 40, tileSize - 40);
                    } else {
                        this.drawBomb(ctx, x + tileSize / 2, y + tileSize / 2, tileSize * 0.7);
                    }
                }
            }
        }

        if (userData.isGameOver) {
            const amount = userData.isWon ? (userData.bet * userData.multiplier) : userData.bet;
            this.drawGameOverOverlay(ctx, width, height, userData.isWon, amount);
        }

        return canvas.toBuffer('image/png');
    }

    /**
     * Draw a polished diamond icon.
     */
    static drawDiamond(ctx, x, y, size) {
        ctx.save();
        ctx.translate(x, y);
        
        // Main diamond shape
        ctx.beginPath();
        ctx.moveTo(0, -size / 2);
        ctx.lineTo(size / 2, 0);
        ctx.lineTo(0, size / 2);
        ctx.lineTo(-size / 2, 0);
        ctx.closePath();

        // Create gradient
        const grad = ctx.createLinearGradient(-size / 2, -size / 2, size / 2, size / 2);
        grad.addColorStop(0, '#58a6ff');
        grad.addColorStop(1, '#00d2ff');
        ctx.fillStyle = grad;
        ctx.fill();

        // Facets (simpler version)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-size / 2, 0);
        ctx.lineTo(size / 2, 0);
        ctx.moveTo(0, -size / 2);
        ctx.lineTo(0, size / 2);
        ctx.stroke();

        ctx.restore();
    }

    /**
     * Draw a polished bomb icon.
     */
    static drawBomb(ctx, x, y, size) {
        ctx.save();
        ctx.translate(x, y);

        // Bomb body
        const grad = ctx.createRadialGradient(-size / 10, -size / 10, 0, 0, 0, size / 2);
        grad.addColorStop(0, '#ff5f5f');
        grad.addColorStop(1, '#f85149');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
        ctx.fill();

        // Fuse/Wick
        ctx.strokeStyle = '#f2c94c';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(0, -size / 2);
        ctx.quadraticCurveTo(size / 4, -size * 0.7, size / 2, -size / 2);
        ctx.stroke();

        // Spark
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(size / 2, -size / 2, 4, 0, Math.PI * 2);
        ctx.fill();

        // Little star in the center
        ctx.fillStyle = '#f2c94c';
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('★', 0, 0);

        ctx.restore();
    }

    /**
     * Helper to draw a game over overlay.
     */
    static drawGameOverOverlay(ctx, width, height, isWon, amount) {
        // Semi-transparent overlay
        ctx.fillStyle = 'rgba(13, 17, 23, 0.85)';
        ctx.fillRect(0, 0, width, height);

        // Text
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Main Message
        ctx.font = 'bold 80px Arial';
        ctx.fillStyle = isWon ? '#3fb950' : '#f85149';
        ctx.fillText(isWon ? 'YOU WON' : 'GAME OVER', width / 2, height / 2 - 40);

        // Amount Message
        ctx.font = 'bold 50px Arial';
        ctx.fillStyle = '#ffffff';
        const prefix = isWon ? 'Won' : 'Lost';
        ctx.fillText(`${prefix} $${amount.toFixed(2)}`, width / 2, height / 2 + 50);
    }
    /**
     * Draw a Tower game state with the new 3-column multiplier UI.
     * @param {Object} game - The tower game instance
     * @param {Object} userData - User stats
     * @returns {Buffer} - PNG buffer
     */
    static async drawTower(gameData, userData = {}) {
        const width = 1200;
        const height = 1000;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // Background
        ctx.fillStyle = '#0d1117';
        ctx.fillRect(0, 0, width, height);

        await this.drawHeader(ctx, width, userData);

        // Tower Section (Below Header)
        const headerHeight = 120;
        const towerAreaWidth = width;
        const padding = 20;
        const columns = 3;
        const rows = userData.totalLevels || 8;
        
        // Maximize grid width but keep it reasonable
        const gridWidth = Math.min(towerAreaWidth - 100, 800);
        const tileWidth = (gridWidth - (padding * (columns - 1))) / columns;
        const tileHeight = 85; 
        const rowSpacing = 15;
        const gridX = (towerAreaWidth - gridWidth) / 2;
        
        // Calculate total grid height to center it vertically below header
        const totalGridHeight = (rows * tileHeight) + ((rows - 1) * rowSpacing);
        const gridY = headerHeight + (height - headerHeight - totalGridHeight) / 2;

        for (let r = 0; r < rows; r++) {
            const levelIndex = rows - 1 - r;
            const y = gridY + r * (tileHeight + rowSpacing);
            // Calculate multiplier using userData properties
            const levelMultiplier = userData.multipliers ? userData.multipliers[levelIndex] : 1.0;
            const bustPath = userData.levelOutcomes ? userData.levelOutcomes[levelIndex] : -1;

            for (let c = 0; c < columns; c++) {
                const x = gridX + c * (tileWidth + padding);
                
                // Base Tile Gradient
                let grad = ctx.createLinearGradient(x, y, x, y + tileHeight);
                let textColor = '#f2c94c';

                if (levelIndex === userData.currentLevel && !userData.isGameOver) {
                    // Active Level (Purple Glow)
                    grad.addColorStop(0, '#8e44ad');
                    grad.addColorStop(1, '#6c5ce7');
                    textColor = '#ffffff';
                    
                    // Add glow
                    ctx.shadowColor = 'rgba(142, 68, 173, 0.6)';
                    ctx.shadowBlur = 15;
                } else if (levelIndex < userData.currentLevel) {
                    // Past Levels (Darker)
                    grad.addColorStop(0, '#161b22');
                    grad.addColorStop(1, '#0d1117');
                    textColor = 'rgba(242, 201, 76, 0.3)';
                    ctx.shadowBlur = 0;
                } else {
                    // Future Levels (Standard)
                    grad.addColorStop(0, '#2d3436');
                    grad.addColorStop(1, '#21262d');
                    ctx.shadowBlur = 0;
                }

                // Override colors if game is over to reveal everything
                if (userData.isGameOver) {
                    ctx.shadowBlur = 0;
                    if (c === bustPath) {
                        grad = ctx.createLinearGradient(x, y, x, y + tileHeight);
                        grad.addColorStop(0, '#2c1e1e');
                        grad.addColorStop(1, '#1a0c0c');
                    } else {
                        grad = ctx.createLinearGradient(x, y, x, y + tileHeight);
                        grad.addColorStop(0, '#161b22');
                        grad.addColorStop(1, '#0d1117');
                    }
                }

                this.drawRoundedRect(ctx, x, y, tileWidth, tileHeight, 12);
                ctx.fillStyle = grad;
                ctx.fill();
                ctx.shadowBlur = 0; // Reset shadow

                // Multiplier Text (Only show if level is active/future and game is NOT over)
                if (!userData.isGameOver && levelIndex >= userData.currentLevel) {
                    ctx.fillStyle = textColor;
                    ctx.font = 'bold 28px Arial';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(`${levelMultiplier.toFixed(2)}x`, x + tileWidth / 2, y + tileHeight / 2);
                }

                // Draw Icons if game is over or passed
                if (userData.isGameOver) {
                    if (c === bustPath) {
                        if (this.icons.bomb) {
                            ctx.drawImage(this.icons.bomb, x + (tileWidth - 65) / 2, y + (tileHeight - 65) / 2, 65, 65);
                        } else {
                            this.drawBomb(ctx, x + tileWidth / 2, y + tileHeight / 2, 75);
                        }
                    } else if (userData.pathHistory && userData.pathHistory[levelIndex] === c) {
                        const prevMultiplier = levelIndex > 0 ? userData.multipliers[levelIndex-1] : 1.0;
                        if (this.icons.gem) {
                            ctx.drawImage(this.icons.gem, x + (tileWidth - 65) / 2, y + (tileHeight - 65) / 2, 65, 65);
                            this.drawMultiplierLabel(ctx, x + tileWidth / 2, y + tileHeight / 2, 65, prevMultiplier);
                        } else {
                            this.drawCrystal(ctx, x + tileWidth / 2, y + tileHeight / 2, 75, prevMultiplier);
                        }
                    }
                } else if (userData.pathHistory && userData.pathHistory[levelIndex] === c) {
                    const prevMultiplier = levelIndex > 0 ? userData.multipliers[levelIndex-1] : 1.0;
                    if (this.icons.gem) {
                        ctx.drawImage(this.icons.gem, x + (tileWidth - 65) / 2, y + (tileHeight - 65) / 2, 65, 65);
                        this.drawMultiplierLabel(ctx, x + tileWidth / 2, y + tileHeight / 2, 65, prevMultiplier);
                    } else {
                        this.drawCrystal(ctx, x + tileWidth / 2, y + tileHeight / 2, 75, prevMultiplier);
                    }
                }
            }
        }

        if (userData.isGameOver) {
            const amount = userData.isWon ? (userData.bet * userData.multiplier) : userData.bet;
            this.drawGameOverOverlay(ctx, width, height, userData.isWon, amount);
        }

        return canvas.toBuffer('image/png');
    }

    /**
     * Draw a multiplier label at a specific position.
     */
    static drawMultiplierLabel(ctx, x, y, size, multiplier) {
        if (multiplier > 0) {
            ctx.save();
            const label = `${multiplier.toFixed(2)}x`;
            ctx.font = 'bold 20px Arial';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 4;
            ctx.strokeText(label, x + size / 3, y - size / 3);
            
            ctx.fillStyle = '#ffffff';
            ctx.fillText(label, x + size / 3, y - size / 3);
            ctx.restore();
        }
    }

    /**
     * Draw a high-detail 3D crystal icon with a top-right multiplier label.
     */
    static drawCrystal(ctx, x, y, size, multiplier) {
        ctx.save();
        ctx.translate(x, y);
        
        // 3D Shadow/Base
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i + (Math.PI / 6);
            ctx.lineTo((size / 2) * Math.cos(angle), (size / 2) * Math.sin(angle) + 5);
        }
        ctx.closePath();
        ctx.fill();

        // Main Hexagon (Body)
        const grad = ctx.createLinearGradient(0, -size / 2, 0, size / 2);
        grad.addColorStop(0, '#a29bfe');
        grad.addColorStop(1, '#6c5ce7');
        ctx.fillStyle = grad;
        
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i + (Math.PI / 6);
            const px = (size / 2) * Math.cos(angle);
            const py = (size / 2) * Math.sin(angle);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();

        // Inner Facet (Brighter)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i + (Math.PI / 6);
            ctx.lineTo((size / 3) * Math.cos(angle), (size / 3) * Math.sin(angle));
        }
        ctx.closePath();
        ctx.fill();

        // Dark Border
        ctx.strokeStyle = '#2d2d2d';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();

        // Multiplier label on the TOP-RIGHT
        this.drawMultiplierLabel(ctx, x, y, size, multiplier);
    }

    /**
     * Draw a branded economy card (for balance, daily, etc.).
     * @param {string} title - The title of the card
     * @param {string} subtitle - The secondary message
     * @param {Object} userData - User stats (name, avatarUrl, balance)
     * @returns {Buffer} - PNG buffer
     */
    static async drawEconomyCard(title, subtitle, userData = {}) {
        const width = 1200;
        const height = 400;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // Background
        ctx.fillStyle = '#0d1117';
        ctx.fillRect(0, 0, width, height);

        const contentPadding = 60;

        // Draw User Profile Section
        try {
            if (userData.avatarUrl) {
                const avatar = await loadImage(userData.avatarUrl);
                ctx.save();
                ctx.beginPath();
                ctx.arc(contentPadding + 50, height / 2, 50, 0, Math.PI * 2);
                ctx.clip();
                ctx.drawImage(avatar, contentPadding, height / 2 - 50, 100, 100);
                ctx.restore();
            }
        } catch (e) {
            ctx.fillStyle = '#c9d1d9';
            ctx.beginPath();
            ctx.arc(contentPadding + 50, height / 2, 50, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 42px Arial';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(userData.name || 'User', contentPadding + 130, height / 2 - 40);

        ctx.fillStyle = '#f2c94c';
        ctx.font = 'bold 24px Arial';
        ctx.fillText((userData.rank || 'Newbie').toUpperCase(), contentPadding + 130, height / 2 + 5);

        ctx.fillStyle = '#8b949e';
        ctx.font = '24px Arial';
        ctx.fillText('Account Member', contentPadding + 130, height / 2 + 45);

        // Divider
        ctx.strokeStyle = '#30363d';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(width / 2, 80);
        ctx.lineTo(width / 2, height - 80);
        ctx.stroke();

        // Title and Value Section (Right Side)
        const rightX = width / 2 + 80;
        ctx.fillStyle = '#f2c94c';
        ctx.font = 'bold 36px Arial';
        ctx.fillText(title.toUpperCase(), rightX, height / 2 - 40);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 64px Arial';
        ctx.fillText(subtitle, rightX, height / 2 + 30);

        // Branded Border/Accents
        ctx.fillStyle = '#4e34e1';
        ctx.fillRect(0, 0, 10, height); // Left accent bar

        return canvas.toBuffer('image/png');
    }

    /**
     * Draw a branded leaderboard card.
     * @param {Array} topUsers - List of { name, balance, avatarUrl }
     * @returns {Buffer} - PNG buffer
     */
    static async drawLeaderboard(topUsers) {
        const width = 1200;
        const height = 180 + (topUsers.length * 120);
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // Background
        ctx.fillStyle = '#0d1117';
        ctx.fillRect(0, 0, width, height);

        // Title: LEADERBOARD
        ctx.fillStyle = '#f2c94c';
        ctx.font = 'bold 84px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText('LEADERBOARD', width / 2, 50);

        // Draw Rows
        const startY = 170;
        const rowPadding = 20;
        const rowWidth = width - 120;
        const rowHeight = 100; // Slightly taller rows
        const leftX = 60;

        for (let i = 0; i < topUsers.length; i++) {
            const user = topUsers[i];
            const y = startY + i * (rowHeight + rowPadding);

            // Row Background (Dark Grey)
            ctx.fillStyle = '#161b22';
            this.drawRoundedRect(ctx, leftX, y, rowWidth, rowHeight, 18);
            ctx.fill();

            // Rank Badge (Gold Rectangle)
            const badgeW = 90;
            const badgeH = 70;
            ctx.fillStyle = '#f2c94c';
            this.drawRoundedRect(ctx, leftX + 20, y + (rowHeight - badgeH) / 2, badgeW, badgeH, 12);
            ctx.fill();

            ctx.fillStyle = '#0d1117';
            ctx.font = 'bold 38px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`#${i + 1}`, leftX + 20 + badgeW / 2, y + rowHeight / 2);

            // Avatar (Circle)
            try {
                if (user.avatarUrl) {
                    const avatar = await loadImage(user.avatarUrl);
                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(leftX + 170, y + rowHeight / 2, 40, 0, Math.PI * 2);
                    ctx.clip();
                    ctx.drawImage(avatar, leftX + 130, y + rowHeight / 2 - 40, 80, 80);
                    ctx.restore();
                }
            } catch (e) {
                ctx.fillStyle = '#c9d1d9';
                ctx.beginPath();
                ctx.arc(leftX + 170, y + rowHeight / 2, 40, 0, Math.PI * 2);
                ctx.fill();
            }

            // Name (White)
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 36px Arial';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(user.name, leftX + 230, y + rowHeight / 2 - 18);

            // Rank (Gold, Small)
            if (user.rank) {
                ctx.fillStyle = '#f2c94c';
                ctx.font = 'bold 20px Arial';
                ctx.fillText(user.rank.toUpperCase(), leftX + 230, y + rowHeight / 2 + 22);
            }

            // Balance (White, far right)
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 52px Arial';
            ctx.textAlign = 'right';
            ctx.fillText(`$${user.balance.toLocaleString()}`, leftX + rowWidth - 40, y + rowHeight / 2);
        }

        return canvas.toBuffer('image/png');
    }

    /**
     * Draw a Hi-Lo card with branded UI.
     * @param {Object} card - { value: number, suit: number, label: string, suitLabel: string }
     * @param {Object} userData - User stats
     * @returns {Buffer} - PNG buffer
     */
    static async drawHilo(card, userData = {}) {
        const width = 1200;
        const height = 1000;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // Background
        ctx.fillStyle = '#0d1117';
        ctx.fillRect(0, 0, width, height);

        await this.drawHeader(ctx, width, userData);

        // Card Section (Below Header)
        const headerHeight = 120;
        const contentHeight = height - headerHeight;
        
        const cardWidth = 420; 
        const cardHeight = 600;
        const cardX = (width - cardWidth) / 2;
        const cardY = headerHeight + (contentHeight - cardHeight) / 2;

        // Draw "Deck" Effect behind
        for (let i = 2; i >= 1; i--) {
            ctx.fillStyle = '#2c3e50';
            const offsetX = i * 15;
            const offsetY = i * 15;
            this.drawRoundedRect(ctx, cardX + offsetX, cardY + offsetY, cardWidth, cardHeight, 24);
            ctx.fill();
            ctx.strokeStyle = '#34495e';
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        // Main Card Shadow
        ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
        ctx.shadowBlur = 40;
        ctx.shadowOffsetX = 20;
        ctx.shadowOffsetY = 20;

        // Card background
        const cardGrad = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardHeight);
        cardGrad.addColorStop(0, '#ffffff');
        cardGrad.addColorStop(1, '#dfe4ea');
        ctx.fillStyle = cardGrad;
        
        this.drawRoundedRect(ctx, cardX, cardY, cardWidth, cardHeight, 24);
        ctx.fill();
        
        // Reset shadow
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        // Card border (Gold trim)
        ctx.strokeStyle = '#f2c94c';
        ctx.lineWidth = 6;
        ctx.stroke();

        // Card content color
        const isRed = card.suit === 1 || card.suit === 2;
        const mainColor = isRed ? '#e74c3c' : '#2d3436';
        ctx.fillStyle = mainColor;
        
        // Top-left corner
        ctx.font = 'bold 60px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(card.label, cardX + 60, cardY + 80);
        ctx.font = '50px Arial';
        ctx.fillText(card.suitLabel, cardX + 60, cardY + 140);

        // Bottom-right corner (inverted)
        ctx.save();
        ctx.translate(cardX + cardWidth - 60, cardY + cardHeight - 80);
        ctx.rotate(Math.PI);
        ctx.font = 'bold 60px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(card.label, 0, 0);
        ctx.font = '50px Arial';
        ctx.fillText(card.suitLabel, 0, -60);
        ctx.restore();

        // Center large suit
        ctx.font = 'bold 240px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        // Add subtle shadow to suit
        ctx.shadowColor = 'rgba(0,0,0,0.2)';
        ctx.shadowBlur = 10;
        ctx.fillText(card.suitLabel, cardX + cardWidth / 2, cardY + cardHeight / 2);
        ctx.shadowBlur = 0;

        if (userData.isGameOver) {
            const amount = userData.isWon ? (userData.bet * userData.multiplier) : userData.bet;
            this.drawGameOverOverlay(ctx, width, height, userData.isWon, amount);
        }

        return canvas.toBuffer('image/png');
    }

    /**
     * Draw a Crash game state with branded UI.
     * @param {number} currentMultiplier - Current multiplier
     * @param {Object} userData - User stats
     * @returns {Buffer} - PNG buffer
     */
    static async drawCrash(currentMultiplier, userData = {}) {
        const width = 1200;
        const height = 800;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // Background
        ctx.fillStyle = '#0d1117';
        ctx.fillRect(0, 0, width, height);

        await this.drawHeader(ctx, width, userData);

        // Crash Section (Below Header)
        const headerHeight = 120;
        const chartPadding = 60;
        const chartWidth = width - (chartPadding * 2);
        const chartHeight = height - headerHeight - (chartPadding * 2);
        const chartX = chartPadding;
        const chartY = height - chartPadding;

        // Chart Background (Darker area)
        ctx.fillStyle = '#11141a';
        ctx.fillRect(chartX, chartY - chartHeight, chartWidth, chartHeight);

        // Draw Chart Grid
        ctx.strokeStyle = '#21262d';
        ctx.lineWidth = 2;
        const gridLines = 8;
        for (let i = 0; i <= gridLines; i++) {
            // Horizontal lines
            const y = chartY - (i / gridLines) * chartHeight;
            ctx.beginPath();
            ctx.moveTo(chartX, y);
            ctx.lineTo(chartX + chartWidth, y);
            ctx.stroke();

            // Vertical lines
            const x = chartX + (i / gridLines) * chartWidth;
            ctx.beginPath();
            ctx.moveTo(x, chartY);
            ctx.lineTo(x, chartY - chartHeight);
            ctx.stroke();
        }

        // Draw Axes
        ctx.strokeStyle = '#30363d';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(chartX, chartY - chartHeight);
        ctx.lineTo(chartX, chartY);
        ctx.lineTo(chartX + chartWidth, chartY);
        ctx.stroke();

        // Draw Exponential Curve
        const steps = 150;
        const maxMult = Math.max(1.5, currentMultiplier * 1.2);
        
        // Path for the curve
        ctx.beginPath();
        ctx.moveTo(chartX, chartY);

        for (let i = 1; i <= steps; i++) {
            const progress = i / steps;
            const multAtStep = 1.0 + (maxMult - 1.0) * Math.pow(progress, 2.0);
            
            if (multAtStep <= currentMultiplier) {
                const x = chartX + progress * chartWidth;
                const y = chartY - ((multAtStep - 1.0) / (maxMult - 1.0)) * chartHeight;
                ctx.lineTo(x, y);
            }
        }

        // Stroke the curve (Neon Glow)
        ctx.shadowColor = '#f2c94c';
        ctx.shadowBlur = 30;
        ctx.strokeStyle = '#f2c94c';
        ctx.lineWidth = 8;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Fill under the curve
        const lastX = chartX + (Math.sqrt((currentMultiplier - 1.0) / (maxMult - 1.0))) * chartWidth;
        const gradient = ctx.createLinearGradient(chartX, chartY - chartHeight, chartX, chartY);
        gradient.addColorStop(0, 'rgba(242, 201, 76, 0.4)');
        gradient.addColorStop(1, 'rgba(242, 201, 76, 0.05)');
        
        ctx.fillStyle = gradient;
        ctx.lineTo(lastX, chartY);
        ctx.lineTo(chartX, chartY);
        ctx.closePath();
        ctx.fill();

        // Rocket Icon at the tip
        if (!userData.isGameOver) {
            const rocketY = chartY - ((currentMultiplier - 1.0) / (maxMult - 1.0)) * chartHeight;
            ctx.font = '40px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🚀', lastX, rocketY - 30);
        }

        // Draw current multiplier text (Center)
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 140px Arial'; // Massive
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 20;
        ctx.fillText(`${currentMultiplier.toFixed(2)}x`, chartX + chartWidth / 2, chartY - chartHeight / 2);
        ctx.shadowBlur = 0;

        if (userData.isGameOver) {
            const amount = userData.isWon ? (userData.bet * userData.multiplier) : userData.bet;
            this.drawGameOverOverlay(ctx, width, height, userData.isWon, amount);
        }

        return canvas.toBuffer('image/png');
    }

    /**
     * Helper to draw rounded rectangles.
     */
    static drawRoundedRect(ctx, x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
    }
}

module.exports = CanvasRenderer;
