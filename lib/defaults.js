module.exports = {
  daysUntilClose: 14,
  perform: !process.env.DRY_RUN,
  responseRequiredLabel: 'more-information-needed',
  responseRequiredColor: 'ffffff',
  closeComment:
    'This issue has been automatically closed because there has been no response ' +
    'to our request for more information from the original author. With only the ' +
    'information that is currently in the issue, we don\'t have enough information ' +
    'to take action. Please reach out if you find the answers we need so ' +
    'that we can investigate further.'
}
