import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import app from '../src/index';

const prisma = new PrismaClient();

describe('Health Check', () => {
  it('should return OK for health endpoint', async () => {
    const response = await request(app).get('/health').expect(200);

    expect(response.body.status).toBe('OK');
    expect(response.body.environment).toBeDefined();
  });
});

describe('Auth Routes', () => {
  beforeEach(async () => {
    // Clean up test data
    await prisma.setRecord.deleteMany({});
    await prisma.workoutDay.deleteMany({});
    await prisma.user.deleteMany({});
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.setRecord.deleteMany({});
    await prisma.workoutDay.deleteMany({});
    await prisma.user.deleteMany({});
  });

  it('should register a new user', async () => {
    const userData = {
      name: 'Test User',
      email: 'test@example.com',
      password: 'testpassword123',
    };

    const response = await request(app).post('/api/v1/auth/register').send(userData).expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data.user.email).toBe(userData.email);
    expect(response.body.data.user.name).toBe(userData.name);
    expect(response.body.data.tokens.accessToken).toBeDefined();
    expect(response.body.data.user.passwordHash).toBeUndefined();
  });

  it('should login with valid credentials', async () => {
    // First register a user
    const userData = {
      name: 'Test User',
      email: 'test@example.com',
      password: 'testpassword123',
    };

    await request(app).post('/api/v1/auth/register').send(userData);

    // Then login
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: userData.email,
        password: userData.password,
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.user.email).toBe(userData.email);
    expect(response.body.data.tokens.accessToken).toBeDefined();
  });

  it('should reject login with invalid credentials', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'nonexistent@example.com',
        password: 'wrongpassword',
      })
      .expect(401);

    expect(response.body.success).toBe(false);
    expect(response.body.error.message).toBe('Invalid credentials');
  });

  it('should update profile name and email', async () => {
    const register = await request(app).post('/api/v1/auth/register').send({
      name: 'Test User',
      email: 'test@example.com',
      password: 'testpassword123',
    });
    const accessToken = register.body.data.tokens.accessToken;

    const response = await request(app)
      .put('/api/v1/auth/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'New Name', email: 'new-email@example.com' })
      .expect(200);

    expect(response.body.data.user.name).toBe('New Name');
    expect(response.body.data.user.email).toBe('new-email@example.com');
  });

  it('should reject profile update to an email already in use', async () => {
    await request(app).post('/api/v1/auth/register').send({
      name: 'Other User',
      email: 'taken@example.com',
      password: 'testpassword123',
    });
    const register = await request(app).post('/api/v1/auth/register').send({
      name: 'Test User',
      email: 'test@example.com',
      password: 'testpassword123',
    });
    const accessToken = register.body.data.tokens.accessToken;

    await request(app)
      .put('/api/v1/auth/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Test User', email: 'taken@example.com' })
      .expect(400);
  });

  it('should change password with a correct current password', async () => {
    const register = await request(app).post('/api/v1/auth/register').send({
      name: 'Test User',
      email: 'test@example.com',
      password: 'testpassword123',
    });
    const accessToken = register.body.data.tokens.accessToken;

    await request(app)
      .put('/api/v1/auth/password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword: 'testpassword123', newPassword: 'newpassword456' })
      .expect(200);

    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'test@example.com', password: 'newpassword456' })
      .expect(200);
  });

  it('should reject password change with an incorrect current password', async () => {
    const register = await request(app).post('/api/v1/auth/register').send({
      name: 'Test User',
      email: 'test@example.com',
      password: 'testpassword123',
    });
    const accessToken = register.body.data.tokens.accessToken;

    await request(app)
      .put('/api/v1/auth/password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword: 'wrongpassword', newPassword: 'newpassword456' })
      .expect(401);
  });

  it('forgot-password always reports success, even for an unknown email', async () => {
    const response = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'nonexistent@example.com' })
      .expect(200);

    expect(response.body.success).toBe(true);
  });

  it('resets the password given a valid token, then logs in with the new password', async () => {
    await request(app).post('/api/v1/auth/register').send({
      name: 'Test User',
      email: 'test@example.com',
      password: 'testpassword123',
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await request(app).post('/api/v1/auth/forgot-password').send({ email: 'test@example.com' });
    const logged = logSpy.mock.calls.map(call => call.join(' ')).join('\n');
    logSpy.mockRestore();

    const token = logged.match(/token=([a-f0-9]+)/)?.[1];
    expect(token).toBeDefined();

    await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token, newPassword: 'resetpassword789' })
      .expect(200);

    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'test@example.com', password: 'resetpassword789' })
      .expect(200);
  });

  it('rejects reset-password with an invalid token', async () => {
    await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: 'not-a-real-token', newPassword: 'resetpassword789' })
      .expect(400);
  });
});
