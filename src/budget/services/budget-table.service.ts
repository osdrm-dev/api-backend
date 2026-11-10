import { Injectable, HttpStatus } from '@nestjs/common';
import { FileStorageService } from 'src/storage/services/file-storage.service';
import type { File as MulterFile } from 'multer';
import { BudgetTableRepository } from '../repository/budget-table.repository';
import { CsvParserService } from './csv-parser.service';
import { BudgetDiffService, BudgetDiff } from './budget-diff.service';
import { AppException, ErrorCode } from 'src/common/errors';

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
    if (!file)
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.BUDGET_CSV_MISSING,
        'CSV file is missing',
      );
    if (!label || label.trim() === '')
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.BUDGET_LABEL_REQUIRED,
        'Label is required',
        { fields: [{ field: 'label', code: ErrorCode.BUDGET_LABEL_REQUIRED }] },
      );
    if (file.size > MAX_CSV_SIZE)
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.BUDGET_CSV_TOO_LARGE,
        'CSV file exceeds the maximum size of 5 MB',
      );
    if (!ALLOWED_MIME.includes(file.mimetype))
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.BUDGET_CSV_TYPE_UNSUPPORTED,
        `Unsupported file type: ${file.mimetype}`,
        { params: { type: file.mimetype } },
      );

    // Parse first so we don't save bad files.
    const rows = this.csvParser.parseBudgetCsv(file.buffer);

    // Missing-project guard vs. current active table.
    const active = await this.repo.findActiveProjects();
    if (active && active.projects.length > 0) {
      const incomingActivityCodes = new Set(rows.map((r) => r.activityCode));
      const missing = active.projects
        .filter((p) => !incomingActivityCodes.has(p.activityCode))
        .map((p) => p.activityCode);
      if (missing.length > 0) {
        throw new AppException(
          HttpStatus.BAD_REQUEST,
          ErrorCode.BUDGET_ACTIVITY_CODES_MISSING,
          `New budget table omits activity codes present in the active table: ${missing.join(', ')}`,
          { params: { codes: missing.join(', ') } },
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
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND,
        'Budget table not found',
      );
    if (existing.isActive)
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.BUDGET_ALREADY_ACTIVE,
        'Budget table is already active',
      );

    const activated = await this.repo.activateInTransaction(budgetTableId);
    if (!activated)
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND,
        'Budget table not found',
      );

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
    if (!active)
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.BUDGET_NO_ACTIVE_TABLE,
        'No active budget table',
      );
    return active; // ADMIN-only endpoint, budgetThreshold allowed
  }

  async getActiveProjects() {
    const active = await this.repo.findActiveProjects();
    if (!active)
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.BUDGET_NO_ACTIVE_TABLE,
        'No active budget table',
      );
    return {
      projects: active.projects.map((p) => ({
        projectCode: p.projectCode,
        projectName: p.projectName,
        grantCode: p.grantCode,
        activityCode: p.activityCode,
      })),
    };
  }

  async getActiveProjectByActivityCode(
    activityCode: string,
  ): Promise<ActiveProjectImputation> {
    const active = await this.repo.findActiveProjects();
    if (!active)
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.BUDGET_NO_ACTIVE_TABLE,
        'No active budget table',
      );
    const project = active.projects.find(
      (p) => p.activityCode === activityCode,
    );
    if (!project)
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.BUDGET_ACTIVITY_CODE_NOT_FOUND,
        'Activity code not found in the active budget table',
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
  async getActiveProjectInternal(activityCode: string): Promise<{
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
      throw new AppException(
        HttpStatus.SERVICE_UNAVAILABLE,
        ErrorCode.BUDGET_CREATION_UNAVAILABLE,
        'No active budget table; purchase creation is unavailable',
      );
    }
    const project = active.projects.find(
      (p) => p.activityCode === activityCode,
    );
    if (!project)
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.BUDGET_ACTIVITY_CODE_NOT_FOUND,
        'Activity code not found in the active budget table',
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
    if (!table)
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND,
        'Budget table not found',
      );
    return table; // ADMIN-only endpoint, budgetThreshold allowed
  }

  // TODO: cron job (@Cron) to clean up pending budget tables older than 24h.
}
