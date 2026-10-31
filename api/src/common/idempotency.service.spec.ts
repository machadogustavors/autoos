import { IdempotencyService } from './idempotency.service';
import { PrismaService } from '../prisma/prisma.service';

interface MockPrisma {
  idempotencyKey: { findUnique: jest.Mock; create: jest.Mock };
}

describe('IdempotencyService', () => {
  let service: IdempotencyService;
  let prisma: MockPrisma;

  beforeEach(() => {
    prisma = {
      idempotencyKey: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
    };
    service = new IdempotencyService(prisma as unknown as PrismaService);
  });

  it('runs createFn and records the key when nothing exists yet', async () => {
    const createFn = jest.fn().mockResolvedValue({ id: 'r1' });
    const fetchExisting = jest.fn();

    const result = await service.run(
      'key-1',
      'user-1',
      'postThing',
      fetchExisting,
      createFn,
    );

    expect(result).toEqual({ id: 'r1' });
    expect(createFn).toHaveBeenCalledTimes(1);
    expect(prisma.idempotencyKey.create).toHaveBeenCalledWith({
      data: {
        key: 'key-1',
        userId: 'user-1',
        operation: 'postThing',
        resourceId: 'r1',
      },
    });
  });

  it('returns the existing resource without calling createFn again (RF-08/RNF-06)', async () => {
    prisma.idempotencyKey.findUnique.mockResolvedValue({ resourceId: 'r1' });
    const createFn = jest.fn();
    const fetchExisting = jest.fn().mockResolvedValue({ id: 'r1' });

    const result = await service.run(
      'key-1',
      'user-1',
      'postThing',
      fetchExisting,
      createFn,
    );

    expect(result).toEqual({ id: 'r1' });
    expect(createFn).not.toHaveBeenCalled();
    expect(fetchExisting).toHaveBeenCalledWith('r1');
  });

  it('falls through to createFn if the recorded resource can no longer be found', async () => {
    prisma.idempotencyKey.findUnique.mockResolvedValue({
      resourceId: 'deleted-r1',
    });
    const fetchExisting = jest.fn().mockResolvedValue(null);
    const createFn = jest.fn().mockResolvedValue({ id: 'r2' });

    const result = await service.run(
      'key-1',
      'user-1',
      'postThing',
      fetchExisting,
      createFn,
    );

    expect(result).toEqual({ id: 'r2' });
    expect(createFn).toHaveBeenCalledTimes(1);
  });

  it('still returns the created resource if recording the key loses a race (unique violation)', async () => {
    prisma.idempotencyKey.create.mockRejectedValue(
      new Error('unique constraint'),
    );
    const createFn = jest.fn().mockResolvedValue({ id: 'r1' });

    const result = await service.run(
      'key-1',
      'user-1',
      'postThing',
      jest.fn(),
      createFn,
    );

    expect(result).toEqual({ id: 'r1' });
  });
});
