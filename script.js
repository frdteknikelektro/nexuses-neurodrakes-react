// Basic UI script
const statusEl = document.getElementById('status');
const mapEl = document.getElementById('map');
const logEl = document.getElementById('log');
const rollBtn = document.getElementById('roll-d20');
const newGameBtn = document.getElementById('new-game');

function log(msg) {
  const entry = document.createElement('div');
  entry.textContent = `[Turn] ${new Date().toLocaleTimeString()}: ${msg}`;
  logEl.appendChild(entry);
  logEl.scrollTop = logEl.scrollHeight;
}

rollBtn.addEventListener('click', () => {
  const roll = rollDice(20);
  log(`You rolled a ${roll} on d20!`);
  statusEl.textContent = `Great roll: ${roll}!`;
});

newGameBtn.addEventListener('click', () => {
  mapEl.textContent = `
Welcome to the Nexus!
. . . 
. @ .  <- You are here (@)
. . . 
  `;
  log('New adventure started!');
  statusEl.textContent = 'Explore the nexus!';
});
