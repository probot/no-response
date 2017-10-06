const createScheduler = require('probot-scheduler')
const NoResponse = require('./lib/no-response')

module.exports = async robot => {
  // Visit all repositories to sweep issues with no response
  createScheduler(robot)

  robot.on('schedule.repository', sweep)

  // Remove response required label if the author comments
  robot.on('issue_comment', unmark)

  async function sweep (context) {
    const config = await context.config(`no-response.yml`)

    if (config) {
      const noResponse = new NoResponse(context.github, config)
      return noResponse.sweep()
    }
  }

  async function unmark (context) {
    if (!context.isBot) {
      const issue = context.payload.issue
      const comment = context.payload.comment

      const config = await context.config(`no-response.yml`)
      if (config) {
        const noResponse = new NoResponse(context.github, config)
        if (noResponse.hasResponseRequiredLabel(issue) && issue.user.login === comment.user.login) {
          noResponse.unmark(issue)
        }
      }
    }
  }
}
