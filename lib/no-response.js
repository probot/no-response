module.exports = class NoResponse {
  async static forRepository(visit, github, repository) {
    const owner = repository.owner.login;
    const repo = repository.name;
    const path = '.github/no-response.yml';
    let config;

    try {
      const data = await github.repos.getContent({owner, repo, path});
      config = yaml.load(new Buffer(data.content, 'base64').toString()) || {};
      config.exists = true;
    } catch (err) {
      visit.stop(repository);
      // Don't perform for repository without a config
      config = {exists: false};
    }

    config = Object.assign(config, {owner, repo, logger: robot.log});

    return new NoResponse(github, config);
  }

  constructor(github, config = {}) {
    this.github = github;
    this.config = Object.assign({}, require('./defaults'), config || {});
    this.logger = config.logger || console;
  }

  async sweep() {
    this.logger.trace(this.config, 'starting sweep');

    await this.ensureResponseRequiredLabelExists();

    this.github.paginate(this.getClosableIssues(), data => {
      data.items.forEach(issue => this.close(issue));
    });
  }

  async getClosableIssues() {
    const {owner, repo, responseRequiredLabel, daysUntilClose} = this.config;
    const query = `repo:${owner}/${repo} is:issue is:open label:${responseRequiredLabel}`;
    const params = {q: query, sort: 'updated', order: 'desc', per_page: 100};
    const labeledEarlierThan = since(daysUntilClose);

    this.logger.debug(params, 'searching %s/%s for closable issues', owner, repo);
    const issues = await this.github.paginate(this.github.search.issues(params));
    return issues.filter(issue => {
      const event = await findLastLabeledEvent(issue);

      if (event.created_at < labeledEarlierThan)
      {
        issue.labeled = event.created_at;
        return issue;
      }
    });
  }

  async findLastLabeledEvent(issue) {
    const {owner, repo, responseRequiredLabel} = this.config;
    const number = issue.number;
    const params = {owner, repo, number, per_page: 100};
    const events = await this.github.paginate(this.github.issues.getEvents(params));
    return events.reverse()
                 .find(event => event.event === 'labeled' && event.label.name === responseRequiredLabel);
  }

  close(issue) {
    const {owner, repo, perform, closeComment} = this.config;
    const number = issue.number;

    if (perform) {
      this.logger.info('%s/%s#%d is being closed', owner, repo, number);
      return this.github.issues.edit({owner, repo, number, state: 'closed'}).then(() => {
        if (closeComment) {
          return this.github.issues.createComment({owner, repo, number, body: closeComment});
        }
      });
    } else {
      this.logger.info('%s/%s#%d would have been closed (dry-run)', owner, repo, number);
    }
  }

  unmark(issue) {
    const {owner, repo, perform, responseRequiredLabel} = this.config;
    const number = issue.number;

    if (perform) {
      this.logger.info('%s/%s#%d is being unmarked', owner, repo, number);
      return this.github.issues.removeLabel({owner, repo, number, name: responseRequiredLabel});
    } else {
      this.logger.info('%s/%s#%d would have been unmarked (dry-run)', owner, repo, number);
    }
  }

  hasResponseRequiredLabel(issue) {
    return issue.labels.map(label => label.name).includes(this.config.responseRequiredLabel);
  }

  async ensureResponseRequiredLabelExists() {
    const {owner, repo, responseRequiredLabel} = this.config;

    return this.github.issues.getLabel({owner, repo, name: responseRequiredLabel}).catch(() => {
      return this.github.issues.createLabel({owner, repo, name: responseRequiredLabel, color: 'ffffff'});
    });
  }

  since(days) {
    const ttl = days * 24 * 60 * 60 * 1000;
    return new Date(new Date() - ttl);
  }
};
