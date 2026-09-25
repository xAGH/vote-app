'use strict';

/**
 * Mejoras progresivas. Nada aquí es obligatorio: las estrellas son radios
 * nativos y los formularios funcionan por POST normal sin este archivo.
 */

// Evita doble envío accidental (doble tap, doble clic) en formularios que
// escriben — la unicidad real la garantiza la base de datos, esto solo
// evita una llamada de red redundante y el parpadeo de un segundo envío.
document.addEventListener('submit', (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  const submitter = event.submitter || form.querySelector('[type="submit"]');
  if (submitter && submitter.disabled) {
    event.preventDefault();
    return;
  }
  if (submitter) {
    window.requestAnimationFrame(() => {
      submitter.disabled = true;
      submitter.dataset.wasDisabled = '1';
    });
  }
});

// ---------- Formulario del jurado: autoguardado por criterio + promedio en vivo ----------

function initJuryForm() {
  const root = document.querySelector('[data-jury-form]');
  if (!root) return;

  const csrfToken = root.dataset.csrf;
  const judgeToken = root.dataset.judgeToken || '';
  const saveUrl = root.dataset.saveUrl;
  const scoreValueEl = root.querySelector('[data-score-value]');
  const saveStatusEl = root.querySelector('[data-save-status]');
  const blocks = Array.from(root.querySelectorAll('[data-rubric-block]'));

  function updateRail() {
    for (const block of blocks) {
      const inputs = block.querySelectorAll('input[type="radio"]');
      const names = new Set(Array.from(inputs).map((i) => i.name));
      let answered = 0;
      for (const name of names) {
        if (block.querySelector(`input[name="${CSS.escape(name)}"]:checked`)) answered += 1;
      }
      const rail = document.querySelector(`[data-rail-for="${block.dataset.rubricBlock}"]`);
      if (!rail) continue;
      if (answered === 0) rail.dataset.state = 'empty';
      else if (answered === names.size) rail.dataset.state = 'complete';
      else rail.dataset.state = 'partial';
    }
  }

  function updateAverage() {
    const checked = root.querySelectorAll('input[type="radio"]:checked');
    if (!checked.length) {
      scoreValueEl.textContent = '—';
      return;
    }
    let sum = 0;
    checked.forEach((el) => { sum += Number(el.value); });
    const avg = sum / checked.length;
    scoreValueEl.textContent = avg.toFixed(1);
  }

  let saveTimer = null;
  function flashSaved() {
    if (!saveStatusEl) return;
    saveStatusEl.textContent = 'Guardado';
    saveStatusEl.classList.add('is-saved');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveStatusEl.textContent = 'Autoguardado activo';
      saveStatusEl.classList.remove('is-saved');
    }, 1600);
  }

  async function saveCriterion(name, value) {
    if (!saveUrl) return;
    if (saveStatusEl) saveStatusEl.textContent = 'Guardando…';
    try {
      const res = await fetch(saveUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ _csrf: csrfToken, _j: judgeToken, criterion: name, score: value }),
      });
      if (!res.ok) throw new Error('save failed');
      flashSaved();
    } catch {
      if (saveStatusEl) saveStatusEl.textContent = 'No se pudo guardar, seguirá intentando al enviar';
    }
  }

  root.addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.type !== 'radio') return;
    updateAverage();
    updateRail();
    saveCriterion(target.name, target.value);
  });

  updateAverage();
  updateRail();
}

document.addEventListener('DOMContentLoaded', () => {
  initJuryForm();
});
