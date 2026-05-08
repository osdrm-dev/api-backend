import { Injectable } from '@nestjs/common';
import { BauxRepository } from 'src/repository/baux/baux.repository';

@Injectable()
export class BauxDashboardService {
  constructor(private readonly repository: BauxRepository) {}

  async getDashboard() {
    return this.repository.getDashboardData();
  }
}
