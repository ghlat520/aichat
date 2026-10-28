// store-core.js — 全局状态 store 纯逻辑（零运行时依赖，可独立单测）
// 职责：会话/同意态持久化、feature flag 查询、INV-01 路由守卫判定。
// 红线：PII（六字段/倾诉原文）绝不入 storage（INV-08/AC-22）。
// 依赖注入：构造时传入 wxLike（{getStorageSync,setStorageSync,removeStorageSync}）。

const STORAGE_KEY = 'aichat_state_v1';

function createStore(wxLike) {
  let logoutVersion = 0;
  const sessionDrafts = new Map();
  let state = {
    session: null,
    consent: null,
    appConfig: null,
    assessment: null,
    activeTask: null,
    venting: null,
    moodCheckin: null
  };

  function persist() {
    try {
      wxLike.setStorageSync(STORAGE_KEY, JSON.stringify({
        session: state.session,
        consent: state.consent
      }));
    } catch (e) {
      // 静默失败
    }
  }

  function persistSession(session) {
    try {
      wxLike.setStorageSync(STORAGE_KEY, JSON.stringify({ session, consent: state.consent }));
    } catch (error) {
      throw new Error('本机存储不可用，登录状态未保存，请重试');
    }
  }

  function sessionKey(session) {
    return session && session.sessionId ? `session:${session.sessionId}` : `local:${logoutVersion}`;
  }

  function switchSession(session, logout = false) {
    const previousKey = sessionKey(state.session);
    if (logout) logoutVersion++;
    const nextKey = sessionKey(session);
    if (previousKey === nextKey) {
      state = { ...state, session };
      return;
    }
    const { assessment, activeTask, venting, moodCheckin } = state;
    sessionDrafts.set(previousKey, { assessment, activeTask, venting, moodCheckin });
    const restored = sessionDrafts.get(nextKey) || { assessment: null, activeTask: null, venting: null, moodCheckin: null };
    state = { ...state, session, ...restored };
  }

  return {
    hydrate() {
      try {
        const raw = wxLike.getStorageSync(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(typeof raw === 'string' ? raw : JSON.stringify(raw));
          state = {
            session: parsed.session || null,
            consent: parsed.consent || null,
            appConfig: state.appConfig,
            assessment: null,
            activeTask: null,   // PII 不恢复
            venting: null,      // 隐私不恢复
            moodCheckin: null   // 情绪状态仅限当前会话
          };
        }
      } catch (e) {
        state = {
          session: null,
          consent: null,
          appConfig: null,
          assessment: null,
          activeTask: null,
          venting: null,
          moodCheckin: null
        };
      }
    },

    getState() { return state; },
    getLogoutVersion() { return logoutVersion; },

    setSession(session) { persistSession(session); switchSession(session); },
    clearSession() {
      persistSession(null);
      switchSession(null, true);
    },
    setConsent(consent) { state = { ...state, consent }; persist(); },
    setAppConfig(appConfig) { state = { ...state, appConfig }; },
    setAssessment(assessment) { state = { ...state, assessment }; /* 不 persist */ },
    setActiveTask(activeTask) { state = { ...state, activeTask }; /* 不 persist（PII） */ },
    setVenting(venting) { state = { ...state, venting }; /* 不 persist（隐私） */ },
    setMoodCheckin(moodCheckin) { state = { ...state, moodCheckin }; /* 不 persist（情绪隐私） */ },
    patchActiveTask(patch) {
      state = { ...state, activeTask: { ...(state.activeTask || {}), ...patch } };
      /* 不 persist（PII） */
    },
    patchVenting(patch) {
      state = { ...state, venting: { ...(state.venting || {}), ...patch } };
      /* 不 persist（隐私） */
    },

    getPersonalAssets() {
      const assessment = state.assessment || null;
      const result = assessment && assessment.result ? assessment.result : null;
      const activeTask = state.activeTask || null;
      let taskStage = 'started';
      if (activeTask && activeTask.reportId) {
        taskStage = 'report_ready';
      } else if (activeTask && activeTask.fields) {
        taskStage = 'clarity_saved';
      } else if (activeTask && activeTask.candidateFields) {
        taskStage = 'calibration_pending';
      }
      return {
        assessment: assessment && result ? {
          runId: assessment.runId || '',
          mappedTaskId: assessment.mappedTaskId || '',
          currentTendency: String(result.current_tendency || ''),
          usableStrength: String(result.usable_strength || ''),
          realWorldReminder: String(result.one_real_world_reminder || '')
        } : null,
        task: activeTask && activeTask.taskId ? {
          taskId: activeTask.taskId,
          source: activeTask.source || 'direct',
          stage: taskStage
        } : null,
        moodCheckin: state.moodCheckin ? { ...state.moodCheckin } : null
      };
    },

    clearAuth() {
      state = {
        session: null,
        consent: null,
        appConfig: null,
        assessment: null,
        activeTask: null,
        venting: null,
        moodCheckin: null
      };
      try { wxLike.removeStorageSync(STORAGE_KEY); } catch (e) { /* ignore */ }
    },

    /** V1.2 起移除前置边界闸（2026-10-26 指令）：页面不再按同意态拦截；
        consent 仍随访客会话建立时记录，保持服务端契约不变。 */
    isEntryUnlocked() {
      return true;
    },

    /** feature flag 查询（AC-25 Fail-Closed 数据源） */
    isFeatureEnabled(flag) {
      return !!(state.appConfig && state.appConfig.feature_flags && state.appConfig.feature_flags[flag]);
    }
  };
}

module.exports = { createStore, STORAGE_KEY };
