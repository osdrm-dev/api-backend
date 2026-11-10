import { HttpStatus, Injectable } from '@nestjs/common';
import { AppException, ErrorCode } from 'src/common/errors';
import { BauxRepository } from 'src/repository/baux/baux.repository';
import { CreatePaiementDto } from '../dto/create-paiement.dto';

@Injectable()
export class BauxPaiementService {
  constructor(private readonly repository: BauxRepository) {}

  async listPaiements(contractId: string) {
    const contract = await this.repository.findById(contractId);
    if (!contract)
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND,
        `Lease ${contractId} not found`,
      );
    return this.repository.findPaiementsByContract(contractId);
  }

  async addPaiement(contractId: string, dto: CreatePaiementDto) {
    const contract = await this.repository.findById(contractId);
    if (!contract)
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND,
        `Lease ${contractId} not found`,
      );

    const exists = await this.repository.existsPaiement(
      contractId,
      dto.periode,
      dto.typePaiement,
    );
    if (exists) {
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.LEASE_PAYMENT_ALREADY_EXISTS,
        'A payment of this type already exists for this period',
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
