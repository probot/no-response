const visitor = require('probot-visitor');
const yaml = require('js-yaml');
const NoResponse = require('./lib/no-response');

module.exports = async robot => {
  // Visit all repositories to sweep issues with no response
  const visit = visitor(robot, sweep);

  // Remove response required label if the author comments
  robot.on('issue_comment', unmark);

  async function sweep(installation, repository) {
    const github = await robot.auth(installation.id);
    const noResponse = await forRepository(github, repository);
    if (noResponse.config.exists) {
      return noResponse.sweep();
    }
  }

  async function unmark(event, context) {
    if (!context.isBot) {
      const github = await robot.auth(event.payload.installation.id);
      const noResponse = await forRepository(github, event.payload.repository);
      const issue = event.payload.issue;
      const comment = event.payload.comment;

      if (noResponse.config.exists) {
        if (noResponse.hasResponseRequiredLabel(issue) && issue.user.login === comment.user.login) {
          noResponse.unmark(issue);
        }
      }
    }
  }

  async function forRepository(github, repository) {
    const owner = repository.owner.login;
    const repo = repository.name;
    const path = '.github/no-response.yml';
    let config;

    try {
      const data = await github.repos.getContent({owner, repo, path});
      config = yaml.load(new Buffer(data.content, 'base64').toString()) || {};
      config.exists = true;
    } catch (err) {
      robot.log.debug(err, 'No configuration file found');
      visit.stop(repository);
      // Don't perform for repository without a config
      config = {exists: false};
    }

    config = Object.assign(config, {owner, repo, logger: robot.log});

    return new NoResponse(github, config);
  }
};
