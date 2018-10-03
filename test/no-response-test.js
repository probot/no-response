const expect = require('expect')
const NoResponse = require('../lib/no-response')

describe('NoResponse', function () {
  let config
  let context
  let github
  let logger
  let repository

  beforeEach(function () {
    config = {
      responseRequiredLabel: 'more-information-needed',
      responseRequiredColor: 'ffffff'
    }

    logger = {
      debug: expect.createSpy(),
      info: expect.createSpy()
    }

    repository = {
      owner: 'probot',
      repo: 'testing-things'
    }
  })

  describe('sweep', function () {
    beforeEach(function () {
      github = {
        issues: {
          createComment: expect.createSpy(),
          createLabel: expect.createSpy(),
          edit: expect.createSpy().andReturn(Promise.resolve()),
          getLabel: expect.createSpy().andReturn(Promise.resolve())
        },
        search: {
          issues: expect.createSpy().andReturn(Promise.resolve({data: []}))
        }
      }

      context = {
        github,
        repo: (params) => { return Object.assign({}, repository, params) }
      }
    })

    it('creates a responseRequiredLabel if one does not exist', async function () {
      github.issues.getLabel = expect.createSpy().andReturn(Promise.reject(new Error()))

      const noResponse = new NoResponse(context, config, logger)

      await noResponse.sweep()

      expect(github.issues.getLabel).toHaveBeenCalled()
      expect(github.issues.getLabel.calls[0].arguments[0]).toMatch({
        owner: 'probot',
        repo: 'testing-things',
        name: 'more-information-needed'
      })
      expect(github.issues.createLabel).toHaveBeenCalled()
      expect(github.issues.createLabel.calls[0].arguments[0]).toMatch({
        owner: 'probot',
        repo: 'testing-things',
        name: 'more-information-needed',
        color: 'ffffff'
      })
    })

    it('does not create a responseRequiredLabel if it already exists', async function () {
      const noResponse = new NoResponse(context, config, logger)

      await noResponse.sweep()

      expect(github.issues.getLabel).toHaveBeenCalled()
      expect(github.issues.getLabel.calls[0].arguments[0]).toMatch({
        owner: 'probot',
        repo: 'testing-things',
        name: 'more-information-needed'
      })
      expect(github.issues.createLabel).toNotHaveBeenCalled()
    })

    it('searches for matching issues', async function () {
      const noResponse = new NoResponse(context, config, logger)

      await noResponse.sweep()

      expect(github.search.issues).toHaveBeenCalled()
      expect(github.search.issues.calls[0].arguments[0]).toMatch({
        q: 'repo:probot/testing-things is:issue is:open label:"more-information-needed"'
      })
    })
  })

  describe('close', function () {
    let noResponse

    beforeEach(function () {
      github = {
        issues: {
          createComment: expect.createSpy(),
          createLabel: expect.createSpy(),
          edit: expect.createSpy().andReturn(Promise.resolve()),
          getLabel: expect.createSpy().andReturn(Promise.resolve())
        },
        paginate: expect.createSpy().andReturn(Promise.resolve([])),
        search: {
          issues: expect.createSpy()
        }
      }

      context = {
        github,
        repo: (params) => { return Object.assign({}, repository, params) }
      }
    })

    describe('when perform is set to false', function () {
      beforeEach(async function () {
        noResponse = new NoResponse(context, {perform: false}, logger)
        await noResponse.close(context.repo({number: 1234}))
      })

      it('logs that this is a dry run', function () {
        expect(logger.info).toHaveBeenCalled()
        expect(logger.info.calls[0].arguments[0]).toMatch(/dry-run/)
      })

      it('does not close the issue', function () {
        expect(github.issues.edit).toNotHaveBeenCalled()
      })

      it('does not post a comment', function () {
        expect(github.issues.createComment).toNotHaveBeenCalled()
      })
    })

    describe('when perform is set to true and there is no close comment', function () {
      beforeEach(async function () {
        noResponse = new NoResponse(context, {closeComment: null, perform: true}, logger)
        await noResponse.close(context.repo({number: 1234}))
      })

      it('logs that the issue is being closed', function () {
        expect(logger.info).toHaveBeenCalled()
        expect(logger.info.calls[0].arguments[0]).toMatch(/is being closed/)
      })

      it('closes the issue', function () {
        expect(github.issues.edit).toHaveBeenCalled()
        expect(github.issues.edit.calls[0].arguments[0]).toMatch({state: 'closed'})
      })

      it('does not post a comment', function () {
        expect(github.issues.createComment).toNotHaveBeenCalled()
      })
    })

    describe('when perform is set to true and a close comment is included', function () {
      let noResponse

      beforeEach(function () {
        noResponse = new NoResponse(context, {closeComment: 'foo', perform: true}, logger)
      })

      it('logs that the issue is being closed', async function () {
        await noResponse.close(context.repo({number: 1234}))
        expect(logger.info).toHaveBeenCalled()
        expect(logger.info.calls[0].arguments[0]).toMatch(/is being closed/)
      })

      it('posts a comment', async function () {
        await noResponse.close(context.repo({number: 1234}))
        expect(github.issues.createComment).toHaveBeenCalled()
        expect(github.issues.createComment.calls[0].arguments[0]).toMatch({body: 'foo'})
      })

      it('closes the issue if the comment posted successfully', async function () {
        await noResponse.close(context.repo({number: 1234}))
        expect(github.issues.edit).toHaveBeenCalled()
        expect(github.issues.edit.calls[0].arguments[0]).toMatch({state: 'closed'})
      })

      it('does not close the issue if posting the comment failed', async function () {
        github.issues.createComment = expect.createSpy().andReturn(Promise.reject(new Error()))

        try {
          await noResponse.close(context.repo({number: 1234}))
        } catch (e) {}

        expect(github.issues.edit).toNotHaveBeenCalled()
      })
    })
  })

  describe('unmark', function () {
    let issueProperties
    let noResponse

    beforeEach(function () {
      issueProperties = {
        state: 'open',
        closed_by: null,
        user: {
          login: 'some-issue-author'
        },
        labels: [
          { name: 'more-information-needed' }
        ]
      }

      github = {
        issues: {
          edit: expect.createSpy(),
          get: () => {
            return Promise.resolve({
              data: {
                state: issueProperties.state,
                user: issueProperties.user,
                closed_by: issueProperties.closed_by
              }
            })
          },
          getIssueLabels: () => {
            return Promise.resolve({
              data: issueProperties.labels
            })
          },
          removeLabel: expect.createSpy()
        }
      }

      context = {
        github,
        payload: {
          issue: {
            number: 1234,
            owner: repository.owner,
            repo: repository.repo
          },
          comment: {
            user: {}
          }
        }
      }
    })

    describe('when perform is set to false', function () {
      beforeEach(function () {
        config.perform = false
        noResponse = new NoResponse(context, config, logger)
      })

      describe('when the issue has the response required label and the commenter is the issue author', function () {
        beforeEach(function () {
          context.payload.comment.user.login = 'some-issue-author'
        })

        it('logs that this is a dry run', async function () {
          await noResponse.unmark(context.payload.issue)
          expect(logger.info).toHaveBeenCalled()
          expect(logger.info.calls[0].arguments[0]).toMatch(/dry-run/)
        })

        it('does not remove the label', async function () {
          await noResponse.unmark(context.payload.issue)
          expect(github.issues.removeLabel).toNotHaveBeenCalled()
        })
      })
    })

    describe('when perform is set to true', function () {
      beforeEach(function () {
        config.perform = true
        noResponse = new NoResponse(context, config, logger)
      })

      describe('when the issue has the response required label and the commenter is the issue author', function () {
        beforeEach(function () {
          context.payload.comment.user.login = 'some-issue-author'
        })

        it('logs that the label is being removed', async function () {
          await noResponse.unmark(context.payload.issue)
          expect(logger.info).toHaveBeenCalled()
          expect(logger.info.calls[0].arguments[0]).toMatch(/is being unmarked/)
        })

        it('removes the label', async function () {
          await noResponse.unmark(context.payload.issue)
          expect(github.issues.removeLabel).toHaveBeenCalled()
          const args = github.issues.removeLabel.calls[0].arguments[0]
          expect(args.owner).toBe('probot')
          expect(args.repo).toBe('testing-things')
          expect(args.number).toBe(1234)
          expect(args.name).toBe('more-information-needed')
        })

        describe('when the issue is closed by someone other than the issue author', function () {
          it('reopens the issue', async function () {
            issueProperties.state = 'closed'
            issueProperties.closed_by = { login: 'some-other-user' }

            await noResponse.unmark(context.payload.issue)
            expect(github.issues.edit).toHaveBeenCalled()
            const args = github.issues.edit.calls[0].arguments[0]
            expect(args.owner).toBe('probot')
            expect(args.repo).toBe('testing-things')
            expect(args.number).toBe(1234)
            expect(args.state).toBe('open')
          })
        })

        describe('when the issue is closed by the issue author', function () {
          it('leaves the issue closed', async function () {
            issueProperties.state = 'closed'
            issueProperties.closed_by = { login: 'some-issue-author' }

            await noResponse.unmark(context.payload.issue)
            expect(github.issues.edit).toNotHaveBeenCalled()
          })
        })

        describe('when the issue is open', function () {
          it('leaves the issue open', async function () {
            issueProperties.state = 'open'

            await noResponse.unmark(context.payload.issue)
            expect(github.issues.edit).toNotHaveBeenCalled()
          })
        })
      })

      describe('when the issue has the response required label and the commenter is NOT the issue author', function () {
        beforeEach(function () {
          context.payload.comment.user.login = 'some-issue-commenter'
        })

        it('does not alter the issue', async function () {
          await noResponse.unmark(context.payload.issue)
          expect(github.issues.edit).toNotHaveBeenCalled()
          expect(github.issues.removeLabel).toNotHaveBeenCalled()
        })
      })

      describe('when the issue does NOT have the response required label and the commenter is the issue author', function () {
        beforeEach(function () {
          issueProperties.labels = [
            { name: 'some-other-label' }
          ]
          context.payload.comment.user.login = 'some-issue-author'
        })

        it('does not alter the issue', async function () {
          await noResponse.unmark(context.payload.issue)
          expect(github.issues.edit).toNotHaveBeenCalled()
          expect(github.issues.removeLabel).toNotHaveBeenCalled()
        })
      })
    })
  })
})
