// --- 1. FIREBASE SETUP & IMPORTS ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDj4toMM6toCvhMuemCQtvx9-0GHiixfOk",
  authDomain: "lol-drafter.firebaseapp.com",
  databaseURL: "https://lol-drafter-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "lol-drafter",
  storageBucket: "lol-drafter.firebasestorage.app",
  messagingSenderId: "127944613167",
  appId: "1:127944613167:web:1e46dd04b6ca81e55555da",
  measurementId: "G-LZNKWDTH8G"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const databaseRef = ref(db, 'drafts'); // This is the 'folder' in your database

// --- 2. GLOBAL STATE ---
let isEditMode = false;
let teamData = {};
let currentPatch = "14.8.1";
let allChampions = [];

const defaultData = {
    bot_side: {
        name: "Play for Drakes / Bot Side",
        description: "Weak-side Top. Jungler paths towards Bot for early Drakes. Mid takes pushing champ.",
        roles: {
            Top: { picks: ["Ornn", "Sion", "Shen"], bans: ["Fiora", "Darius"] },
            Jungle: { picks: ["Jarvan IV", "Vi", "Sejuani"], bans: ["Lee Sin", "Kha'Zix"] },
            Mid: { picks: ["Taliyah", "Galio", "Lissandra"], bans: ["Sylas", "Zed"] },
            ADC: { picks: ["Jinx", "Aphelios", "Xayah"], bans: ["Caitlyn"] },
            Support: { picks: ["Lulu", "Nautilus", "Rell"], bans: ["Blitzcrank"] }
        }
    }
};

// --- 3. FIREBASE REALTIME LISTENER (THE BRAIN) ---
// This function fires automatically the millisecond ANYONE on your team changes a strategy!
onValue(databaseRef, (snapshot) => {
    const data = snapshot.val();
    
    if (data) {
        teamData = data; // Update our local state
        populateStrategyDropdown(); // Update the dropdown
        loadStrategy(); // Re-render the board!
    } else {
        // If the database is completely empty, push the default data to it
        set(databaseRef, defaultData);
    }
});

// Helper function to push changes to Firebase
function saveData() {
    set(databaseRef, teamData);
}

// --- 4. RIOT API INITIALIZATION ---
async function initRiotAPI() {
    try {
        const versionResponse = await fetch("https://ddragon.leagueoflegends.com/api/versions.json");
        const versions = await versionResponse.json();
        currentPatch = versions[0]; 

        const champResponse = await fetch(`https://ddragon.leagueoflegends.com/cdn/${currentPatch}/data/en_US/champion.json`);
        const champData = await champResponse.json();
        allChampions = Object.values(champData.data).map(champ => champ.name);

        populateDatalist();
    } catch (error) {
        console.error("Riot API Error:", error);
    }
}
initRiotAPI(); // Run this immediately

// --- 5. UI & LOGIC FUNCTIONS ---
function populateDatalist() {
    const dataList = document.getElementById('champion-names');
    dataList.innerHTML = ""; 
    allChampions.forEach(champ => {
        const option = document.createElement('option');
        option.value = champ;
        dataList.appendChild(option);
    });
}

function getChampImageURL(champName) {
    if (champName === "Wukong") return `https://ddragon.leagueoflegends.com/cdn/${currentPatch}/img/champion/MonkeyKing.png`;
    if (champName === "Jarvan IV") return `https://ddragon.leagueoflegends.com/cdn/${currentPatch}/img/champion/JarvanIV.png`;
    if (champName === "Kha'Zix") return `https://ddragon.leagueoflegends.com/cdn/${currentPatch}/img/champion/Khazix.png`;
    if (champName === "Cho'Gath") return `https://ddragon.leagueoflegends.com/cdn/${currentPatch}/img/champion/Chogath.png`;
    if (champName === "Kai'Sa") return `https://ddragon.leagueoflegends.com/cdn/${currentPatch}/img/champion/Kaisa.png`;
    if (champName === "Nunu & Willump" || champName === "Nunu") return `https://ddragon.leagueoflegends.com/cdn/${currentPatch}/img/champion/Nunu.png`;
    if (champName === "Renata Glasc" || champName === "Renata") return `https://ddragon.leagueoflegends.com/cdn/${currentPatch}/img/champion/Renata.png`;

    let safeName = champName.replace(/[' \.]/g, '');
    return `https://ddragon.leagueoflegends.com/cdn/${currentPatch}/img/champion/${safeName}.png`;
}

function populateStrategyDropdown() {
    const dropdown = document.getElementById('strategy-dropdown');
    const currentSelection = dropdown.value; // Remember what was selected before Firebase updated
    dropdown.innerHTML = ""; 

    for (const [key, strategy] of Object.entries(teamData)) {
        const option = document.createElement('option');
        option.value = key;
        option.innerText = strategy.name || formatKeyToName(key); 
        dropdown.appendChild(option);
    }
    
    // Re-select the strategy they were looking at if it still exists
    if (teamData[currentSelection]) {
        dropdown.value = currentSelection;
    }
}

function formatKeyToName(key) {
    return key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function loadStrategy() {
    const dropdown = document.getElementById('strategy-dropdown');
    const selectedKey = dropdown.value;
    
    if (!selectedKey || !teamData[selectedKey]) return; 

    const strategy = teamData[selectedKey];
    document.getElementById('strategy-desc').innerText = strategy.description || "Click here to add a description...";

    // --- UPGRADED: Calculate Flex AND Contested Picks ---
    let allPicks = [];
    let allBans = [];
    const standardRoles = ["Top", "Jungle", "Mid", "ADC", "Support"];
    
    standardRoles.forEach(role => {
        if (strategy.roles && strategy.roles[role]) {
            // Gather all picks
            if (strategy.roles[role].picks) {
                const namesOnly = strategy.roles[role].picks.map(c => typeof c === 'string' ? c : c.name);
                allPicks = allPicks.concat(namesOnly);
            }
            // Gather all bans
            if (strategy.roles[role].bans) {
                allBans = allBans.concat(strategy.roles[role].bans);
            }
        }
    });

    // 1. Flex Champs (In Picks array more than once)
    const flexChamps = allPicks.filter((item, index) => allPicks.indexOf(item) !== index);
    const uniqueFlexChamps = [...new Set(flexChamps)];

    // 2. Contested Champs (Appears in BOTH Picks and Bans)
    const contestedChamps = allPicks.filter(champ => allBans.includes(champ));
    const uniqueContestedChamps = [...new Set(contestedChamps)];

    // Render Flex Options
    const flexContainer = document.getElementById('flex-picks-list');
    flexContainer.innerHTML = uniqueFlexChamps.map(champ => 
        `<img class="champ-img" src="${getChampImageURL(champ)}" alt="${champ}" title="${champ} is a Flex!" style="border-color: #0ac8b9;">`
    ).join('') || "<span style='color: #666; font-size: 12px;'>No flex picks.</span>";

    // Render Contested Options (With an orange warning border!)
    const contestedContainer = document.getElementById('contested-picks-list');
    contestedContainer.innerHTML = uniqueContestedChamps.map(champ => 
        `<img class="champ-img" src="${getChampImageURL(champ)}" alt="${champ}" title="R1 Pick or Ban!" style="border-color: #ffb443; box-shadow: 0 0 10px rgba(255, 180, 67, 0.4);">`
    ).join('') || "<span style='color: #666; font-size: 12px;'>No priority conflicts.</span>";

    // Render Locked Team
    const lockedContainer = document.getElementById('locked-team');
    lockedContainer.innerHTML = "";
    if (!strategy.lockedTeam) strategy.lockedTeam = {};

    standardRoles.forEach(role => {
        const lockedChamp = strategy.lockedTeam[role];
        if (lockedChamp) {
            lockedContainer.innerHTML += `
                <div class="locked-slot">
                    <img src="${getChampImageURL(lockedChamp)}" alt="${lockedChamp}">
                    ${lockedChamp}
                </div>`;
        } else {
            lockedContainer.innerHTML += `
                <div class="locked-slot">
                    <div class="empty-slot"></div>
                    ${role}
                </div>`;
        }
    });

    // Render The Main Board
    const board = document.getElementById('draft-board');
    board.innerHTML = ""; 
    
    if (isEditMode) board.classList.add('edit-mode');
    else board.classList.remove('edit-mode');

    standardRoles.forEach(roleName => {
        const roleData = (strategy.roles && strategy.roles[roleName]) ? strategy.roles[roleName] : {};
        
        let picksArray = roleData.picks ? [...roleData.picks] : [];
        let bansArray = roleData.bans || [];

        // --- UPGRADE: Added C and D to the sorting logic ---
        const tierOrder = { "S": 1, "A": 2, "B": 3, "C": 4, "D": 5, "": 6 };
        picksArray.sort((a, b) => {
            const tierA = typeof a === 'string' ? "" : a.tier;
            const tierB = typeof b === 'string' ? "" : b.tier;
            return tierOrder[tierA] - tierOrder[tierB];
        });

        // Generate HTML for Picks
        let picksHTML = picksArray.map(champObj => {
            let champName = typeof champObj === 'string' ? champObj : champObj.name;
            let tier = typeof champObj === 'string' ? '' : champObj.tier;
            
            let tierHTML = '';

            // --- UPGRADE: Added C and D to the edit dropdown ---
            if (isEditMode) {
                let activeTier = tier || 'A';
                tierHTML = `
                <select class="tier-edit-select tier-${activeTier}" onchange="updateTier('${selectedKey}', '${roleName}', '${champName}', this.value)">
                    <option value="S" ${activeTier === 'S' ? 'selected' : ''}>S</option>
                    <option value="A" ${activeTier === 'A' ? 'selected' : ''}>A</option>
                    <option value="B" ${activeTier === 'B' ? 'selected' : ''}>B</option>
                    <option value="C" ${activeTier === 'C' ? 'selected' : ''}>C</option>
                    <option value="D" ${activeTier === 'D' ? 'selected' : ''}>D</option>
                </select>`;
            } else if (tier) {
                tierHTML = `<span class="tier-tag tier-${tier}">${tier}</span>`;
            }

            return `
            <li>
                <img class="champ-img" src="${getChampImageURL(champName)}" alt="${champName}" onerror="this.src='https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/profile-icons/0.jpg'"> 
                ${tierHTML} ${champName}
                <div class="champ-actions">
                    <button class="btn-lock" title="Lock In" onclick="lockChamp('${selectedKey}', '${roleName}', '${champName}')">🔒</button>
                    <button class="delete-btn" onclick="removeChamp('${selectedKey}', '${roleName}', 'picks', '${champName}')">❌</button>
                </div>
            </li>`;
        }).join('');

        let bansHTML = bansArray.map(champ => `
            <li>
                <img class="champ-img" src="${getChampImageURL(champ)}" alt="${champ}" onerror="this.src='https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/profile-icons/0.jpg'"> 
                <s>${champ}</s>
                <div class="champ-actions">
                    <button class="delete-btn" onclick="removeChamp('${selectedKey}', '${roleName}', 'bans', '${champ}')">❌</button>
                </div>
            </li>`).join('');

        // --- UPGRADE: Added C and D to the "Add Champ" dropdown ---
        const cardHTML = `
            <div class="role-card">
                <h2>${roleName}</h2>
                <div class="section-title">Preferred Picks</div>
                <ul class="champ-list picks">${picksHTML}</ul>
                
                <div class="add-champ-form" style="display: ${isEditMode ? 'flex' : 'none'}">
                    <select id="add-tier-${roleName}" class="tier-select">
                        <option value="S">S</option>
                        <option value="A" selected>A</option>
                        <option value="B">B</option>
                        <option value="C">C</option>
                        <option value="D">D</option>
                    </select>
                    <input type="text" list="champion-names" id="add-pick-${roleName}" placeholder="Add Pick...">
                    <button onclick="addChamp('${selectedKey}', '${roleName}', 'picks', 'add-pick-${roleName}', 'add-tier-${roleName}')">+</button>
                </div>

                <div class="section-title">Suggested Bans</div>
                <ul class="champ-list bans">${bansHTML}</ul>
                <div class="add-champ-form" style="display: ${isEditMode ? 'flex' : 'none'}">
                    <input type="text" list="champion-names" id="add-ban-${roleName}" placeholder="Add Ban...">
                    <button onclick="addChamp('${selectedKey}', '${roleName}', 'bans', 'add-ban-${roleName}')">+</button>
                </div>
            </div>
        `;
        board.innerHTML += cardHTML;
    });
}

// --- 6. ATTACH FUNCTIONS TO WINDOW (Needed for ES Modules) ---
window.loadStrategy = loadStrategy;

// --- NEW: Lock Champion Function ---
window.lockChamp = function(strategyKey, role, champName) {
    if (!teamData[strategyKey].lockedTeam) {
        teamData[strategyKey].lockedTeam = {};
    }

    // If they click the lock again, it unlocks them
    if (teamData[strategyKey].lockedTeam[role] === champName) {
        teamData[strategyKey].lockedTeam[role] = null;
    } else {
        teamData[strategyKey].lockedTeam[role] = champName;
    }
    
    saveData(); // Push to Firebase immediately
};

// --- NEW: Update Existing Tier ---
window.updateTier = function(strategyKey, role, champName, newTier) {
    let picks = teamData[strategyKey].roles[role].picks;
    
    // Find the champion in the array
    for (let i = 0; i < picks.length; i++) {
        let currentName = typeof picks[i] === 'string' ? picks[i] : picks[i].name;
        
        if (currentName === champName) {
            // Upgrade them to the new tier object (this also fixes old string data automatically!)
            picks[i] = { name: champName, tier: newTier };
            break;
        }
    }
    
    saveData(); // Push to Firebase immediately
};

window.toggleEditMode = function() {
    isEditMode = !isEditMode;
    const btn = document.getElementById('edit-btn');
    if (isEditMode) {
        btn.innerText = "💾 Finish Editing";
        btn.classList.add('active');
    } else {
        btn.innerText = "✏️ Edit Draft";
        btn.classList.remove('active');
    }
    loadStrategy(); 
};

// Notice we added an optional tierId parameter to the end
window.addChamp = function(strategyKey, role, listType, inputId, tierId = null) {
    const inputEle = document.getElementById(inputId);
    const newChamp = inputEle.value.trim();
    if (!newChamp) return; 

    // Grab the tier if they are adding a Pick (Bans don't use tiers)
    let tierValue = "A";
    if (tierId) {
        const tierEle = document.getElementById(tierId);
        if (tierEle) tierValue = tierEle.value;
    }

    if (!teamData[strategyKey].roles) teamData[strategyKey].roles = {};
    if (!teamData[strategyKey].roles[role]) teamData[strategyKey].roles[role] = {};
    if (!teamData[strategyKey].roles[role][listType]) teamData[strategyKey].roles[role][listType] = [];
    
    // Prevent duplicates (checking both old strings and new tier objects)
    const exists = teamData[strategyKey].roles[role][listType].some(c => {
        const cName = typeof c === 'string' ? c : c.name;
        return cName === newChamp;
    });

    if (!exists) {
        if (listType === 'picks') {
            // Save as an object with a Tier!
            teamData[strategyKey].roles[role][listType].push({ name: newChamp, tier: tierValue });
        } else {
            // Bans are still just saved as strings
            teamData[strategyKey].roles[role][listType].push(newChamp);
        }
        saveData();
    }
    inputEle.value = ""; 
};

window.removeChamp = function(strategyKey, role, listType, champNameToRemove) {
    // Filter safely regardless of whether it's an old string or new Tier object
    teamData[strategyKey].roles[role][listType] = teamData[strategyKey].roles[role][listType].filter(c => {
        const cName = typeof c === 'string' ? c : c.name;
        return cName !== champNameToRemove;
    });
    saveData();
};

window.createNewStrategy = function() {
    const stratName = prompt("Enter a name for your new strategy:");
    if (!stratName) return; 

    const stratKey = stratName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    if (teamData[stratKey]) {
        alert("A strategy with a similar name already exists!");
        return;
    }

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
    
    // --- THE FIX IS HERE ---
    // Automatically turn on Edit Mode so they see the input boxes!
    if (!isEditMode) {
        window.toggleEditMode();
    }
    
    // Swap dropdown to the new strategy once Firebase updates
    setTimeout(() => { 
        document.getElementById('strategy-dropdown').value = stratKey; 
        loadStrategy(); 
    }, 300);
};

window.deleteCurrentStrategy = function() {
    const selectedKey = document.getElementById('strategy-dropdown').value;
    if (Object.keys(teamData).length <= 1) {
        alert("You must have at least one strategy!");
        return;
    }
    if (confirm("Are you sure you want to delete this strategy? This cannot be undone.")) {
        delete teamData[selectedKey]; 
        saveData();
    }
};

// --- NEW: Patch Notes GitHub API Fetch ---
window.openPatchNotes = async function() {
    // Show the modal
    document.getElementById('patch-notes-modal').style.display = 'flex';
    const listContainer = document.getElementById('patch-notes-list');
    listContainer.innerHTML = "<p style='text-align:center;'>Fetching latest updates from central server...</p>";

    // --- CHANGE THESE TO YOUR GITHUB DETAILS ---
    const githubUser = "Pjaskis"; // e.g. "Pjaskis"
    const githubRepo = "lol-draft-tool";       // e.g. "lol-draft-tool"
    // -------------------------------------------

    try {
        const response = await fetch(`https://api.github.com/repos/${githubUser}/${githubRepo}/commits`);
        
        if (!response.ok) {
            throw new Error("Could not connect to GitHub (Is the repo Private?)");
        }

        const commits = await response.json();
        
        // UPGRADE 1: Changed slice(0, 5) to slice(0, 20) to show more history!
        listContainer.innerHTML = commits.slice(0, 20).map(commit => {
            const dateStr = new Date(commit.commit.author.date).toLocaleDateString(undefined, { 
                month: 'short', day: 'numeric', year: 'numeric' 
            });
            
            // UPGRADE 2: Replace invisible line breaks (\n) with actual HTML line breaks (<br>)
            // This allows you to type multi-line descriptions in GitHub and have them format beautifully here.
            const formattedMessage = commit.commit.message.replace(/\n/g, '<br>');
            
            return `
                <div class="commit-item">
                    <div class="commit-date">📅 ${dateStr}</div>
                    <div class="commit-msg">${formattedMessage}</div>
                </div>
            `;
        }).join('');

    } catch (error) {
        listContainer.innerHTML = `
            <p style="color: #e22c2c; text-align: center;">
                <b>Error reading Patch Notes.</b><br>
                Make sure your GitHub repository is set to "Public" in the repository settings!
            </p>`;
    }
};

window.closePatchNotes = function() {
    document.getElementById('patch-notes-modal').style.display = 'none';
};

// Optional QoL: Close modal if they click the dark background outside the box
window.onclick = function(event) {
    const modal = document.getElementById('patch-notes-modal');
    if (event.target === modal) {
        window.closePatchNotes();
    }
};

window.editDescription = function() {
    const selectedKey = document.getElementById('strategy-dropdown').value;
    const currentDesc = teamData[selectedKey].description;
    const newDesc = prompt("Edit Strategy Description:", currentDesc);
    
    if (newDesc !== null) { 
        teamData[selectedKey].description = newDesc;
        saveData();
    }
};