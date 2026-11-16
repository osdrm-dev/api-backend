import { EventEmitter } from 'events';
import { AuditMiddleware } from './audit.middleware';

function run(method: string, path: string, body: any = {}) {
  const log = jest.fn();
  const mw = new AuditMiddleware({ log } as any);
  const req: any = { method, path, body, ip: '1.2.3.4', headers: {} };
  const res: any = Object.assign(new EventEmitter(), {
    statusCode: 200,
    writableFinished: true,
    setHeader: jest.fn(),
  });
  const next = jest.fn();
  mw.use(req, res, next);
  req.user = { id: 7 }; // set later by guards
  res.emit('close');
  return { log, res, next, req };
}

describe('AuditMiddleware', () => {
  it('writes exactly one row, on close, with user set by guards', () => {
    const { log, next, res, req } = run('POST', '/purchases');
    expect(next).toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', req.traceId);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0]).toMatchObject({
      userId: 7,
      ipAddress: '1.2.3.4',
      details: { statusCode: 200, traceId: req.traceId },
    });
  });

  it('skips GET', () => {
    expect(run('GET', '/purchases').log).not.toHaveBeenCalled();
  });

  it.each([
    [
      '/purchases/clx1a2b3c4d5e6f7g8h9i0j1k/quotations',
      'purchases',
      'clx1a2b3c4d5e6f7g8h9i0j1k',
    ],
    ['/logistique/parc-auto/vehicles/42/documents', 'vehicles', '42'],
    ['/logistique/parc-auto/vehicles', 'logistique', undefined],
  ])('%s -> %s / %s', (path, resource, resourceId) => {
    expect(run('POST', path).log.mock.calls[0][0]).toMatchObject({
      resource,
      resourceId,
    });
  });

  it('redacts any key containing password/token/secret', () => {
    const body = run('POST', '/auth/change-password', {
      oldPassword: 'a',
      newPassword: 'b',
      refreshToken: 'c',
      name: 'ok',
    }).log.mock.calls[0][0].details.body;
    expect(body).toEqual({
      oldPassword: '[REDACTED]',
      newPassword: '[REDACTED]',
      refreshToken: '[REDACTED]',
      name: 'ok',
    });
  });
});
