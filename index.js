const yaml = require('js-yaml');
const visitor = require('probot-visitor');
const NoResponse = require('./lib/no-response');

module.exports = async robot => {
  // Visit all repositories to sweep issues with no response
  const visit = visitor(robot, sweep);

  // Remove response required label if the author comments
  robot.on('issue_comment', unmark);

  async function sweep(installation, repository) {
    const github = await robot.auth(installation.id);
    const noResponse = await forRepository(visit, github, repository);
    if (noResponse.config.exists) {
      return noResponse.sweep();
    }
  }

  async function unmark(event, context) {
    if (!context.isBot) {
      const github = await robot.auth(event.payload.installation.id);
      const noResponse = await forRepository(visit, github, event.payload.repository);
      let issue = event.payload.issue;
      let comment = event.payload.comment;

      if (noResponse.config.exists) {
        if (noResponse.hasResponseRequiredLabel(issue) && issue.user.login === comment.user.login) {
          noResponse.unmark(issue);
        }
      }
    }
  }
};
