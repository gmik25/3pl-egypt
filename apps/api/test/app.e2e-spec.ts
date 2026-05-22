import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';

// Requires a migrated + seeded test database (see test:e2e script / CI).
describe('API (e2e)', () => {
  let app: INestApplication;
  let token: string;
  const auth = () => request(app.getHttpServer());

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: true } }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('health is public and reports DB up', async () => {
    const res = await auth().get('/api/health').expect(200);
    expect(res.body.db).toBe('up');
  });

  it('rejects unauthenticated access to a protected route', async () => {
    await auth().get('/api/users/me').expect(401);
  });

  it('logs in the seeded super admin', async () => {
    const res = await auth().post('/api/auth/login').send({ email: 'admin@3pl-egypt.local', password: 'ChangeMe!2026' }).expect(200);
    token = res.body.accessToken;
    expect(token).toBeTruthy();
    const me = await auth().get('/api/users/me').set('Authorization', `Bearer ${token}`).expect(200);
    expect(me.body.email).toBe('admin@3pl-egypt.local');
  });

  it('rejects bad credentials', async () => {
    await auth().post('/api/auth/login').send({ email: 'admin@3pl-egypt.local', password: 'WrongPassword!9' }).expect(401);
  });

  it('rejects a too-short password at validation (400)', async () => {
    await auth().post('/api/auth/login').send({ email: 'admin@3pl-egypt.local', password: 'short' }).expect(400);
  });

  it('runs an order through the early lifecycle and blocks illegal transitions', async () => {
    const bearer = `Bearer ${token}`;
    const client = (
      await auth().post('/api/clients').set('Authorization', bearer)
        .send({ legalName: 'E2E Client', contactName: 'Tester', contactEmail: 't@e2e.com', contactPhone: '+201000000000', governorate: 'C' })
        .expect(201)
    ).body;

    const order = (
      await auth().post('/api/orders').set('Authorization', bearer)
        .send({ clientId: client.id, customerName: 'عميل', customerPhone: '+201111111111', governorate: 'C', paymentMethod: 'COD', codAmountPiastres: 10000, items: [{ skuCode: 'E2E-1', quantity: 1, unitPricePiastres: 10000 }] })
        .expect(201)
    ).body;
    expect(order.state).toBe('PENDING');
    expect(order.warehouseId).toBeTruthy(); // routed to a warehouse

    const picked = (
      await auth().post(`/api/orders/${order.id}/transition`).set('Authorization', bearer).send({ toState: 'PICKED' }).expect(201)
    ).body;
    expect(picked.state).toBe('PICKED');

    // PICKED → DELIVERED is illegal (must go PACKED → DISPATCHED first)
    await auth().post(`/api/orders/${order.id}/transition`).set('Authorization', bearer).send({ toState: 'DELIVERED' }).expect(400);
  });
});
