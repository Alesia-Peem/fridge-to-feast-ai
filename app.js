// ===== ที่เก็บข้อมูล (localStorage: เก็บในเบราว์เซอร์ของผู้ใช้แต่ละคน) =====
const KEYS = { fridge: 'f2f.fridge', history: 'f2f.history' };

function load(key) {
  try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; }
}

function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* โหมดส่วนตัว/บล็อก storage */ }
}

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const $ = selector => document.querySelector(selector);

// สร้าง element แบบปลอดภัย (ข้อความทั้งหมดใส่ผ่าน text node ไม่ใช้ innerHTML)
function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === 'class') node.className = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else if (value !== false && value != null) node.setAttribute(key, value === true ? '' : value);
  }
  node.append(...children.flat().filter(c => c != null && c !== false));
  return node;
}

// ===== วันหมดอายุ =====
function daysLeft(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((new Date(dateStr + 'T00:00:00') - today) / 86400000);
}

function expiryLabel(days) {
  if (days === null) return null;
  if (days < 0) return { text: 'หมดอายุแล้ว', tone: 'danger' };
  if (days === 0) return { text: 'หมดอายุวันนี้', tone: 'warn' };
  return { text: `อีก ${days} วัน`, tone: days <= 3 ? 'warn' : '' };
}

const isSoon = days => days !== null && days >= 0 && days <= 3;

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ===== สูตรอาหาร =====
// เมนูตัวอย่างสำรองไว้ใช้ตอนเรียก AI ไม่สำเร็จ (มีครบทุกประเภทอาหาร)
const mockRecipes = [
  {
    title: 'ข้าวผัดไข่ใส่หมูสับทรงเครื่อง',
    category: 'อาหารจานเดียว ทำง่ายๆ',
    ingredients: ['ข้าวสวย 1 ถ้วย', 'ไข่ไก่ 2 ฟอง', 'หมูสับ 100 กรัม', 'กระเทียมสับ 1 ช้อนชา', 'ซอสปรุงรส, น้ำตาล, พริกไทย'],
    steps: [
      'ตั้งกระทะใส่น้ำมัน เจียวกระเทียมสับจนหอม ใส่หมูสับลงไปผัดจนเริ่มสุก',
      'ตอกไข่ไก่ลงไป ยีให้ไข่พอสุก แล้วใส่ข้าวสวยลงไปผัดให้เข้ากัน',
      'ปรุงรสด้วยซอสปรุงรส น้ำตาล พริกไทย ผัดด้วยไฟแรงจนหอมกลิ่นกระทะ พร้อมเสิร์ฟ'
    ],
    tip: 'ใช้ข้าวสวยค้างคืนที่แช่เย็นไว้ จะทำให้ข้าวผัดเป็นเม็ดสวย ไม่แฉะ'
  },
  {
    title: 'ต้มจืดเต้าหู้หมูสับไข่น้ำ',
    category: 'ต้ม/แกง ร้อนๆ',
    ingredients: ['ไข่ไก่ 2 ฟอง', 'หมูสับ 100 กรัม', 'ซุปก้อน 1 ก้อน', 'ผักกาดขาว/ต้นหอม', 'ซีอิ๊วขาว, พริกไทย'],
    steps: [
      'ทอดไข่เจียวให้หอมกรอบ แล้วหั่นเป็นชิ้นพอดีคำพักไว้',
      'ตั้งน้ำใส่ซุปก้อน ปรุงรสด้วยซีอิ๊วขาว เมื่อน้ำเดือดใส่หมูสับปั้นก้อนลงไป',
      'ใส่ผักและไข่เจียวที่หั่นไว้ ต้มต่ออีก 2 นาที โรยพริกไทยพร้อมเสิร์ฟ'
    ],
    tip: 'การนำไข่ไปทอดก่อนต้ม จะทำให้น้ำซุปมีความหอมกลมกล่อมมากยิ่งขึ้น'
  },
  {
    title: 'ผัดกะเพราหมูสับไข่ดาว',
    category: 'ผัด/ทอด รสเด็ด',
    ingredients: ['หมูสับ 150 กรัม', 'ใบกะเพรา 1 กำมือ', 'พริกขี้หนู 5 เม็ด', 'กระเทียม 4 กลีบ', 'ไข่ไก่ 1 ฟอง', 'ซอสหอยนางรม, น้ำปลา, น้ำตาล'],
    steps: [
      'ทอดไข่ดาวในน้ำมันร้อนจัดให้ขอบกรอบ ตักพักไว้',
      'โขลกพริกกับกระเทียมพอแหลก ลงไปผัดกับน้ำมันจนหอม',
      'ใส่หมูสับผัดจนสุก ปรุงรสด้วยซอสหอยนางรม น้ำปลา น้ำตาล',
      'ใส่ใบกะเพรา ผัดเร็วๆ แล้วปิดไฟ ตักราดข้าวพร้อมไข่ดาว'
    ],
    tip: 'ใส่น้ำซุปหรือน้ำสะอาดเล็กน้อยตอนผัด เพื่อไม่ให้กะเพราแห้งเกินไป'
  },
  {
    title: 'สลัดอกไก่ไข่ต้มน้ำใสจี๊ด',
    category: 'อาหารคลีน สุขภาพ',
    ingredients: ['อกไก่ 1 ชิ้น', 'ไข่ไก่ 1 ฟอง', 'ผักสลัดรวม 2 ถ้วย', 'มะเขือเทศเชอร์รี่ 5 ลูก', 'น้ำมะนาว, น้ำปลา, พริกป่น'],
    steps: [
      'ต้มอกไก่ในน้ำเดือด 12-15 นาทีจนสุก พักให้เย็นแล้วฉีกเป็นเส้น',
      'ต้มไข่ 8 นาที แช่น้ำเย็น ปอกเปลือกแล้วผ่าครึ่ง',
      'ผสมน้ำมะนาว น้ำปลา พริกป่น เป็นน้ำสลัด',
      'จัดผัก อกไก่ ไข่ และมะเขือเทศลงจาน ราดน้ำสลัดก่อนกิน'
    ],
    tip: 'น้ำสลัดแบบไทยใช้น้ำมันน้อยมาก แคลอรีต่ำกว่าน้ำสลัดครีมหลายเท่า'
  }
];

// เรียก Serverless Function ของเราเอง (api/recipe.js) ซึ่งถือ Gemini API Key ไว้ฝั่งเซิร์ฟเวอร์
async function fetchRecipe(ingredients, mealType) {
  try {
    const response = await fetch('/api/recipe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ingredients, mealType })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    return { recipe: data, fallback: null };
  } catch (err) {
    console.error(err);
    const recipe = mockRecipes.find(r => r.category === mealType) || mockRecipes[0];
    return { recipe, fallback: err.message };
  }
}

function recipeBody(recipe) {
  const list = (tag, items) => el(tag, {}, (Array.isArray(items) ? items : []).map(text => el('li', {}, String(text))));
  return el('div', { class: 'recipe' },
    recipe.category && el('span', { class: 'recipe-cat' }, String(recipe.category)),
    el('h3', {}, String(recipe.title || 'เมนูแนะนำ')),
    el('h4', {}, 'วัตถุดิบ'),
    list('ul', recipe.ingredients),
    el('h4', {}, 'วิธีทำ'),
    list('ol', recipe.steps),
    recipe.tip && el('p', { class: 'tip' }, String(recipe.tip))
  );
}

// ===== หน้าแรก =====
function initHome() {
  const fridge = load(KEYS.fridge);
  $('#statItems').textContent = fridge.length;
  $('#statSoon').textContent = fridge.filter(i => { const d = daysLeft(i.expires); return d !== null && d <= 3; }).length;
  $('#statMeals').textContent = load(KEYS.history).length;
}

// ===== หน้าตู้เย็น =====
function initFridge() {
  let fridge = load(KEYS.fridge);
  let lastRecipe = null;
  let lastUsedIds = [];

  const form = $('#addForm'), nameInput = $('#itemName'), expiryInput = $('#itemExpiry');
  const list = $('#fridgeList'), empty = $('#emptyFridge'), count = $('#count'), toggleAll = $('#toggleAll');
  const mealType = $('#mealType'), generateBtn = $('#generateBtn'), hint = $('#hint');
  const loading = $('#loading'), result = $('#result');

  const persist = () => save(KEYS.fridge, fridge);

  form.addEventListener('submit', e => {
    e.preventDefault();
    const name = nameInput.value.trim();
    if (!name) return;
    fridge.push({ id: uid(), name, expires: expiryInput.value, use: true });
    persist();
    form.reset();
    nameInput.focus();
    renderList();
  });

  toggleAll.addEventListener('click', () => {
    const allOn = fridge.every(i => i.use);
    fridge.forEach(i => { i.use = !allOn; });
    persist();
    renderList();
  });

  // ของที่ใกล้หมดอายุขึ้นก่อน ของที่ไม่ได้ใส่วันหมดอายุอยู่ท้ายสุด
  function sorted() {
    return [...fridge].sort((a, b) => {
      if (!a.expires || !b.expires) return !a.expires - !b.expires;
      return a.expires.localeCompare(b.expires);
    });
  }

  function renderList() {
    list.replaceChildren(...sorted().map(item => {
      const label = expiryLabel(daysLeft(item.expires));
      return el('li', { class: 'item' },
        el('label', {},
          el('input', {
            type: 'checkbox', checked: item.use,
            onchange: e => { item.use = e.target.checked; persist(); updateControls(); }
          }),
          el('span', { class: 'item-name' }, item.name)
        ),
        label && el('span', { class: `tag ${label.tone}` }, label.text),
        el('button', {
          class: 'icon-btn', type: 'button', 'aria-label': `ลบ ${item.name}`,
          onclick: () => { fridge = fridge.filter(i => i.id !== item.id); persist(); renderList(); }
        }, '×')
      );
    }));
    list.hidden = fridge.length === 0;
    empty.hidden = fridge.length > 0;
    count.textContent = fridge.length ? ` ${fridge.length}` : '';
    updateControls();
  }

  function updateControls() {
    const selected = fridge.filter(i => i.use).length;
    toggleAll.hidden = fridge.length === 0;
    toggleAll.textContent = selected === fridge.length ? 'ไม่เลือกทั้งหมด' : 'เลือกทั้งหมด';
    generateBtn.disabled = selected === 0;
    hint.textContent = fridge.length === 0 ? 'เพิ่มวัตถุดิบก่อน แล้วค่อยให้ AI คิดเมนู'
      : selected === 0 ? 'เลือกวัตถุดิบอย่างน้อย 1 อย่าง'
      : `AI จะคิดเมนูจากวัตถุดิบที่เลือก ${selected} อย่าง`;
  }

  generateBtn.addEventListener('click', async () => {
    const selected = fridge.filter(i => i.use);
    if (!selected.length) return;
    const ingredients = selected
      .map(i => isSoon(daysLeft(i.expires)) ? `${i.name} (ใกล้หมดอายุ)` : i.name)
      .join(', ');
    if (ingredients.length > 500) {
      hint.textContent = 'เลือกวัตถุดิบเยอะเกินไป ลองเลือกให้น้อยลงหน่อย';
      return;
    }

    generateBtn.disabled = true;
    loading.hidden = false;
    result.hidden = true;

    const { recipe, fallback } = await fetchRecipe(ingredients, mealType.value);
    lastRecipe = recipe;
    lastUsedIds = selected.map(i => i.id);

    loading.hidden = true;
    updateControls();
    renderResult(fallback);
  });

  function renderResult(fallback) {
    const foot = el('div', { class: 'recipe-foot' });
    result.replaceChildren(
      fallback && el('p', { class: 'notice' }, `เชื่อมต่อ AI ไม่ได้ (${fallback}) จึงแสดงเมนูตัวอย่างแทน`),
      recipeBody(lastRecipe),
      foot
    );
    showCookButton(foot);
    result.hidden = false;
    result.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function showCookButton(foot) {
    foot.replaceChildren(
      el('button', { class: 'btn btn-primary', type: 'button', onclick: () => showClearPanel(foot) }, 'ทำเมนูนี้แล้ว')
    );
  }

  // ถามว่าใช้วัตถุดิบไหนหมด แล้วเอาออกจากตู้เย็น + บันทึกลงประวัติ
  function showClearPanel(foot) {
    const used = fridge.filter(i => lastUsedIds.includes(i.id));
    const checks = used.map(i => el('input', { type: 'checkbox', checked: true, value: i.id }));

    foot.replaceChildren(
      el('p', { class: 'label' }, used.length ? 'วัตถุดิบไหนใช้หมดแล้ว? จะเอาออกจากตู้เย็นให้' : 'บันทึกเมนูนี้ลงประวัติ'),
      used.length > 0 && el('div', { class: 'chips' }, used.map((item, n) => el('label', { class: 'chip' }, checks[n], item.name))),
      el('div', { class: 'row' },
        el('button', { class: 'btn btn-primary', type: 'button', onclick: () => saveCooked(foot, checks) }, 'บันทึกลงประวัติ'),
        el('button', { class: 'btn', type: 'button', onclick: () => showCookButton(foot) }, 'ยกเลิก')
      )
    );
  }

  function saveCooked(foot, checks) {
    const clearedIds = checks.filter(c => c.checked).map(c => c.value);
    const cleared = fridge.filter(i => clearedIds.includes(i.id)).map(i => i.name);

    const history = load(KEYS.history);
    history.unshift({ id: uid(), cookedAt: new Date().toISOString(), recipe: lastRecipe, cleared });
    save(KEYS.history, history);

    fridge = fridge.filter(i => !clearedIds.includes(i.id));
    persist();
    renderList();

    foot.replaceChildren(
      el('p', { class: 'saved' }, 'บันทึกลงประวัติแล้ว · ', el('a', { href: '/history' }, 'ดูประวัติ →'))
    );
  }

  renderList();
}

// ===== หน้าประวัติ =====
function chevron() {
  const span = el('span', { class: 'chev', 'aria-hidden': 'true' });
  span.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';
  return span;
}

function initHistory() {
  const list = $('#historyList'), empty = $('#emptyHistory');

  function render() {
    const history = load(KEYS.history);
    $('#mealCount').textContent = history.length;
    $('#clearedCount').textContent = history.reduce((n, h) => n + (h.cleared?.length || 0), 0);
    empty.hidden = history.length > 0;

    list.replaceChildren(...history.map(h => {
      const recipe = h.recipe || {};
      return el('details', { class: 'entry' },
        el('summary', {},
          el('div', {},
            el('span', { class: 'entry-title' }, String(recipe.title || 'เมนู')),
            el('span', { class: 'entry-meta' }, [formatDate(h.cookedAt), recipe.category].filter(Boolean).join(' · '))
          ),
          chevron()
        ),
        el('div', { class: 'entry-body' },
          h.cleared?.length > 0 && el('p', { class: 'cleared' }, `เคลียร์จากตู้เย็น: ${h.cleared.join(', ')}`),
          recipeBody(recipe),
          el('button', {
            class: 'link danger', type: 'button',
            onclick: () => {
              if (!confirm('ลบรายการนี้ออกจากประวัติ?')) return;
              save(KEYS.history, load(KEYS.history).filter(x => x.id !== h.id));
              render();
            }
          }, 'ลบรายการนี้')
        )
      );
    }));
  }

  render();
}

({ home: initHome, fridge: initFridge, history: initHistory })[document.body.dataset.page]?.();
