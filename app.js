const STORAGE_KEY = "barbell-block-state-v1";
const WEEKDAY_ORDER = ["Mon", "Tue", "Thu", "Fri"];
const PLATES = [45, 25, 10, 5, 2.5];
const BAR_WEIGHT = 45;
const PRIMARY_SCHEME = {
  1: [
    { percent: 0.65, reps: 5, amrap: false },
    { percent: 0.75, reps: 5, amrap: false },
    { percent: 0.85, reps: 5, amrap: true },
  ],
  2: [
    { percent: 0.7, reps: 3, amrap: false },
    { percent: 0.8, reps: 3, amrap: false },
    { percent: 0.9, reps: 3, amrap: true },
  ],
  3: [
    { percent: 0.75, reps: 5, amrap: false },
    { percent: 0.85, reps: 3, amrap: false },
    { percent: 0.95, reps: 1, amrap: true },
  ],
  4: [
    { percent: 0.4, reps: 5, amrap: false },
    { percent: 0.5, reps: 5, amrap: false },
    { percent: 0.6, reps: 5, amrap: false },
  ],
};
const SECONDARY_SCHEME = {
  default: { sets: 4, reps: 10, percent: 0.6 },
  deload: { sets: 3, reps: 10, percent: 0.5 },
};

const elements = {
  cycleForm: document.querySelector("#cycleForm"),
  liftCards: document.querySelector("#liftCards"),
  dayAssignments: document.querySelector("#dayAssignments"),
  startDateLabel: document.querySelector("#startDateLabel"),
  todayCard: document.querySelector("#todayCard"),
  calendarList: document.querySelector("#calendarList"),
  historyList: document.querySelector("#historyList"),
  queuedCycleCard: document.querySelector("#queuedCycleCard"),
  cycleStatusLabel: document.querySelector("#cycleStatusLabel"),
  liftCardTemplate: document.querySelector("#liftCardTemplate"),
  plateDialog: document.querySelector("#plateDialog"),
  plateDialogTitle: document.querySelector("#plateDialogTitle"),
  plateDialogBody: document.querySelector("#plateDialogBody"),
  closePlateDialogButton: document.querySelector("#closePlateDialogButton"),
  resetAppButton: document.querySelector("#resetAppButton"),
};

let state = loadState();

init();

function init() {
  renderSetupForm();
  attachEvents();
  renderApp();
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return createEmptyState();
    }

    return normalizeState(JSON.parse(raw));
  } catch (error) {
    console.error("Failed to load state", error);
    return createEmptyState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function attachEvents() {
  elements.cycleForm.addEventListener("submit", handleCreateCycle);
  elements.closePlateDialogButton.addEventListener("click", () => elements.plateDialog.close());
  elements.resetAppButton.addEventListener("click", handleResetApp);
  elements.cycleForm.addEventListener("input", syncAssignmentLabels);
  document.addEventListener("click", handleActionClick);
}

function renderSetupForm() {
  elements.startDateLabel.textContent = `Starts ${formatDate(getNextMonday(new Date()))}`;
  elements.liftCards.innerHTML = "";

  for (let index = 0; index < 2; index += 1) {
    const node = elements.liftCardTemplate.content.cloneNode(true);
    const card = node.querySelector(".lift-card");
    card.dataset.liftIndex = String(index);
    card.querySelector("h3").textContent = `Lift ${index + 1}`;
    card.querySelector(".muted").textContent = "Use however many you need. Repeated days share one training max.";

    const nameInput = card.querySelector('[data-field="name"]');
    const equipmentTypeInput = card.querySelector('[data-field="equipmentType"]');
    const tmInput = card.querySelector('[data-field="trainingMax"]');
    const incrementInput = card.querySelector('[data-field="increment"]');

    nameInput.name = `lift-${index}-name`;
    equipmentTypeInput.name = `lift-${index}-equipmentType`;
    tmInput.name = `lift-${index}-trainingMax`;
    incrementInput.name = `lift-${index}-increment`;

    card.querySelectorAll(".accessory-row").forEach((row, accessoryIndex) => {
      row.querySelectorAll("input").forEach((input) => {
        const field = input.dataset.field;
        input.name = `lift-${index}-acc-${accessoryIndex}-${field}`;
      });
    });

    elements.liftCards.appendChild(node);
  }

  elements.dayAssignments.innerHTML = "";

  WEEKDAY_ORDER.forEach((weekday) => {
    const wrapper = document.createElement("label");
    wrapper.className = "field";
    wrapper.innerHTML = `
      <span>${weekday}</span>
      <select name="assignment-${weekday}" required>
        <option value="">Select a lift</option>
        <option value="0">Lift 1</option>
        <option value="1">Lift 2</option>
      </select>
    `;
    elements.dayAssignments.appendChild(wrapper);
  });

  syncAssignmentLabels();
}

function renderApp() {
  renderTodayCard();
  renderCalendar();
  renderHistory();
  renderQueuedCycle();
}

function handleCreateCycle(event) {
  event.preventDefault();
  const formData = new FormData(elements.cycleForm);
  const cycle = buildCycleFromForm(formData);

  if (!cycle) {
    return;
  }

  state.activeCycle = cycle;
  state.queuedCycle = buildQueuedCycle(cycle);
  saveState();
  renderApp();
}

function handleResetApp() {
  const confirmed = window.confirm("Reset the stored app data for this browser?");
  if (!confirmed) {
    return;
  }

  state = createEmptyState();
  saveState();
  renderSetupForm();
  elements.cycleForm.reset();
  renderApp();
}

function handleActionClick(event) {
  const actionTarget = event.target.closest("[data-action]");
  if (!actionTarget) {
    return;
  }

  const { action, workoutId, setIndex, accessoryIndex, accessorySetIndex, cycleType } = actionTarget.dataset;

  if (action === "save-main-reps") {
    updateWorkoutSet(workoutId, Number(setIndex), null, null);
  }

  if (action === "save-accessory-reps") {
    updateWorkoutSet(workoutId, Number(accessoryIndex), Number(accessorySetIndex), "accessory");
  }

  if (action === "show-plates") {
    openPlateDialog(workoutId, Number(setIndex));
  }

  if (action === "mark-missed") {
    markWorkoutStatus(workoutId, "missed");
  }

  if (action === "activate-queued" && cycleType === "queued") {
    activateQueuedCycle();
  }
}

function buildCycleFromForm(formData) {
  const lifts = [];

  for (let index = 0; index < 2; index += 1) {
    const name = String(formData.get(`lift-${index}-name`) || "").trim();
    const equipmentType = String(formData.get(`lift-${index}-equipmentType`) || "barbell");
    const tmRaw = String(formData.get(`lift-${index}-trainingMax`) || "").trim();
    const incrementRaw = String(formData.get(`lift-${index}-increment`) || "").trim();

    if (!name && !tmRaw && !incrementRaw) {
      continue;
    }

    if (!name || !tmRaw || !incrementRaw) {
      window.alert(`Lift ${index + 1} is incomplete.`);
      return null;
    }

    const accessories = [0, 1].map((accessoryIndex) => ({
      name: String(formData.get(`lift-${index}-acc-${accessoryIndex}-accessoryName`) || "").trim(),
      sets: Number(formData.get(`lift-${index}-acc-${accessoryIndex}-accessorySets`) || 0),
      reps: Number(formData.get(`lift-${index}-acc-${accessoryIndex}-accessoryReps`) || 0),
      weight: String(formData.get(`lift-${index}-acc-${accessoryIndex}-accessoryWeight`) || "").trim(),
    }));

    lifts.push({
      id: `lift-${crypto.randomUUID()}`,
      slotIndex: index,
      name,
      equipmentType,
      trainingMax: Number(tmRaw),
      increment: Number(incrementRaw),
      accessories,
    });
  }

  if (lifts.length === 0) {
    window.alert("Add at least one lift.");
    return null;
  }

  const dayAssignments = [];
  for (const weekday of WEEKDAY_ORDER) {
    const slotIndex = Number(formData.get(`assignment-${weekday}`));
    const lift = lifts.find((entry) => entry.slotIndex === slotIndex);

    if (!lift) {
      window.alert(`Assign a configured lift to ${weekday}.`);
      return null;
    }

    dayAssignments.push({
      weekday,
      liftId: lift.id,
    });
  }

  const cycleName = String(formData.get("cycleName") || "").trim();
  const startDate = getNextMonday(new Date());
  const cycle = {
    id: `cycle-${crypto.randomUUID()}`,
    name: cycleName,
    startDate: toIsoDate(startDate),
    lifts: lifts.map(({ slotIndex, ...lift }) => lift),
    dayAssignments,
    workouts: [],
  };

  cycle.workouts = generateWorkouts(cycle);
  return cycle;
}

function generateWorkouts(cycle) {
  const workouts = [];

  for (let weekNumber = 1; weekNumber <= 4; weekNumber += 1) {
    const weeklyDates = buildWeekDates(cycle.startDate, weekNumber);
    const liftCounts = new Map();

    cycle.dayAssignments.forEach((assignment, dayIndex) => {
      const count = (liftCounts.get(assignment.liftId) || 0) + 1;
      liftCounts.set(assignment.liftId, count);

      const lift = cycle.lifts.find((entry) => entry.id === assignment.liftId);
      const isPrimary = count === 1;
      const date = weeklyDates[assignment.weekday];

      workouts.push({
        id: `workout-${crypto.randomUUID()}`,
        cycleId: cycle.id,
        date,
        weekday: assignment.weekday,
        weekNumber,
        dayIndex,
        liftId: assignment.liftId,
        liftName: lift.name,
        equipmentType: lift.equipmentType,
        type: isPrimary ? "primary" : "secondary",
        mainSets: buildMainSets(lift.trainingMax, weekNumber, isPrimary),
        accessorySets: buildAccessorySets(lift.accessories),
        status: "pending",
      });
    });
  }

  return workouts.sort((left, right) => left.date.localeCompare(right.date));
}

function buildWeekDates(startDateIso, weekNumber) {
  const weekStart = new Date(startDateIso);
  weekStart.setDate(weekStart.getDate() + (weekNumber - 1) * 7);

  return {
    Mon: toIsoDate(weekStart),
    Tue: toIsoDate(addDays(weekStart, 1)),
    Thu: toIsoDate(addDays(weekStart, 3)),
    Fri: toIsoDate(addDays(weekStart, 4)),
  };
}

function buildMainSets(trainingMax, weekNumber, isPrimary) {
  if (isPrimary) {
    return PRIMARY_SCHEME[weekNumber].map((set, index) => ({
      index,
      label: `${Math.round(set.percent * 100)}% x ${set.reps}${set.amrap ? "+" : ""}`,
      targetWeight: roundToNearestFive(trainingMax * set.percent),
      targetReps: set.reps,
      amrap: set.amrap,
      loggedReps: null,
    }));
  }

  const rule = weekNumber === 4 ? SECONDARY_SCHEME.deload : SECONDARY_SCHEME.default;
  const targetWeight = roundToNearestFive(trainingMax * rule.percent);
  return Array.from({ length: rule.sets }, (_, index) => ({
    index,
    label: `${Math.round(rule.percent * 100)}% x ${rule.reps}`,
    targetWeight,
    targetReps: rule.reps,
    amrap: false,
    loggedReps: null,
  }));
}

function buildAccessorySets(accessories) {
  return accessories
    .filter((accessory) => accessory.name && accessory.sets > 0 && accessory.reps > 0)
    .map((accessory) => ({
      name: accessory.name,
      weight: accessory.weight,
      sets: Array.from({ length: accessory.sets }, (_, index) => ({
        index,
        targetReps: accessory.reps,
        loggedReps: null,
      })),
    }));
}

function buildQueuedCycle(activeCycle) {
  const lastWorkout = activeCycle.workouts[activeCycle.workouts.length - 1];
  const nextStartDate = getNextMondayOrSame(addDays(new Date(lastWorkout.date), 3));
  const queuedCycle = {
    id: `cycle-${crypto.randomUUID()}`,
    name: `${activeCycle.name} Next`,
    startDate: toIsoDate(nextStartDate),
    lifts: activeCycle.lifts.map((lift) => ({
      ...lift,
      id: `lift-${crypto.randomUUID()}`,
      trainingMax: lift.trainingMax + lift.increment,
    })),
    dayAssignments: [],
    workouts: [],
  };

  const slotMap = new Map();
  activeCycle.lifts.forEach((lift, index) => {
    slotMap.set(lift.id, queuedCycle.lifts[index].id);
  });

  queuedCycle.dayAssignments = activeCycle.dayAssignments.map((assignment) => ({
    weekday: assignment.weekday,
    liftId: slotMap.get(assignment.liftId),
  }));
  queuedCycle.workouts = generateWorkouts(queuedCycle);

  return queuedCycle;
}

function renderTodayCard() {
  if (!state.activeCycle) {
    elements.todayCard.className = "card empty-state";
    elements.todayCard.innerHTML = "<p>No active cycle.</p>";
    elements.cycleStatusLabel.textContent = "Create your first 4-week block.";
    return;
  }

  const todayIso = toIsoDate(new Date());
  const todaysWorkout = state.activeCycle.workouts.find((workout) => workout.date === todayIso);
  const nextWorkout = state.activeCycle.workouts.find(
    (workout) => workout.status === "pending" && workout.date >= todayIso,
  );
  const workout = todaysWorkout || nextWorkout;

  const completedCount = state.activeCycle.workouts.filter((entry) => entry.status === "completed").length;
  const totalCount = state.activeCycle.workouts.length;
  elements.cycleStatusLabel.textContent = `${state.activeCycle.name} • ${completedCount}/${totalCount} sessions completed`;

  if (!workout) {
    const allDone = state.activeCycle.workouts.every((entry) => entry.status !== "pending");
    elements.todayCard.className = "card";
    elements.todayCard.innerHTML = allDone
      ? `
        <div class="today-workout">
          <div class="today-header">
            <h3>Cycle complete</h3>
            <p class="muted">Activate the queued cycle when you are ready.</p>
          </div>
        </div>
      `
      : `
        <div class="today-workout">
          <div class="today-header">
            <h3>No scheduled workout today</h3>
            <p class="muted">Nothing pending on or after today.</p>
          </div>
        </div>
      `;
    return;
  }

  elements.todayCard.className = "card";
  elements.todayCard.innerHTML = `
    <div class="today-workout">
      <div class="today-header">
        <div class="badge-row">
          <span class="badge">${formatDate(workout.date)}</span>
          <span class="badge">Week ${workout.weekNumber}</span>
          <span class="badge">${workout.type === "primary" ? "Primary 5/3/1" : "Secondary 4x10"}</span>
          <span class="badge">${workout.equipmentType === "barbell" ? "Barbell" : "Non-barbell"}</span>
          <span class="badge">${workout.status}</span>
        </div>
        <h3>${workout.liftName}</h3>
      </div>

      <section class="set-list">
        ${workout.mainSets.map((set, setIndex) => renderMainSet(workout, set, setIndex)).join("")}
      </section>

      ${
        workout.accessorySets.length
          ? `
        <section class="accessory-list">
          ${workout.accessorySets.map((accessory, accessoryIndex) => renderAccessoryBlock(workout, accessory, accessoryIndex)).join("")}
        </section>
      `
          : ""
      }

      <div class="workout-actions">
        ${
          workout.status === "pending" && workout.date <= todayIso
            ? `<button class="danger-button" type="button" data-action="mark-missed" data-workout-id="${workout.id}">Mark Missed</button>`
            : ""
        }
        <p class="muted">Main sets assume programmed weight. Logging all main and accessory sets marks the workout complete.</p>
      </div>
    </div>
  `;
}

function renderMainSet(workout, set, setIndex) {
  const isBarbell = (workout.equipmentType || "barbell") === "barbell";
  return `
    <article class="set-row">
      <div class="row-head">
        <div>
          <h4>${set.label}</h4>
          <p class="set-subtitle">${set.targetWeight} lb${set.amrap ? " • AMRAP / rep PR" : ""}</p>
        </div>
        ${
          isBarbell
            ? `
          <button
            class="secondary-button"
            type="button"
            data-action="show-plates"
            data-workout-id="${workout.id}"
            data-set-index="${setIndex}"
          >
            Plates
          </button>
        `
            : `<span class="badge">External load</span>`
        }
      </div>
      <div class="set-actions">
        <input
          id="main-set-${workout.id}-${setIndex}"
          type="number"
          min="0"
          step="1"
          value="${set.loggedReps ?? ""}"
          placeholder="Actual reps"
        />
        <button
          class="primary-button"
          type="button"
          data-action="save-main-reps"
          data-workout-id="${workout.id}"
          data-set-index="${setIndex}"
        >
          Save Reps
        </button>
      </div>
    </article>
  `;
}

function renderAccessoryBlock(workout, accessory, accessoryIndex) {
  return `
    <article class="accessory-block">
      <div class="row-head">
        <div>
          <h4>${accessory.name}</h4>
          <p class="set-subtitle">${accessory.sets.length} sets x ${accessory.sets[0]?.targetReps ?? ""} reps${accessory.weight ? ` • ${accessory.weight}` : ""}</p>
        </div>
      </div>
      <div class="set-list">
        ${accessory.sets
          .map(
            (set, accessorySetIndex) => `
            <div class="set-row">
              <div class="row-head">
                <div>
                  <h4>Set ${accessorySetIndex + 1}</h4>
                  <p class="set-subtitle">Target ${set.targetReps} reps</p>
                </div>
              </div>
              <div class="set-actions">
                <input
                  id="accessory-set-${workout.id}-${accessoryIndex}-${accessorySetIndex}"
                  type="number"
                  min="0"
                  step="1"
                  value="${set.loggedReps ?? ""}"
                  placeholder="Actual reps"
                />
                <button
                  class="primary-button"
                  type="button"
                  data-action="save-accessory-reps"
                  data-workout-id="${workout.id}"
                  data-accessory-index="${accessoryIndex}"
                  data-accessory-set-index="${accessorySetIndex}"
                >
                  Save Reps
                </button>
              </div>
            </div>
          `,
          )
          .join("")}
      </div>
    </article>
  `;
}

function renderCalendar() {
  if (!state.activeCycle) {
    elements.calendarList.className = "calendar-list empty-state";
    elements.calendarList.innerHTML = "<p>Create a cycle to generate workouts.</p>";
    return;
  }

  const todayIso = toIsoDate(new Date());
  elements.calendarList.className = "calendar-list";
  elements.calendarList.innerHTML = state.activeCycle.workouts
    .map((workout) => {
      const classes = ["calendar-row"];
      if (workout.date === todayIso) {
        classes.push("today");
      }
      if (workout.status === "completed") {
        classes.push("completed");
      }
      if (workout.status === "missed") {
        classes.push("missed");
      }

      return `
        <article class="${classes.join(" ")}">
          <div class="calendar-meta">
            <span>${formatDate(workout.date)}</span>
            <span>Week ${workout.weekNumber}</span>
          </div>
          <div class="row-head">
            <div>
              <h3>${workout.liftName}</h3>
              <p class="set-subtitle">${workout.type === "primary" ? "Primary 5/3/1 day" : "Secondary 4x10 @ 60%"}</p>
            </div>
            <span class="badge">${workout.status}</span>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderHistory() {
  const grouped = new Map();
  [...state.archivedCycles, state.activeCycle]
    .filter(Boolean)
    .flatMap((cycle) => cycle.workouts)
    .filter((workout) => workout.status === "completed")
    .forEach((workout) => {
      const entries = grouped.get(workout.liftName) || [];
      entries.push(workout);
      grouped.set(workout.liftName, entries);
    });

  if (grouped.size === 0) {
    elements.historyList.className = "history-list empty-state";
    elements.historyList.innerHTML = "<p>No logged lifts yet.</p>";
    return;
  }

  elements.historyList.className = "history-list";
  elements.historyList.innerHTML = [...grouped.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([liftName, workouts]) => `
      <article class="history-group">
        <div class="row-head">
          <h3>${liftName}</h3>
          <span class="badge">${workouts.length} sessions</span>
        </div>
        ${workouts
          .sort((left, right) => right.date.localeCompare(left.date))
          .map((workout) => `
            <div class="history-entry">
              <div class="history-meta">${formatDate(workout.date)} • Week ${workout.weekNumber} • ${workout.type}</div>
              <div>${summarizeLoggedReps(workout)}</div>
            </div>
          `)
          .join("")}
      </article>
    `)
    .join("");
}

function renderQueuedCycle() {
  if (!state.queuedCycle) {
    elements.queuedCycleCard.className = "card empty-state";
    elements.queuedCycleCard.innerHTML = "<p>No queued cycle.</p>";
    return;
  }

  const readyToActivate = state.activeCycle
    ? state.activeCycle.workouts.every((workout) => workout.status !== "pending")
    : true;

  const liftSummary = state.queuedCycle.lifts.map((lift) => `${lift.name} ${lift.trainingMax} lb`).join(" • ");
  elements.queuedCycleCard.className = "card";
  elements.queuedCycleCard.innerHTML = `
    <div class="queued-cycle">
      <div>
        <h3>${state.queuedCycle.name}</h3>
        <p class="queued-meta">Starts ${formatDate(state.queuedCycle.startDate)}</p>
      </div>
      <p class="muted">${liftSummary}</p>
      <button
        class="primary-button"
        type="button"
        data-action="activate-queued"
        data-cycle-type="queued"
        ${readyToActivate ? "" : "disabled"}
      >
        Activate Queued Cycle
      </button>
    </div>
  `;
}

function updateWorkoutSet(workoutId, indexA, indexB, target) {
  if (!state.activeCycle) {
    return;
  }

  const workout = state.activeCycle.workouts.find((entry) => entry.id === workoutId);
  if (!workout || workout.status === "missed") {
    return;
  }

  if (target === "accessory") {
    const input = document.querySelector(`#accessory-set-${workoutId}-${indexA}-${indexB}`);
    workout.accessorySets[indexA].sets[indexB].loggedReps = parseLoggedReps(input.value);
  } else {
    const input = document.querySelector(`#main-set-${workoutId}-${indexA}`);
    workout.mainSets[indexA].loggedReps = parseLoggedReps(input.value);
  }

  syncWorkoutStatus(workout);
  saveState();
  renderApp();
}

function parseLoggedReps(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function syncWorkoutStatus(workout) {
  const mainDone = workout.mainSets.every((set) => Number.isFinite(set.loggedReps));
  const accessoryDone = workout.accessorySets.every((accessory) =>
    accessory.sets.every((set) => Number.isFinite(set.loggedReps)),
  );

  if (mainDone && accessoryDone) {
    workout.status = "completed";
  } else {
    workout.status = "pending";
  }
}

function markWorkoutStatus(workoutId, status) {
  if (!state.activeCycle) {
    return;
  }

  const workout = state.activeCycle.workouts.find((entry) => entry.id === workoutId);
  if (!workout) {
    return;
  }

  workout.status = status;
  saveState();
  renderApp();
}

function openPlateDialog(workoutId, setIndex) {
  if (!state.activeCycle) {
    return;
  }

  const workout = state.activeCycle.workouts.find((entry) => entry.id === workoutId);
  const set = workout?.mainSets[setIndex];
  if (!set) {
    return;
  }

  if ((workout.equipmentType || "barbell") !== "barbell") {
    elements.plateDialogTitle.textContent = `${workout.liftName} • ${set.targetWeight} lb`;
    elements.plateDialogBody.innerHTML = `
      <p class="muted">This lift is marked non-barbell. Target external load: ${set.targetWeight} lb.</p>
    `;
    elements.plateDialog.showModal();
    return;
  }

  const breakdown = calculatePlateBreakdown(set.targetWeight);
  elements.plateDialogTitle.textContent = `${workout.liftName} • ${set.targetWeight} lb`;

  if (!breakdown.possible) {
    elements.plateDialogBody.innerHTML = `
      <p class="muted">Impossible with a ${BAR_WEIGHT} lb bar and available plates: ${PLATES.join(", ")}.</p>
    `;
  } else {
    elements.plateDialogBody.innerHTML = `
      <div class="plate-row">
        <span>Barbell</span>
        <strong>${BAR_WEIGHT} lb</strong>
      </div>
      ${breakdown.perSide.map((entry) => `
        <div class="plate-row">
          <span>${entry.plate} lb plate</span>
          <strong>${entry.count} per side</strong>
        </div>
      `).join("")}
    `;
  }

  elements.plateDialog.showModal();
}

function calculatePlateBreakdown(targetWeight) {
  if (targetWeight < BAR_WEIGHT) {
    return { possible: false, perSide: [] };
  }

  let remaining = (targetWeight - BAR_WEIGHT) / 2;
  if (remaining < 0) {
    return { possible: false, perSide: [] };
  }

  const perSide = [];
  for (const plate of PLATES) {
    const count = Math.floor((remaining + 1e-9) / plate);
    if (count > 0) {
      perSide.push({ plate, count });
      remaining -= count * plate;
      remaining = Math.round(remaining * 100) / 100;
    }
  }

  return {
    possible: Math.abs(remaining) < 0.001,
    perSide,
  };
}

function activateQueuedCycle() {
  if (!state.queuedCycle) {
    return;
  }

  if (state.activeCycle) {
    state.archivedCycles.push(state.activeCycle);
  }

  state.activeCycle = state.queuedCycle;
  state.queuedCycle = buildQueuedCycle(state.activeCycle);
  saveState();
  renderApp();
}

function summarizeLoggedReps(workout) {
  const mainSummary = workout.mainSets.map((set) => `${set.targetWeight}x${set.loggedReps ?? "-"}`).join(", ");
  const accessorySummary = workout.accessorySets
    .map((accessory) => `${accessory.name}: ${accessory.sets.map((set) => set.loggedReps ?? "-").join("/")}`)
    .join(" • ");

  return accessorySummary ? `${mainSummary} • ${accessorySummary}` : mainSummary;
}

function syncAssignmentLabels() {
  for (let index = 0; index < 2; index += 1) {
    const nameInput = elements.cycleForm.querySelector(`input[name="lift-${index}-name"]`);
    const label = nameInput?.value.trim() || `Lift ${index + 1}`;
    elements.dayAssignments
      .querySelectorAll(`option[value="${index}"]`)
      .forEach((option) => {
        option.textContent = label;
      });
  }
}

function createEmptyState() {
  return {
    activeCycle: null,
    queuedCycle: null,
    archivedCycles: [],
  };
}

function normalizeState(rawState) {
  return {
    activeCycle: normalizeCycle(rawState.activeCycle),
    queuedCycle: normalizeCycle(rawState.queuedCycle),
    archivedCycles: Array.isArray(rawState.archivedCycles)
      ? rawState.archivedCycles.map((cycle) => normalizeCycle(cycle)).filter(Boolean)
      : [],
  };
}

function normalizeCycle(cycle) {
  if (!cycle) {
    return null;
  }

  const equipmentByLiftId = new Map(
    (cycle.lifts || []).map((lift) => [lift.id, lift.equipmentType || "barbell"]),
  );

  return {
    ...cycle,
    lifts: (cycle.lifts || []).map((lift) => ({
      ...lift,
      equipmentType: lift.equipmentType || "barbell",
    })),
    workouts: (cycle.workouts || []).map((workout) => ({
      ...workout,
      equipmentType: workout.equipmentType || equipmentByLiftId.get(workout.liftId) || "barbell",
    })),
  };
}

function roundToNearestFive(weight) {
  return Math.round(weight / 5) * 5;
}

function getNextMonday(referenceDate) {
  const date = new Date(referenceDate);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay();
  const distance = ((8 - day) % 7) || 7;
  date.setDate(date.getDate() + distance);
  return date;
}

function getNextMondayOrSame(referenceDate) {
  const date = new Date(referenceDate);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay();
  const distance = (8 - day) % 7;
  date.setDate(date.getDate() + distance);
  return date;
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(dateInput) {
  const date = new Date(dateInput);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
