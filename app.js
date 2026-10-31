const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

const state = {
  schools: [],
  selectedSchool: '',
  currentScale: 4.5,
  currentTab: 'national',
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
  participantLabel: $('#participantLabel'),
  participantCount: $('#participantCount'),
  resultScore: $('#resultScore'),
  backToEntry: $('#backToEntry'),
  labelHead: $('#labelHead'),
  labelShoulder: $('#labelShoulder'),
  labelBelly: $('#labelBelly'),
  labelFeet: $('#labelFeet'),
  capybaraImg: $('#capybaraImg'),
  myLine: $('#myLine'),
};

const nationalAnchors = { head: 4.5, shoulder: 3.54, belly: 2.90, feet: 1.20 };
const schoolFallbackAnchors = { head: 4.5, shoulder: 3.78, belly: 3.02, feet: 1.98 };
const lineTopMap = { head: 27, shoulder: 137, belly: 247, feet: 354 };
const assetCache = {};

async function init() {
  preloadImages([
    'team-gemini.png',
    'capybara-heart.png',
    'capybara-smile.png',
    'capybara-thinking.png',
    'capybara-crying.png',
  ]);
  await loadSchools();
  bindEvents();
  renderScaleButtons();
  updateSubmitAvailability();
  updateClearButton();
  updateHint('');
}

function preloadImages(paths) {
  paths.forEach((src) => {
    const img = new Image();
    img.decoding = 'async';
    img.src = `${src}?v=20261031-heartnew4`;
    assetCache[src] = img;
  });
}

async function loadSchools() {
  try {
    const res = await fetch('schools.json?v=20261031-heartnew4');
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
  elements.storeConsent.addEventListener('change', updateSubmitAvailability);
  elements.gradeForm.addEventListener('submit', handleSubmit);
  elements.backToEntry.addEventListener('click', backToEntry);

  elements.tabNational.addEventListener('click', () => switchTab('national'));
  elements.tabSchool.addEventListener('click', () => switchTab('school'));

  window.addEventListener('resize', () => {
    if (!elements.resultPage.hidden) updateResultView();
  });

  elements.capybaraImg.addEventListener('error', () => {
    const fallback = 'capybara-heart.png?v=20261031-heartnew4';
    if (!elements.capybaraImg.src.includes('capybara-heart')) elements.capybaraImg.src = fallback;
  });
}

function renderScaleButtons() {
  elements.scaleButtons.forEach((btn) => {
    const active = Number(btn.dataset.scale) === state.currentScale;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

function updateHint(text) {
  elements.schoolHint.textContent = text;
  elements.schoolHint.hidden = !text;
}

function onSchoolInput() {
  const q = normalizeText(elements.schoolSearch.value);
  state.selectedSchool = '';
  updateClearButton();
  updateSubmitAvailability();

  if (!q) {
    hideSchoolOptions();
    updateHint('');
    elements.missingSchoolBox.hidden = true;
    return;
  }

  const alias = { '관동대학교': '가톨릭관동대학교', '금오공대': '국립금오공과대학교', '한밭대': '국립한밭대학교', '경국대': '국립경국대학교' };
  const aliasMatch = alias[elements.schoolSearch.value.trim()];
  const matches = state.schools.filter((name) => normalizeText(name).includes(q) || name === aliasMatch).slice(0, 20);
  if (matches.length) {
    updateHint('목록에서 학교를 선택해 주세요.');
    elements.missingSchoolBox.hidden = true;
    showSchoolOptions(matches);
  } else {
    hideSchoolOptions();
    updateHint('목록에 없는 학교예요. 아래 임시 선택을 이용해 주세요.');
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
  updateHint('');
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
  state.selectedSchool = name;
  elements.schoolSearch.value = name;
  updateHint('');
  elements.missingSchoolBox.hidden = true;
  hideSchoolOptions();
  updateClearButton();
  updateSubmitAvailability();
}

function clearSchool() {
  elements.schoolSearch.value = '';
  state.selectedSchool = '';
  updateHint('');
  elements.missingSchoolBox.hidden = true;
  hideSchoolOptions();
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
  const ready = !!state.selectedSchool && validGpa && elements.storeConsent.checked;
  elements.submitBtn.disabled = !ready;
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

  if (!elements.storeConsent.checked) {
    showError('결과 확인 동의에 체크해 주세요.');
    elements.storeConsent.focus();
    return;
  }

  state.currentTab = 'national';
  setTabUI();
  elements.entryPage.hidden = true;
  elements.resultPage.hidden = false;
  updateResultView();
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function backToEntry() {
  elements.resultPage.hidden = true;
  elements.entryPage.hidden = false;
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function switchTab(tab) {
  state.currentTab = tab;
  setTabUI();
  updateResultView();
}

function setTabUI() {
  const national = state.currentTab === 'national';
  elements.tabNational.classList.toggle('active', national);
  elements.tabSchool.classList.toggle('active', !national);
  elements.tabNational.setAttribute('aria-selected', national ? 'true' : 'false');
  elements.tabSchool.setAttribute('aria-selected', national ? 'false' : 'true');
  elements.participantLabel.textContent = national ? '현재 참여인원' : `${state.selectedSchool || '우리 학교'} 참여인원`;
  elements.participantCount.textContent = '집계 준비 중';
}

function updateResultView() {
  const inputValue = Number(elements.gpaInput.value || 0);
  const converted = to45Scale(inputValue, state.currentScale);
  const anchors = getAnchors();

  renderHeadline(converted);
  elements.resultScore.innerHTML = `내 평균 학점 <b>${inputValue.toFixed(2)}</b> / ${state.currentScale.toFixed(1)}${state.currentScale === 4.3 ? ` <small class="score-convert">→ ${converted.toFixed(2)} / 4.5</small>` : ''}`;
  elements.labelHead.textContent = anchors.head.toFixed(2);
  elements.labelShoulder.textContent = anchors.shoulder.toFixed(2);
  elements.labelBelly.textContent = anchors.belly.toFixed(2);
  elements.labelFeet.textContent = anchors.feet.toFixed(2);
  setCapybaraImage(converted);
  positionMyLine(converted, anchors);
}

function renderHeadline(score45) {
  let text = '';
  if (score45 >= 3.54) text = '상승세 좋다~ <span>📈</span>';
  else if (score45 >= 3.0) text = '흐름 좋다~ <span>😏</span>';
  else if (score45 >= 2.0) text = '조정 구간이다~ <span>🤔</span>';
  else text = '반등 노려보자~ <span>🥲</span>';
  elements.resultHeadline.innerHTML = text;
}

function pickMascot(score45) {
  if (score45 >= 3.54) return 'capybara-heart.png';
  if (score45 >= 3.0) return 'capybara-smile.png';
  if (score45 >= 2.0) return 'capybara-thinking.png';
  return 'capybara-crying.png';
}

function setCapybaraImage(score45) {
  const src = `${pickMascot(score45)}?v=20261031-heartnew4`;
  if (elements.capybaraImg.src !== src && !elements.capybaraImg.src.endsWith(src)) {
    elements.capybaraImg.src = src;
  }
}

function getAnchors() {
  return state.currentTab === 'school' ? schoolFallbackAnchors : nationalAnchors;
}

function positionMyLine(score45, anchors) {
  const guideTop = (key) => {
    const guide = document.querySelector('.chart-line.' + key);
    return guide ? guide.offsetTop : lineTopMap[key];
  };
  const points = [
    { score: anchors.head, y: guideTop('head') },
    { score: anchors.shoulder, y: guideTop('shoulder') },
    { score: anchors.belly, y: guideTop('belly') },
    { score: anchors.feet, y: guideTop('feet') },
  ];

  let y = points[3].y;
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
  elements.myLine.style.top = `${Math.round(y)}px`;
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
