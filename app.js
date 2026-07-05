/* ============================================================
   app.js — topic selection, question drawing, timer, UI state machine.

   States:
     IDLE            no topic chosen; idle message shown
     QUESTION_SHOWN  question visible, timer running, solution hidden
     SOLUTION_SHOWN  solution visible, timer frozen

   Depends on the global `Renderer` (renderer.js) and questions.json.
   ============================================================ */

(() => {
  "use strict";

  const STATE = {
    IDLE: "IDLE",
    QUESTION_SHOWN: "QUESTION_SHOWN",
    SOLUTION_SHOWN: "SOLUTION_SHOWN",
  };

  // ---- DOM references ----
  const els = {
    topicSelect: document.getElementById("topic-select"),
    timer: document.getElementById("timer"),
    idleMessage: document.getElementById("idle-message"),
    questionPanel: document.getElementById("question-panel"),
    actionBar: document.getElementById("action-bar"),
    showSolutionBtn: document.getElementById("show-solution-btn"),
    newQuestionBtn: document.getElementById("new-question-btn"),
    solutionPanel: document.getElementById("solution-panel"),
  };

  // ---- Runtime state ----
  const app = {
    state: STATE.IDLE,
    bank: null, // full questions.json object
    currentTopic: null, // topic id string
    currentQuestion: null, // current question object
    lastIdByTopic: {}, // topic id -> last shown question id (avoid immediate repeat)
    timerId: null, // setInterval handle
    elapsedSeconds: 0,
  };

  // ============================================================
  //  Timer
  // ============================================================

  function formatTime(totalSeconds) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(m)}:${pad(s)}`;
  }

  function renderTimer() {
    els.timer.textContent = formatTime(app.elapsedSeconds);
  }

  function startTimer() {
    stopTimer();
    app.elapsedSeconds = 0;
    renderTimer();
    els.timer.classList.remove("frozen");
    app.timerId = window.setInterval(() => {
      app.elapsedSeconds += 1;
      renderTimer();
    }, 1000);
  }

  function stopTimer() {
    if (app.timerId !== null) {
      window.clearInterval(app.timerId);
      app.timerId = null;
    }
  }

  function freezeTimer() {
    stopTimer();
    els.timer.classList.add("frozen");
  }

  // ============================================================
  //  Question drawing
  // ============================================================

  /**
   * Draw a random question from the given topic, avoiding an immediate repeat
   * of the last-shown question for that topic when the pool has more than one.
   */
  function drawQuestion(topic) {
    const pool = (app.bank && app.bank[topic]) || [];
    if (pool.length === 0) return null;
    if (pool.length === 1) return pool[0];

    const lastId = app.lastIdByTopic[topic];
    let picked;
    do {
      picked = pool[Math.floor(Math.random() * pool.length)];
    } while (picked.id === lastId);
    return picked;
  }

  // ============================================================
  //  State transitions
  // ============================================================

  function toIdle() {
    app.state = STATE.IDLE;
    app.currentTopic = null;
    app.currentQuestion = null;
    stopTimer();
    app.elapsedSeconds = 0;
    renderTimer();
    els.timer.classList.remove("frozen");

    els.idleMessage.hidden = false;
    els.questionPanel.hidden = true;
    els.actionBar.hidden = true;
    els.solutionPanel.hidden = true;
    els.questionPanel.replaceChildren();
    els.solutionPanel.replaceChildren();
  }

  /**
   * Enter QUESTION_SHOWN with a freshly drawn question for the current topic.
   * Resets and restarts the timer. Used both on topic change and "New question".
   */
  function showNewQuestion() {
    const question = drawQuestion(app.currentTopic);
    if (!question) {
      // No questions available for this topic yet.
      els.idleMessage.hidden = false;
      els.idleMessage.textContent =
        "No questions available for this topic yet.";
      els.questionPanel.hidden = true;
      els.actionBar.hidden = true;
      els.solutionPanel.hidden = true;
      return;
    }

    app.currentQuestion = question;
    app.lastIdByTopic[app.currentTopic] = question.id;
    app.state = STATE.QUESTION_SHOWN;

    els.idleMessage.hidden = true;

    Renderer.renderQuestion(els.questionPanel, question);
    els.questionPanel.hidden = false;

    // Solution hidden, "Show solution" available again.
    els.solutionPanel.hidden = true;
    els.solutionPanel.replaceChildren();
    els.showSolutionBtn.hidden = false;
    els.actionBar.hidden = false;

    startTimer();
    els.showSolutionBtn.focus();
  }

  /**
   * Enter SOLUTION_SHOWN: freeze timer, reveal solution for current question.
   */
  function showSolution() {
    if (app.state !== STATE.QUESTION_SHOWN || !app.currentQuestion) return;

    app.state = STATE.SOLUTION_SHOWN;
    freezeTimer();

    Renderer.renderSolution(els.solutionPanel, app.currentQuestion);
    els.solutionPanel.hidden = false;

    // Hide "Show solution"; "New question" remains to advance.
    els.showSolutionBtn.hidden = true;
    els.newQuestionBtn.focus();
  }

  // ============================================================
  //  Event wiring
  // ============================================================

  function onTopicChange() {
    const topic = els.topicSelect.value;
    if (!topic) {
      toIdle();
      return;
    }
    app.currentTopic = topic;
    showNewQuestion();
  }

  function onShowSolution() {
    showSolution();
  }

  function onNewQuestion() {
    if (!app.currentTopic) return;
    showNewQuestion();
  }

  function wireEvents() {
    els.topicSelect.addEventListener("change", onTopicChange);
    els.showSolutionBtn.addEventListener("click", onShowSolution);
    els.newQuestionBtn.addEventListener("click", onNewQuestion);
  }

  // ============================================================
  //  Bootstrap
  // ============================================================

  async function loadBank() {
    const res = await fetch("questions.json", { cache: "no-cache" });
    if (!res.ok) {
      throw new Error(`Failed to load questions.json (${res.status})`);
    }
    return res.json();
  }

  async function init() {
    wireEvents();
    toIdle();
    try {
      app.bank = await loadBank();
    } catch (err) {
      console.error(err);
      els.idleMessage.textContent =
        "Could not load the question bank. Please refresh the page.";
      els.topicSelect.disabled = true;
      return;
    }
    // If a topic is already selected (e.g., browser restored it), show a question.
    if (els.topicSelect.value) {
      onTopicChange();
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
