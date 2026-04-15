// Default Data (Used only if no local storage exists)
const defaultData = {
    bot_side: {
        description: "Weak-side Top. Jungler paths towards Bot for early Drakes. Mid takes pushing champ.",
        roles: {
            Top: { picks: ["Ornn", "Sion", "Shen"], bans: ["Fiora", "Darius"] },
            Jungle: { picks: ["Jarvan IV", "Vi", "Sejuani"], bans: ["Lee Sin", "Kha'Zix"] },
            Mid: { picks: ["Taliyah", "Galio", "Lissandra"], bans: ["Sylas", "Zed"] },
            ADC: { picks: ["Jinx", "Aphelios", "Xayah"], bans: ["Caitlyn"] },
            Support: { picks: ["Lulu", "Nautilus", "Rell"], bans: ["Blitzcrank"] }
        }
    }
    // ... (Keep the rest of your defaultData here) ...
};

// 1. Initialize State
let isEditMode = false;
let teamData = JSON.parse(localStorage.getItem('lol_draft_data'));
if (!teamData) {
    teamData = defaultData;
    saveData();
}

// --- NEW: Dynamic API Variables ---
let currentPatch = "14.8.1"; // A safe fallback just in case the internet goes down
let allChampions = [];

// --- NEW: Fetch Live Data from Riot ---
// *** IMPORTANT FIX FOR initializeApp() ***
// Update your initializeApp function so it calls the new dropdown builder!
async function initializeApp() {
    try {
        const versionResponse = await fetch("https://ddragon.leagueoflegends.com/api/versions.json");
        const versions = await versionResponse.json();
        currentPatch = versions[0]; 

        const champResponse = await fetch(`https://ddragon.leagueoflegends.com/cdn/${currentPatch}/data/en_US/champion.json`);
        const champData = await champResponse.json();

        allChampions = Object.values(champData.data).map(champ => champ.name);

        populateDatalist();
        
        // ADD THIS LINE HERE:
        populateStrategyDropdown(); 
        
        loadStrategy();

    } catch (error) {
        console.error("Failed to connect to Riot Games API. Using offline fallbacks.", error);
        populateStrategyDropdown(); // Still need to populate it if offline!
        loadStrategy(); 
    }
}

// Function to populate the autocomplete list
function populateDatalist() {
    const dataList = document.getElementById('champion-names');
    dataList.innerHTML = ""; // Clear it out first
    allChampions.forEach(champ => {
        const option = document.createElement('option');
        option.value = champ;
        dataList.appendChild(option);
    });
}

// 2. Data Dragon URL Generator
function getChampImageURL(champName) {
    if (champName === "Wukong") return `https://ddragon.leagueoflegends.com/cdn/${currentPatch}/img/champion/MonkeyKing.png`;
    if (champName === "Jarvan IV") return `https://ddragon.leagueoflegends.com/cdn/${currentPatch}/img/champion/JarvanIV.png`;
    if (champName === "Kha'Zix") return `https://ddragon.leagueoflegends.com/cdn/${currentPatch}/img/champion/Khazix.png`;
    if (champName === "Cho'Gath") return `https://ddragon.leagueoflegends.com/cdn/${currentPatch}/img/champion/Chogath.png`;
    if (champName === "Kai'Sa") return `https://ddragon.leagueoflegends.com/cdn/${currentPatch}/img/champion/Kaisa.png`;
    if (champName === "Nunu & Willump" || champName === "Nunu") return `https://ddragon.leagueoflegends.com/cdn/${currentPatch}/img/champion/Nunu.png`;
    if (champName === "Renata Glasc" || champName === "Renata") return `https://ddragon.leagueoflegends.com/cdn/${currentPatch}/img/champion/Renata.png`;

    let safeName = champName.replace(/[' \.]/g, '');
    
    // Notice how this now uses ${currentPatch} instead of a hardcoded version!
    return `https://ddragon.leagueoflegends.com/cdn/${currentPatch}/img/champion/${safeName}.png`;
}

// 3. Render the UI
function loadStrategy() {
    const selectedKey = document.getElementById('strategy-dropdown').value;
    const strategy = teamData[selectedKey];
    document.getElementById('strategy-desc').innerText = strategy.description;

    const board = document.getElementById('draft-board');
    board.innerHTML = ""; 
    
    // Toggle a CSS class on the board based on edit mode
    if(isEditMode) board.classList.add('edit-mode');
    else board.classList.remove('edit-mode');

    for (const [roleName, roleData] of Object.entries(strategy.roles)) {
        
        // Render Picks
        let picksHTML = roleData.picks.map(champ => `
            <li>
                <img class="champ-img" src="${getChampImageURL(champ)}" alt="${champ}" onerror="this.src='https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/profile-icons/0.jpg'"> 
                ${champ}
                <button class="delete-btn" onclick="removeChamp('${selectedKey}', '${roleName}', 'picks', '${champ}')">❌</button>
            </li>
        `).join('');

        // Render Bans
        let bansHTML = roleData.bans.map(champ => `
            <li>
                <img class="champ-img" src="${getChampImageURL(champ)}" alt="${champ}" onerror="this.src='https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/profile-icons/0.jpg'"> 
                <s>${champ}</s>
                <button class="delete-btn" onclick="removeChamp('${selectedKey}', '${roleName}', 'bans', '${champ}')">❌</button>
            </li>
        `).join('');

        // Create the card
        const cardHTML = `
            <div class="role-card">
                <h2>${roleName}</h2>
                
                <div class="section-title">Preferred Picks</div>
                <ul class="champ-list picks">
                    ${picksHTML}
                </ul>
                <div class="add-champ-form" style="display: ${isEditMode ? 'flex' : 'none'}">
                    <input type="text" list="champion-names" id="add-pick-${roleName}" placeholder="Add Pick...">
                    <button onclick="addChamp('${selectedKey}', '${roleName}', 'picks', 'add-pick-${roleName}')">+</button>
                </div>

                <div class="section-title">Suggested Bans</div>
                <ul class="champ-list bans">
                    ${bansHTML}
                </ul>
                <div class="add-champ-form" style="display: ${isEditMode ? 'flex' : 'none'}">
                    <input type="text" list="champion-names" id="add-ban-${roleName}" placeholder="Add Ban...">
                    <button onclick="addChamp('${selectedKey}', '${roleName}', 'bans', 'add-ban-${roleName}')">+</button>
                </div>
            </div>
        `;
        
        board.innerHTML += cardHTML;
    }
}

// 4. Edit Mode Functions
function toggleEditMode() {
    isEditMode = !isEditMode;
    const btn = document.getElementById('edit-btn');
    
    if (isEditMode) {
        btn.innerText = "💾 Finish Editing";
        btn.classList.add('active');
    } else {
        btn.innerText = "✏️ Edit Draft";
        btn.classList.remove('active');
    }
    
    loadStrategy(); // Re-render to show/hide inputs
}

function addChamp(strategyKey, role, listType, inputId) {
    const inputEle = document.getElementById(inputId);
    const newChamp = inputEle.value.trim();
    
    if (!newChamp) return; // Don't add blank names

    // Add to our data array
    teamData[strategyKey].roles[role][listType].push(newChamp);
    
    saveData();
    loadStrategy(); // Refresh the UI
}

function removeChamp(strategyKey, role, listType, champName) {
    // Filter out the champion from the array
    teamData[strategyKey].roles[role][listType] = teamData[strategyKey].roles[role][listType].filter(champ => champ !== champName);
    
    saveData();
    loadStrategy(); // Refresh the UI
}

// Helper to save to local storage
function saveData() {
    localStorage.setItem('lol_draft_data', JSON.stringify(teamData));
}

// Function to populate the autocomplete list
function populateDatalist() {
    const dataList = document.getElementById('champion-names');
    allChampions.forEach(champ => {
        const option = document.createElement('option');
        option.value = champ;
        dataList.appendChild(option);
    });
}

// --- NEW: Populate Dropdown Dynamically ---
function populateStrategyDropdown() {
    const dropdown = document.getElementById('strategy-dropdown');
    dropdown.innerHTML = ""; // Clear existing options

    // Loop through our teamData and create an <option> for each strategy
    for (const [key, strategy] of Object.entries(teamData)) {
        const option = document.createElement('option');
        option.value = key;
        option.innerText = strategy.name || formatKeyToName(key); // Use nice name
        dropdown.appendChild(option);
    }
}

// Helper function: Turns "bot_side" into "Bot Side"
function formatKeyToName(key) {
    return key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

// --- NEW: Create a Strategy ---
function createNewStrategy() {
    const stratName = prompt("Enter a name for your new strategy:\n(e.g., 'Protect the KogMaw')");
    
    if (!stratName) return; // User cancelled

    // Create a safe key for the object (e.g., "Protect the KogMaw" -> "protect_the_kogmaw")
    const stratKey = stratName.toLowerCase().replace(/[^a-z0-9]/g, '_');

    // Prevent overwriting existing strategies
    if (teamData[stratKey]) {
        alert("A strategy with a similar name already exists!");
        return;
    }

    // Build the empty template
    teamData[stratKey] = {
        name: stratName,
        description: "Click here to add a description...",
        roles: {
            Top: { picks: [], bans: [] },
            Jungle: { picks: [], bans: [] },
            Mid: { picks: [], bans: [] },
            ADC: { picks: [], bans: [] },
            Support: { picks: [], bans: [] }
        }
    };

    saveData();
    populateStrategyDropdown(); // Update the dropdown
    
    // Automatically select the new strategy
    document.getElementById('strategy-dropdown').value = stratKey;
    loadStrategy();
}

// --- NEW: Delete a Strategy ---
function deleteCurrentStrategy() {
    const dropdown = document.getElementById('strategy-dropdown');
    const selectedKey = dropdown.value;

    // Safety check: Don't let them delete the last remaining strategy
    if (Object.keys(teamData).length <= 1) {
        alert("You must have at least one strategy!");
        return;
    }

    const confirmDelete = confirm("Are you sure you want to delete this strategy? This cannot be undone.");
    
    if (confirmDelete) {
        delete teamData[selectedKey]; // Remove from object
        saveData();
        populateStrategyDropdown(); // Refresh dropdown
        loadStrategy(); // Load whatever strategy is now first in the list
    }
}

// --- NEW: Edit Description ---
function editDescription() {
    const selectedKey = document.getElementById('strategy-dropdown').value;
    const currentDesc = teamData[selectedKey].description;
    
    const newDesc = prompt("Edit Strategy Description:", currentDesc);
    
    if (newDesc !== null) { // If they didn't hit cancel
        teamData[selectedKey].description = newDesc;
        saveData();
        document.getElementById('strategy-desc').innerText = newDesc;
    }
}

// Call this once when the page loads
populateDatalist();

// Start the app
initializeApp();