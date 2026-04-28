import { Injectable } from '@nestjs/common';

export interface ItAmortissementRow {
  annee: number;
  dotationAnnuelle: number;
  amortissementCumule: number;
  vnc: number;
}

export interface ItAmortissementResult {
  rows: ItAmortissementRow[];
  taux: number;
  dotationAnnuelle: number;
  dateFinAmortissement: Date;
  vncCourante: number;
  estAmorti: boolean;
  anneesEcoulees: number;
  prixNonRenseigne?: boolean;
}

@Injectable()
export class ItDepreciationService {
  private round2(n: number): number {
    return Math.round(n * 100) / 100;
  }

  computeTable(
    prixAchat: number,
    dateAcquisition: Date,
    dureeVie: number,
  ): ItAmortissementResult {
    if (prixAchat === 0) {
      return {
        prixNonRenseigne: true,
        rows: [],
        taux: 0,
        dotationAnnuelle: 0,
        dateFinAmortissement: dateAcquisition,
        vncCourante: 0,
        estAmorti: true,
        anneesEcoulees: 0,
      };
    }

    const dotationAnnuelle = this.round2(prixAchat / dureeVie);
    const taux = this.round2((1 / dureeVie) * 100);

    const dateFinAmortissement = new Date(dateAcquisition);
    dateFinAmortissement.setFullYear(
      dateFinAmortissement.getFullYear() + dureeVie,
    );

    const today = new Date();
    const diffMs = today.getTime() - dateAcquisition.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    const anneesEcoulees = Math.min(Math.floor(diffDays / 365.25), dureeVie);

    const vncCourante = Math.max(
      0,
      this.round2(prixAchat - dotationAnnuelle * anneesEcoulees),
    );
    const estAmorti = vncCourante === 0;

    const rows: ItAmortissementRow[] = [];
    for (let n = 1; n <= dureeVie; n++) {
      rows.push({
        annee: n,
        dotationAnnuelle,
        amortissementCumule: this.round2(dotationAnnuelle * n),
        vnc: Math.max(0, this.round2(prixAchat - dotationAnnuelle * n)),
      });
    }

    return {
      rows,
      taux,
      dotationAnnuelle,
      dateFinAmortissement,
      vncCourante,
      estAmorti,
      anneesEcoulees,
    };
  }
}
