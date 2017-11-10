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
      const configWithDefaults = Object.assign({}, require('./lib/defaults'), config)
      const noResponse = new NoResponse(context, configWithDefaults, robot.log)
      return noResponse.sweep()
    }
  }

  async function unmark (context) {
    const config = await context.config('no-response.yml')

    if (config) {
      const configWithDefaults = Object.assign({}, require('./lib/defaults'), config)
      const noResponse = new NoResponse(context, configWithDefaults, robot.log)
      return noResponse.unmark(context.issue())
    }
  }
}
