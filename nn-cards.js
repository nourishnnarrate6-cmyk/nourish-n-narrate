/* ===================================================================
   NOURISH N NARRATE — SHARED CARD + MODAL LOGIC
   Used by both index.html and all-recipes.html.
   Requires: RECIPES (recipes-data-supabase.js) and the modal markup
   in the page.
=================================================================== */

    const PLACEHOLDER_COUNT = 6; // How many placeholder cards to show when there are no recipes

    /* ===========================================================
       COLLECTIONS
       Additive tags — a recipe keeps its Vegetarian / Non-Vegetarian
       home and can appear in any number of further collections.
       Add a new one here and in the database `collections` column;
       no recipe data needs duplicating.
    =========================================================== */
    const NN_COLLECTIONS = {
      'veg':          'Vegetarian',
      'non-veg':      'Non-Vegetarian',
      'high-protein': 'High Protein',
    };

    /** The collections a recipe belongs to, always as an array of names. */
    function recipeCollections(recipe) {
      if (Array.isArray(recipe.collections) && recipe.collections.length) {
        return recipe.collections;
      }
      // Older data with only `type` — fall back so nothing disappears.
      return [recipe.type === 'non-veg' ? 'Non-Vegetarian' : 'Vegetarian'];
    }

    /** Does a recipe belong to this collection? `key` is a NN_COLLECTIONS key. */
    function recipeInCollection(recipe, key) {
      if (!key || key === 'all') return true;
      const name = NN_COLLECTIONS[key] || key;
      return recipeCollections(recipe).indexOf(name) !== -1;
    }

    /* ===========================================================
       NUTRITION SCORE
       Worked out by nn-score.js from the recipe's own numbers and
       ingredient list — nothing is stored, so a recipe added later
       is scored the moment it appears. If that file is missing the
       badge is simply left off and everything else still works.
    =========================================================== */

    /** The score for a recipe, or null when scoring is unavailable. */
    function scoreOf(recipe) {
      if (!window.NNScore || !recipe) return null;
      try { return window.NNScore.score(recipe); } catch (e) { return null; }
    }

    /** The badge that sits on a recipe card. */
    function buildScoreBadge(s) {
      const badge = document.createElement('div');
      badge.className = 'card-score score-' + s.color;
      badge.title = 'Nutrition Score ' + s.total + ' out of 100 — ' + s.label;
      badge.setAttribute('aria-label',
        'Nutrition Score ' + s.total + ' out of 100, ' + s.label);
      badge.innerHTML =
        '<span class="card-score-num">' + s.total + '</span>' +
        '<span class="card-score-out">/100</span>';
      return badge;
    }

    /** Same test against a rendered card, for the DOM-based filters. */
    function cardInCollection(card, key) {
      if (!key || key === 'all') return true;
      const name = NN_COLLECTIONS[key] || key;
      return ('|' + (card.dataset.collections || '') + '|').indexOf('|' + name + '|') !== -1;
    }

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
      // Pipe-delimited so a single card can match several collections.
      card.dataset.collections = recipeCollections(recipe).join('|');
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

      // Nutrition Score — sits over the image corner so it reads at a glance
      // without pushing the card layout around. The number also goes on the
      // card as data, which is what the sort and the 90+/80+ filters use.
      const s = scoreOf(recipe);
      if (s) {
        card.dataset.score = s.total;
        card.dataset.scoreBand = s.band;
        card.appendChild(buildScoreBadge(s));
      }

      // "+ Track" — log this recipe to today's tracker (requires login)
      const meta = card.querySelector('.card-meta');
      if (meta && window.NNAuth) {
        const trackBtn = document.createElement('button');
        trackBtn.type = 'button';
        trackBtn.className = 'card-track';
        trackBtn.textContent = '+ Track';
        trackBtn.title = 'Log this recipe to today\'s calorie tracker';
        trackBtn.addEventListener('click', async e => {
          e.stopPropagation();
          const session = await NNAuth.getSession();
          if (!session) {
            const page = location.pathname.split('/').pop() || 'index.html';
            location.href = 'login.html?redirect=' + encodeURIComponent(page);
            return;
          }
          trackBtn.disabled = true;
          trackBtn.textContent = 'Adding…';
          const kcal = parseInt(recipe.calories, 10) || 0;
          const today = new Date().toLocaleDateString('en-CA');
          const res = await NNAuth.addLog(today, 'food', recipe.title, kcal);
          if (res.ok) {
            trackBtn.textContent = '✓ Tracked';
            setTimeout(() => { trackBtn.textContent = '+ Track'; trackBtn.disabled = false; }, 2500);
          } else {
            trackBtn.textContent = '+ Track';
            trackBtn.disabled = false;
          }
        });
        meta.appendChild(trackBtn);
      }

      // "⇄ Compare" — adds this recipe to the comparison tray. Built by
      // nn-compare.js so the button and the tray stay in one place; if that
      // file is absent the card simply has no Compare button.
      if (meta && window.NNCompare) {
        meta.appendChild(window.NNCompare.buildButton(recipe));
      }

      // Click or Enter/Space key → open modal
      card.addEventListener('click', () => openModal(index));
      card.addEventListener('keydown', e => {
        if (e.target !== card) return; // don't hijack the Track button
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openModal(index); }
      });

      return card;
    }

    /** Fill the "Why this score?" block in the open recipe modal.
        Silent no-op on a page whose modal predates this section. */
    function renderScorePanel(recipe) {
      const host = document.getElementById('modal-score');
      if (!host) return;

      const s = scoreOf(recipe);
      if (!s) { host.style.display = 'none'; return; }
      host.style.display = '';
      host.innerHTML = '';

      // Headline: the number, the band, and a one-line summary.
      const head = document.createElement('div');
      head.className = 'mscore-head score-' + s.color;
      head.innerHTML =
        '<div class="mscore-dial">' +
          '<span class="mscore-num">' + s.total + '</span>' +
          '<span class="mscore-out">/100</span>' +
        '</div>' +
        '<div class="mscore-headtext">' +
          '<div class="mscore-title">⭐ Nutrition Score</div>' +
          '<div class="mscore-band">' + s.emoji + ' ' + s.label + '</div>' +
        '</div>';
      host.appendChild(head);

      const summary = document.createElement('p');
      summary.className = 'mscore-summary';
      summary.textContent = s.summary;
      host.appendChild(summary);

      // Every factor, with its bar. Written as text nodes rather than
      // innerHTML because the notes contain ingredient names.
      const list = document.createElement('div');
      list.className = 'mscore-factors';
      s.factors.forEach(f => {
        const row = document.createElement('div');
        row.className = 'mscore-factor is-' + f.verdict;

        const top = document.createElement('div');
        top.className = 'mscore-frow';
        const name = document.createElement('span');
        name.className = 'mscore-fname';
        name.textContent = f.label;
        const pts = document.createElement('span');
        pts.className = 'mscore-fpts';
        pts.textContent = Math.round(f.points) + '/' + f.max;
        top.appendChild(name);
        top.appendChild(pts);
        row.appendChild(top);

        const bar = document.createElement('div');
        bar.className = 'mscore-bar';
        const fill = document.createElement('span');
        fill.style.width = Math.round((f.points / f.max) * 100) + '%';
        bar.appendChild(fill);
        row.appendChild(bar);

        const note = document.createElement('p');
        note.className = 'mscore-note';
        note.textContent = f.note;
        row.appendChild(note);

        list.appendChild(row);
      });
      host.appendChild(list);

      // Say plainly what the number is and is not.
      const foot = document.createElement('p');
      foot.className = 'mscore-foot';
      foot.textContent = 'Worked out from this recipe’s protein, fibre, fat and ' +
        'ingredient list. Sugar and sodium are estimated from the ingredients rather ' +
        'than measured, so treat the score as a guide, not a lab result.';
      host.appendChild(foot);
    }

    /* ✏️ FEATURED RECIPES — these 6 show first, before the "See all recipes" button.
       Titles must match the recipe "title" fields exactly. Reorder to change which
       cards appear on top; the rest stay hidden until the visitor expands them. */

    function openModal(recipeIndex) {
      const r = RECIPES[recipeIndex];
      if (!r) return; // Safety check

      // Usage analytics — fire-and-forget, never awaited.
      try {
        if (window.NNAnalytics) {
          window.NNAnalytics.track('recipe_view', {
            title: r.title,
            category: r.category || '',
            score: window.NNScore ? window.NNScore.of(r) : null,
          });
        }
      } catch (e) {}

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

      // "Why this score?" — the six factors in plain language, strengths
      // first and then anything holding the score back.
      renderScorePanel(r);

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
