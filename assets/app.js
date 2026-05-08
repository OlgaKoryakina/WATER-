"use strict";

const STORAGE_KEY = "hydroFamilyMembers_v1";
const ML_PER_GLASS = 250;

const SIP_ML_BY_TYPE = {
  man: 30,
  woman: 25,
  teen: 25,
  child: 12
};

const TYPE_LABELS = {
  man: "Взрослый мужчина",
  woman: "Взрослая женщина",
  teen: "Подросток",
  child: "Ребенок"
};

const dom = {
  form: document.getElementById("familyForm"),
  name: document.getElementById("memberName"),
  type: document.getElementById("memberType"),
  weight: document.getElementById("memberWeight"),
  message: document.getElementById("familyMessage"),
  list: document.getElementById("familyList"),
  totalMembers: document.getElementById("totalMembers"),
  totalTarget: document.getElementById("totalTarget"),
  totalDrank: document.getElementById("totalDrank"),
  totalPercent: document.getElementById("totalPercent"),
  familyProgress: document.getElementById("familyProgress"),
  resetDayButton: document.getElementById("resetDayButton"),
  clearAllButton: document.getElementById("clearAllButton")
};

const state = {
  members: []
};

function uid() {
  if (window.crypto && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "id_" + Date.now() + "_" + Math.floor(Math.random() * 10000);
}

function targetMl(weightKg) {
  return weightKg * 30;
}

function totalMl(member) {
  const sipMl = SIP_ML_BY_TYPE[member.type] || 0;
  return member.sips * sipMl + member.glasses * ML_PER_GLASS;
}

function memberPercent(member) {
  const goal = targetMl(member.weightKg);
  if (!goal) {
    return 0;
  }
  return Math.min(Math.round((totalMl(member) / goal) * 100), 100);
}

function showMessage(text, isError) {
  dom.message.textContent = text;
  dom.message.style.color = isError ? "#fda4af" : "#86efac";
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.members)) {
      return;
    }
    state.members = parsed.members
      .filter(function (m) {
        return m && m.id && m.name && m.type && m.weightKg;
      })
      .map(function (m) {
        return {
          id: m.id,
          name: String(m.name),
          type: SIP_ML_BY_TYPE[m.type] ? m.type : "woman",
          weightKg: Number(m.weightKg),
          sips: Number(m.sips) || 0,
          glasses: Number(m.glasses) || 0
        };
      });
  } catch (error) {
    state.members = [];
  }
}

function updateTotals() {
  const membersCount = state.members.length;
  let totalTargetMl = 0;
  let totalDrankMl = 0;

  state.members.forEach(function (member) {
    totalTargetMl += targetMl(member.weightKg);
    totalDrankMl += totalMl(member);
  });

  const percent = totalTargetMl
    ? Math.min(Math.round((totalDrankMl / totalTargetMl) * 100), 100)
    : 0;

  dom.totalMembers.textContent = String(membersCount);
  dom.totalTarget.textContent = totalTargetMl + " мл";
  dom.totalDrank.textContent = totalDrankMl + " мл";
  dom.totalPercent.textContent = percent + "%";
  dom.familyProgress.value = percent;
}

function createButton(text, action) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "action-btn";
  button.dataset.action = action;
  button.textContent = text;
  return button;
}

function renderCard(member) {
  const item = document.createElement("li");
  item.className = "member-item";
  item.dataset.id = member.id;

  const header = document.createElement("div");
  header.className = "member-header";

  const name = document.createElement("span");
  name.className = "member-name";
  name.textContent = member.name;

  const type = document.createElement("span");
  type.className = "member-type";
  type.textContent = TYPE_LABELS[member.type] || member.type;

  header.append(name, type);

  const stats = document.createElement("div");
  stats.className = "member-stats";
  stats.textContent =
    "Вес: " + member.weightKg + " кг | " +
    "Норма: " + targetMl(member.weightKg) + " мл | " +
    "Выпито: " + totalMl(member) + " мл (" + memberPercent(member) + "%)";

  const progress = document.createElement("progress");
  progress.max = 100;
  progress.value = memberPercent(member);

  const actions = document.createElement("div");
  actions.className = "member-actions";
  actions.append(
    createButton("+1 глоток", "add-sip"),
    createButton("-1 глоток", "remove-sip"),
    createButton("+1 стакан", "add-glass"),
    createButton("-1 стакан", "remove-glass"),
    createButton("Удалить", "remove-member")
  );

  item.append(header, stats, progress, actions);
  return item;
}

function render() {
  dom.list.innerHTML = "";

  if (!state.members.length) {
    const empty = document.createElement("li");
    empty.className = "member-item";
    empty.textContent = "Пока нет участников. Добавьте первого члена семьи.";
    dom.list.append(empty);
    updateTotals();
    return;
  }

  state.members.forEach(function (member) {
    dom.list.append(renderCard(member));
  });

  updateTotals();
}

function addMember(event) {
  event.preventDefault();

  const name = dom.name.value.trim();
  const type = dom.type.value;
  const weight = Math.round(Number(dom.weight.value));

  if (!name) {
    showMessage("Введите имя участника.", true);
    return;
  }

  if (!weight || weight < 1 || weight > 300) {
    showMessage("Введите корректный вес (1-300 кг).", true);
    return;
  }

  const duplicate = state.members.some(function (member) {
    return member.name.toLowerCase() === name.toLowerCase();
  });

  if (duplicate) {
    showMessage("Такой участник уже есть в списке.", true);
    return;
  }

  state.members.push({
    id: uid(),
    name: name,
    type: type,
    weightKg: weight,
    sips: 0,
    glasses: 0
  });

  save();
  render();
  dom.form.reset();
  dom.name.focus();
  showMessage(name + " добавлен(а) в учет.", false);
}

function onListClick(event) {
  const button = event.target.closest("[data-action]");
  if (!button) {
    return;
  }

  const item = button.closest("[data-id]");
  if (!item) {
    return;
  }

  const memberId = item.dataset.id;
  const member = state.members.find(function (m) {
    return m.id === memberId;
  });
  if (!member) {
    return;
  }

  const action = button.dataset.action;

  if (action === "add-sip") {
    member.sips += 1;
  }
  if (action === "remove-sip") {
    member.sips = Math.max(0, member.sips - 1);
  }
  if (action === "add-glass") {
    member.glasses += 1;
  }
  if (action === "remove-glass") {
    member.glasses = Math.max(0, member.glasses - 1);
  }
  if (action === "remove-member") {
    const allowed = window.confirm("Удалить участника из списка?");
    if (allowed) {
      state.members = state.members.filter(function (m) {
        return m.id !== memberId;
      });
      showMessage("Участник удален.", false);
    }
  }

  save();
  render();
}

function resetDayStats() {
  if (!state.members.length) {
    showMessage("Список пуст, сбрасывать нечего.", true);
    return;
  }

  const allowed = window.confirm("Сбросить сегодняшнюю статистику у всех участников?");
  if (!allowed) {
    return;
  }

  state.members.forEach(function (member) {
    member.sips = 0;
    member.glasses = 0;
  });

  save();
  render();
  showMessage("Статистика за день сброшена.", false);
}

function clearAllMembers() {
  if (!state.members.length) {
    showMessage("Список уже пуст.", true);
    return;
  }

  const allowed = window.confirm("Удалить всех участников и очистить статистику?");
  if (!allowed) {
    return;
  }

  state.members = [];
  save();
  render();
  showMessage("Все участники удалены.", false);
}

dom.form.addEventListener("submit", addMember);
dom.list.addEventListener("click", onListClick);
dom.resetDayButton.addEventListener("click", resetDayStats);
dom.clearAllButton.addEventListener("click", clearAllMembers);

load();
render();
