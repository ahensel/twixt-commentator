const crypto = require('crypto');

const mockUser = {
  _encryptedPassword: jest.fn((password, salt) => {
    return crypto.createHash('sha1')
      .update(password + (process.env.PEPPER || '') + salt)
      .digest('hex');
  }),
  findByPk: jest.fn().mockImplementation(async (id) => {
    if (id == 1) return mockUserInstance;
    return null;
  }),
};

const mockUserInstance = {
  id: 1,
  name: 'TestUser',
  salt: 'test-salt-123',
  hashed_password: '',
  on_lg: false,
  name_on_lg: '',
  info: 'Original info',
  setPassword: jest.fn(function (pwd) {
    this.hashed_password = mockUser._encryptedPassword(pwd, this.salt);
  }),
  save: jest.fn().mockResolvedValue(true),
};

// Set initial hashed_password for mockUserInstance
mockUserInstance.hashed_password = mockUser._encryptedPassword('currentpass', mockUserInstance.salt);

jest.mock('../models', () => ({
  User: mockUser,
}));

const userRouter = require('../routes/user');

describe('POST /user/profile/:id', () => {
  let postHandler;

  beforeAll(() => {
    // Find the POST /profile/:id route handler from the router stack
    const route = userRouter.stack.find(
      layer => layer.route && layer.route.path === '/profile/:id' && layer.route.methods.post
    );
    postHandler = route.route.stack[0].handle;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockUserInstance.name = 'TestUser';
    mockUserInstance.info = 'Original info';
    mockUserInstance.on_lg = false;
    mockUserInstance.name_on_lg = '';
    mockUserInstance.salt = 'test-salt-123';
    mockUserInstance.hashed_password = mockUser._encryptedPassword('currentpass', mockUserInstance.salt);
  });

  function createMockReqRes(body) {
    const req = {
      params: { id: 1 },
      body,
      session: {},
    };
    const res = {
      statusCode: 200,
      redirectUrl: null,
      renderedView: null,
      renderedData: null,
      status: jest.fn(function (code) {
        this.statusCode = code;
        return this;
      }),
      redirect: jest.fn(function (url) {
        this.redirectUrl = url;
      }),
      render: jest.fn(function (view, data) {
        this.renderedView = view;
        this.renderedData = data;
      }),
    };
    return { req, res };
  }

  it('updates info without password error when password is empty', async () => {
    const { req, res } = createMockReqRes({
      name: 'TestUser',
      password: '',
      password_confirmation: '',
      info: 'Updated bio information',
    });

    await postHandler(req, res);

    expect(res.redirect).toHaveBeenCalled();
    expect(mockUserInstance.info).toBe('Updated bio information');
    expect(mockUserInstance.setPassword).not.toHaveBeenCalled();
    expect(mockUserInstance.save).toHaveBeenCalled();
  });

  it('does not complain about password mismatch when browser autofilled current password without confirmation', async () => {
    const { req, res } = createMockReqRes({
      name: 'TestUser',
      password: 'currentpass',
      password_confirmation: '',
      info: 'Updated bio information with autofilled password',
    });

    await postHandler(req, res);

    expect(res.redirect).toHaveBeenCalled();
    expect(mockUserInstance.info).toBe('Updated bio information with autofilled password');
    expect(mockUserInstance.setPassword).not.toHaveBeenCalled();
    expect(mockUserInstance.save).toHaveBeenCalled();
  });

  it('complains about password mismatch when changing to a new password without confirmation, and does NOT lose edits in user-info', async () => {
    const { req, res } = createMockReqRes({
      name: 'TestUser',
      password: 'brandnewpassword',
      password_confirmation: '',
      info: 'Newly typed info that must not be lost',
    });

    await postHandler(req, res);

    expect(res.render).toHaveBeenCalledWith('user/profile', expect.objectContaining({
      errors: expect.arrayContaining(['Password confirmation does not match.']),
    }));
    expect(res.renderedData.user.info).toBe('Newly typed info that must not be lost');
    expect(mockUserInstance.save).not.toHaveBeenCalled();
  });

  it('complains about empty name and does NOT lose edits in user-info', async () => {
    const { req, res } = createMockReqRes({
      name: '   ',
      password: '',
      password_confirmation: '',
      info: 'My updated info while name was invalid',
    });

    await postHandler(req, res);

    expect(res.render).toHaveBeenCalledWith('user/profile', expect.objectContaining({
      errors: expect.arrayContaining(['Name is required.']),
    }));
    expect(res.renderedData.user.info).toBe('My updated info while name was invalid');
    expect(mockUserInstance.save).not.toHaveBeenCalled();
  });

  it('successfully updates password and info when new password and confirmation match', async () => {
    const { req, res } = createMockReqRes({
      name: 'TestUser',
      password: 'brandnewpassword',
      password_confirmation: 'brandnewpassword',
      info: 'Updated with new password',
    });

    await postHandler(req, res);

    expect(res.redirect).toHaveBeenCalled();
    expect(mockUserInstance.info).toBe('Updated with new password');
    expect(mockUserInstance.setPassword).toHaveBeenCalledWith('brandnewpassword');
    expect(mockUserInstance.save).toHaveBeenCalled();
  });
});
