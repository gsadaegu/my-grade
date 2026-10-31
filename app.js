
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

const state = {
  schools: [],
  selectedSchool: '',
  currentScale: 4.5,
  currentTab: 'national',
  lastFocus: null,
  modalShownThisSubmit: false,
};

const elements = {
  entryPage: $('#entryPage'),
  resultPage: $('#resultPage'),
  gradeForm: $('#gradeForm'),
  schoolSearch: $('#schoolSearch'),
  clearSchool: $('#clearSchool'),
  schoolOptions: $('#schoolOptions'),
  schoolHint: $('#schoolHint'),
  missingSchoolBox: $('#missingSchoolBox'),
  useCustomSchool: $('#useCustomSchool'),
  gpaInput: $('#gpaInput'),
  storeConsent: $('#storeConsent'),
  formError: $('#formError'),
  submitBtn: $('#submitBtn'),
  scaleButtons: $$('.scale-btn'),
  tabNational: $('#tabNational'),
  tabSchool: $('#tabSchool'),
  resultHeadline: $('#resultHeadline'),
  resultScore: $('#resultScore'),
  backToEntry: $('#backToEntry'),
  labelHead: $('#labelHead'),
  labelShoulder: $('#labelShoulder'),
  labelBelly: $('#labelBelly'),
  labelFeet: $('#labelFeet'),
  capybaraImg: $('#capybaraImg'),
  myLine: $('#myLine'),
  promoModal: $('#promoModal'),
  closeModal: $('#closeModal'),
  justShowResult: $('#justShowResult'),
};

const nationalDefaultAnchors = { head: 4.5, shoulder: 3.54, belly: 2.90, feet: 1.20 };
const schoolFallbackAnchors = { head: 4.5, shoulder: 3.78, belly: 3.02, feet: 1.98 };
const lineTopMap = { head: 27, shoulder: 137, belly: 247, feet: 354 };
const lineTopMapSmall = { head: 27, shoulder: 137, belly: 247, feet: 354 };

function currentLineMap() {
  return window.innerWidth <= 420 ? lineTopMapSmall : lineTopMap;
}

async function init() {
  await loadSchools();
  bindEvents();
  renderScaleButtons();
  updateSubmitAvailability();
  updateClearButton();
}

async function loadSchools() {
  try {
    const res = await fetch('schools.json?v=20261031b');
    state.schools = await res.json();
  } catch (e) {
    state.schools = ['대구대학교', '경북대학교', '연세대학교', '고려대학교', '한양대학교', '관동대학교'];
  }
}

function bindEvents() {
  elements.scaleButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      state.currentScale = Number(btn.dataset.scale);
      renderScaleButtons();
      elements.gpaInput.max = String(state.currentScale);
      updateSubmitAvailability();
    });
  });

  elements.schoolSearch.addEventListener('input', onSchoolInput);
  elements.schoolSearch.addEventListener('focus', onSchoolInput);
  elements.schoolSearch.addEventListener('keydown', onSchoolKeydown);
  elements.clearSchool.addEventListener('click', clearSchool);
  elements.useCustomSchool.addEventListener('click', selectCustomSchool);
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-wrap') && !e.target.closest('.school-options')) {
      hideSchoolOptions();
    }
  });

  elements.gpaInput.addEventListener('input', updateSubmitAvailability);
  elements.gradeForm.addEventListener('submit', handleSubmit);
  elements.backToEntry.addEventListener('click', backToEntry);

  elements.tabNational.addEventListener('click', () => switchTab('national'));
  elements.tabSchool.addEventListener('click', () => switchTab('school'));

  elements.closeModal.addEventListener('click', closeModal);
  elements.justShowResult.addEventListener('click', closeModal);
  elements.promoModal.addEventListener('click', (e) => {
    if (e.target === elements.promoModal) closeModal();
  });

  window.addEventListener('resize', () => {
    if (!elements.resultPage.hidden) updateResultView(false);
  });
}

function renderScaleButtons() {
  elements.scaleButtons.forEach((btn) => {
    const active = Number(btn.dataset.scale) === state.currentScale;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

function onSchoolInput() {
  const q = normalizeText(elements.schoolSearch.value);
  state.selectedSchool = '';
  updateClearButton();
  updateSubmitAvailability();

  if (!q) {
    elements.schoolHint.textContent = '학교명을 정확히 입력하거나 목록에서 선택해 주세요.';
    elements.missingSchoolBox.hidden = true;
    showSchoolOptions(state.schools.slice(0, 12));
    return;
  }

  const matches = state.schools.filter((name) => normalizeText(name).includes(q)).slice(0, 20);
  if (matches.length) {
    elements.schoolHint.textContent = '목록에서 학교를 선택해 주세요.';
    elements.missingSchoolBox.hidden = true;
    showSchoolOptions(matches);
  } else {
    hideSchoolOptions();
    elements.schoolHint.textContent = '목록에 없는 학교예요. 아래 버튼으로 바로 체험할 수 있어요.';
    elements.missingSchoolBox.hidden = false;
  }
}

function onSchoolKeydown(e) {
  if (e.key === 'Enter') {
    const first = elements.schoolOptions.querySelector('button');
    if (first) {
      e.preventDefault();
      first.click();
    }
  }
  if (e.key === 'Escape') hideSchoolOptions();
}

function showSchoolOptions(matches) {
  elements.schoolOptions.innerHTML = '';
  matches.forEach((name) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = name;
    btn.addEventListener('click', () => selectSchool(name));
    elements.schoolOptions.appendChild(btn);
  });
  elements.schoolOptions.hidden = false;
  elements.schoolSearch.setAttribute('aria-expanded', 'true');
}

function hideSchoolOptions() {
  elements.schoolOptions.hidden = true;
  elements.schoolSearch.setAttribute('aria-expanded', 'false');
}

function selectSchool(name) {
  state.selectedSchool = name;
  elements.schoolSearch.value = name;
  elements.schoolHint.textContent = `${name} 선택됨`;
  elements.missingSchoolBox.hidden = true;
  hideSchoolOptions();
  updateClearButton();
  updateSubmitAvailability();
}

function selectCustomSchool() {
  const name = elements.schoolSearch.value.trim();
  if (name.length < 2) {
    showError('학교명을 두 글자 이상 입력해 주세요.');
    return;
  }
  clearError();
  selectSchool(name);
  elements.schoolHint.textContent = `${name} 이름으로 체험해요. (공식 목록 미등록)`;
}

function clearSchool() {
  elements.schoolSearch.value = '';
  state.selectedSchool = '';
  elements.schoolHint.textContent = '학교명을 정확히 입력하거나 목록에서 선택해 주세요.';
  elements.missingSchoolBox.hidden = true;
  updateClearButton();
  updateSubmitAvailability();
  elements.schoolSearch.focus();
}

function updateClearButton() {
  elements.clearSchool.style.visibility = elements.schoolSearch.value ? 'visible' : 'hidden';
}

function updateSubmitAvailability() {
  const gpaValue = Number(elements.gpaInput.value);
  const validGpa = elements.gpaInput.value !== '' && Number.isFinite(gpaValue) && gpaValue >= 0 && gpaValue <= state.currentScale;
  const ready = !!state.selectedSchool && validGpa;
  elements.submitBtn.disabled = !ready;
  elements.submitBtn.style.opacity = ready ? '1' : '.55';
}

function handleSubmit(e) {
  e.preventDefault();
  clearError();
  const raw = elements.gpaInput.value.trim();
  const gpaValue = Number(raw);

  if (!state.selectedSchool) {
    showError('학교를 먼저 선택해 주세요.');
    elements.schoolSearch.focus();
    return;
  }
  if (raw === '' || !Number.isFinite(gpaValue)) {
    showError('학점을 입력해 주세요.');
    elements.gpaInput.focus();
    return;
  }
  if (gpaValue < 0 || gpaValue > state.currentScale) {
    showError(`${state.currentScale.toFixed(1)} 기준에 맞는 학점을 입력해 주세요.`);
    elements.gpaInput.focus();
    return;
  }

  const converted = to45Scale(gpaValue, state.currentScale);
  // Do not save personal grade data until a consent-aware database is connected.
  // The checkbox currently records only the user selection in this session.

  state.currentTab = 'national';
  setTabUI();
  elements.entryPage.hidden = true;
  elements.resultPage.hidden = false;
  updateResultView(true);
  openModal();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function backToEntry() {
  elements.resultPage.hidden = true;
  elements.entryPage.hidden = false;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function switchTab(tab) {
  state.currentTab = tab;
  setTabUI();
  updateResultView(false);
}

function setTabUI() {
  const national = state.currentTab === 'national';
  elements.tabNational.classList.toggle('active', national);
  elements.tabSchool.classList.toggle('active', !national);
  elements.tabNational.setAttribute('aria-selected', national ? 'true' : 'false');
  elements.tabSchool.setAttribute('aria-selected', national ? 'false' : 'true');
}

function updateResultView(resetScroll) {
  const inputValue = Number(elements.gpaInput.value);
  const converted = to45Scale(inputValue, state.currentScale);
  const schoolName = state.selectedSchool || '우리 학교';
  const anchors = getAnchors();

  renderHeadline(converted);
  elements.resultScore.innerHTML = `내 평균 학점 <b>${inputValue.toFixed(2)}</b> / ${state.currentScale.toFixed(1)}${state.currentScale === 4.3 ? ` <small class="score-convert">→ ${converted.toFixed(2)} / 4.5</small>` : ''}`;
  elements.labelHead.textContent = anchors.head.toFixed(2);
  elements.labelShoulder.textContent = anchors.shoulder.toFixed(2);
  elements.labelBelly.textContent = anchors.belly.toFixed(2);
  elements.labelFeet.textContent = anchors.feet.toFixed(2);
  elements.capybaraImg.src = pickMascot(converted);
  elements.capybaraImg.alt = `${schoolName} 학점 시연 결과에 따른 카피바라`;
  positionMyLine(converted, anchors);
  if (resetScroll) elements.resultPage.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderHeadline(score45) {
  let text = '';
  if (score45 >= 3.54) text = '상승세 좋다~ <span>📈</span>';
  else if (score45 >= 3.3) text = '흐름 좋다~ <span>😏</span>';
  else if (score45 >= 2.4) text = '조정 구간이다~ <span>🤔</span>';
  else text = '반등 노려보자~ <span>🥲</span>';
  elements.resultHeadline.innerHTML = text;
}

function pickMascot(score45) {
  if (score45 >= 3.54) return 'assets/capybara-heart.png';
  if (score45 >= 3.0) return 'assets/capybara-smile.png';
  if (score45 >= 2.0) return 'assets/capybara-thinking.png';
  return 'assets/capybara-crying.png';
}

function getAnchors() {
  // Both tabs show illustrative anchors until a shared database is connected.
  return nationalDefaultAnchors;
}

function positionMyLine(score45, anchors) {
  const map = currentLineMap();
  const points = [
    { score: anchors.head, y: map.head },
    { score: anchors.shoulder, y: map.shoulder },
    { score: anchors.belly, y: map.belly },
    { score: anchors.feet, y: map.feet },
  ];

  let y = map.feet;
  if (score45 >= points[0].score) y = points[0].y;
  else if (score45 <= points[3].score) y = points[3].y;
  else {
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      if (score45 <= a.score && score45 >= b.score) {
        const ratio = (a.score - score45) / (a.score - b.score || 1);
        y = a.y + ratio * (b.y - a.y);
        break;
      }
    }
  }
  elements.myLine.style.top = `${y}px`;
}

function openModal() {
  state.lastFocus = document.activeElement;
  elements.promoModal.hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  elements.promoModal.hidden = true;
  document.body.style.overflow = '';
  if (state.lastFocus && typeof state.lastFocus.focus === 'function') state.lastFocus.focus();
}

function saveRecord(record) {
  const all = loadRecords();
  all.push(record);
  localStorage.setItem('my-grade-records', JSON.stringify(all.slice(-300)));
}

function loadRecords() {
  try {
    const raw = localStorage.getItem('my-grade-records');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function percentile(sortedDescValues, quantile) {
  if (!sortedDescValues.length) return 0;
  const idx = Math.min(sortedDescValues.length - 1, Math.max(0, Math.round((sortedDescValues.length - 1) * quantile)));
  return sortedDescValues[idx];
}

function to45Scale(value, scale) {
  return Number(((value * 4.5) / scale).toFixed(2));
}

function normalizeText(text) {
  return text.trim().replace(/\s+/g, '').toLowerCase();
}

function showError(message) {
  elements.formError.hidden = false;
  elements.formError.textContent = message;
}

function clearError() {
  elements.formError.hidden = true;
  elements.formError.textContent = '';
}

init();
