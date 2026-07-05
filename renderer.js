/* ============================================================
   renderer.js — KaTeX rendering and DOM construction.

   Responsibilities:
   - Build the question panel and solution panel DOM from question objects
   - Run KaTeX renderMathInElement on a container after content is set
   - Never mutate innerHTML incrementally; each panel is built and assigned once

   Exposes a global `Renderer` object consumed by app.js.
   ============================================================ */

const Renderer = (() => {
  // KaTeX auto-render delimiter config, matching the questions.json conventions:
  //   inline  \( ... \)
  //   display \[ ... \]
  const KATEX_DELIMITERS = [
    { left: "\\[", right: "\\]", display: true },
    { left: "\\(", right: "\\)", display: false },
    // $$ / $ kept as a convenience fallback; not used by the bank format.
    { left: "$$", right: "$$", display: true },
    { left: "$", right: "$", display: false },
  ];

  /**
   * Render all math inside a container element using KaTeX auto-render.
   * Safe to call even if KaTeX has not finished loading (no-op with a warning).
   */
  function renderMath(container) {
    if (!container) return;
    if (typeof window.renderMathInElement !== "function") {
      console.warn("KaTeX auto-render not available yet; skipping math render.");
      return;
    }
    window.renderMathInElement(container, {
      delimiters: KATEX_DELIMITERS,
      throwOnError: false,
      ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code"],
    });
  }

  /**
   * Populate the question panel for a single question object, then render math.
   * The panel is fully replaced in one assignment (no innerHTML +=).
   */
  function renderQuestion(panel, question) {
    const idLine = document.createElement("p");
    idLine.className = "question-id";
    idLine.textContent = question.id || "";

    const body = document.createElement("div");
    body.className = "question-body";
    // question text carries LaTeX delimiters; assign as HTML then KaTeX-render.
    body.innerHTML = question.question || "";

    panel.replaceChildren(idLine, body);
    renderMath(panel);
  }

  /**
   * Populate the solution panel: numbered steps + conceptual note, then render.
   * Fully replaced in one assignment.
   */
  function renderSolution(panel, question) {
    const heading = document.createElement("h2");
    heading.className = "solution-heading";
    heading.textContent = "Solution";

    const list = document.createElement("ol");
    list.className = "solution-steps";

    (question.solution || []).forEach((step) => {
      const li = document.createElement("li");

      if (step.step) {
        const prose = document.createElement("p");
        prose.className = "step-prose";
        prose.textContent = step.step;
        li.appendChild(prose);
      }

      if (step.latex) {
        const math = document.createElement("div");
        math.className = "step-latex";
        math.innerHTML = step.latex;
        li.appendChild(math);
      }

      list.appendChild(li);
    });

    const children = [heading, list];

    if (question.conceptual_note) {
      const note = document.createElement("div");
      note.className = "conceptual-note";

      const label = document.createElement("span");
      label.className = "note-label";
      label.textContent = "Concept";

      const noteBody = document.createElement("span");
      noteBody.className = "note-body";
      noteBody.innerHTML = question.conceptual_note;

      note.append(label, noteBody);
      children.push(note);
    }

    panel.replaceChildren(...children);
    renderMath(panel);
  }

  return { renderMath, renderQuestion, renderSolution };
})();
