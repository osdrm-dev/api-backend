import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma, LgDeplacementStatus, Role } from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';
import { NotificationService } from 'src/notification/services/nofitication.service';
import { OSDRM_PROCESS_EVENT } from 'src/notification/constants/notification.constants';
import { DeplacementRepository } from 'src/repository/deplacement/deplacement.repository';
import { CreateLiquidationDto } from '../dto/create-liquidation.dto';

const LIQUIDATION_ALLOWED_STATUSES: string[] = [
  LgDeplacementStatus.CONFIRMEE,
  LgDeplacementStatus.EN_COURS,
];

@Injectable()
export class DeplacementLiquidationService {
  constructor(
    private readonly repository: DeplacementRepository,
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  async submit(id: string, dto: CreateLiquidationDto, submittedById: number) {
    const dep = await this.repository.findById(id);
    if (!dep) throw new NotFoundException(`Déplacement ${id} introuvable.`);

    if (!LIQUIDATION_ALLOWED_STATUSES.includes(dep.status)) {
      throw new UnprocessableEntityException(
        `La liquidation n'est possible que pour les déplacements en statut CONFIRMEE ou EN_COURS (statut actuel : ${dep.status}).`,
      );
    }

    if (dep.liquidation) {
      throw new ConflictException(
        'Une liquidation a déjà été soumise pour ce déplacement.',
      );
    }

    const fraisTransport = new Prisma.Decimal(dto.fraisTransport);
    const fraisHebergement = new Prisma.Decimal(dto.fraisHebergement);
    const fraisRestauration = new Prisma.Decimal(dto.fraisRestauration);
    const autresFrais = new Prisma.Decimal(dto.autresFrais ?? 0);
    const totalLiquidation = fraisTransport
      .add(fraisHebergement)
      .add(fraisRestauration)
      .add(autresFrais);

    const [liquidation] = await this.prisma.$transaction([
      this.prisma.lgDeplacementLiquidation.create({
        data: {
          deplacementId: id,
          fraisTransport,
          fraisHebergement,
          fraisRestauration,
          autresFrais,
          totalLiquidation,
          observations: dto.observations,
          submittedById,
        },
      }),
      this.prisma.lgDeplacement.update({
        where: { id },
        data: { status: LgDeplacementStatus.LIQUIDEE },
      }),
    ]);

    try {
      const gestionnaires = await this.prisma.user.findMany({
        where: { role: Role.GESTIONNAIRE_PARC, isActive: true },
        select: { email: true },
      });
      const emails = gestionnaires.map((u) => u.email).filter(Boolean);
      if (emails.length) {
        await this.notificationService.createNotification(
          OSDRM_PROCESS_EVENT.DEPLACEMENT_LIQUIDE,
          emails,
          id,
          {
            reference: dep.reference,
            totalLiquidation: totalLiquidation.toNumber(),
          },
          false,
        );
      }
    } catch {
      // Notification failure must not roll back liquidation
    }

    return liquidation;
  }

  async getLiquidation(id: string) {
    const dep = await this.repository.findById(id);
    if (!dep) throw new NotFoundException(`Déplacement ${id} introuvable.`);
    if (!dep.liquidation)
      throw new NotFoundException(
        'Aucune liquidation soumise pour ce déplacement.',
      );
    return dep.liquidation;
  }
}
