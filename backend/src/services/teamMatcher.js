/**
 * Fuzzy-matches assignee names from Claude extraction
 * against real team members in the database.
 *
 * E.g. Claude says "Sara" → matches "Sara Malik" in team_members
 */

function normalizeName(name) {
  return name?.toLowerCase().trim().replace(/[^a-z\s]/g, '') || '';
}

function scoreName(extracted, member) {
  const e = normalizeName(extracted);
  const fullName = normalizeName(member.name);
  const parts = fullName.split(' ');

  // Exact full match
  if (e === fullName) return 100;

  // First name match
  if (parts[0] && e === parts[0]) return 80;

  // Last name match
  if (parts[parts.length - 1] && e === parts[parts.length - 1]) return 70;

  // Starts with
  if (fullName.startsWith(e) || e.startsWith(parts[0])) return 60;

  // Contains
  if (fullName.includes(e) || e.includes(parts[0])) return 40;

  return 0;
}

/**
 * @param {Array} tasks - tasks from Claude with assignee_name strings
 * @param {Array} teamMembers - rows from team_members table
 * @returns tasks with assignee_email populated where matched
 */
function matchTeamMembers(tasks, teamMembers) {
  return tasks.map(task => {
    if (!task.assignee_name || teamMembers.length === 0) return task;

    let bestMatch = null;
    let bestScore = 0;

    for (const member of teamMembers) {
      const score = scoreName(task.assignee_name, member);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = member;
      }
    }

    // Only assign if confident enough (score >= 60)
    if (bestMatch && bestScore >= 60) {
      return {
        ...task,
        assignee_name: bestMatch.name,
        assignee_email: bestMatch.email,
        assignee_slack_id: bestMatch.slack_user_id,
        assignee_jira_id: bestMatch.jira_account_id,
      };
    }

    return task;
  });
}

module.exports = { matchTeamMembers };
