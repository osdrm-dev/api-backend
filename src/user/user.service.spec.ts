import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import { UserService } from './user.service';
import { UserRepository } from 'src/repository/user/user.repository';
import { PrismaService } from 'prisma/prisma.service';
import { MailService } from 'src/mail/mail.service';

const userRepo = {
  findById: jest.fn(),
  findByEmail: jest.fn(),
  update: jest.fn(),
  toggleActive: jest.fn(),
};
const prisma = { lgVehicleAssignment: { updateMany: jest.fn() } };

const driver = {
  id: 7,
  email: 'd@x.mg',
  role: Role.DRIVER,
  isActive: true,
  password: 'h',
};

describe('UserService — clôture des affectations véhicule', () => {
  let service: UserService;

  beforeEach(async () => {
    jest.clearAllMocks();
    userRepo.findById.mockResolvedValue(driver);
    userRepo.update.mockImplementation(({ data }) => ({ ...driver, ...data }));
    userRepo.toggleActive.mockImplementation((id, isActive) => ({
      ...driver,
      isActive,
    }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: UserRepository, useValue: userRepo },
        { provide: PrismaService, useValue: prisma },
        { provide: MailService, useValue: {} },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();
    service = module.get(UserService);
  });

  const closeCall = {
    where: { driverId: 7, status: 'ACTIVE' },
    data: { status: 'TERMINEE', endDate: expect.any(Date) },
  };

  it('toggleActive closes assignments when deactivating', async () => {
    await service.toggleActive(7);
    expect(prisma.lgVehicleAssignment.updateMany).toHaveBeenCalledWith(
      closeCall,
    );
  });

  it('toggleActive does not close when activating', async () => {
    userRepo.findById.mockResolvedValue({ ...driver, isActive: false });
    await service.toggleActive(7);
    expect(prisma.lgVehicleAssignment.updateMany).not.toHaveBeenCalled();
  });

  it('update closes assignments when role leaves DRIVER', async () => {
    await service.update(7, { role: Role.ACHETEUR });
    expect(prisma.lgVehicleAssignment.updateMany).toHaveBeenCalledWith(
      closeCall,
    );
  });

  it('update closes assignments when deactivating via isActive=false', async () => {
    await service.update(7, { isActive: false });
    expect(prisma.lgVehicleAssignment.updateMany).toHaveBeenCalledWith(
      closeCall,
    );
  });

  it('update does not close when role unchanged', async () => {
    await service.update(7, { name: 'Rakoto' } as any);
    expect(prisma.lgVehicleAssignment.updateMany).not.toHaveBeenCalled();
  });
});
