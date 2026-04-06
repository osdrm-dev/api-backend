import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { FileStorageService } from 'src/storage/services/file-storage.service';
import type { File as MulterFile } from 'multer';
import { BudgetTableRepository } from '../repository/budget-table.repository';
import { CsvParserService } from './csv-parser.service';
import { BudgetDiffService, BudgetDiff } from './budget-diff.service';

const MAX_CSV_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME = ['text/csv', 'application/vnd.ms-excel', 'text/plain'];

export interface ActiveProjectImputation {
  projectCode: string;
  projectName: string;
  grantCode: string;
  activityCode: string;
  costCenter: string;
  region: string;
  site: string;
}

@Injectable()
export class BudgetTableService {
  constructor(
    private readonly repo: BudgetTableRepository,
    private readonly fileStorage: FileStorageService,
    private readonly csvParser: CsvParserService,
    private readonly diffService: BudgetDiffService,
  ) {}

  async uploadAndPreview(
    file: MulterFile,
    userId: number,
    label: string,
  ): Promise<{
    previewId: number;
    version: number;
    projectCount: number;
    label: string;
    diff: BudgetDiff;
  }> {
    if (!file) throw new BadRequestException('Fichier CSV manquant.');
    if (!label || label.trim() === '')
      throw new BadRequestException('Le libelle est obligatoire.');
    if (file.size > MAX_CSV_SIZE)
      throw new BadRequestException(
        'Le fichier CSV depasse la taille maximale de 5 MB.',
      );
    if (!ALLOWED_MIME.includes(file.mimetype))
      throw new BadRequestException(
        `Type de fichier non supporte: ${file.mimetype}`,
      );

    // Parse first so we don't save bad files.
    const rows = this.csvParser.parseBudgetCsv(file.buffer);

    // Missing-project guard vs. current active table.
    const active = await this.repo.findActiveProjects();
    if (active && active.projects.length > 0) {
      const incomingCodes = new Set(rows.map((r) => r.projectCode));
      const missing = active.projects
        .filter((p) => !incomingCodes.has(p.projectCode))
        .map((p) => p.projectCode);
      if (missing.length > 0) {
        throw new BadRequestException(
          `Le nouveau tableau budgetaire omet des codes projet presents dans le tableau actif: ${missing.join(
            ', ',
          )}`,
        );
      }
    }

    // Persist file via storage service.
    const storedFile = await this.fileStorage.upload(file, {
      userId,
      maxSize: MAX_CSV_SIZE,
      allowedTypes: ALLOWED_MIME,
      skipOptimization: true,
      metadata: { purpose: 'budget-table', label },
    });

    const version = await this.repo.getNextVersion();

    const pending = await this.repo.createPending(
      {
        version,
        label: label.trim(),
        isPending: true,
        isActive: false,
        uploadedBy: { connect: { id: userId } },
        file: { connect: { id: storedFile.id } },
      },
      rows.map((r) => ({
        projectName: r.projectName,
        projectCode: r.projectCode,
        grantCode: r.grantCode,
        activityCode: r.activityCode,
        costCenter: r.costCenter,
        region: r.region,
        site: r.site,
        budgetThreshold: r.budgetThreshold,
      })),
    );

    const diff = this.diffService.computeDiff(
      active?.projects?.map((p) => ({
        projectCode: p.projectCode,
        projectName: p.projectName,
        grantCode: p.grantCode,
        activityCode: p.activityCode,
        costCenter: p.costCenter,
        region: p.region,
        site: p.site,
        budgetThreshold: p.budgetThreshold as unknown as {
          toString(): string;
        },
      })),
      rows,
    );

    return {
      previewId: pending.id,
      version: pending.version,
      projectCount: pending.projects.length,
      label: pending.label,
      diff,
    };
  }

  async activate(budgetTableId: number) {
    const existing = await this.repo.findById(budgetTableId);
    if (!existing)
      throw new NotFoundException('Tableau budgetaire introuvable.');
    if (existing.isActive)
      throw new ConflictException('Ce tableau est deja actif.');

    const activated = await this.repo.activateInTransaction(budgetTableId);
    if (!activated)
      throw new NotFoundException('Tableau budgetaire introuvable.');

    return {
      id: activated.id,
      version: activated.version,
      label: activated.label,
      isActive: activated.isActive,
      activatedAt: activated.activatedAt,
      projectCount: activated.projects.length,
    };
  }

  async listVersions(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const { data, total } = await this.repo.findMany(skip, limit);
    return {
      data: data.map((t) => ({
        id: t.id,
        version: t.version,
        label: t.label,
        isActive: t.isActive,
        activatedAt: t.activatedAt,
        projectCount: (t as any)._count?.projects ?? 0,
        uploadedBy: t.uploadedBy,
        fileId: t.fileId,
        createdAt: t.createdAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getActive() {
    const active = await this.repo.findActive();
    if (!active) throw new NotFoundException('Aucun tableau budgetaire actif.');
    return active; // ADMIN-only endpoint, budgetThreshold allowed
  }

  async getActiveProjects() {
    const active = await this.repo.findActiveProjects();
    if (!active) throw new NotFoundException('Aucun tableau budgetaire actif.');
    return {
      projects: active.projects.map((p) => ({
        projectCode: p.projectCode,
        projectName: p.projectName,
      })),
    };
  }

  async getActiveProjectByCode(
    projectCode: string,
  ): Promise<ActiveProjectImputation> {
    const active = await this.repo.findActiveProjects();
    if (!active) throw new NotFoundException('Aucun tableau budgetaire actif.');
    const project = active.projects.find((p) => p.projectCode === projectCode);
    if (!project)
      throw new NotFoundException(
        'Code projet introuvable dans le tableau budgetaire actif.',
      );
    return {
      projectCode: project.projectCode,
      projectName: project.projectName,
      grantCode: project.grantCode,
      activityCode: project.activityCode,
      costCenter: project.costCenter,
      region: project.region,
      site: project.site,
    };
  }

  /**
   * Used by PurchaseService to resolve imputation fields (including threshold)
   * at create/publish time. Non-admin callers must NOT receive the threshold.
   */
  async getActiveProjectInternal(projectCode: string): Promise<{
    projectCode: string;
    projectName: string;
    grantCode: string;
    activityCode: string;
    costCenter: string;
    region: string;
    site: string;
    budgetThreshold: number;
  }> {
    const active = await this.repo.findActiveProjects();
    if (!active) {
      throw new ServiceUnavailableException(
        'Aucun tableau budgetaire actif. La creation de DA est temporairement indisponible.',
      );
    }
    const project = active.projects.find((p) => p.projectCode === projectCode);
    if (!project)
      throw new NotFoundException(
        'Code projet introuvable dans le tableau budgetaire actif.',
      );
    return {
      projectCode: project.projectCode,
      projectName: project.projectName,
      grantCode: project.grantCode,
      activityCode: project.activityCode,
      costCenter: project.costCenter,
      region: project.region,
      site: project.site,
      budgetThreshold: Number(project.budgetThreshold.toString()),
    };
  }

  async getById(id: number) {
    const table = await this.repo.findById(id);
    if (!table) throw new NotFoundException('Tableau budgetaire introuvable.');
    return table; // ADMIN-only endpoint, budgetThreshold allowed
  }

  // TODO: cron job (@Cron) to clean up pending budget tables older than 24h.
}
