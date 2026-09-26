(() => {
  'use strict';

  const NS = 'regression-lab-v1';
  const TOTAL = 8;
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
    complete(8);
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
  }

  document.addEventListener('DOMContentLoaded',init);
})();