# Probot: No Response

> a GitHub Integration built with [Probot](https://github.com/probot/probot) that closes Issues where the author hasn't responded to a request for more information.

## Usage

1. **[Configure the GitHub Integration](https://github.com/integration/probot-no-response)**
2. Create `.github/no-response.yml`

A `.github/no-response.yml` file is required to enable the plugin. The file can be empty, or it can override any of these default settings:

```yml
# Configuration for probot-no-response - https://github.com/probot/no-response

# Number of days of inactivity before an Issue is closed for lack of response
daysUntilClose: 14
# Label requiring a response
responseRequiredLabel: more-information-needed
# Comment to post when closing an Issue for lack of response. Set to `false` to disable
closeComment: >
  This issue has been automatically closed because there has been no response
  to our request for more information from the original author. With only the
  information that is currently in the issue, we don't have enough information
  to take action. Please reach out if you have or find the answers we need so
  that we can investigate further.
```

See [docs/deploy.md](docs/deploy.md) if you would like to run your own instance of this plugin.
