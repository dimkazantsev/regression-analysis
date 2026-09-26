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
    attempts: {}, quiz: { active: false, index: 0, score: 0, locked: false, order: [], attempts: 0 }
  };

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rnd = (a, b) => a + Math.random() * (b - a);
  const fmt = (v, d = 2) => Number(v).toFixed(d).replace(/\.00$/, '');


  function attempt(chapter){
    state.attempts[chapter]=(state.attempts[chapter]||0)+1;
    return state.attempts[chapter];
  }
  function resetAttempts(chapter){ state.attempts[chapter]=0; }
  function clearChoiceGroup(selector, feedbackSelector){
    document.querySelectorAll(selector).forEach(b=>{
      b.disabled=false;
      b.classList.remove('correct','wrong');
      b.removeAttribute('aria-disabled');
    });
    const fb=$(feedbackSelector);
    if(fb){ fb.textContent=''; fb.className='feedback'+(fb.classList.contains('dark-feedback')?' dark-feedback':''); }
  }
  function finishChoiceGroup(selector, rightBtn){
    document.querySelectorAll(selector).forEach(b=>b.disabled=true);
    if(rightBtn) rightBtn.classList.add('correct');
  }
  function practicePrefix(n){ return 'Попытка '+n+'. '; }


  function resetChapterExercise(chapter){
    const ch=Number(chapter);
    resetAttempts(ch);
    if(ch===1){ newIntuition(); toast('Новый набор точек создан'); return; }
    if(ch===2){
      $('#b0Slider').value=20; $('#b1Slider').value=.5;
      $('#lineFeedback').textContent=''; $('#lineFeedback').className='feedback dark-feedback';
      initLineGame(); renderLineGame(); toast('Новая модель создана'); return;
    }
    if(ch===3){ newCoefficientTask(); toast('Новая задача на коэффициент'); return; }
    if(ch===4){
      state.outlierOn=false; renderOutlier();
      clearChoiceGroup('#outlierAnswers button','#outlierFeedback');
      toast('Эксперимент с выбросом сброшен'); return;
    }
    if(ch===5){ newResidualGame(); toast('Новый набор остатков'); return; }
    if(ch===6){ newDiag(); toast('Новый диагностический график'); return; }
    if(ch===7){ newDuel(); toast('Новая дуэль моделей'); return; }
    if(ch===8){
      $('#predictX').value=4; renderPredictionMachine();
      $('#predictAnswer').value='';
      $('#predictAnswer').disabled=false;
      $('#checkPrediction').disabled=false;
      $('#predictionFeedback').textContent=''; $('#predictionFeedback').className='feedback';
      toast('Задание на прогноз сброшено'); return;
    }
    if(ch===9){
      state.selectedRoleVar=null; state.roleAssignments={y:null,x:null,control:null};
      document.querySelectorAll('#variableBank .variable-chip').forEach(x=>x.classList.remove('selected'));
      document.querySelectorAll('.role-slot').forEach(slot=>{
        slot.classList.remove('filled');
        const role=slot.dataset.role;
        const labels={y:'Что предсказываем?',x:'Главный предиктор',control:'Контроль'};
        slot.querySelector('strong').textContent=labels[role];
      });
      document.querySelectorAll('#variableBank .variable-chip,.role-slot').forEach(x=>x.disabled=false);
      $('#selectedVariable').textContent='Сначала выбери карточку переменной.';
      $('#rolesFeedback').textContent=''; $('#rolesFeedback').className='feedback';
      toast('Роли очищены'); return;
    }
    if(ch===10){
      document.querySelectorAll('.dummy-choice').forEach((x,i)=>x.classList.toggle('active',i===0));
      $('#dummyPrediction').textContent='50';
      clearChoiceGroup('#dummyAnswers button','#dummyFeedback');
      toast('Новый раунд dummy-переменной'); return;
    }
    if(ch===11){
      $('#studySlider').value=3; $('#sleepSlider').value=7; renderMultiple();
      clearChoiceGroup('#multipleAnswers button','#multipleFeedback');
      toast('Модель возвращена к началу'); return;
    }
    if(ch===12){
      $('#pSlider').value=32; renderP();
      clearChoiceGroup('#pAnswers button','#pFeedback');
      toast('Новый раунд p-value'); return;
    }
    if(ch===13){
      document.querySelectorAll('#twinOptions button').forEach(x=>{x.disabled=false;x.classList.remove('correct','wrong')});
      $('#vifValue').textContent='?'; $('#vifFill').style.width='0';
      $('#vifFeedback').textContent=''; $('#vifFeedback').className='feedback';
      toast('Новый раунд VIF'); return;
    }
    if(ch===14){
      state.selectedResearchVar=null; state.researchAssignments={y:null,x:null,control:null};
      document.querySelectorAll('#researchPool button').forEach(x=>x.classList.remove('selected'));
      document.querySelectorAll('#research .research-slots button').forEach(slot=>{
        slot.classList.remove('filled');
        slot.querySelector('strong').textContent='?';
      });
      $('#researchHint').textContent='Выбери переменную, затем назначь ей роль.';
      $('#researchFeedback').textContent=''; $('#researchFeedback').className='feedback dark-feedback';
      toast('Исследовательская модель очищена'); return;
    }
    if(ch===15){
      makeLabData();
      clearChoiceGroup('#labConclusionAnswers button','#labConclusionFeedback');
      toast('Новый набор данных создан'); return;
    }
    if(ch===16){ startQuiz(); toast('Новый финальный квиз'); return; }
  }

  function addPracticeRestartButtons(){
    document.querySelectorAll('[data-chapter]').forEach(section=>{
      const chapter=section.dataset.chapter;
      const holder=section.classList.contains('chapter') ? section : section.querySelector('.chapter');
      if(!holder || holder.querySelector('.practice-restart')) return;
      const task=[...holder.children].find(x=>x.classList.contains('task-stage'));
      if(!task) return;
      const bar=document.createElement('div');
      bar.className='practice-toolbar task-stage is-locked';
      bar.innerHTML='<div><span>Тренировочный режим</span><strong>Ошибаться можно сколько угодно</strong><p>Неверный ответ не закрывает задание. После правильного ответа начни новый раунд.</p></div><button class="btn ghost practice-restart" type="button">↻ Новый раунд</button>';
      holder.insertBefore(bar,task);
      bar.querySelector('.practice-restart').addEventListener('click',()=>resetChapterExercise(chapter));
      if(localStorage.getItem(NS+':lesson:'+chapter)==='1') bar.classList.remove('is-locked');
    });
  }

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
      if (options.smooth) c.style.transition = 'cx .22s ease, cy .22s ease, r .15s ease, opacity .15s ease';
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

  function showNextBlockButton(chapter){
    const section=document.querySelector('[data-chapter="'+chapter+'"]');
    if(!section) return;
    const holder=section.classList.contains('chapter')?section:section.querySelector('.chapter');
    if(!holder) return;
    let wrap=holder.querySelector('.next-block-wrap');
    if(!wrap){
      wrap=document.createElement('div');
      wrap.className='next-block-wrap';
      const n=Number(chapter);
      wrap.innerHTML=n<TOTAL
        ? '<div><span>Готово</span><strong>Можно двигаться дальше</strong><p>Следующий раздел продолжит эту идею.</p></div><button class="btn primary next-block-btn" type="button">Дальше по курсу ↓</button>'
        : '<div><span>Готово</span><strong>Финал завершён</strong><p>Перейди к итогам курса и своему прогрессу.</p></div><button class="btn primary next-block-btn" type="button">К итогам курса ↓</button>';
      holder.append(wrap);
      wrap.querySelector('.next-block-btn').addEventListener('click',()=>{
        if(n<TOTAL){
          const next=document.querySelector('[data-chapter="'+(n+1)+'"]');
          if(next) next.scrollIntoView({behavior:'smooth',block:'start'});
        }else{
          const mastery=document.querySelector('.mastery');
          if(mastery) mastery.scrollIntoView({behavior:'smooth',block:'start'});
        }
      });
    }
    wrap.classList.add('show');
  }

  function restoreNextButtons(){
    state.completed.forEach(ch=>showNextBlockButton(Number(ch)));
  }

  function complete(chapter) {
    const before = state.completed.size;
    state.completed.add(String(chapter));
    localStorage.setItem(NS + ':completed', JSON.stringify([...state.completed]));
    updateProgress();
    if (state.completed.size > before) toast('Раздел ' + chapter + ' пройден');
    showNextBlockButton(chapter);
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

  function standardize(values){
    const mean=values.reduce((a,b)=>a+b,0)/values.length;
    const centered=values.map(v=>v-mean);
    const sd=Math.sqrt(centered.reduce((a,b)=>a+b*b,0)/centered.length)||1;
    return centered.map(v=>v/sd);
  }

  const heroBase = (() => {
    const rawX=Array.from({length:42},(_,i)=>i);
    const zx=standardize(rawX);
    let ze=standardize(Array.from({length:42},(_,i)=>
      Math.sin((i+1)*1.73)+0.55*Math.cos((i+1)*2.41)+0.25*Math.sin((i+1)*.61)
    ));
    const dot=zx.reduce((sum,v,i)=>sum+v*ze[i],0)/zx.reduce((sum,v)=>sum+v*v,0);
    ze=standardize(ze.map((v,i)=>v-dot*zx[i]));
    return zx.map((xz,i)=>({xz,ez:ze[i]}));
  })();

  function renderHero() {
    const rho = Number($('#rhoSlider').value);
    const spread = Number($('#noiseSlider').value);
    $('#rhoOut').textContent = rho.toFixed(2);
    $('#noiseOut').textContent = spread;

    const residualWeight=Math.sqrt(Math.max(0,1-rho*rho));
    const visualScale=spread*.62;
    const points=heroBase.map(p=>({
      x:50+22*p.xz,
      y:50+visualScale*(rho*p.xz+residualWeight*p.ez)
    }));
    const reg=regression(points);

    drawScatter($('#heroChart'),points,{
      w:600,h:360,line:reg,pad:38,
      fixed:{xmin:0,xmax:100,ymin:0,ymax:100},
      smooth:true
    });

    const mx=points.reduce((a,p)=>a+p.x,0)/points.length;
    const my=points.reduce((a,p)=>a+p.y,0)/points.length;
    const sx=Math.sqrt(points.reduce((a,p)=>a+(p.x-mx)**2,0)/points.length);
    const sy=Math.sqrt(points.reduce((a,p)=>a+(p.y-my)**2,0)/points.length);
    const corr=points.reduce((a,p)=>a+(p.x-mx)*(p.y-my),0)/points.length/(sx*sy);

    $('#heroBeta').textContent=fmt(reg.b1,2);
    $('#heroR2').textContent=clamp(reg.r2,0,1).toFixed(2);
    $('#rhoOut').textContent=corr.toFixed(2);
  }

  function newIntuition() {
    resetAttempts(1);
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
    const n=attempt(1);
    const ok = btn.dataset.answer === state.intuitionTruth;
    btn.classList.remove('wrong','correct');
    btn.classList.add(ok ? 'correct':'wrong');
    if(ok){
      finishChoiceGroup('#intuitionAnswers button',btn);
      setFeedback($('#intuitionFeedback'),true,practicePrefix(n)+'Верно. Ты считал именно общий наклон облака точек. Отдельные точки могут отклоняться, но важна общая тенденция.');
      complete(1);
    } else {
      const hints={
        positive:'Ты выбрал рост Y вместе с X. Проверь: действительно ли правая часть облака в среднем выше левой?',
        negative:'Ты выбрал снижение Y. Посмотри, идёт ли облако в целом сверху-слева вниз-вправо.',
        none:'Ты выбрал отсутствие связи. Проверь, нет ли всё-таки заметного общего наклона облака.'
      };
      setFeedback($('#intuitionFeedback'),false,practicePrefix(n)+hints[btn.dataset.answer]+' Попробуй ещё раз — задание остаётся открытым.');
    }
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
    resetAttempts(3);
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
    const n=attempt(3);
    const ok = btn.dataset.ok === '1';
    btn.classList.remove('wrong','correct');
    btn.classList.add(ok ? 'correct' : 'wrong');
    if(ok){
      finishChoiceGroup('#coefficientAnswers button',btn);
      setFeedback($('#coefficientFeedback'),true,practicePrefix(n)+'Верно. Ты прочитал β₁ как среднее изменение прогнозируемого Y при увеличении X на одну единицу.');
      complete(3);
    } else {
      const t=btn.textContent;
      let why='Коэффициент при X нужно переводить в изменение прогнозируемого Y при +1 к X.';
      if(t.includes('%')) why='Здесь коэффициент записан в обычных единицах, поэтому его нельзя автоматически превращать в проценты.';
      else if(t.includes('обязательно')||t.includes('доказывает')) why='Регрессионная ассоциация не означает гарантированный индивидуальный результат и сама по себе не доказывает причинность.';
      else if(t.includes('нулю')) why='β₀ описывает прогноз при X=0, но не гарантирует, что каждое наблюдение при X=0 будет ровно таким.';
      setFeedback($('#coefficientFeedback'),false,practicePrefix(n)+why+' Выбери другой вариант.');
    }
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
    const n=attempt(4);
    const ok = btn.dataset.answer === 'leverage';
    btn.classList.remove('wrong','correct');
    btn.classList.add(ok ? 'correct' : 'wrong');
    if(ok){
      finishChoiceGroup('#outlierAnswers button',btn);
      setFeedback($('#outlierFeedback'),true,practicePrefix(n)+'Верно. Точка находится далеко по X, поэтому имеет высокий leverage и способна заметно повернуть линию.');
      complete(4);
    } else {
      const why=btn.dataset.answer==='r2'
        ? 'R² вовсе не обязан становиться равным 1 из-за выброса. Выброс может даже ухудшить согласование модели с большинством точек.'
        : 'Влиятельная точка может менять не только β₀. Если она далеко по X, она способна заметно изменить и наклон β₁.';
      setFeedback($('#outlierFeedback'),false,practicePrefix(n)+why+' Сравни положение красной точки с остальным облаком и попробуй снова.');
    }
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
    resetAttempts(6);
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
    const n=attempt(6);
    const ok = btn.dataset.answer === state.diagType;
    btn.classList.remove('wrong','correct');
    btn.classList.add(ok ? 'correct' : 'wrong');
    const explanations = {
      ok:'Верно. Точки выглядят как случайное облако вокруг нулевой линии, без заметной систематической формы.',
      hetero:'Верно. Разброс остатков меняется по X — это визуальный сигнал возможной гетероскедастичности.',
      nonlinear:'Верно. Систематическая дуга означает, что прямая линия не улавливает форму зависимости.'
    };
    if(ok){
      finishChoiceGroup('#diagAnswers button',btn);
      setFeedback($('#diagFeedback'),true,practicePrefix(n)+explanations[state.diagType]);
      complete(6);
    } else {
      const why={
        ok:'Если бы всё было приемлемо, облако выглядело бы примерно случайным вокруг нуля. Здесь проверь, нет ли заметной формы.',
        hetero:'Гетероскедастичность похожа прежде всего на изменение ширины разброса — например, на воронку. Посмотри, именно это ли видно.',
        nonlinear:'Нелинейность обычно выдаёт систематическую кривую или дугу в остатках. Посмотри, есть ли она.'
      };
      setFeedback($('#diagFeedback'),false,practicePrefix(n)+why[btn.dataset.answer]+' Другие варианты всё ещё доступны.');
    }
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
      $('.model-card').forEach(c=>{c.style.pointerEvents='none';c.classList.add('locked-choice');});
      el.classList.remove('locked-choice');
      el.classList.add('selected','correct-model');
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
      $('#predictAnswer').disabled=true;
      $('#checkPrediction').disabled=true;
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
      if(ok){
        document.querySelectorAll('#variableBank .variable-chip,.role-slot').forEach(x=>x.disabled=true);
        complete(9);
      }
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
      const n=attempt(10);
      b.classList.remove('correct','wrong'); b.classList.add(ok?'correct':'wrong');
      if(ok){
        finishChoiceGroup('#dummyAnswers button',b);
        setFeedback($('#dummyFeedback'),true,practicePrefix(n)+'Верно. При D=0 прогноз 50, при D=1 — 58. Коэффициент +8 — это разница в единицах Y между группой 1 и базовой группой 0.');
        complete(10);
      } else {
        const why=b.dataset.answer==='percent' ? 'Число +8 здесь задано в единицах Y, а не в процентах.' : 'Dummy показывает различие групп в модели, но сама по себе не доказывает, что принадлежность к группе вызвала это различие.';
        setFeedback($('#dummyFeedback'),false,practicePrefix(n)+why+' Попробуй ещё раз.');
      }
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
      const n=attempt(11);
      b.classList.remove('correct','wrong'); b.classList.add(ok?'correct':'wrong');
      if(ok){
        finishChoiceGroup('#multipleAnswers button',b);
        setFeedback($('#multipleFeedback'),true,practicePrefix(n)+'Верно. Сон фиксируем, а подготовку увеличиваем на 1 час. Поэтому прогноз меняется ровно на коэффициент при подготовке: +4.');
        complete(11);
      } else {
        const why=b.dataset.answer==='six' ? 'Ты сложил коэффициенты 4 и 2. Но мы меняем только подготовку; сон остаётся тем же, поэтому его вклад не меняется.' : 'Сравнить можно именно благодаря правилу «при прочих равных»: сон фиксирован, меняется только подготовка.';
        setFeedback($('#multipleFeedback'),false,practicePrefix(n)+why+' Попробуй другой ответ.');
      }
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
      const n=attempt(12);
      b.classList.remove('correct','wrong'); b.classList.add(ok?'correct':'wrong');
      if(ok){
        finishChoiceGroup('#pAnswers button',b);
        setFeedback($('#pFeedback'),true,practicePrefix(n)+'Верно. p-value относится к данным при условии H₀ и предпосылок теста; это не вероятность того, что эффект настоящий.');
        complete(12);
      } else {
        setFeedback($('#pFeedback'),false,practicePrefix(n)+'Нет. p=0,03 нельзя превращать в «97% вероятности истинности эффекта». Вероятность в определении p-value относится к данным при H₀. Попробуй ещё раз.');
      }
    }));
  }

  function initVif(){
    document.querySelectorAll('#twinOptions button').forEach(b=>b.addEventListener('click',()=>{
      const ok=b.dataset.answer==='income-salary';
      const n=attempt(13);
      b.classList.remove('correct','wrong'); b.classList.add(ok?'correct':'wrong');
      $('#vifValue').textContent=ok?'12.4':'2.1';
      $('#vifFill').style.width=ok?'86%':'24%';
      if(ok){
        finishChoiceGroup('#twinOptions button',b);
        setFeedback($('#vifFeedback'),true,practicePrefix(n)+'Верно. Годовой доход и месячная зарплата почти измеряют одну величину в разных масштабах и поэтому сильно дублируют информацию.');
        complete(13);
      } else {
        setFeedback($('#vifFeedback'),false,practicePrefix(n)+'Эта пара может быть связана, но не является почти прямым пересчётом одной и той же величины. Ищи наиболее очевидное дублирование и попробуй ещё раз.');
      }
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
      if(ok){
        document.querySelectorAll('#researchPool button,#research .research-slots button').forEach(x=>x.disabled=true);
        $('#checkResearch').disabled=true;
        complete(14);
      }
    });
  }

  function initBeginnerMode(){
    document.body.classList.add('simple-mode');
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
      const n=attempt(15);
      b.classList.remove('correct','wrong'); b.classList.add(ok?'correct':'wrong');
      if(ok){
        finishChoiceGroup('#labConclusionAnswers button',b);
        setFeedback($('#labConclusionFeedback'),true,practicePrefix(n)+'Верно. Это недопустимый вывод: положительный коэффициент показывает ассоциацию в модели, но сам по себе не доказывает причинный эффект.');
        complete(15);
      } else {
        const why=b.dataset.answer==='association' ? 'Это допустимое описание: модель действительно показывает статистическую связь между X и Y.' : 'Это тоже допустимо: регрессионная формула действительно используется для получения условного среднего прогноза.';
        setFeedback($('#labConclusionFeedback'),false,practicePrefix(n)+why+' Значит, ошибочный вывод другой. Пробуй снова.');
      }
    }));
  }


  const taskInstructions = {
    1:{title:'Определи направление связи',steps:['Посмотри на всё облако точек целиком, а не на отдельные точки.','Представь линию через середину облака.','Выбери: она в среднем идёт вверх, вниз или почти горизонтально.']},
    2:{title:'Подгони линию OLS',steps:['Двигай β₀ — линия будет подниматься и опускаться.','Двигай β₁ — изменится наклон линии.','Следи за красными вертикальными остатками и SSE.','Когда кажется, что ошибки минимальны, нажми «Проверить модель».']},
    3:{title:'Переведи коэффициент на обычный язык',steps:['Сначала прочитай, что обозначают X и Y.','Посмотри на число при X.','Выбери фразу, где говорится о среднем изменении Y при +1 к X.','Не путай коэффициент с процентами, R² и причинностью.']},
    4:{title:'Проверь влияние необычной точки',steps:['Сначала включи выброс переключателем.','Сравни β₁ до и после появления точки.','Посмотри, где точка находится по оси X.','После этого выбери объяснение, почему линия изменилась.']},
    5:{title:'Нажми на точку с самым большим остатком',steps:['Красные пунктирные отрезки показывают вертикальные ошибки модели.','Ищи не самую высокую точку, а самый длинный вертикальный отрезок от точки до линии.','Нажми прямо на выбранную синюю точку.','Если ошибёшься, точка побледнеет, а искать можно дальше.']},
    6:{title:'Поставь диагноз по остаткам',steps:['Сначала найди горизонтальную линию нуля.','Посмотри на форму всего облака ошибок.','Дуга намекает на нелинейность, воронка — на меняющийся разброс.','Выбери наиболее подходящий диагноз.']},
    7:{title:'Выбери модель для новых данных',steps:['Сравни три карточки моделей.','Главная цель здесь — прогноз на новых данных.','Смотри прежде всего на RMSE test: меньше — лучше.','Нажми на карточку модели, которую считаешь лучшей.']},
    8:{title:'Посчитай прогноз самостоятельно',steps:['Подставь указанное X в формулу.','Сначала выполни умножение.','Затем прибавь свободный член.','Введи только получившееся число и нажми «Проверить».']},
    9:{title:'Разложи переменные по ролям',steps:['Сначала нажми на одну переменную слева.','Затем нажми на подходящую роль справа: Y, X или контроль.','Повтори для всех трёх переменных.','После заполнения ролей нажми «Проверить раскладку».']},
    10:{title:'Сравни две dummy-группы',steps:['Нажимай 0 и 1 слева и наблюдай, как меняется прогноз.','Сравни прогноз группы A и группы B.','Разница между прогнозами подсказывает смысл коэффициента +8.','После этого выбери правильную интерпретацию справа.']},
    11:{title:'Примени правило «при прочих равных»',steps:['Подвигай оба ползунка и посмотри, как собирается прогноз.','В самом вопросе мысленно зафиксируй сон.','Измени только подготовку на 1 час.','Выбери, насколько изменится прогноз.']},
    12:{title:'Отдели p-value от мифов',steps:['Подвигай p-value и посмотри, как он сравнивается с порогом 0,05.','Прочитай высказывание исследователя.','Реши, действительно ли p=0,03 означает 97% вероятности истинности эффекта.','Выбери ответ и прочитай объяснение.']},
    13:{title:'Найди переменные-близнецы',steps:['Посмотри на пары признаков.','Ищи пару, которая почти измеряет одно и то же в разных единицах.','Нажми на выбранную пару.','После ответа посмотри, как меняется условный VIF.']},
    14:{title:'Собери исследовательскую модель',steps:['Выбери переменную сверху.','Назначь ей роль Y, X или контроля.','Y должен отвечать на вопрос «что объясняем?».','Когда модель собрана, нажми «Запустить проверку».']},
    15:{title:'Запусти мини-регрессию и прочитай результат',steps:['Выбери Y, главный X и при необходимости контроль.','Нажми «Запустить регрессию».','Сначала прочитай R², затем коэффициенты и график остатков.','В конце найди вывод, который нельзя делать по такой модели.']},
    16:{title:'Реши 20 смешанных задач',steps:['Каждый новый запуск создаёт новый вариант квиза.','Внутри одного вопроса условие не меняется, пока ты ищешь ответ.','Неверная попытка даёт только направление, но не раскрывает готовое решение.','К следующей задаче можно перейти только после правильного ответа.']}
  };

  function buildTaskGuide(chapter){
    const g=taskInstructions[chapter];
    if(!g) return '';
    return '<div class="task-instruction">'+
      '<div class="task-instruction-icon">→</div>'+
      '<div><span>Что нужно сделать</span><h4>'+g.title+'</h4><ol>'+g.steps.map(x=>'<li>'+x+'</li>').join('')+'</ol></div>'+
    '</div>';
  }

  function injectTaskGuides(){
    document.querySelectorAll('[data-chapter]').forEach(section=>{
      const chapter=section.dataset.chapter;
      const holder=section.classList.contains('chapter')?section:section.querySelector('.chapter');
      if(!holder || holder.querySelector('.task-instruction')) return;
      const stages=[...holder.children].filter(x=>x.classList.contains('task-stage'));
      const target=stages.find(x=>!x.classList.contains('practice-toolbar'));
      if(!target) return;
      target.insertAdjacentHTML('beforebegin',buildTaskGuide(chapter));
      const guide=target.previousElementSibling;
      guide.classList.add('task-stage');
      if(target.classList.contains('is-locked')) guide.classList.add('is-locked');
    });
  }

  const lessonContent = {
    1:{
      title:'Что такое связь между X и Y?',
      lead:'Мы пока ничего не считаем. Учимся видеть общую тенденцию в облаке точек.',
      points:[
        ['X','Горизонтальная ось. То, что мы используем как возможный предиктор.'],
        ['Y','Вертикальная ось. То, что хотим объяснить или предсказать.'],
        ['Положительная связь','Чем больше X, тем в среднем выше Y.'],
        ['Отрицательная связь','Чем больше X, тем в среднем ниже Y.']
      ],
      example:'Если студенты, которые готовятся дольше, обычно получают более высокий балл, облако точек будет в среднем подниматься слева направо.',
      warning:'Связь ещё не означает причинность. Мы лишь видим совместное изменение.',
      visual:'trend'
    },
    2:{
      title:'Что делает линия регрессии?',
      lead:'Она пытается пройти через облако точек так, чтобы в среднем ошибаться как можно меньше.',
      points:[
        ['β₀','Свободный член. Где линия пересекает ось Y при X = 0.'],
        ['β₁','Наклон. На сколько в среднем меняется прогноз Y при росте X на 1.'],
        ['Остаток','Вертикальная ошибка: реальное Y минус прогноз модели.'],
        ['OLS / МНК','Правило, которое выбирает линию с минимальной суммой квадратов остатков.']
      ],
      example:'Если β₁ = 4, то при увеличении X на 1 прогноз Y в среднем увеличивается на 4.',
      warning:'Линия не обязана проходить через каждую точку. Она описывает среднюю тенденцию.',
      visual:'ols'
    },
    3:{
      title:'Как читать коэффициент без формул?',
      lead:'Коэффициент — это обычная фраза о среднем изменении прогноза.',
      points:[
        ['Знак','Плюс означает рост прогноза Y, минус — снижение.'],
        ['Величина','Показывает размер среднего изменения Y на одну единицу X.'],
        ['Единицы','Всегда читай единицы X и Y: баллы, рубли, часы, проценты.'],
        ['Причинность','Коэффициент сам по себе её не доказывает.']
      ],
      example:'β₁ = 3,4 при X = часы подготовки и Y = балл теста: ещё 1 час связан в среднем с +3,4 балла к прогнозу.',
      warning:'Не путай коэффициент с R² и не превращай обычные единицы в проценты без основания.',
      visual:'coefficient'
    },
    4:{
      title:'Почему одна точка может сильно изменить модель?',
      lead:'Не все наблюдения одинаково влияют на линию.',
      points:[
        ['Выброс','Точка, заметно отличающаяся по Y или по общему поведению.'],
        ['Leverage','Насколько необычно положение точки по X.'],
        ['Влияние','Точка с высоким leverage и большой ошибкой может заметно повернуть линию.'],
        ['Проверка','Выброс не удаляют автоматически: сначала выясняют, ошибка это или реальное наблюдение.']
      ],
      example:'Если почти все X лежат от 10 до 70, а одно наблюдение имеет X = 100, оно получает сильный «рычаг».',
      warning:'Удалять необычные данные только потому, что они мешают красивому результату, нельзя.',
      visual:'outlier'
    },
    5:{
      title:'Что такое остаток?',
      lead:'Остаток показывает, насколько модель промахнулась для конкретного наблюдения.',
      points:[
        ['Формула','остаток = реальное Y − прогноз Ŷ'],
        ['Положительный','Реальное значение оказалось выше прогноза.'],
        ['Отрицательный','Реальное значение оказалось ниже прогноза.'],
        ['Большой модуль','Модель сильно ошиблась на этом наблюдении.']
      ],
      example:'Реальный балл 78, модель предсказала 70. Остаток = +8.',
      warning:'Остаток — не «плохое наблюдение». Это просто величина ошибки модели для одной строки.',
      visual:'residual'
    },
    6:{
      title:'Зачем смотреть на график остатков?',
      lead:'Даже хороший R² не показывает, правильно ли выбрана форма модели.',
      points:[
        ['Хороший признак','Остатки случайно разбросаны вокруг нуля.'],
        ['Дуга','Линейная модель, возможно, пропускает нелинейную зависимость.'],
        ['Воронка','Разброс ошибок меняется — возможна гетероскедастичность.'],
        ['Система','Любая повторяющаяся форма означает: в ошибках осталась информация.']
      ],
      example:'Если остатки образуют U-образную дугу, прямая линия слишком грубо описывает зависимость.',
      warning:'Диагностика — это не поиск «идеальной картинки», а поиск систематической структуры в ошибках.',
      visual:'diagnostics'
    },
    7:{
      title:'Почему больше переменных не всегда лучше?',
      lead:'Модель может идеально подстроиться под обучающие данные и хуже работать на новых.',
      points:[
        ['Train','Данные, на которых модель обучали.'],
        ['Test','Отложенные данные для проверки прогноза.'],
        ['R²','На train обычно не уменьшается при добавлении X.'],
        ['RMSE','Типичный размер ошибки прогноза; на test меньше обычно лучше.']
      ],
      example:'Модель с 11 предикторами может иметь R² = 0,90 на train, но ошибаться сильнее на test, чем модель с 5 предикторами.',
      warning:'Нельзя выбирать модель только по самому большому train R².',
      visual:'duel'
    },
    8:{
      title:'Регрессия как машина прогноза',
      lead:'В простейшем виде формула просто превращает X в прогноз Ŷ.',
      points:[
        ['Ŷ','Не реальное Y, а предсказанное моделью.'],
        ['β₀','То, что остаётся в формуле при X = 0.'],
        ['β₁X','Часть прогноза, связанная с конкретным значением X.'],
        ['Подстановка','Берём X, умножаем на коэффициент, прибавляем β₀.']
      ],
      example:'Ŷ = 12 + 3X и X = 6 → Ŷ = 12 + 18 = 30.',
      warning:'Прогноз не означает, что каждый человек с X = 6 обязательно получит Y = 30.',
      visual:'prediction'
    },
    9:{
      title:'Как выбрать Y, X и контроль?',
      lead:'Правильная модель начинается не с кнопки «Regression», а с исследовательского вопроса.',
      points:[
        ['Y','Результат: что хотим объяснить или предсказать?'],
        ['X','Главный фактор, связь которого с Y нас интересует.'],
        ['Контроль','Дополнительный фактор, который разумно учесть.'],
        ['Логика','Роли определяются вопросом исследования, а не названием столбца.']
      ],
      example:'«Связаны ли часы подготовки с баллом экзамена с учётом курса?» → Y: балл, X: часы, контроль: курс.',
      warning:'Одна и та же переменная в другом исследовательском вопросе может играть другую роль.',
      visual:'roles'
    },
    10:{
      title:'Как регрессия понимает категории?',
      lead:'Компьютеру удобно представить две категории как 0 и 1.',
      points:[
        ['0','Базовая категория, относительно которой идёт сравнение.'],
        ['1','Сравниваемая категория.'],
        ['Коэффициент','Средняя разница между группой 1 и группой 0 при прочих равных.'],
        ['Dummy','Так называется переменная-код 0/1.']
      ],
      example:'Ŷ = 50 + 8D. Для D = 0 прогноз 50, для D = 1 прогноз 58. Разница = 8.',
      warning:'Коэффициент +8 — это 8 единиц Y, а не автоматически 8%.',
      visual:'dummy'
    },
    11:{
      title:'Что значит «при прочих равных»?',
      lead:'В множественной регрессии коэффициент одного X читают так, будто остальные включённые X мы удерживаем на месте.',
      points:[
        ['Частный эффект','Изменение прогноза по одному X при фиксированных остальных X.'],
        ['Контроль','Позволяет сравнивать более похожие наблюдения.'],
        ['Не магия','Контроль не устраняет автоматически все возможные смещения.'],
        ['Интерпретация','Всегда называй, какие переменные удерживаются фиксированными.']
      ],
      example:'Ŷ = 30 + 4·подготовка + 2·сон. При одинаковом сне +1 час подготовки связан с +4 к прогнозу.',
      warning:'«При прочих равных» относится только к тем переменным, которые действительно включены в модель.',
      visual:'multiple'
    },
    12:{
      title:'Что на самом деле говорит p-value?',
      lead:'p-value помогает оценить совместимость данных с нулевой гипотезой при заданных предпосылках.',
      points:[
        ['Нулевая гипотеза','Часто: коэффициент в генеральной совокупности равен нулю.'],
        ['Малое p','Такие данные труднее объяснить одной лишь нулевой гипотезой.'],
        ['Порог','0,05 — условная договорённость, а не закон природы.'],
        ['Не вероятность истины','p = 0,03 не означает «эффект истинный с вероятностью 97%».']
      ],
      example:'Если p = 0,03, мы можем сказать, что при нулевой гипотезе такие или более экстремальные данные были бы сравнительно редкими.',
      warning:'Статистическая значимость не равна практической важности.',
      visual:'pvalue'
    },
    13:{
      title:'Почему похожие X мешают друг другу?',
      lead:'Если два предиктора почти повторяют одну и ту же информацию, модели трудно разделить их индивидуальные вклады.',
      points:[
        ['Мультиколлинеарность','Сильная зависимость между предикторами.'],
        ['Следствие','Коэффициенты могут становиться нестабильнее.'],
        ['VIF','Один из диагностических показателей проблемы.'],
        ['Решение','Проверить смысл переменных, корреляции и необходимость одновременного включения.']
      ],
      example:'Месячная зарплата и годовой доход могут почти дублировать друг друга.',
      warning:'Высокая связь X между собой не обязательно портит прогноз, но может сильно мешать интерпретации отдельных коэффициентов.',
      visual:'vif'
    },
    14:{
      title:'Как мыслит исследователь до расчёта?',
      lead:'Сначала вопрос и теория, затем переменные, и только потом статистическая модель.',
      points:[
        ['Шаг 1','Сформулируй, что именно хочешь объяснить.'],
        ['Шаг 2','Назначь Y.'],
        ['Шаг 3','Назначь главный X и обоснуй его.'],
        ['Шаг 4','Добавь только осмысленные контроли.']
      ],
      example:'Вопрос «почему различаются результаты экзамена?» допускает часы подготовки как X и сон как контроль.',
      warning:'Добавлять все доступные столбцы «на всякий случай» — плохая стратегия.',
      visual:'research'
    },
    15:{
      title:'Как читать результат регрессии в таблице?',
      lead:'Не нужно читать всё сразу. Двигайся сверху вниз: модель → коэффициенты → остатки → вывод.',
      points:[
        ['R²','Сколько вариации Y описывает модель в этой выборке.'],
        ['Коэффициенты','Направление и величина связи каждого X с прогнозом Y.'],
        ['Остатки','Где и как модель ошибается.'],
        ['Вывод','Описание связи, а не автоматическое доказательство причинности.']
      ],
      example:'Если коэффициент подготовки = 4,6, то +1 час связан примерно с +4,6 балла к прогнозу при фиксированном контроле.',
      warning:'Одна таблица коэффициентов не заменяет проверку предпосылок и исследовательский дизайн.',
      visual:'table'
    },
    16:{
      title:'Финальная карта курса',
      lead:'Перед итоговым квизом соберём все идеи в одну цепочку.',
      points:[
        ['Вопрос','Что хотим объяснить?'],
        ['Модель','Какие X включаем и почему?'],
        ['Результат','Как читаем коэффициенты, R² и ошибки?'],
        ['Ограничения','Что мы можем утверждать, а что — нет?']
      ],
      example:'Регрессия — это не одна формула, а последовательность решений: вопрос → данные → модель → диагностика → интерпретация.',
      warning:'Если сомневаешься между красивым числом и содержательной логикой — возвращайся к исследовательскому вопросу.',
      visual:'map'
    }
  };


  const deepLessonContent = {
    1:{
      simple:'Представь, что каждая точка — один человек. Мы просто смотрим: когда точка находится правее, она обычно оказывается выше, ниже или как попало? Если чаще выше — связь положительная. Если чаще ниже — отрицательная. Если явного направления нет — линейная связь слабая.',
      real:'Возьмём 30 студентов. По горизонтали — часы подготовки, по вертикали — балл экзамена. Если точки в среднем идут снизу-слева вверх-вправо, больше подготовки связано с более высоким баллом. Мы ещё ничего не доказываем — только описываем рисунок данных.',
      why:'Это первый шаг перед любой регрессией. Если ты не понимаешь, что изображено на графике, формулы дальше только запутают. Визуальная проверка помогает заметить выбросы, нелинейность и вообще понять, есть ли смысл строить прямую линию.',
      steps:['Найди ось X и спроси: что здесь измеряется?','Найди ось Y и спроси: что хотим объяснить?','Не смотри на отдельную точку — смотри на всё облако.','Мысленно проведи направление через середину облака.'],
      terms:[['X','Предиктор или объясняющая переменная.'],['Y','Результат, который объясняем или предсказываем.'],['Ассоциация','Совместное изменение двух переменных.'],['Причинность','Утверждение, что изменение X вызывает изменение Y; одного рисунка для этого недостаточно.']],
      lecture:['Каждая точка — одно наблюдение.','Сначала ищем направление всего облака, а не идеальную линию.','Связь на графике — ещё не доказательство причины.']
    },
    2:{
      simple:'Линия регрессии — это «средняя дорога» через облако точек. Она не обязана попасть во все точки. Её задача — сделать промахи по вертикали в целом как можно меньше.',
      real:'У одного студента модель предсказала 70 баллов, а он получил 76. Ошибка +6. У другого прогноз 82, а факт 78 — ошибка −4. OLS перебирает положение линии так, чтобы квадраты всех таких ошибок в сумме были минимальны.',
      why:'Так появляется конкретная математическая линия вместо рисунка «примерно вверх». После этого можно получать прогнозы и сравнивать величину связи.',
      steps:['β₀ двигает линию вверх-вниз.','β₁ меняет её наклон.','Для каждой точки считаем вертикальную ошибку.','Квадратим ошибки и складываем — получаем SSE.','OLS выбирает β₀ и β₁ с минимальной SSE.'],
      terms:[['β₀','Свободный член, базовый уровень линии.'],['β₁','Коэффициент наклона.'],['Остаток','Факт минус прогноз.'],['SSE','Сумма квадратов остатков.'],['OLS / МНК','Метод наименьших квадратов.']],
      lecture:['Линия задаётся двумя числами: β₀ и β₁.','Каждая точка создаёт вертикальную ошибку — остаток.','OLS выбирает линию, у которой сумма квадратов ошибок минимальна.']
    },
    3:{
      simple:'Коэффициент — это ответ на вопрос: «Если X станет больше на одну единицу, насколько в среднем изменится прогноз Y?»',
      real:'X — часы подготовки, Y — балл экзамена, β₁ = 3,4. Сравниваем два значения X, отличающиеся на один час: прогноз второго примерно на 3,4 балла выше.',
      why:'Большая часть прикладной регрессии — это именно чтение коэффициентов. Ошибка в одной фразе может полностью перевернуть смысл результата.',
      steps:['Сначала назови X и его единицы.','Назови Y и его единицы.','Посмотри на знак коэффициента.','Прочитай величину: +1 к X → β единиц к прогнозу Y.','Добавь «в среднем» и не объявляй причинность без дизайна исследования.'],
      terms:[['Коэффициент β','Число, связывающее изменение X с изменением прогноза Y.'],['Знак','Показывает направление связи.'],['Единица измерения','Определяет, что именно означает «+1 к X».'],['Причинный эффект','Требует более сильных оснований, чем обычная ассоциация.']],
      lecture:['Найди единицы X и Y.','Переведи β в фразу «+1 X связано с … Y».','Не превращай единицы в проценты и не заявляй причинность автоматически.']
    },
    4:{
      simple:'Иногда одна необычная точка стоит далеко от остальных и буквально тянет линию к себе. Поэтому линия может сильно измениться, хотя добавили всего одно наблюдение.',
      real:'У 25 студентов подготовка от 1 до 8 часов. Появляется один студент с 15 часами подготовки и очень низким баллом. По X он далеко от всех — у него высокий leverage, и он может заметно повернуть линию.',
      why:'В реальных данных бывают ошибки ввода, редкие случаи и действительно необычные объекты. Их влияние нужно понимать, иначе выводы могут зависеть от одной строки.',
      steps:['Найди необычную точку.','Проверь: она необычна по X, по Y или по обоим?','Сравни модель с точкой и без неё.','Не удаляй автоматически — сначала разберись, почему она появилась.'],
      terms:[['Выброс','Наблюдение, сильно отличающееся от общей картины.'],['Leverage','Необычность положения по предикторам X.'],['Влияние','Насколько удаление точки изменило бы модель.']],
      lecture:['Необычное Y и необычное X — не одно и то же.','Далёкая по X точка получает сильный рычаг.','Сначала диагностируем и объясняем, только потом решаем, что делать с наблюдением.']
    },
    5:{
      simple:'Остаток — это просто промах модели для одной строки. Модель сказала 70, получилось 78 — промах +8.',
      real:'Если прогноз зарплаты 60 тыс., а фактическая 52 тыс., остаток равен 52 − 60 = −8 тыс. Минус говорит, что модель завысила прогноз.',
      why:'Из остатков строится почти вся диагностика линейной регрессии. По ним видно, где модель систематически ошибается.',
      steps:['Возьми фактическое Y.','Найди прогноз Ŷ.','Вычисли Y − Ŷ.','Знак показывает направление промаха.','Модуль показывает размер промаха.'],
      terms:[['Ŷ','Предсказанное моделью значение Y.'],['Остаток e','Y − Ŷ.'],['Модуль остатка','Размер ошибки без учёта знака.']],
      lecture:['Факт и прогноз — два разных числа.','Их вертикальная разница и есть остаток.','Большие остатки показывают места, где модель особенно ошиблась.']
    },
    6:{
      simple:'График остатков — проверка: «не осталось ли в ошибках какого-то рисунка?» Хорошо, когда точки выглядят как случайный шум вокруг нуля.',
      real:'Если при маленьких прогнозах ошибки узкие, а при больших расходятся веером, это похоже на гетероскедастичность. Если видна дуга — прямая линия пропустила кривую зависимость.',
      why:'Один R² может выглядеть прилично, а модель при этом нарушать важные предпосылки. Остатки часто первыми показывают проблему.',
      steps:['Найди линию нуля.','Посмотри, симметричны ли ошибки вокруг неё.','Ищи дугу, волну, воронку, группы.','Если видишь рисунок — подумай, какая структура не учтена.'],
      terms:[['Гетероскедастичность','Неодинаковый разброс ошибок.'],['Нелинейность','Связь не описывается одной прямой.'],['Диагностика','Проверка поведения модели после оценки.']],
      lecture:['Хорошие остатки не обязаны быть маленькими, но не должны рисовать систему.','Воронка намекает на меняющийся разброс.','Дуга намекает на пропущенную нелинейность.']
    },
    7:{
      simple:'Если добавить в модель много переменных, она может лучше запомнить старые данные, но хуже угадывать новые. Это как ученик, который выучил ответы вместо правила.',
      real:'Модель A: R² train = 0,65, test RMSE = 18. Модель B: R² train = 0,88, но test RMSE = 25. Для прогноза новых случаев A лучше, хотя её R² ниже.',
      why:'Прикладная модель должна работать не только на тех данных, которые уже видела. Поэтому нужна проверка на новых или отложенных данных.',
      steps:['Раздели понятия train и test.','Не выбирай модель по одному train R².','Сравни test RMSE.','Если сложная модель хуже на test — возможно переобучение.'],
      terms:[['Train','Выборка для оценки модели.'],['Test','Отложенные данные для честной проверки.'],['RMSE','Типичный размер ошибки прогноза.'],['Переобучение','Модель слишком подстроилась под обучающие данные.']],
      lecture:['Train показывает, насколько модель подстроилась.','Test показывает, насколько она переносится на новые данные.','Для прогноза ориентируемся на качество вне обучения.']
    },
    8:{
      simple:'Формула регрессии — калькулятор. Подставляешь X, умножаешь на коэффициент, прибавляешь константу — получаешь прогноз.',
      real:'Ŷ = 12 + 3X. При X = 6: сначала 3×6 = 18, затем 12+18 = 30. Это прогноз модели, а не гарантированный факт.',
      why:'Понимание подстановки убирает мистику из регрессии. Все более сложные модели делают ту же идею, только с несколькими X.',
      steps:['Запиши β₀.','Умножь каждый X на его β.','Сложи все части.','Получившееся число — Ŷ.'],
      terms:[['Прогноз Ŷ','Рассчитанное моделью значение.'],['β₀','Константа.'],['β₁X','Вклад конкретного предиктора в линейный прогноз.']],
      lecture:['Формула — не абстракция, а инструкция вычисления.','Сначала умножение, потом сложение.','Результат — средний прогноз модели, не судьба конкретного человека.']
    },
    9:{
      simple:'Y — ответ, который хотим получить. X — фактор, связь которого с ответом изучаем. Контроль — ещё один фактор, который не хотим забыть.',
      real:'Вопрос: связана ли подготовка с экзаменом с учётом курса? Экзамен = Y, подготовка = X, курс = контроль.',
      why:'Если перепутать роли, можно идеально посчитать не ту модель и ответить вообще не на тот исследовательский вопрос.',
      steps:['Сформулируй вопрос словами.','После «что объясняем?» найди Y.','После «с чем связываем?» найди главный X.','После «что ещё важно учесть?» выбери контроль.'],
      terms:[['Зависимая переменная Y','Результат.'],['Предиктор X','Объясняющий фактор.'],['Контроль','Дополнительная включённая переменная.'],['Спецификация','Набор переменных и форма модели.']],
      lecture:['Исследовательский вопрос задаёт роли переменных.','Y отвечает на «что объясняем?».','X и контроли отвечают на «чем и при каких условиях объясняем?».']
    },
    10:{
      simple:'Категории вроде «группа A / группа B» компьютер превращает в переключатель: 0 или 1. Коэффициент показывает, насколько меняется прогноз при переключении.',
      real:'D=0 — группа A, D=1 — группа B. В Ŷ=50+8D группа A получает 50, группа B 58. Разница 8 единиц.',
      why:'Так в регрессию входят пол, регион, тип организации, экспериментальная группа и другие категориальные признаки.',
      steps:['Выбери базовую категорию = 0.','Другую категорию кодируй = 1.','Посчитай прогноз при 0.','Посчитай прогноз при 1.','Разность равна коэффициенту dummy.'],
      terms:[['Dummy','Переменная 0/1.'],['Базовая категория','Группа с кодом 0.'],['Категориальная переменная','Признак из отдельных групп, а не непрерывной шкалы.']],
      lecture:['0 — не «плохо» и не отсутствие человека; это код базы.','1 — сравниваемая группа.','Коэффициент сообщает разницу относительно базы.']
    },
    11:{
      simple:'В модели с несколькими X мы мысленно меняем один X, а остальные держим одинаковыми. Это и есть «при прочих равных».',
      real:'Два студента спят по 7 часов. Один готовился 3 часа, второй 4. Если β подготовки = 4, прогноз второго выше примерно на 4 балла при одинаковом сне.',
      why:'Без этого правила коэффициенты множественной регрессии невозможно корректно интерпретировать.',
      steps:['Выбери коэффициент, который читаешь.','Увеличь только его X на 1.','Остальные включённые X оставь неизменными.','Изменение прогноза равно этому коэффициенту.'],
      terms:[['Множественная регрессия','Модель с несколькими предикторами.'],['При прочих равных','Другие включённые X фиксированы.'],['Частный коэффициент','Связь одного X с Y при учёте остальных X.']],
      lecture:['Каждый коэффициент читается отдельно.','Остальные переменные в мысленном сравнении фиксируем.','Это делает сравнение точнее, но не превращает наблюдательную модель в эксперимент.']
    },
    12:{
      simple:'p-value — не «вероятность, что мы правы». Это число про то, насколько необычны наши данные, если считать, что настоящего эффекта нет.',
      real:'При H₀: β=0 получили p=0,03. Это означает: при нулевой гипотезе такие или более экстремальные результаты возникали бы сравнительно редко в рамках модели теста.',
      why:'p-value часто неправильно трактуют даже в публикациях. Правильное понимание защищает от ложных сильных выводов.',
      steps:['Сформулируй H₀.','Посмотри p-value.','Сравни его с заранее выбранным уровнем α, например 0,05.','Скажи, есть ли основания отвергать H₀ — но не говори, что узнал вероятность истинности эффекта.'],
      terms:[['H₀','Нулевая гипотеза.'],['p-value','Вероятность таких или более экстремальных данных при H₀ и предпосылках теста.'],['α','Заранее выбранный уровень значимости.'],['Статистическая значимость','Решение в процедуре теста, не размер и не важность эффекта.']],
      lecture:['Сначала существует H₀, а не p-value само по себе.','p говорит о данных при H₀.','Малое p не сообщает вероятность истинности альтернативной гипотезы.']
    },
    13:{
      simple:'Если два X почти копируют друг друга, модель видит одну и ту же информацию дважды и начинает путаться, кому отдать «заслугу».',
      real:'Месячная зарплата и годовой доход почти одно и то же число в разных масштабах. Если включить оба, отдельные коэффициенты могут стать нестабильными.',
      why:'Мультиколлинеарность особенно опасна, когда задача — интерпретировать отдельные коэффициенты, а не только прогнозировать.',
      steps:['Посмотри, не измеряют ли два X почти одно и то же.','Проверь их связь.','Посмотри диагностические показатели вроде VIF.','Реши содержательно, нужны ли оба X одновременно.'],
      terms:[['Мультиколлинеарность','Сильное дублирование информации между X.'],['VIF','Диагностика того, насколько X объясняется другими X.'],['Нестабильный коэффициент','Оценка, которая сильно меняется при небольших изменениях модели.']],
      lecture:['Предикторы могут конкурировать за одну и ту же информацию.','Из-за этого растёт неопределённость отдельных β.','Решение начинается со смысла переменных, а не с механического удаления.']
    },
    14:{
      simple:'Исследователь не начинает с таблицы коэффициентов. Он сначала решает, на какой вопрос вообще хочет ответить.',
      real:'Вопрос: почему различаются результаты экзамена? Y — экзамен. Теоретически интересует подготовка — это X. Сон или курс можно добавить как осмысленный контроль.',
      why:'Это защищает от «рыбалки по данным», когда перебирают сотни моделей до появления красивого результата.',
      steps:['Запиши один ясный вопрос.','Определи Y.','Выбери главный X по теории или задаче.','Добавь минимальный набор осмысленных контролей.','Только теперь запускай расчёт.'],
      terms:[['Исследовательский вопрос','То, на что модель должна помочь ответить.'],['Теория','Обоснование, почему переменные должны быть связаны.'],['Контроль','Не просто любой доступный столбец, а содержательно оправданный фактор.']],
      lecture:['Смысл появляется до статистики.','Переменные выбирают ради вопроса, а не ради красивого p.','Модель — инструмент ответа, а не генератор истины.']
    },
    15:{
      simple:'Таблицу регрессии читаем не целиком. Сначала R², потом нужный коэффициент, потом ошибки и ограничения.',
      real:'R²=0,58; β подготовки=4,6. Можно сказать: модель описывает около 58% вариации Y в этой выборке, а дополнительный час подготовки связан примерно с +4,6 балла к прогнозу при фиксированном контроле.',
      why:'Такой порядок не даёт утонуть в цифрах и помогает превратить технический вывод в нормальный исследовательский текст.',
      steps:['Проверь, какая модель оценена.','Посмотри R² как общую характеристику описания вариации.','Прочитай нужные β в единицах переменных.','Проверь остатки и диагностику.','Сформулируй вывод с ограничениями.'],
      terms:[['Таблица коэффициентов','Строки с оценками β для переменных.'],['R²','Доля описанной вариации Y в данных.'],['Остатки','Ошибки прогнозов модели.'],['Ограничения','Условия, при которых вывод нельзя расширять дальше данных и дизайна.']],
      lecture:['Не начинай со звёздочек и p-value.','Сначала пойми модель и величины коэффициентов.','Заверши диагностикой и границами допустимого вывода.']
    },
    16:{
      simple:'Вся регрессия — это цепочка из пяти вопросов: что объясняем, чем объясняем, что посчитала модель, где она ошибается и что мы имеем право сказать.',
      real:'Экзамен ← подготовка + сон. Оценили коэффициенты, получили R², посмотрели остатки, затем написали: «подготовка связана с баллом при учёте сна», не превращая это автоматически в причинность.',
      why:'Финальный квиз проверяет не память отдельных слов, а способность пройти всю цепочку от вопроса до осторожного вывода.',
      steps:['Вопрос и Y.','X и контроли.','Оценка коэффициентов.','Диагностика и качество прогноза.','Интерпретация и ограничения.'],
      terms:[['Спецификация','Как именно устроена модель.'],['Оценка','Полученные по данным коэффициенты.'],['Диагностика','Проверка ошибок и предпосылок.'],['Интерпретация','Перевод чисел в содержательный вывод.']],
      lecture:['Начинаем с вопроса, а не с формулы.','После расчёта обязательно проверяем модель.','Финальный вывод должен быть ровно настолько сильным, насколько позволяет дизайн исследования.']
    }
  };

  function lessonVisual(type){
    const common='<svg viewBox="0 0 520 210" class="lesson-svg" aria-hidden="true">';
    if(type==='trend') return common+'<line x1="40" y1="175" x2="490" y2="175" class="lv-axis"/><line x1="40" y1="175" x2="40" y2="25" class="lv-axis"/>'+Array.from({length:13},(_,i)=>'<circle cx="'+(55+i*31)+'" cy="'+(160-i*8+Math.sin(i)*18)+'" r="6" class="lv-dot"/>').join('')+'<path d="M55 155 L455 55" class="lv-line"/></svg>';
    if(type==='ols') return common+'<line x1="45" y1="175" x2="485" y2="175" class="lv-axis"/><line x1="45" y1="175" x2="45" y2="25" class="lv-axis"/><line x1="70" y1="160" x2="455" y2="50" class="lv-line"/><circle cx="160" cy="110" r="7" class="lv-dot"/><line x1="160" y1="110" x2="160" y2="134" class="lv-error"/><circle cx="295" cy="120" r="7" class="lv-dot"/><line x1="295" y1="120" x2="295" y2="96" class="lv-error"/><circle cx="400" cy="48" r="7" class="lv-dot"/><line x1="400" y1="48" x2="400" y2="66" class="lv-error"/></svg>';
    if(type==='coefficient') return common+'<path d="M55 160 L460 55" class="lv-line thick"/><text x="70" y="190" class="lv-text">+1 по X</text><path d="M230 145 H300" class="lv-arrow"/><path d="M300 145 V118" class="lv-arrow"/><text x="312" y="123" class="lv-text">+β₁ по Ŷ</text></svg>';
    if(type==='outlier') return common+Array.from({length:12},(_,i)=>'<circle cx="'+(70+i*26)+'" cy="'+(150-i*6+Math.sin(i)*9)+'" r="6" class="lv-dot"/>').join('')+'<circle cx="455" cy="45" r="11" class="lv-danger"/><path d="M65 160 L350 85" class="lv-muted-line"/><path d="M65 166 L460 48" class="lv-danger-line"/></svg>';
    if(type==='residual') return common+'<line x1="70" y1="160" x2="455" y2="60" class="lv-line"/><circle cx="275" cy="70" r="8" class="lv-dot"/><line x1="275" y1="70" x2="275" y2="107" class="lv-error thick"/><text x="290" y="92" class="lv-text">остаток</text></svg>';
    if(type==='diagnostics') return common+'<line x1="45" y1="105" x2="480" y2="105" class="lv-zero"/>'+Array.from({length:24},(_,i)=>'<circle cx="'+(55+i*17)+'" cy="'+(105+Math.sin(i*.7)*24+(i%3-1)*7)+'" r="4" class="lv-dot"/>').join('')+'<text x="350" y="35" class="lv-text">ищем структуру</text></svg>';
    if(type==='duel') return common+'<rect x="55" y="70" width="110" height="95" rx="14" class="lv-card"/><rect x="205" y="45" width="110" height="120" rx="14" class="lv-card best"/><rect x="355" y="25" width="110" height="140" rx="14" class="lv-card"/><text x="84" y="125" class="lv-text">RMSE 21</text><text x="232" y="110" class="lv-text">RMSE 15</text><text x="383" y="100" class="lv-text">RMSE 18</text></svg>';
    if(type==='prediction') return common+'<rect x="45" y="72" width="90" height="64" rx="14" class="lv-card"/><text x="82" y="111" class="lv-big">X</text><path d="M145 104 H218" class="lv-arrow"/><rect x="225" y="54" width="150" height="100" rx="16" class="lv-card best"/><text x="252" y="110" class="lv-text">β₀ + β₁X</text><path d="M385 104 H435" class="lv-arrow"/><text x="450" y="111" class="lv-big">Ŷ</text></svg>';
    if(type==='roles') return common+'<rect x="30" y="70" width="120" height="70" rx="14" class="lv-card best"/><text x="78" y="111" class="lv-big">Y</text><rect x="200" y="70" width="120" height="70" rx="14" class="lv-card"/><text x="248" y="111" class="lv-big">X</text><rect x="370" y="70" width="120" height="70" rx="14" class="lv-card"/><text x="410" y="111" class="lv-big">C</text></svg>';
    if(type==='dummy') return common+'<rect x="90" y="65" width="110" height="85" rx="18" class="lv-card"/><text x="138" y="117" class="lv-big">0</text><path d="M215 106 H305" class="lv-arrow"/><rect x="320" y="65" width="110" height="85" rx="18" class="lv-card best"/><text x="368" y="117" class="lv-big">1</text><text x="220" y="76" class="lv-text">разница = β</text></svg>';
    if(type==='multiple') return common+'<text x="40" y="108" class="lv-big">X₁</text><text x="40" y="155" class="lv-big">X₂</text><path d="M95 100 C170 100 175 105 230 105" class="lv-arrow"/><path d="M95 148 C170 148 175 118 230 118" class="lv-arrow"/><rect x="235" y="66" width="150" height="92" rx="18" class="lv-card best"/><text x="268" y="118" class="lv-text">модель</text><path d="M390 112 H455" class="lv-arrow"/><text x="467" y="118" class="lv-big">Ŷ</text></svg>';
    if(type==='pvalue') return common+'<line x1="55" y1="150" x2="465" y2="150" class="lv-axis"/><path d="M70 150 C150 145 175 40 260 40 C345 40 365 145 450 150" class="lv-line"/><path d="M390 150 C410 135 430 130 450 150" class="lv-danger-fill"/><text x="370" y="184" class="lv-text">редкая область</text></svg>';
    if(type==='vif') return common+'<circle cx="190" cy="105" r="66" class="lv-circle"/><circle cx="310" cy="105" r="66" class="lv-circle alt"/><text x="155" y="110" class="lv-big">X₁</text><text x="320" y="110" class="lv-big">X₂</text><text x="228" y="185" class="lv-text">слишком много общей информации</text></svg>';
    if(type==='research') return common+'<rect x="35" y="78" width="100" height="60" rx="13" class="lv-card best"/><text x="72" y="115" class="lv-big">?</text><path d="M145 108 H205" class="lv-arrow"/><rect x="215" y="45" width="95" height="55" rx="12" class="lv-card"/><rect x="215" y="115" width="95" height="55" rx="12" class="lv-card"/><path d="M320 76 H390" class="lv-arrow"/><path d="M320 142 H390" class="lv-arrow"/><rect x="400" y="78" width="90" height="60" rx="13" class="lv-card best"/><text x="438" y="115" class="lv-big">Y</text></svg>';
    if(type==='table') return common+'<rect x="70" y="40" width="380" height="130" rx="14" class="lv-card"/>'+[75,105,135].map(y=>'<line x1="85" y1="'+y+'" x2="435" y2="'+y+'" class="lv-grid"/>').join('')+'<line x1="220" y1="50" x2="220" y2="160" class="lv-grid"/><line x1="320" y1="50" x2="320" y2="160" class="lv-grid"/><text x="96" y="68" class="lv-text">переменная</text><text x="238" y="68" class="lv-text">β</text><text x="340" y="68" class="lv-text">смысл</text></svg>';
    return common+'<path d="M45 110 H130 M155 110 H240 M265 110 H350 M375 110 H465" class="lv-arrow"/><circle cx="142" cy="110" r="12" class="lv-dot"/><circle cx="252" cy="110" r="12" class="lv-dot"/><circle cx="362" cy="110" r="12" class="lv-dot"/><text x="40" y="75" class="lv-text">вопрос</text><text x="190" y="75" class="lv-text">модель</text><text x="315" y="75" class="lv-text">проверка</text><text x="420" y="75" class="lv-text">вывод</text></svg>';
  }

  function buildLessonPanel(chapter){
    const l=lessonContent[chapter], d=deepLessonContent[chapter];
    const longLesson=(window.LONG_LESSONS||{})[chapter];
    if(!l) return '';
    const deepData=d||{simple:l.lead,real:l.example,why:'Этот материал нужен для правильного выполнения следующего задания.',steps:l.points.map(p=>p[1]),terms:l.points,lecture:l.points.slice(0,3).map(p=>p[1])};
    const textbook = longLesson ? (
      '<div class="textbook-block">'+
        '<div class="textbook-head"><span class="pane-kicker">Полное объяснение</span><h4>'+longLesson.title+'</h4><p>Прочитай этот материал спокойно сверху вниз. Здесь специально нет ожидания, что ты уже знаешь математику или статистику.</p></div>'+
        longLesson.sections.map((sec,i)=>
          '<section class="textbook-section">'+
            '<div class="textbook-section-num">'+String(i+1).padStart(2,'0')+'</div>'+
            '<div><h5>'+sec.heading+'</h5>'+
              sec.paragraphs.map(p=>'<p>'+p+'</p>').join('')+
            '</div>'+
          '</section>'
        ).join('')+
        '<div class="formula-school">'+
          '<span class="pane-kicker">Разбираем запись</span>'+
          '<div class="formula-school-expression">'+longLesson.formula.expression+'</div>'+
          '<p>'+longLesson.formula.explanation+'</p>'+
        '</div>'+
        '<div class="remember-box"><span class="pane-kicker">Что запомнить перед заданием</span><ul>'+
          longLesson.remember.map(x=>'<li>'+x+'</li>').join('')+
        '</ul></div>'+
      '</div>'
    ) : '';

    return '<div class="lesson-gate" data-lesson="'+chapter+'">'+
      '<div class="lesson-top"><div><span class="lesson-label">Сначала разберёмся</span><h3>'+l.title+'</h3><p>'+l.lead+'</p></div><div class="lesson-status">Теория перед заданием</div></div>'+
      textbook+
      '<div class="lesson-body">'+
        '<div class="lesson-visual">'+lessonVisual(l.visual)+'</div>'+
        '<div class="lesson-concepts">'+l.points.map((p,i)=>'<article><span>0'+(i+1)+'</span><div><strong>'+p[0]+'</strong><p>'+p[1]+'</p></div></article>').join('')+'</div>'+
      '</div>'+
      '<div class="explain-switcher">'+
        '<button class="explain-tab active" data-pane="simple" type="button">Совсем просто</button>'+
        '<button class="explain-tab" data-pane="real" type="button">Реальный пример</button>'+
        '<button class="explain-tab" data-pane="why" type="button">Зачем это нужно</button>'+
      '</div>'+
      '<div class="explain-panes">'+
        '<div class="explain-pane active" data-pane="simple"><span class="pane-kicker">На пальцах</span><p>'+deepData.simple+'</p></div>'+
        '<div class="explain-pane" data-pane="real"><span class="pane-kicker">На реальной ситуации</span><p>'+deepData.real+'</p></div>'+
        '<div class="explain-pane" data-pane="why"><span class="pane-kicker">Практический смысл</span><p>'+deepData.why+'</p></div>'+
      '</div>'+
      '<div class="lesson-deep-grid">'+
        '<div class="step-card"><span class="pane-kicker">Как думать по шагам</span><ol>'+deepData.steps.map(x=>'<li>'+x+'</li>').join('')+'</ol></div>'+
        '<div class="term-card"><span class="pane-kicker">Словарь этого экрана</span><div class="local-terms">'+deepData.terms.map(t=>'<details><summary>'+t[0]+'</summary><p>'+t[1]+'</p></details>').join('')+'</div></div>'+
      '</div>'+
      '<div class="worked-example"><span>Короткий пример</span><p>'+l.example+'</p></div>'+
      '<div class="lesson-warning"><strong>Типичная ошибка:</strong> '+l.warning+'</div>'+
      '<div class="readiness-check"><label><input type="checkbox" class="readiness-box"> Я могу своими словами объяснить основную идею этого экрана.</label></div>'+
      '<div class="lesson-actions"><button class="btn primary lesson-unlock" type="button" disabled>Понял — перейти к заданию ↓</button><span>Сначала отметь, что идея понятна. Ошибаться в самом задании можно.</span></div>'+
    '</div>';
  }

  function initLessonGates(){
    document.querySelectorAll('[data-chapter]').forEach(section=>{
      const chapter=section.dataset.chapter;
      const holder=section.classList.contains('chapter') ? section : section.querySelector('.chapter');
      if(!holder || holder.querySelector('.lesson-gate')) return;
      const head=holder.querySelector('.chapter-head');
      if(!head) return;
      head.insertAdjacentHTML('afterend',buildLessonPanel(chapter));
      const gate=holder.querySelector('.lesson-gate');
      let after=false;
      [...holder.children].forEach(child=>{
        if(child===gate){ after=true; return; }
        if(after) child.classList.add('task-stage','is-locked');
      });

      gate.querySelectorAll('.explain-tab').forEach(tab=>tab.addEventListener('click',()=>{
        const pane=tab.dataset.pane;
        gate.querySelectorAll('.explain-tab').forEach(x=>x.classList.toggle('active',x===tab));
        gate.querySelectorAll('.explain-pane').forEach(x=>x.classList.toggle('active',x.dataset.pane===pane));
      }));

      const box=gate.querySelector('.readiness-box');
      const unlock=gate.querySelector('.lesson-unlock');
      box.addEventListener('change',()=>{unlock.disabled=!box.checked;});

      const unlocked=localStorage.getItem(NS+':lesson:'+chapter)==='1';
      if(unlocked){
        box.checked=true;
        unlock.disabled=false;
        unlockLesson(section,false);
      }
      unlock.addEventListener('click',()=>unlockLesson(section,true));
    });
  }

  function unlockLesson(section,scroll){
    const chapter=section.dataset.chapter;
    const gate=section.querySelector('.lesson-gate');
    if(!gate) return;
    localStorage.setItem(NS+':lesson:'+chapter,'1');
    gate.classList.add('lesson-done');
    const btn=gate.querySelector('.lesson-unlock');
    if(btn){btn.textContent='Объяснение пройдено ✓';btn.disabled=true;}
    const holder=section.classList.contains('chapter') ? section : section.querySelector('.chapter');
    let after=false, first=null;
    [...holder.children].forEach(child=>{
      if(child===gate){after=true;return;}
      if(after && child.classList.contains('task-stage')){
        child.classList.remove('is-locked');
        if(!first) first=child;
      }
    });
    if(scroll && first) setTimeout(()=>first.scrollIntoView({behavior:'smooth',block:'start'}),180);
  }


  function qInt(min,max){ return Math.floor(rnd(min,max+1)); }

  function makeChoice(kind,q,correct,wrong,why){
    const opts=shuffle([{text:correct,ok:true},...wrong.map(text=>({text,ok:false}))]);
    return {type:'choice',kind,q,a:opts.map(x=>x.text),right:opts.findIndex(x=>x.ok),why};
  }

  function makeScatterQuestion(){
    const pattern=shuffle(['positive','negative','none'])[0];
    const slope=pattern==='positive'?rnd(.55,.9):pattern==='negative'?rnd(-.9,-.55):rnd(-.06,.06);
    const noise=pattern==='none'?25:rnd(9,15);
    const points=Array.from({length:qInt(22,30)},()=>{
      const x=rnd(5,95);
      return {x,y:52+slope*(x-50)+normal()*noise};
    });
    const labels={positive:'Положительное',negative:'Отрицательное',none:'Почти отсутствует'};
    const opts=shuffle(['positive','negative','none']);
    return {
      type:'scatter',kind:'График связи',
      q:'Посмотри на новый набор данных. Какое направление линейной связи здесь заметнее?',
      points,a:opts.map(k=>labels[k]),right:opts.indexOf(pattern),
      why:pattern==='positive'?'Облако в среднем поднимается слева направо.':pattern==='negative'?'Облако в среднем опускается слева направо.':'У облака нет устойчивого линейного наклона.'
    };
  }

  function makeResidualQuestion(){
    const pattern=shuffle(['nonlinear','hetero','ok'])[0];
    const points=Array.from({length:qInt(38,50)},(_,i)=>{
      const x=-3+i*6/45;
      let y;
      if(pattern==='nonlinear') y=rnd(4.4,6.2)*(x*x-3)+normal()*rnd(3.2,5.2);
      else if(pattern==='hetero') y=normal()*(3.5+(x+3)*rnd(2.5,4.2));
      else y=normal()*rnd(6,9);
      return {x,y};
    });
    const labels={nonlinear:'Нелинейность',hetero:'Гетероскедастичность',ok:'Явной систематической проблемы не видно'};
    const opts=shuffle(['nonlinear','hetero','ok']);
    return {
      type:'residual',kind:'Диагностика',
      q:'Что показывает этот новый график остатков?',
      points,a:opts.map(k=>labels[k]),right:opts.indexOf(pattern),
      why:pattern==='nonlinear'?'Дуга означает, что прямая линия пропускает криволинейную структуру.':pattern==='hetero'?'Ширина разброса меняется — видна воронка.':'Остатки выглядят как случайное облако вокруг нуля.'
    };
  }

  function makeOutlierQuestion(){
    const n=qInt(14,19);
    const points=Array.from({length:n},(_,i)=>{
      const x=rnd(8,72);
      return {x,y:22+.62*x+normal()*7};
    });
    const side=Math.random()<.5?'right':'left';
    const target={x:side==='right'?rnd(94,104):rnd(-4,2),y:rnd(12,92),outlier:true,quizTarget:true};
    points.push(target);
    shuffle(points);
    return {type:'outlier',kind:'Выброс и leverage',q:'На новом графике нажми на точку с потенциально самым высоким leverage.',points,why:'Ищи наблюдение, которое дальше всего от основной массы именно по оси X.'};
  }

  function makeModelTableQuestion(){
    const best=rnd(10.5,16.5), mid=best+rnd(2,4.5), worst=mid+rnd(1.5,4);
    const models=shuffle([
      {name:'A',r2:rnd(.48,.66),rmse:worst},
      {name:'B',r2:rnd(.64,.79),rmse:best,best:true},
      {name:'C',r2:rnd(.78,.93),rmse:mid}
    ]);
    return {type:'modeltable',kind:'Выбор модели',q:'Для прогноза новых данных выбери модель с лучшим test-качеством.',models,why:'Для одной задачи меньшее значение test RMSE означает меньшую типичную ошибку прогноза.'};
  }

  function makeResidualClickQuestion(){
    const n=qInt(18,25);
    const points=Array.from({length:n},()=>{
      const x=rnd(5,95);
      return {x,y:18+.72*x+normal()*6};
    });
    const special=qInt(3,n-4);
    points[special].y+=(Math.random()<.5?-1:1)*rnd(24,36);
    const reg=regression(points);
    const residuals=points.map(p=>Math.abs(p.y-(reg.b0+reg.b1*p.x)));
    return {type:'residualclick',kind:'Остатки',q:'На новом графике нажми на точку с самым большим по модулю остатком.',points,reg,target:residuals.indexOf(Math.max(...residuals)),why:'Самый большой остаток — самое длинное вертикальное расстояние между наблюдением и линией.'};
  }

  function generateQuiz(){
    const b0=qInt(4,20), b1=qInt(2,7), x=qInt(2,9), yhat=b0+b1*x;
    const fact=qInt(45,90), pred=fact+qInt(-14,14) || fact+6;
    const resid=fact-pred;
    const coef=(Math.random()<.5?-1:1)*qInt(2,6);
    const r2=qInt(35,89)/100;
    const d0=qInt(25,65), db=qInt(4,15);
    const m0=qInt(15,35), mb1=qInt(2,6), mb2=qInt(1,4), mx1=qInt(2,6), mx2=qInt(5,9);
    const mpred=m0+mb1*mx1+mb2*mx2;
    const p=[.001,.008,.018,.027,.041,.064,.11,.18][qInt(0,7)];
    const sig=p<.05;
    const alpha=.05;

    const tasks=[
      {type:'number',kind:'Расчёт',q:'Модель: Ŷ = '+b0+' + '+b1+'X. Чему равен прогноз при X = '+x+'?',answer:yhat,tolerance:0,why:b1+'×'+x+' = '+(b1*x)+', затем '+b0+'+'+(b1*x)+' = '+yhat+'.'},
      makeChoice('OLS','Что именно минимизирует обычный МНК (OLS)?','Сумму квадратов остатков',['Сумму значений X','Количество коэффициентов','R²'],'OLS подбирает линию с минимальной суммой квадратов вертикальных ошибок.'),
      makeChoice('Коэффициент','В новой модели β₁ = '+coef+'. Какое чтение корректно?','При +1 к X прогноз Y в среднем меняется на '+coef,['X объясняет '+Math.abs(coef)+'% Y','Каждое Y обязательно меняется ровно на '+coef,'R² равно '+coef],'β₁ — изменение прогнозируемого Y при увеличении X на одну единицу.'),
      {type:'number',kind:'Остаток',q:'Факт Y = '+fact+', прогноз Ŷ = '+pred+'. Чему равен остаток e = Y − Ŷ?',answer:resid,tolerance:0,why:fact+'−'+pred+' = '+resid+'.'},
      makeChoice('R²','В новой модели R² = '+r2.toFixed(2).replace('.',',')+'. Что это означает?','Модель описывает около '+Math.round(r2*100)+'% вариации Y в этой выборке',['Около '+Math.round(r2*100)+'% наблюдений предсказаны точно','Причинность доказана на '+Math.round(r2*100)+'%','Ошибка равна '+Math.round((1-r2)*100)+' единицам'],'R² относится к доле вариации Y, описанной моделью.'),
      makeScatterQuestion(),
      makeScatterQuestion(),
      makeResidualQuestion(),
      makeResidualQuestion(),
      makeOutlierQuestion(),
      makeChoice('Dummy','Модель Ŷ = '+d0+' + '+db+'D, где D=0 для A и D=1 для B. Что означает коэффициент '+db+'?','Группа B в среднем выше A на '+db+' единиц',['Группа B выше на '+db+'%','Вероятность B равна '+db,'R² равно '+db],'Dummy-коэффициент — разница с базовой категорией в единицах Y.'),
      {type:'number',kind:'Dummy',q:'В модели Ŷ = '+d0+' + '+db+'D чему равен прогноз для группы B (D=1)?',answer:d0+db,tolerance:0,why:d0+' + '+db+'×1 = '+(d0+db)+'.'},
      makeChoice('Множественная регрессия','Ŷ = '+m0+' + '+mb1+'·подготовка + '+mb2+'·сон. Что означает коэффициент '+mb1+' при подготовке?','При +1 часу подготовки прогноз выше на '+mb1+' при одинаковом сне',['Нужно сложить '+mb1+' и '+mb2,'Сон не нужно учитывать','Это '+mb1+'%'],'В множественной регрессии другие включённые X мысленно фиксируются.'),
      {type:'number',kind:'Множественная регрессия',q:'Ŷ = '+m0+' + '+mb1+'·подготовка + '+mb2+'·сон. Подготовка = '+mx1+', сон = '+mx2+'. Чему равен прогноз?',answer:mpred,tolerance:0,why:m0+' + '+mb1+'×'+mx1+' + '+mb2+'×'+mx2+' = '+mpred+'.'},
      makeChoice('p-value','Исследователь получил p = '+p.toFixed(3).replace('.',',')+' при α = 0,05. Какой вывод корректнее?',sig?'Есть основание отвергнуть H₀ при α=0,05, но это не вероятность истинности эффекта':'При α=0,05 данных недостаточно для отвержения H₀',['Эффект истинный с вероятностью '+Math.round((1-p)*100)+'%','Эффект автоматически причинный','R² можно вычислить как 1−p'],sig?'p меньше α, поэтому H₀ отвергают в рамках этой процедуры; это не вероятность истинности эффекта.':'p больше α, поэтому при таком пороге H₀ не отвергают.'),
      makeChoice('Мультиколлинеарность','Какая пара сильнее всего рискует дублировать одну и ту же информацию?','Годовой доход ↔ месячная зарплата',['Возраст ↔ доход','Рост ↔ вес','Регион ↔ политический интерес'],'Эти две величины могут быть почти прямым пересчётом друг друга.'),
      makeModelTableQuestion(),
      makeChoice('Y / X / контроль','Вопрос: «Связаны ли часы сна с результатом теста, если учесть курс обучения?» Как распределить роли?','Y=результат теста, X=часы сна, контроль=курс',['Y=часы сна, X=результат теста, контроль=курс','Y=курс, X=сон, контроль=результат','Y=результат, X=курс, контроль=сон'],'Y — то, что объясняем; X — главный интересующий фактор; курс — дополнительный контроль.'),
      makeChoice('Причинность','Коэффициент X положительный и статистически значимый. Что НЕ следует автоматически?','X причинно повышает Y',['В модели есть положительная ассоциация','Знак коэффициента можно интерпретировать','По формуле можно получить условный прогноз'],'Ассоциация и статистическая значимость сами по себе не доказывают причинный эффект.'),
      makeResidualClickQuestion()
    ];
    return shuffle(tasks);
  }


  function quizScatterPoints(pattern){
    const pts=[];
    for(let i=0;i<24;i++){
      const x=6+i*3.7;
      let y;
      if(pattern==='positive') y=18+.72*x+seededNoise(i+210)*13;
      else y=92-.68*x+seededNoise(i+260)*13;
      pts.push({x,y});
    }
    return pts;
  }

  function quizResidualPoints(pattern){
    return Array.from({length:38},(_,i)=>{
      const x=-3+i*6/37;
      let y;
      if(pattern==='nonlinear') y=5.2*(x*x-3)+seededNoise(i+320)*5;
      else if(pattern==='hetero') y=seededNoise(i+360)*(4+(x+3)*3.4);
      else y=seededNoise(i+400)*8;
      return {x,y};
    });
  }

  function renderQuizVisual(q){
    const visual=$('#quizVisual');
    visual.hidden=true;
    visual.innerHTML='';
    if(q.type==='scatter'){
      visual.hidden=false;
      const svg=svgEl('svg',{viewBox:'0 0 620 330'});
      visual.append(svg);
      drawScatter(svg,q.points,{w:620,h:330,pad:42});
    } else if(q.type==='residual'){
      visual.hidden=false;
      const svg=svgEl('svg',{viewBox:'0 0 620 330'});
      visual.append(svg);
      drawScatter(svg,q.points,{w:620,h:330,pad:42,zeroY:0,fixed:{xmin:-3.3,xmax:3.3,ymin:-36,ymax:36}});
    } else if(q.type==='outlier'){
      visual.hidden=false;
      const svg=svgEl('svg',{viewBox:'0 0 620 330'});
      visual.append(svg);
      drawScatter(svg,q.points,{w:620,h:330,pad:42});
      svg.querySelectorAll('circle').forEach((c,i)=>{
        c.style.cursor='pointer';
        c.addEventListener('click',()=>answerQuizPoint(!!q.points[i].quizTarget,c,q));
      });
    } else if(q.type==='modeltable'){
      visual.hidden=false;
      const models=q.models;
      visual.innerHTML='<div class="quiz-model-table">'+models.map((m,i)=>'<button type="button" data-model="'+i+'"><strong>Модель '+m.name+'</strong><span>R² train '+m.r2.toFixed(2)+'</span><span>RMSE test '+m.rmse.toFixed(1)+'</span></button>').join('')+'</div>';
      visual.querySelectorAll('button').forEach((b,i)=>b.addEventListener('click',()=>answerQuizModel(models[i],b,q)));
    } else if(q.type==='residualclick'){
      visual.hidden=false;
      const svg=svgEl('svg',{viewBox:'0 0 620 330'});
      visual.append(svg);
      drawScatter(svg,q.points,{w:620,h:330,pad:42,line:q.reg,residuals:true,clickable:true});
      svg.querySelectorAll('circle').forEach((c,i)=>c.addEventListener('click',()=>answerQuizPoint(i===q.target,c,q)));
    }
  }

  function startQuiz() {
    state.quiz = {active:true,index:0,score:0,locked:false,order:generateQuiz(),attempts:0};
    $('#quizStart').style.display = 'none';
    $('#quizNext').disabled = true;
    renderQuiz();
  }

  function renderQuiz() {
    const q = state.quiz.order[state.quiz.index];
    const total=state.quiz.order.length;
    $('#quizCounter').textContent = 'Задание ' + (state.quiz.index+1) + ' / ' + total;
    $('#quizScore').textContent = state.quiz.score;
    $('#quizProgressFill').style.width = (state.quiz.index/total*100) + '%';
    $('#quizQuestion').textContent = q.q;
    $('#quizKind').textContent=q.kind||'Практика';
    $('#quizAttempts').textContent='Попытки: 0';
    $('#quizAnswers').innerHTML = '';
    $('#quizInputZone').innerHTML='';
    $('#quizInputZone').hidden=true;
    $('#quizVisual').hidden=true;
    $('#quizVisual').innerHTML='';
    state.quiz.attempts = 0;
    $('#quizNext').disabled = true;

    if(q.type==='choice' || q.type==='scatter' || q.type==='residual' || q.type==='roles'){
      const box=$('#quizAnswers');
      q.a.forEach((text,i)=>{
        const b=document.createElement('button');
        b.textContent=text;
        b.addEventListener('click',()=>answerQuiz(i,b));
        box.append(b);
      });
    } else if(q.type==='number'){
      const zone=$('#quizInputZone');
      zone.hidden=false;
      zone.innerHTML='<div class="quiz-number-box"><input id="quizNumberInput" inputmode="decimal" placeholder="Введите число"><button class="btn electric" id="quizNumberCheck" type="button">Проверить</button></div>';
      $('#quizNumberCheck').addEventListener('click',()=>answerQuizNumber(q));
      $('#quizNumberInput').addEventListener('keydown',e=>{if(e.key==='Enter') answerQuizNumber(q);});
    }
    renderQuizVisual(q);
    $('#quizFeedback').textContent = '';
    $('#quizFeedback').className = 'feedback dark-feedback';
  }

  function quizWrongHint(q){
    const hints={
      'Расчёт':'Подставь X в формулу. Сначала выполни умножение, затем прибавь свободный член. Я не показываю готовый результат.',
      'Остаток':'Вспомни порядок: остаток = фактическое Y − прогноз Ŷ. Проверь знак и пересчитай самостоятельно.',
      'Dummy':'Для D=1 к базовой части добавляется коэффициент при D. Выполни подстановку, но не ищи ответ в подсказке.',
      'Множественная регрессия':'Раздели формулу на части: константа, вклад первого X и вклад второго X. Сначала посчитай каждое произведение отдельно.',
      'Коэффициент':'Спроси себя: что произойдёт с прогнозом Y, если X увеличится ровно на одну единицу?',
      'R²':'R² говорит о вариации Y, описанной моделью, а не о проценте точных наблюдений и не о причинности.',
      'p-value':'Сравни p с α. Не превращай p-value в вероятность истинности эффекта.',
      'Мультиколлинеарность':'Ищи две переменные, которые почти измеряют одну и ту же величину.',
      'Y / X / контроль':'Сначала ответь: что объясняем? Это Y. Затем: связь какого фактора интересует? Это X.',
      'Причинность':'Отдели статистическую связь от утверждения о причине.',
      'График связи':'Смотри на общий наклон всего облака, а не на отдельные точки.',
      'Диагностика':'Ищи форму всего облака остатков: дугу, воронку или случайный разброс.',
      'Выброс и leverage':'Ищи точку, которая дальше всего от основной массы по горизонтальной оси X.',
      'Выбор модели':'Для прогноза новых данных сравни test RMSE: меньше означает меньшую типичную ошибку.'
    };
    return hints[q.kind]||'Вернись к правилу из соответствующего раздела и попробуй ещё раз. Готовый ответ подсказка не раскрывает.';
  }

  function answerQuiz(i,btn) {
    if (!state.quiz.active || !$('#quizNext').disabled) return;
    const q = state.quiz.order[state.quiz.index], ok = i === q.right;
    state.quiz.attempts=(state.quiz.attempts||0)+1;
    $('#quizAttempts').textContent='Попытки: '+state.quiz.attempts;
    btn.classList.remove('correct','wrong');
    btn.classList.add(ok ? 'correct' : 'wrong');
    if(ok){
      state.quiz.score++;
      $('#quizScore').textContent = state.quiz.score;
      $$('#quizAnswers button').forEach(b=>b.disabled=true);
      setFeedback($('#quizFeedback'),true,'Верно. '+q.why);
      $('#quizNext').disabled = false;
    } else {
      setFeedback($('#quizFeedback'),false,'Пока нет. '+quizWrongHint(q)+' Попробуй ещё раз.');
    }
  }

  function answerQuizNumber(q){
    if(!$('#quizNext').disabled) return;
    const input=$('#quizNumberInput');
    const raw=String(input.value).trim().replace(',','.');
    const value=Number(raw);
    state.quiz.attempts=(state.quiz.attempts||0)+1;
    $('#quizAttempts').textContent='Попытки: '+state.quiz.attempts;
    const ok=Number.isFinite(value)&&Math.abs(value-q.answer)<=q.tolerance;
    if(ok){
      state.quiz.score++; $('#quizScore').textContent=state.quiz.score;
      input.disabled=true; $('#quizNumberCheck').disabled=true;
      setFeedback($('#quizFeedback'),true,'Верно. '+q.why);
      $('#quizNext').disabled=false;
    } else {
      setFeedback($('#quizFeedback'),false,'Пока неверно. '+quizWrongHint(q)+' Пересчитай и попробуй снова.');
      input.select();
    }
  }

  function answerQuizPoint(ok,el,q){
    if(!$('#quizNext').disabled) return;
    state.quiz.attempts=(state.quiz.attempts||0)+1;
    $('#quizAttempts').textContent='Попытки: '+state.quiz.attempts;
    if(ok){
      state.quiz.score++; $('#quizScore').textContent=state.quiz.score;
      el.setAttribute('r','10');
      el.style.fill='#6dff9a';
      setFeedback($('#quizFeedback'),true,'Верно. '+q.why);
      $('#quizNext').disabled=false;
    } else {
      el.style.opacity='.25';
      setFeedback($('#quizFeedback'),false,'Не эта точка. '+quizWrongHint(q)+' Попробуй другую.');
    }
  }

  function answerQuizModel(model,btn,q){
    if(!$('#quizNext').disabled) return;
    state.quiz.attempts=(state.quiz.attempts||0)+1;
    $('#quizAttempts').textContent='Попытки: '+state.quiz.attempts;
    if(model.best){
      state.quiz.score++; $('#quizScore').textContent=state.quiz.score;
      btn.classList.add('correct');
      $('#quizVisual').querySelectorAll('button').forEach(b=>b.disabled=true);
      setFeedback($('#quizFeedback'),true,'Верно. '+q.why);
      $('#quizNext').disabled=false;
    }else{
      btn.classList.add('wrong');
      setFeedback($('#quizFeedback'),false,'Эта модель не подходит. '+quizWrongHint(q)+' Сравни варианты ещё раз.');
    }
  }

  function nextQuiz() {
    if (!state.quiz.active) return;
    const total=state.quiz.order.length;
    if (state.quiz.index < total-1) {
      state.quiz.index++;
      renderQuiz();
      return;
    }
    $('#quizProgressFill').style.width = '100%';
    $('#quizCounter').textContent = 'Финиш';
    $('#quizKind').textContent='Курс пройден';
    $('#quizAttempts').textContent='';
    $('#quizQuestion').textContent = 'Ты решил все ' + total + ' заданий';
    $('#quizAnswers').innerHTML = '';
    $('#quizVisual').hidden=true;
    $('#quizInputZone').hidden=true;
    setFeedback($('#quizFeedback'),true,'Финальный практикум завершён. Все задания были решены правильно, потому что переход дальше возможен только после верного ответа.');
    $('#quizNext').disabled = true;
    $('#quizStart').style.display = 'inline-flex';
    $('#quizStart').textContent = 'Пройти 20 заданий ещё раз';
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

    const backToTop=$('#backToTop');
    const updateBackToTop=()=>backToTop.classList.toggle('show',window.scrollY>520);
    window.addEventListener('scroll',updateBackToTop,{passive:true});
    updateBackToTop();
    backToTop.addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));
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
    restoreNextButtons();
    initReveal();
    initLessonGates();
    addPracticeRestartButtons();
    injectTaskGuides();
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