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
    
    // Safety check in case database hasn't loaded yet
    if (!selectedKey || !teamData[selectedKey]) return; 

    const strategy = teamData[selectedKey];
    document.getElementById('strategy-desc').innerText = strategy.description;

    const board = document.getElementById('draft-board');
    board.innerHTML = ""; 
    
    if(isEditMode) board.classList.add('edit-mode');
    else board.classList.remove('edit-mode');

    for (const [roleName, roleData] of Object.entries(strategy.roles)) {
        
        // Render Picks (Check if array exists, if not use empty array)
        let picksArray = roleData.picks || [];
        let picksHTML = picksArray.map(champ => `
            <li>
                <img class="champ-img" src="${getChampImageURL(champ)}" alt="${champ}" onerror="this.src='https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/profile-icons/0.jpg'"> 
                ${champ}
                <button class="delete-btn" onclick="removeChamp('${selectedKey}', '${roleName}', 'picks', '${champ}')">❌</button>
            </li>
        `).join('');

        // Render Bans
        let bansArray = roleData.bans || [];
        let bansHTML = bansArray.map(champ => `
            <li>
                <img class="champ-img" src="${getChampImageURL(champ)}" alt="${champ}" onerror="this.src='https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/profile-icons/0.jpg'"> 
                <s>${champ}</s>
                <button class="delete-btn" onclick="removeChamp('${selectedKey}', '${roleName}', 'bans', '${champ}')">❌</button>
            </li>
        `).join('');

        const cardHTML = `
            <div class="role-card">
                <h2>${roleName}</h2>
                <div class="section-title">Preferred Picks</div>
                <ul class="champ-list picks">${picksHTML}</ul>
                <div class="add-champ-form" style="display: ${isEditMode ? 'flex' : 'none'}">
                    <input type="text" list="champion-names" id="add-pick-${roleName}" placeholder="Add Pick...">
                    <button onclick="addChamp('${selectedKey}', '${roleName}', 'picks', 'add-pick-${roleName}')">+</button>
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
    }
}

// --- 6. ATTACH FUNCTIONS TO WINDOW (Needed for ES Modules) ---
window.loadStrategy = loadStrategy;

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

window.addChamp = function(strategyKey, role, listType, inputId) {
    const inputEle = document.getElementById(inputId);
    const newChamp = inputEle.value.trim();
    if (!newChamp) return; 

    // Initialize array if it somehow doesn't exist
    if (!teamData[strategyKey].roles[role][listType]) {
        teamData[strategyKey].roles[role][listType] = [];
    }
    
    // Prevent duplicates
    if (!teamData[strategyKey].roles[role][listType].includes(newChamp)) {
        teamData[strategyKey].roles[role][listType].push(newChamp);
        saveData(); // Sends to Firebase! The UI will update automatically.
    }
    inputEle.value = ""; // Clear the box
};

window.removeChamp = function(strategyKey, role, listType, champName) {
    teamData[strategyKey].roles[role][listType] = teamData[strategyKey].roles[role][listType].filter(champ => champ !== champName);
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
    
    // Swap dropdown to the new strategy once Firebase updates
    setTimeout(() => { document.getElementById('strategy-dropdown').value = stratKey; loadStrategy(); }, 300);
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

window.editDescription = function() {
    const selectedKey = document.getElementById('strategy-dropdown').value;
    const currentDesc = teamData[selectedKey].description;
    const newDesc = prompt("Edit Strategy Description:", currentDesc);
    
    if (newDesc !== null) { 
        teamData[selectedKey].description = newDesc;
        saveData();
    }
};