import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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
});
