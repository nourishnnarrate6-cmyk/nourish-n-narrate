/* ===================================================================
   NOURISH N NARRATE — SHARED CARD + MODAL LOGIC
   Used by both index.html and all-recipes.html.
   Requires: RECIPES (recipes-data.js) and the modal markup in the page.
=================================================================== */

    const PLACEHOLDER_COUNT = 6; // How many placeholder cards to show when there are no recipes

    /** Build one placeholder card element */
    function buildPlaceholderCard() {
      const card = document.createElement('div');
      card.className  = 'recipe-card placeholder';
      card.dataset.category = 'all'; // Placeholders always pass any filter
      card.setAttribute('tabindex', '0');
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', 'Recipe coming soon');
      card.innerHTML = `
        <div class="placeholder-img">
          <div class="placeholder-plus" aria-hidden="true">+</div>
          <span class="placeholder-label">Recipe Coming Soon</span>
        </div>
        <div class="placeholder-body">
          <div class="placeholder-title"></div>
          <div class="placeholder-line"></div>
          <div class="placeholder-line short"></div>
          <div class="placeholder-meta">
            <div class="placeholder-chip"></div>
            <div class="placeholder-chip"></div>
            <div class="placeholder-chip"></div>
          </div>
        </div>`;
      return card;
    }

    /** Build one real recipe card element from a recipe object */
    function buildRecipeCard(recipe, index) {
      const card = document.createElement('div');
      card.className = 'recipe-card';
      card.dataset.category = recipe.category || 'all';
      card.dataset.type = recipe.type || 'veg';
      // Store the recipe index on the card so the modal can retrieve it
      card.dataset.index = index;
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-label', `Open recipe: ${recipe.title}`);

      // Image section:
      // ✏️ If recipe.image_url is a path/URL, an <img> tag is used.
      //    If recipe.image_url is null AND recipe.emoji is set, the emoji placeholder is shown.
      //    If both are null/empty, the recipe title is shown as a styled banner.
      const imageHTML = recipe.image_url
        ? `<img
             class="card-img"
             src="${recipe.image_url}"
             alt="${recipe.title}"
             onerror="this.parentNode.innerHTML='<div class=\\'card-title-banner\\'><span>${recipe.title}</span></div>'"
           />`
        : recipe.emoji
          ? `<div class="card-img-placeholder" aria-hidden="true">${recipe.emoji}</div>`
          : `<div class="card-title-banner" aria-hidden="true"><span>${recipe.title}</span></div>`;

      card.innerHTML = `
        ${imageHTML}
        <div class="card-body">
          <span class="card-category">${recipe.category || ''}</span>
          <h3 class="card-title">${recipe.title}</h3>
          <p  class="card-desc">${recipe.desc || ''}</p>
          <div class="card-meta">
            ${recipe.time     ? `<span>⏱ ${recipe.time}</span>` : ''}
            ${recipe.servings ? `<span>👤 ${recipe.servings}</span>` : ''}
            ${recipe.calories ? `<span>🔥 ${recipe.calories} cal</span>` : ''}
          </div>
        </div>`;

      // Click or Enter/Space key → open modal
      card.addEventListener('click', () => openModal(index));
      card.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openModal(index); }
      });

      return card;
    }

    /* ✏️ FEATURED RECIPES — these 6 show first, before the "See all recipes" button.
       Titles must match the recipe "title" fields exactly. Reorder to change which
       cards appear on top; the rest stay hidden until the visitor expands them. */

    function openModal(recipeIndex) {
      const r = RECIPES[recipeIndex];
      if (!r) return; // Safety check

      // Header: real image or emoji fallback
      const header = document.getElementById('modal-header');
      if (r.image_url) {
        // ✏️ IMAGE PATH: r.image_url comes from Supabase.
        //    Make sure the path or URL is correct.
        header.innerHTML = `<img class="modal-img" src="${r.image_url}" alt="${r.title}" onerror="this.outerHTML='<div class=\\'modal-img-emoji\\'>${r.emoji || '🍽️'}</div>'" />`;
      } else {
        header.innerHTML = `<div class="modal-img-emoji" aria-hidden="true">${r.emoji || '🍽️'}</div>`;
      }

      // Text fields
      document.getElementById('modal-category').textContent = r.category || '';
      document.getElementById('modal-title').textContent    = r.title    || 'Untitled Recipe';
      document.getElementById('modal-desc').textContent     = r.desc     || '';
      document.getElementById('modal-time').textContent     = r.time     || '—';
      document.getElementById('modal-servings').textContent = r.servings || '—';
      document.getElementById('modal-calories').textContent = r.calories ? r.calories + ' cal' : '—';
      document.getElementById('modal-protein').textContent  = r.protein  || '—';
      document.getElementById('modal-fiber').textContent    = r.fiber    || '—';
      document.getElementById('modal-fat').textContent      = r.fat      || '—';

      // Ingredients list
      const ingEl = document.getElementById('modal-ingredients-list');
      ingEl.innerHTML = (r.ingredients || [])
        .map(item => `<div class="modal-ingredient">${item}</div>`)
        .join('');

      // Steps list
      const stepsEl = document.getElementById('modal-steps-list');
      stepsEl.innerHTML = (r.steps || [])
        .map(step => `<li>${step}</li>`)
        .join('');

      // Tip (hidden if null or empty)
      const tipEl = document.getElementById('modal-tip');
      if (r.tip) {
        document.getElementById('modal-tip-text').textContent = r.tip;
        tipEl.style.display = '';
      } else {
        tipEl.style.display = 'none';
      }

      // Why It's Healthier bullets (hidden if not provided)
      const whyEl  = document.getElementById('modal-why');
      const whyList = document.getElementById('modal-why-list');
      if (r.whyHealthier && r.whyHealthier.length) {
        whyList.innerHTML = r.whyHealthier
          .map(point => `<div class="modal-why-item">${point}</div>`)
          .join('');
        whyEl.style.display = '';
      } else {
        whyEl.style.display = 'none';
      }

      // Comparison table (hidden if not provided)
      // r.comparison = [ ['Original item', 'Our version item'], ... ]
      const compEl  = document.getElementById('modal-comparison');
      const compBody = document.getElementById('modal-table-body');
      if (r.comparison && r.comparison.length) {
        compBody.innerHTML = r.comparison
          .map(([orig, ours]) => `<tr><td>${orig}</td><td>${ours}</td></tr>`)
          .join('');
        compEl.style.display = '';
      } else {
        compEl.style.display = 'none';
      }

      // Open overlay
      document.getElementById('modal-overlay').classList.add('open');
      document.body.style.overflow = 'hidden';
    }

    function closeModal() {
      document.getElementById('modal-overlay').classList.remove('open');
      document.body.style.overflow = '';
    }

    // Close when clicking outside the modal box
    document.getElementById('modal-overlay').addEventListener('click', e => {
      if (e.target === e.currentTarget) closeModal();
    });

    // Close on Escape key
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeModal();
    });
