const STORAGE_KEY = "barbell-block-state-v1";
const SETUP_DRAFT_KEY = "barbell-block-setup-draft-v1";
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
  homePanel: document.querySelector("#homePanel"),
  homePanelNote: document.querySelector("#homePanelNote"),
  openWorkoutButton: document.querySelector("#openWorkoutButton"),
  openPlansButton: document.querySelector("#openPlansButton"),
  openSetupButton: document.querySelector("#openSetupButton"),
  homeButton: document.querySelector("#homeButton"),
  plansButton: document.querySelector("#plansButton"),
  cycleForm: document.querySelector("#cycleForm"),
  linearConfigFields: document.querySelector("#linearConfigFields"),
  liftCards: document.querySelector("#liftCards"),
  accessoryRowTemplate: document.querySelector("#accessoryRowTemplate"),
  dayAssignments: document.querySelector("#dayAssignments"),
  startDateLabel: document.querySelector("#startDateLabel"),
  todayCard: document.querySelector("#todayCard"),
  calendarList: document.querySelector("#calendarList"),
  activePlanCard: document.querySelector("#activePlanCard"),
  plansQueuedCard: document.querySelector("#plansQueuedCard"),
  archivedPlansList: document.querySelector("#archivedPlansList"),
  historyList: document.querySelector("#historyList"),
  queuedCycleCard: document.querySelector("#queuedCycleCard"),
  cycleStatusLabel: document.querySelector("#cycleStatusLabel"),
  workoutPanelTitle: document.querySelector("#workoutPanelTitle"),
  setupPanel: document.querySelector("#setupPanel"),
  dashboardPanel: document.querySelector("#dashboardPanel"),
  historyPanel: document.querySelector("#historyPanel"),
  plansPanel: document.querySelector("#plansPanel"),
  liftCardTemplate: document.querySelector("#liftCardTemplate"),
  plateDialog: document.querySelector("#plateDialog"),
  plateDialogTitle: document.querySelector("#plateDialogTitle"),
  plateDialogBody: document.querySelector("#plateDialogBody"),
  closePlateDialogButton: document.querySelector("#closePlateDialogButton"),
  resetAppButton: document.querySelector("#resetAppButton"),
};

let state = loadState();
let setupDraftState = loadSetupDraft();
let currentView = "home";
let selectedWorkoutId = null;
let collapsedWeeks = new Set();
let collapsedWorkoutSections = new Set();

init();

function init() {
  renderSetupForm(setupDraftState);
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
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error("Failed to save state", error);
  }
}

function loadSetupDraft() {
  try {
    const raw = localStorage.getItem(SETUP_DRAFT_KEY);
    if (!raw) {
      return createEmptySetupDraft();
    }

    return normalizeSetupDraft(JSON.parse(raw));
  } catch (error) {
    console.error("Failed to load setup draft", error);
    return createEmptySetupDraft();
  }
}

function saveSetupDraft(draft = readSetupDraft()) {
  setupDraftState = normalizeSetupDraft(draft);

  try {
    localStorage.setItem(SETUP_DRAFT_KEY, JSON.stringify(setupDraftState));
  } catch (error) {
    console.error("Failed to save setup draft", error);
  }
}

function attachEvents() {
  elements.cycleForm.addEventListener("submit", handleCreateCycle);
  elements.closePlateDialogButton.addEventListener("click", () => elements.plateDialog.close());
  elements.resetAppButton.addEventListener("click", handleResetApp);
  elements.openSetupButton.addEventListener("click", () => setCurrentView("setup"));
  elements.openWorkoutButton.addEventListener("click", () => setCurrentView("workout"));
  elements.openPlansButton.addEventListener("click", () => setCurrentView("plans"));
  elements.homeButton.addEventListener("click", () => setCurrentView("home"));
  elements.plansButton.addEventListener("click", () => setCurrentView("plans"));
  elements.cycleForm.addEventListener("input", syncAssignmentLabels);
  elements.cycleForm.addEventListener("change", handleSetupFormChange);
  document.addEventListener("click", handleActionClick);
}

function renderSetupForm(draft = setupDraftState) {
  const normalizedDraft = normalizeSetupDraft(draft);
  setupDraftState = normalizedDraft;
  const blueprint = normalizeBlueprint(normalizedDraft.blueprint);
  const liftCount = normalizeLiftCount(normalizedDraft.liftCount);
  const linearSets = normalizePositiveInteger(normalizedDraft.linearSets, 5);
  const linearReps = normalizePositiveInteger(normalizedDraft.linearReps, 5);

  elements.startDateLabel.textContent = `Starts ${formatDate(getNextMonday(new Date()))}`;
  elements.cycleForm.elements.cycleName.value = normalizedDraft.cycleName || "";
  elements.cycleForm.elements.planBlueprint.value = blueprint;
  elements.cycleForm.elements.liftCount.value = String(liftCount);
  elements.cycleForm.elements.linearSets.value = String(linearSets);
  elements.cycleForm.elements.linearReps.value = String(linearReps);
  elements.linearConfigFields.classList.toggle("is-hidden", blueprint !== "linear");
  elements.liftCards.innerHTML = "";

  for (let index = 0; index < liftCount; index += 1) {
    const node = elements.liftCardTemplate.content.cloneNode(true);
    const card = node.querySelector(".lift-card");
    const liftDraft = normalizedDraft.lifts?.[index] || createEmptyLiftDraft();
    card.dataset.liftIndex = String(index);
    card.querySelector("h3").textContent = `Lift ${index + 1}`;
    card.querySelector(".muted").textContent =
      blueprint === "531"
        ? "Use however many you need. Repeated days share one training max."
        : "Linear progression uses the same weekly work sets for every assigned day.";

    const nameInput = card.querySelector('[data-field="name"]');
    const equipmentTypeInput = card.querySelector('[data-field="equipmentType"]');
    const tmInput = card.querySelector('[data-field="trainingMax"]');
    const incrementInput = card.querySelector('[data-field="increment"]');
    const accessoryList = card.querySelector("[data-accessory-list]");

    nameInput.name = `lift-${index}-name`;
    equipmentTypeInput.name = `lift-${index}-equipmentType`;
    tmInput.name = `lift-${index}-trainingMax`;
    incrementInput.name = `lift-${index}-increment`;
    nameInput.value = liftDraft.name || "";
    equipmentTypeInput.value = liftDraft.equipmentType || "barbell";
    tmInput.value = liftDraft.trainingMax || "";
    incrementInput.value = liftDraft.increment || "";

    accessoryList.innerHTML = "";
    (liftDraft.accessories || []).forEach((accessoryDraft, accessoryIndex) => {
      accessoryList.appendChild(createAccessoryRow(index, accessoryDraft, accessoryIndex));
    });

    elements.liftCards.appendChild(node);
  }

  elements.dayAssignments.innerHTML = "";

  WEEKDAY_ORDER.forEach((weekday) => {
    const wrapper = document.createElement("label");
    wrapper.className = "field";
    const options = Array.from({ length: liftCount }, (_, index) => {
      const selected = String(normalizedDraft.assignments?.[weekday] ?? "") === String(index) ? "selected" : "";
      return `<option value="${index}" ${selected}>Lift ${index + 1}</option>`;
    }).join("");
    wrapper.innerHTML = `
      <span>${weekday}</span>
      <select name="assignment-${weekday}" required>
        <option value="">Select a lift</option>
        ${options}
      </select>
    `;
    elements.dayAssignments.appendChild(wrapper);
  });

  syncAssignmentLabels();
}

function renderApp() {
  renderView();
  renderTodayCard();
  renderCalendar();
  renderActivePlanCard();
  renderPlansQueuedCard();
  renderArchivedPlansList();
  renderHistory();
  renderQueuedCycle();
}

function handleCreateCycle(event) {
  event.preventDefault();
  const cycle = buildCycleFromDraft(readSetupDraft());

  if (!cycle) {
    return;
  }

  state.activeCycle = cycle;
  state.queuedCycle = buildQueuedCycle(cycle);
  setupDraftState = createEmptySetupDraft();
  selectedWorkoutId = state.activeCycle.workouts[0]?.id || null;
  currentView = "workout";
  saveState();
  saveSetupDraft(setupDraftState);
  renderApp();
}

function handleResetApp() {
  const confirmed = window.confirm("Reset the stored app data for this browser?");
  if (!confirmed) {
    return;
  }

  state = createEmptyState();
  setupDraftState = createEmptySetupDraft();
  currentView = "home";
  selectedWorkoutId = null;
  saveState();
  saveSetupDraft(setupDraftState);
  elements.cycleForm.reset();
  renderSetupForm(setupDraftState);
  renderApp();
}

function handleSetupFormChange(event) {
  if (event.target.dataset.field === "accessoryProgressionType") {
    updateAccessoryRowVisibility(event.target.closest(".accessory-row"));
    saveSetupDraft();
    return;
  }

  if (
    event.target.name !== "planBlueprint" &&
    event.target.name !== "liftCount" &&
    event.target.name !== "linearSets" &&
    event.target.name !== "linearReps"
  ) {
    saveSetupDraft();
    return;
  }

  const nextDraft = readSetupDraft();
  saveSetupDraft(nextDraft);
  renderSetupForm(nextDraft);
}

function handleActionClick(event) {
  const actionTarget = event.target.closest("[data-action]");
  if (!actionTarget) {
    return;
  }

  const { action, workoutId, setIndex, accessoryIndex, accessorySetIndex, cycleType, cycleId } = actionTarget.dataset;

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

  if (action === "delete-active-cycle") {
    deleteActiveCycle();
  }

  if (action === "save-training-max") {
    updateTrainingMax(actionTarget.dataset.liftId);
  }

  if (action === "delete-queued-cycle") {
    deleteQueuedCycle();
  }

  if (action === "delete-archived-cycle") {
    deleteArchivedCycle(cycleId);
  }

  if (action === "view-plan-workouts") {
    openPlanWorkouts(cycleType, cycleId);
  }

  if (action === "open-workout") {
    selectedWorkoutId = selectedWorkoutId === workoutId ? null : workoutId;
    currentView = "workout";
    renderApp();
  }

  if (action === "toggle-week") {
    toggleWeekCollapse(actionTarget.dataset.weekKey);
  }

  if (action === "toggle-section") {
    toggleWorkoutSection(actionTarget.dataset.sectionKey);
  }

  if (action === "add-accessory") {
    addAccessoryRow(actionTarget.closest(".lift-card"));
  }

  if (action === "remove-accessory") {
    removeAccessoryRow(actionTarget.closest(".accessory-row"));
  }

  if (action === "activate-queued" && cycleType === "queued") {
    activateQueuedCycle();
  }
}

function renderView() {
  const hasActiveCycle = Boolean(state.activeCycle);
  const showHome = currentView === "home";
  const showSetup = currentView === "setup";
  const showWorkout = currentView === "workout";
  const showPlans = currentView === "plans";

  elements.homePanel.classList.toggle("is-hidden", !showHome);
  elements.setupPanel.classList.toggle("is-hidden", !showSetup);
  elements.dashboardPanel.classList.toggle("is-hidden", !showWorkout);
  elements.historyPanel.classList.toggle("is-hidden", !showWorkout);
  elements.plansPanel.classList.toggle("is-hidden", !showPlans);

  elements.openWorkoutButton.disabled = !hasActiveCycle;
  elements.openPlansButton.disabled = !hasActiveCycle && !state.queuedCycle && state.archivedCycles.length === 0;
  elements.homeButton.disabled = showHome;
  elements.plansButton.disabled = showPlans;
  elements.homePanelNote.textContent = hasActiveCycle
    ? `${state.activeCycle.name} is ready to open.`
    : "No active cycle yet. Start with setup.";
}

function setCurrentView(nextView) {
  if (nextView === "workout" && !state.activeCycle) {
    currentView = "setup";
    renderApp();
    return;
  }

  if (
    nextView === "plans" &&
    !state.activeCycle &&
    !state.queuedCycle &&
    state.archivedCycles.length === 0
  ) {
    currentView = "setup";
    renderApp();
    return;
  }

  currentView = nextView;
  renderApp();
}

function buildCycleFromDraft(draft) {
  const blueprint = normalizeBlueprint(draft.blueprint);
  const liftCount = normalizeLiftCount(draft.liftCount);
  const linearConfig = {
    sets: normalizePositiveInteger(draft.linearSets, 5),
    reps: normalizePositiveInteger(draft.linearReps, 5),
  };
  const lifts = [];

  for (let index = 0; index < liftCount; index += 1) {
    const liftDraft = draft.lifts[index] || createEmptyLiftDraft();
    const name = String(liftDraft.name || "").trim();
    const equipmentType = String(liftDraft.equipmentType || "barbell");
    const tmRaw = String(liftDraft.trainingMax || "").trim();
    const incrementRaw = String(liftDraft.increment || "").trim();

    if (!name && !tmRaw && !incrementRaw) {
      continue;
    }

    if (!name || !tmRaw || !incrementRaw) {
      window.alert(`Lift ${index + 1} is incomplete.`);
      return null;
    }

    const accessories = (liftDraft.accessories || []).map((accessoryDraft) => ({
      id: `accessory-${crypto.randomUUID()}`,
      name: String(accessoryDraft.name || "").trim(),
      sets: Number(accessoryDraft.sets || 0),
      reps: Number(accessoryDraft.reps || 0),
      weight: String(accessoryDraft.weight || "").trim(),
      progressionType: normalizeAccessoryProgressionType(accessoryDraft.progressionType),
      progression: {
        targetSets: Number(accessoryDraft.sets || 0),
        targetReps: Number(accessoryDraft.reps || 0),
        increment: normalizePositiveInteger(accessoryDraft.increment, 5),
        amrapThreshold: normalizePositiveInteger(accessoryDraft.amrapThreshold, 2),
      },
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
    const slotIndex = Number(draft.assignments?.[weekday]);
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

  const cycleName = String(draft.cycleName || "").trim();
  const startDate = getNextMonday(new Date());
  const cycle = {
    id: `cycle-${crypto.randomUUID()}`,
    name: cycleName,
    blueprint,
    liftCount,
    linearConfig,
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
  const existingByKey = new Map(
    (cycle.workouts || []).map((workout) => [getWorkoutIdentityKey(workout), workout]),
  );
  const linearWeightByLiftId = new Map(
    (cycle.lifts || []).map((lift) => [lift.id, lift.trainingMax]),
  );

  for (let weekNumber = 1; weekNumber <= 4; weekNumber += 1) {
    const weeklyDates = buildWeekDates(cycle.startDate, weekNumber);
    const liftCounts = new Map();

    cycle.dayAssignments.forEach((assignment, dayIndex) => {
      const count = (liftCounts.get(assignment.liftId) || 0) + 1;
      liftCounts.set(assignment.liftId, count);

      const lift = cycle.lifts.find((entry) => entry.id === assignment.liftId);
      const workoutType = cycle.blueprint === "linear" ? "linear" : count === 1 ? "primary" : "secondary";
      const date = weeklyDates[assignment.weekday];
      const workoutKey = getWorkoutIdentityKey({
        weekNumber,
        dayIndex,
        liftId: assignment.liftId,
      });
      const existingWorkout = existingByKey.get(workoutKey);
      const linearWeight = linearWeightByLiftId.get(assignment.liftId) || lift.trainingMax;

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
        type: workoutType,
        blueprint: cycle.blueprint,
        mainSets: buildMainSets(
          cycle.blueprint === "linear" ? linearWeight : lift.trainingMax,
          weekNumber,
          workoutType,
          cycle.blueprint,
          cycle.linearConfig,
        ),
        accessorySets: buildAccessorySets(lift.accessories),
        status: "pending",
      });

      if (cycle.blueprint === "linear" && existingWorkout?.status === "completed" && didHitMainTargets(existingWorkout)) {
        linearWeightByLiftId.set(assignment.liftId, linearWeight + lift.increment);
      }
    });
  }

  return workouts.sort((left, right) => left.date.localeCompare(right.date));
}

function buildWeekDates(startDateIso, weekNumber) {
  const weekStart = parseStoredDate(startDateIso);
  weekStart.setDate(weekStart.getDate() + (weekNumber - 1) * 7);

  return {
    Mon: toIsoDate(weekStart),
    Tue: toIsoDate(addDays(weekStart, 1)),
    Thu: toIsoDate(addDays(weekStart, 3)),
    Fri: toIsoDate(addDays(weekStart, 4)),
  };
}

function buildMainSets(trainingMax, weekNumber, workoutType, blueprint, linearConfig) {
  if (blueprint === "linear") {
    const sets = normalizePositiveInteger(linearConfig?.sets, 5);
    const reps = normalizePositiveInteger(linearConfig?.reps, 5);
    return Array.from({ length: sets }, (_, index) => ({
      index,
      label: `${sets} x ${reps}`,
      targetWeight: roundToNearestFive(trainingMax),
      targetReps: reps,
      amrap: false,
      loggedReps: null,
    }));
  }

  if (workoutType === "primary") {
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
      id: accessory.id,
      name: accessory.name,
      weight: accessory.weight,
      progressionType: accessory.progressionType,
      progression: accessory.progression,
      sets: Array.from({ length: accessory.sets }, (_, index) => ({
        index,
        targetReps: accessory.reps,
        amrap: accessory.progressionType === "double-reps" && index === accessory.sets - 1,
        loggedReps: null,
      })),
    }));
}

function buildQueuedCycle(activeCycle) {
  const lastWorkout = activeCycle.workouts[activeCycle.workouts.length - 1];
  const nextStartDate = getNextMondayOrSame(addDays(parseStoredDate(lastWorkout.date), 3));
  const queuedCycle = {
    id: `cycle-${crypto.randomUUID()}`,
    name: `${activeCycle.name} Next`,
    blueprint: activeCycle.blueprint,
    liftCount: activeCycle.liftCount,
    linearConfig: activeCycle.linearConfig,
    startDate: toIsoDate(nextStartDate),
    lifts: activeCycle.lifts.map((lift) => ({
      ...lift,
      id: `lift-${crypto.randomUUID()}`,
      trainingMax:
        activeCycle.blueprint === "linear"
          ? getNextLinearTrainingMax(activeCycle, lift)
          : lift.trainingMax + lift.increment,
      accessories: lift.accessories.map((accessory) => computeNextAccessoryConfig(activeCycle, lift, accessory)),
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

function regeneratePendingWorkouts(cycle) {
  const regenerated = generateWorkouts(cycle);
  const existingByKey = new Map(
    cycle.workouts.map((workout) => [getWorkoutIdentityKey(workout), workout]),
  );

  return regenerated.map((workout) => {
    const existing = existingByKey.get(getWorkoutIdentityKey(workout));
    if (!existing) {
      return workout;
    }

    if (existing.status === "pending") {
      return {
        ...workout,
        id: existing.id,
      };
    }

    return existing;
  });
}

function getWorkoutIdentityKey(workout) {
  return `${workout.weekNumber}-${workout.dayIndex}-${workout.liftId}`;
}

function renderTodayCard() {
  if (!state.activeCycle) {
    elements.todayCard.className = "card empty-state";
    elements.todayCard.innerHTML = "<p>No active cycle.</p>";
    elements.cycleStatusLabel.textContent = "Create your first 4-week block.";
    elements.workoutPanelTitle.textContent = "Workout Detail";
    return;
  }

  const todayIso = toIsoDate(new Date());
  const workout = getSelectedWorkout(todayIso);

  const completedCount = state.activeCycle.workouts.filter((entry) => entry.status === "completed").length;
  const totalCount = state.activeCycle.workouts.length;
  elements.cycleStatusLabel.textContent = `${state.activeCycle.name} • ${completedCount}/${totalCount} sessions completed`;
  elements.workoutPanelTitle.textContent = "Current Focus";

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
            <span class="badge">${workout.weekday}</span>
            <span class="badge">Week ${workout.weekNumber}</span>
            <span class="badge">${describeWorkoutType(workout)}</span>
            <span class="badge">${workout.equipmentType === "barbell" ? "Barbell" : "Non-barbell"}</span>
            <span class="badge">${workout.status}</span>
        </div>
        <h3>${workout.liftName}</h3>
        <p class="muted">Use the calendar below to expand any day inline.</p>
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

function renderMainSection(workout) {
  const sectionKey = `main-${workout.id}`;
  const isCollapsed = !collapsedWorkoutSections.has(sectionKey);

  return `
    <section class="workout-section workout-section-main">
      <button class="calendar-toggle" type="button" data-action="toggle-section" data-section-key="${sectionKey}">
        <div class="row-head">
          <div>
            <h4>Main Lift</h4>
            <p class="set-subtitle">${describeMainSetPreview(workout)}</p>
          </div>
          <span class="badge">${isCollapsed ? "Collapsed" : "Expanded"}</span>
        </div>
      </button>
      ${
        isCollapsed
          ? ""
          : `
        <section class="set-list">
          ${workout.mainSets.map((set, setIndex) => renderMainSet(workout, set, setIndex)).join("")}
        </section>
      `
      }
    </section>
  `;
}

function renderAccessoryBlock(workout, accessory, accessoryIndex) {
  const sectionKey = `accessory-${workout.id}-${accessory.id || accessoryIndex}`;
  const isCollapsed = !collapsedWorkoutSections.has(sectionKey);
  return `
    <article class="accessory-block workout-section workout-section-accessory">
      <button class="calendar-toggle" type="button" data-action="toggle-section" data-section-key="${sectionKey}">
        <div class="row-head">
          <div>
            <h4>${accessory.name}</h4>
            <p class="set-subtitle">${describeAccessoryPrescription(accessory)}</p>
          </div>
          <span class="badge">${isCollapsed ? "Collapsed" : "Expanded"}</span>
        </div>
      </button>
      ${
        isCollapsed
          ? ""
          : `
        <div class="set-list">
          ${accessory.sets
            .map(
              (set, accessorySetIndex) => `
              <div class="set-row">
                <div class="row-head">
                  <div>
                    <h4>Set ${accessorySetIndex + 1}${set.amrap ? " AMRAP" : ""}</h4>
                    <p class="set-subtitle">Target ${set.targetReps}${set.amrap ? "+" : ""} reps</p>
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
      `
      }
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
  const selectedId = state.activeCycle.workouts.some((workout) => workout.id === selectedWorkoutId)
    ? selectedWorkoutId
    : null;
  const groupedWorkouts = groupWorkoutsByWeek(state.activeCycle.workouts);
  elements.calendarList.className = "calendar-list";
  elements.calendarList.innerHTML = groupedWorkouts
    .map(({ weekNumber, workouts }) => {
      const weekKey = `week-${weekNumber}`;
      const isCollapsed = !collapsedWeeks.has(weekKey);
      return `
        <article class="history-group">
          <button class="calendar-toggle" type="button" data-action="toggle-week" data-week-key="${weekKey}">
            <div class="row-head">
              <div>
                <h3>Week ${weekNumber}</h3>
                <p class="set-subtitle">${workouts.length} workouts</p>
              </div>
              <span class="badge">${isCollapsed ? "Collapsed" : "Expanded"}</span>
            </div>
          </button>
          ${
            isCollapsed
              ? ""
              : `
            <div class="calendar-details">
              ${workouts
                .map((workout) => {
      const classes = ["calendar-row"];
      classes.push(`day-${workout.weekday.toLowerCase()}`);
      if (workout.date === todayIso) {
        classes.push("today");
      }
      if (workout.status === "completed") {
        classes.push("completed");
      }
      if (workout.status === "missed") {
        classes.push("missed");
      }
      if (workout.id === selectedId) {
        classes.push("selected");
      }

                  return `
                    <article class="${classes.join(" ")}">
                      <button class="calendar-toggle" type="button" data-action="open-workout" data-workout-id="${workout.id}">
                        <div class="calendar-meta">
                          <span>${formatDate(workout.date)}</span>
                          <span>Week ${workout.weekNumber}</span>
                        </div>
                        <div class="row-head">
                          <div>
                            <h3>${workout.liftName}</h3>
                            <p class="set-subtitle">${workout.weekday} • ${describeWorkoutDay(workout)} • ${describeMainSetPreview(workout)}</p>
                          </div>
                          <span class="badge">${workout.status}</span>
                        </div>
                      </button>
                      ${
                        workout.id === selectedId
                          ? `
                        <div class="calendar-details">
                          ${renderMainSection(workout)}
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
                      `
                          : ""
                      }
                    </article>
                  `;
                })
                .join("")}
            </div>
          `
          }
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
              <div class="history-meta">${formatDate(workout.date)} • Week ${workout.weekNumber} • ${describeWorkoutType(workout)}</div>
              <div>${summarizeLoggedReps(workout)}</div>
            </div>
          `)
          .join("")}
      </article>
    `)
    .join("");
}

function renderActivePlanCard() {
  if (!state.activeCycle) {
    elements.activePlanCard.className = "card empty-state";
    elements.activePlanCard.innerHTML = "<p>Create a cycle to manage the active plan.</p>";
    return;
  }

  const completedCount = state.activeCycle.workouts.filter((workout) => workout.status === "completed").length;
  const workoutCount = state.activeCycle.workouts.length;
  elements.activePlanCard.className = "card";
  elements.activePlanCard.innerHTML = renderPlanSummaryCard({
    cycle: state.activeCycle,
    note: `${describeBlueprintLabel(state.activeCycle.blueprint)} • Starts ${formatDate(state.activeCycle.startDate)}`,
    badges: [
      `${state.activeCycle.liftCount} lifts`,
      `${workoutCount} sessions`,
      `${completedCount} completed`,
    ],
    primaryAction: `<button class="secondary-button" type="button" data-action="view-plan-workouts" data-cycle-type="active">Open Workouts</button>`,
    dangerAction: `<button class="danger-button" type="button" data-action="delete-active-cycle">Delete Active Plan</button>`,
    liftSummary: renderTrainingMaxEditor(state.activeCycle),
  });
}

function renderPlansQueuedCard() {
  if (!state.queuedCycle) {
    elements.plansQueuedCard.className = "card empty-state";
    elements.plansQueuedCard.innerHTML = "<p>No queued plan.</p>";
    return;
  }

  elements.plansQueuedCard.className = "card";
  elements.plansQueuedCard.innerHTML = renderPlanSummaryCard({
    cycle: state.queuedCycle,
    note: `${describeBlueprintLabel(state.queuedCycle.blueprint)} • Starts ${formatDate(state.queuedCycle.startDate)}`,
    badges: [`${state.queuedCycle.liftCount} lifts`, `${state.queuedCycle.workouts.length} sessions`],
    primaryAction: `<button class="secondary-button" type="button" data-action="view-plan-workouts" data-cycle-type="queued">Preview Workouts</button>`,
    dangerAction: `<button class="danger-button" type="button" data-action="delete-queued-cycle">Delete Queued Plan</button>`,
    liftSummary: state.queuedCycle.lifts.map((lift) => `${lift.name} ${lift.trainingMax} lb`).join(" • "),
  });
}

function renderArchivedPlansList() {
  if (!state.archivedCycles.length) {
    elements.archivedPlansList.className = "history-list empty-state";
    elements.archivedPlansList.innerHTML = "<p>No archived plans.</p>";
    return;
  }

  elements.archivedPlansList.className = "history-list";
  elements.archivedPlansList.innerHTML = state.archivedCycles
    .slice()
    .sort((left, right) => right.startDate.localeCompare(left.startDate))
    .map((cycle) => `
      <article class="history-group">
        ${renderPlanSummaryCard({
          cycle,
          note: `${describeBlueprintLabel(cycle.blueprint)} • Started ${formatDate(cycle.startDate)}`,
          badges: [
            `${cycle.liftCount} lifts`,
            `${cycle.workouts.length} sessions`,
            `${cycle.workouts.filter((workout) => workout.status === "completed").length} completed`,
          ],
          primaryAction: `<button class="secondary-button" type="button" data-action="view-plan-workouts" data-cycle-type="archived" data-cycle-id="${cycle.id}">View Summary</button>`,
          dangerAction: `<button class="danger-button" type="button" data-action="delete-archived-cycle" data-cycle-id="${cycle.id}">Delete Archived Plan</button>`,
          liftSummary: cycle.lifts.map((lift) => `${lift.name} ${lift.trainingMax} lb`).join(" • "),
        })}
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
  if (state.activeCycle.blueprint === "linear") {
    state.activeCycle.workouts = regeneratePendingWorkouts(state.activeCycle);
  }
  if (state.queuedCycle) {
    state.queuedCycle = buildQueuedCycle(state.activeCycle);
  }
  saveState();
  renderApp();
}

function updateTrainingMax(liftId) {
  if (!state.activeCycle) {
    return;
  }

  const lift = state.activeCycle.lifts.find((entry) => entry.id === liftId);
  if (!lift) {
    return;
  }

  const input = document.querySelector(`#training-max-${liftId}`);
  const parsed = Number(input?.value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    window.alert("Enter a valid training max.");
    return;
  }

  lift.trainingMax = parsed;
  state.activeCycle.workouts = regeneratePendingWorkouts(state.activeCycle);
  if (state.queuedCycle) {
    state.queuedCycle = buildQueuedCycle(state.activeCycle);
  }
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

function didHitMainTargets(workout) {
  return (workout.mainSets || []).length > 0 &&
    workout.mainSets.every((set) => Number.isFinite(set.loggedReps) && set.loggedReps >= set.targetReps);
}

function getNextLinearTrainingMax(activeCycle, lift) {
  return activeCycle.workouts
    .filter((workout) => workout.liftId === lift.id)
    .sort((left, right) => left.date.localeCompare(right.date))
    .reduce((weight, workout) => (
      workout.status === "completed" && didHitMainTargets(workout)
        ? weight + lift.increment
        : weight
    ), lift.trainingMax);
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
  if (state.activeCycle.blueprint === "linear") {
    state.activeCycle.workouts = regeneratePendingWorkouts(state.activeCycle);
  }
  if (state.queuedCycle) {
    state.queuedCycle = buildQueuedCycle(state.activeCycle);
  }
  saveState();
  renderApp();
}

function deleteActiveCycle() {
  if (!state.activeCycle) {
    return;
  }

  const confirmed = window.confirm(`Delete the active plan "${state.activeCycle.name}" and its queued next block?`);
  if (!confirmed) {
    return;
  }

  state.activeCycle = null;
  state.queuedCycle = null;
  selectedWorkoutId = null;
  saveState();
  renderApp();
}

function deleteQueuedCycle() {
  if (!state.queuedCycle) {
    return;
  }

  const confirmed = window.confirm(`Delete queued plan "${state.queuedCycle.name}"?`);
  if (!confirmed) {
    return;
  }

  state.queuedCycle = null;
  saveState();
  renderApp();
}

function deleteArchivedCycle(cycleId) {
  const cycle = state.archivedCycles.find((entry) => entry.id === cycleId);
  if (!cycle) {
    return;
  }

  const confirmed = window.confirm(`Delete archived plan "${cycle.name}"?`);
  if (!confirmed) {
    return;
  }

  state.archivedCycles = state.archivedCycles.filter((entry) => entry.id !== cycleId);
  saveState();
  renderApp();
}

function computeNextAccessoryConfig(activeCycle, lift, accessory) {
  const normalizedAccessory = normalizeLiftAccessory(accessory, 0);
  if (!normalizedAccessory.name || normalizedAccessory.sets <= 0 || normalizedAccessory.reps <= 0) {
    return normalizedAccessory;
  }

  const latestWorkout = [...activeCycle.workouts]
    .filter((workout) => workout.liftId === lift.id && workout.status === "completed")
    .sort((left, right) => right.date.localeCompare(left.date))[0];

  if (!latestWorkout) {
    return normalizedAccessory;
  }

  const performedAccessory = latestWorkout.accessorySets.find(
    (entry) => entry.id === normalizedAccessory.id || entry.name === normalizedAccessory.name,
  );
  if (!performedAccessory) {
    return normalizedAccessory;
  }

  if (normalizedAccessory.progressionType === "double-reps") {
    return advanceDoubleProgression(normalizedAccessory, performedAccessory);
  }

  if (normalizedAccessory.progressionType === "double-sets") {
    return advanceDoubleSetProgression(normalizedAccessory, performedAccessory);
  }

  return normalizedAccessory;
}

function advanceDoubleProgression(accessory, performedAccessory) {
  const targetReps = normalizePositiveInteger(accessory.progression?.targetReps, accessory.reps);
  const targetSets = normalizePositiveInteger(accessory.progression?.targetSets, accessory.sets);
  const minReps = normalizePositiveInteger(accessory.progression?.minReps, Math.max(targetReps - 2, 1));
  const currentReps = normalizePositiveInteger(accessory.reps, targetReps);
  const increment = normalizePositiveInteger(accessory.progression?.increment, 5);
  const threshold = normalizePositiveInteger(accessory.progression?.amrapThreshold, 2);
  const loggedReps = performedAccessory.sets.map((set) => normalizePositiveInteger(set.loggedReps, 0));
  const lastSetOverage = Math.max(0, (loggedReps[loggedReps.length - 1] || 0) - currentReps);
  const jumps = Math.floor(lastSetOverage / threshold);

  if (!loggedReps.length || loggedReps.some((reps) => reps <= 0)) {
    return accessory;
  }

  if (currentReps >= targetReps && jumps > 0) {
    return {
      ...accessory,
      reps: minReps,
      weight: increaseWeight(accessory.weight, jumps * increment),
      progression: {
        ...accessory.progression,
        minReps,
        targetReps,
        targetSets,
        increment,
        amrapThreshold: threshold,
      },
    };
  }

  if (loggedReps.every((reps) => reps >= currentReps) && currentReps < targetReps) {
    return {
      ...accessory,
      reps: currentReps + 1,
      progression: {
        ...accessory.progression,
        minReps,
        targetReps,
        targetSets,
        increment,
        amrapThreshold: threshold,
      },
    };
  }

  return {
    ...accessory,
    progression: {
      ...accessory.progression,
      minReps,
      targetReps,
      targetSets,
      increment,
      amrapThreshold: threshold,
    },
  };
}

function advanceDoubleSetProgression(accessory, performedAccessory) {
  const targetSets = normalizePositiveInteger(accessory.progression?.targetSets, accessory.sets);
  const targetReps = normalizePositiveInteger(accessory.progression?.targetReps, accessory.reps);
  const minSets = normalizePositiveInteger(accessory.progression?.minSets, Math.max(targetSets - 1, 1));
  const currentSets = normalizePositiveInteger(accessory.sets, targetSets);
  const allSetsHitTarget = performedAccessory.sets.every(
    (set) => normalizePositiveInteger(set.loggedReps, 0) >= targetReps,
  );

  if (!performedAccessory.sets.length || !allSetsHitTarget) {
    return accessory;
  }

  if (currentSets < targetSets) {
    return {
      ...accessory,
      sets: currentSets + 1,
      progression: {
        ...accessory.progression,
        minSets,
        targetSets,
        targetReps,
      },
    };
  }

  return {
    ...accessory,
    sets: minSets,
    weight: increaseWeight(accessory.weight, normalizePositiveInteger(accessory.progression?.increment, 5)),
    progression: {
      ...accessory.progression,
      minSets,
      targetSets,
      targetReps,
    },
  };
}

function openPlanWorkouts(cycleType, cycleId) {
  if (cycleType === "active" && state.activeCycle) {
    currentView = "workout";
    selectedWorkoutId = state.activeCycle.workouts[0]?.id || null;
    renderApp();
    return;
  }

  const cycle =
    cycleType === "queued"
      ? state.queuedCycle
      : state.archivedCycles.find((entry) => entry.id === cycleId);

  if (!cycle) {
    return;
  }

  const liftSummary = cycle.lifts.map((lift) => `${lift.name} ${lift.trainingMax} lb`).join(" • ");
  const completedCount = cycle.workouts.filter((workout) => workout.status === "completed").length;
  window.alert(
    [
      cycle.name,
      `${describeBlueprintLabel(cycle.blueprint)} • Starts ${formatDate(cycle.startDate)}`,
      `${cycle.liftCount} lifts • ${cycle.workouts.length} sessions • ${completedCount} completed`,
      "",
      liftSummary,
    ].join("\n"),
  );
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
  selectedWorkoutId = state.activeCycle.workouts[0]?.id || null;
  saveState();
  renderApp();
}

function getSelectedWorkout(todayIso) {
  if (!state.activeCycle) {
    return null;
  }

  const selectedWorkout = state.activeCycle.workouts.find((workout) => workout.id === selectedWorkoutId);
  if (selectedWorkout) {
    return selectedWorkout;
  }

  const todaysWorkout = state.activeCycle.workouts.find((workout) => workout.date === todayIso);
  const nextWorkout = state.activeCycle.workouts.find(
    (workout) => workout.status === "pending" && workout.date >= todayIso,
  );
  const fallbackWorkout = todaysWorkout || nextWorkout || state.activeCycle.workouts[0] || null;
  return fallbackWorkout;
}

function summarizeLoggedReps(workout) {
  const mainSummary = workout.mainSets.map((set) => `${set.targetWeight}x${set.loggedReps ?? "-"}`).join(", ");
  const accessorySummary = workout.accessorySets
    .map((accessory) => `${accessory.name}: ${accessory.sets.map((set) => set.loggedReps ?? "-").join("/")}`)
    .join(" • ");

  return accessorySummary ? `${mainSummary} • ${accessorySummary}` : mainSummary;
}

function createAccessoryRow(liftIndex, accessoryDraft = createEmptyAccessoryDraft(), forcedIndex = null) {
  const node = elements.accessoryRowTemplate.content.cloneNode(true);
  const row = node.querySelector(".accessory-row");
  const accessoryIndex = forcedIndex ?? (
    elements.liftCards.querySelector(`.lift-card[data-lift-index="${liftIndex}"] [data-accessory-list]`)
      ?.querySelectorAll(".accessory-row").length ?? 0
  );

  row.dataset.accessoryIndex = String(accessoryIndex);
  row.querySelector("h4").textContent = `Accessory ${accessoryIndex + 1}`;

  const select = row.querySelector('[data-field="accessoryProgressionType"]');
  select.name = `lift-${liftIndex}-acc-${accessoryIndex}-accessoryProgressionType`;
  select.value = accessoryDraft.progressionType || "fixed";

  const fieldValues = {
    accessoryName: accessoryDraft.name || "",
    accessorySets: accessoryDraft.sets || "",
    accessoryReps: accessoryDraft.reps || "",
    accessoryWeight: accessoryDraft.weight || "",
    accessoryIncrement: accessoryDraft.increment || "5",
    accessoryAmrapThreshold: accessoryDraft.amrapThreshold || "2",
  };

  row.querySelectorAll("input").forEach((input) => {
    input.name = `lift-${liftIndex}-acc-${accessoryIndex}-${input.dataset.field}`;
    input.value = fieldValues[input.dataset.field] || "";
  });

  updateAccessoryRowVisibility(row);
  return node;
}

function addAccessoryRow(liftCard) {
  if (!liftCard) {
    return;
  }

  const liftIndex = Number(liftCard.dataset.liftIndex);
  const list = liftCard.querySelector("[data-accessory-list]");
  list.appendChild(createAccessoryRow(liftIndex));
  saveSetupDraft();
}

function removeAccessoryRow(accessoryRow) {
  if (!accessoryRow) {
    return;
  }

  const list = accessoryRow.parentElement;
  const liftCard = accessoryRow.closest(".lift-card");
  accessoryRow.remove();
  renumberAccessoryRows(liftCard, list);
  saveSetupDraft();
}

function renumberAccessoryRows(liftCard, list) {
  const liftIndex = Number(liftCard.dataset.liftIndex);
  [...list.querySelectorAll(".accessory-row")].forEach((row, accessoryIndex) => {
    row.dataset.accessoryIndex = String(accessoryIndex);
    row.querySelector("h4").textContent = `Accessory ${accessoryIndex + 1}`;
    row.querySelectorAll("input, select").forEach((field) => {
      field.name = `lift-${liftIndex}-acc-${accessoryIndex}-${field.dataset.field}`;
    });
  });
}

function updateAccessoryRowVisibility(accessoryRow) {
  if (!accessoryRow) {
    return;
  }

  const progressionType =
    accessoryRow.querySelector('[data-field="accessoryProgressionType"]')?.value || "fixed";
  const incrementField = accessoryRow.querySelector("[data-accessory-increment-field]");
  const thresholdField = accessoryRow.querySelector("[data-accessory-threshold-field]");

  if (incrementField) {
    incrementField.classList.toggle("is-hidden", progressionType === "fixed");
  }

  if (thresholdField) {
    thresholdField.classList.toggle("is-hidden", progressionType !== "double-reps");
  }
}

function toggleWeekCollapse(weekKey) {
  if (!weekKey) {
    return;
  }

  if (collapsedWeeks.has(weekKey)) {
    collapsedWeeks.delete(weekKey);
  } else {
    collapsedWeeks.add(weekKey);
  }

  renderApp();
}

function toggleWorkoutSection(sectionKey) {
  if (!sectionKey) {
    return;
  }

  if (collapsedWorkoutSections.has(sectionKey)) {
    collapsedWorkoutSections.delete(sectionKey);
  } else {
    collapsedWorkoutSections.add(sectionKey);
  }

  renderApp();
}

function groupWorkoutsByWeek(workouts) {
  const grouped = new Map();

  workouts.forEach((workout) => {
    const entries = grouped.get(workout.weekNumber) || [];
    entries.push(workout);
    grouped.set(workout.weekNumber, entries);
  });

  return [...grouped.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([weekNumber, weekWorkouts]) => ({ weekNumber, workouts: weekWorkouts }));
}

function syncAssignmentLabels() {
  elements.liftCards.querySelectorAll(".lift-card").forEach((card) => {
    const index = Number(card.dataset.liftIndex);
    const nameInput = card.querySelector(`input[name="lift-${index}-name"]`);
    const label = nameInput?.value.trim() || `Lift ${index + 1}`;
    elements.dayAssignments.querySelectorAll(`option[value="${index}"]`).forEach((option) => {
      option.textContent = label;
    });
  });
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
    activeCycle: normalizeCycle(rawState?.activeCycle),
    queuedCycle: normalizeCycle(rawState?.queuedCycle),
    archivedCycles: Array.isArray(rawState?.archivedCycles)
      ? rawState.archivedCycles.map((cycle) => normalizeCycle(cycle)).filter(Boolean)
      : [],
  };
}

function normalizeSetupDraft(draft) {
  const normalized = draft || {};
  const liftCount = normalizeLiftCount(normalized.liftCount);

  return {
    cycleName: String(normalized.cycleName || ""),
    blueprint: normalizeBlueprint(normalized.blueprint),
    liftCount,
    linearSets: normalizePositiveInteger(normalized.linearSets, 5),
    linearReps: normalizePositiveInteger(normalized.linearReps, 5),
    lifts: Array.from({ length: 4 }, (_, index) => {
      const lift = normalized.lifts?.[index] || createEmptyLiftDraft();
      return {
        name: String(lift.name || ""),
        equipmentType: lift.equipmentType || "barbell",
        trainingMax: lift.trainingMax || "",
        increment: lift.increment || "",
        accessories: Array.isArray(lift.accessories)
          ? lift.accessories.map((accessory) => ({
            name: String(accessory.name || ""),
            progressionType: normalizeAccessoryProgressionType(accessory.progressionType),
            sets: accessory.sets || "",
            reps: accessory.reps || "",
            weight: accessory.weight || "",
            increment: accessory.increment || "5",
            amrapThreshold: accessory.amrapThreshold || "2",
          }))
          : [],
      };
    }),
    assignments: Object.fromEntries(
      WEEKDAY_ORDER.map((weekday) => [weekday, String(normalized.assignments?.[weekday] ?? "")]),
    ),
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
    blueprint: normalizeBlueprint(cycle.blueprint),
    liftCount: normalizeLiftCount(cycle.liftCount || cycle.lifts?.length),
    linearConfig: normalizeLinearConfig(cycle.linearConfig),
    lifts: (cycle.lifts || []).map((lift) => normalizeLift(lift)),
    workouts: (cycle.workouts || []).map((workout) => ({
      ...workout,
      blueprint: normalizeBlueprint(workout.blueprint || cycle.blueprint),
      accessorySets: (workout.accessorySets || []).map((accessory, index) =>
        normalizeWorkoutAccessory(accessory, index),
      ),
      equipmentType: workout.equipmentType || equipmentByLiftId.get(workout.liftId) || "barbell",
    })),
  };
}

function readSetupDraft() {
  const form = elements.cycleForm;
  const blueprint = normalizeBlueprint(form.elements.planBlueprint?.value);
  const liftCount = normalizeLiftCount(form.elements.liftCount?.value);
  const liftCards = [...elements.liftCards.querySelectorAll(".lift-card")];

  return {
    cycleName: form.elements.cycleName?.value || "",
    blueprint,
    liftCount,
    linearSets: form.elements.linearSets?.value || "5",
    linearReps: form.elements.linearReps?.value || "5",
    lifts: Array.from({ length: 4 }, (_, index) => {
      const card = liftCards.find((entry) => Number(entry.dataset.liftIndex) === index);
      if (!card) {
        return createEmptyLiftDraft();
      }

      return {
        name: card.querySelector(`input[name="lift-${index}-name"]`)?.value || "",
        equipmentType: card.querySelector(`select[name="lift-${index}-equipmentType"]`)?.value || "barbell",
        trainingMax: card.querySelector(`input[name="lift-${index}-trainingMax"]`)?.value || "",
        increment: card.querySelector(`input[name="lift-${index}-increment"]`)?.value || "",
        accessories: [...card.querySelectorAll(".accessory-row")].map((row, accessoryIndex) => ({
          name: row.querySelector(`input[name="lift-${index}-acc-${accessoryIndex}-accessoryName"]`)?.value || "",
          progressionType:
            row.querySelector(`select[name="lift-${index}-acc-${accessoryIndex}-accessoryProgressionType"]`)?.value ||
            "fixed",
          sets: row.querySelector(`input[name="lift-${index}-acc-${accessoryIndex}-accessorySets"]`)?.value || "",
          reps: row.querySelector(`input[name="lift-${index}-acc-${accessoryIndex}-accessoryReps"]`)?.value || "",
          weight: row.querySelector(`input[name="lift-${index}-acc-${accessoryIndex}-accessoryWeight"]`)?.value || "",
          increment:
            row.querySelector(`input[name="lift-${index}-acc-${accessoryIndex}-accessoryIncrement"]`)?.value || "5",
          amrapThreshold:
            row.querySelector(`input[name="lift-${index}-acc-${accessoryIndex}-accessoryAmrapThreshold"]`)?.value ||
            "2",
        })),
      };
    }),
    assignments: Object.fromEntries(
      WEEKDAY_ORDER.map((weekday) => [weekday, form.elements[`assignment-${weekday}`]?.value || ""]),
    ),
  };
}

function createEmptyLiftDraft() {
  return {
    name: "",
    equipmentType: "barbell",
    trainingMax: "",
    increment: "",
    accessories: [],
  };
}

function createEmptyAccessoryDraft() {
  return {
    name: "",
    progressionType: "fixed",
    sets: "",
    reps: "",
    weight: "",
    increment: "5",
    amrapThreshold: "2",
  };
}

function createEmptySetupDraft() {
  return {
    cycleName: "",
    blueprint: "531",
    liftCount: 2,
    linearSets: 5,
    linearReps: 5,
    lifts: Array.from({ length: 4 }, () => createEmptyLiftDraft()),
    assignments: Object.fromEntries(WEEKDAY_ORDER.map((weekday) => [weekday, ""])),
  };
}

function normalizeLiftCount(value) {
  return Number(value) === 4 ? 4 : 2;
}

function normalizeBlueprint(value) {
  return value === "linear" ? "linear" : "531";
}

function normalizeAccessoryProgressionType(value) {
  if (value === "double-reps" || value === "double-sets") {
    return value;
  }

  if (value === "double" || value === "amrap") {
    return "double-reps";
  }

  if (value === "double progression (reps)" || value === "double progression (sets)") {
    return value.includes("sets") ? "double-sets" : "double-reps";
  }

  return "fixed";
}

function normalizeLift(lift) {
  return {
    ...lift,
    equipmentType: lift.equipmentType || "barbell",
    accessories: (lift.accessories || []).map((accessory, index) => normalizeLiftAccessory(accessory, index)),
  };
}

function normalizeLiftAccessory(accessory, index) {
  const normalizedReps = normalizePositiveInteger(accessory.reps, 0);
  return {
    ...accessory,
    id: accessory.id || `accessory-${index + 1}`,
    progressionType: normalizeAccessoryProgressionType(accessory.progressionType),
    progression: {
      minReps: normalizePositiveInteger(accessory.progression?.minReps, normalizedReps),
      minSets: normalizePositiveInteger(accessory.progression?.minSets, accessory.sets),
      targetSets: normalizePositiveInteger(accessory.progression?.targetSets, accessory.sets),
      targetReps: normalizePositiveInteger(accessory.progression?.targetReps, normalizedReps),
      increment: normalizePositiveInteger(accessory.progression?.increment, 5),
      amrapThreshold: normalizePositiveInteger(accessory.progression?.amrapThreshold, 2),
    },
  };
}

function normalizeWorkoutAccessory(accessory, index) {
  return {
    ...accessory,
    id: accessory.id || `accessory-${index + 1}`,
    progressionType: normalizeAccessoryProgressionType(accessory.progressionType),
    progression: {
      minReps: normalizePositiveInteger(accessory.progression?.minReps, accessory.sets?.[0]?.targetReps || 0),
      minSets: normalizePositiveInteger(accessory.progression?.minSets, accessory.sets?.length || 0),
      targetSets: normalizePositiveInteger(accessory.progression?.targetSets, accessory.sets?.length || 0),
      targetReps: normalizePositiveInteger(accessory.progression?.targetReps, accessory.sets?.[0]?.targetReps || 0),
      increment: normalizePositiveInteger(accessory.progression?.increment, 5),
      amrapThreshold: normalizePositiveInteger(accessory.progression?.amrapThreshold, 2),
    },
    sets: (accessory.sets || []).map((set, setIndex, allSets) => ({
      ...set,
      amrap: Boolean(set.amrap) || (
        normalizeAccessoryProgressionType(accessory.progressionType) === "double-reps" &&
        setIndex === allSets.length - 1
      ),
    })),
  };
}

function normalizePositiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeLinearConfig(config) {
  return {
    sets: normalizePositiveInteger(config?.sets, 5),
    reps: normalizePositiveInteger(config?.reps, 5),
  };
}

function increaseWeight(weight, amount) {
  if (!weight) {
    return String(amount);
  }

  const match = String(weight).trim().match(/^(-?\d+(?:\.\d+)?)(.*)$/);
  if (!match) {
    return weight;
  }

  const nextValue = Number(match[1]) + amount;
  const suffix = match[2] || "";
  return `${Number.isInteger(nextValue) ? nextValue : nextValue.toFixed(1)}${suffix}`;
}

function describeWorkoutType(workout) {
  if ((workout.blueprint || "531") === "linear" || workout.type === "linear") {
    const sets = normalizePositiveInteger(workout.linearConfig?.sets, workout.mainSets?.length || 5);
    const reps = normalizePositiveInteger(workout.linearConfig?.reps, workout.mainSets?.[0]?.targetReps || 5);
    return `Linear ${sets}x${reps}`;
  }

  return workout.type === "primary" ? "Primary 5/3/1" : "Secondary 4x10";
}

function describeWorkoutDay(workout) {
  if ((workout.blueprint || "531") === "linear" || workout.type === "linear") {
    return "Linear day";
  }

  return workout.type === "primary" ? "Primary 5/3/1 day" : "Secondary 4x10 @ 60%";
}

function describeBlueprintLabel(blueprint) {
  return normalizeBlueprint(blueprint) === "linear" ? "Linear" : "5/3/1";
}

function describeAccessoryPrescription(accessory) {
  const weightSuffix = accessory.weight ? ` • ${accessory.weight} lb` : "";

  if (accessory.progressionType === "double-reps") {
    const targetReps = normalizePositiveInteger(accessory.progression?.targetReps, accessory.sets[0]?.targetReps || 0);
    const threshold = normalizePositiveInteger(accessory.progression?.amrapThreshold, 2);
    const increment = normalizePositiveInteger(accessory.progression?.increment, 5);
    const repRange =
      targetReps > (accessory.sets[0]?.targetReps || 0)
        ? `${accessory.sets[0]?.targetReps ?? ""}/${targetReps} reps`
        : `${accessory.sets[0]?.targetReps ?? ""} reps`;
    return `${accessory.sets.length} sets x ${repRange}, last set AMRAP${weightSuffix} • +${increment} lb / ${threshold} over`;
  }

  if (accessory.progressionType === "double-sets") {
    const targetSets = normalizePositiveInteger(accessory.progression?.targetSets, accessory.sets.length);
    const increment = normalizePositiveInteger(accessory.progression?.increment, 5);
    return `${accessory.sets.length}/${targetSets} sets x ${accessory.sets[0]?.targetReps ?? ""} reps${weightSuffix} • +${increment} lb when full target is hit`;
  }

  return `${accessory.sets.length} sets x ${accessory.sets[0]?.targetReps ?? ""} reps${weightSuffix}`;
}

function renderPlanSummaryCard({ cycle, note, badges, primaryAction, dangerAction, liftSummary }) {
  return `
    <div class="queued-cycle">
      <div>
        <h3>${cycle.name}</h3>
        <p class="queued-meta">${note}</p>
      </div>
      <div class="plan-summary-body">${liftSummary}</div>
      <div class="badge-row">
        ${badges.map((badge) => `<span class="badge">${badge}</span>`).join("")}
      </div>
      <div class="home-actions">
        ${primaryAction}
        ${dangerAction}
      </div>
    </div>
  `;
}

function renderTrainingMaxEditor(cycle) {
  return cycle.lifts
    .map(
      (lift) => `
        <div class="accessory-row">
          <div class="row-head">
            <div>
              <h4>${lift.name}</h4>
              <p class="set-subtitle">Training max basis for percentage work</p>
            </div>
          </div>
          <div class="set-actions">
            <input
              id="training-max-${lift.id}"
              type="number"
              min="1"
              step="1"
              value="${lift.trainingMax}"
              placeholder="Training max"
            />
            <button
              class="primary-button"
              type="button"
              data-action="save-training-max"
              data-lift-id="${lift.id}"
            >
              Update TM
            </button>
          </div>
        </div>
      `,
    )
    .join("");
}

function describeMainSetPreview(workout) {
  if (!workout.mainSets?.length) {
    return "No main work";
  }

  const firstSet = workout.mainSets[0];
  const sameWeight = workout.mainSets.every((set) => set.targetWeight === firstSet.targetWeight);
  const sameReps = workout.mainSets.every((set) => set.targetReps === firstSet.targetReps && !set.amrap);

  if (sameWeight && sameReps) {
    return `${workout.mainSets.length}x${firstSet.targetReps} @ ${firstSet.targetWeight} lb`;
  }

  const repLabels = workout.mainSets.map((set) => `${set.targetReps}${set.amrap ? "+" : ""}`).join("/");
  const weightLabels = workout.mainSets.map((set) => set.targetWeight).join("/");
  return `${repLabels} @ ${weightLabels} lb`;
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
  const date = typeof dateInput === "string" ? parseStoredDate(dateInput) : new Date(dateInput);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function parseStoredDate(dateInput) {
  if (dateInput instanceof Date) {
    return new Date(dateInput);
  }

  const isoMatch = String(dateInput).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  return new Date(dateInput);
}
