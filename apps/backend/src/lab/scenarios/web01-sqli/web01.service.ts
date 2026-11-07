import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service.js';

/**
 * WEB-01 — SQL Injection (T-WEB01-1, R-LAB-3).
 *
 * La faille : le paramètre `q` est concaténé directement dans une requête SQL
 * brute via $queryRawUnsafe(). Aucun paramétrage, aucune validation.
 *
 * Exploitation : UNION-based permettant d'exfiltrer id, username, email
 * et passwordHash de la table users.
 *
 * Blocage (LAB_MODE=false) : la route n'existe pas → 404.
 */
@Injectable()
export class Web01Service {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Recherche d'employés par prénom — VULNÉRABLE.
   * Concaténation directe de `q` dans le SQL, sans échappement ni paramétrage.
   */
  async search(q: string): Promise<unknown[]> {
    // Faille délibérée : concaténation directe dans $queryRawUnsafe
    const sql = `SELECT id, "employeeNumber", "firstName", "lastName", "professionalEmail", "departmentId", "positionId", "managerId" FROM employees WHERE "firstName" ILIKE '%${q}%'`;
    return this.prisma.$queryRawUnsafe(sql);
  }
}
