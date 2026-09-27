// My Museum Collection Drawer & Progress Tracker
export function initMuseumDrawer(onSelectArtifact, onSelectDay) {
  if (!document.querySelector('#museumDrawer')) {
    const div = document.createElement('div');
    div.id = 'museumDrawer';
    div.className = 'museum-drawer';
    div.innerHTML = `
      <div class="drawer-header">
        <div class="drawer-title">
          <h2>🏛 My Kona Museum</h2>
          <span>Personal Collection of History & Machines</span>
        </div>
        <button type="button" class="drawer-close" id="drawerCloseBtn" aria-label="Close">✕</button>
      </div>

      <div class="drawer-stats">
        <div class="stat-pill"><b id="statDays">0 / 6</b><span>Days</span></div>
        <div class="stat-pill"><b id="statMemories">0 / 6</b><span>Memories</span></div>
        <div class="stat-pill"><b id="statBikes">0 / 4</b><span>Bikes</span></div>
      </div>

      <div class="drawer-section">
        <h3>Race Week Chapters</h3>
        <div class="days-list" id="drawerDaysList"></div>
      </div>

      <div class="drawer-section">
        <h3>Unlocked Artifacts & Machines</h3>
        <div class="artifacts-list" id="drawerArtifactsList"></div>
      </div>
    `;
    document.body.appendChild(div);
  }

  const drawer = document.querySelector('#museumDrawer');
  const closeBtn = document.querySelector('#drawerCloseBtn');
  closeBtn.onclick = () => drawer.classList.remove('active');

  return {
    open(saveData, quests) {
      drawer.classList.add('active');
      this.render(saveData, quests);
    },

    close() {
      drawer.classList.remove('active');
    },

    render(saveData, quests) {
      const { completedDays = [], discoveredMemories = [], unlockedArtifacts = [] } = saveData;

      document.querySelector('#statDays').textContent = `${completedDays.length} / ${quests.length}`;
      document.querySelector('#statMemories').textContent = `${discoveredMemories.length} / 6`;
      const bikeCount = unlockedArtifacts.filter(a => a.type === 'bike').length;
      document.querySelector('#statBikes').textContent = `${bikeCount} / 4`;

      // Render days list
      const daysContainer = document.querySelector('#drawerDaysList');
      daysContainer.innerHTML = quests.map((q, idx) => {
        const isDone = completedDays.includes(q.id);
        const isCurrent = saveData.currentDayIndex === idx;
        return `
          <div class="day-item ${isDone ? 'done' : ''} ${isCurrent ? 'current' : ''}" data-day="${idx}">
            <div class="day-num">Day ${q.dayNumber}</div>
            <div class="day-info">
              <b>${q.title}</b>
              <small>${q.subtitle}</small>
            </div>
            <button type="button" class="btn-goto-day" data-idx="${idx}">${isCurrent ? 'Playing' : (isDone ? 'Replay' : 'Jump')}</button>
          </div>
        `;
      }).join('');

      daysContainer.querySelectorAll('.btn-goto-day').forEach(btn => {
        btn.onclick = () => {
          const idx = parseInt(btn.dataset.idx, 10);
          if (onSelectDay) onSelectDay(idx);
          drawer.classList.remove('active');
        };
      });

      // Render artifacts
      const artContainer = document.querySelector('#drawerArtifactsList');
      if (unlockedArtifacts.length === 0) {
        artContainer.innerHTML = '<div class="drawer-empty">No historical artifacts collected yet. Explore Kona to discover memory echoes!</div>';
      } else {
        artContainer.innerHTML = unlockedArtifacts.map((art, i) => `
          <div class="artifact-card-mini" data-i="${i}">
            <div class="art-icon">${art.type === 'bike' ? '🚲' : (art.type === 'trophy' ? '🏆' : '👟')}</div>
            <div class="art-details">
              <b>${art.name}</b>
              <small>${art.year} · ${art.athlete}</small>
            </div>
            <button type="button" class="btn-inspect" data-i="${i}">3D Inspect</button>
          </div>
        `).join('');

        artContainer.querySelectorAll('.btn-inspect').forEach(btn => {
          btn.onclick = () => {
            const i = parseInt(btn.dataset.i, 10);
            const art = unlockedArtifacts[i];
            if (onSelectArtifact) onSelectArtifact(art);
            drawer.classList.remove('active');
          };
        });
      }
    }
  };
}
