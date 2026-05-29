// config.js
module.exports = {
  BASES: [
    { name: "MAINGATE", capacity: 6 },
    { name: "CITADELLE", capacity: 9 },
    { name: "EASTBRIDGE", capacity: 3 },
    { name: "CENTRALBRIDGE", capacity: 3 },
    { name: "WESTBRIDGE", capacity: 3 },
    { name: "TOWER OF ELEMENTS", capacity: 3 },
    { name: "TOWER OF FORESIGHT", capacity: 3 },
    { name: "SCRIPTORIUM", capacity: 3 },
    { name: "LABOR", capacity: 3 },
    { name: "DOCKS", capacity: 2 },
    { name: "BOATHOUSE", capacity: 2 }
  ],
  TOTAL_CAPACITY: 40,
  
  // For slash command choices – prevents typos
  BASE_CHOICES: [
    { name: "MAINGATE (6 slots)", value: "MAINGATE" },
    { name: "CITADELLE (9 slots)", value: "CITADELLE" },
    { name: "EASTBRIDGE (3 slots)", value: "EASTBRIDGE" },
    { name: "CENTRALBRIDGE (3 slots)", value: "CENTRALBRIDGE" },
    { name: "WESTBRIDGE (3 slots)", value: "WESTBRIDGE" },
    { name: "TOWER OF ELEMENTS (3 slots)", value: "TOWER OF ELEMENTS" },
    { name: "TOWER OF FORESIGHT (3 slots)", value: "TOWER OF FORESIGHT" },
    { name: "SCRIPTORIUM (3 slots)", value: "SCRIPTORIUM" },
    { name: "LABOR (3 slots)", value: "LABOR" },
    { name: "DOCKS (2 slots)", value: "DOCKS" },
    { name: "BOATHOUSE (2 slots)", value: "BOATHOUSE" }
  ],
  
  DATE_FORMAT: 'dd MMM yyyy',
  DATE_STORAGE_FORMAT: 'yyyy-MM-dd',
  TIMEZONE: 'Asia/Kolkata'
};