/**
 * GOAL NOTIFICATION PATCH
 *
 * This script patches the original _mmFlash function to use the improved
 * goal notification system instead of the central overlay.
 *
 * Load this AFTER index.bundle.js
 */

(function() {
  // Track the last match that had an event
  let lastEventMatch = null;
  let lastEventTeam = null;

  // Wait for the improved goal notification system to be available
  let maxRetries = 50;
  let retryCount = 0;

  function waitForImprovedSystem() {
    if (window.goalNotificationImproved && typeof window.goalNotificationImproved.show === 'function') {
      // Patch the original _mmFlash function
      patchGoalFlash();
      return;
    }

    if (retryCount < maxRetries) {
      retryCount++;
      setTimeout(waitForImprovedSystem, 100);
    }
  }

  function findMatchFromTeamName(teamName) {
    // Search through all matches to find the one with this team
    const matches = document.querySelectorAll('[id^="mlw-"]');
    for (const match of matches) {
      const teamNames = match.querySelectorAll('.ml-team-name');
      for (const team of teamNames) {
        if (team.textContent.includes(teamName)) {
          const matchId = match.id.replace('mlw-', '');
          return { match, matchId };
        }
      }
    }
    return null;
  }

  function observeActaEvents() {
    // Observe all match acta lists for new events
    const actaLists = document.querySelectorAll('[id^="ml-acta-list-"]');

    actaLists.forEach(function(listEl) {
      // Extract match ID from acta list ID
      const matchId = listEl.id.replace('ml-acta-list-', '');

      // Set up observer for this list
      const obs = new MutationObserver(function() {
        const items = listEl.querySelectorAll('.ml-evt-item');
        if (items.length > 0) {
          const lastItem = items[items.length - 1];
          const type = lastItem.getAttribute('data-type');
          const teamAttr = lastItem.getAttribute('data-team');

          // Update tracking
          lastEventMatch = matchId;
          lastEventTeam = teamAttr;

          // If it's a goal type, we'll catch it in the _mmFlash patch
        }
      });

      obs.observe(listEl, { childList: true });
    });
  }

  function patchGoalFlash() {
    // Store original function if it exists
    const originalMmFlash = window.mmShowFlash || function() {};

    // New implementation that uses the improved notification system
    window.mmShowFlash = function(type, teamName, playerName) {
      if (type === 'gol') {
        // Try to find the match by team name
        let matchId = null;
        let team = 'a';

        const result = findMatchFromTeamName(teamName);
        if (result) {
          matchId = result.matchId;
          // Determine team by checking which team in the match has this name
          const match = result.match;
          const teams = match.querySelectorAll('.ml-team-name');
          if (teams.length >= 2) {
            if (teams[1].textContent.includes(teamName)) {
              team = 'b';
            }
          }
        } else if (lastEventMatch) {
          // Fall back to last match with event
          matchId = lastEventMatch;
          team = lastEventTeam || 'a';
        }

        if (matchId) {
          // Show the improved goal notification
          window.goalNotificationImproved.show(matchId, team);
        }
      }

      // Don't call the original _mmFlash to avoid central overlay
    };

    // Hide the central flash overlay completely
    const flashEl = document.getElementById('mm-event-flash');
    if (flashEl) {
      flashEl.style.display = 'none !important';
      flashEl.classList.remove('show', 'mm-flash-gol', 'mm-flash-roja');
    }

    // Ensure it stays hidden
    const hideOverlay = function() {
      const el = document.getElementById('mm-event-flash');
      if (el && (el.style.display !== 'none' || el.classList.contains('show'))) {
        el.style.display = 'none !important';
        el.classList.remove('show', 'mm-flash-gol', 'mm-flash-roja');
      }
    };

    setInterval(hideOverlay, 250);

    // Start observing acta events
    observeActaEvents();

    // Re-observe new lists that might be created dynamically
    const checkNewLists = setInterval(function() {
      const existingListIds = new Set();
      document.querySelectorAll('[id^="ml-acta-list-"]').forEach(function(el) {
        existingListIds.add(el.id);
      });
    }, 1000);
  }

  // Start waiting for the improved system
  waitForImprovedSystem();
})();
