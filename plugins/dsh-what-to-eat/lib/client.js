// 今日美食 · Client 半侧
// 两个视图共用同一个 store：右侧栏常驻面板 + 会话输入框上方的卡片。
// 卡片是视图，不向会话日志写任何事件。

window.__ModuleLoader__.load({
  id: 'dsh-what-to-eat',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    const API = '/dsh-what-to-eat/api';
    const PANEL_ID = 'dsh-what-to-eat';
    const TAB_KIND = 'today-menu';
    // 每次改客户端就+1：diag 里能直接看出页面加载的是哪一版，避免「刷新了但拿的是缓存」。
    const BUILD_TAG = 'b24';
    // 跨组件的小引用：卡片点菜名时用它把侧栏面板打开。
    const uiRefs = { openPanel: null };

    // ── 文案 ─────────────────────────────────────────────
    const ZH = {
      'panel.title': '今日美食',
      'panel.guide': '按你设置的时间，从菜库里随机抽一道菜',
      'tab.today': '今天',
      'tab.library': '菜库',
      'tab.schedule': '时间表',
      'tab.settings': '设置',
      'common.save': '保存',
      'common.cancel': '取消',
      'common.delete': '删除',
      'common.edit': '编辑',
      'common.add': '新增',
      'common.confirm': '确认',
      'common.close': '收起',
      'common.loading': '加载中…',
      'common.empty': '还没有内容',
      'common.search': '搜索菜名或标签',
      'common.all': '全部',
      'common.active': '启用',
      'common.disabled': '已停用',
      'common.yes': '开',
      'common.no': '关',
      'common.minutes': '分钟',
      'common.days': '天',
      'common.clearFilters': '清空筛选',
      'library.allMeals': '全部餐次',
      'library.entries': '条',
      'library.shown': '筛出 {n} 条',
      'library.enableAll': '全部启用',
      'library.disableAll': '全部停用',
      'library.disableAllConfirm': '把筛选出来的 {n} 条全部停用？（它们会保留在库里，只是不再被抽到）',
      'library.bulkDone': '已更新 {n} 条',
      'card.today': '今日已抽',
      'card.none': '今天还没有抽取。到点会自动出现，也可以在时间表里改时间。',
      'card.reroll': '换一道',
      'card.guide': '看攻略',
      'card.openPanel': '点菜名或「面板」按钮打开今日美食面板',
      'card.panelButton': '面板',
      'card.hideToEdge': '收到边上去（点边条可再展开）',
      'card.expand': '点一下展开',
      'card.recipe': '做法',
      'card.catchup': '补发',
      'card.relaxed': '已放宽去重',
      'card.repeat': '池子不够，允许重复',
      'meal.B': '早餐',
      'meal.L': '午餐',
      'meal.D': '晚餐',
      'library.add': '添加条目',
      'library.import': '导入',
      'library.export': '导出',
      'library.count': '共 {n} 条，启用 {a} 条',
      'library.name': '菜名',
      'library.meal': '餐次',
      'library.tags': '标签（逗号分隔）',
      'library.recipe': '做法（可空）',
      'library.url': '攻略链接（可空，留空则用平台搜索）',
      'library.weight': '权重（0.2–5）',
      'library.weightHint': '1 = 正常几率；2 = 更容易被抽到（约两倍）；0.5 = 很少出现。范围 0.2–5，超出会自动夹住——想天天吃同一样，把它设 3 左右再关掉别的菜更稳。',
      'library.dupe': '已有同名条目',
      'schedule.label': '名称',
      'schedule.time': '时间',
      'schedule.meal': '餐次',
      'schedule.days': '星期',
      'schedule.mode': '模式',
      'schedule.mode.global': '跟随默认',
      'schedule.count': '抽取条数',
      'schedule.count.global': '跟随默认',
      'schedule.mode.name': '只推菜名',
      'schedule.mode.guide': '菜名 + 攻略',
      'schedule.add': '添加档位',
      'schedule.state.fired': '今日已推',
      'schedule.state.pending': '等待推送',
      'schedule.state.missed': '已错过',
      'schedule.state.empty': '题库为空',
      'schedule.state.deferred': '静默顺延中',
      'settings.mode': '默认模式',
      'settings.mode.name': '① 只推菜名',
      'settings.mode.guide': '② 菜名 + 攻略',
      'settings.candidates': '每次抽取条数',
      'settings.scene': '场景偏好',
      'settings.sceneHint': '选了场景就只在它里面抽（比如「减脂」）；「全部」则不区分。',
      'scene.all': '全部',
      'library.scene': '场景（家常 / 外卖 / 减脂 / 放纵 / 快手）',
      'settings.retention': '去重窗口（天）',
      'settings.catchup': '错过补推窗口（分钟）',
      'settings.quiet': '静默时段',
      'settings.quiet.from': '开始',
      'settings.quiet.to': '结束',
      'settings.like': '喜好标签（命中加权）',
      'settings.dislike': '忌口标签（不入抽取池）',
      'settings.boost': '喜好权重倍数',
      'settings.platform': '攻略搜索模板',
      'settings.platform.hint': '用 {q} 代表菜名；生成的是搜索结果页，不是具体帖子。',
      'settings.import.title': '导入',
      'settings.import.hint': '支持 JSON、CSV（name,meal,tags,recipe,url,weight,disabled）、一行一个菜名。',
      'settings.import.preview': '预览',
      'settings.import.commit': '确认导入',
      'settings.import.undo': '撤销上一步',
      'settings.syncBuiltins': '同步内置菜',
      'settings.import.added': '将新增 {n} 条',
      'settings.import.dupe': '同名跳过 {n} 条',
      'settings.import.conflict': '{n} 条同名字段不同（保留原有）',
      'settings.export.json': '导出 JSON',
      'settings.export.csv': '导出 CSV',
      'settings.clear': '清空历史与去重状态',
      'settings.clear.confirm': '清空后历史与「当天已推」记录都会消失，确定？',
      'settings.reset': '重置为出厂状态',
      'settings.reset.confirm': '会删除所有自定义条目、时间表改动与历史，恢复内置 137 条与默认档位。确定？',
      'settings.data': '数据只存在本机，不上传、不采集。',
      'settings.unsaved': '有未保存的改动',
    };
    const EN = {
      'panel.title': 'Today’s Menu',
      'panel.guide': 'Draws one home-cooked dish from your library at the times you set.',
      'tab.today': 'Today',
      'tab.library': 'Library',
      'tab.schedule': 'Schedule',
      'tab.settings': 'Settings',
      'common.save': 'Save',
      'common.cancel': 'Cancel',
      'common.delete': 'Delete',
      'common.edit': 'Edit',
      'common.add': 'Add',
      'common.confirm': 'Confirm',
      'common.close': 'Dismiss',
      'common.loading': 'Loading…',
      'common.empty': 'Nothing yet',
      'common.search': 'Search name or tag',
      'common.all': 'All',
      'common.active': 'Active',
      'common.disabled': 'Disabled',
      'common.yes': 'On',
      'common.no': 'Off',
      'common.minutes': 'min',
      'common.days': 'days',
      'common.clearFilters': 'Clear filters',
      'library.allMeals': 'All meals',
      'library.entries': 'entries',
      'library.shown': '{n} shown',
      'library.enableAll': 'Enable all',
      'library.disableAll': 'Disable all',
      'library.disableAllConfirm': 'Disable all {n} filtered entries? They stay in the library but will not be drawn.',
      'library.bulkDone': '{n} updated',
      'card.today': 'Picked today',
      'card.none': 'Nothing picked yet today.',
      'card.reroll': 'Another',
      'card.guide': 'Open guide',
      'card.openPanel': 'Click the dish name or the Panel button to open the Today’s Menu panel',
      'card.panelButton': 'Panel',
      'card.hideToEdge': 'Dock to the edge (click the strip to reopen)',
      'card.expand': 'Click to expand',
      'card.recipe': 'Method',
      'card.catchup': 'Catch-up',
      'card.relaxed': 'Relaxed dedupe',
      'card.repeat': 'Pool exhausted, repeats allowed',
      'meal.B': 'Breakfast',
      'meal.L': 'Lunch',
      'meal.D': 'Dinner',
      'library.add': 'Add entry',
      'library.import': 'Import',
      'library.export': 'Export',
      'library.count': '{n} entries, {a} active',
      'library.name': 'Name',
      'library.meal': 'Meal',
      'library.tags': 'Tags (comma separated)',
      'library.recipe': 'Method (optional)',
      'library.url': 'Guide URL (optional)',
      'library.weight': 'Weight (0.2–5)',
      'library.weightHint': '1 = normal chance; 2 = about twice as likely; 0.5 = rarely. Values outside 0.2–5 are clamped automatically.',
      'library.dupe': 'Name already exists',
      'schedule.label': 'Label',
      'schedule.time': 'Time',
      'schedule.meal': 'Meal',
      'schedule.days': 'Days',
      'schedule.mode': 'Mode',
      'schedule.mode.global': 'Use default',
      'schedule.count': 'Dishes per draw',
      'schedule.count.global': 'Use default',
      'schedule.mode.name': 'Name only',
      'schedule.mode.guide': 'Name + guide',
      'schedule.add': 'Add slot',
      'schedule.state.fired': 'Pushed today',
      'schedule.state.pending': 'Waiting',
      'schedule.state.missed': 'Missed',
      'schedule.state.empty': 'Empty pool',
      'schedule.state.deferred': 'Deferred by quiet hours',
      'settings.mode': 'Default mode',
      'settings.mode.name': '① Name only',
      'settings.mode.guide': '② Name + guide',
      'settings.candidates': 'Dishes per draw',
      'settings.scene': 'Scene',
      'settings.sceneHint': 'A chosen scene restricts draws to it (e.g. “减脂”); “All” ignores scenes.',
      'scene.all': 'All',
      'library.scene': 'Scenes (family / takeout / light / treat / quick)',
      'settings.retention': 'Dedupe window (days)',
      'settings.catchup': 'Catch-up window (min)',
      'settings.quiet': 'Quiet hours',
      'settings.quiet.from': 'From',
      'settings.quiet.to': 'To',
      'settings.like': 'Liked tags (boosted)',
      'settings.dislike': 'Avoided tags (excluded)',
      'settings.boost': 'Liked weight multiplier',
      'settings.platform': 'Guide search template',
      'settings.platform.hint': 'Use {q} for the dish name. This opens a search result page, not a specific post.',
      'settings.import.title': 'Import',
      'settings.import.hint': 'JSON, CSV (name,meal,tags,recipe,url,weight,disabled), or one dish name per line.',
      'settings.import.preview': 'Preview',
      'settings.import.commit': 'Import',
      'settings.import.undo': 'Undo',
      'settings.syncBuiltins': 'Sync built-ins',
      'settings.import.added': '{n} to add',
      'settings.import.dupe': '{n} skipped (same name)',
      'settings.import.conflict': '{n} with different fields (kept existing)',
      'settings.export.json': 'Export JSON',
      'settings.export.csv': 'Export CSV',
      'settings.clear': 'Clear history and dedupe state',
      'settings.clear.confirm': 'History and today’s marks will be removed. Continue?',
      'settings.reset': 'Reset to factory state',
      'settings.reset.confirm': 'Deletes custom entries, schedule edits and history, restoring the 137 built-ins and default slots. Continue?',
      'settings.data': 'Data stays on this machine. Nothing is uploaded.',
      'settings.unsaved': 'Unsaved changes',
    };
    const LANG = (() => {
      const raw = (document.documentElement.lang || navigator.language || 'zh').toLowerCase();
      return raw.startsWith('en') ? 'en' : 'zh';
    })();
    const T = (key, vars) => {
      const table = LANG === 'en' ? EN : ZH;
      let s = table[key] ?? ZH[key] ?? key;
      if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
      return s;
    };

    // ── 数据 store（两个视图共用一次轮询）────────────────
    const viewer = (() => {
      const KEY = 'what-to-eat.viewer';
      let v = null;
      try {
        v = localStorage.getItem(KEY);
      } catch {
        /* 隐私模式 */
      }
      if (!v) {
        v = `v${Math.random().toString(36).slice(2, 10)}`;
        try {
          localStorage.setItem(KEY, v);
        } catch {
          /* ignore */
        }
      }
      return v;
    })();

    const store = {
      data: null,
      error: null,
      loading: true,
      refs: 0,
      timer: null,
      listeners: new Set(),
      surfaces: new Set(),
      subscribe(fn) {
        this.listeners.add(fn);
        return () => this.listeners.delete(fn);
      },
      emit() {
        this.listeners.forEach((fn) => {
          try {
            fn();
          } catch {
            /* 单个订阅出错不影响其它 */
          }
        });
      },
      async load() {
        // surface=session 只在会话卡片挂着时上报：面板独自轮询不算「有活动会话」。
        const surface = this.surfaces.has('session') ? 'session' : 'panel';
        try {
          const res = await fetch(`${API}/state?viewer=${encodeURIComponent(viewer)}&surface=${surface}`, { cache: 'no-store' });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          this.data = await res.json();
          this.error = null;
        } catch (err) {
          this.error = err.message || String(err);
        } finally {
          this.loading = false;
          this.emit();
        }
      },
      async call(cmd, body) {
        const res = await fetch(`${API}${cmd}?viewer=${encodeURIComponent(viewer)}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-dsh-what-to-eat': '1' },
          body: JSON.stringify(body || {}),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          // 统一把失败暴露到面板顶部，避免「点了没反应」。
          this.error = json.error || `HTTP ${res.status}`;
          this.emit();
          throw new Error(this.error);
        }
        await this.load();
        return json;
      },
      clearError() {
        this.error = null;
        this.emit();
      },
      start() {
        this.refs += 1;
        if (this.refs > 1) return () => {};
        this.load();
        this.timer = setInterval(() => {
          if (!document.hidden) this.load();
        }, 12_000);
        const onFocus = () => this.load();
        window.addEventListener('focus', onFocus);
        return () => {
          window.removeEventListener('focus', onFocus);
        };
      },
      stop() {
        this.refs = Math.max(0, this.refs - 1);
        if (this.refs === 0 && this.timer) {
          clearInterval(this.timer);
          this.timer = null;
        }
      },
    };

    function useStore(surface) {
      const [, force] = React.useState(0);
      React.useEffect(() => {
        if (surface) store.surfaces.add(surface);
        const off = store.subscribe(() => force((n) => n + 1));
        const offWindow = store.start();
        return () => {
          if (surface) store.surfaces.delete(surface);
          off();
          offWindow();
          store.stop();
        };
      }, []);
      return store;
    }

    // ── 小组件 ───────────────────────────────────────────
    const css = `
      .tm-root{font:13px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--dsw-alias-label-primary,#e6e6e6);display:flex;flex-direction:column;height:100%;min-height:0}
      .tm-root *{box-sizing:border-box}
      .tm-head{padding:10px 12px 8px;border-bottom:1px solid var(--dsw-alias-border-l1,#2c2c2c);display:flex;gap:8px;align-items:center;justify-content:space-between}
      .tm-title{font-weight:600;font-size:13px}
      .tm-sub{color:var(--dsw-alias-label-tertiary,#8a8a8a);font-size:11px;margin-top:2px}
      .tm-tabs{display:flex;gap:2px;padding:8px 10px 0}
      .tm-tab{appearance:none;border:0;background:transparent;color:var(--dsw-alias-label-secondary,#b4b4b4);padding:5px 9px;border-radius:6px;cursor:pointer;font:inherit}
      .tm-tab:hover{background:var(--dsw-alias-interactive-bg-hover,#2a2a2a)}
      .tm-tab.is-on{background:var(--dsw-alias-interactive-bg-active,#333);color:var(--dsw-alias-label-primary,#fff)}
      .tm-body{flex:1;min-height:0;overflow:auto;padding:10px 12px 24px}
      .tm-card,.tm-block{background:var(--dsw-alias-bg-layer-1,#1b1b1b);border:1px solid var(--dsw-alias-border-l1,#2c2c2c);border-radius:8px;padding:10px}
      .tm-block+.tm-block{margin-top:10px}
      .tm-row{display:flex;gap:8px;align-items:center}
      .tm-between{justify-content:space-between}
      .tm-wrap{display:flex;flex-wrap:wrap;gap:6px}
      .tm-chip{display:inline-flex;align-items:center;gap:4px;border:1px solid var(--dsw-alias-border-l2,#3a3a3a);border-radius:999px;padding:1px 7px;font-size:11px;color:var(--dsw-alias-label-secondary,#b4b4b4)}
      .tm-chip-btn{cursor:pointer;background:transparent;font:inherit;font-size:11px;line-height:1.5}
      .tm-chip-btn:hover{border-color:var(--dsw-alias-brand-primary,#0f1115);color:var(--dsw-alias-label-primary,#0f1115)}
      .tm-chip.is-on{background:var(--dsw-alias-brand-primary,#0f1115);border-color:transparent;color:var(--dsw-alias-label-primary-foreground,#fff)}
      .tm-chip.is-like{border-color:var(--dsw-alias-brand-primary,#4c8dff);color:var(--dsw-alias-brand-primary,#8ab4ff)}
      .tm-chip.is-warn{border-color:var(--dsw-alias-state-warn-primary,#c08a2e);color:var(--dsw-alias-state-warn-primary,#e0b063)}
      .tm-btn{appearance:none;border:1px solid var(--dsw-alias-border-l2,#3a3a3a);background:var(--dsw-alias-bg-layer-2,#232323);color:var(--dsw-alias-label-primary,#e6e6e6);border-radius:6px;padding:4px 9px;font:inherit;cursor:pointer}
      .tm-btn:hover{background:var(--dsw-alias-interactive-bg-hover,#2c2c2c)}
      .tm-btn.is-primary{background:var(--dsw-alias-button-primary-fill,#3b6fd4);border-color:transparent;color:var(--dsw-alias-label-primary-foreground,#fff)}
      .tm-btn.is-danger{color:var(--dsw-alias-state-error-primary,#e06c6c)}
      .tm-btn:disabled{opacity:.45;cursor:not-allowed}
      .tm-btn.is-sm{padding:2px 7px;font-size:11px}
      .tm-input,.tm-select,.tm-area{width:100%;background:var(--dsw-alias-bg-base,#141414);border:1px solid var(--dsw-alias-border-l2,#3a3a3a);border-radius:6px;color:var(--dsw-alias-label-primary,#e6e6e6);padding:5px 7px;font:inherit}
      .tm-area{min-height:84px;resize:vertical;font-family:ui-monospace,Consolas,monospace;font-size:12px}
      .tm-field{display:flex;flex-direction:column;gap:4px;margin-top:8px}
      .tm-label{font-size:11px;color:var(--dsw-alias-label-tertiary,#8a8a8a)}
      .tm-grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
      .tm-list{display:flex;flex-direction:column;gap:6px}
      .tm-item{border:1px solid var(--dsw-alias-border-l1,#2c2c2c);border-radius:7px;padding:7px 9px;background:var(--dsw-alias-bg-layer-1,#1b1b1b)}
      .tm-item.is-off{opacity:.5}
      .tm-name{font-weight:600;font-size:12.5px}
      .tm-meta{font-size:11px;color:var(--dsw-alias-label-tertiary,#8a8a8a)}
      .tm-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}
      .tm-seg{display:inline-flex;border:1px solid var(--dsw-alias-border-l2,#3a3a3a);border-radius:7px;overflow:hidden}
      .tm-seg button{appearance:none;border:0;background:transparent;color:var(--dsw-alias-label-secondary,#b4b4b4);padding:4px 8px;font:inherit;cursor:pointer}
      .tm-seg button.is-on{background:var(--dsw-alias-interactive-bg-active,#333);color:var(--dsw-alias-label-primary,#fff)}
      /* 开关：明确的轨道 + 白色滑块 + 阴影，关/开对比强烈，避免被看成普通胶囊 */
      .tm-switch{position:relative;display:inline-flex;align-items:center;width:44px;height:24px;flex:none;vertical-align:middle;cursor:pointer}
      .tm-switch input{position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0;cursor:pointer;z-index:2}
      .tm-switch .tm-track{position:absolute;inset:0;border-radius:999px;background:var(--dsw-alias-border-l3,#cfd4da);box-shadow:inset 0 0 0 1px var(--dsw-alias-border-l2,#c3c8cf),inset 0 1px 2px rgba(0,0,0,.12);transition:background .16s ease,box-shadow .16s ease}
      .tm-switch .tm-knob{position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.45),0 0 0 .5px rgba(0,0,0,.1);transition:transform .16s ease}
      .tm-switch input:checked~.tm-track{background:var(--dsw-alias-brand-primary,#0f1115);box-shadow:inset 0 0 0 1px var(--dsw-alias-brand-primary,#0f1115)}
      .tm-switch input:checked~.tm-knob{transform:translateX(20px)}
      .tm-switch input:focus-visible~.tm-track{outline:2px solid var(--dsw-alias-brand-primary,#0f1115);outline-offset:2px}
      .tm-switch:hover .tm-track{filter:brightness(.96)}
      .tm-warn{border:1px solid var(--dsw-alias-state-warn-primary,#c08a2e);color:var(--dsw-alias-state-warn-primary,#e0b063);border-radius:7px;padding:6px 8px;font-size:11.5px;margin-bottom:8px}
      .tm-err{color:var(--dsw-alias-state-error-primary,#e06c6c);font-size:11.5px;margin-top:6px}
      .tm-ok{color:var(--dsw-alias-state-success-primary,#59b981);font-size:11.5px;margin-top:6px}
      .tm-empty{color:var(--dsw-alias-label-tertiary,#8a8a8a);font-size:12px;padding:12px 0;text-align:center}
      /* 会话卡片 */
      .tm-card-root{padding:0 0 6px}
      .tm-card{padding:9px 11px;display:flex;flex-direction:column;gap:6px}
      /* 悬浮卡片：固定定位，不参与输入框布局，不会把输入框顶起来 */
      .tm-float{position:fixed;right:20px;bottom:104px;width:min(360px,calc(100vw - 40px));z-index:50;pointer-events:auto;display:block}
      .tm-float .tm-card{box-shadow:0 14px 36px rgba(0,0,0,.18),0 1px 3px rgba(0,0,0,.08);border-radius:14px;padding:12px 14px}
      .tm-float.is-dragging .tm-card{box-shadow:0 20px 46px rgba(0,0,0,.24);transform:scale(1.01)}
      .tm-float.is-dragging{opacity:.98}
      .tm-drag{cursor:grab;touch-action:none;user-select:none;-webkit-user-select:none}
      .tm-float.is-dragging .tm-drag{cursor:grabbing}
      /* 贴边收起后的窄条 */
      .tm-edge{position:fixed;z-index:50;width:34px;max-height:46vh;overflow:hidden;padding:12px 7px;font:inherit;font-size:12px;line-height:1.15;letter-spacing:1px;writing-mode:vertical-rl;text-orientation:mixed;cursor:pointer;pointer-events:auto;color:var(--dsw-alias-label-primary,#0f1115);background:var(--dsw-alias-bg-layer-1,#fff);border:1px solid var(--dsw-alias-border-l2,#dcdcdc);box-shadow:0 8px 24px rgba(0,0,0,.2);transition:transform .16s ease,box-shadow .16s ease}
      .tm-edge.is-left{left:0;border-left:0;border-radius:0 14px 14px 0}
      .tm-edge.is-right{right:0;left:auto;border-right:0;border-radius:14px 0 0 14px}
      .tm-edge:hover{transform:translateX(0) scale(1.03);box-shadow:0 10px 28px rgba(0,0,0,.26);background:var(--dsw-alias-interactive-bg-hover,#f2f2f2)}
      .tm-card-top{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--dsw-alias-label-tertiary,#8a8a8a)}
      .tm-card-dish{font-size:15px;font-weight:650;letter-spacing:.2px}
      .tm-dish-row{display:flex;align-items:center;gap:9px;min-width:0}
      .tm-dish-text{min-width:0;overflow:hidden;text-overflow:ellipsis}
      .tm-card-actions{display:flex;gap:6px;flex-wrap:wrap}
      .tm-recipe{font-size:12px;color:var(--dsw-alias-label-secondary,#b4b4b4);border-top:1px dashed var(--dsw-alias-border-l2,#3a3a3a);padding-top:6px;white-space:pre-wrap}
    `;

    function Styles() {
      return h('style', { dangerouslySetInnerHTML: { __html: css } });
    }

    function Btn({ children, onClick, primary, danger, small, disabled, title }) {
      return h(
        'button',
        {
          type: 'button',
          className: `tm-btn${primary ? ' is-primary' : ''}${danger ? ' is-danger' : ''}${small ? ' is-sm' : ''}`,
          onClick,
          disabled,
          title,
        },
        children,
      );
    }

    function Switch({ checked, onChange, label }) {
      return h(
        'label',
        { className: 'tm-switch', title: label, role: 'switch', 'aria-checked': checked ? 'true' : 'false', 'aria-label': label },
        h('input', {
          type: 'checkbox',
          checked: !!checked,
          onChange: (e) => onChange(e.target.checked),
          'aria-label': label,
        }),
        h('span', { className: 'tm-track' }),
        h('span', { className: 'tm-knob' }),
      );
    }

    function Seg({ value, options, onChange }) {
      return h(
        'div',
        { className: 'tm-seg' },
        options.map((o) =>
          h(
            'button',
            {
              key: o.value,
              type: 'button',
              className: value === o.value ? 'is-on' : '',
              onClick: () => onChange(o.value),
            },
            o.label,
          ),
        ),
      );
    }

    function Field({ label, children }) {
      return h('label', { className: 'tm-field' }, h('span', { className: 'tm-label' }, label), children);
    }

    const MEALS = ['B', 'L', 'D'];
    const SCENES = ['家常', '外卖', '减脂', '放纵', '快手'];

    const WEEK = [
      [1, '一'],
      [2, '二'],
      [3, '三'],
      [4, '四'],
      [5, '五'],
      [6, '六'],
      [7, '日'],
    ];

    function mealLabel(m) {
      return T(`meal.${m}`);
    }

    function fmtTime(ts) {
      if (!ts) return '';
      const d = new Date(ts);
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }

    // ── 今天 ─────────────────────────────────────────────
    function TodayTab({ data }) {
      const [busy, setBusy] = React.useState(false);
      const card = data.card && !data.card.hidden ? data.card : null;
      const today = new Date().toDateString();
      const todays = (data.history || []).filter((r) => new Date(r.at).toDateString() === today);
      const reroll = async () => {
        setBusy(true);
        try {
          await store.call('/reroll', {});
        } catch (err) {
          store.error = err.message;
          store.emit();
        } finally {
          setBusy(false);
        }
      };
      return h(
        'div',
        null,
        (data.warnings || []).map((w) => h('div', { className: 'tm-warn', key: w }, w)),
        h(
          'div',
          { className: 'tm-block' },
          h('div', { className: 'tm-row tm-between' },
            h('span', { className: 'tm-label' }, T('card.today')),
            h(Btn, { small: true, onClick: reroll, disabled: busy || !card }, T('card.reroll')),
          ),
          card
            ? h(
                'div',
                { style: { marginTop: 6 } },
                h(
                  'div',
                  { className: 'tm-dish-row', style: { marginTop: 6 } },
                  h('div', { className: 'tm-dish-text' }, h('div', { className: 'tm-card-dish' }, card.items.map((i) => i.name).join(' / '))),
                ),
                h(
                  'div',
                  { className: 'tm-wrap', style: { marginTop: 6 } },
                  h('span', { className: 'tm-chip' }, mealLabel(card.meal)),
                  card.catchUp ? h('span', { className: 'tm-chip is-warn' }, T('card.catchup')) : null,
                  card.relaxed ? h('span', { className: 'tm-chip is-warn' }, T('card.relaxed')) : null,
                  card.repeatToday ? h('span', { className: 'tm-chip is-warn' }, T('card.repeat')) : null,
                  card.items.flatMap((i) =>
                    (i.tags || [])
                      .filter((t) => !SCENES.includes(t))
                      .slice(0, 3)
                      .map((tag) => h('span', { className: 'tm-chip', key: `${i.id}-${tag}` }, tag)),
                  ),
                ),
                h('div', { className: 'tm-meta', style: { marginTop: 6 } }, `${card.slotLabel && card.slotLabel !== mealLabel(card.meal) ? card.slotLabel + ' · ' : ''}${fmtTime(card.at)}`),
                card.mode === 'guide' && card.items.some((i) => i.resolvedUrl)
                  ? h(
                      'div',
                      { className: 'tm-card-actions' },
                      h(
                        'a',
                        {
                          className: 'tm-btn is-sm is-primary',
                          href: card.items.find((i) => i.resolvedUrl).resolvedUrl,
                          target: '_blank',
                          rel: 'noreferrer noopener',
                        },
                        T('card.guide'),
                      ),
                    )
                  : null,
              )
            : h('div', { className: 'tm-empty' }, T('card.none')),
        ),
        h(
          'div',
          { className: 'tm-block' },
          h('div', { className: 'tm-label', style: { marginBottom: 6 } }, `共 ${data.counts.total} 条，启用 ${data.counts.active} 条`),
          todays.length === 0
            ? h('div', { className: 'tm-empty' }, T('common.empty'))
            : h(
                'div',
                { className: 'tm-list' },
                todays.map((r) =>
                  h(
                    'div',
                    { className: 'tm-item', key: r.id },
                    h('div', { className: 'tm-name' }, r.names.join(' / ')),
                    h(
                      'div',
                      { className: 'tm-meta' },
                      `${mealLabel(r.meal)} · ${fmtTime(r.at)}${r.late ? ' · 补发' : ''}${r.deferred ? ' · 静默顺延' : ''}${r.relaxed ? ' · 放宽' : ''}`,
                    ),
                  ),
                ),
              ),
        ),
      );
    }

    // ── 菜库 ─────────────────────────────────────────────
    function ItemForm({ item, onDone }) {
      const [draft, setDraft] = React.useState(() => ({
        name: item?.name || '',
        meal: item?.meal || ['L', 'D'],
        tags: (item?.tags || []).join(' '),
        scene: item?.scene || ['家常'],
        recipe: item?.recipe || '',
        url: item?.guideUrl || '',
        weight: item?.weight || 1,
      }));
      const [err, setErr] = React.useState('');
      const [busy, setBusy] = React.useState(false);
      const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));
      const toggleMeal = (m) =>
        setDraft((d) => {
          const has = d.meal.includes(m);
          const next = has ? d.meal.filter((x) => x !== m) : [...d.meal, m];
          return { ...d, meal: next.length ? next : d.meal };
        });
      const toggleScene = (sc) =>
        setDraft((d) => {
          const has = d.scene.includes(sc);
          const next = has ? d.scene.filter((x) => x !== sc) : [...d.scene, sc];
          return { ...d, scene: next.length ? next : d.scene };
        });
      const save = async () => {
        setBusy(true);
        setErr('');
        try {
          const payload = {
            name: draft.name,
            meal: draft.meal,
            scene: draft.scene,
            tags: draft.tags.split(/[\s,，、]+/).filter(Boolean),
            recipe: draft.recipe,
            guide: { url: draft.url },
            weight: Number(draft.weight) || 1,
          };
          if (item?.id) await store.call('/item/update', { id: item.id, patch: payload });
          else await store.call('/item/add', { item: payload });
          onDone?.();
        } catch (e) {
          setErr(e.message);
        } finally {
          setBusy(false);
        }
      };
      return h(
        'div',
        { className: 'tm-block' },
        h(Field, { label: T('library.name') }, h('input', { className: 'tm-input', value: draft.name, onChange: (e) => set('name', e.target.value) })),
        h(
          'div',
          { className: 'tm-field' },
          h('span', { className: 'tm-label' }, T('library.meal')),
          h(
            'div',
            { className: 'tm-wrap' },
            MEALS.map((m) =>
              h(
                Btn,
                { key: m, small: true, primary: draft.meal.includes(m), onClick: () => toggleMeal(m) },
                mealLabel(m),
              ),
            ),
          ),
        ),
        h(Field, { label: T('library.tags') }, h('input', { className: 'tm-input', value: draft.tags, onChange: (e) => set('tags', e.target.value) })),
        h(
          'div',
          { className: 'tm-field' },
          h('span', { className: 'tm-label' }, T('library.scene')),
          h(
            'div',
            { className: 'tm-wrap' },
            SCENES.map((sc) => h(Btn, { key: sc, small: true, primary: draft.scene.includes(sc), onClick: () => toggleScene(sc) }, sc)),
          ),
        ),
        h(Field, { label: T('library.recipe') }, h('textarea', { className: 'tm-area', value: draft.recipe, onChange: (e) => set('recipe', e.target.value) })),
        h(Field, { label: T('library.url') }, h('input', { className: 'tm-input', value: draft.url, onChange: (e) => set('url', e.target.value) })),
        h(
          Field,
          { label: T('library.weight') },
          h('input', {
            className: 'tm-input',
            type: 'number',
            min: '0.2',
            max: '5',
            step: '0.1',
            value: draft.weight,
            onChange: (e) => {
              const v = Number(e.target.value);
              set('weight', Number.isFinite(v) ? Math.min(5, Math.max(0.2, v)) : 1);
            },
          }),
        ),
        h('div', { className: 'tm-meta', style: { marginTop: -4 } }, T('library.weightHint')),
        err ? h('div', { className: 'tm-err' }, err) : null,
        h(
          'div',
          { className: 'tm-actions' },
          h(Btn, { primary: true, onClick: save, disabled: busy }, T('common.save')),
          h(Btn, { onClick: () => onDone?.() }, T('common.cancel')),
        ),
      );
    }

    function LibraryTab({ data }) {
      const [q, setQ] = React.useState('');
      const [status, setStatus] = React.useState('all');
      const [meal, setMeal] = React.useState('all');
      const [scene, setScene] = React.useState('all');
      const [tagSel, setTagSel] = React.useState([]);
      const [editing, setEditing] = React.useState(null); // id | 'new' | null
      const [err, setErr] = React.useState('');
      const [msg, setMsg] = React.useState('');

      const tagCounts = React.useMemo(() => {
        const m = new Map();
        for (const item of data.library || []) {
          for (const t of item.tags || []) {
            // 场景词有自己的筛选行，别再混进标签统计里
            if (!SCENES.includes(t)) m.set(t, (m.get(t) || 0) + 1);
          }
        }
        return [...m.entries()].sort((a, b) => b[1] - a[1]);
      }, [data.library]);

      const items = (data.library || []).filter((i) => {
        if (status === 'active' && i.disabled) return false;
        if (status === 'off' && !i.disabled) return false;
        if (meal !== 'all' && !(i.meal || []).includes(meal)) return false;
        if (scene !== 'all' && !(i.scene || []).includes(scene)) return false;
        if (tagSel.length > 0 && !tagSel.every((t) => (i.tags || []).includes(t))) return false;
        const needle = q.trim().toLowerCase();
        if (!needle) return true;
        return i.name.toLowerCase().includes(needle) || (i.tags || []).some((t) => t.toLowerCase().includes(needle));
      });
      const toggleTag = (t) => setTagSel((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));
      const anyFilter = status !== 'all' || meal !== 'all' || scene !== 'all' || tagSel.length > 0 || Boolean(q.trim());
      const clearFilters = () => {
        setStatus('all');
        setMeal('all');
        setScene('all');
        setTagSel([]);
        setQ('');
      };
      const act = async (fn) => {
        setErr('');
        try {
          await fn();
        } catch (e) {
          setErr(e.message);
        }
      };
      const bulkEnable = async (disabled) => {
        if (disabled && !window.confirm(T('library.disableAllConfirm', { n: items.length }))) return;
        setErr('');
        try {
          const res = await store.call('/items/bulk', { ids: items.map((i) => i.id), disabled });
          setMsg(T('library.bulkDone', { n: res.changed }));
          setTimeout(() => setMsg(''), 2500);
        } catch (e) {
          setErr(e.message);
        }
      };
      return h(
        'div',
        null,
        h('input', { className: 'tm-input', placeholder: T('common.search'), value: q, onChange: (e) => setQ(e.target.value) }),
        h(
          'div',
          { className: 'tm-row tm-between', style: { marginTop: 8 } },
          h(Seg, {
            value: status,
            options: [
              { value: 'all', label: T('common.all') },
              { value: 'active', label: T('common.active') },
              { value: 'off', label: T('common.disabled') },
            ],
            onChange: setStatus,
          }),
          h(Btn, { primary: true, small: true, onClick: () => setEditing('new') }, `+ ${T('library.add')}`),
        ),
        h(
          'div',
          { className: 'tm-row', style: { marginTop: 6 } },
          h(Seg, {
            value: meal,
            options: [
              { value: 'all', label: T('library.allMeals') },
              { value: 'B', label: T('meal.B') },
              { value: 'L', label: T('meal.L') },
              { value: 'D', label: T('meal.D') },
            ],
            onChange: setMeal,
          }),
        ),
        h(
          'div',
          { className: 'tm-row', style: { marginTop: 6 } },
          h(Seg, {
            value: scene,
            options: [{ value: 'all', label: T('scene.all') }, ...SCENES.map((s) => ({ value: s, label: s }))],
            onChange: setScene,
          }),
        ),
        tagCounts.length
          ? h(
              'div',
              { className: 'tm-wrap', style: { marginTop: 6, maxHeight: 74, overflowY: 'auto' } },
              tagCounts.slice(0, 18).map(([t, n]) =>
                h(
                  'button',
                  {
                    key: t,
                    type: 'button',
                    className: `tm-chip tm-chip-btn${tagSel.includes(t) ? ' is-on' : ''}`,
                    title: `${n} ${T('library.entries')}`,
                    onClick: () => toggleTag(t),
                  },
                  `${t}${n > 1 ? ` ${n}` : ''}`,
                ),
              ),
              anyFilter ? h(Btn, { small: true, onClick: clearFilters }, T('common.clearFilters')) : null,
            )
          : null,
        h(
          'div',
          { className: 'tm-row tm-between', style: { margin: '6px 0' } },
          h(
            'span',
            { className: 'tm-meta' },
            `${T('library.count', { n: data.counts.total, a: data.counts.active })} · ${T('library.shown', { n: items.length })}`,
          ),
          items.length > 0
            ? h(
                'div',
                { className: 'tm-actions', style: { margin: 0 } },
                h(Btn, { small: true, onClick: () => bulkEnable(false) }, T('library.enableAll')),
                h(Btn, { small: true, danger: true, onClick: () => bulkEnable(true) }, T('library.disableAll')),
              )
            : null,
        ),
        err ? h('div', { className: 'tm-err' }, err) : null,
        msg ? h('div', { className: 'tm-ok' }, msg) : null,
        editing === 'new'
          ? h(ItemForm, { onDone: () => setEditing(null) })
          : null,
        h(
          'div',
          { className: 'tm-list', style: { marginTop: 8 } },
          items.length === 0
            ? h('div', { className: 'tm-empty' }, T('common.empty'))
            : items.map((item) =>
                editing === item.id
                  ? h(ItemForm, { key: item.id, item, onDone: () => setEditing(null) })
                  : h(
                      'div',
                      { className: `tm-item${item.disabled ? ' is-off' : ''}`, key: item.id },
                      h(
                        'div',
                        { className: 'tm-row tm-between' },
                        h(
                          'div',
                          { className: 'tm-dish-row' },
                          h('span', { className: 'tm-name' }, item.name),
                        ),
                        h(Switch, {
                          checked: !item.disabled,
                          label: item.disabled ? T('common.disabled') : T('common.active'),
                          onChange: () => act(() => store.call('/item/toggle', { id: item.id })),
                        }),
                      ),
                      h(
                        'div',
                        { className: 'tm-wrap', style: { marginTop: 4 } },
                        ...(item.meal || []).map((m) => h('span', { className: 'tm-chip', key: m }, mealLabel(m))),
                        ...(item.scene || []).map((sc) => h('span', { className: 'tm-chip', key: `sc-${sc}` }, sc)),
                        ...(item.tags || [])
                          .filter((t) => !SCENES.includes(t))
                          .map((t) => h('span', { className: `tm-chip${(data.settings.likeTags || []).includes(t) ? ' is-like' : ''}`, key: t }, t)),
                      ),
                      h(
                        'div',
                        { className: 'tm-actions' },
                        h(Btn, { small: true, onClick: () => setEditing(item.id) }, T('common.edit')),
                        h(
                          Btn,
                          { small: true, danger: true, onClick: () => act(() => store.call('/item/delete', { id: item.id })) },
                          T('common.delete'),
                        ),
                      ),
                    ),
              ),
        ),
      );
    }

    // ── 时间表 ───────────────────────────────────────────
    function SlotForm({ slot, onDone }) {
      const [draft, setDraft] = React.useState(() => ({
        id: slot?.id,
        label: slot?.label || '',
        time: slot?.time || '12:00',
        meal: slot?.meal || 'L',
        days: slot?.days || [1, 2, 3, 4, 5, 6, 7],
        mode: slot?.mode || null,
        count: slot?.count ?? null,
        enabled: slot?.enabled !== false,
      }));
      const [busy, setBusy] = React.useState(false);
      const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));
      const toggleDay = (d) =>
        setDraft((s) => ({ ...s, days: s.days.includes(d) ? s.days.filter((x) => x !== d) : [...s.days, d].sort() }));
      const save = async () => {
        setBusy(true);
        try {
          await store.call('/schedule/save', { slot: draft });
          onDone?.();
        } catch (e) {
          store.error = e.message;
          store.emit();
        } finally {
          setBusy(false);
        }
      };
      return h(
        'div',
        { className: 'tm-block' },
        h(Field, { label: T('schedule.label') }, h('input', { className: 'tm-input', value: draft.label, onChange: (e) => set('label', e.target.value) })),
        h(
          'div',
          { className: 'tm-grid2' },
          h(Field, { label: T('schedule.time') }, h('input', { className: 'tm-input', type: 'time', value: draft.time, onChange: (e) => set('time', e.target.value) })),
          h(
            Field,
            { label: T('schedule.meal') },
            h(
              'select',
              { className: 'tm-select', value: draft.meal, onChange: (e) => set('meal', e.target.value) },
              MEALS.map((m) => h('option', { key: m, value: m }, mealLabel(m))),
            ),
          ),
        ),
        h(
          'div',
          { className: 'tm-field' },
          h('span', { className: 'tm-label' }, T('schedule.days')),
          h(
            'div',
            { className: 'tm-wrap' },
            WEEK.map(([d, label]) => h(Btn, { key: d, small: true, primary: draft.days.includes(d), onClick: () => toggleDay(d) }, label)),
          ),
        ),
        h(
          'div',
          { className: 'tm-field' },
          h('span', { className: 'tm-label' }, T('schedule.mode')),
          h(Seg, {
            value: draft.mode || 'global',
            options: [
              { value: 'global', label: T('schedule.mode.global') },
              { value: 'name', label: T('schedule.mode.name') },
              { value: 'guide', label: T('schedule.mode.guide') },
            ],
            onChange: (v) => set('mode', v === 'global' ? null : v),
          }),
        ),
        h(
          'div',
          { className: 'tm-field' },
          h('span', { className: 'tm-label' }, T('schedule.count')),
          h(Seg, {
            value: draft.count ?? 'global',
            options: [
              { value: 'global', label: T('schedule.count.global') },
              { value: 1, label: '1' },
              { value: 3, label: '3' },
            ],
            onChange: (v) => set('count', v === 'global' ? null : v),
          }),
        ),
        h(
          'div',
          { className: 'tm-row tm-between', style: { marginTop: 10 } },
          h('span', { className: 'tm-label' }, T('common.active')),
          h(Switch, { checked: draft.enabled, onChange: (v) => set('enabled', v) }),
        ),
        h(
          'div',
          { className: 'tm-actions' },
          h(Btn, { primary: true, onClick: save, disabled: busy }, T('common.save')),
          h(Btn, { onClick: () => onDone?.() }, T('common.cancel')),
        ),
      );
    }

    function ScheduleTab({ data }) {
      const [editing, setEditing] = React.useState(null);
      return h(
        'div',
        null,
        h(Btn, { primary: true, small: true, onClick: () => setEditing('new') }, `+ ${T('schedule.add')}`),
        editing === 'new' ? h(SlotForm, { onDone: () => setEditing(null) }) : null,
        h(
          'div',
          { className: 'tm-list', style: { marginTop: 8 } },
          (data.schedule || []).map((s) =>
            editing === s.id
              ? h(SlotForm, { key: s.id, slot: s, onDone: () => setEditing(null) })
              : h(
                  'div',
                  { className: `tm-item${s.enabled ? '' : ' is-off'}`, key: s.id },
                  h(
                    'div',
                    { className: 'tm-row tm-between' },
                    h('span', { className: 'tm-name' }, `${s.time} ${s.label || mealLabel(s.meal)}`),
                    h(Switch, {
                      checked: s.enabled,
                      onChange: async () => {
                        try {
                          await store.call('/schedule/save', { slot: { ...s, enabled: !s.enabled } });
                        } catch (e) {
                          store.error = e.message;
                          store.emit();
                        }
                      },
                    }),
                  ),
                  h(
                    'div',
                    { className: 'tm-meta' },
                    `${mealLabel(s.meal)} · ${s.days.map((d) => WEEK.find(([x]) => x === d)?.[1]).join('')} · ${
                      s.mode ? T(`schedule.mode.${s.mode}`) : T('schedule.mode.global')
                    }${s.count ? ` · ${s.count} 条` : ''} · ${T(`schedule.state.${s.todayState}`) || s.todayState}`,
                  ),
                  h(
                    'div',
                    { className: 'tm-actions' },
                    h(Btn, { small: true, onClick: () => setEditing(s.id) }, T('common.edit')),
                    h(
                      Btn,
                      {
                        small: true,
                        danger: true,
                        onClick: async () => {
                          try {
                            await store.call('/schedule/delete', { id: s.id });
                          } catch (e) {
                            store.error = e.message;
                            store.emit();
                          }
                        },
                      },
                      T('common.delete'),
                    ),
                  ),
                ),
          ),
        ),
      );
    }

    // ── 设置 ─────────────────────────────────────────────
    function SettingsTab({ data }) {
      const [draft, setDraft] = React.useState(() => JSON.parse(JSON.stringify(data.settings)));
      const [dirty, setDirty] = React.useState(false);
      const [msg, setMsg] = React.useState('');
      const [err, setErr] = React.useState('');
      const [importText, setImportText] = React.useState('');
      const [importFormat, setImportFormat] = React.useState('lines');
      const [preview, setPreview] = React.useState(null);
      const dirtyRef = React.useRef(false);
      const syncedRef = React.useRef(JSON.stringify(data.settings));
      React.useEffect(() => {
        const incoming = JSON.stringify(data.settings);
        // 轮询每 12 秒刷新一次 state：只有用户没有未保存改动时才覆盖草稿。
        if (dirtyRef.current || incoming === syncedRef.current) return;
        syncedRef.current = incoming;
        setDraft(JSON.parse(incoming));
      }, [data.settings]);
      const set = (k, v) => {
        setDraft((d) => ({ ...d, [k]: v }));
        dirtyRef.current = true;
        setDirty(true);
      };
      const setQuiet = (k, v) => {
        setDraft((d) => ({ ...d, quiet: { ...d.quiet, [k]: v } }));
        dirtyRef.current = true;
        setDirty(true);
      };
      const saveSettings = async () => {
        setErr('');
        try {
          await store.call('/settings', { patch: draft });
          setMsg('已保存');
          dirtyRef.current = false;
          setDirty(false);
          setTimeout(() => setMsg(''), 1500);
        } catch (e) {
          setErr(e.message);
        }
      };
      const doPreview = async () => {
        setErr('');
        setPreview(null);
        try {
          const res = await store.call('/import/preview', { text: importText, format: importFormat });
          setPreview(res.preview);
        } catch (e) {
          setErr(e.message);
        }
      };
      const doCommit = async () => {
        if (!preview) return;
        setErr('');
        try {
          const res = await store.call('/import/commit', { token: preview.token });
          setPreview(null);
          setImportText('');
          setMsg(`已导入 ${res.addedCount} 条，下次抽取就会包含它们；想现在试一次可以回「今天」点换一道`);
          setTimeout(() => setMsg(''), 2500);
        } catch (e) {
          setErr(e.message);
        }
      };
      const doUndo = async () => {
        setErr('');
        try {
          const res = await store.call('/import/undo', {});
          setMsg(`已撤销（${res.undone}）`);
          setTimeout(() => setMsg(''), 2500);
        } catch (e) {
          setErr(e.message);
        }
      };
      const syncBuiltins = async () => {
        setErr('');
        try {
          const res = await store.call('/builtins/sync', {});
          setMsg(res.added > 0 ? `补充了 ${res.added} 条内置菜` : '内置菜已经是最新的');
          setTimeout(() => setMsg(''), 2500);
        } catch (e) {
          setErr(e.message);
        }
      };
      const clearHistory = async () => {
        if (!window.confirm(T('settings.clear.confirm'))) return;
        try {
          await store.call('/history/clear', {});
        } catch (e) {
          setErr(e.message);
        }
      };
      const resetAll = async () => {
        if (!window.confirm(T('settings.reset.confirm'))) return;
        try {
          const res = await store.call('/reset', {});
          setMsg(`已重置：${res.total} 条内置`);
          setTimeout(() => setMsg(''), 2500);
        } catch (e) {
          setErr(e.message);
        }
      };
      // 用 Blob 下载：Electron 里直接点 <a href> 会把窗口导航走，而不是下载。
      const downloadExport = async (format) => {
        setErr('');
        try {
          const res = await fetch(`${API}/export?format=${format}`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const text = await res.text();
          const blob = new Blob([text], {
            type: format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json;charset=utf-8',
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          const stamp = new Date().toISOString().slice(0, 10);
          a.href = url;
          a.download = `today-menu-${stamp}.${format}`;
          a.style.display = 'none';
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 5000);
        } catch (e) {
          setErr(e.message);
        }
      };
      return h(
        'div',
        null,
        h(
          'div',
          { className: 'tm-block' },
          h('div', { className: 'tm-label' }, T('settings.mode')),
          h(
            'div',
            { style: { marginTop: 6 } },
            h(Seg, {
              value: draft.defaultMode,
              options: [
                { value: 'name', label: T('settings.mode.name') },
                { value: 'guide', label: T('settings.mode.guide') },
              ],
              onChange: (v) => set('defaultMode', v),
            }),
          ),
          h(
            'div',
            { className: 'tm-field' },
            h('span', { className: 'tm-label' }, T('settings.scene')),
            h(Seg, {
              value: draft.scene || 'all',
              options: [{ value: 'all', label: T('scene.all') }, ...SCENES.map((s) => ({ value: s, label: s }))],
              onChange: (v) => set('scene', v),
            }),
            h('div', { className: 'tm-meta', style: { marginTop: 4 } }, T('settings.sceneHint')),
          ),
          h(
            'div',
            { className: 'tm-grid2', style: { marginTop: 8 } },
            h(
              Field,
              { label: T('settings.candidates') },
              h(
                'select',
                { className: 'tm-select', value: draft.candidates, onChange: (e) => set('candidates', Number(e.target.value)) },
                h('option', { value: 1 }, '1'),
                h('option', { value: 3 }, '3'),
              ),
            ),
            h(
              Field,
              { label: T('settings.retention') },
              h('input', {
                className: 'tm-input',
                type: 'number',
                min: '0',
                max: '60',
                value: draft.retentionDays,
                onChange: (e) => set('retentionDays', Number(e.target.value)),
              }),
            ),
            h(
              Field,
              { label: T('settings.catchup') },
              h('input', {
                className: 'tm-input',
                type: 'number',
                min: '0',
                max: '180',
                value: draft.catchUpMinutes,
                onChange: (e) => set('catchUpMinutes', Number(e.target.value)),
              }),
            ),
            h(
              Field,
              { label: T('settings.boost') },
              h('input', {
                className: 'tm-input',
                type: 'number',
                min: '1',
                max: '5',
                step: '0.1',
                value: draft.likeBoost,
                onChange: (e) => set('likeBoost', Number(e.target.value)),
              }),
            ),
          ),
          h(
            'div',
            { className: 'tm-row tm-between', style: { marginTop: 12 } },
            h('span', { className: 'tm-label' }, T('settings.quiet')),
            h(Switch, { checked: draft.quiet?.enabled, onChange: (v) => setQuiet('enabled', v) }),
          ),
          draft.quiet?.enabled
            ? h(
                'div',
                { className: 'tm-grid2', style: { marginTop: 6 } },
                h(Field, { label: T('settings.quiet.from') }, h('input', { className: 'tm-input', type: 'time', value: draft.quiet.from, onChange: (e) => setQuiet('from', e.target.value) })),
                h(Field, { label: T('settings.quiet.to') }, h('input', { className: 'tm-input', type: 'time', value: draft.quiet.to, onChange: (e) => setQuiet('to', e.target.value) })),
              )
            : null,
          h(Field, { label: T('settings.like') }, h('input', { className: 'tm-input', value: (draft.likeTags || []).join(' '), onChange: (e) => set('likeTags', e.target.value.split(/[\s,，、]+/).filter(Boolean)) })),
          h(Field, { label: T('settings.dislike') }, h('input', { className: 'tm-input', value: (draft.dislikeTags || []).join(' '), onChange: (e) => set('dislikeTags', e.target.value.split(/[\s,，、]+/).filter(Boolean)) })),
          h(Field, { label: T('settings.platform') },
            h(
              'select',
              {
                className: 'tm-select',
                value: draft.platform || 'xiachufang',
                onChange: (e) => {
                  const next = e.target.value;
                  set('platform', next);
                  if (next === 'xiachufang') set('platformTemplate', 'https://www.xiachufang.com/search/?keyword={q}');
                },
              },
              h('option', { value: 'xiachufang' }, '下厨房（搜索结果页）'),
              h('option', { value: 'custom' }, '自定义模板'),
            ),
          ),
          h(Field, { label: '搜索模板' }, h('input', { className: 'tm-input', value: draft.platformTemplate, onChange: (e) => { set('platformTemplate', e.target.value); set('platform', 'custom'); } })),
          h('div', { className: 'tm-meta', style: { marginTop: 4 } }, T('settings.platform.hint')),
          dirty ? h('div', { className: 'tm-meta' }, T('settings.unsaved')) : null,
          msg ? h('div', { className: 'tm-ok' }, msg) : null,
          err ? h('div', { className: 'tm-err' }, err) : null,
          h('div', { className: 'tm-actions' }, h(Btn, { primary: true, onClick: saveSettings }, T('common.save'))),
        ),
        h(
          'div',
          { className: 'tm-block' },
          h('div', { className: 'tm-label' }, T('settings.import.title')),
          h('div', { className: 'tm-meta', style: { margin: '4px 0 6px' } }, T('settings.import.hint')),
          h(Field, { label: '格式' },
            h('select', { className: 'tm-select', value: importFormat, onChange: (e) => setImportFormat(e.target.value) },
              h('option', { value: 'lines' }, '一行一个菜名'),
              h('option', { value: 'json' }, 'JSON'),
              h('option', { value: 'csv' }, 'CSV'),
            ),
          ),
          h('textarea', { className: 'tm-area', value: importText, onChange: (e) => setImportText(e.target.value) }),
          h(
            'div',
            { className: 'tm-actions' },
            h(Btn, { onClick: doPreview, disabled: !importText.trim() }, T('settings.import.preview')),
            preview ? h(Btn, { primary: true, onClick: doCommit }, T('settings.import.commit')) : null,
            h(Btn, { onClick: doUndo }, T('settings.import.undo')),
            h(Btn, { onClick: syncBuiltins }, T('settings.syncBuiltins')),
          ),
          preview
            ? h(
                'div',
                { style: { marginTop: 8 } },
                h('div', { className: 'tm-ok' }, T('settings.import.added', { n: preview.addCount })),
                preview.dupeCount ? h('div', { className: 'tm-meta' }, T('settings.import.dupe', { n: preview.dupeCount })) : null,
                preview.conflicts?.length ? h('div', { className: 'tm-warn' }, T('settings.import.conflict', { n: preview.conflicts.length })) : null,
                preview.sample?.length
                  ? h('div', { className: 'tm-wrap', style: { marginTop: 6 } }, preview.sample.map((s, i) => h('span', { className: 'tm-chip', key: i }, s.name)))
                  : null,
                preview.errors?.length ? h('div', { className: 'tm-warn' }, preview.errors.join('；')) : null,
              )
            : null,
        ),
        h(
          'div',
          { className: 'tm-block' },
          h('div', { className: 'tm-label' }, '导出 / 清理'),
          h(
            'div',
            { className: 'tm-actions' },
            h(Btn, { small: true, onClick: () => downloadExport('json') }, T('settings.export.json')),
            h(Btn, { small: true, onClick: () => downloadExport('csv') }, T('settings.export.csv')),
            h(Btn, { small: true, danger: true, onClick: clearHistory }, T('settings.clear')),
            h(Btn, { small: true, danger: true, onClick: resetAll }, T('settings.reset')),
          ),
          h('div', { className: 'tm-meta', style: { marginTop: 6 } }, T('settings.data')),
        ),
      );
    }

    // ── 面板根 ───────────────────────────────────────────
    function Panel() {
      const s = useStore('panel');
      const [tab, setTab] = React.useState('today');
      // 面板正文真的挂载了才报一次：注册成功 ≠ 渲染出来。
      // 同时记下「见过面板」，之后就不必每次加载都强行 openTab。
      React.useEffect(() => {
        hello({ panelMounted: true });
        try {
          localStorage.setItem('what-to-eat.panelSeen', '1');
        } catch {
          /* ignore */
        }
      }, []);
      const data = s.data;
      const tabs = [
        ['today', T('tab.today')],
        ['library', T('tab.library')],
        ['schedule', T('tab.schedule')],
        ['settings', T('tab.settings')],
      ];
      return h(
        'div',
        { className: 'tm-root' },
        h(Styles),
        h(
          'div',
          { className: 'tm-head' },
          h(
            'div',
            null,
            h(
              'div',
              { className: 'tm-title', style: { display: 'flex', alignItems: 'center', gap: 6 } },
              T('panel.title'),
              h('span', {
                title: s.error
                  ? `未连接：${s.error}`
                  : data
                    ? `已连接 · 最近更新 ${new Date(data.now).toLocaleTimeString()}`
                    : '连接中…',
                style: {
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  display: 'inline-block',
                  background: s.error
                    ? 'var(--dsw-alias-state-error-primary,#ec1313)'
                    : data
                      ? 'var(--dsw-alias-state-success-primary,#22c55e)'
                      : 'var(--dsw-alias-label-tertiary,#81858c)',
                },
              }),
            ),
            h('div', { className: 'tm-sub' }, T('panel.guide')),
          ),
        ),
        h(
          'div',
          { className: 'tm-tabs' },
          tabs.map(([id, label]) =>
            h('button', { key: id, type: 'button', className: `tm-tab${tab === id ? ' is-on' : ''}`, onClick: () => setTab(id) }, label),
          ),
        ),
        h(
          'div',
          { className: 'tm-body' },
          s.error
            ? h(
                'div',
                { className: 'tm-warn', style: { display: 'flex', gap: 8, alignItems: 'center' } },
                h('span', { style: { flex: 1 } }, s.error),
                h('button', { type: 'button', className: 'tm-btn is-sm', onClick: () => s.clearError() }, '×'),
              )
            : null,
          !data
            ? h('div', { className: 'tm-empty' }, s.error || T('common.loading'))
            : tab === 'today'
              ? h(TodayTab, { data })
              : tab === 'library'
                ? h(LibraryTab, { data })
                : tab === 'schedule'
                  ? h(ScheduleTab, { data })
                  : h(SettingsTab, { data }),
        ),
      );
    }

    // ── 会话卡片（固定定位、可拖动、拖到左右边缘自动贴边收起）──────
    const CARD_LAYOUT_KEY = 'what-to-eat.card.layout';

    function loadCardLayout() {
      try {
        const raw = localStorage.getItem(CARD_LAYOUT_KEY);
        if (!raw) return null;
        const p = JSON.parse(raw);
        if (!p || typeof p.x !== 'number' || typeof p.y !== 'number') return null;
        return { x: p.x, y: p.y, placed: true, collapsed: p.collapsed === 'left' || p.collapsed === 'right' ? p.collapsed : null };
      } catch {
        return null;
      }
    }

    function saveCardLayout(layout) {
      try {
        localStorage.setItem(CARD_LAYOUT_KEY, JSON.stringify({ x: layout.x, y: layout.y, collapsed: layout.collapsed }));
      } catch {
        /* ignore */
      }
    }

    function clampToViewport(x, y, w, h) {
      const maxX = Math.max(8, window.innerWidth - w - 8);
      const maxY = Math.max(8, window.innerHeight - h - 8);
      return { x: Math.min(Math.max(8, x), maxX), y: Math.min(Math.max(8, y), maxY) };
    }

    function SessionCard() {
      const s = useStore('session');
      const data = s.data;
      const card = data?.card && !data.card.hidden ? data.card : null;
      const [dismissed, setDismissed] = React.useState(null);
      const [claimed, setClaimed] = React.useState(null);
      const [openRecipe, setOpenRecipe] = React.useState(false);
      const [layout, setLayout] = React.useState(() => loadCardLayout() || { x: 0, y: 0, placed: false, collapsed: null });
      const [dragging, setDragging] = React.useState(false);
      const [busy, setBusy] = React.useState(false);
      const cardRef = React.useRef(null);
      const dragRef = React.useRef(null);

      React.useEffect(() => {
        if (!card) return;
        // 浮层卡片真的画出来了才报一次（注册成功 ≠ 渲染出来）。
        hello({ cardMounted: true });
        let hide = null;
        try {
          hide = localStorage.getItem(`what-to-eat.dismissed.${card.id}`);
        } catch {
          /* ignore */
        }
        setDismissed(hide === '1');
        if (!card.claimed) {
          store.call('/claim', {}).then((res) => {
            if (res?.card) setClaimed(res.card);
          }).catch(() => {});
        }
      }, [card?.id]);

      // 第一次出现：量出实际尺寸后放到右下角（ref 还没挂上时用 rAF 重试）
      React.useEffect(() => {
        if (layout.placed) return;
        let raf = 0;
        const place = () => {
          const el = cardRef.current;
          if (!el) {
            raf = requestAnimationFrame(place);
            return;
          }
          const rect = el.getBoundingClientRect();
          if (!rect.width) {
            raf = requestAnimationFrame(place);
            return;
          }
          const next = {
            ...clampToViewport(window.innerWidth - rect.width - 20, window.innerHeight - rect.height - 104, rect.width, rect.height),
            placed: true,
            collapsed: null,
          };
          setLayout(next);
          saveCardLayout(next);
        };
        raf = requestAnimationFrame(place);
        return () => cancelAnimationFrame(raf);
      }, [layout.placed]);

      // 窗口变化时收回可视区域
      React.useEffect(() => {
        const onResize = () => {
          setLayout((cur) => {
            if (!cur.placed || !cardRef.current) return cur;
            const rect = cardRef.current.getBoundingClientRect();
            const next = { ...cur, ...clampToViewport(cur.x, cur.y, rect.width, rect.height) };
            saveCardLayout(next);
            return next;
          });
        };
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
      }, []);

      // 拖动：按下只记录起点；移动/松开挂在 window 上，指针划出卡片也不会丢事件。
      // 按下后没有真正移动（单击）不会触发贴边——之前「点一下就跑到左上角」就是这里的问题。
      React.useEffect(() => {
        if (!dragging) return undefined;
        const move = (e) => {
          const d = dragRef.current;
          if (!d) return;
          if (Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) > 4) d.moved = true;
          const el = cardRef.current;
          if (!el) return;
          const rect = el.getBoundingClientRect();
          const pos = clampToViewport(e.clientX - d.dx, e.clientY - d.dy, rect.width, rect.height);
          setLayout((cur) => ({ ...cur, ...pos, placed: true }));
        };
        const end = () => {
          const d = dragRef.current;
          dragRef.current = null;
          setDragging(false);
          if (!d || !d.moved) return;
          const el = cardRef.current;
          if (!el) return;
          const rect = el.getBoundingClientRect();
          const nearLeft = rect.left <= 48;
          const nearRight = window.innerWidth - rect.right <= 48;
          const next = {
            x: rect.left,
            y: rect.top,
            placed: true,
            collapsed: nearLeft ? 'left' : nearRight ? 'right' : null,
          };
          setLayout(next);
          saveCardLayout(next);
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', end);
        window.addEventListener('pointercancel', end);
        return () => {
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', end);
          window.removeEventListener('pointercancel', end);
        };
      }, [dragging]);

      const onPointerDown = (e) => {
        if (e.button !== 0) return;
        if (e.target && e.target.closest && e.target.closest('button, a, input, textarea')) return;
        const el = cardRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        dragRef.current = {
          dx: e.clientX - rect.left,
          dy: e.clientY - rect.top,
          sx: e.clientX,
          sy: e.clientY,
          moved: false,
        };
        setDragging(true);
      };

      const expand = () => {
        const width = Math.min(360, window.innerWidth - 40);
        const x = layout.collapsed === 'left' ? 24 : window.innerWidth - width - 24;
        const next = { x, y: layout.y, placed: true, collapsed: null };
        setLayout(next);
        saveCardLayout(next);
      };

      const reroll = async () => {
        if (busy) return;
        setBusy(true);
        try {
          const res = await store.call('/reroll', {});
          if (res?.card) {
            setClaimed(res.card);
            setDismissed(false);
          }
        } catch {
          /* 面板里能看到具体原因 */
        } finally {
          setBusy(false);
        }
      };

      if (!card) return null;
      if (dismissed) return null;
      const view = claimed && claimed.id === card.id ? { ...card, ...claimed } : card;
      const guideUrl = view.items?.find((i) => i.resolvedUrl)?.resolvedUrl;
      const recipe = view.items?.map((i) => i.recipe).filter(Boolean).join('\n\n');
      const dismiss = () => {
        try {
          localStorage.setItem(`what-to-eat.dismissed.${view.id}`, '1');
        } catch {
          /* ignore */
        }
        setDismissed(true);
        store.call('/dismiss', {}).catch(() => {});
      };

      // 贴边收起：只留一条窄条，点它展开
      if (layout.collapsed) {
        const isLeft = layout.collapsed === 'left';
        const label = view.items?.[0]?.name || T('panel.title');
        return h(
          'button',
          {
            ref: cardRef,
            type: 'button',
            className: `tm-edge${isLeft ? ' is-left' : ' is-right'}`,
            style: { top: Math.max(8, Math.min(layout.y, window.innerHeight - 120)) },
            title: `${label} · ${T('card.expand')}`,
            onClick: expand,
          },
          h('span', null, label.length > 6 ? `${label.slice(0, 6)}…` : label),
        );
      }

      return h(
        'div',
        {
          className: `tm-float${dragging ? ' is-dragging' : ''}`,
          ref: cardRef,
          style: layout.placed ? { left: layout.x, top: layout.y, right: 'auto', bottom: 'auto' } : undefined,
        },
        h(Styles),
        h(
          'div',
          { className: 'tm-card' },
          h(
            'div',
            { className: 'tm-card-top tm-drag', onPointerDown },
            h('span', null, (() => {
              const meal = mealLabel(view.meal);
              const slot = view.slotLabel;
              return !slot || slot === meal ? meal : `${meal} · ${slot}`;
            })()),
            view.catchUp ? h('span', { className: 'tm-chip is-warn' }, T('card.catchup')) : null,
            view.relaxed ? h('span', { className: 'tm-chip is-warn' }, T('card.relaxed')) : null,
            h('span', { style: { flex: 1 } }),
            h(
              'button',
              {
                type: 'button',
                className: 'tm-btn is-sm',
                title: T('card.reroll'),
                onClick: reroll,
                disabled: busy,
                onPointerDown: (e) => e.stopPropagation(),
              },
              busy ? '…' : T('card.reroll'),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'tm-btn is-sm',
                title: T('card.openPanel'),
                onClick: () => {
                  try {
                    uiRefs.openPanel?.();
                  } catch {
                    /* ignore */
                  }
                },
                onPointerDown: (e) => e.stopPropagation(),
              },
              T('card.panelButton'),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'tm-btn is-sm',
                title: T('card.hideToEdge'),
                onClick: () => {
                  const el = cardRef.current;
                  const rect = el ? el.getBoundingClientRect() : { width: 360 };
                  const leftSide = rect.width && rect.left + rect.width / 2 < window.innerWidth / 2;
                  const next = { ...layout, placed: true, collapsed: leftSide ? 'left' : 'right' };
                  setLayout(next);
                  saveCardLayout(next);
                },
                onPointerDown: (e) => e.stopPropagation(),
              },
              '–',
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'tm-btn is-sm',
                title: T('common.close'),
                onClick: dismiss,
                onPointerDown: (e) => e.stopPropagation(),
              },
              '×',
            ),
          ),
          h(
            'div',
            { className: 'tm-dish-row', style: { marginTop: 2 } },
            h(
              'div',
              {
                className: 'tm-dish-text tm-card-dish',
                title: T('card.openPanel'),
                style: { cursor: 'pointer' },
                onClick: () => {
                  try {
                    uiRefs.openPanel?.();
                  } catch {
                    /* ignore */
                  }
                },
              },
              view.items.map((i) => i.name).join(' / '),
            ),
          ),
          h(
            'div',
            { className: 'tm-wrap' },
            view.items.flatMap((i) =>
              (i.tags || [])
                .filter((t) => !SCENES.includes(t))
                .slice(0, 3)
                .map((t) => h('span', { className: 'tm-chip', key: `${i.id}-${t}` }, t)),
            ),
          ),
          h(
            'div',
            { className: 'tm-card-actions' },
            recipe ? h(Btn, { small: true, onClick: () => setOpenRecipe((v) => !v) }, `${T('card.recipe')}${openRecipe ? ' ▾' : ' ▸'}`) : null,
            view.mode === 'guide' && guideUrl
              ? h(
                  'a',
                  { className: 'tm-btn is-sm is-primary', href: guideUrl, target: '_blank', rel: 'noreferrer noopener' },
                  T('card.guide'),
                )
              : null,
          ),
          openRecipe && recipe ? h('div', { className: 'tm-recipe' }, recipe) : null,
        ),
      );
    }

    // ── 会话在场信标：只用来告诉 Host「现在有会话打开」，不画任何东西 ──
    function SessionBeacon() {
      useStore('session');
      return h('span', { style: { display: 'none' } });
    }

    // ── 注册 ─────────────────────────────────────────────
    // 模块级的自检状态：面板挂载时也要能补报一次，所以不能只活在 apply 里。
    const helloState = { registered: { card: false, tabType: false, panel: false }, extra: {} };

    function hello(extra) {
      try {
        Object.assign(helloState.extra, extra || {});
        fetch(`${API}/hello?viewer=${encodeURIComponent(viewer)}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-dsh-what-to-eat': '1' },
          body: JSON.stringify({
            version: `0.1.1+${BUILD_TAG}`,
            slots: { ...helloState.registered, ...helloState.extra },
          }),
        }).catch(() => {});
      } catch {
        /* ignore */
      }
    }

    return {
      inject: ['slots', 'sidebarRight', 'sidebarRightTabs'],
      apply(ctx) {
        // 每块注册各自兜底：任一块失败（例如宿主没开这个槽）不应连带拖垮其它块。
        const registered = helloState.registered;
        // 关键：apply 返回后 ctx 可能已不在活动状态，延迟执行时必须用这里抓到的服务引用，
        // 否则会抛 "cannot get required service ... in inactive context"。
        const sidebarRight = ctx.sidebarRight;
        uiRefs.openPanel = () => sidebarRight.openTab(TAB_KIND);
        const guarded = (label, fn) => {
          try {
            const out = fn();
            return out;
          } catch (err) {
            console.error(`[today-menu] ${label} 注册失败`, err);
            return undefined;
          }
        };

        ctx.effect(() =>
          guarded('会话卡片', () => {
            // 挂在 shell 层：不管切不切会话都常驻（固定定位，不占布局）。
            const dispose = ctx.slots.register({ name: 'shell.overlay', id: 'today-menu-card', order: 20 }, SessionCard);
            registered.card = true;
            return dispose;
          }),
        );

        // 卡片是全局的，判断「有没有会话开着」得靠会话里的零尺寸信标。
        ctx.effect(() =>
          guarded('会话信标', () =>
            ctx.slots.inject('conversation.composer.dock', () =>
              ctx.slots.register({ name: 'conversation.composer.dock', id: 'today-menu-beacon', order: 999 }, SessionBeacon),
            ),
          ),
        );

        ctx.effect(() =>
          guarded('侧栏页类型', () => {
            const dispose = ctx.sidebarRightTabs.register({
              id: PANEL_ID,
              kind: TAB_KIND,
              priority: 40,
              title: () => T('panel.title'),
              guide: [{ id: `${TAB_KIND}-entry`, kind: TAB_KIND, title: T('panel.title'), description: T('panel.guide') }],
            });
            registered.tabType = true;
            return dispose;
          }),
        );

        // 关键：注册要经由 inject 等到 sidebar-right 声明出这个 keyed slot 之后再做，
        // 否则 apply 时机早于声明会直接抛 "slot is not declared"。
        ctx.effect(() =>
          guarded('面板正文', () =>
            ctx.slots.inject('sidebar.right.pane.tab', () => {
              const dispose = ctx.slots.register({ name: 'sidebar.right.pane.tab', key: PANEL_ID }, Panel);
              registered.panel = true;
              return dispose;
            }),
          ),
        );

        // 打招呼留痕：面板/卡片没出现时，Host 侧的 diag 能区分「模块没投递」和「注册失败」。
        hello();
        setTimeout(() => hello(), 3000);

        // 面板不自动打开：右侧栏只在用户点卡片上的「面板」（或菜名）时才出现。
      },
    };
  },
});
