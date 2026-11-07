import { Injectable, Logger } from '@nestjs/common';

export interface LabLogEntry {
  scenarioCode: string;
  actorId: string | null;
  sourceIp: string;
  timestamp: string;
  result: 'exploited' | 'blocked' | 'error';
}

/**
 * Logger dédié aux scénarios de lab (R-LAB-4) : ne journalise QUE
 * scenarioCode, actorId, sourceIp, timestamp et result. Aucune donnée
 * exfiltrée, aucun hash, aucun token, aucun secret — jamais.
 */
@Injectable()
export class LabLoggerService {
  private readonly logger = new Logger('Lab');

  log(entry: Omit<LabLogEntry, 'timestamp'>): void {
    const full: LabLogEntry = { ...entry, timestamp: new Date().toISOString() };
    this.logger.log(
      `scenario=${full.scenarioCode} actor=${full.actorId ?? 'anonymous'} ip=${full.sourceIp} result=${full.result}`,
    );
  }
}
