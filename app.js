(() => {
  'use strict';

  const NS = 'regression-lab-v1';
  const TOTAL = 16;
  const state = {
    completed: new Set(JSON.parse(localStorage.getItem(NS + ':completed') || '[]')),
    intuitionTruth: 'positive',
    lineData: [],
    lineOpt: null,
    outlierOn: false,
    residualData: [],
    residualTarget: -1,
    residualAttempts: 0,
    diagType: 'ok',
    diagRound: 0,
    coefficientIndex: 0,
    duelModels: [],
    selectedRoleVar: null,
    roleAssignments: {y:null,x:null,control:null},
    selectedResearchVar: null,
    researchAssignments: {y:null,x:null,control:null},
    quiz: { active: false, index: 0, score: 0, locked: false, order: [] }
  };

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rnd = (a, b) => a + Math.random() * (b - a);
  const fmt = (v, d = 2) => Number(v).toFixed(d).replace(/\.00$/, '');

  function normal() {
    let u = 0, v = 0;
    while (!u) u = Math.random();
    while (!v) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  function seededNoise(i) {
    const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
    return ((x - Math.floor(x)) - .5) * 2;
  }

  function regression(points) {
    const n = points.length;
    const mx = points.reduce((s, p) => s + p.x, 0) / n;
    const my = points.reduce((s, p) => s + p.y, 0) / n;
    const sxx = points.reduce((s, p) => s + (p.x - mx) ** 2, 0);
    const sxy = points.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0);
    const b1 = sxx === 0 ? 0 : sxy / sxx;
    const b0 = my - b1 * mx;
    const sse = points.reduce((s, p) => s + (p.y - (b0 + b1 * p.x)) ** 2, 0);
    const sst = points.reduce((s, p) => s + (p.y - my) ** 2, 0);
    return { b0, b1, sse, r2: sst === 0 ? 0 : 1 - sse / sst };
  }

  function sseFor(points, b0, b1) {
    return points.reduce((s, p) => s + (p.y - (b0 + b1 * p.x)) ** 2, 0);
  }

  function svgEl(name, attrs = {}) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', name);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    return el;
  }

  function clearSvg(svg) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
  }

  function scales(points, w, h, pad = 48, fixed = null) {
    const xs = points.map(p => p.x), ys = points.map(p => p.y);
    let xmin = fixed?.xmin ?? Math.min(...xs), xmax = fixed?.xmax ?? Math.max(...xs);
    let ymin = fixed?.ymin ?? Math.min(...ys), ymax = fixed?.ymax ?? Math.max(...ys);
    const xgap = Math.max(1, (xmax - xmin) * .08), ygap = Math.max(1, (ymax - ymin) * .14);
    if (!fixed?.xmin && fixed?.xmin !== 0) xmin -= xgap;
    if (!fixed?.xmax && fixed?.xmax !== 0) xmax += xgap;
    if (!fixed?.ymin && fixed?.ymin !== 0) ymin -= ygap;
    if (!fixed?.ymax && fixed?.ymax !== 0) ymax += ygap;
    return {
      X: x => pad + (x - xmin) / (xmax - xmin || 1) * (w - pad * 2),
      Y: y => h - pad - (y - ymin) / (ymax - ymin || 1) * (h - pad * 2),
      xmin, xmax, ymin, ymax, pad
    };
  }

  function axes(svg, sc, w, h, dark = false, zeroY = null) {
    for (let i = 0; i <= 4; i++) {
      const x = sc.pad + i * (w - sc.pad * 2) / 4;
      const y = sc.pad + i * (h - sc.pad * 2) / 4;
      svg.append(svgEl('line', { x1:x, y1:sc.pad, x2:x, y2:h-sc.pad, class: dark ? 'gridline dark-grid' : 'gridline' }));
      svg.append(svgEl('line', { x1:sc.pad, y1:y, x2:w-sc.pad, y2:y, class: dark ? 'gridline dark-grid' : 'gridline' }));
    }
    if (zeroY !== null && zeroY >= sc.ymin && zeroY <= sc.ymax) {
      const zy = sc.Y(zeroY);
      svg.append(svgEl('line', { x1:sc.pad, y1:zy, x2:w-sc.pad, y2:zy, class:'zero-line' }));
    }
  }

  function drawScatter(svg, points, options = {}) {
    const w = options.w || 620, h = options.h || 400;
    clearSvg(svg);
    const sc = scales(points, w, h, options.pad || 46, options.fixed || null);
    axes(svg, sc, w, h, !!options.dark, options.zeroY ?? null);

    if (options.line) {
      const y1 = options.line.b0 + options.line.b1 * sc.xmin;
      const y2 = options.line.b0 + options.line.b1 * sc.xmax;
      svg.append(svgEl('line', {
        x1:sc.X(sc.xmin), y1:sc.Y(y1), x2:sc.X(sc.xmax), y2:sc.Y(y2),
        class:'reg-line ' + (options.dark ? 'dark-reg' : '')
      }));
    }

    points.forEach((p, i) => {
      if (options.residuals && options.line) {
        const fit = options.line.b0 + options.line.b1 * p.x;
        svg.append(svgEl('line', {
          x1:sc.X(p.x), y1:sc.Y(p.y), x2:sc.X(p.x), y2:sc.Y(fit), class:'residual-line'
        }));
      }
      const c = svgEl('circle', {
        cx:sc.X(p.x), cy:sc.Y(p.y), r:options.radius || 5.4,
        class:(options.dark ? 'point dark-point' : 'point') + (p.outlier ? ' outlier-point' : ''),
        'data-index':i
      });
      if (options.clickable) c.style.cursor = 'pointer';
      svg.append(c);
    });
    return sc;
  }

  function setFeedback(el, ok, text) {
    el.className = 'feedback ' + (el.classList.contains('dark-feedback') ? 'dark-feedback ' : '') + (ok ? 'good' : 'bad');
    el.textContent = text;
  }

  function toast(text) {
    const el = $('#toast');
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => el.classList.remove('show'), 1800);
  }

  function complete(chapter) {
    const before = state.completed.size;
    state.completed.add(String(chapter));
    localStorage.setItem(NS + ':completed', JSON.stringify([...state.completed]));
    updateProgress();
    if (state.completed.size > before) toast('Раздел ' + chapter + ' пройден');
    if (state.completed.size === TOTAL && before < TOTAL) launchConfetti();
  }

  function updateProgress() {
    const n = state.completed.size;
    $('#progressText').textContent = n + ' / ' + TOTAL;
    const pct = Math.round(n / TOTAL * 100);
    $('#masteryPercent').textContent = pct + '%';
    $('#masteryRing').style.setProperty('--p', (pct * 3.6) + 'deg');
    if (n === TOTAL) {
      $('#masteryTitle').textContent = 'Лаборатория пройдена.';
      $('#masteryCopy').textContent = 'Все восемь механик завершены. Теперь можно сбросить прогресс и пройти задания заново с новыми данными.';
    } else if (n >= 5) {
      $('#masteryTitle').textContent = 'Уже видно системное понимание.';
      $('#masteryCopy').textContent = 'Осталось закрыть ' + (TOTAL - n) + ' раздел(а). Прогресс сохраняется локально в этом браузере.';
    }
  }

  function initReveal() {
    const obs = new IntersectionObserver(entries => entries.forEach(e => {
      if (e.isIntersecting) e.target.classList.add('visible');
    }), { threshold:.08 });
    $$('.reveal').forEach(el => obs.observe(el));
  }

  function renderHero() {
    const rho = Number($('#rhoSlider').value);
    const noise = Number($('#noiseSlider').value);
    $('#rhoOut').textContent = rho.toFixed(2);
    $('#noiseOut').textContent = noise;
    const points = Array.from({length:42}, (_, i) => {
      const x = 5 + i * 90 / 41;
      const baseNoise = seededNoise(i + 5) * noise;
      const y = 52 + rho * .78 * (x - 50) + baseNoise;
      return {x,y};
    });
    const reg = regression(points);
    drawScatter($('#heroChart'), points, {w:600,h:360,line:reg,pad:38});
    $('#heroBeta').textContent = fmt(reg.b1,2);
    $('#heroR2').textContent = clamp(reg.r2,0,1).toFixed(2);
  }

  function newIntuition() {
    const types = ['positive','negative','none'];
    const truth = types[Math.floor(Math.random()*types.length)];
    state.intuitionTruth = truth;
    const slope = truth === 'positive' ? rnd(.55,.95) : truth === 'negative' ? rnd(-.95,-.55) : rnd(-.08,.08);
    const noise = truth === 'none' ? 27 : 18;
    const points = Array.from({length:34}, () => {
      const x = rnd(5,95);
      return {x, y:55 + slope*(x-50) + normal()*noise};
    });
    drawScatter($('#intuitionChart'), points, {w:620,h:400});
    $('#intuitionFeedback').textContent = '';
    $('#intuitionFeedback').className = 'feedback';
    $$('#intuitionAnswers button').forEach(b => {
      b.disabled=false;
      b.classList.remove('correct','wrong');
    });
  }

  function answerIntuition(btn) {
    const ok = btn.dataset.answer === state.intuitionTruth;
    $$('#intuitionAnswers button').forEach(b => b.disabled = true);
    btn.classList.add(ok ? 'correct':'wrong');
    const right = $('#intuitionAnswers [data-answer="' + state.intuitionTruth + '"]');
    if (right) right.classList.add('correct');
    setFeedback(
      $('#intuitionFeedback'),
      ok,
      ok ? 'Верно. Ты считал направление связи по облаку точек.' : 'Не совсем. Смотри на общий наклон облака, а не на отдельные точки.'
    );
    if (ok) complete(1);
  }

  function initLineGame() {
    const points = Array.from({length:30}, () => {
      const x = rnd(4,96);
      return {x, y:16 + .82*x + normal()*12};
    });
    state.lineData = points;
    state.lineOpt = regression(points);
    renderLineGame();
  }

  function renderLineGame() {
    const b0 = Number($('#b0Slider').value), b1 = Number($('#b1Slider').value);
    $('#b0Out').textContent = fmt(b0,0);
    $('#b1Out').textContent = fmt(b1,2);
    const cur = {b0,b1};
    drawScatter($('#lineGameChart'), state.lineData, {
      w:680,h:440,line:cur,residuals:true,dark:true,pad:48,
      fixed:{xmin:0,xmax:100,ymin:-20,ymax:120}
    });
    const sse = sseFor(state.lineData,b0,b1), opt = state.lineOpt.sse;
    $('#sseValue').textContent = Math.round(sse).toLocaleString('ru-RU');
    const quality = clamp(opt/sse,0,1);
    $('#fitMeterFill').style.width = (quality*100) + '%';
    $('#fitHint').textContent = quality > .94
      ? 'Очень близко. Проверяй.'
      : quality > .75
      ? 'Хорошо. Остатки уже заметно короче.'
      : 'Ищи положение, где вертикальные остатки в сумме становятся меньше.';
  }

  function checkLine() {
    const b0 = Number($('#b0Slider').value), b1 = Number($('#b1Slider').value);
    const cur = sseFor(state.lineData,b0,b1), ratio = cur/state.lineOpt.sse;
    if (ratio <= 1.08) {
      setFeedback($('#lineFeedback'), true, 'Поймано. Твоя SSE всего на ' + Math.round((ratio-1)*100) + '% выше математического минимума.');
      complete(2);
    } else {
      setFeedback($('#lineFeedback'), false, 'Пока можно лучше. OLS здесь примерно β₀=' + fmt(state.lineOpt.b0,1) + ', β₁=' + fmt(state.lineOpt.b1,2) + '. Попробуй приблизиться.');
    }
  }

  const coefficientTasks = [
    {
      formula:'Ŷ = 18 + 4.2X',
      context:'Y — результат теста в баллах, X — часы подготовки.',
      correct:'Каждый дополнительный час подготовки связан в среднем с увеличением результата на 4,2 балла.',
      wrong:['При нуле часов результат обязательно будет ровно 18 баллов у каждого студента.','4,2% результата объясняется временем подготовки.']
    },
    {
      formula:'Ŷ = 74 − 1.6X',
      context:'Y — средний чек в условных единицах, X — число дней после запуска акции.',
      correct:'С каждым дополнительным днём средний прогнозируемый чек уменьшается примерно на 1,6 единицы.',
      wrong:['Через 1,6 дня средний чек станет равен нулю.','Модель доказывает, что время является причиной снижения чека.']
    },
    {
      formula:'Ŷ = 31 + 2.5X',
      context:'Y — число заявок, X — рекламный бюджет в тысячах условных единиц.',
      correct:'Дополнительная тысяча бюджета связана в среднем примерно с 2,5 дополнительными заявками.',
      wrong:['Каждая заявка стоит ровно 2,5 тысячи.','31% заявок объясняется рекламным бюджетом.']
    },
    {
      formula:'Ŷ = 9 − 0.8X',
      context:'Y — прогнозируемое время доставки в днях, X — индекс доступности инфраструктуры.',
      correct:'Рост индекса X на одну единицу связан со снижением прогнозируемого времени доставки в среднем на 0,8 дня.',
      wrong:['Индекс объясняет ровно 80% времени доставки.','Любое увеличение индекса гарантированно сокращает каждую доставку на 0,8 дня.']
    }
  ];

  function shuffle(a) {
    return [...a].sort(() => Math.random() - .5);
  }

  function newCoefficientTask() {
    state.coefficientIndex = (state.coefficientIndex + 1) % coefficientTasks.length;
    const t = coefficientTasks[state.coefficientIndex];
    $('#coefficientFormula').textContent = t.formula;
    $('#coefficientScenario').textContent = t.context + ' Как корректнее всего интерпретировать коэффициент при X?';
    const box = $('#coefficientAnswers');
    box.innerHTML = '';
    shuffle([{text:t.correct,ok:true},...t.wrong.map(text => ({text,ok:false}))]).forEach(o => {
      const b = document.createElement('button');
      b.textContent = o.text;
      b.dataset.ok = o.ok ? '1' : '0';
      b.addEventListener('click', () => answerCoefficient(b));
      box.append(b);
    });
    $('#coefficientFeedback').textContent = '';
    $('#coefficientFeedback').className = 'feedback';
  }

  function answerCoefficient(btn) {
    const ok = btn.dataset.ok === '1';
    $$('#coefficientAnswers button').forEach(b => b.disabled = true);
    btn.classList.add(ok ? 'correct' : 'wrong');
    const right = $('#coefficientAnswers [data-ok="1"]');
    if (right) right.classList.add('correct');
    setFeedback(
      $('#coefficientFeedback'),
      ok,
      ok
        ? 'Да. Это интерпретация среднего изменения Y при увеличении X на одну единицу.'
        : 'Нет. β₁ говорит о среднем изменении прогнозируемого Y при изменении X на одну единицу; он не равен R² и сам по себе не доказывает причинность.'
    );
    if (ok) complete(3);
  }

  const cleanOutlierData = Array.from({length:26}, (_,i) => {
    const x = 8 + i*2.9;
    return {x,y:20+.72*x+seededNoise(i+70)*10};
  });

  function renderOutlier() {
    const data = state.outlierOn
      ? [...cleanOutlierData,{x:100,y:15,outlier:true}]
      : cleanOutlierData;
    const reg = regression(data), clean = regression(cleanOutlierData);
    drawScatter($('#outlierChart'),data,{
      w:620,h:400,line:reg,pad:46,
      fixed:{xmin:0,xmax:110,ymin:0,ymax:105}
    });
    $('#slopeClean').textContent = fmt(clean.b1,2);
    $('#slopeCurrent').textContent = fmt(reg.b1,2);
    $('#outlierState').textContent = state.outlierOn ? 'включен' : 'выключен';
    $('#outlierToggle').setAttribute('aria-pressed',state.outlierOn ? 'true' : 'false');
  }

  function answerOutlier(btn) {
    const ok = btn.dataset.answer === 'leverage';
    $$('#outlierAnswers button').forEach(b => b.disabled = true);
    btn.classList.add(ok ? 'correct' : 'wrong');
    $('#outlierAnswers [data-answer="leverage"]').classList.add('correct');
    setFeedback(
      $('#outlierFeedback'),
      ok,
      ok
        ? 'Верно. Наблюдение далеко от центра по X и способно сильно менять наклон линии.'
        : 'Не так. Главная подсказка — экстремальное положение точки по оси X: это высокий leverage.'
    );
    if (ok) complete(4);
  }

  function newResidualGame() {
    const pts = Array.from({length:24},(_,i) => {
      const x = 5 + i*3.8;
      return {x,y:18+.68*x+normal()*7};
    });
    const special = Math.floor(rnd(5,19));
    pts[special].y += Math.random() > .5 ? 30 : -30;
    const reg = regression(pts);
    const residuals = pts.map(p => Math.abs(p.y-(reg.b0+reg.b1*p.x)));
    state.residualData = pts;
    state.residualTarget = residuals.indexOf(Math.max(...residuals));
    state.residualAttempts = 0;
    $('#residualAttempts').textContent = 'Попытки: 0';
    drawScatter($('#residualChart'),pts,{
      w:900,h:480,line:reg,residuals:true,clickable:true,pad:55
    });
    $$('#residualChart circle').forEach(c => c.addEventListener('click', () => answerResidual(Number(c.dataset.index),c)));
    $('#residualFeedback').textContent = '';
    $('#residualFeedback').className = 'feedback';
  }

  function answerResidual(i,circle) {
    state.residualAttempts++;
    $('#residualAttempts').textContent = 'Попытки: ' + state.residualAttempts;
    if (i === state.residualTarget) {
      circle.setAttribute('r','9');
      circle.setAttribute('fill','#188342');
      setFeedback($('#residualFeedback'),true,'Точно. Остаток — вертикальная разница между наблюдаемым Y и предсказанием линии.');
      complete(5);
    } else {
      circle.setAttribute('opacity','.28');
      setFeedback($('#residualFeedback'),false,'У этой точки есть ошибка, но не максимальная. Ищи самое длинное вертикальное расстояние до линии.');
    }
  }

  function newDiag() {
    const types = ['ok','hetero','nonlinear'];
    state.diagType = types[Math.floor(Math.random()*types.length)];
    state.diagRound++;
    $('#diagRound').textContent = 'Раунд ' + state.diagRound;
    const pts = Array.from({length:48},(_,i) => {
      const x = -3 + i*6/47;
      let y;
      if (state.diagType === 'hetero') y = normal()*(4+Math.abs(x+3)*3.8);
      else if (state.diagType === 'nonlinear') y = 5.4*(x*x-3)+normal()*4.2;
      else y = normal()*8;
      return {x,y};
    });
    drawScatter($('#diagChart'),pts,{
      w:620,h:380,pad:44,zeroY:0,
      fixed:{xmin:-3.3,xmax:3.3,ymin:-34,ymax:34}
    });
    $$('#diagAnswers button').forEach(b => {
      b.disabled = false;
      b.classList.remove('correct','wrong');
    });
    $('#diagFeedback').textContent = '';
    $('#diagFeedback').className = 'feedback';
  }

  function answerDiag(btn) {
    const ok = btn.dataset.answer === state.diagType;
    $$('#diagAnswers button').forEach(b => b.disabled = true);
    btn.classList.add(ok ? 'correct' : 'wrong');
    $('#diagAnswers [data-answer="' + state.diagType + '"]').classList.add('correct');
    const explanations = {
      ok:'Да. Случайное облако вокруг нулевой линии не показывает очевидной систематической структуры.',
      hetero:'Да. Разброс остатков заметно меняется по X — это визуальный сигнал возможной гетероскедастичности.',
      nonlinear:'Да. Систематическая дуга означает, что линейная форма не улавливает структуру зависимости.'
    };
    setFeedback(
      $('#diagFeedback'),
      ok,
      ok ? explanations[state.diagType] : 'Посмотри не на отдельные точки, а на форму всего облака остатков.'
    );
    if (ok) complete(6);
  }

  function newDuel() {
    const best = rnd(14,19), mid = best+rnd(2.2,4.8), worst = mid+rnd(1.3,3.6);
    state.duelModels = shuffle([
      {name:'Модель A',vars:2,r2:rnd(.53,.64),adj:rnd(.51,.62),rmse:worst},
      {name:'Модель B',vars:5,r2:rnd(.68,.78),adj:rnd(.64,.74),rmse:best,best:true},
      {name:'Модель C',vars:11,r2:rnd(.80,.90),adj:rnd(.69,.79),rmse:mid}
    ]);
    const box = $('#modelCards');
    box.innerHTML = '';
    state.duelModels.forEach(m => {
      const el = document.createElement('article');
      el.className = 'card model-card';
      el.innerHTML = '<div class="card-kicker">'+m.vars+' предикторов</div><h3>'+m.name+'</h3><div class="model-metrics"><div><span>R² train</span><strong>'+m.r2.toFixed(2)+'</strong></div><div><span>Adj. R²</span><strong>'+m.adj.toFixed(2)+'</strong></div><div><span>RMSE test</span><strong>'+m.rmse.toFixed(1)+'</strong></div></div>';
      el.addEventListener('click', () => answerDuel(m,el));
      box.append(el);
    });
    $('#modelFeedback').textContent = '';
    $('#modelFeedback').className = 'feedback standalone';
  }

  function answerDuel(m,el) {
    $$('.model-card').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
    if (m.best) {
      setFeedback($('#modelFeedback'),true,'Верно. Для поставленной цели — прогноз на новых данных — здесь ключевой ориентир: минимальный RMSE на test-наборе.');
      complete(7);
    } else {
      setFeedback($('#modelFeedback'),false,'У этой модели тестовая ошибка выше. Высокий train R² сам по себе не гарантирует лучший прогноз вне обучающей выборки.');
    }
  }


  const glossary = {
    regression:{title:'Регрессия',text:'Способ описать среднюю связь между результатом Y и одной или несколькими переменными X, а также получать прогнозы.'},
    y:{title:'Y — зависимая переменная',text:'То, что мы хотим объяснить или предсказать. Например, балл экзамена.'},
    x:{title:'X — предиктор',text:'Переменная, с помощью которой мы объясняем или предсказываем Y. Например, часы подготовки.'},
    prediction:{title:'Прогноз (Ŷ)',text:'Значение Y, которое рассчитала модель. Оно не обязано точно совпасть с реальным наблюдением.'},
    intercept:{title:'Свободный член β₀',text:'Прогноз Y, когда все X равны нулю. Иногда он содержательно важен, а иногда ноль X вообще не имеет практического смысла.'},
    coefficient:{title:'Коэффициент β',text:'Число при переменной. Оно показывает, насколько в среднем меняется прогноз Y при увеличении этой переменной на одну единицу, при прочих равных.'},
    beta1:{title:'β₁ — коэффициент наклона',text:'Показывает направление и величину среднего изменения прогнозируемого Y при изменении X на одну единицу.'},
    ols:{title:'OLS / МНК',text:'Метод наименьших квадратов. Он выбирает линию так, чтобы сумма квадратов вертикальных ошибок прогноза была минимальной.'},
    sse:{title:'SSE',text:'Сумма квадратов остатков. Чем она меньше для одних и тех же данных, тем ближе линия к наблюдениям.'},
    r2:{title:'R²',text:'Доля вариации Y, которую описывает модель в рассматриваемых данных. R² не является доказательством причинности и не гарантирует хороший прогноз на новых данных.'},
    residual:{title:'Остаток',text:'Ошибка прогноза для одного наблюдения: реальное Y минус предсказанное Ŷ.'},
    outlier:{title:'Выброс',text:'Наблюдение, заметно отличающееся от основной массы данных. Не каждый выброс вреден, но его влияние нужно проверять.'},
    leverage:{title:'Leverage — рычаг',text:'Насколько необычно положение наблюдения по X. Точка далеко от остальных по X может сильно тянуть регрессионную линию.'},
    dummy:{title:'Dummy-переменная',text:'Переменная-код 0/1 для категорий. 0 — базовая категория, 1 — сравниваемая.'},
    control:{title:'Контрольная переменная',text:'Дополнительный фактор, который включают в модель, чтобы сравнивать значения главного X при одинаковом значении этого фактора.'},
    heteroskedasticity:{title:'Гетероскедастичность',text:'Ситуация, когда разброс ошибок модели меняется при разных значениях X или прогноза.'},
    nonlinearity:{title:'Нелинейность',text:'Связь, которую прямая линия описывает плохо: например, зависимость имеет форму дуги.'},
    rmse:{title:'RMSE',text:'Средний типичный размер ошибки прогноза в единицах Y. Для одинаковой задачи меньший test RMSE обычно означает лучший прогноз на новых данных.'},
    adjustedr2:{title:'Скорректированный R²',text:'Версия R², которая учитывает число предикторов и не награждает модель так щедро просто за добавление новых X.'},
    pvalue:{title:'p-value',text:'При нулевой гипотезе и предпосылках теста — вероятность получить такие же или более экстремальные данные. Это НЕ вероятность истинности гипотезы.'},
    null:{title:'Нулевая гипотеза',text:'Рабочая гипотеза для статистического теста, часто формулируемая как отсутствие эффекта или коэффициент, равный нулю.'},
    multicollinearity:{title:'Мультиколлинеарность',text:'Ситуация, когда несколько предикторов несут очень похожую информацию. Тогда отдельные коэффициенты сложнее стабильно оценить.'},
    vif:{title:'VIF',text:'Показатель того, насколько один предиктор объясняется другими предикторами. Большие значения могут указывать на проблему дублирования информации.'},
    association:{title:'Ассоциация',text:'Статистическая связь: значения переменных систематически меняются вместе. Ассоциация сама по себе не доказывает причинность.'},
    causality:{title:'Причинность',text:'Утверждение, что изменение X вызывает изменение Y. Для такого вывода одной регрессии на наблюдательных данных обычно недостаточно.'},
    noise:{title:'Шум',text:'Часть различий в Y, которую выбранные X не объясняют: случайность, измерительные ошибки и неучтённые факторы.'},
    sample:{title:'Выборка',text:'Набор наблюдений, на которых мы строим и проверяем модель.'}
  };

  function renderPredictionMachine(){
    const x = Number($('#predictX').value || 0);
    $('#predictY').textContent = 20 + 5*x;
  }

  function checkPrediction(){
    const v = Number(String($('#predictAnswer').value).replace(',','.'));
    if (v === 30){
      setFeedback($('#predictionFeedback'),true,'Верно. 12 + 3×6 = 30. Ты только что вручную сделал прогноз по регрессии.');
      complete(8);
    } else {
      setFeedback($('#predictionFeedback'),false,'Почти. Сначала умножь коэффициент при X на значение X: 3×6=18. Затем добавь свободный член 12.');
    }
  }

  function initRolesGame(){
    document.querySelectorAll('#variableBank .variable-chip').forEach(b=>b.addEventListener('click',()=>{
      state.selectedRoleVar=b.dataset.var;
      document.querySelectorAll('#variableBank .variable-chip').forEach(x=>x.classList.remove('selected'));
      b.classList.add('selected');
      $('#selectedVariable').textContent='Выбрано: '+b.textContent+'. Теперь нажми на роль справа.';
    }));
    document.querySelectorAll('.role-slot').forEach(slot=>slot.addEventListener('click',()=>{
      if(!state.selectedRoleVar){ toast('Сначала выбери переменную слева'); return; }
      const role=slot.dataset.role;
      state.roleAssignments[role]=state.selectedRoleVar;
      const src=$('#variableBank [data-var="'+state.selectedRoleVar+'"]');
      slot.classList.add('filled');
      slot.querySelector('strong').textContent=src ? src.textContent : state.selectedRoleVar;
      state.selectedRoleVar=null;
      document.querySelectorAll('#variableBank .variable-chip').forEach(x=>x.classList.remove('selected'));
      $('#selectedVariable').textContent='Можно назначить следующую переменную.';
    }));
    $('#checkRoles').addEventListener('click',()=>{
      const a=state.roleAssignments;
      const ok=a.y==='score'&&a.x==='hours'&&a.control==='year';
      setFeedback($('#rolesFeedback'),ok,ok
        ? 'Да. Y — результат экзамена, X — часы подготовки, а курс обучения — дополнительный контроль.'
        : 'Проверь логику вопроса: что мы хотим предсказать? Что является главным интересующим фактором? Что лишь дополнительно учитываем?');
      if(ok) complete(9);
    });
  }

  function initDummy(){
    document.querySelectorAll('.dummy-choice').forEach(b=>b.addEventListener('click',()=>{
      document.querySelectorAll('.dummy-choice').forEach(x=>x.classList.remove('active'));
      b.classList.add('active');
      $('#dummyPrediction').textContent=50+8*Number(b.dataset.d);
    }));
    document.querySelectorAll('#dummyAnswers button').forEach(b=>b.addEventListener('click',()=>{
      const ok=b.dataset.answer==='diff';
      document.querySelectorAll('#dummyAnswers button').forEach(x=>x.disabled=true);
      b.classList.add(ok?'correct':'wrong');
      $('#dummyAnswers [data-answer="diff"]').classList.add('correct');
      setFeedback($('#dummyFeedback'),ok,ok
        ? 'Верно. При D=0 прогноз 50, при D=1 — 58. Разница равна коэффициенту +8.'
        : 'Нет. Здесь +8 — разница в единицах Y между группой 1 и базовой группой 0, а не проценты и не доказанная причинность.');
      if(ok) complete(10);
    }));
  }

  function renderMultiple(){
    const study=Number($('#studySlider').value), sleep=Number($('#sleepSlider').value);
    $('#studyOut').textContent=study;
    $('#sleepOut').textContent=sleep;
    $('#multiplePrediction').textContent=30+4*study+2*sleep;
  }

  function initMultiple(){
    $('#studySlider').addEventListener('input',renderMultiple);
    $('#sleepSlider').addEventListener('input',renderMultiple);
    renderMultiple();
    document.querySelectorAll('#multipleAnswers button').forEach(b=>b.addEventListener('click',()=>{
      const ok=b.dataset.answer==='four';
      document.querySelectorAll('#multipleAnswers button').forEach(x=>x.disabled=true);
      b.classList.add(ok?'correct':'wrong');
      $('#multipleAnswers [data-answer="four"]').classList.add('correct');
      setFeedback($('#multipleFeedback'),ok,ok
        ? 'Именно. Сон мысленно фиксируем на одном уровне, а подготовку увеличиваем на 1 час — прогноз меняется на +4.'
        : 'Смысл коэффициента 4 как раз в сравнении при одинаковом сне: +1 час подготовки соответствует +4 к прогнозу.');
      if(ok) complete(11);
    }));
  }

  function renderP(){
    const p=Number($('#pSlider').value)/1000;
    $('#pValueOut').textContent=p.toFixed(3);
    document.querySelectorAll('.lamp').forEach(x=>x.classList.remove('active'));
    let text='';
    if(p<.05){ $('#lampGreen').classList.add('active'); text='Есть статистический сигнал при пороге 0,05';}
    else if(p<.10){ $('#lampAmber').classList.add('active'); text='Пограничная зона при условном пороге 0,05';}
    else { $('#lampRed').classList.add('active'); text='Данных недостаточно, чтобы отвергнуть нулевую гипотезу при пороге 0,05';}
    $('#pPlainLanguage').textContent=text;
  }

  function initP(){
    $('#pSlider').addEventListener('input',renderP);
    renderP();
    document.querySelectorAll('#pAnswers button').forEach(b=>b.addEventListener('click',()=>{
      const ok=b.dataset.answer==='wrong';
      document.querySelectorAll('#pAnswers button').forEach(x=>x.disabled=true);
      b.classList.add(ok?'correct':'wrong');
      $('#pAnswers [data-answer="wrong"]').classList.add('correct');
      setFeedback($('#pFeedback'),ok,ok
        ? 'Да. p-value не сообщает вероятность того, что эффект настоящий. Он относится к вероятности получить такие или более экстремальные данные при нулевой гипотезе и предпосылках теста.'
        : 'Это распространённая ошибка. p=0,03 не означает 97% вероятности истинности эффекта.');
      if(ok) complete(12);
    }));
  }

  function initVif(){
    document.querySelectorAll('#twinOptions button').forEach(b=>b.addEventListener('click',()=>{
      const ok=b.dataset.answer==='income-salary';
      document.querySelectorAll('#twinOptions button').forEach(x=>{x.disabled=true;x.classList.remove('correct','wrong')});
      b.classList.add(ok?'correct':'wrong');
      $('#twinOptions [data-answer="income-salary"]').classList.add('correct');
      $('#vifValue').textContent=ok?'12.4':'2.1';
      $('#vifFill').style.width=ok?'86%':'24%';
      setFeedback($('#vifFeedback'),ok,ok
        ? 'Верно. Годовой доход и месячная зарплата почти измеряют одно и то же, поэтому вместе могут сильно дублировать информацию.'
        : 'Эта пара может быть связана, но не настолько прямолинейно. Ищи две переменные, которые почти являются разными единицами одной и той же величины.');
      if(ok) complete(13);
    }));
  }

  function initResearch(){
    document.querySelectorAll('#researchPool button').forEach(b=>b.addEventListener('click',()=>{
      state.selectedResearchVar=b.dataset.var;
      document.querySelectorAll('#researchPool button').forEach(x=>x.classList.remove('selected'));
      b.classList.add('selected');
      $('#researchHint').textContent='Выбрано: '+b.textContent+'. Теперь назначь роль.';
    }));
    document.querySelectorAll('#research .research-slots button').forEach(slot=>slot.addEventListener('click',()=>{
      if(!state.selectedResearchVar){ toast('Сначала выбери переменную сверху'); return; }
      const key=slot.dataset.slot;
      state.researchAssignments[key]=state.selectedResearchVar;
      const src=$('#researchPool [data-var="'+state.selectedResearchVar+'"]');
      slot.classList.add('filled');
      slot.querySelector('strong').textContent=src?src.textContent:state.selectedResearchVar;
      state.selectedResearchVar=null;
      document.querySelectorAll('#researchPool button').forEach(x=>x.classList.remove('selected'));
      $('#researchHint').textContent='Хорошо. Назначь следующую роль.';
    }));
    $('#checkResearch').addEventListener('click',()=>{
      const a=state.researchAssignments;
      const ok=a.y==='exam'&&a.x==='study'&&(a.control==='sleep'||a.control==='year');
      setFeedback($('#researchFeedback'),ok,ok
        ? 'Модель логична: результат экзамена — Y, часы подготовки — главный X, а сон или курс — разумный контроль. Это уже мышление исследователя.'
        : 'Собери модель по вопросу: результат экзамена должен быть Y, часы подготовки — главным X. Для контроля лучше взять сон или курс обучения, а не любимый кофе.');
      if(ok) complete(14);
    });
  }

  function initBeginnerMode(){
    document.body.classList.add('simple-mode');
    $('#simpleModeToggle').addEventListener('click',()=>{
      const on=!document.body.classList.contains('simple-mode');
      document.body.classList.toggle('simple-mode',on);
      $('#simpleModeToggle').setAttribute('aria-pressed',on?'true':'false');
      $('#simpleModeToggle').textContent='Объяснять совсем просто: '+(on?'ВКЛ':'ВЫКЛ');
    });
    document.querySelectorAll('[data-term]').forEach(b=>b.addEventListener('click',()=>{
      const t=glossary[b.dataset.term];
      if(!t) return;
      $('#termTitle').textContent=t.title;
      $('#termText').textContent=t.text;
      $('#termPopover').classList.add('show');
    }));
    $('#closeTerm').addEventListener('click',()=>$('#termPopover').classList.remove('show'));
  }


  let labData = [];

  function makeLabData(){
    labData = Array.from({length:24},(_,i)=>{
      const study = Math.max(0,Math.round((1.5 + (i%8)*.8 + normal()*1.2)*10)/10);
      const sleep = Math.max(4,Math.min(9,Math.round((6.8 + normal()*.9)*10)/10));
      const year = 1 + (i%4);
      const exam = Math.round(38 + 4.6*study + 2.2*sleep + 1.4*year + normal()*6.5);
      return {id:i+1,exam,study,sleep,year};
    });
    renderLabTable();
    $('#labResults').hidden = true;
    $('#labConclusionFeedback').textContent='';
    document.querySelectorAll('#labConclusionAnswers button').forEach(b=>{b.disabled=false;b.classList.remove('correct','wrong')});
  }

  function renderLabTable(){
    const body=$('#studentTable tbody');
    body.innerHTML='';
    labData.forEach(r=>{
      const tr=document.createElement('tr');
      tr.innerHTML='<td>'+r.id+'</td><td>'+r.exam+'</td><td>'+r.study.toFixed(1)+'</td><td>'+r.sleep.toFixed(1)+'</td><td>'+r.year+'</td>';
      body.append(tr);
    });
  }

  function transpose(A){ return A[0].map((_,i)=>A.map(r=>r[i])); }
  function matMul(A,B){ return A.map(r=>B[0].map((_,j)=>r.reduce((s,v,k)=>s+v*B[k][j],0))); }
  function inv(M){
    const n=M.length, A=M.map((r,i)=>[...r,...Array.from({length:n},(_,j)=>i===j?1:0)]);
    for(let i=0;i<n;i++){
      let p=i;
      for(let r=i+1;r<n;r++) if(Math.abs(A[r][i])>Math.abs(A[p][i])) p=r;
      [A[i],A[p]]=[A[p],A[i]];
      let d=A[i][i];
      if(Math.abs(d)<1e-10) return null;
      for(let j=0;j<2*n;j++) A[i][j]/=d;
      for(let r=0;r<n;r++) if(r!==i){
        const k=A[r][i];
        for(let j=0;j<2*n;j++) A[r][j]-=k*A[i][j];
      }
    }
    return A.map(r=>r.slice(n));
  }

  function multipleRegression(rows, yKey, xKeys){
    const X=rows.map(r=>[1,...xKeys.map(k=>Number(r[k]))]);
    const Y=rows.map(r=>[Number(r[yKey])]);
    const Xt=transpose(X), XtX=matMul(Xt,X), invXtX=inv(XtX);
    if(!invXtX) return null;
    const beta=matMul(matMul(invXtX,Xt),Y).map(r=>r[0]);
    const fitted=rows.map((r,i)=>X[i].reduce((s,v,j)=>s+v*beta[j],0));
    const residuals=rows.map((r,i)=>Number(r[yKey])-fitted[i]);
    const mean=rows.reduce((s,r)=>s+Number(r[yKey]),0)/rows.length;
    const sse=residuals.reduce((s,e)=>s+e*e,0);
    const sst=rows.reduce((s,r)=>s+(Number(r[yKey])-mean)**2,0);
    return {beta,fitted,residuals,r2:1-sse/sst,rmse:Math.sqrt(sse/rows.length),xKeys};
  }

  function varLabel(k){
    return {study:'Часы подготовки',sleep:'Часы сна',year:'Курс обучения',exam:'Результат экзамена'}[k]||k;
  }

  function runLabRegression(){
    const y=$('#labY').value, x=$('#labX').value, c=$('#labControl').value;
    if(c===x){
      toast('Контроль не должен повторять главный X');
      return;
    }
    const keys=[x,...(c==='none'?[]:[c])];
    const m=multipleRegression(labData,y,keys);
    if(!m){ toast('Эту модель сейчас нельзя посчитать'); return; }
    $('#labResults').hidden=false;
    $('#labR2').textContent=clamp(m.r2,0,1).toFixed(2);
    $('#labR2Plain').textContent='Простыми словами: эта конкретная модель описывает примерно '+Math.round(clamp(m.r2,0,1)*100)+'% различий в результатах экзамена в нашем учебном наборе. Остальное остаётся за другими факторами и случайным шумом.';
    const body=$('#labCoeffBody');
    body.innerHTML='';
    const intercept=document.createElement('tr');
    intercept.innerHTML='<td>Константа</td><td>'+fmt(m.beta[0],2)+'</td><td>Базовый уровень прогноза, когда все X равны нулю. Иногда он содержательно интересен, иногда — нет.</td>';
    body.append(intercept);
    keys.forEach((k,i)=>{
      const tr=document.createElement('tr');
      const b=m.beta[i+1];
      tr.innerHTML='<td>'+varLabel(k)+'</td><td>'+fmt(b,2)+'</td><td>При увеличении «'+varLabel(k)+'» на 1 единицу прогноз экзамена в среднем меняется на '+fmt(b,2)+' балла'+(keys.length>1?' при прочих включённых переменных равных.':'.')+'</td>';
      body.append(tr);
    });
    const pts=m.residuals.map((e,i)=>({x:i+1,y:e}));
    drawScatter($('#labResidualChart'),pts,{w:620,h:340,pad:42,zeroY:0,fixed:{xmin:0,xmax:25,ymin:-24,ymax:24}});
    const mainB=m.beta[1];
    $('#labNarrative').textContent='В учебной модели главный коэффициент для переменной «'+varLabel(x)+'» равен '+fmt(mainB,2)+'. Это означает: при увеличении этого X на одну единицу прогноз результата экзамена в среднем меняется примерно на '+fmt(mainB,2)+' балла'+(keys.length>1?' при фиксированном значении контроля «'+varLabel(c)+'».':'')+' R² модели равен '+clamp(m.r2,0,1).toFixed(2)+'. Это описание связи в данных, а не автоматическое доказательство причинности.';
    $('#labResults').scrollIntoView({behavior:'smooth',block:'start'});
  }

  function initDataLab(){
    makeLabData();
    $('#regenDataset').addEventListener('click',makeLabData);
    $('#runLabRegression').addEventListener('click',runLabRegression);
    document.querySelectorAll('#labConclusionAnswers button').forEach(b=>b.addEventListener('click',()=>{
      const ok=b.dataset.answer==='causality';
      document.querySelectorAll('#labConclusionAnswers button').forEach(x=>x.disabled=true);
      b.classList.add(ok?'correct':'wrong');
      $('#labConclusionAnswers [data-answer="causality"]').classList.add('correct');
      setFeedback($('#labConclusionFeedback'),ok,ok
        ? 'Верно. Положительный коэффициент показывает ассоциацию в модели, но сам по себе не доказывает причинный эффект.'
        : 'Этот вывод допустим как описание модели. Ошибка — автоматически объявить найденную связь причинной.');
      if(ok) complete(15);
    }));
  }

  const quizBank = [
    {q:'В модели Ŷ = 10 + 2X чему равен прогноз при X = 4?',a:['12','18','24','40'],right:1,why:'10 + 2×4 = 18.'},
    {q:'Что минимизирует обычный МНК (OLS)?',a:['Сумму абсолютных X','Сумму квадратов остатков','Число коэффициентов','R²'],right:1,why:'OLS выбирает коэффициенты, минимизирующие сумму квадратов остатков.'},
    {q:'β₁ = −3. Какое чтение корректно?',a:['X объясняет 3% Y','При +1 к X прогноз Y в среднем меняется на −3','Y всегда падает на 3','R² = −3'],right:1,why:'Коэффициент наклона — изменение прогнозируемого Y при увеличении X на одну единицу.'},
    {q:'R² = 0,72. Что это означает в рамках модели?',a:['72% наблюдений предсказаны точно','Модель объясняет 72% вариации Y в данной выборке','Причинность доказана на 72%','Ошибка модели равна 28 единицам'],right:1,why:'R² описывает долю вариации Y, объясняемую моделью в рассматриваемых данных.'},
    {q:'На графике остатков видна чёткая U-образная дуга. Самая вероятная проблема?',a:['Нелинейность спецификации','Идеальная модель','Слишком высокий R²','Dummy-переменная'],right:0,why:'Систематическая форма в остатках — сигнал пропущенной структуры; дуга часто указывает на нелинейность.'},
    {q:'Dummy-переменная принимает 0/1. Её коэффициент обычно интерпретируют как…',a:['Среднюю разницу с базовой категорией при прочих равных','Вероятность ошибки','Количество категорий','R² категории'],right:0,why:'Коэффициент dummy показывает сдвиг относительно опорной категории при прочих равных.'},
    {q:'Добавили много слабых предикторов. Что обязательно НЕ следует из роста обычного R²?',a:['Что модель стала лучше прогнозировать новые данные','Что R² не уменьшился','Что модель стала сложнее','Что появились новые коэффициенты'],right:0,why:'Train R² обычно не падает от новых предикторов, но качество на новых данных может ухудшиться.'},
    {q:'Остаток для наблюдения — это…',a:['X − среднее X','Наблюдаемый Y − предсказанный Y','β₀ + β₁','R² − 1'],right:1,why:'eᵢ = yᵢ − ŷᵢ.'},
    {q:'Что верно про корреляцию/регрессионную связь и причинность?',a:['Сильная связь автоматически доказывает причинность','Причинный вывод требует дополнительного дизайна и допущений','β₁ всегда причинный эффект','R² выше 0,5 доказывает причинность'],right:1,why:'Наблюдаемая ассоциация сама по себе не устанавливает причинный эффект.'},
    {q:'Если точка далеко от основной массы по X, она может иметь высокий…',a:['leverage','intercept','sample size','dummy'],right:0,why:'Экстремальное положение по пространству предикторов связано с высоким leverage.'},
    {q:'В множественной регрессии фраза «при прочих равных» означает…',a:['Остальные включённые предикторы считаются фиксированными','Все наблюдения равны','R² фиксирован','Ошибки равны нулю'],right:0,why:'Частный коэффициент описывает изменение Y по X при фиксированных остальных включённых переменных.'},
    {q:'Что лучше использовать для сравнения прогноза на новых данных?',a:['Только train R²','Test RMSE','Только число переменных','Знак β₀'],right:1,why:'Метрика на отложенных данных напрямую оценивает ошибку вне обучающей выборки.'}
  ];

  function startQuiz() {
    state.quiz = {active:true,index:0,score:0,locked:false,order:shuffle(quizBank).slice(0,10)};
    $('#quizStart').style.display = 'none';
    $('#quizNext').disabled = true;
    renderQuiz();
  }

  function renderQuiz() {
    const q = state.quiz.order[state.quiz.index];
    $('#quizCounter').textContent = 'Вопрос ' + (state.quiz.index+1) + ' / 10';
    $('#quizScore').textContent = state.quiz.score;
    $('#quizProgressFill').style.width = (state.quiz.index*10) + '%';
    $('#quizQuestion').textContent = q.q;
    const box = $('#quizAnswers');
    box.innerHTML = '';
    q.a.forEach((text,i) => {
      const b = document.createElement('button');
      b.textContent = text;
      b.addEventListener('click', () => answerQuiz(i,b));
      box.append(b);
    });
    $('#quizFeedback').textContent = '';
    $('#quizFeedback').className = 'feedback dark-feedback';
    state.quiz.locked = false;
    $('#quizNext').disabled = true;
  }

  function answerQuiz(i,btn) {
    if (state.quiz.locked) return;
    state.quiz.locked = true;
    const q = state.quiz.order[state.quiz.index], ok = i === q.right;
    if (ok) state.quiz.score++;
    $('#quizScore').textContent = state.quiz.score;
    $$('#quizAnswers button').forEach((b,j) => {
      b.disabled = true;
      if (j === q.right) b.classList.add('correct');
    });
    btn.classList.add(ok ? 'correct' : 'wrong');
    setFeedback($('#quizFeedback'),ok,(ok ? 'Верно. ' : 'Не совсем. ') + q.why);
    $('#quizNext').disabled = false;
  }

  function nextQuiz() {
    if (!state.quiz.active) return;
    if (state.quiz.index < 9) {
      state.quiz.index++;
      renderQuiz();
      return;
    }
    $('#quizProgressFill').style.width = '100%';
    $('#quizCounter').textContent = 'Финиш';
    $('#quizQuestion').textContent = 'Результат: ' + state.quiz.score + ' из 10';
    $('#quizAnswers').innerHTML = '';
    const msg = state.quiz.score >= 8
      ? 'Сильный результат. Базовая логика регрессии собрана в систему.'
      : state.quiz.score >= 5
      ? 'Основа есть. Ошибки выше показывают, какие темы стоит повторить.'
      : 'Лучше пройти лаборатории ещё раз: особенно коэффициенты, остатки и диагностику.';
    setFeedback($('#quizFeedback'),state.quiz.score >= 8,msg);
    $('#quizNext').disabled = true;
    $('#quizStart').style.display = 'inline-flex';
    $('#quizStart').textContent = 'Пройти ещё раз';
    state.quiz.active = false;
    complete(16);
  }

  function launchConfetti() {
    const canvas = $('#confetti'), ctx = canvas.getContext('2d');
    canvas.width = innerWidth;
    canvas.height = innerHeight;
    const pieces = Array.from({length:120},() => ({
      x:rnd(0,canvas.width),y:rnd(-canvas.height*.2,0),vx:rnd(-1.5,1.5),vy:rnd(2,6),s:rnd(3,8),r:rnd(0,Math.PI*2)
    }));
    let f = 0;
    function tick() {
      ctx.clearRect(0,0,canvas.width,canvas.height);
      pieces.forEach((p,i) => {
        p.x += p.vx;
        p.y += p.vy;
        p.r += .05;
        ctx.save();
        ctx.translate(p.x,p.y);
        ctx.rotate(p.r);
        ctx.fillStyle = ['#4868ff','#6dff9a','#ffb347','#ff5f6d'][i%4];
        ctx.fillRect(-p.s/2,-p.s/2,p.s,p.s*1.8);
        ctx.restore();
      });
      if (f++ < 170) requestAnimationFrame(tick);
      else ctx.clearRect(0,0,canvas.width,canvas.height);
    }
    tick();
  }

  function bind() {
    $('#rhoSlider').addEventListener('input',renderHero);
    $('#noiseSlider').addEventListener('input',renderHero);
    $('#regenIntuition').addEventListener('click',newIntuition);
    $$('#intuitionAnswers button').forEach(b => b.addEventListener('click',() => answerIntuition(b)));

    $('#b0Slider').addEventListener('input',renderLineGame);
    $('#b1Slider').addEventListener('input',renderLineGame);
    $('#checkLine').addEventListener('click',checkLine);

    $('#newCoefficientTask').addEventListener('click',newCoefficientTask);

    $('#outlierToggle').addEventListener('click',() => {
      state.outlierOn = !state.outlierOn;
      renderOutlier();
    });
    $$('#outlierAnswers button').forEach(b => b.addEventListener('click',() => answerOutlier(b)));

    $$('#diagAnswers button').forEach(b => b.addEventListener('click',() => answerDiag(b)));
    $('#nextDiag').addEventListener('click',newDiag);
    $('#newModelDuel').addEventListener('click',newDuel);

    $('#quizStart').addEventListener('click',startQuiz);
    $('#quizNext').addEventListener('click',nextQuiz);

    $('#progressPill').addEventListener('click',() => $('.mastery').scrollIntoView({behavior:'smooth'}));
    $('#resetProgress').addEventListener('click',() => {
      localStorage.removeItem(NS+':completed');
      state.completed.clear();
      updateProgress();
      toast('Прогресс сброшен');
    });
  }

  function init() {
    bind();
    updateProgress();
    initReveal();
    renderHero();
    newIntuition();
    initLineGame();
    newCoefficientTask();
    renderOutlier();
    newResidualGame();
    newDiag();
    newDuel();
    renderPredictionMachine();
    $('#predictX').addEventListener('input',renderPredictionMachine);
    $('#checkPrediction').addEventListener('click',checkPrediction);
    initRolesGame();
    initDummy();
    initMultiple();
    initP();
    initVif();
    initResearch();
    initBeginnerMode();
    initDataLab();
  }

  document.addEventListener('DOMContentLoaded',init);
})();