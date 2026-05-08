import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BauxRepository } from 'src/repository/baux/baux.repository';
import { CreatePaiementDto } from '../dto/create-paiement.dto';

@Injectable()
export class BauxPaiementService {
  constructor(private readonly repository: BauxRepository) {}

  async listPaiements(contractId: string) {
    const contract = await this.repository.findById(contractId);
    if (!contract)
      throw new NotFoundException(`Bail ${contractId} introuvable.`);
    return this.repository.findPaiementsByContract(contractId);
  }

  async addPaiement(contractId: string, dto: CreatePaiementDto) {
    const contract = await this.repository.findById(contractId);
    if (!contract)
      throw new NotFoundException(`Bail ${contractId} introuvable.`);

    const exists = await this.repository.existsPaiement(
      contractId,
      dto.periode,
      dto.typePaiement,
    );
    if (exists) {
      throw new ConflictException(
        'Un paiement de ce type existe déjà pour cette période.',
      );
    }

    return this.repository.createPaiement({
      contract: { connect: { id: contractId } },
      periode: dto.periode,
      montantPaye: dto.montantPaye.toString(),
      datePaiement: new Date(dto.datePaiement),
      typePaiement: dto.typePaiement,
      notes: dto.notes,
    });
  }
}
