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
      beforeEach(async function () {
        noResponse = new NoResponse(context, {closeComment: 'foo', perform: true}, logger)
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

      it('posts a comment', function () {
        expect(github.issues.createComment).toHaveBeenCalled()
        expect(github.issues.createComment.calls[0].arguments[0]).toMatch({body: 'foo'})
      })
    })
  })
})
