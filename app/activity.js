// The trail of who changed what. It rides along with the project into storage
// and into the team database, so it is kept bounded on purpose.
const ACTIVITY_MAX = 800;
const ACTIVITY_DAYS = 180;

export function trimActivity(project) {
  if (!Array.isArray(project.activity)) { project.activity = []; return; }
  const cutoff = Date.now() - ACTIVITY_DAYS * 24 * 3600 * 1000;
  project.activity = project.activity
    .filter((e) => e && e.at && new Date(e.at).getTime() > cutoff)
    .sort((a, b) => new Date(a.at) - new Date(b.at))
    .slice(-ACTIVITY_MAX);
}
