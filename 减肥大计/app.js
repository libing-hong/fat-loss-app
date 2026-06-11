const storageKey = "couple-fat-loss-app-v2";
const oldStorageKey = "couple-fat-loss-app-v1";
const todayISO = () => new Date().toISOString().slice(0, 10);

const foodBank = {
  protein: ["鸡胸肉", "鸡腿肉", "牛肉", "虾", "鱼", "鸡蛋", "豆腐", "瘦猪肉"],
  carb: ["米饭", "糙米", "燕麦", "红薯", "玉米", "土豆", "全麦面包", "荞麦面", "意面"],
  vegetable: ["西兰花", "菠菜", "番茄", "蘑菇", "胡萝卜", "白菜", "芦笋", "彩椒", "茄子", "冬瓜"],
  fat: ["牛油果", "橄榄油", "坚果", "花生酱", "芝麻酱"]
};

const fallbackFoods = {
  protein: ["鸡蛋", "豆腐", "鸡胸肉"],
  carb: ["燕麦", "红薯", "糙米"],
  vegetable: ["西兰花", "番茄", "蘑菇"],
  fat: ["橄榄油", "坚果"]
};

const mealNames = {
  breakfast: ["鸡蛋燕麦粥", "鸡蛋全麦盘", "豆腐蔬菜汤", "红薯鸡蛋碗"],
  lunch: ["高蛋白菜饭", "熟蔬炒菜拼盘", "烤肉蔬菜碗", "荞麦熟拌菜盒"],
  dinner: ["暖胃豆腐锅", "清爽鱼虾盘", "蔬菜蛋白汤", "少油家常套餐"]
};

const defaultState = {
  activePerson: "me",
  activeView: "dashboard",
  pairCode: "",
  lastSync: { me: "", partner: "" },
  fridge: ["鸡蛋", "鸡胸肉", "豆腐", "西兰花", "番茄", "红薯"],
  preferences: { satiety: "high", cookTime: "quick" },
  cheers: [],
  mealPlanVersion: 3,
  people: {
    me: {
      name: "小白",
      type: "small",
      device: "Samsung Watch",
      healthSource: "Samsung Health",
      height: 165,
      currentWeight: 56,
      goalWeight: 50,
      calorieTarget: 1450,
      entries: {}
    },
    partner: {
      name: "小鸡毛",
      type: "large",
      device: "Apple Watch",
      healthSource: "Apple Health",
      height: 178,
      currentWeight: 105,
      goalWeight: 85,
      calorieTarget: 2100,
      entries: {}
    }
  },
  mealPlan: []
};

let state = loadState();
let deferredInstallPrompt = null;

const els = {
  tabs: document.querySelectorAll(".person-tab"),
  nav: document.querySelectorAll(".nav-item"),
  views: document.querySelectorAll(".view"),
  screenTitle: document.querySelector("#screenTitle"),
  todayLabel: document.querySelector("#todayLabel"),
  levelValue: document.querySelector("#levelValue"),
  duoTitle: document.querySelector("#duoTitle"),
  duoHint: document.querySelector("#duoHint"),
  questProgress: document.querySelector("#questProgress"),
  questGrid: document.querySelector("#questGrid"),
  pathTrack: document.querySelector("#pathTrack"),
  badgeGrid: document.querySelector("#badgeGrid"),
  badgeCount: document.querySelector("#badgeCount"),
  weekAverage: document.querySelector("#weekAverage"),
  chart: document.querySelector("#weightChart"),
  dailyForm: document.querySelector("#dailyForm"),
  profileForm: document.querySelector("#profileForm"),
  entryDate: document.querySelector("#entryDate"),
  fridgeForm: document.querySelector("#fridgeForm"),
  fridgeInput: document.querySelector("#fridgeInput"),
  fridgeList: document.querySelector("#fridgeList"),
  menuGrid: document.querySelector("#menuGrid"),
  syncOutput: document.querySelector("#syncOutput"),
  syncInput: document.querySelector("#syncInput"),
  toast: document.querySelector("#toast")
};

function loadState() {
  const raw = localStorage.getItem(storageKey) || localStorage.getItem(oldStorageKey);
  if (!raw) return structuredClone(defaultState);
  try {
    return mergeDefaults(JSON.parse(raw));
  } catch {
    return structuredClone(defaultState);
  }
}

function mergeDefaults(saved) {
  const merged = {
    ...structuredClone(defaultState),
    ...saved,
    lastSync: { ...defaultState.lastSync, ...saved.lastSync },
    preferences: { ...defaultState.preferences, ...saved.preferences },
    people: {
      me: { ...defaultState.people.me, ...saved.people?.me, entries: saved.people?.me?.entries || {} },
      partner: { ...defaultState.people.partner, ...saved.people?.partner, entries: saved.people?.partner?.entries || {} }
    }
  };
  if (merged.people.me.name === "我") merged.people.me.name = "小白";
  if (merged.people.partner.name === "男朋友") merged.people.partner.name = "小鸡毛";
  if (merged.mealPlanVersion !== defaultState.mealPlanVersion) {
    merged.mealPlan = [];
    merged.mealPlanVersion = defaultState.mealPlanVersion;
  }
  return merged;
}

function saveState(message) {
  localStorage.setItem(storageKey, JSON.stringify(state));
  if (message) showToast(message);
  render();
}

function activePerson() {
  return state.people[state.activePerson];
}

function otherPersonKey() {
  return state.activePerson === "me" ? "partner" : "me";
}

function dateOffset(date, offset) {
  const next = new Date(`${date}T00:00:00`);
  next.setDate(next.getDate() + offset);
  return next.toISOString().slice(0, 10);
}

function entriesSorted(person = activePerson()) {
  return Object.values(person.entries)
    .filter((entry) => entry.weight || entry.exercise || entry.water || entry.calories || entry.sleep || entry.steps)
    .sort((a, b) => a.date.localeCompare(b.date));
}

function latestWeight(person = activePerson()) {
  const entries = entriesSorted(person).filter((entry) => Number(entry.weight));
  return entries.at(-1)?.weight ?? person.currentWeight;
}

function getEntry(personKey = state.activePerson, date = todayISO()) {
  return state.people[personKey].entries[date] || { date };
}

function targetFor(person, key) {
  const targets = {
    exercise: person.type === "large" ? 35 : 45,
    water: person.type === "large" ? 2800 : 2000,
    calories: person.calorieTarget,
    sleep: 7.5,
    steps: 8000
  };
  return targets[key];
}

function completionScore(personKey, date = todayISO()) {
  const person = state.people[personKey];
  const entry = getEntry(personKey, date);
  const checks = [
    Number(entry.weight) > 0,
    Number(entry.steps) >= targetFor(person, "steps"),
    Number(entry.exercise) >= targetFor(person, "exercise"),
    Number(entry.water) >= targetFor(person, "water"),
    Number(entry.calories) > 0 && Number(entry.calories) <= targetFor(person, "calories") + 150,
    Number(entry.sleep) >= 7
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function render() {
  renderShell();
  renderDashboard();
  renderForms();
  renderFridge();
  renderMenu();
  renderSync();
}

function renderShell() {
  els.todayLabel.textContent = new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "long"
  }).format(new Date());

  document.querySelector("#meWeightMini").textContent = `${formatNumber(latestWeight(state.people.me), 1)} kg`;
  document.querySelector("#partnerWeightMini").textContent = `${formatNumber(latestWeight(state.people.partner), 1)} kg`;
  els.tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.person === state.activePerson));
  els.nav.forEach((item) => item.classList.toggle("active", item.dataset.view === state.activeView));
  els.views.forEach((view) => view.classList.toggle("active", view.id === `${state.activeView}View`));

  const titles = { dashboard: "总览", log: "今日", meals: "食谱", sync: "同步", settings: "档案" };
  els.screenTitle.textContent = titles[state.activeView];
}

function renderDashboard() {
  const totalScore = Math.round((completionScore("me") + completionScore("partner")) / 2);
  const totalEntries = entriesSorted(state.people.me).length + entriesSorted(state.people.partner).length;
  els.levelValue.textContent = Math.max(1, Math.floor(totalEntries / 5) + 1);
  els.duoTitle.textContent = totalScore >= 80 ? "今天双人进度很稳" : "今天还可以再点亮几格";
  els.duoHint.textContent = latestCheer() || "记录越完整，路线越亮；互相鼓励也会留下来。";

  renderPlayerCard("me", document.querySelector("#meCard"));
  renderPlayerCard("partner", document.querySelector("#partnerCard"));
  renderQuests();
  renderPath();
  renderBadges();
  renderChart();
}

function renderPlayerCard(personKey, container) {
  const person = state.people[personKey];
  const score = completionScore(personKey);
  const weight = latestWeight(person);
  const goalLeft = Math.max(0, Math.abs(Number(weight) - Number(person.goalWeight)));
  const streak = streakDays(person);
  const bmi = getBmi(person);
  const bmiText = getBmiLabel(bmi);
  container.innerHTML = `
    <div class="player-top">
      <div>
        <span>${escapeHtml(person.device)}</span>
        <h3>${escapeHtml(person.name)}</h3>
      </div>
      <button class="ghost-button" data-cheer="${personKey}" type="button">鼓励</button>
    </div>
    <div class="progress-line"><span style="width: ${score}%"></span></div>
    <div class="player-stats">
      <div><strong>${formatNumber(weight, 1)}</strong><span>kg</span></div>
      <div><strong>${formatNumber(goalLeft, 1)}</strong><span>离目标</span></div>
      <div><strong>${streak}</strong><span>连续天</span></div>
      <div><strong>${formatNumber(bmi, 1)}</strong><span>BMI ${bmiText}</span></div>
    </div>
  `;
}

function renderQuests() {
  const quests = ["me", "partner"].flatMap((personKey) => {
    const person = state.people[personKey];
    const entry = getEntry(personKey);
    return [
      { owner: person.name, label: "记录体重", done: Number(entry.weight) > 0 },
      { owner: person.name, label: "喝够水", done: Number(entry.water) >= targetFor(person, "water") },
      { owner: person.name, label: "完成运动", done: Number(entry.exercise) >= targetFor(person, "exercise") },
      { owner: person.name, label: "睡够 7 小时", done: Number(entry.sleep) >= 7 }
    ];
  });
  const done = quests.filter((quest) => quest.done).length;
  els.questProgress.textContent = `${done} / ${quests.length}`;
  els.questGrid.innerHTML = quests
    .map((quest) => `<article class="quest ${quest.done ? "done" : ""}">
      <strong>${escapeHtml(quest.label)}</strong>
      <span>${escapeHtml(quest.owner)}</span>
    </article>`)
    .join("");
}

function renderPath() {
  const today = todayISO();
  const days = Array.from({ length: 7 }, (_, index) => dateOffset(today, index - 6));
  const weights = days.flatMap((date) => ["me", "partner"].map((key) => getEntry(key, date).weight).filter(Boolean));
  els.weekAverage.textContent = weights.length ? `双人均重 ${formatNumber(avg(weights.map(Number)), 1)} kg` : "暂无均重";
  els.pathTrack.innerHTML = days
    .map((date) => {
      const meScore = completionScore("me", date);
      const partnerScore = completionScore("partner", date);
      const lit = meScore + partnerScore >= 100;
      const label = new Intl.DateTimeFormat("zh-CN", { weekday: "short" }).format(new Date(`${date}T00:00:00`));
      return `<div class="path-node ${lit ? "lit" : ""}">
        <strong>${label}</strong>
        <span>${Math.round((meScore + partnerScore) / 2)}%</span>
      </div>`;
    })
    .join("");
}

function renderBadges() {
  const badgeDefs = [
    { title: "开局", unlocked: entriesSorted(state.people.me).length + entriesSorted(state.people.partner).length >= 1 },
    { title: "双人同日", unlocked: hasSameDayEntry() },
    { title: "饮水稳定", unlocked: weeklyCount("water") >= 6 },
    { title: "运动上路", unlocked: weeklyCount("exercise") >= 4 },
    { title: "睡眠守住", unlocked: weeklyCount("sleep") >= 4 },
    { title: "连续三天", unlocked: Math.max(streakDays(state.people.me), streakDays(state.people.partner)) >= 3 }
  ];
  els.badgeCount.textContent = `${badgeDefs.filter((badge) => badge.unlocked).length} 枚`;
  els.badgeGrid.innerHTML = badgeDefs
    .map((badge) => `<div class="badge ${badge.unlocked ? "unlocked" : ""}">
      <strong>${escapeHtml(badge.title)}</strong>
      <span>${badge.unlocked ? "已点亮" : "待解锁"}</span>
    </div>`)
    .join("");
}

function renderChart() {
  const canvas = els.chart;
  const ctx = canvas.getContext("2d");
  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth || canvas.parentElement.clientWidth;
  const height = 170;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  ctx.scale(ratio, ratio);
  ctx.clearRect(0, 0, width, height);

  const today = todayISO();
  const days = Array.from({ length: 14 }, (_, index) => dateOffset(today, index - 13));
  const series = ["me", "partner"].map((key) => ({
    key,
    color: key === "me" ? "#2f7d57" : "#3f6f9f",
    points: days.map((date) => ({ date, weight: state.people[key].entries[date]?.weight }))
  }));
  const values = series.flatMap((line) => line.points.filter((point) => point.weight).map((point) => Number(point.weight)));

  ctx.strokeStyle = "#dfe5dc";
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i += 1) {
    const y = 18 + i * 40;
    ctx.beginPath();
    ctx.moveTo(10, y);
    ctx.lineTo(width - 10, y);
    ctx.stroke();
  }

  if (!values.length) {
    ctx.fillStyle = "#687067";
    ctx.font = "15px Microsoft YaHei";
    ctx.fillText("还没有足够的体重记录", 18, 88);
    return;
  }

  const min = Math.min(...values) - 0.4;
  const max = Math.max(...values) + 0.4;
  const xGap = (width - 34) / (days.length - 1);
  const yFor = (value) => 142 - ((Number(value) - min) / (max - min || 1)) * 112;

  series.forEach((line) => {
    const firstIndex = line.points.findIndex((point) => point.weight);
    if (firstIndex < 0) return;
    ctx.strokeStyle = line.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    line.points.forEach((point, index) => {
      if (!point.weight) return;
      const x = 17 + index * xGap;
      const y = yFor(point.weight);
      if (index === firstIndex) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  });
}

function renderForms() {
  const person = activePerson();
  const entry = getEntry(state.activePerson, els.entryDate.value || todayISO());
  setField("entryDate", entry.date || todayISO());
  setField("weight", entry.weight || "");
  setField("steps", entry.steps || "");
  setField("exercise", entry.exercise || "");
  setField("water", entry.water || "");
  setField("calories", entry.calories || "");
  setField("sleep", entry.sleep || "");
  setField("mood", entry.mood || "");
  setField("notes", entry.notes || "");

  setField("profileName", person.name);
  setField("profileType", person.type);
  setField("height", person.height);
  setField("currentWeight", latestWeight(person));
  setField("goalWeight", person.goalWeight);
  setField("calorieTarget", person.calorieTarget);
  document.querySelector("#calorieTargetLabel").textContent = `${person.calorieTarget} kcal`;
  document.querySelector("#satiety").value = state.preferences.satiety;
  document.querySelector("#cookTime").value = state.preferences.cookTime;
}

function setField(id, value) {
  const field = document.querySelector(`#${id}`);
  if (field && document.activeElement !== field) field.value = value;
}

function renderFridge() {
  els.fridgeList.innerHTML = state.fridge
    .map((item, index) => {
      const safeItem = escapeHtml(item);
      return `<span class="chip">${safeItem}<button type="button" data-remove-index="${index}" aria-label="移除 ${safeItem}">×</button></span>`;
    })
    .join("");
}

function renderMenu() {
  if (!state.mealPlan.length) generateMealPlan(false);
  els.menuGrid.innerHTML = state.mealPlan
    .map((day) => `<article class="menu-card">
      <h3>${escapeHtml(day.day)}</h3>
      ${day.meals
        .map((meal) => `<div class="meal-item">
          <strong>${escapeHtml(meal.title)}</strong>
          <span>${escapeHtml(meal.detail)}</span>
          <span>${escapeHtml(meal.method || "")}</span>
          <span>${meal.kcal} kcal · 蛋白质 ${meal.protein}g</span>
        </div>`)
        .join("")}
    </article>`)
    .join("");
}

function renderSync() {
  document.querySelector("#meSyncStatus").textContent = state.lastSync.me ? `上次同步 ${state.lastSync.me}` : "等待连接";
  document.querySelector("#partnerSyncStatus").textContent = state.lastSync.partner ? `上次同步 ${state.lastSync.partner}` : "等待连接";
}

function generateMealPlan(shouldSave = true) {
  const people = [state.people.me, state.people.partner];
  const dailyCalories = people.reduce((sum, person) => sum + Number(person.calorieTarget), 0);
  const portions = [0.29, 0.38, 0.33];
  const dayNames = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
  const categorized = categorizeFridge();
  const bmiNote = buildBmiMealNote();

  state.preferences.satiety = document.querySelector("#satiety")?.value || state.preferences.satiety;
  state.preferences.cookTime = document.querySelector("#cookTime")?.value || state.preferences.cookTime;
  state.mealPlan = dayNames.map((day, dayIndex) => ({
    day,
    meals: ["breakfast", "lunch", "dinner"].map((slot, mealIndex) => {
      const protein = pick(categorized.protein, dayIndex + mealIndex);
      const carb = pick(categorized.carb, dayIndex + mealIndex * 2);
      const vegetable = pick(categorized.vegetable, dayIndex * 2 + mealIndex);
      const fat = pick(categorized.fat, dayIndex + mealIndex);
      const kcal = Math.round((dailyCalories * portions[mealIndex]) / 10) * 10;
      const proteinGram = Math.round(kcal / 20);
      return {
        title: `${pick(mealNames[slot], dayIndex)} · ${protein}`,
        detail: `两人份：${protein} + ${carb} + 熟${vegetable}${state.preferences.satiety === "high" ? ` + 少量${fat}` : ""}。${bmiNote}`,
        method: buildCookingMethod(slot, protein, carb, vegetable, fat),
        kcal,
        protein: proteinGram
      };
    })
  }));
  state.mealPlanVersion = defaultState.mealPlanVersion;

  if (shouldSave) saveState("本周菜单已生成");
}

function categorizeFridge() {
  const result = structuredClone(fallbackFoods);
  state.fridge.forEach((item) => {
    Object.keys(foodBank).forEach((group) => {
      if (foodBank[group].some((food) => item.includes(food) || food.includes(item))) {
        result[group] = unique([item, ...result[group]]);
      }
    });
  });
  return result;
}

function buildCookingMethod(slot, protein, carb, vegetable, fat) {
  const base = {
    breakfast: `做法：${carb}提前煮软或蒸熟；${protein}煮/煎熟；${vegetable}焯水或快炒，最后少油调味。`,
    lunch: `做法：${carb}做主食；${protein}用少油煎、烤或炒熟；${vegetable}大火快炒到断生，分成两份装盘。`,
    dinner: `做法：锅里加水或清汤，先下${vegetable}，再放${protein}煮熟；${carb}控制半拳到一拳，少盐收尾。`
  };
  const fatTip = state.preferences.satiety === "high" ? ` ${fat}只放一小勺或一小把，增加饱腹感。` : "";
  return `${base[slot]}${fatTip}不使用牛奶、酸奶、奶酪；蔬菜全部做熟。`;
}

function buildBmiMealNote() {
  const meBmi = getBmi(state.people.me);
  const partnerBmi = getBmi(state.people.partner);
  if (partnerBmi >= 28 && meBmi < 24) return "小鸡毛主食少一点，蛋白质和熟蔬菜多一点；小白按正常减脂份量。";
  if (partnerBmi >= 28) return "两人都优先高蛋白、熟蔬菜和稳碳水，小鸡毛少油少糖。";
  if (meBmi < 18.5) return "小白不要吃太低，保留主食和蛋白质。";
  return "按 BMI 保持温和热量差，不做极端节食。";
}

function getBmi(person) {
  const heightM = Number(person.height) / 100;
  const weight = Number(latestWeight(person));
  if (!heightM || !weight) return 0;
  return weight / (heightM * heightM);
}

function getBmiLabel(bmi) {
  if (!bmi) return "--";
  if (bmi < 18.5) return "偏低";
  if (bmi < 24) return "正常";
  if (bmi < 28) return "偏高";
  return "较高";
}

function streakDays(person) {
  let streak = 0;
  let cursor = todayISO();
  while (person.entries[cursor]) {
    streak += 1;
    cursor = dateOffset(cursor, -1);
  }
  return streak;
}

function hasSameDayEntry() {
  return Object.keys(state.people.me.entries).some((date) => state.people.partner.entries[date]);
}

function weeklyCount(key) {
  const today = todayISO();
  const days = Array.from({ length: 7 }, (_, index) => dateOffset(today, index - 6));
  return days.reduce((count, date) => {
    return count + ["me", "partner"].filter((personKey) => {
      const person = state.people[personKey];
      const entry = getEntry(personKey, date);
      if (key === "water") return Number(entry.water) >= targetFor(person, "water");
      if (key === "exercise") return Number(entry.exercise) >= targetFor(person, "exercise");
      if (key === "sleep") return Number(entry.sleep) >= 7;
      return false;
    }).length;
  }, 0);
}

function latestCheer() {
  const cheer = state.cheers.at(-1);
  if (!cheer) return "";
  return `${cheer.from} 给 ${cheer.to} 留了一句：${cheer.text}`;
}

function makeSyncPackage() {
  const personKey = state.activePerson;
  const payload = {
    app: "减脂小屋",
    version: 2,
    personKey,
    exportedAt: new Date().toISOString(),
    person: state.people[personKey]
  };
  return btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
}

function importSyncPackage(text) {
  const payload = JSON.parse(decodeURIComponent(escape(atob(text.trim()))));
  if (!payload.personKey || !payload.person) throw new Error("invalid package");
  state.people[payload.personKey] = {
    ...state.people[payload.personKey],
    ...payload.person,
    entries: { ...state.people[payload.personKey]?.entries, ...payload.person.entries }
  };
  state.lastSync[payload.personKey] = new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date());
}

function pick(items, index) {
  return items[index % items.length];
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function avg(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatNumber(value, digits = 0) {
  if (value === undefined || value === null || Number.isNaN(Number(value))) return "--";
  return Number(value).toFixed(digits);
}

function numberOrBlank(value) {
  return value === "" || value === null ? "" : Number(value);
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => els.toast.classList.remove("show"), 1800);
}

els.tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    state.activePerson = tab.dataset.person;
    saveState();
  });
});

els.nav.forEach((item) => {
  item.addEventListener("click", () => {
    state.activeView = item.dataset.view;
    saveState();
  });
});

document.querySelector("#todayBtn").addEventListener("click", () => {
  state.activeView = "log";
  els.entryDate.value = todayISO();
  saveState();
});

document.querySelector("#exportBtn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `减脂记录-${todayISO()}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
});

document.querySelector("#installBtn").addEventListener("click", async () => {
  if (!deferredInstallPrompt) {
    showToast("手机上可用浏览器菜单添加到主屏幕；部署到网址后可一键安装");
    return;
  }
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
});

document.querySelector("#dashboardView").addEventListener("click", (event) => {
  const target = event.target.closest("[data-cheer]");
  if (!target) return;
  const toKey = target.dataset.cheer;
  const from = state.people[toKey === "me" ? "partner" : "me"].name;
  const to = state.people[toKey].name;
  state.cheers.push({ from, to, text: "今天也一起稳稳来", at: new Date().toISOString() });
  saveState("鼓励已送达");
});

els.entryDate.addEventListener("change", renderForms);

els.dailyForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = new FormData(els.dailyForm);
  const date = form.get("date") || todayISO();
  const entry = {
    date,
    weight: numberOrBlank(form.get("weight")),
    steps: numberOrBlank(form.get("steps")),
    exercise: numberOrBlank(form.get("exercise")),
    water: numberOrBlank(form.get("water")),
    calories: numberOrBlank(form.get("calories")),
    sleep: numberOrBlank(form.get("sleep")),
    mood: String(form.get("mood") || ""),
    notes: String(form.get("notes") || "").trim()
  };
  activePerson().entries[date] = entry;
  if (entry.weight) activePerson().currentWeight = entry.weight;
  saveState("今日记录已保存，路线更新了");
});

document.querySelector("#copyYesterdayBtn").addEventListener("click", () => {
  const date = els.entryDate.value || todayISO();
  const yesterday = activePerson().entries[dateOffset(date, -1)];
  if (!yesterday) {
    showToast("昨天还没有记录");
    return;
  }
  ["steps", "exercise", "water", "calories", "sleep", "mood", "notes"].forEach((key) => setField(key, yesterday[key] || ""));
  showToast("已沿用昨天");
});

els.profileForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = new FormData(els.profileForm);
  Object.assign(activePerson(), {
    name: String(form.get("name") || "").trim() || activePerson().name,
    type: form.get("type"),
    height: Number(form.get("height")),
    currentWeight: Number(form.get("currentWeight")),
    goalWeight: Number(form.get("goalWeight")),
    calorieTarget: Number(form.get("calorieTarget"))
  });
  state.mealPlan = [];
  saveState("档案已保存");
});

els.fridgeForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const items = els.fridgeInput.value
    .split(/[，,、\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  state.fridge = unique([...state.fridge, ...items]);
  els.fridgeInput.value = "";
  state.mealPlan = [];
  saveState("冰箱已更新");
});

els.fridgeList.addEventListener("click", (event) => {
  const index = event.target.dataset.removeIndex;
  if (index === undefined) return;
  state.fridge.splice(Number(index), 1);
  state.mealPlan = [];
  saveState("已移除食材");
});

document.querySelector("#clearFridgeBtn").addEventListener("click", () => {
  state.fridge = [];
  state.mealPlan = [];
  saveState("冰箱已清空");
});

document.querySelector("#generateMealsBtn").addEventListener("click", () => generateMealPlan(true));
document.querySelector("#satiety").addEventListener("change", () => {
  state.preferences.satiety = document.querySelector("#satiety").value;
  state.mealPlan = [];
  saveState();
});
document.querySelector("#cookTime").addEventListener("change", () => {
  state.preferences.cookTime = document.querySelector("#cookTime").value;
  saveState();
});

document.querySelector("#pairCodeBtn").addEventListener("click", () => {
  state.pairCode = Math.random().toString(36).slice(2, 8).toUpperCase();
  els.syncOutput.value = `配对码：${state.pairCode}\n这个码在真正接入云同步时用于绑定两个人。`;
  saveState("配对码已生成");
});

document.querySelector("#makeSyncBtn").addEventListener("click", () => {
  els.syncOutput.value = makeSyncPackage();
  state.lastSync[state.activePerson] = "刚刚导出";
  saveState("同步包已生成");
});

document.querySelector("#importSyncBtn").addEventListener("click", () => {
  try {
    importSyncPackage(els.syncInput.value);
    els.syncInput.value = "";
    saveState("对方数据已导入");
  } catch {
    showToast("同步包格式不对");
  }
});

window.addEventListener("resize", renderChart);

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("./service-worker.js").catch(() => {});
}

render();
